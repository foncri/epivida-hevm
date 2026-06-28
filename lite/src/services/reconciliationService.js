import { normalizeDate, nowIso, todayIso } from "../lib/date.js";
import { normalizedPatientName, normalizeService, normalizeText } from "../lib/normalize.js";
import { stripUndefined } from "../lib/validators.js";
import { hashImportRows, importRowSignature } from "./importService.js";
import { setDocMergeOrQueue } from "./offlineQueueService.js";
import { archivePatient, patientSearchIndexData, savePatient } from "./patientService.js";
import { writeAudit } from "./auditService.js";
import { monthKeyForDate, snapshotMetricFromDaily, yearKeyForDate } from "./snapshotService.js";

const PROTECTED_ABSENT_SERVICES = new Set(["HEMODIALISIS", "ONCOLOGIA", "AMBULATORIO"]);
const REPORTED_DISCHARGE_MESSAGE = "Alta reportada en censo; requiere validar tipo y fecha de egreso.";
const PROBABLE_DISCHARGE_MESSAGE = "Paciente activo no encontrado en censo completo; revisar alta probable.";
const PROTECTED_REVIEW_MESSAGE = "Paciente protegido no encontrado en censo completo; revisar manualmente.";
const DUPLICATE_LOCATION_CONFLICT_MESSAGE = "Mismo paciente detectado en dos ubicaciones del archivo; se conserva la fila mas completa.";
const DUPLICATE_EXISTING_MESSAGE = "Registro activo duplicado detectado por importacion; revisar/cerrar duplicado.";
const PROTECTED_AMBULATORY_COMPANION_MESSAGE = "Conserva registro protegido y se agrega estancia hospitalaria vinculada.";
const AUTOMATIC_DISCHARGE_MESSAGE = "Alta automatica por ausencia posterior al dia de aviso.";

function stableIdFromText(value = "") {
  let hash = 5381;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  return `patient_${(hash >>> 0).toString(36)}`;
}

function matchKeys(patient = {}) {
  return [
    patient.patientId,
    patient.hospitalInternalId,
    [
      normalizedPatientName(patient.patientName),
      patient.birthDate || "",
      patient.admissionDate || "",
      patient.sex || ""
    ].join("|")
  ].filter(Boolean);
}

function patientIdForImport(row = {}, matched = null) {
  if (matched?.patientId) return matched.patientId;
  if (row.patientId) return row.patientId;
  if (row.hospitalInternalId) return `patient_${row.hospitalInternalId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return stableIdFromText(importRowSignature(row));
}

function protectedHospitalStayId(patientId = "") {
  return `${patientId}__hospital`;
}

function patientIdOf(patient = {}) {
  return patient.patientId || patient.id || "";
}

function addIndexedPatient(index, key = "", patient = {}) {
  if (!key) return;
  const list = index.get(key) || [];
  if (!list.some(item => patientIdOf(item) === patientIdOf(patient))) list.push(patient);
  index.set(key, list);
}

function matchingActivePatients(row = {}, index = new Map()) {
  const matches = [];
  matchKeys(row).forEach(key => {
    (index.get(key) || []).forEach(patient => {
      if (!matches.some(item => patientIdOf(item) === patientIdOf(patient))) matches.push(patient);
    });
  });
  return matches;
}

function changeList(existing = {}, row = {}) {
  const changes = [];
  for (const [field, label] of [["service", "servicio"], ["bed", "cama"], ["status", "estado"], ["epidemiologicalDiagnosis", "dx epidemiologico"]]) {
    const before = existing[field] || existing[`current${field[0].toUpperCase()}${field.slice(1)}`] || "";
    const after = row[field] || "";
    if (after && before && before !== after) changes.push(`${label}: ${before} -> ${after}`);
  }
  return changes;
}

function movementNotice(existing = null, row = {}) {
  if (!existing) return "";
  const fromService = normalizeService(existing.currentService || existing.service || "");
  const fromBed = String(existing.currentBed || existing.bed || "S/C").trim() || "S/C";
  const toService = normalizeService(row.service || row.currentService || "");
  const toBed = String(row.bed || row.currentBed || "S/C").trim() || "S/C";
  if (!fromService || !toService) return "";
  if (fromService === toService && fromBed === toBed) return "";
  const name = String(row.patientName || existing.patientName || existing.name || "PACIENTE").trim().toUpperCase();
  return `${name} DE LA CAMA ${fromBed} DE ${fromService} HA SIDO MOVIDO A ${toService} CAMA ${toBed}.`;
}

function locationKey(row = {}) {
  return [row.service || row.currentService || "", row.bed || row.currentBed || ""].map(value => normalizeText(value)).join("|");
}

function hasLocationConflict(first = {}, second = {}) {
  const firstLocation = locationKey(first);
  const secondLocation = locationKey(second);
  return Boolean(firstLocation && secondLocation && firstLocation !== secondLocation);
}

function importRowCompleteness(row = {}) {
  return [
    row.patientName,
    row.service,
    row.bed,
    row.hospitalInternalId,
    row.birthDate,
    row.admissionDate,
    row.sex,
    row.age,
    row.sector,
    row.status,
    row.epidemiologicalDiagnosis,
    row.hospitalDiagnosis && row.hospitalDiagnosis !== "PENDIENTE" ? row.hospitalDiagnosis : "",
    row.observations && row.observations !== "SP" ? row.observations : ""
  ].filter(Boolean).length;
}

function mergeUniqueText(items = []) {
  return [...new Set(items.map(item => String(item || "").trim()).filter(Boolean))];
}

function primaryService(value = "") {
  return String(value || "").split("/").map(item => normalizeService(item)).filter(Boolean)[0] || normalizeService(value);
}

function isProtectedAmbulatoryService(value = "") {
  const service = primaryService(value);
  return ["HEMODIALISIS", "ONCOLOGIA"].includes(service);
}

function isPlainAmbulatoryService(value = "") {
  return primaryService(value) === "AMBULATORIO";
}

function isHospitalStayService(value = "") {
  const service = primaryService(value);
  return Boolean(service) && !isPlainAmbulatoryService(service) && !isProtectedAmbulatoryService(service);
}

function latestCensusDate(patient = {}) {
  return normalizeDate(patient.latestCensusDate || patient.lastCensusDate || patient.censusDate);
}

function shouldAutoDischargeBeforeImport(patient = {}, date = "") {
  if (!patient || patient.hospitalizationStatus === "egresado" || patient.active === false) return false;
  const latest = latestCensusDate(patient);
  const currentDate = normalizeDate(date);
  if (!latest || !currentDate || latest >= currentDate) return false;
  if (["alta_probable", "alta_reportada"].includes(patient.hospitalizationStatus)) return true;
  const service = patient.currentService || patient.service || "";
  return isPlainAmbulatoryService(service) && !isProtectedAmbulatoryService(service);
}

function combinedServiceLabel(baseService = "", targetService = "") {
  const left = normalizeService(baseService);
  const right = normalizeService(targetService);
  return left && right && left !== right ? `${left} / ${right}` : right || left;
}

function protectedAmbulatoryCarryRow(patient = {}, date = "") {
  return stripUndefined({
    ...patient,
    patientId: patientIdOf(patient),
    patientName: patient.patientName || patient.name || "",
    normalizedPatientName: patient.normalizedPatientName || normalizedPatientName(patient.patientName || patient.name || ""),
    service: patient.service || patient.currentService || "",
    currentService: patient.currentService || patient.service || "",
    bed: patient.bed || patient.currentBed || "AMB",
    currentBed: patient.currentBed || patient.bed || "AMB",
    deih: patient.deih || "NA",
    active: true,
    presentInLatestCensus: true,
    lastCensusDate: date,
    carriedProtectedAmbulatory: true,
    importAlerts: withImportAlert(patient, PROTECTED_AMBULATORY_COMPANION_MESSAGE)
  });
}

function protectedAmbulatoryCompanionRow(row = {}, sourcePatient = {}, sourcePatientId = "", companionExisting = null) {
  const companionId = protectedHospitalStayId(sourcePatientId);
  const sourceService = sourcePatient.currentService || sourcePatient.service || "";
  const service = combinedServiceLabel(sourceService, row.service || row.currentService || "");
  return stripUndefined({
    ...(companionExisting || {}),
    ...row,
    patientId: companionId,
    basePatientId: sourcePatientId,
    ambulatoryCompanion: true,
    ambulatorySourceService: normalizeService(sourceService),
    service,
    currentService: service,
    active: true,
    importAlerts: withImportAlert(row, `${row.patientName || sourcePatient.patientName || "Paciente"} conserva registro en ${normalizeService(sourceService)} y se agrega estancia hospitalaria en ${normalizeService(row.service || row.currentService)} cama ${row.bed || row.currentBed || "S/C"}.`)
  });
}

function importMode(options = {}) {
  const mode = String(options.mode || options.importScope || "auto").toLowerCase();
  return ["auto", "full", "partial"].includes(mode) ? mode : "auto";
}

export function resolveImportScope(rows = [], activePatients = [], options = {}) {
  const requestedMode = importMode(options);
  const incomingCount = rows.filter(row => row.patientName || row.hospitalInternalId || row.bed || row.service).length;
  const activeCount = activePatients.filter(patient => patient.active !== false).length;
  const sameDayCensusCount = Number(options.sameDayCensusCount || 0);
  const serviceCount = new Set(rows.map(row => row.service).filter(Boolean)).size;

  if (requestedMode === "full" || requestedMode === "partial") {
    return {
      importScope: requestedMode,
      requestedMode,
      preserveExistingPatients: requestedMode === "partial",
      scopeReason: `forced_${requestedMode}`,
      incomingCount,
      activeCount,
      sameDayCensusCount,
      serviceCount
    };
  }

  if (!incomingCount) {
    return {
      importScope: "partial",
      requestedMode,
      preserveExistingPatients: true,
      scopeReason: "empty_import",
      incomingCount,
      activeCount,
      sameDayCensusCount,
      serviceCount
    };
  }

  if (!activeCount && !sameDayCensusCount) {
    return {
      importScope: "full",
      requestedMode,
      preserveExistingPatients: false,
      scopeReason: "initial_census",
      incomingCount,
      activeCount,
      sameDayCensusCount,
      serviceCount
    };
  }

  if (sameDayCensusCount && incomingCount < Math.max(8, Math.ceil(sameDayCensusCount * 0.75))) {
    return {
      importScope: "partial",
      requestedMode,
      preserveExistingPatients: true,
      scopeReason: "below_same_day_threshold",
      incomingCount,
      activeCount,
      sameDayCensusCount,
      serviceCount
    };
  }

  if (activeCount && incomingCount >= Math.ceil(activeCount * 0.75)) {
    return {
      importScope: "full",
      requestedMode,
      preserveExistingPatients: false,
      scopeReason: "active_coverage_threshold",
      incomingCount,
      activeCount,
      sameDayCensusCount,
      serviceCount
    };
  }

  if (activeCount && serviceCount >= 3 && incomingCount >= Math.max(8, Math.ceil(activeCount * 0.5))) {
    return {
      importScope: "full",
      requestedMode,
      preserveExistingPatients: false,
      scopeReason: "multi_service_coverage",
      incomingCount,
      activeCount,
      sameDayCensusCount,
      serviceCount
    };
  }

  return {
    importScope: "partial",
    requestedMode,
    preserveExistingPatients: true,
    scopeReason: "below_full_coverage",
    incomingCount,
    activeCount,
    sameDayCensusCount,
    serviceCount
  };
}

export function extractReportedDischarge(row = {}, censusDate = "") {
  const rawText = [row.observations, row.pending, row.pendientes, row.notes].filter(Boolean).join(" ");
  const text = normalizeText(rawText);
  if (!/(ALTA|EGRESO|DEFUNCION|FALLEC|EXITU)/.test(text)) return null;
  return {
    type: dischargeTypeFromText(text),
    date: normalizeDate(rawText) || normalizeDate(censusDate) || todayIso()
  };
}

function dischargeTypeFromText(text = "") {
  if (/DEFUNCION|FALLEC|EXITU/.test(text)) return "DEFUNCION";
  if (/TRASLAD/.test(text)) return "TRASLADO";
  if (/VOLUNTAR/.test(text)) return "ALTA VOLUNTARIA";
  if (/MAXIMO BENEFICIO|MAX BENEF/.test(text)) return "MAXIMO BENEFICIO";
  if (/NO AUTORIZ|FUGA|ABANDON/.test(text)) return "ALTA NO AUTORIZADA";
  return "ALTA HOSPITALARIA POR MEJORIA";
}

function withImportAlert(row = {}, message = "") {
  const alerts = Array.isArray(row.importAlerts) ? row.importAlerts : [];
  return [...new Set([...alerts, message].filter(Boolean))];
}

export function enrichImportRowForReconciliation(row = {}, censusDate = "") {
  const reported = extractReportedDischarge(row, censusDate);
  if (!reported) return row;
  return stripUndefined({
    ...row,
    dischargeReported: true,
    dischargeReviewRequired: true,
    probableDischarge: true,
    hospitalizationStatus: "alta_reportada",
    latestRoundStatus: "alerta",
    dischargeType: reported.type,
    dischargeDate: reported.date,
    importAlert: REPORTED_DISCHARGE_MESSAGE,
    importAlerts: withImportAlert(row, REPORTED_DISCHARGE_MESSAGE)
  });
}

function patientService(patient = {}) {
  return patient.service || patient.currentService || "";
}

export function canArchiveAbsentPatient(patient = {}) {
  const service = normalizeText(patientService(patient));
  if (PROTECTED_ABSENT_SERVICES.has(service)) return false;
  const status = String(patient.status || patient.currentState || "").toUpperCase();
  return !/AMBULATORIO|HEMODIALISIS|ONCOLOGIA/.test(status);
}

function absentReviewItem(patient = {}) {
  const canArchive = canArchiveAbsentPatient(patient);
  return {
    action: "absent",
    patientId: patient.patientId || patient.id,
    canArchive,
    reason: canArchive ? "probable_discharge_review_required" : "protected_service_review_required",
    reconciliationRequired: true,
    probableDischarge: canArchive,
    dischargeReviewRequired: true,
    hospitalizationStatus: canArchive ? "alta_probable" : "requiere_conciliacion",
    latestRoundStatus: "alerta",
    importAlert: canArchive ? PROBABLE_DISCHARGE_MESSAGE : PROTECTED_REVIEW_MESSAGE,
    patient
  };
}

function duplicateExistingReviewItem(patient = {}, row = {}, keptPatientId = "") {
  return {
    action: "duplicate_existing",
    patientId: patientIdOf(patient),
    keptPatientId,
    reason: "duplicate_existing_review_required",
    reconciliationRequired: true,
    probableDischarge: false,
    dischargeReviewRequired: true,
    hospitalizationStatus: "duplicado_requiere_conciliacion",
    latestRoundStatus: "alerta",
    importAlert: DUPLICATE_EXISTING_MESSAGE,
    row,
    patient
  };
}

function automaticDischargeItem(patient = {}, date = "") {
  return {
    action: "automatic_discharge",
    patientId: patientIdOf(patient),
    reason: "automatic_discharge_before_import",
    hospitalizationStatus: "egresado",
    latestRoundStatus: "revisado",
    importAlert: AUTOMATIC_DISCHARGE_MESSAGE,
    date,
    patient
  };
}

function automaticDischargeCensusRow(item = {}, date = "", now = nowIso()) {
  const patient = item.patient || {};
  return stripUndefined({
    ...patient,
    patientId: item.patientId || patient.patientId || patient.id,
    patientName: patient.patientName || patient.name || "",
    service: patient.service || patient.currentService || "",
    currentService: patient.currentService || patient.service || "",
    bed: patient.bed || patient.currentBed || "",
    currentBed: patient.currentBed || patient.bed || "",
    active: false,
    censusDate: date,
    present: false,
    hospitalizationStatus: "egresado",
    latestRoundStatus: "revisado",
    dischargeReason: item.reason,
    importAlert: item.importAlert,
    importAlerts: withImportAlert(patient, item.importAlert),
    reconciliationStatus: "auto_discharged",
    updatedAt: now
  });
}

function absentPatientPayload(item = {}, date = "") {
  const patient = item.patient || {};
  return stripUndefined({
    ...patient,
    patientId: item.patientId || patient.patientId || patient.id,
    active: true,
    lastCensusDate: date,
    presentInLatestCensus: false,
    reconciliationRequired: true,
    dischargeReviewRequired: true,
    probableDischarge: Boolean(item.probableDischarge),
    hospitalizationStatus: item.hospitalizationStatus,
    latestRoundStatus: item.latestRoundStatus || "alerta",
    reconciliationReason: item.reason,
    importAlert: item.importAlert,
    importAlerts: withImportAlert(patient, item.importAlert)
  });
}

function censusReconciliationRow(item = {}, date = "", now = nowIso()) {
  const patient = item.patient || {};
  return stripUndefined({
    ...absentPatientPayload(item, date),
    patientName: patient.patientName || patient.name || "",
    service: patient.service || patient.currentService || "",
    currentService: patient.currentService || patient.service || "",
    bed: patient.bed || patient.currentBed || "",
    currentBed: patient.currentBed || patient.bed || "",
    censusDate: date,
    present: false,
    reconciliationRequired: true,
    reconciliationStatus: "requires_review",
    updatedAt: now
  });
}

async function markAbsentForReview(app, item = {}, date = "") {
  const payload = absentPatientPayload(item, date);
  const saved = await savePatient(app, payload);
  await writeAudit(app, {
    actionType: item.probableDischarge ? "patient_probable_discharge" : "patient_reconciliation_required",
    module: "importar-censo",
    entityType: "patient",
    entityId: item.patientId,
    patientId: item.patientId,
    before: item.patient,
    after: {
      patientId: saved.patientId,
      reconciliationRequired: saved.reconciliationRequired,
      probableDischarge: saved.probableDischarge,
      hospitalizationStatus: saved.hospitalizationStatus,
      reconciliationReason: saved.reconciliationReason
    }
  });
  return saved;
}

async function markDuplicateExistingForReview(app, item = {}, date = "") {
  const patient = item.patient || {};
  const payload = stripUndefined({
    ...patient,
    patientId: item.patientId || patient.patientId || patient.id,
    active: true,
    lastCensusDate: date,
    presentInLatestCensus: false,
    reconciliationRequired: true,
    dischargeReviewRequired: true,
    probableDischarge: false,
    hospitalizationStatus: item.hospitalizationStatus,
    latestRoundStatus: item.latestRoundStatus || "alerta",
    reconciliationReason: item.reason,
    importAlert: item.importAlert,
    importAlerts: withImportAlert(patient, item.importAlert),
    activePendingIssues: mergeUniqueText([...(patient.activePendingIssues || []), item.importAlert])
  });
  const saved = await savePatient(app, payload);
  await writeAudit(app, {
    actionType: "patient_duplicate_existing_review",
    module: "importar-censo",
    entityType: "patient",
    entityId: item.patientId,
    patientId: item.patientId,
    before: patient,
    after: {
      patientId: saved.patientId,
      keptPatientId: item.keptPatientId,
      reconciliationRequired: saved.reconciliationRequired,
      hospitalizationStatus: saved.hospitalizationStatus,
      reconciliationReason: saved.reconciliationReason
    }
  });
  return saved;
}

export function reconcileCensusRows(rows = [], activePatients = [], options = {}) {
  const scope = resolveImportScope(rows, activePatients, options);
  const index = new Map();
  activePatients.forEach(patient => {
    matchKeys(patient).forEach(key => addIndexedPatient(index, key, patient));
  });

  const seen = new Map();
  const importedPatientIds = new Set();
  const duplicateExistingMap = new Map();
  const carriedProtectedIds = new Set();
  const entries = [];
  rows.forEach(originalRow => {
    let row = enrichImportRowForReconciliation(originalRow, options.date);
    const matches = matchingActivePatients(row, index);
    let matched = matches[0] || null;
    const protectedCompanion = matched && isProtectedAmbulatoryService(patientService(matched)) && isHospitalStayService(row.service || row.currentService);
    if (protectedCompanion) {
      const sourcePatientId = patientIdOf(matched);
      const companionId = protectedHospitalStayId(sourcePatientId);
      const companionExisting = activePatients.find(patient => patientIdOf(patient) === companionId);
      if (!carriedProtectedIds.has(sourcePatientId)) {
        const carryRow = protectedAmbulatoryCarryRow(matched, options.date);
        const carryEntry = {
          action: "unchanged",
          duplicate: false,
          conflict: false,
          conflictReason: "",
          duplicateExisting: [],
          existingPatientId: sourcePatientId,
          patientId: sourcePatientId,
          changes: [],
          row: carryRow
        };
        carriedProtectedIds.add(sourcePatientId);
        importedPatientIds.add(sourcePatientId);
        seen.set(`${sourcePatientId}|${importRowSignature(carryRow)}`, entries.length);
        entries.push(carryEntry);
      }
      row = protectedAmbulatoryCompanionRow(row, matched, sourcePatientId, companionExisting);
      matched = companionExisting || null;
    }
    const patientId = protectedCompanion ? row.patientId : patientIdForImport(row, matched);
    const duplicateKey = `${patientId}|${importRowSignature(row)}`;
    importedPatientIds.add(patientId);
    const changes = matched ? changeList(matched, row) : [];
    const movementAlert = matched ? movementNotice(matched, row) : "";
    const alertRow = movementAlert
      ? { ...row, importAlert: movementAlert, importAlerts: withImportAlert(row, movementAlert) }
      : row;
    const duplicateExisting = protectedCompanion ? [] : matches.filter(patient => patientIdOf(patient) !== patientId);
    duplicateExisting.forEach(patient => {
      const existingId = patientIdOf(patient);
      if (!duplicateExistingMap.has(existingId)) {
        duplicateExistingMap.set(existingId, duplicateExistingReviewItem(patient, alertRow, patientId));
      }
    });
    const baseAction = matched ? changes.length ? "move_or_update" : "unchanged" : "new";
    const entry = {
      action: baseAction,
      duplicate: false,
      conflict: false,
      conflictReason: "",
      duplicateExisting: duplicateExisting.map(patient => ({
        patientId: patientIdOf(patient),
        patientName: patient.patientName || patient.name || "",
        service: patient.service || patient.currentService || "",
        bed: patient.bed || patient.currentBed || ""
      })),
      existingPatientId: matched?.patientId || "",
      patientId,
      changes,
      row: duplicateExisting.length
        ? { ...alertRow, patientId, importAlert: DUPLICATE_EXISTING_MESSAGE, importAlerts: withImportAlert(alertRow, DUPLICATE_EXISTING_MESSAGE) }
        : { ...alertRow, patientId }
    };
    const previousIndex = seen.get(duplicateKey);
    if (previousIndex !== undefined) {
      const previous = entries[previousIndex];
      const conflict = hasLocationConflict(previous.row, entry.row);
      const currentWins = importRowCompleteness(entry.row) > importRowCompleteness(previous.row);
      const kept = currentWins ? entry : previous;
      const skipped = currentWins ? previous : entry;
      skipped.duplicate = true;
      skipped.action = "duplicate";
      if (conflict) {
        kept.conflict = true;
        kept.conflictReason = DUPLICATE_LOCATION_CONFLICT_MESSAGE;
        kept.action = "conflict";
        kept.row = {
          ...kept.row,
          importAlert: DUPLICATE_LOCATION_CONFLICT_MESSAGE,
          importAlerts: withImportAlert(kept.row, DUPLICATE_LOCATION_CONFLICT_MESSAGE)
        };
        skipped.conflict = true;
        skipped.conflictReason = DUPLICATE_LOCATION_CONFLICT_MESSAGE;
        skipped.row = {
          ...skipped.row,
          importAlert: DUPLICATE_LOCATION_CONFLICT_MESSAGE,
          importAlerts: withImportAlert(skipped.row, DUPLICATE_LOCATION_CONFLICT_MESSAGE)
        };
      }
      if (currentWins) seen.set(duplicateKey, entries.length);
    } else {
      seen.set(duplicateKey, entries.length);
    }
    entries.push(entry);
  });

  const duplicateExisting = [...duplicateExistingMap.values()];
  const duplicateExistingIds = new Set(duplicateExisting.map(item => item.patientId));
  const automaticDischarges = scope.importScope === "full"
    ? activePatients
      .filter(patient => patient.active !== false && !importedPatientIds.has(patient.patientId || patient.id) && !duplicateExistingIds.has(patientIdOf(patient)))
      .filter(patient => shouldAutoDischargeBeforeImport(patient, options.date))
      .map(patient => automaticDischargeItem(patient, options.date))
    : [];
  const automaticDischargeIds = new Set(automaticDischarges.map(item => item.patientId));
  const absent = scope.importScope === "full"
    ? activePatients
      .filter(patient => patient.active !== false && !importedPatientIds.has(patient.patientId || patient.id) && !duplicateExistingIds.has(patientIdOf(patient)) && !automaticDischargeIds.has(patientIdOf(patient)))
      .map(absentReviewItem)
    : [];

  return {
    entries,
    absent,
    duplicateExisting,
    automaticDischarges,
    summary: {
      totalRows: rows.length,
      importScope: scope.importScope,
      requestedMode: scope.requestedMode,
      scopeReason: scope.scopeReason,
      preserveExistingPatients: scope.preserveExistingPatients,
      incomingPatients: scope.incomingCount,
      activePatients: scope.activeCount,
      serviceCount: scope.serviceCount,
      newPatients: entries.filter(entry => entry.action === "new").length,
      changedPatients: entries.filter(entry => entry.action === "move_or_update").length,
      unchangedPatients: entries.filter(entry => entry.action === "unchanged").length,
      duplicateRows: entries.filter(entry => entry.duplicate).length,
      conflictRows: entries.filter(entry => entry.conflict && !entry.duplicate).length,
      duplicateExistingRows: duplicateExisting.length,
      automaticDischarges: automaticDischarges.length,
      absentPatients: absent.length,
      reportedDischarges: entries.filter(entry => entry.row.dischargeReported).length,
      probableDischarges: absent.filter(item => item.probableDischarge).length
    }
  };
}

export async function applyCensusImport(app, preview, options = {}) {
  const date = options.date || todayIso();
  const now = nowIso();
  const entries = (preview.entries || []).filter(entry => !entry.duplicate);
  const importedRows = entries.map(entry => entry.row);
  const absentItems = preview.absent || [];
  const duplicateExistingItems = preview.duplicateExisting || [];
  const automaticDischargeItems = preview.automaticDischarges || [];
  const savedPatients = await Promise.all(entries.map(entry => savePatient(app, {
    ...entry.row,
    active: true,
    lastCensusDate: date
  })));

  let archived = [];
  if (options.archiveAbsent === true) {
    archived = await Promise.all(absentItems
      .filter(item => item.canArchive !== false)
      .map(item => archivePatient(app, item.patient, "egreso_por_conciliacion_censo")));
  }
  const reviewedAbsent = await Promise.all(absentItems
    .filter(item => !(options.archiveAbsent === true && item.canArchive !== false))
    .map(item => markAbsentForReview(app, item, date)));
  const reviewedDuplicates = await Promise.all(duplicateExistingItems
    .map(item => markDuplicateExistingForReview(app, item, date)));
  const automaticArchived = await Promise.all(automaticDischargeItems
    .map(item => archivePatient(app, {
      ...item.patient,
      activePendingIssues: mergeUniqueText([...(item.patient?.activePendingIssues || []), item.importAlert]),
      hospitalizationStatus: "egresado",
      latestRoundStatus: "revisado",
      presentInLatestCensus: false
    }, item.reason)));

  const reconciliationItems = [...absentItems, ...duplicateExistingItems];
  const reconciliationRows = reconciliationItems.map(item => censusReconciliationRow(item, date, now));
  const automaticRows = automaticDischargeItems.map(item => automaticDischargeCensusRow(item, date, now));
  const snapshotRows = [...importedRows, ...reconciliationRows, ...automaticRows];
  const activeSnapshotRows = [
    ...importedRows,
    ...reconciliationRows.filter((row, index) => !(options.archiveAbsent === true && reconciliationItems[index]?.action === "absent" && reconciliationItems[index]?.canArchive !== false))
  ];

  const hash = hashImportRows(importedRows);
  const censusSummary = stripUndefined({
    date,
    totalPatients: snapshotRows.length,
    importedPatients: importedRows.length,
    reconciliationPatients: reconciliationRows.length,
    importedAt: now,
    importedBy: app.state.auth.user?.uid || "",
    source: options.source || "manual",
    hash,
    importScope: preview.summary?.importScope || options.importScope || "auto",
    preserveExistingPatients: Boolean(preview.summary?.preserveExistingPatients),
    reportedDischarges: preview.summary?.reportedDischarges || 0,
    probableDischarges: preview.summary?.probableDischarges || 0,
    duplicateExistingRows: preview.summary?.duplicateExistingRows || 0,
    automaticDischarges: preview.summary?.automaticDischarges || 0,
    reconciliationStatus: reconciliationItems.length ? "requires_review" : "complete"
  });

  const summarySaved = await setDocMergeOrQueue(app, `census_days/${date}`, censusSummary, {
    module: "importar-censo",
    entityType: "census_day",
    entityId: date
  });

  await Promise.all(savedPatients.map(patient => Promise.all([
    setDocMergeOrQueue(app, `census_days/${date}/patients/${patient.patientId}`, patient, {
      module: "importar-censo",
      entityType: "census_day_patient",
      entityId: patient.patientId
    }),
    setDocMergeOrQueue(app, `patients_search/${patient.patientId}`, patientSearchIndexData(patient, {
      lastSeenAt: date,
      updatedAt: now
    }), {
      module: "importar-censo",
      entityType: "patient_search",
      entityId: patient.patientId
    })
  ])));

  await Promise.all(reconciliationRows.map(row => setDocMergeOrQueue(app, `census_days/${date}/patients/${row.patientId}`, row, {
    module: "importar-censo",
    entityType: "census_day_patient",
    entityId: row.patientId
  })));
  await Promise.all(automaticRows.map(row => setDocMergeOrQueue(app, `census_days/${date}/patients/${row.patientId}`, row, {
    module: "importar-censo",
    entityType: "census_day_patient",
    entityId: row.patientId
  })));

  const dailySnapshot = {
    date,
    totalActivePatients: activeSnapshotRows.length,
    totalImportedPatients: importedRows.length,
    totalReconciliationPatients: reconciliationRows.length,
    probableDischarges: preview.summary?.probableDischarges || 0,
    reportedDischarges: preview.summary?.reportedDischarges || 0,
    automaticDischarges: preview.summary?.automaticDischarges || 0,
    patientsByService: activeSnapshotRows.reduce((map, row) => {
      const key = row.service || "SIN SERVICIO";
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {}),
    lastUpdatedAt: now
  };

  await setDocMergeOrQueue(app, `daily_snapshots/${date}`, dailySnapshot, {
    module: "importar-censo",
    entityType: "daily_snapshot",
    entityId: date
  });
  await writePeriodSnapshots(app, date, dailySnapshot, now);

  await writeAudit(app, {
    actionType: "census_import",
    module: "importar-censo",
    entityType: "census_day",
    entityId: date,
    after: { ...preview.summary, archived: archived.length, reviewedAbsent: reviewedAbsent.length, reviewedDuplicates: reviewedDuplicates.length, automaticArchived: automaticArchived.length, hash }
  });

  return {
    syncStatus: savedPatients.some(row => row.syncStatus === "local_pending") || archived.some(row => row.syncStatus === "local_pending") || reviewedAbsent.some(row => row.syncStatus === "local_pending") || reviewedDuplicates.some(row => row.syncStatus === "local_pending") || automaticArchived.some(row => row.syncStatus === "local_pending") || summarySaved.syncStatus === "local_pending"
      ? "local_pending"
      : "server_synced",
    savedPatients,
    archived,
    reviewedAbsent,
    reviewedDuplicates,
    automaticArchived,
    summary: censusSummary
  };
}

async function writePeriodSnapshots(app, date, dailySnapshot, now) {
  const month = monthKeyForDate(date);
  const year = yearKeyForDate(date);
  const metric = {
    ...snapshotMetricFromDaily(date, dailySnapshot),
    updatedAt: now
  };
  const monthMetric = {
    month,
    lastSnapshotDate: date,
    ...metric
  };
  await Promise.all([
    setDocMergeOrQueue(app, `monthly_snapshots/${month}`, {
      month,
      year,
      lastSnapshotDate: date,
      latest: metric,
      dailyMetrics: {
        [date]: metric
      },
      lastUpdatedAt: now
    }, {
      module: "importar-censo",
      entityType: "monthly_snapshot",
      entityId: month
    }),
    setDocMergeOrQueue(app, `yearly_snapshots/${year}`, {
      year,
      lastSnapshotDate: date,
      latest: metric,
      monthlyMetrics: {
        [month]: monthMetric
      },
      lastUpdatedAt: now
    }, {
      module: "importar-censo",
      entityType: "yearly_snapshot",
      entityId: year
    })
  ]);
}

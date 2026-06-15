import { nowIso, todayIso } from "../lib/date.js";
import { normalizedPatientName } from "../lib/normalize.js";
import { stripUndefined } from "../lib/validators.js";
import { hashImportRows, importRowSignature } from "./importService.js";
import { setDocMergeOrQueue } from "./offlineQueueService.js";
import { archivePatient, savePatient } from "./patientService.js";
import { writeAudit } from "./auditService.js";

const PROTECTED_ABSENT_SERVICES = new Set(["HEMODIALISIS", "ONCOLOGIA", "AMBULATORIO"]);

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

function changeList(existing = {}, row = {}) {
  const changes = [];
  for (const [field, label] of [["service", "servicio"], ["bed", "cama"], ["status", "estado"], ["epidemiologicalDiagnosis", "dx epidemiologico"]]) {
    const before = existing[field] || existing[`current${field[0].toUpperCase()}${field.slice(1)}`] || "";
    const after = row[field] || "";
    if (after && before && before !== after) changes.push(`${label}: ${before} -> ${after}`);
  }
  return changes;
}

function patientService(patient = {}) {
  return patient.service || patient.currentService || "";
}

export function canArchiveAbsentPatient(patient = {}) {
  const service = patientService(patient);
  if (PROTECTED_ABSENT_SERVICES.has(service)) return false;
  const status = String(patient.status || patient.currentState || "").toUpperCase();
  return !/AMBULATORIO|HEMODIALISIS|ONCOLOGIA/.test(status);
}

export function reconcileCensusRows(rows = [], activePatients = []) {
  const index = new Map();
  activePatients.forEach(patient => {
    matchKeys(patient).forEach(key => index.set(key, patient));
  });

  const seen = new Map();
  const importedPatientIds = new Set();
  const entries = rows.map(row => {
    const duplicateKey = importRowSignature(row);
    const duplicate = seen.has(duplicateKey);
    seen.set(duplicateKey, true);
    const matched = matchKeys(row).map(key => index.get(key)).find(Boolean);
    const patientId = patientIdForImport(row, matched);
    importedPatientIds.add(patientId);
    const changes = matched ? changeList(matched, row) : [];
    const action = duplicate ? "duplicate" : matched ? changes.length ? "move_or_update" : "unchanged" : "new";
    return {
      action,
      duplicate,
      existingPatientId: matched?.patientId || "",
      patientId,
      changes,
      row: { ...row, patientId }
    };
  });

  const absent = activePatients
    .filter(patient => patient.active !== false && !importedPatientIds.has(patient.patientId || patient.id))
    .map(patient => ({
      action: "absent",
      patientId: patient.patientId || patient.id,
      canArchive: canArchiveAbsentPatient(patient),
      reason: canArchiveAbsentPatient(patient) ? "not_seen_in_import" : "protected_service_review_required",
      patient
    }));

  return {
    entries,
    absent,
    summary: {
      totalRows: rows.length,
      newPatients: entries.filter(entry => entry.action === "new").length,
      changedPatients: entries.filter(entry => entry.action === "move_or_update").length,
      unchangedPatients: entries.filter(entry => entry.action === "unchanged").length,
      duplicateRows: entries.filter(entry => entry.duplicate).length,
      absentPatients: absent.length
    }
  };
}

export async function applyCensusImport(app, preview, options = {}) {
  const date = options.date || todayIso();
  const now = nowIso();
  const entries = (preview.entries || []).filter(entry => !entry.duplicate);
  const importedRows = entries.map(entry => entry.row);
  const savedPatients = await Promise.all(entries.map(entry => savePatient(app, {
    ...entry.row,
    active: true,
    lastCensusDate: date
  })));

  let archived = [];
  if (options.archiveAbsent === true) {
    archived = await Promise.all((preview.absent || [])
      .filter(item => item.canArchive !== false)
      .map(item => archivePatient(app, item.patient, "egreso_por_conciliacion_censo")));
  }

  const hash = hashImportRows(importedRows);
  const censusSummary = stripUndefined({
    date,
    totalPatients: importedRows.length,
    importedAt: now,
    importedBy: app.state.auth.user?.uid || "",
    source: options.source || "manual",
    hash,
    reconciliationStatus: preview.absent?.length ? "requires_review" : "complete"
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
    setDocMergeOrQueue(app, `patients_search/${patient.patientId}`, {
      patientId: patient.patientId,
      normalizedPatientName: normalizedPatientName(patient.patientName),
      active: patient.active !== false,
      service: patient.service || patient.currentService || "",
      bed: patient.bed || patient.currentBed || "",
      lastSeenAt: date,
      updatedAt: now
    }, {
      module: "importar-censo",
      entityType: "patient_search",
      entityId: patient.patientId
    })
  ])));

  await setDocMergeOrQueue(app, `daily_snapshots/${date}`, {
    date,
    totalActivePatients: importedRows.length,
    patientsByService: importedRows.reduce((map, row) => {
      const key = row.service || "SIN SERVICIO";
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {}),
    lastUpdatedAt: now
  }, {
    module: "importar-censo",
    entityType: "daily_snapshot",
    entityId: date
  });

  await writeAudit(app, {
    actionType: "census_import",
    module: "importar-censo",
    entityType: "census_day",
    entityId: date,
    after: { ...preview.summary, archived: archived.length, hash }
  });

  return {
    syncStatus: savedPatients.some(row => row.syncStatus === "local_pending") || archived.some(row => row.syncStatus === "local_pending") || summarySaved.syncStatus === "local_pending"
      ? "local_pending"
      : "server_synced",
    savedPatients,
    archived,
    summary: censusSummary
  };
}

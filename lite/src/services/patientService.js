import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { nowIso, todayIso } from "../lib/date.js";
import { normalizedPatientName, normalizeText } from "../lib/normalize.js";
import { cleanText, stripUndefined, validPatient } from "../lib/validators.js";
import { getDocData, listCollectionWhere } from "./firestoreService.js";
import { writeAudit } from "./auditService.js";
import { dischargeDateValue, dischargeReasonForType, dischargeSummary, normalizeDischargeShift, normalizeDischargeType } from "./dischargeService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { completeOpdForSave, opdEligibilityForPatient, opdHasContent, opdStatus } from "./opdService.js";
import { testActivePatients } from "./testDataService.js";

const CACHE_KEY = "patients_active:last";
let activePatientsPromise = null;
const patientFilterTextCache = new WeakMap();
const PATIENT_SEARCH_LIMIT = 25;
const MAX_SEARCH_TOKENS = 80;
const ARCHIVED_OPD_LIMIT = 25;

function makePatientId() {
  if (globalThis.crypto?.randomUUID) return `patient_${globalThis.crypto.randomUUID()}`;
  return `patient_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function byPatientId(rows = []) {
  return rows.reduce((map, row) => {
    const id = row.patientId || row.id;
    if (!id) return map;
    map.set(id, { ...map.get(id), ...row, patientId: id });
    return map;
  }, new Map());
}

async function mergePending(rows = []) {
  const map = byPatientId(rows);
  const pending = await pendingPayloadsForCollection("patients_active");
  pending.forEach(row => map.set(row.patientId || row.id, { ...map.get(row.patientId || row.id), ...row }));
  return [...map.values()];
}

async function pendingPatientById(patientId) {
  const [activePending, archivePending] = await Promise.all([
    pendingPayloadsForCollection("patients_active"),
    pendingPayloadsForCollection("patients_archive")
  ]);
  const active = activePending.find(row => (row.patientId || row.id) === patientId) || null;
  const archive = archivePending.find(row => (row.patientId || row.id) === patientId) || null;
  if (active?.active !== false) return active || archive;
  return archive || active;
}

async function loadActivePatients() {
  if (appConfig().testMode) {
    return (await mergePending(testActivePatients())).filter(row => row.active !== false);
  }
  try {
    const rows = await listCollectionWhere("patients_active", [["active", "==", true]]);
    const active = (await mergePending([...testActivePatients(), ...rows])).filter(row => row.active !== false);
    cacheSet(CACHE_KEY, active).catch(() => undefined);
    return active;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending([...testActivePatients(), ...(cached?.value || [])])).filter(row => row.active !== false);
  }
}

export async function listActivePatients() {
  activePatientsPromise ||= loadActivePatients().finally(() => {
    activePatientsPromise = null;
  });
  return activePatientsPromise;
}

export async function getPatientById(patientId) {
  if (!patientId) return null;
  const pending = await pendingPatientById(patientId);
  if (appConfig().testMode) {
    const testPatient = testActivePatients().find(row => (row.patientId || row.id) === patientId) || null;
    return pending ? { ...(testPatient || {}), ...pending, patientId } : testPatient;
  }
  try {
    const [activePatient, archivedPatient] = await Promise.all([
      getDocData(`patients_active/${patientId}`),
      getDocData(`patients_archive/${patientId}`)
    ]);
    const saved = activePatient && activePatient.active !== false ? activePatient : (archivedPatient || activePatient);
    return pending ? { ...(saved || {}), ...pending, patientId } : saved;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    const cachedPatient = (cached?.value || []).find(row => (row.patientId || row.id) === patientId) || null;
    return pending ? { ...(cachedPatient || {}), ...pending, patientId } : cachedPatient;
  }
}

export function filterPatients(patients, filters = {}) {
  const query = cleanText(filters.query || "").toLowerCase();
  const service = cleanText(filters.service || "");
  const status = cleanText(filters.status || "");
  const sex = cleanText(filters.sex || "");
  const diagnosis = cleanText(filters.diagnosis || "");
  return patients.filter(patient => {
    if (query && !patientFilterText(patient).includes(query)) return false;
    if (service && service !== "Todos" && (patient.service || patient.currentService) !== service) return false;
    if (status && status !== "Todos" && (patient.status || patient.currentState) !== status) return false;
    if (sex && sex !== "Todos" && patient.sex !== sex) return false;
    if (diagnosis && diagnosis !== "Todos" && epidemiologicalDiagnosis(patient) !== diagnosis) return false;
    return true;
  });
}

export function patientFilterText(patient = {}) {
  const signature = [
    patient.patientName,
    patient.bed,
    patient.currentBed,
    patient.service,
    patient.currentService,
    patient.sector,
    patient.epidemiologicalDiagnosis,
    patient.currentEpidemiologicalDiagnosis,
    patient.hospitalDiagnosis,
    patient.currentDiagnosis
  ].join(" ");
  const cached = patientFilterTextCache.get(patient);
  if (cached?.signature === signature) return cached.text;
  const text = signature.toLowerCase();
  patientFilterTextCache.set(patient, { signature, text });
  return text;
}

export function patientSearchIndexData(patient = {}, extra = {}) {
  const service = patient.service || patient.currentService || "";
  const bed = patient.bed || patient.currentBed || "";
  const diagnosis = epidemiologicalDiagnosis(patient);
  const hospitalDiagnosis = patient.hospitalDiagnosis || patient.currentDiagnosis || "";
  const searchText = normalizeText([
    patient.patientId,
    patient.patientName,
    normalizedPatientName(patient.patientName),
    bed,
    service,
    patient.sector,
    patient.status || patient.currentState,
    diagnosis,
    hospitalDiagnosis
  ].filter(Boolean).join(" "));
  return stripUndefined({
    patientId: patient.patientId || patient.id || "",
    patientName: patient.patientName || "",
    normalizedPatientName: normalizedPatientName(patient.patientName),
    active: patient.active !== false,
    service,
    bed,
    sex: patient.sex || "",
    status: patient.status || patient.currentState || "",
    epidemiologicalDiagnosis: diagnosis,
    hospitalDiagnosis,
    admissionDate: patient.admissionDate || patient.currentAdmissionDate || "",
    searchText,
    searchTokens: patientSearchTokens(searchText),
    ...extra
  });
}

export function patientSearchTokens(value = "") {
  const words = normalizeText(value)
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 2);
  const tokens = new Set();
  words.forEach(word => {
    tokens.add(word);
    const max = Math.min(12, word.length);
    for (let length = 2; length <= max; length += 1) tokens.add(word.slice(0, length));
  });
  return [...tokens].slice(0, MAX_SEARCH_TOKENS);
}

export async function searchPatientsIndex(query = "", options = {}) {
  const tokens = patientSearchTokens(query);
  if (!tokens.length) return [];
  const primaryToken = tokens.sort((a, b) => b.length - a.length)[0];
  const limit = Math.min(50, Math.max(1, Number(options.limit) || PATIENT_SEARCH_LIMIT));
  const activeOnly = options.activeOnly === true;
  const pending = await pendingPayloadsForCollection("patients_search");
  if (appConfig().testMode) {
    return limitPatientSearchRows([
      ...testActivePatients().map(patient => patientSearchIndexData(patient)),
      ...pending
    ], tokens, { activeOnly, limit });
  }
  try {
    const rows = await listCollectionWhere("patients_search", [["searchTokens", "array-contains", primaryToken]], { limit });
    return limitPatientSearchRows([...rows, ...pending], tokens, { activeOnly, limit });
  } catch {
    return limitPatientSearchRows(pending, tokens, { activeOnly, limit });
  }
}

export async function listArchivedPatientsWithPendingOpd(options = {}) {
  const limit = Math.min(100, Math.max(1, Number(options.limit) || ARCHIVED_OPD_LIMIT));
  if (appConfig().testMode) {
    return limitArchivedOpdRows(await mergePendingArchivedPatients([]), limit);
  }
  try {
    const rows = await listCollectionWhere("patients_archive", [["opdPending", "==", true]], {
      orderBy: [["archivedAt", "desc"]],
      limit
    });
    return limitArchivedOpdRows(await mergePendingArchivedPatients(rows), limit);
  } catch {
    return limitArchivedOpdRows(await mergePendingArchivedPatients([]), limit);
  }
}

export async function savePatient(app, patient) {
  if (!validPatient(patient)) throw new Error("Paciente sin nombre o servicio.");
  const patientId = patient.patientId || makePatientId();
  const payload = stripUndefined({
    ...patient,
    patientId,
    active: patient.active !== false,
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || "",
    createdAt: patient.createdAt || nowIso(),
    createdBy: patient.createdBy || app.state.auth.user?.uid || ""
  });
  const saved = await setDocMergeOrQueue(app, `patients_active/${patientId}`, payload, {
    module: "censo",
    entityType: "patient",
    entityId: patientId
  });
  await setDocMergeOrQueue(app, `patients_search/${patientId}`, patientSearchIndexData(saved), {
    module: "censo",
    entityType: "patient_search",
    entityId: patientId
  });
  activePatientsPromise = null;
  await writeAudit(app, {
    actionType: patient.patientId ? "patient_update" : "patient_create",
    module: "censo",
    entityType: "patient",
    entityId: patientId,
    patientId,
    after: saved
  });
  const cached = await listActivePatients().catch(() => []);
  cacheSet(CACHE_KEY, [...byPatientId(cached).set(patientId, saved).values()]).catch(() => undefined);
  return saved;
}

export async function archivePatient(app, patient, reason = "") {
  if (!patient?.patientId) throw new Error("Paciente sin identificador.");
  const now = nowIso();
  const dischargeType = normalizeDischargeType(patient.dischargeType || reason || "");
  const dischargeDate = dischargeDateValue(patient.dischargeDate || patient.dischargedAt || patient.dischargeAt, todayIso());
  const dischargeShift = normalizeDischargeShift(patient.dischargeShift || "");
  const dischargeReason = cleanText(reason, 240) || patient.dischargeReason || dischargeReasonForType(dischargeType);
  const archiveOpd = opdForArchivedPatient(patient, { dischargeType, dischargeDate });
  const archiveOpdStatus = opdStatus(archiveOpd, opdEligibilityForPatient(patient));
  const payload = stripUndefined({
    ...patient,
    active: false,
    lastService: patient.service || patient.currentService || patient.lastService || "",
    lastBed: patient.bed || patient.currentBed || patient.lastBed || "",
    hospitalizationStatus: "egresado",
    presentInLatestCensus: false,
    dischargeStatus: "confirmada",
    dischargeReviewRequired: false,
    probableDischarge: false,
    dischargeReported: false,
    dischargeType,
    dischargeDate,
    dischargeShift,
    dischargeReason,
    dischargeSummary: dischargeSummary(dischargeType, dischargeDate, dischargeShift),
    opd: archiveOpd,
    opdPending: archiveOpdStatus.pending,
    opdStatusLabel: archiveOpdStatus.label,
    opdStatusDetail: archiveOpdStatus.detail,
    dischargedAt: now,
    updatedAt: now,
    updatedBy: app.state.auth.user?.uid || ""
  });
  const activeSaved = await setDocMergeOrQueue(app, `patients_active/${patient.patientId}`, payload, {
    module: "censo",
    entityType: "patient",
    entityId: patient.patientId
  });
  activePatientsPromise = null;
  const archiveSaved = await setDocMergeOrQueue(app, `patients_archive/${patient.patientId}`, {
    ...payload,
    archivedAt: payload.dischargedAt,
    archivedBy: app.state.auth.user?.uid || "",
    archiveReason: payload.dischargeReason
  }, {
    module: "censo",
    entityType: "patient_archive",
    entityId: patient.patientId
  });
  await setDocMergeOrQueue(app, `patients_search/${patient.patientId}`, patientSearchIndexData(payload, {
    active: false,
    archivedAt: payload.dischargedAt,
    archiveReason: payload.dischargeReason
  }), {
    module: "censo",
    entityType: "patient_search",
    entityId: patient.patientId
  });
  const saved = {
    ...activeSaved,
    archiveSyncStatus: archiveSaved.syncStatus,
    syncStatus: activeSaved.syncStatus === "server_synced" && archiveSaved.syncStatus === "server_synced" ? "server_synced" : "local_pending"
  };
  await writeAudit(app, {
    actionType: "patient_archive",
    module: "censo",
    entityType: "patient",
    entityId: patient.patientId,
    patientId: patient.patientId,
    before: patient,
    after: saved
  });
  return saved;
}

export async function saveArchivedPatient(app, patient = {}) {
  const patientId = patient.patientId || patient.id || "";
  if (!patientId) throw new Error("Paciente archivado sin identificador.");
  const now = nowIso();
  const opd = completeOpdForSave(patient.opd, patient);
  const status = opdStatus(opd, opdEligibilityForPatient(patient));
  const payload = stripUndefined({
    ...patient,
    patientId,
    active: false,
    lastService: patient.service || patient.currentService || patient.lastService || "",
    lastBed: patient.bed || patient.currentBed || patient.lastBed || "",
    opd,
    opdPending: status.pending,
    opdStatusLabel: status.label,
    opdStatusDetail: status.detail,
    archivedAt: patient.archivedAt || patient.dischargedAt || now,
    archiveReason: patient.archiveReason || patient.dischargeReason || "archivo_actualizado",
    updatedAt: now,
    updatedBy: app.state.auth.user?.uid || ""
  });
  const saved = await setDocMergeOrQueue(app, `patients_archive/${patientId}`, payload, {
    module: "censo",
    entityType: "patient_archive",
    entityId: patientId
  });
  await setDocMergeOrQueue(app, `patients_search/${patientId}`, patientSearchIndexData(payload, {
    active: false,
    archivedAt: payload.archivedAt,
    archiveReason: payload.archiveReason
  }), {
    module: "censo",
    entityType: "patient_search",
    entityId: patientId
  });
  await writeAudit(app, {
    actionType: "patient_archive_update",
    module: "censo",
    entityType: "patient_archive",
    entityId: patientId,
    patientId,
    after: saved
  });
  return saved;
}

function opdForArchivedPatient(patient = {}, discharge = {}) {
  const eligibility = opdEligibilityForPatient(patient);
  if (!eligibility.eligible && !opdHasContent(patient.opd)) return patient.opd;
  return completeOpdForSave(patient.opd, { ...patient, ...discharge });
}

async function mergePendingArchivedPatients(rows = []) {
  const map = byPatientId(rows);
  const pending = await pendingPayloadsForCollection("patients_archive");
  pending
    .filter(row => row.opdPending === true)
    .forEach(row => {
      const id = row.patientId || row.id;
      if (id) map.set(id, { ...map.get(id), ...row, patientId: id });
    });
  return [...map.values()];
}

function limitArchivedOpdRows(rows = [], limit = ARCHIVED_OPD_LIMIT) {
  return rows
    .filter(row => row.active === false && row.opdPending === true)
    .sort((a, b) => String(b.archivedAt || b.dischargedAt || "").localeCompare(String(a.archivedAt || a.dischargedAt || "")))
    .slice(0, limit);
}

function limitPatientSearchRows(rows = [], tokens = [], options = {}) {
  const map = byPatientId(rows);
  return [...map.values()]
    .filter(row => !options.activeOnly || row.active !== false)
    .filter(row => tokens.every(token => patientSearchRowMatches(row, token)))
    .sort((a, b) => String(a.patientName || "").localeCompare(String(b.patientName || ""), "es", { numeric: true }))
    .slice(0, options.limit || PATIENT_SEARCH_LIMIT);
}

function patientSearchRowMatches(row = {}, token = "") {
  const searchText = row.searchText || normalizeText([row.patientName, row.bed, row.service, row.hospitalDiagnosis, row.epidemiologicalDiagnosis].join(" "));
  return String(searchText).includes(token);
}

export async function syncPatientIaasClassification(app, patientId, classification, source = {}) {
  if (!patientId || !classification) return null;
  const patient = await getPatientById(patientId);
  if (!patient) return null;
  const payload = stripUndefined({
    ...patient,
    patientId,
    active: patient.active !== false,
    epidemiologicalDiagnosis: classification,
    currentEpidemiologicalDiagnosis: classification,
    iaasSummary: stripUndefined({
      ...(patient.iaasSummary || {}),
      currentClassification: classification,
      currentIaasId: source.iaasId || patient.iaasSummary?.currentIaasId || "",
      currentIaasType: source.iaasType || patient.iaasSummary?.currentIaasType || "",
      currentIaasStatus: source.status || patient.iaasSummary?.currentIaasStatus || "",
      updatedAt: nowIso()
    }),
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || ""
  });
  const saved = await setDocMergeOrQueue(app, `patients_active/${patientId}`, payload, {
    module: "epi-iaas",
    entityType: "patient",
    entityId: patientId,
    sourceAction: "iaas_classification_sync"
  });
  await setDocMergeOrQueue(app, `patients_search/${patientId}`, patientSearchIndexData(saved), {
    module: "epi-iaas",
    entityType: "patient_search",
    entityId: patientId,
    sourceAction: "iaas_classification_sync"
  });
  activePatientsPromise = null;
  await writeAudit(app, {
    actionType: "patient_iaas_classification_sync",
    module: "epi-iaas",
    entityType: "patient",
    entityId: patientId,
    patientId,
    before: {
      epidemiologicalDiagnosis: patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis || "",
      iaasSummary: patient.iaasSummary || null
    },
    after: {
      epidemiologicalDiagnosis: classification,
      iaasSummary: payload.iaasSummary || null
    }
  });
  const cached = await listActivePatients().catch(() => []);
  cacheSet(CACHE_KEY, [...byPatientId(cached).set(patientId, saved).values()]).catch(() => undefined);
  return saved;
}

export function uniqueValues(rows, field) {
  const valueFor = row => {
    if (field === "service") return row.service || row.currentService;
    if (field === "status") return row.status || row.currentState;
    if (field === "bed") return row.bed || row.currentBed;
    if (field === "diagnosis") return epidemiologicalDiagnosis(row);
    return row[field];
  };
  return ["Todos", ...new Set(rows.map(row => cleanText(valueFor(row))).filter(Boolean).sort((a, b) => a.localeCompare(b, "es")))];
}

export function epidemiologicalDiagnosis(patient = {}) {
  return patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis || "";
}

export function sortPatientsByServiceBed(rows = []) {
  return [...rows].sort((a, b) => {
    const serviceCompare = String(a.service || a.currentService || "").localeCompare(String(b.service || b.currentService || ""), "es", { numeric: true });
    if (serviceCompare) return serviceCompare;
    const bedCompare = String(a.bed || a.currentBed || "").localeCompare(String(b.bed || b.currentBed || ""), "es", { numeric: true });
    if (bedCompare) return bedCompare;
    return String(a.patientName || a.patientId || "").localeCompare(String(b.patientName || b.patientId || ""), "es", { numeric: true });
  });
}

import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { cleanText, stripUndefined, validPatient } from "../lib/validators.js";
import { listCollectionWhere } from "./firestoreService.js";
import { writeAudit } from "./auditService.js";
import { nowIso } from "../lib/date.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { testActivePatients } from "./testDataService.js";

const CACHE_KEY = "patients_active:last";
let activePatientsPromise = null;
const patientFilterTextCache = new WeakMap();

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
  const payload = stripUndefined({
    ...patient,
    active: false,
    dischargeReason: cleanText(reason, 240) || patient.dischargeReason || "egreso_manual",
    dischargedAt: nowIso(),
    updatedAt: nowIso(),
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

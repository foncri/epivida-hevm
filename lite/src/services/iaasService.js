import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { nowIso } from "../lib/date.js";
import { cleanText, stripUndefined, validIaasCase } from "../lib/validators.js";
import { listCollectionWhere, paginateQuery } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";
import { testActiveIaas, testIaasForPatient } from "./testDataService.js";

const CACHE_KEY = "iaas_active:last";
const IAAS_PATIENT_LIMIT = 50;
let activeIaasPromise = null;
const patientIaasPromises = new Map();

function makeIaasId() {
  if (globalThis.crypto?.randomUUID) return `iaas_${globalThis.crypto.randomUUID()}`;
  return `iaas_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function byIaasId(rows = []) {
  return rows.reduce((map, row) => {
    const id = row.iaasId || row.id;
    if (!id) return map;
    map.set(id, { ...map.get(id), ...row, iaasId: id });
    return map;
  }, new Map());
}

async function mergePending(rows = []) {
  const map = byIaasId(rows);
  const pending = await pendingPayloadsForCollection("iaas_active");
  pending.forEach(row => map.set(row.iaasId || row.id, { ...map.get(row.iaasId || row.id), ...row }));
  return [...map.values()];
}

async function mergeArchivePending(patientId, rows = []) {
  const map = byIaasId(rows);
  const pending = await pendingPayloadsForCollection("iaas_archive");
  pending
    .filter(row => row.patientId === patientId)
    .forEach(row => map.set(row.iaasId || row.id, { ...map.get(row.iaasId || row.id), ...row }));
  return [...map.values()];
}

function activeIaas(row = {}) {
  const status = String(row.status || "").toLowerCase();
  return row.active !== false && !["closed", "cerrada", "archived"].includes(status);
}

export function patientClassificationForIaasStatus(status = "") {
  const normalized = cleanText(status).toLowerCase();
  if (["confirmada", "confirmed", "iaas"].includes(normalized)) return "IAAS";
  if (["sospecha", "probable", "riesgo", "riesgo iaas"].includes(normalized)) return "RIESGO IAAS";
  if (["descartada", "closed", "cerrada", "archived", "no iaas"].includes(normalized)) return "NO IAAS";
  return "";
}

function strongestClassification(rows = []) {
  if (rows.some(row => patientClassificationForIaasStatus(row.status) === "IAAS")) return "IAAS";
  if (rows.some(row => patientClassificationForIaasStatus(row.status) === "RIESGO IAAS")) return "RIESGO IAAS";
  return "NO IAAS";
}

async function syncPatientClassificationFromIaas(app, iaas, fallbackClassification = "") {
  const classification = fallbackClassification || patientClassificationForIaasStatus(iaas.status);
  if (!iaas?.patientId || !classification) return null;
  const { syncPatientIaasClassification } = await import("./patientService.js");
  return syncPatientIaasClassification(app, iaas.patientId, classification, iaas);
}

async function loadActiveIaas() {
  if (appConfig().testMode) {
    return (await mergePending(testActiveIaas())).filter(activeIaas);
  }
  try {
    const rows = await listCollectionWhere("iaas_active", [["active", "==", true]]);
    const active = (await mergePending(rows)).filter(activeIaas);
    cacheSet(CACHE_KEY, active).catch(() => undefined);
    return active;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending(cached?.value || [])).filter(activeIaas);
  }
}

export async function listActiveIaas() {
  activeIaasPromise ||= loadActiveIaas().finally(() => {
    activeIaasPromise = null;
  });
  return activeIaasPromise;
}

async function loadIaasForPatient(patientId, limit = IAAS_PATIENT_LIMIT) {
  const pageSize = Math.min(100, Math.max(1, Number(limit) || IAAS_PATIENT_LIMIT));
  if (appConfig().testMode) {
    return (await mergePending(testIaasForPatient(patientId))).filter(row => row.patientId === patientId && activeIaas(row)).slice(0, pageSize);
  }
  try {
    const rows = await listCollectionWhere("iaas_active", [["patientId", "==", patientId], ["active", "==", true]], { limit: pageSize });
    return (await mergePending(rows)).filter(row => row.patientId === patientId && activeIaas(row));
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending(cached?.value || [])).filter(row => row.patientId === patientId && activeIaas(row));
  }
}

function invalidatePatientIaas(patientId) {
  if (!patientId) return;
  for (const key of [...patientIaasPromises.keys()]) {
    if (key.startsWith(`${patientId}:`)) patientIaasPromises.delete(key);
  }
}

export async function listIaasForPatient(patientId, options = {}) {
  if (!patientId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || IAAS_PATIENT_LIMIT));
  const key = `${patientId}:${limit}`;
  if (!patientIaasPromises.has(key)) {
    patientIaasPromises.set(key, loadIaasForPatient(patientId, limit).finally(() => {
      patientIaasPromises.delete(key);
    }));
  }
  return patientIaasPromises.get(key);
}

export async function pageIaasForPatient(patientId, cursorState = {}) {
  if (!patientId) return emptyCursorPage([], cursorState.pageSize || IAAS_PATIENT_LIMIT);
  const pageSize = Math.min(100, Math.max(1, Number(cursorState.pageSize) || IAAS_PATIENT_LIMIT));
  if (appConfig().testMode) {
    return emptyCursorPage(await listIaasForPatient(patientId, { limit: pageSize }), pageSize);
  }
  try {
    const [page, archived] = await Promise.all([
      paginateQuery("iaas_active", [["patientId", "==", patientId], ["active", "==", true]], [], pageSize, cursorState, cursorState.direction || "next"),
      listCollectionWhere("iaas_archive", [["patientId", "==", patientId]], {
        orderBy: [["closedAt", "desc"]],
        limit: pageSize
      }).catch(() => [])
    ]);
    const rows = (await mergePending(page.rows))
      .filter(row => row.patientId === patientId && activeIaas(row))
      .concat(await mergeArchivePending(patientId, archived))
      .sort((a, b) => String(b.closedAt || b.onsetDate || b.updatedAt || "").localeCompare(String(a.closedAt || a.onsetDate || a.updatedAt || "")))
      .slice(0, page.pageSize);
    return { ...page, rows };
  } catch {
    return emptyCursorPage(await listIaasForPatient(patientId, { limit: pageSize }), pageSize);
  }
}

function emptyCursorPage(rows = [], pageSize = IAAS_PATIENT_LIMIT) {
  return {
    rows,
    firstCursor: null,
    lastCursor: null,
    hasNext: false,
    hasPrevious: false,
    pageSize
  };
}

export function normalizeIaasClinicalFollowUp(source = {}, previous = {}) {
  const previousFollowUp = previous.followUp || {};
  const previousVitals = previous.vitalSigns || {};
  const previousLabs = previous.labs || {};
  const otherStudiesText = source.otherStudies ?? previousLabs.otherStudies ?? "";
  const customStudies = source.customStudies ?? (String(otherStudiesText || "").trim()
    ? customStudiesFromText(otherStudiesText)
    : previousLabs.customStudies);
  return stripUndefined({
    criteria: cleanText(source.criteria ?? previous.criteria ?? "", 1200),
    criteriaVersion: cleanText(source.criteriaVersion ?? previous.criteriaVersion ?? "", 80),
    deviceEpisodeId: cleanText(source.deviceEpisodeId ?? previous.deviceEpisodeId ?? "", 160),
    vitalSigns: stripUndefined({
      temperature: cleanText(source.vitalTemperature ?? previousVitals.temperature ?? "", 40),
      heartRate: cleanText(source.vitalHeartRate ?? previousVitals.heartRate ?? "", 40),
      respiratoryRate: cleanText(source.vitalRespiratoryRate ?? previousVitals.respiratoryRate ?? "", 40),
      bloodPressure: cleanText(source.vitalBloodPressure ?? previousVitals.bloodPressure ?? "", 80),
      spo2: cleanText(source.vitalSpo2 ?? previousVitals.spo2 ?? "", 40),
      fio2: cleanText(source.vitalFio2 ?? previousVitals.fio2 ?? "", 40),
      peep: cleanText(source.vitalPeep ?? previousVitals.peep ?? "", 40)
    }),
    labs: stripUndefined({
      biometry: cleanText(source.biometry ?? previousLabs.biometry ?? "", 500),
      ego: cleanText(source.ego ?? previousLabs.ego ?? "", 500),
      otherStudies: cleanText(otherStudiesText, 700),
      customStudies: normalizeIaasCustomStudies(customStudies, previousLabs.customStudies)
    }),
    followUp: stripUndefined({
      reviewDate: cleanText(source.followUpDate ?? previousFollowUp.reviewDate ?? "", 40),
      evolution: cleanText(source.clinicalEvolution ?? previousFollowUp.evolution ?? "", 1000),
      carePlan: cleanText(source.carePlan ?? previousFollowUp.carePlan ?? "", 1000)
    })
  });
}

export function normalizeIaasCustomStudies(value = [], fallback = []) {
  const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
  return source
    .map(row => ({
      name: cleanText(row.name || row.study || row.test || "", 120),
      value: cleanText(row.value || row.result || "", 240)
    }))
    .filter(row => row.name || row.value)
    .slice(0, 20);
}

export function summarizeIaasCustomStudies(rows = []) {
  return normalizeIaasCustomStudies(rows)
    .map(row => `${row.name || "Otro estudio"}${row.value ? `: ${row.value}` : ""}`)
    .join(" / ");
}

function customStudiesFromText(value = "") {
  return String(value || "")
    .split(/\r?\n|;/)
    .map(item => {
      const [name, ...rest] = item.split(":");
      const result = rest.join(":");
      return rest.length ? { name, value: result } : { name: item, value: "" };
    })
    .filter(row => cleanText(row.name || row.value));
}

export async function saveIaasCase(app, iaas) {
  if (!validIaasCase(iaas)) throw new Error("IAAS sin paciente, tipo o estado.");
  const iaasId = iaas.iaasId || makeIaasId();
  const payload = stripUndefined({
    ...iaas,
    iaasId,
    active: iaas.active !== false,
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || "",
    createdAt: iaas.createdAt || nowIso(),
    createdBy: iaas.createdBy || app.state.auth.user?.uid || "",
    source: iaas.source || "lite_iaas_module"
  });
  const saved = await setDocMergeOrQueue(app, `iaas_active/${iaasId}`, payload, {
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaasId
  });
  activeIaasPromise = null;
  invalidatePatientIaas(payload.patientId);
  await writeAudit(app, {
    actionType: iaas.iaasId ? "iaas_update" : "iaas_create",
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaasId,
    patientId: iaas.patientId,
    after: saved
  });
  const patientSync = await syncPatientClassificationFromIaas(app, saved).catch(error => ({
    syncStatus: "error",
    error: error?.message || "No se pudo sincronizar clasificacion del paciente."
  }));
  return { ...saved, patientClassificationSyncStatus: patientSync?.syncStatus || "", patientClassification: patientSync?.epidemiologicalDiagnosis || "" };
}

export async function closeIaasCase(app, iaas, closedReason = "") {
  if (!iaas?.iaasId) throw new Error("IAAS sin identificador.");
  const timestamp = nowIso();
  const payload = stripUndefined({
    ...iaas,
    status: "closed",
    closedReason,
    closedAt: timestamp,
    active: false,
    updatedAt: timestamp,
    updatedBy: app.state.auth.user?.uid || ""
  });
  const archivePayload = stripUndefined({
    ...payload,
    archivedAt: timestamp,
    archivedBy: app.state.auth.user?.uid || "",
    archiveReason: closedReason || "iaas_closed"
  });
  const [savedActive, savedArchive] = await Promise.all([
    setDocMergeOrQueue(app, `iaas_active/${iaas.iaasId}`, payload, {
      module: "epi-iaas",
      entityType: "iaas_case",
      entityId: iaas.iaasId
    }),
    setDocMergeOrQueue(app, `iaas_archive/${iaas.iaasId}`, archivePayload, {
      module: "epi-iaas",
      entityType: "iaas_case",
      entityId: iaas.iaasId
    })
  ]);
  const saved = {
    ...savedActive,
    archiveSyncStatus: savedArchive.syncStatus || savedActive.syncStatus,
    syncStatus: [savedActive.syncStatus, savedArchive.syncStatus].includes("local_pending")
      ? "local_pending"
      : savedActive.syncStatus
  };
  activeIaasPromise = null;
  invalidatePatientIaas(payload.patientId);
  await writeAudit(app, {
    actionType: "iaas_close",
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaas.iaasId,
    patientId: iaas.patientId,
    before: iaas,
    after: saved
  });
  const remainingRows = (await listIaasForPatient(payload.patientId, { limit: IAAS_PATIENT_LIMIT }).catch(() => []))
    .filter(row => (row.iaasId || row.id) !== payload.iaasId)
    .filter(activeIaas);
  const patientSync = await syncPatientClassificationFromIaas(app, saved, strongestClassification(remainingRows)).catch(error => ({
    syncStatus: "error",
    error: error?.message || "No se pudo sincronizar clasificacion del paciente."
  }));
  return { ...saved, patientClassificationSyncStatus: patientSync?.syncStatus || "", patientClassification: patientSync?.epidemiologicalDiagnosis || "" };
}

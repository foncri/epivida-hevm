import { nowIso } from "../lib/date.js";
import { appConfig } from "../lib/config.js";
import { cleanText, stripUndefined } from "../lib/validators.js";
import { listCollectionWhere, paginateQuery } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";
import { testCultures, testCulturesForIaas, testCulturesForPatient } from "./testDataService.js";

const CULTURE_PAGE_SIZE = 50;

function makeCultureId() {
  if (globalThis.crypto?.randomUUID) return `culture_${globalThis.crypto.randomUUID()}`;
  return `culture_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function byCultureId(rows = []) {
  return rows.reduce((map, row) => {
    const id = row.cultureId || row.id;
    if (!id) return map;
    map.set(id, { ...map.get(id), ...row, cultureId: id });
    return map;
  }, new Map());
}

async function mergePending(collectionRows = [], filter = () => true) {
  const map = byCultureId(collectionRows);
  const pending = await pendingPayloadsForCollection("cultures");
  pending.filter(filter).forEach(row => {
    const id = row.cultureId || row.id;
    map.set(id, { ...map.get(id), ...row, cultureId: id });
  });
  return [...map.values()].sort((a, b) => String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")));
}

export async function listCulturesForPatient(patientId, options = {}) {
  if (!patientId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || CULTURE_PAGE_SIZE));
  if (appConfig().testMode) {
    return mergePending(testCulturesForPatient(patientId).slice(0, limit), row => row.patientId === patientId);
  }
  try {
    const rows = await listCollectionWhere("cultures", [["patientId", "==", patientId]], {
      orderBy: [["requestedAt", "desc"]],
      limit
    });
    return mergePending(rows, row => row.patientId === patientId);
  } catch {
    return mergePending([], row => row.patientId === patientId);
  }
}

export async function pageCulturesForPatient(patientId, cursorState = {}) {
  if (!patientId) return emptyCursorPage([], cursorState.pageSize || CULTURE_PAGE_SIZE);
  const pageSize = Math.min(100, Math.max(1, Number(cursorState.pageSize) || CULTURE_PAGE_SIZE));
  if (appConfig().testMode) {
    return emptyCursorPage(await listCulturesForPatient(patientId, { limit: pageSize }), pageSize);
  }
  try {
    const page = await paginateQuery("cultures", [["patientId", "==", patientId]], [["requestedAt", "desc"]], pageSize, cursorState, cursorState.direction || "next");
    const rows = (await mergePending(page.rows, row => row.patientId === patientId))
      .filter(row => row.patientId === patientId)
      .slice(0, page.pageSize);
    return { ...page, rows };
  } catch {
    return emptyCursorPage(await listCulturesForPatient(patientId, { limit: pageSize }), pageSize);
  }
}

export async function listCulturesForIaas(iaasId, options = {}) {
  if (!iaasId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || CULTURE_PAGE_SIZE));
  if (appConfig().testMode) {
    return mergePending(testCulturesForIaas(iaasId).slice(0, limit), row => row.iaasId === iaasId);
  }
  try {
    const rows = await listCollectionWhere("cultures", [["iaasId", "==", iaasId]], {
      orderBy: [["requestedAt", "desc"]],
      limit
    });
    return mergePending(rows, row => row.iaasId === iaasId);
  } catch {
    return mergePending([], row => row.iaasId === iaasId);
  }
}

export async function listCulturesByStatus(status = "", options = {}) {
  const normalizedStatus = String(status || "").toLowerCase();
  const limit = Math.min(100, Math.max(1, Number(options.limit) || CULTURE_PAGE_SIZE));
  const matchesStatus = row => String(row.status || "").toLowerCase() === normalizedStatus;
  if (!normalizedStatus) return [];
  if (appConfig().testMode) {
    return mergePending(testCultures().filter(matchesStatus).slice(0, limit), matchesStatus);
  }
  try {
    const rows = await listCollectionWhere("cultures", [["status", "==", normalizedStatus]], {
      orderBy: [["requestedAt", "desc"]],
      limit
    });
    return mergePending(rows, matchesStatus);
  } catch {
    return mergePending([], matchesStatus);
  }
}

function emptyCursorPage(rows = [], pageSize = CULTURE_PAGE_SIZE) {
  return {
    rows,
    firstCursor: null,
    lastCursor: null,
    hasNext: false,
    hasPrevious: false,
    pageSize
  };
}

export async function saveCulture(app, culture = {}) {
  if (!culture.patientId || !culture.sampleType || !culture.requestedAt) {
    throw new Error("Cultivo sin paciente, muestra o fecha de solicitud.");
  }
  const cultureId = culture.cultureId || makeCultureId();
  const payload = stripUndefined({
    ...culture,
    cultureId,
    sampleType: cleanText(culture.sampleType, 120),
    organism: cleanText(culture.organism || "", 160),
    susceptibility: cleanText(culture.susceptibility || "", 500),
    status: culture.status || "solicitado",
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || "",
    createdAt: culture.createdAt || nowIso(),
    createdBy: culture.createdBy || app.state.auth.user?.uid || "",
    source: culture.source || "lite_culture_service"
  });
  const saved = await setDocMergeOrQueue(app, `cultures/${cultureId}`, payload, {
    module: "epi-iaas",
    entityType: "culture",
    entityId: cultureId
  });
  await writeAudit(app, {
    actionType: culture.cultureId ? "culture_update" : "culture_create",
    module: "epi-iaas",
    entityType: "culture",
    entityId: cultureId,
    patientId: culture.patientId,
    after: saved
  });
  return saved;
}

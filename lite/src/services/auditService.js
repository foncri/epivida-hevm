import { nowIso } from "../lib/date.js";
import { appConfig } from "../lib/config.js";
import { listCollectionWhere, paginateQuery } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { testAuditForPatient, testAuditLogs } from "./testDataService.js";

const AUDIT_PATIENT_LIMIT = 50;
const AUDIT_RECENT_LIMIT = 50;

function auditId(payload = {}) {
  const base = [
    payload.actionType || "audit",
    payload.module || "epivida",
    payload.entityId || payload.patientId || "",
    Date.now().toString(36),
    Math.random().toString(16).slice(2, 8)
  ].filter(Boolean).join("_");
  return base.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function writeAudit(app, payload) {
  const user = app?.state?.auth?.user;
  const profile = app?.state?.auth?.profile;
  const id = auditId(payload);
  return setDocMergeOrQueue(app, `audit_logs/${id}`, {
    auditId: id,
    createdAt: nowIso(),
    userId: user?.uid || "",
    userEmail: user?.email || "",
    role: profile?.role || "",
    ...payload
  }, { module: "audit", entityType: "audit_log", entityId: id });
}

async function mergePendingAuditForPatient(patientId, rows = []) {
  const map = rows.reduce((acc, row) => {
    const id = row.auditId || row.id;
    if (!id) return acc;
    acc.set(id, { ...row, auditId: id });
    return acc;
  }, new Map());
  const pending = await pendingPayloadsForCollection("audit_logs");
  pending
    .filter(row => row.patientId === patientId)
    .forEach(row => {
      const id = row.auditId || row.id;
      if (id) map.set(id, { ...map.get(id), ...row, auditId: id });
    });
  return [...map.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function auditMap(rows = []) {
  return rows.reduce((acc, row) => {
    const id = row.auditId || row.id;
    if (!id) return acc;
    acc.set(id, { ...row, auditId: id });
    return acc;
  }, new Map());
}

function matchesAuditFilters(row = {}, filters = {}) {
  if (filters.userId && row.userId !== filters.userId) return false;
  if (filters.module && row.module !== filters.module) return false;
  return true;
}

async function mergePendingAuditRows(rows = [], filters = {}) {
  const map = auditMap(rows);
  const pending = await pendingPayloadsForCollection("audit_logs");
  pending
    .filter(row => matchesAuditFilters(row, filters))
    .forEach(row => {
      const id = row.auditId || row.id;
      if (id) map.set(id, { ...map.get(id), ...row, auditId: id });
    });
  return [...map.values()]
    .filter(row => matchesAuditFilters(row, filters))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function listAuditForPatient(patientId, options = {}) {
  if (!patientId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || AUDIT_PATIENT_LIMIT));
  if (appConfig().testMode) {
    return mergePendingAuditForPatient(patientId, testAuditForPatient(patientId).slice(0, limit));
  }
  try {
    const rows = await listCollectionWhere("audit_logs", [["patientId", "==", patientId]], {
      orderBy: [["createdAt", "desc"]],
      limit
    });
    return mergePendingAuditForPatient(patientId, rows);
  } catch {
    return mergePendingAuditForPatient(patientId, []);
  }
}

export async function listRecentAuditLogs(options = {}) {
  const limit = Math.min(100, Math.max(1, Number(options.limit) || AUDIT_RECENT_LIMIT));
  const filters = {
    module: options.module || "",
    userId: options.userId || ""
  };
  if (!filters.module && !filters.userId) return [];
  if (appConfig().testMode) {
    return (await mergePendingAuditRows(testAuditLogs(), filters)).slice(0, limit);
  }
  try {
    const clauses = filters.userId
      ? [["userId", "==", filters.userId]]
      : [["module", "==", filters.module]];
    const rows = await listCollectionWhere("audit_logs", clauses, {
      orderBy: [["createdAt", "desc"]],
      limit
    });
    return (await mergePendingAuditRows(rows, filters)).slice(0, limit);
  } catch {
    return (await mergePendingAuditRows([], filters)).slice(0, limit);
  }
}

export async function pageAuditForPatient(patientId, cursorState = {}) {
  if (!patientId) return emptyCursorPage([], cursorState.pageSize || AUDIT_PATIENT_LIMIT);
  const pageSize = Math.min(100, Math.max(1, Number(cursorState.pageSize) || AUDIT_PATIENT_LIMIT));
  if (appConfig().testMode) {
    return emptyCursorPage(await listAuditForPatient(patientId, { limit: pageSize }), pageSize);
  }
  try {
    const page = await paginateQuery("audit_logs", [["patientId", "==", patientId]], [["createdAt", "desc"]], pageSize, cursorState, cursorState.direction || "next");
    const rows = (await mergePendingAuditForPatient(patientId, page.rows))
      .filter(row => row.patientId === patientId)
      .slice(0, page.pageSize);
    return { ...page, rows };
  } catch {
    return emptyCursorPage(await listAuditForPatient(patientId, { limit: pageSize }), pageSize);
  }
}

function emptyCursorPage(rows = [], pageSize = AUDIT_PATIENT_LIMIT) {
  return {
    rows,
    firstCursor: null,
    lastCursor: null,
    hasNext: false,
    hasPrevious: false,
    pageSize
  };
}

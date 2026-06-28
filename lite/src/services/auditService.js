import { nowIso } from "../lib/date.js";
import { appConfig } from "../lib/config.js";
import { listCollectionWhere, paginateQuery } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { testAuditForEntity, testAuditForPatient, testAuditLogs } from "./testDataService.js";

const AUDIT_PATIENT_LIMIT = 50;
const AUDIT_RECENT_LIMIT = 50;
const AUDIT_ENTITY_LIMIT = 30;
export const AUDIT_COVERAGE_VERSION = "lite-audit-coverage-2026-06-27-v1";

export const AUDIT_ACTION_CATALOG = Object.freeze({
  "patient_create": { auditDomain: "pacientes", auditOperation: "create", auditSeverity: "medium", auditClinical: true },
  "patient_update": { auditDomain: "pacientes", auditOperation: "update", auditSeverity: "medium", auditClinical: true },
  "patient_archive": { auditDomain: "pacientes", auditOperation: "archive", auditSeverity: "high", auditClinical: true },
  "patient_archive_update": { auditDomain: "pacientes", auditOperation: "archive_update", auditSeverity: "medium", auditClinical: true },
  "patient_iaas_classification_sync": { auditDomain: "pacientes", auditOperation: "sync", auditSeverity: "high", auditClinical: true },
  "patient_reconciliation_required": { auditDomain: "censo", auditOperation: "review_required", auditSeverity: "high", auditClinical: true },
  "patient_probable_discharge": { auditDomain: "censo", auditOperation: "probable_discharge", auditSeverity: "high", auditClinical: true },
  "census_import": { auditDomain: "censo", auditOperation: "import", auditSeverity: "medium", auditClinical: true },
  "device_create": { auditDomain: "dispositivos", auditOperation: "create", auditSeverity: "medium", auditClinical: true },
  "device_update": { auditDomain: "dispositivos", auditOperation: "update", auditSeverity: "medium", auditClinical: true },
  "device_reinstallation_create": { auditDomain: "dispositivos", auditOperation: "reinstall", auditSeverity: "high", auditClinical: true },
  "device_archive_create": { auditDomain: "dispositivos", auditOperation: "archive", auditSeverity: "medium", auditClinical: true },
  "device_archive_update": { auditDomain: "dispositivos", auditOperation: "archive_update", auditSeverity: "medium", auditClinical: true },
  "device_remove": { auditDomain: "dispositivos", auditOperation: "remove", auditSeverity: "high", auditClinical: true },
  "iaas_create": { auditDomain: "iaas", auditOperation: "create", auditSeverity: "high", auditClinical: true },
  "iaas_update": { auditDomain: "iaas", auditOperation: "update", auditSeverity: "high", auditClinical: true },
  "iaas_close": { auditDomain: "iaas", auditOperation: "close", auditSeverity: "high", auditClinical: true },
  "round_review": { auditDomain: "ronda", auditOperation: "review", auditSeverity: "medium", auditClinical: true },
  "round_session_update": { auditDomain: "ronda", auditOperation: "session_update", auditSeverity: "normal", auditClinical: true },
  "culture_create": { auditDomain: "microbiologia", auditOperation: "create", auditSeverity: "medium", auditClinical: true },
  "culture_update": { auditDomain: "microbiologia", auditOperation: "update", auditSeverity: "medium", auditClinical: true },
  "antimicrobial_create": { auditDomain: "antimicrobianos", auditOperation: "create", auditSeverity: "medium", auditClinical: true },
  "antimicrobial_update": { auditDomain: "antimicrobianos", auditOperation: "update", auditSeverity: "medium", auditClinical: true },
  "catalog_create": { auditDomain: "catalogos", auditOperation: "create", auditSeverity: "normal", auditClinical: false },
  "catalog_update": { auditDomain: "catalogos", auditOperation: "update", auditSeverity: "normal", auditClinical: false },
  "catalog_import": { auditDomain: "catalogos", auditOperation: "import", auditSeverity: "medium", auditClinical: false },
  "user_profile_create": { auditDomain: "usuarios", auditOperation: "create", auditSeverity: "high", auditClinical: false },
  "user_profile_update": { auditDomain: "usuarios", auditOperation: "update", auditSeverity: "high", auditClinical: false },
  "backup_restore": { auditDomain: "respaldo", auditOperation: "restore", auditSeverity: "high", auditClinical: false },
  "export_csv": { auditDomain: "reportes", auditOperation: "export_csv", auditSeverity: "normal", auditClinical: false },
  "export_json": { auditDomain: "reportes", auditOperation: "export_json", auditSeverity: "normal", auditClinical: false },
  "export_excel": { auditDomain: "reportes", auditOperation: "export_excel", auditSeverity: "normal", auditClinical: false }
});

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

function inferredAuditDomain(payload = {}) {
  const moduleName = String(payload.module || "").toLowerCase();
  const entityType = String(payload.entityType || "").toLowerCase();
  const actionType = String(payload.actionType || "").toLowerCase();
  if (moduleName.includes("iaas") || entityType.includes("iaas") || actionType.includes("iaas")) return "iaas";
  if (moduleName.includes("dispositivo") || entityType.includes("device") || actionType.includes("device")) return "dispositivos";
  if (moduleName.includes("ronda") || entityType.includes("round") || actionType.includes("round")) return "ronda";
  if (entityType.includes("culture") || actionType.includes("culture")) return "microbiologia";
  if (entityType.includes("antimicrobial") || actionType.includes("antimicrobial")) return "antimicrobianos";
  if (entityType.includes("patient") || actionType.includes("patient")) return "pacientes";
  if (entityType.includes("catalog") || actionType.includes("catalog")) return "catalogos";
  if (entityType.includes("export") || actionType.includes("export")) return "reportes";
  return moduleName || entityType || "epivida";
}

function inferredAuditOperation(actionType = "") {
  const normalized = String(actionType || "").toLowerCase();
  if (normalized.includes("create")) return "create";
  if (normalized.includes("update")) return "update";
  if (normalized.includes("archive")) return "archive";
  if (normalized.includes("remove")) return "remove";
  if (normalized.includes("close")) return "close";
  if (normalized.includes("import")) return "import";
  if (normalized.includes("export")) return "export";
  if (normalized.includes("sync")) return "sync";
  return normalized || "event";
}

function inferredAuditClinical(payload = {}) {
  const domain = inferredAuditDomain(payload);
  return ["pacientes", "censo", "dispositivos", "iaas", "ronda", "microbiologia", "antimicrobianos"].includes(domain);
}

export function auditEventMeta(payload = {}) {
  const actionType = String(payload.actionType || "");
  const catalog = AUDIT_ACTION_CATALOG[actionType] || {};
  return {
    auditCoverageVersion: AUDIT_COVERAGE_VERSION,
    auditDomain: catalog.auditDomain || inferredAuditDomain(payload),
    auditOperation: catalog.auditOperation || inferredAuditOperation(actionType),
    auditSeverity: catalog.auditSeverity || "normal",
    auditClinical: catalog.auditClinical ?? inferredAuditClinical(payload)
  };
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
    ...payload,
    ...auditEventMeta(payload)
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

async function mergePendingAuditForEntity(entityId, rows = []) {
  const map = auditMap(rows);
  const pending = await pendingPayloadsForCollection("audit_logs");
  pending
    .filter(row => row.entityId === entityId)
    .forEach(row => {
      const id = row.auditId || row.id;
      if (id) map.set(id, { ...map.get(id), ...row, auditId: id });
    });
  return [...map.values()]
    .filter(row => row.entityId === entityId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
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

export async function listAuditForEntity(entityId, options = {}) {
  if (!entityId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || AUDIT_ENTITY_LIMIT));
  if (appConfig().testMode) {
    return (await mergePendingAuditForEntity(entityId, testAuditForEntity(entityId).slice(0, limit))).slice(0, limit);
  }
  try {
    const rows = await listCollectionWhere("audit_logs", [["entityId", "==", entityId]], {
      orderBy: [["createdAt", "desc"]],
      limit
    });
    return (await mergePendingAuditForEntity(entityId, rows)).slice(0, limit);
  } catch {
    return (await mergePendingAuditForEntity(entityId, [])).slice(0, limit);
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

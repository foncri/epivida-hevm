import { nowIso } from "../lib/date.js";
import { listCollectionWhere } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";

const AUDIT_PATIENT_LIMIT = 50;

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

export async function listAuditForPatient(patientId, options = {}) {
  if (!patientId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || AUDIT_PATIENT_LIMIT));
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

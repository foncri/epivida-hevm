import { nowIso } from "../lib/date.js";
import { setDocMergeOrQueue } from "./offlineQueueService.js";

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

const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

globalThis.window = {};
globalThis.indexedDB = undefined;

const { nextQueueWithWrite, syncQueueSummary } = await import("../src/services/offlineQueueService.js");

const clinicalQueue = nextQueueWithWrite([
  {
    id: "old_patient",
    kind: "setDocMerge",
    collection: "patients_active",
    path: "patients_active/p_1",
    data: { patientId: "p_1", patientName: "Anterior" },
    status: "local_pending"
  }
], {
  id: "new_patient",
  kind: "setDocMerge",
  collection: "patients_active",
  path: "patients_active/p_1",
  data: { patientId: "p_1", patientName: "Actualizado" },
  status: "local_pending"
});

requireValue(clinicalQueue.length === 1, "Documentos clinicos pendientes deben deduplicarse por path.");
requireValue(clinicalQueue[0].id === "new_patient", "La escritura clinica mas reciente debe reemplazar la anterior.");

const auditQueue = nextQueueWithWrite([
  {
    id: "audit_1",
    kind: "setDocMerge",
    collection: "audit_logs",
    path: "audit_logs/audit_same_path",
    data: { actionType: "round_review", createdAt: "2026-06-05T01:00:00Z" },
    status: "local_pending"
  }
], {
  id: "audit_2",
  kind: "setDocMerge",
  collection: "audit_logs",
  path: "audit_logs/audit_same_path",
  data: { actionType: "device_update", createdAt: "2026-06-05T01:01:00Z" },
  status: "local_pending"
});

requireValue(auditQueue.length === 2, "Auditorias offline no deben colapsarse por path.");
requireValue(auditQueue.some(item => item.id === "audit_1") && auditQueue.some(item => item.id === "audit_2"), "Ambas auditorias deben conservarse.");

const blockedSummary = syncQueueSummary([
  { status: "local_pending" },
  { status: "sync_blocked" },
  { status: "server_synced" }
]);
requireValue(blockedSummary.pending === 1, "syncQueueSummary debe contar local_pending.");
requireValue(blockedSummary.blocked === 1, "syncQueueSummary debe contar sync_blocked.");
requireValue(blockedSummary.other === 1, "syncQueueSummary debe contar otros estados.");

if (failures.length) {
  console.error(`EPIVIDA Lite offline queue validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite offline queue validation OK");

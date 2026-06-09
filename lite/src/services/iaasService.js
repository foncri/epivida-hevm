import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { nowIso } from "../lib/date.js";
import { stripUndefined, validIaasCase } from "../lib/validators.js";
import { listCollectionWhere } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";

const CACHE_KEY = "iaas_active:last";
let activeIaasPromise = null;

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

function activeIaas(row = {}) {
  const status = String(row.status || "").toLowerCase();
  return row.active !== false && !["closed", "cerrada", "archived"].includes(status);
}

async function loadActiveIaas() {
  if (appConfig().testMode) {
    return (await mergePending([])).filter(activeIaas);
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
  await writeAudit(app, {
    actionType: iaas.iaasId ? "iaas_update" : "iaas_create",
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaasId,
    patientId: iaas.patientId,
    after: saved
  });
  return saved;
}

export async function closeIaasCase(app, iaas, closedReason = "") {
  if (!iaas?.iaasId) throw new Error("IAAS sin identificador.");
  const payload = stripUndefined({
    ...iaas,
    status: "closed",
    closedReason,
    closedAt: nowIso(),
    active: false,
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || ""
  });
  const saved = await setDocMergeOrQueue(app, `iaas_active/${iaas.iaasId}`, payload, {
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaas.iaasId
  });
  activeIaasPromise = null;
  await writeAudit(app, {
    actionType: "iaas_close",
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaas.iaasId,
    patientId: iaas.patientId,
    before: iaas,
    after: saved
  });
  return saved;
}

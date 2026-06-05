import { cacheGet, cacheSet } from "../lib/cache.js";
import { nowIso } from "../lib/date.js";
import { cleanText, stripUndefined, validDevice } from "../lib/validators.js";
import { listCollectionWhere } from "./firestoreService.js";
import { setDocMergeOrQueue, pendingPayloadsForCollection } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";

const CACHE_KEY = "devices_active:last";

function makeEpisodeId() {
  if (globalThis.crypto?.randomUUID) return `device_${globalThis.crypto.randomUUID()}`;
  return `device_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function byEpisodeId(rows = []) {
  return rows.reduce((map, row) => {
    const id = row.episodeId || row.id;
    if (!id) return map;
    map.set(id, { ...map.get(id), ...row, episodeId: id });
    return map;
  }, new Map());
}

async function mergePending(rows = []) {
  const map = byEpisodeId(rows);
  const pending = await pendingPayloadsForCollection("devices_active");
  pending.forEach(row => map.set(row.episodeId || row.id, { ...map.get(row.episodeId || row.id), ...row }));
  return [...map.values()];
}

function activeDevice(row = {}) {
  return row.active !== false && !row.removalDate && row.status !== "retirado";
}

export async function listActiveDevices() {
  try {
    const rows = await listCollectionWhere("devices_active", [["active", "==", true]]);
    const active = (await mergePending(rows)).filter(activeDevice);
    cacheSet(CACHE_KEY, active).catch(() => undefined);
    return active;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending(cached?.value || [])).filter(activeDevice);
  }
}

export async function listDevicesForPatient(patientId) {
  if (!patientId) return [];
  try {
    const rows = await listCollectionWhere("devices_active", [["patientId", "==", patientId]]);
    return (await mergePending(rows)).filter(row => row.patientId === patientId);
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending(cached?.value || [])).filter(row => row.patientId === patientId);
  }
}

export function devicesByPatient(devices = []) {
  return devices.reduce((map, device) => {
    const key = device.patientId || "";
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(device);
    return map;
  }, new Map());
}

export async function saveDeviceEpisode(app, device) {
  if (!validDevice(device)) throw new Error("Dispositivo sin paciente, tipo o fecha de instalacion.");
  const episodeId = device.episodeId || makeEpisodeId();
  const payload = stripUndefined({
    ...device,
    episodeId,
    active: device.active !== false,
    status: device.removalDate ? "retirado" : (device.status || "activo"),
    careStatus: cleanText(device.careStatus || "no_valorado"),
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || "",
    createdAt: device.createdAt || nowIso(),
    createdBy: device.createdBy || app.state.auth.user?.uid || "",
    source: device.source || "lite_device_module"
  });
  const saved = await setDocMergeOrQueue(app, `devices_active/${episodeId}`, payload, {
    module: "dispositivos",
    entityType: "device",
    entityId: episodeId
  });
  await writeAudit(app, {
    actionType: device.episodeId ? "device_update" : "device_create",
    module: "dispositivos",
    entityType: "device",
    entityId: episodeId,
    patientId: device.patientId,
    after: saved
  });
  return saved;
}

export async function removeDeviceEpisode(app, device, removalDate) {
  if (!device?.episodeId) throw new Error("Dispositivo sin identificador.");
  const payload = stripUndefined({
    ...device,
    removalDate,
    active: false,
    status: "retirado",
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || ""
  });
  const saved = await setDocMergeOrQueue(app, `devices_active/${device.episodeId}`, payload, {
    module: "dispositivos",
    entityType: "device",
    entityId: device.episodeId
  });
  await writeAudit(app, {
    actionType: "device_remove",
    module: "dispositivos",
    entityType: "device",
    entityId: device.episodeId,
    patientId: device.patientId,
    before: device,
    after: saved
  });
  return saved;
}

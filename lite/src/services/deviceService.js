import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { nowIso } from "../lib/date.js";
import { cleanText, stripUndefined, validDevice } from "../lib/validators.js";
import { listCollectionWhere, paginateQuery } from "./firestoreService.js";
import { setDocMergeOrQueue, pendingPayloadsForCollection } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";
import { testActiveDevices, testArchivedDevicesForPatient } from "./testDataService.js";

const CACHE_KEY = "devices_active:last";
const ARCHIVE_PAGE_SIZE = 50;
let activeDevicesPromise = null;
const devicePatientPromises = new Map();

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

export function activeDevice(row = {}) {
  return row.active !== false && !row.removalDate && row.status !== "retirado";
}

async function mergeArchivePending(patientId, rows = []) {
  const map = byEpisodeId(rows);
  const pending = await pendingPayloadsForCollection("devices_archive");
  pending
    .filter(row => row.patientId === patientId)
    .forEach(row => map.set(row.episodeId || row.id, { ...map.get(row.episodeId || row.id), ...row }));
  return [...map.values()];
}

async function loadActiveDevices() {
  if (appConfig().testMode) {
    return (await mergePending(testActiveDevices())).filter(activeDevice);
  }
  try {
    const rows = await listCollectionWhere("devices_active", [["active", "==", true]]);
    const active = (await mergePending([...testActiveDevices(), ...rows])).filter(activeDevice);
    cacheSet(CACHE_KEY, active).catch(() => undefined);
    return active;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending([...testActiveDevices(), ...(cached?.value || [])])).filter(activeDevice);
  }
}

export async function listActiveDevices() {
  activeDevicesPromise ||= loadActiveDevices().finally(() => {
    activeDevicesPromise = null;
  });
  return activeDevicesPromise;
}

async function loadDevicesForPatient(patientId) {
  if (appConfig().testMode) {
    return (await mergePending(testActiveDevices())).filter(row => row.patientId === patientId);
  }
  try {
    const rows = await listCollectionWhere("devices_active", [["patientId", "==", patientId]]);
    return (await mergePending([...testActiveDevices(), ...rows])).filter(row => row.patientId === patientId);
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending([...testActiveDevices(), ...(cached?.value || [])])).filter(row => row.patientId === patientId);
  }
}

export async function listDevicesForPatient(patientId) {
  if (!patientId) return [];
  if (!devicePatientPromises.has(patientId)) {
    devicePatientPromises.set(patientId, loadDevicesForPatient(patientId).finally(() => {
      devicePatientPromises.delete(patientId);
    }));
  }
  return devicePatientPromises.get(patientId);
}

export async function listArchivedDevicesForPatient(patientId, options = {}) {
  if (!patientId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || ARCHIVE_PAGE_SIZE));
  if (appConfig().testMode) {
    return mergeArchivePending(patientId, testArchivedDevicesForPatient(patientId).slice(0, limit));
  }
  try {
    const rows = await listCollectionWhere("devices_archive", [["patientId", "==", patientId]], {
      orderBy: [["removalDate", "desc"]],
      limit
    });
    return mergeArchivePending(patientId, rows);
  } catch {
    return mergeArchivePending(patientId, []);
  }
}

export async function pageArchivedDevicesForPatient(patientId, cursorState = {}) {
  if (!patientId) return emptyCursorPage([], cursorState.pageSize || ARCHIVE_PAGE_SIZE);
  const pageSize = Math.min(100, Math.max(1, Number(cursorState.pageSize) || ARCHIVE_PAGE_SIZE));
  if (appConfig().testMode) {
    return emptyCursorPage(await listArchivedDevicesForPatient(patientId, { limit: pageSize }), pageSize);
  }
  try {
    const page = await paginateQuery("devices_archive", [["patientId", "==", patientId]], [["removalDate", "desc"]], pageSize, cursorState, cursorState.direction || "next");
    const rows = (await mergeArchivePending(patientId, page.rows))
      .filter(row => row.patientId === patientId)
      .slice(0, page.pageSize);
    return { ...page, rows };
  } catch {
    return emptyCursorPage(await listArchivedDevicesForPatient(patientId, { limit: pageSize }), pageSize);
  }
}

export function mergeDeviceHistory(activeRows = [], archivedRows = []) {
  const map = byEpisodeId(activeRows);
  archivedRows.forEach(row => map.set(row.episodeId || row.id, { ...map.get(row.episodeId || row.id), ...row }));
  return [...map.values()].sort((a, b) =>
    String(b.removalDate || b.updatedAt || "").localeCompare(String(a.removalDate || a.updatedAt || ""))
    || String(b.installationDate || "").localeCompare(String(a.installationDate || ""))
  );
}

function emptyCursorPage(rows = [], pageSize = ARCHIVE_PAGE_SIZE) {
  return {
    rows,
    firstCursor: null,
    lastCursor: null,
    hasNext: false,
    hasPrevious: false,
    pageSize
  };
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
  const isNewEpisode = !device.episodeId;
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
  activeDevicesPromise = null;
  if (payload.patientId) devicePatientPromises.delete(payload.patientId);
  await writeAudit(app, {
    actionType: isNewEpisode && payload.isReinstallation ? "device_reinstallation_create" : (isNewEpisode ? "device_create" : "device_update"),
    module: "dispositivos",
    entityType: "device",
    entityId: episodeId,
    patientId: device.patientId,
    after: saved
  });
  return saved;
}

export async function saveArchivedDeviceEpisode(app, device) {
  if (!validDevice(device) || !device.removalDate) throw new Error("Historico sin paciente, tipo, instalacion o retiro.");
  const episodeId = device.episodeId || makeEpisodeId();
  const payload = stripUndefined({
    ...device,
    episodeId,
    active: false,
    status: "retirado",
    careStatus: cleanText(device.careStatus || "retirado"),
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || "",
    archivedAt: device.archivedAt || nowIso(),
    archivedBy: device.archivedBy || app.state.auth.user?.uid || "",
    source: device.source || "lite_device_archive_editor"
  });
  const saved = await setDocMergeOrQueue(app, `devices_archive/${episodeId}`, payload, {
    module: "dispositivos",
    entityType: "device_archive",
    entityId: episodeId
  });
  if (payload.patientId) devicePatientPromises.delete(payload.patientId);
  await writeAudit(app, {
    actionType: device.episodeId ? "device_archive_update" : "device_archive_create",
    module: "dispositivos",
    entityType: "device_archive",
    entityId: episodeId,
    patientId: device.patientId,
    after: saved
  });
  return saved;
}

export async function removeDeviceEpisode(app, device, removalDate) {
  if (!device?.episodeId) throw new Error("Dispositivo sin identificador.");
  const timestamp = nowIso();
  const userId = app.state.auth.user?.uid || "";
  const payload = stripUndefined({
    ...device,
    removalDate,
    active: false,
    status: "retirado",
    updatedAt: timestamp,
    updatedBy: userId
  });
  const archivePayload = stripUndefined({
    ...payload,
    archivedAt: timestamp,
    archivedBy: userId,
    archiveReason: "device_removed"
  });
  const [savedActive, savedArchive] = await Promise.all([
    setDocMergeOrQueue(app, `devices_active/${device.episodeId}`, payload, {
      module: "dispositivos",
      entityType: "device",
      entityId: device.episodeId
    }),
    setDocMergeOrQueue(app, `devices_archive/${device.episodeId}`, archivePayload, {
      module: "dispositivos",
      entityType: "device",
      entityId: device.episodeId
    })
  ]);
  const saved = {
    ...savedActive,
    archiveSyncStatus: savedArchive.syncStatus || savedActive.syncStatus,
    syncStatus: [savedActive.syncStatus, savedArchive.syncStatus].includes("local_pending")
      ? "local_pending"
      : savedActive.syncStatus
  };
  activeDevicesPromise = null;
  if (payload.patientId) devicePatientPromises.delete(payload.patientId);
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

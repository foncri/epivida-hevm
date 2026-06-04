import { cacheGet, cacheSet } from "../lib/cache.js";
import { nowIso } from "../lib/date.js";
import { addDocData, setDocMerge } from "./firestoreService.js";

const QUEUE_KEY = "sync_queue:pending";

function makeId(prefix = "sync") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

async function readQueue() {
  const cached = await cacheGet(QUEUE_KEY);
  return Array.isArray(cached?.value) ? cached.value : [];
}

async function writeQueue(rows) {
  await cacheSet(QUEUE_KEY, rows);
  return rows;
}

export async function queueWrite(app, operation) {
  const user = app?.state?.auth?.user;
  const profile = app?.state?.auth?.profile;
  const item = {
    id: operation.id || makeId(operation.collection || "sync"),
    status: "local_pending",
    attempts: 0,
    createdAt: nowIso(),
    lastAttemptAt: "",
    userId: user?.uid || "",
    userEmail: user?.email || "",
    role: profile?.role || "",
    ...operation
  };
  const queue = await readQueue();
  const withoutDuplicate = queue.filter(row => {
    if (row.id === item.id) return false;
    if (item.path && row.path === item.path) return false;
    return true;
  });
  await writeQueue([...withoutDuplicate, item]);
  return item;
}

export async function listPendingWrites() {
  return readQueue();
}

export async function pendingPayloadsForCollection(collection) {
  const queue = await readQueue();
  return queue
    .filter(item => item.status !== "server_synced")
    .filter(item => item.kind === "setDocMerge" && item.path?.startsWith(`${collection}/`))
    .map(item => ({
      id: item.path.split("/").at(-1),
      ...item.data,
      syncStatus: item.status || "local_pending",
      syncQueueId: item.id
    }));
}

export async function setDocMergeOrQueue(app, path, data, meta = {}) {
  try {
    await setDocMerge(path, data);
    return { ...data, syncStatus: "server_synced" };
  } catch (error) {
    await queueWrite(app, {
      kind: "setDocMerge",
      path,
      data,
      collection: path.split("/")[0],
      error: error?.message || String(error || "No se pudo sincronizar."),
      ...meta
    });
    return { ...data, syncStatus: "local_pending" };
  }
}

export async function addDocOrQueue(app, collection, data, meta = {}) {
  try {
    const id = await addDocData(collection, data);
    return { id, syncStatus: "server_synced" };
  } catch (error) {
    const item = await queueWrite(app, {
      kind: "addDocData",
      collection,
      data,
      error: error?.message || String(error || "No se pudo sincronizar."),
      ...meta
    });
    return { id: item.id, syncStatus: "local_pending" };
  }
}

export async function flushPendingWrites() {
  const queue = await readQueue();
  if (!queue.length) return { attempted: 0, synced: 0, pending: 0, errors: 0 };
  let synced = 0;
  let errors = 0;
  const next = [];

  for (const item of queue) {
    try {
      if (item.kind === "setDocMerge") await setDocMerge(item.path, item.data);
      else if (item.kind === "addDocData") await addDocData(item.collection, item.data);
      else throw new Error("Operacion de sincronizacion desconocida.");
      synced += 1;
    } catch (error) {
      errors += 1;
      next.push({
        ...item,
        attempts: Number(item.attempts || 0) + 1,
        lastAttemptAt: nowIso(),
        status: "local_pending",
        error: error?.message || String(error || "No se pudo sincronizar.")
      });
    }
  }

  await writeQueue(next);
  return { attempted: queue.length, synced, pending: next.length, errors };
}

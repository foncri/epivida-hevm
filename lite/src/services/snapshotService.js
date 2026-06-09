import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { todayIso } from "../lib/date.js";
import { getDocData } from "./firestoreService.js";

const snapshotPromises = new Map();

function snapshotCacheKey(date) {
  return `daily_snapshots:${date}`;
}

async function loadSnapshot(date) {
  if (appConfig().testMode) {
    const cached = await cacheGet(snapshotCacheKey(date));
    return cached?.value || null;
  }
  try {
    const snapshot = await getDocData(`daily_snapshots/${date}`);
    if (snapshot) cacheSet(snapshotCacheKey(date), snapshot).catch(() => undefined);
    return snapshot;
  } catch {
    const cached = await cacheGet(snapshotCacheKey(date));
    return cached?.value || null;
  }
}

export async function todaySnapshot(date = todayIso()) {
  const key = date || todayIso();
  if (!snapshotPromises.has(key)) {
    snapshotPromises.set(key, loadSnapshot(key).finally(() => {
      snapshotPromises.delete(key);
    }));
  }
  return snapshotPromises.get(key);
}

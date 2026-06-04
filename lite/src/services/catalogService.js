import { cacheGet, cacheSet } from "../lib/cache.js";
import { listCollection } from "./firestoreService.js";

const CACHE_KEY = "catalogs:last";

export async function loadCatalogs() {
  try {
    const rows = await listCollection("catalogs");
    cacheSet(CACHE_KEY, rows).catch(() => undefined);
    return rows;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return cached?.value || [];
  }
}

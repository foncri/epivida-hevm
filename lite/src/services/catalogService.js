import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { listCollection } from "./firestoreService.js";

const CACHE_KEY = "catalogs:last";
let catalogsPromise = null;

async function loadCatalogRows() {
  if (appConfig().testMode) {
    const cached = await cacheGet(CACHE_KEY);
    return cached?.value || [];
  }
  try {
    const rows = await listCollection("catalogs");
    cacheSet(CACHE_KEY, rows).catch(() => undefined);
    return rows;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return cached?.value || [];
  }
}

export async function loadCatalogs() {
  catalogsPromise ||= loadCatalogRows().finally(() => {
    catalogsPromise = null;
  });
  return catalogsPromise;
}

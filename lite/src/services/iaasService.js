import { cacheGet, cacheSet } from "../lib/cache.js";
import { listCollection } from "./firestoreService.js";

const CACHE_KEY = "iaas_active:last";

export async function listActiveIaas() {
  try {
    const rows = await listCollection("iaas_active");
    const active = rows.filter(row => !["closed", "cerrada", "archived"].includes(String(row.status || "").toLowerCase()));
    cacheSet(CACHE_KEY, active).catch(() => undefined);
    return active;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return cached?.value || [];
  }
}

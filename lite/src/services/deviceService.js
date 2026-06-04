import { cacheGet, cacheSet } from "../lib/cache.js";
import { listCollection } from "./firestoreService.js";

const CACHE_KEY = "devices_active:last";

export async function listActiveDevices() {
  try {
    const rows = await listCollection("devices_active");
    const active = rows.filter(row => row.active !== false && !row.removalDate);
    cacheSet(CACHE_KEY, active).catch(() => undefined);
    return active;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return cached?.value || [];
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

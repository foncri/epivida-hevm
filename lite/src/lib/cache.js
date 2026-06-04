const DB_NAME = "epivida-lite-cache-v1";
const STORE = "kv";

function openDb() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheGet(key) {
  const db = await openDb().catch(() => null);
  if (!db) return null;
  return new Promise(resolve => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function cacheSet(key, value) {
  const db = await openDb().catch(() => null);
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ value, savedAt: new Date().toISOString() }, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function cacheDelete(key) {
  const db = await openDb().catch(() => null);
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

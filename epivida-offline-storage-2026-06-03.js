(() => {
  "use strict";

  if (window.__epividaOfflineStorage20260603) return;
  window.__epividaOfflineStorage20260603 = true;

  const DB_NAME = "epivida-offline-v1";
  const STORE = "kv";
  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const MIRRORED_KEYS = new Set([STORE_KEY, DRAFT_KEY, "epivida-sheets-session-v1"]);

  function openDb() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  }

  async function idbSet(key, value) {
    const db = await openDb();
    if (!db) return false;
    return new Promise(resolve => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  function safeLocalGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeLocalSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  async function mirrorKey(key) {
    const value = safeLocalGet(key);
    if (value === null) return false;
    return idbSet(key, { value, savedAt: new Date().toISOString() });
  }

  async function restoreKey(key) {
    if (safeLocalGet(key) !== null) return false;
    const record = await idbGet(key);
    if (!record?.value) return false;
    return safeLocalSet(key, record.value);
  }

  async function restoreLocalState() {
    const restored = [];
    for (const key of MIRRORED_KEYS) {
      if (await restoreKey(key)) restored.push(key);
    }
    if (restored.length) safeLocalSet("epivida-offline-restored-at", new Date().toISOString());
    return restored;
  }

  function installLocalStorageMirror() {
    const nativeSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      nativeSet.call(this, key, value);
      if (this === localStorage && MIRRORED_KEYS.has(String(key))) {
        idbSet(String(key), { value: String(value), savedAt: new Date().toISOString() });
      }
    };
  }

  async function saveSnapshot() {
    const results = [];
    for (const key of MIRRORED_KEYS) results.push([key, await mirrorKey(key)]);
    return Object.fromEntries(results);
  }

  installLocalStorageMirror();
  window.__epividaOfflineReady = restoreLocalState().then(async restored => {
    await saveSnapshot();
    return { restored };
  }).catch(error => {
    console.warn("No se pudo restaurar respaldo offline EpiVida.", error);
    return { restored: [], error: String(error?.message || error) };
  });

  window.EpiVidaOfflineBackup = {
    saveSnapshot,
    restoreLocalState,
    async status() {
      const record = await idbGet(STORE_KEY);
      return {
        indexedDb: Boolean("indexedDB" in window),
        hasLocalStore: safeLocalGet(STORE_KEY) !== null,
        hasIndexedStore: Boolean(record?.value),
        indexedStoreSavedAt: record?.savedAt || ""
      };
    }
  };

  ["pagehide", "beforeunload"].forEach(type => {
    window.addEventListener(type, () => { saveSnapshot(); }, { capture: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveSnapshot();
  });
})();

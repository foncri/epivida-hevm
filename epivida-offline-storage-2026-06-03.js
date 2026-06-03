(() => {
  "use strict";

  if (window.__epividaOfflineStorage20260603) return;
  window.__epividaOfflineStorage20260603 = true;

  const DB_NAME = "epivida-offline-v1";
  const STORE = "kv";
  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const MIRRORED_KEYS = new Set([STORE_KEY, DRAFT_KEY, "epivida-sheets-session-v1"]);
  const HISTORY_LIMIT = 7;

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

  function checksum(text) {
    let hash = 2166136261;
    const value = String(text || "");
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function jsonLooksValid(key, value) {
    if (!value) return false;
    if (key === STORE_KEY || key === DRAFT_KEY) {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object";
      } catch {
        return false;
      }
    }
    return true;
  }

  function makeRecord(key, value) {
    return {
      key,
      value,
      checksum: checksum(value),
      bytes: new Blob([value]).size,
      savedAt: new Date().toISOString(),
      schema: 2
    };
  }

  function recordValid(record) {
    return Boolean(record?.value)
      && record.checksum === checksum(record.value)
      && jsonLooksValid(record.key, record.value);
  }

  async function saveHistoryRecord(key, record) {
    const historyKey = `${key}:history`;
    const previous = await idbGet(historyKey);
    const history = Array.isArray(previous) ? previous.filter(recordValid) : [];
    const next = [record, ...history.filter(item => item.checksum !== record.checksum)].slice(0, HISTORY_LIMIT);
    return idbSet(historyKey, next);
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
    if (!jsonLooksValid(key, value)) return false;
    const record = makeRecord(key, value);
    const latestSaved = await idbSet(key, record);
    const historySaved = await saveHistoryRecord(key, record);
    return Boolean(latestSaved && historySaved);
  }

  async function restoreKey(key) {
    if (safeLocalGet(key) !== null) return false;
    const record = await idbGet(key);
    const history = await idbGet(`${key}:history`);
    const candidates = [
      record,
      ...(Array.isArray(history) ? history : [])
    ].filter(recordValid);
    const best = candidates.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))[0];
    if (!best) return false;
    const restored = safeLocalSet(key, best.value);
    if (restored) await idbSet(key, best);
    return restored;
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
    checksum,
    async status() {
      const record = await idbGet(STORE_KEY);
      const history = await idbGet(`${STORE_KEY}:history`);
      const validHistory = Array.isArray(history) ? history.filter(recordValid) : [];
      return {
        indexedDb: Boolean("indexedDB" in window),
        hasLocalStore: safeLocalGet(STORE_KEY) !== null,
        hasIndexedStore: recordValid(record),
        indexedStoreSavedAt: record?.savedAt || "",
        indexedStoreBytes: record?.bytes || 0,
        indexedStoreChecksum: record?.checksum || "",
        indexedStoreValid: recordValid(record),
        backupVersions: validHistory.length,
        lastBackupSavedAt: validHistory[0]?.savedAt || record?.savedAt || ""
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

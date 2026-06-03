(() => {
  "use strict";

  if (window.__epividaOfflineStorage20260603) return;
  window.__epividaOfflineStorage20260603 = true;

  const DB_NAME = "epivida-offline-v1";
  const STORE = "kv";
  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const OFFLINE_PREPARED_KEY = "epivida-offline-prepared-at";
  const OFFLINE_STATUS_KEY = "epivida-offline-cache-status";
  const OFFLINE_AUTO_PREPARED_KEY = "epivida-offline-auto-prepared-at";
  const MIRRORED_KEYS = new Set([STORE_KEY, DRAFT_KEY, "epivida-sheets-session-v1"]);
  const HISTORY_LIMIT = 7;
  const PREPARE_TIMEOUT_MS = 15000;
  const AUTO_PREPARE_INTERVAL_MS = 6 * 60 * 60 * 1000;

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
        const record = makeRecord(String(key), String(value));
        idbSet(String(key), record);
        saveHistoryRecord(String(key), record);
      }
    };
  }

  async function saveSnapshot() {
    const results = [];
    for (const key of MIRRORED_KEYS) results.push([key, await mirrorKey(key)]);
    return Object.fromEntries(results);
  }

  function serviceWorkerMessage(type, registration) {
    return new Promise((resolve, reject) => {
      const target = navigator.serviceWorker?.controller || registration?.active;
      if (!target) {
        reject(new Error("Modo sin internet aun no esta activo en este navegador."));
        return;
      }
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.onmessage = null;
        reject(new Error("El telefono tardo demasiado en preparar el modo sin internet."));
      }, PREPARE_TIMEOUT_MS);
      channel.port1.onmessage = event => {
        window.clearTimeout(timeout);
        const payload = event.data || {};
        if (payload.ok) resolve(payload);
        else reject(new Error(payload.error || "No se pudo preparar el modo sin internet."));
      };
      target.postMessage({ type }, [channel.port2]);
    });
  }

  async function ensureServiceWorkerReady() {
    if (!("serviceWorker" in navigator)) throw new Error("Este navegador no permite preparar EpiVida sin internet.");
    const registration = await navigator.serviceWorker.register("./epivida-service-worker.js?v=2026-06-03-offline-ready01");
    await registration.update().catch(() => null);
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
        window.setTimeout(done, 1200);
      });
    }
    return registration;
  }

  async function cacheStatus() {
    const registration = await ensureServiceWorkerReady();
    const status = await serviceWorkerMessage("EPIVIDA_OFFLINE_STATUS", registration);
    safeLocalSet(OFFLINE_STATUS_KEY, JSON.stringify({ ...status, checkedAt: new Date().toISOString() }));
    return status;
  }

  async function prepareOffline() {
    const snapshot = await saveSnapshot();
    const registration = await ensureServiceWorkerReady();
    const status = await serviceWorkerMessage("EPIVIDA_PREPARE_OFFLINE", registration);
    const preparedAt = new Date().toISOString();
    const ready = status.ok !== false && !status.failed?.length;
    safeLocalSet(OFFLINE_PREPARED_KEY, preparedAt);
    safeLocalSet(OFFLINE_STATUS_KEY, JSON.stringify({ ...status, ready, preparedAt, snapshot }));
    return { ...status, ready, preparedAt, snapshot };
  }

  function shouldAutoPrepareOffline() {
    if (!navigator.onLine || !("serviceWorker" in navigator) || !("indexedDB" in window)) return false;
    const last = safeLocalGet(OFFLINE_AUTO_PREPARED_KEY) || safeLocalGet(OFFLINE_PREPARED_KEY);
    if (!last) return true;
    const elapsed = Date.now() - Date.parse(last);
    return !Number.isFinite(elapsed) || elapsed > AUTO_PREPARE_INTERVAL_MS;
  }

  async function autoPrepareOffline() {
    if (!shouldAutoPrepareOffline()) return null;
    const result = await prepareOffline();
    safeLocalSet(OFFLINE_AUTO_PREPARED_KEY, result.preparedAt || new Date().toISOString());
    return result;
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
    prepareOffline,
    autoPrepareOffline,
    cacheStatus,
    checksum,
    async status() {
      const record = await idbGet(STORE_KEY);
      const history = await idbGet(`${STORE_KEY}:history`);
      const validHistory = Array.isArray(history) ? history.filter(recordValid) : [];
      let cache = {};
      try {
        cache = JSON.parse(safeLocalGet(OFFLINE_STATUS_KEY) || "{}");
      } catch {
        cache = {};
      }
      return {
        indexedDb: Boolean("indexedDB" in window),
        hasLocalStore: safeLocalGet(STORE_KEY) !== null,
        hasIndexedStore: recordValid(record),
        indexedStoreSavedAt: record?.savedAt || "",
        indexedStoreBytes: record?.bytes || 0,
        indexedStoreChecksum: record?.checksum || "",
        indexedStoreValid: recordValid(record),
        backupVersions: validHistory.length,
        lastBackupSavedAt: validHistory[0]?.savedAt || record?.savedAt || "",
        offlinePreparedAt: safeLocalGet(OFFLINE_PREPARED_KEY) || "",
        offlineAutoPreparedAt: safeLocalGet(OFFLINE_AUTO_PREPARED_KEY) || "",
        offlineCacheReady: Boolean(cache.ready || (cache.cached && cache.requested && cache.cached >= cache.requested)),
        offlineCacheStatus: cache
      };
    }
  };

  window.addEventListener("load", () => {
    window.setTimeout(() => {
      autoPrepareOffline().catch(error => {
        console.warn("No se pudo preparar automaticamente EpiVida offline.", error);
      });
    }, 2500);
  });

  ["pagehide", "beforeunload"].forEach(type => {
    window.addEventListener(type, () => { saveSnapshot(); }, { capture: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveSnapshot();
  });
})();

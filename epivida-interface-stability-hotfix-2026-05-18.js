(() => {
  "use strict";

  if (window.__epividaInterfaceStabilityHotfix20260518) return;
  window.__epividaInterfaceStabilityHotfix20260518 = true;

  const LEGACY_MONITOR_REFRESH_KEY = "epivida-monitor-iaas-refresh-needed";
  const IAAS_POST_SAVE_KEY = "epivida-iaas-post-save-v1";
  const PREVENTIVE_POST_SAVE_KEY = "epivida-preventive-post-save-v2";
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeDispatchEvent = window.dispatchEvent.bind(window);

  let suppressPatientHashRenderUntil = 0;
  let monitorSoftRefreshQueued = false;

  function isIaasPatientRoute() {
    return /^#\/seguimiento-iaas\/[^/]+\/paciente\/[^/]+/.test(String(location.hash || ""));
  }

  function isMonitorRoute() {
    return String(location.hash || "") === "#/monitoreo-epidemiologico";
  }

  function loadSessionJson(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "null") || null;
    } catch {
      return null;
    }
  }

  function clearLegacyMonitorFlag() {
    try {
      sessionStorage.removeItem(LEGACY_MONITOR_REFRESH_KEY);
    } catch {
      // Best effort only.
    }
  }

  function softRefreshAfterBlockedReload() {
    const x = window.scrollX;
    const y = window.scrollY;
    const payload = loadSessionJson(IAAS_POST_SAVE_KEY) || loadSessionJson(PREVENTIVE_POST_SAVE_KEY) || {};
    try {
      sessionStorage.removeItem(IAAS_POST_SAVE_KEY);
      sessionStorage.removeItem(PREVENTIVE_POST_SAVE_KEY);
    } catch {
      // Best effort only.
    }
    clearLegacyMonitorFlag();
    if (payload.targetHash && location.hash !== payload.targetHash) location.hash = payload.targetHash;
    nativeDispatchEvent(new Event("hashchange"));
    nativeSetTimeout(() => window.scrollTo(x, y), 0);
    nativeSetTimeout(() => window.scrollTo(x, y), 120);
    if (navigator.onLine) nativeSetTimeout(() => nativeDispatchEvent(new Event("online")), 80);
  }

  function scheduleMonitorSoftRefresh() {
    clearLegacyMonitorFlag();
    if (!isMonitorRoute() || monitorSoftRefreshQueued) return;
    monitorSoftRefreshQueued = true;
    nativeSetTimeout(() => {
      monitorSoftRefreshQueued = false;
      nativeDispatchEvent(new Event("hashchange"));
    }, 80);
  }

  window.setTimeout = function epividaStableSetTimeout(callback, delay, ...args) {
    const source = typeof callback === "function" ? Function.prototype.toString.call(callback) : "";
    if (source.includes("location.reload") || source.includes("window.location.reload")) {
      return nativeSetTimeout(softRefreshAfterBlockedReload, delay, ...args);
    }
    return nativeSetTimeout(callback, delay, ...args);
  };

  window.dispatchEvent = function epividaStableDispatchEvent(event) {
    if (event?.type === "hashchange" && isIaasPatientRoute() && Date.now() < suppressPatientHashRenderUntil) {
      return true;
    }
    return nativeDispatchEvent(event);
  };

  document.addEventListener("change", event => {
    if (event.target?.closest?.("[data-iaas-ownership-status]") && isIaasPatientRoute()) {
      suppressPatientHashRenderUntil = Date.now() + 700;
      clearLegacyMonitorFlag();
    }
  }, true);

  window.addEventListener("epivida:iaas-classification-synced", scheduleMonitorSoftRefresh);
  window.addEventListener("hashchange", clearLegacyMonitorFlag);
  clearLegacyMonitorFlag();
})();

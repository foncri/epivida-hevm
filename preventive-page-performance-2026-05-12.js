(() => {
  "use strict";

  if (window.__epividaPreventivePerformancePatch) return;
  window.__epividaPreventivePerformancePatch = true;

  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const throttledTimeouts = new Map();
  let lastPreventiveUpgradeRun = 0;
  let pendingPreventiveUpgradeRun = 0;

  function isPreventiveUpgradeCallback(callback) {
    if (typeof callback !== "function") return false;
    try {
      const source = Function.prototype.toString.call(callback);
      return source.includes("runBedCatalog") && source.includes("cleanupPreventivePanels");
    } catch {
      return false;
    }
  }

  window.requestAnimationFrame = callback => {
    if (!isPreventiveUpgradeCallback(callback)) return nativeRequestAnimationFrame(callback);
    if (pendingPreventiveUpgradeRun) return pendingPreventiveUpgradeRun;
    const wait = Math.max(0, 260 - (Date.now() - lastPreventiveUpgradeRun));
    pendingPreventiveUpgradeRun = nativeSetTimeout(() => {
      pendingPreventiveUpgradeRun = 0;
      lastPreventiveUpgradeRun = Date.now();
      nativeRequestAnimationFrame(callback);
    }, wait);
    throttledTimeouts.set(pendingPreventiveUpgradeRun, true);
    return pendingPreventiveUpgradeRun;
  };

  window.cancelAnimationFrame = handle => {
    if (throttledTimeouts.has(handle)) {
      throttledTimeouts.delete(handle);
      nativeClearTimeout(handle);
      if (handle === pendingPreventiveUpgradeRun) pendingPreventiveUpgradeRun = 0;
      return;
    }
    nativeCancelAnimationFrame(handle);
  };
})();

(() => {
  "use strict";

  if (window.__epividaPreventivePerformancePatch) return;
  window.__epividaPreventivePerformancePatch = true;

  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const throttledTimeouts = new Map();
  const serviceSwitchSelector = ".round-service-filter button:not(.round-add-bed-toggle), .service-filter button, .bed-board-picker select";
  let lastPreventiveUpgradeRun = 0;
  let pendingPreventiveUpgradeRun = 0;
  let visualGuardTimer = 0;

  function installVisualGuardStyle() {
    if (document.getElementById("epivida-preventive-visual-guard")) return;
    const style = document.createElement("style");
    style.id = "epivida-preventive-visual-guard";
    style.textContent = `
      body.epivida-bed-catalog-switching .bed-board.preventive .bed-board-grid,
      body.epivida-bed-catalog-switching .round-nav-board .round-nav-grid {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    document.head.append(style);
  }

  function beginVisualGuard() {
    if (!location.hash.includes("/ronda/")) return;
    installVisualGuardStyle();
    document.body?.classList.add("epivida-bed-catalog-switching");
    nativeClearTimeout(visualGuardTimer);
    visualGuardTimer = nativeSetTimeout(endVisualGuard, 1200);
  }

  function endVisualGuard() {
    nativeClearTimeout(visualGuardTimer);
    visualGuardTimer = 0;
    document.body?.classList.remove("epivida-bed-catalog-switching");
  }

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

  installVisualGuardStyle();
  ["pointerdown", "mousedown", "touchstart", "click", "change"].forEach(type => {
    document.addEventListener(type, event => {
      if (event.target.closest?.(serviceSwitchSelector)) beginVisualGuard();
    }, true);
  });
  window.addEventListener("hashchange", beginVisualGuard, true);
})();

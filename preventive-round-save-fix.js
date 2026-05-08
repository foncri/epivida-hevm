(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  let restoreOnlineTimer = 0;
  let restoreOnline = null;

  function routePatient() {
    return /^#\/ronda\/[^/]+\/paciente\/[^/]+/.test(String(location.hash || ""));
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function pendingQueueCount() {
    const queue = loadStore().writeQueue || [];
    return queue.filter(item => item?.status !== "server_synced").length;
  }

  function isSaveControl(control) {
    const text = clean(control?.textContent).toLowerCase();
    return Boolean(control) && (text.includes("guardar") || text.includes("marcar pendiente"));
  }

  function forceNavigatorOnline(duration = 10000) {
    const restorers = [];
    const targets = [Navigator.prototype, navigator];
    for (const target of targets) {
      const descriptor = Object.getOwnPropertyDescriptor(target, "onLine");
      try {
        Object.defineProperty(target, "onLine", { configurable: true, get: () => true });
        restorers.push(() => {
          if (descriptor) Object.defineProperty(target, "onLine", descriptor);
          else delete target.onLine;
        });
      } catch {
        // Keep trying the next target.
      }
    }
    if (restorers.length) {
      restoreOnline?.();
      restoreOnline = () => restorers.reverse().forEach(restore => restore());
      window.clearTimeout(restoreOnlineTimer);
      restoreOnlineTimer = window.setTimeout(() => {
        restoreOnline?.();
        restoreOnline = null;
      }, duration);
    }
  }

  function showToast(message) {
    document.querySelector(".preventive-hotfix-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "preventive-hotfix-toast";
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function rerenderSoon() {
    [450, 1100, 2200].forEach(delay => window.setTimeout(() => {
      try {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch {
        window.dispatchEvent(new Event("hashchange"));
      }
    }, delay));
  }

  function flushPendingSoon() {
    if (!pendingQueueCount()) return;
    forceNavigatorOnline(12000);
    [900, 2500].forEach(delay => window.setTimeout(() => {
      window.dispatchEvent(new Event("online"));
    }, delay));
  }

  document.addEventListener("click", event => {
    if (!routePatient()) return;
    const saveButton = event.target.closest?.(".patient-round .round-save-bar .iaas-button, .patient-round .round-save-bar button");
    if (!isSaveControl(saveButton)) return;
    forceNavigatorOnline(12000);
    saveButton.classList.add("hotfix-saving");
    showToast("Guardando invasivo y sincronizando con Sheets.");
    rerenderSoon();
    flushPendingSoon();
    window.setTimeout(() => saveButton.classList.remove("hotfix-saving"), 2200);
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", flushPendingSoon, { once: true });
  } else {
    flushPendingSoon();
  }
})();

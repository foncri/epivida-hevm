(() => {
  "use strict";

  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const REPAIR_SRC = "preventive-round-repair.js";

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function normalized(value) {
    return clean(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function todayIso() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function validIso(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isFinite(date.getTime())
      && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` === value;
  }

  function normalizeDate(value) {
    const text = clean(value);
    if (!text || normalized(text) === "NA" || normalized(text) === "AMB") return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validIso(text) ? text : "";
    const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!match) return "";
    const yy = match[3].length === 2 ? Number(match[3]) : null;
    const year = yy === null ? match[3] : String(yy <= (new Date().getFullYear() % 100) + 1 ? 2000 + yy : 1900 + yy);
    const iso = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    return validIso(iso) ? iso : "";
  }

  function routePatient() {
    const match = String(location.hash || "").match(/^#\/ronda\/([^/]+)\/paciente\/([^/]+)/);
    if (!match) return null;
    return { date: match[1], patientId: decodeURIComponent(match[2]) };
  }

  function isIaasFollowUpPatient() {
    return /^#\/seguimiento-iaas\/[^/]+\/paciente\/[^/]+/.test(String(location.hash || ""));
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function packageCreatesDevice(device) {
    const packageType = clean(typeof device === "string" ? device : device?.packageType);
    return new Set(["ITS - CC", "ITU - CU", "NAVM", "ESPECIAL"]).has(packageType);
  }

  function defaultDeviceType(packageType) {
    if (packageType === "ITS - CC") return "CVPC";
    if (packageType === "ITU - CU") return "Sonda Foley";
    if (packageType === "NAVM") return "PUNTAS NASALES";
    return packageType || "Dispositivo";
  }

  function ensureDraftInstallationDates() {
    const route = routePatient();
    if (!route) return;
    const fallback = normalizeDate(route.date) || todayIso();
    document.querySelectorAll(".patient-round .package-draft label.field").forEach(label => {
      const labelText = normalized(label.querySelector("span")?.textContent);
      const input = label.querySelector('input[type="date"]');
      if (!input || input.value || !labelText.includes("FECHA DE INSTALACION")) return;
      input.value = fallback;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const key = `${route.date}:${route.patientId}`;
    const drafts = loadJson(DRAFT_KEY, {});
    const draft = drafts[key];
    if (!draft?.deviceDrafts?.length) return;
    let changed = false;
    draft.deviceDrafts.forEach(device => {
      if (!packageCreatesDevice(device)) return;
      if (!device.installationDate) {
        device.installationDate = fallback;
        changed = true;
      }
      if (!device.deviceType) {
        device.deviceType = defaultDeviceType(device.packageType);
        changed = true;
      }
    });
    if (changed) saveJson(DRAFT_KEY, drafts);
  }

  function scheduleRepair() {
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
    window.setTimeout(() => window.dispatchEvent(new Event("online")), 450);
  }

  function isSaveButton(event) {
    const button = event.target?.closest?.(".patient-round .round-save-bar button, .patient-round .round-save-bar .iaas-button");
    const text = normalized(button?.textContent);
    return Boolean(button) && (text.includes("GUARDAR") || text.includes("MARCAR PENDIENTE"));
  }

  const nativeAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const currentScript = String(document.currentScript?.src || "");
    const source = typeof listener === "function" ? Function.prototype.toString.call(listener) : "";
    const isLegacyPreventiveSaveHook = this === document
      && type === "click"
      && capture
      && currentScript.includes(REPAIR_SRC)
      && source.includes("savePreventiveRoundDirectly")
      && source.includes("round-save-bar");

    if (!isLegacyPreventiveSaveHook) {
      return nativeAddEventListener.call(this, type, listener, options);
    }

    return nativeAddEventListener.call(this, type, function nativeSheetsSaveGuard(event) {
      if (isSaveButton(event)) {
        if (routePatient()) {
          ensureDraftInstallationDates();
          window.setTimeout(scheduleRepair, 180);
          return;
        }
        if (isIaasFollowUpPatient()) return;
      }
      return listener.call(this, event);
    }, options);
  };
})();

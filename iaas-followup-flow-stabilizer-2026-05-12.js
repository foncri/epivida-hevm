(() => {
  "use strict";

  if (window.__epividaIaasFollowupFlowStabilizer) return;
  window.__epividaIaasFollowupFlowStabilizer = true;
  window.__EPIVIDA_TEST_MODE__ = true;

  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const OWNERSHIP_SRC = "iaas-followup-ownership-2026-05-12.js";
  const IAAS_STATUSES = ["NINGUNO", "NO IAAS", "RIESGO IAAS", "IAAS"];
  const SECTION_BY_LABEL = {
    ANTIBIOTICOS: "antibioticos",
    CULTIVOS: "cultivos",
    OBSERVACIONES: "observaciones",
    "SIGNOS VITALES": "signos",
    "BIOMETRIA HEMATICA": "biometria",
    "EXAMEN GENERAL DE ORINA": "ego",
    "OTROS ESTUDIOS": "otros"
  };

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const nowIso = () => new Date().toISOString();

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local persistence failure must not block clinical capture.
    }
  }

  function routeIaasPatient() {
    const match = String(location.hash || "").match(/^#\/seguimiento-iaas\/([^/]+)\/paciente\/([^/]+)/);
    return match ? { date: match[1], patientId: decodeURIComponent(match[2]) } : null;
  }

  function isIaasHub() {
    return String(location.hash || "") === "#/seguimiento-iaas";
  }

  function classificationFromPanel() {
    const value = norm(document.querySelector("[data-iaas-ownership-status]")?.value || "");
    return IAAS_STATUSES.includes(value) ? value : "";
  }

  function classificationFromStore(store, date, patientId) {
    const patient = store.patients?.[patientId] || {};
    const entry = store.dailyRounds?.[date]?.entries?.[patientId] || {};
    const drafts = loadJson(DRAFT_KEY, {});
    const draft = drafts[`${date}:${patientId}`] || {};
    const value = norm(draft.iaasFollowUpClassification || entry.iaasFollowUpClassification || patient.iaasFollowUpStatus || "");
    return IAAS_STATUSES.includes(value) ? value : "";
  }

  function ensureStore() {
    const exposed = window.__EPIVIDA_TEST__?.store;
    if (exposed && typeof exposed === "object") return exposed;
    return loadJson(STORE_KEY, {});
  }

  function persistStoreIfExternal(store) {
    if (store !== window.__EPIVIDA_TEST__?.store) saveJson(STORE_KEY, store);
  }

  function addHistory(patient, date, status) {
    patient.iaasFollowUpHistory = Array.isArray(patient.iaasFollowUpHistory) ? patient.iaasFollowUpHistory : [];
    const entry = { date, status, updatedAt: nowIso(), month: String(date || "").slice(0, 7) };
    const index = patient.iaasFollowUpHistory.findIndex(item => item.date === date && norm(item.status) === status);
    if (index >= 0) patient.iaasFollowUpHistory[index] = { ...patient.iaasFollowUpHistory[index], ...entry };
    else patient.iaasFollowUpHistory.push(entry);
    patient.iaasFollowUpHistory.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function saveDraftClassification(date, patientId, status) {
    const drafts = loadJson(DRAFT_KEY, {});
    const key = `${date}:${patientId}`;
    drafts[key] = { ...(drafts[key] || {}), activeRoundSection: "iaas", iaasFollowUpClassification: status };
    saveJson(DRAFT_KEY, drafts);
  }

  function applyClassification(date, patientId, status) {
    if (!IAAS_STATUSES.includes(status)) return;
    const store = ensureStore();
    store.patients ||= {};
    store.patients[patientId] ||= { patientId };
    store.dailyCensus ||= {};
    store.dailyCensus[date] ||= { date, patients: {} };
    const patient = store.patients[patientId];
    const row = store.dailyCensus[date].patients?.[patientId] || {};
    const riskValue = status === "NINGUNO" ? "" : status;

    patient.iaasFollowUpStatus = status;
    patient.iaasFollowUpUpdatedAt = nowIso();
    patient.iaasFollowUpManagedRisk = true;
    patient.riesgo_iaas = riskValue;
    patient.updatedAt = nowIso();
    addHistory(patient, date, status);

    if (Object.keys(row).length) {
      row.riesgo_iaas = riskValue;
      row.syncStatus = "local_pending";
    }

    const entry = store.dailyRounds?.[date]?.entries?.[patientId];
    if (entry) {
      entry.iaasFollowUpClassification = status;
      entry.updatedAt = nowIso();
      entry.syncStatus = entry.syncStatus === "server_synced" ? "local_pending" : entry.syncStatus;
    }

    saveDraftClassification(date, patientId, status);
    persistStoreIfExternal(store);
  }

  function flash(message, tone = "error") {
    document.querySelectorAll(".iaas-toast").forEach(toast => toast.remove());
    const toast = document.createElement("div");
    toast.className = `toast iaas-toast ${tone}`;
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2800);
  }

  function isSaveButton(event) {
    const button = event.target?.closest?.(".patient-round .round-save-bar button, .patient-round .round-save-bar .iaas-button");
    const text = norm(button?.textContent);
    return Boolean(button) && (text.includes("GUARDAR") || text.includes("PENDIENTE"));
  }

  function stabilizeBeforeNativeSave(event) {
    const current = routeIaasPatient();
    if (!current || !isSaveButton(event)) return false;
    const store = ensureStore();
    const status = classificationFromPanel() || classificationFromStore(store, current.date, current.patientId);
    if (!IAAS_STATUSES.includes(status)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      flash("Selecciona obligatoriamente NINGUNO, NO IAAS, RIESGO IAAS o IAAS antes de guardar.");
      document.querySelector("[data-iaas-ownership-status]")?.focus();
      return true;
    }
    applyClassification(current.date, current.patientId, status);
    return true;
  }

  const nativeAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function epividaStableAddEventListener(type, listener, options) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const currentScript = String(document.currentScript?.src || "");
    const source = typeof listener === "function" ? Function.prototype.toString.call(listener) : "";
    const isLegacyIaasSaveHook = this === document
      && type === "click"
      && capture
      && currentScript.includes(OWNERSHIP_SRC)
      && source.includes("saveIaasDirectly")
      && source.includes("round-save-bar");

    if (!isLegacyIaasSaveHook) {
      return nativeAddEventListener.call(this, type, listener, options);
    }

    return nativeAddEventListener.call(this, type, function iaasNativeSaveGate(event) {
      if (routeIaasPatient() && isSaveButton(event)) {
        stabilizeBeforeNativeSave(event);
        return;
      }
      return listener.call(this, event);
    }, options);
  };

  function sectionKeyFromButton(button) {
    const label = norm(button?.textContent || "");
    return SECTION_BY_LABEL[label] || "";
  }

  function switchIaasSection(button) {
    const key = sectionKeyFromButton(button);
    if (!key) return false;
    document.querySelectorAll(".iaas-mobile-section-tabs button").forEach(tab => {
      const active = sectionKeyFromButton(tab) === key;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".iaas-mobile-section").forEach(section => {
      section.classList.toggle("mobile-active", section.classList.contains(`iaas-mobile-${key}`));
    });
    return true;
  }

  let lastInteraction = null;

  function rememberViewport(event) {
    if (!routeIaasPatient()) return;
    if (!event.target?.closest?.(".iaas-assessment-panel, .iaas-ownership-panel")) return;
    if (event.target.closest?.(".round-save-bar")) return;
    const active = document.activeElement;
    lastInteraction = {
      hash: location.hash,
      x: window.scrollX,
      y: window.scrollY,
      activeId: active?.id || "",
      activeName: active?.getAttribute?.("name") || "",
      at: Date.now()
    };
    [40, 140, 320].forEach(delay => window.setTimeout(restoreViewport, delay));
  }

  function restoreViewport() {
    if (!lastInteraction || lastInteraction.hash !== location.hash || Date.now() - lastInteraction.at > 1400) return;
    if (Math.abs(window.scrollY - lastInteraction.y) > 24 || Math.abs(window.scrollX - lastInteraction.x) > 24) {
      window.scrollTo(lastInteraction.x, lastInteraction.y);
    }
    const active = lastInteraction.activeId
      ? document.getElementById(lastInteraction.activeId)
      : lastInteraction.activeName
        ? document.querySelector(`[name="${CSS.escape(lastInteraction.activeName)}"]`)
        : null;
    if (active && document.activeElement !== active && typeof active.focus === "function") {
      active.focus({ preventScroll: true });
    }
  }

  function removeHistoryFromAuthScreen() {
    if (!isIaasHub()) return;
    if (document.querySelector(".follow-up-hub")) return;
    document.querySelectorAll(".iaas-history-panel").forEach(panel => panel.remove());
  }

  document.addEventListener("click", event => {
    const tab = event.target.closest?.(".iaas-mobile-section-tabs button");
    if (!tab || !routeIaasPatient()) return;
    if (!switchIaasSection(tab)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("pointerdown", rememberViewport, true);
  document.addEventListener("input", rememberViewport, true);
  document.addEventListener("change", rememberViewport, true);
  document.addEventListener("click", rememberViewport, true);

  const scheduleCleanup = () => [0, 120, 450, 900].forEach(delay => window.setTimeout(removeHistoryFromAuthScreen, delay));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleCleanup, { once: true });
  else scheduleCleanup();
  window.addEventListener("hashchange", scheduleCleanup);
})();

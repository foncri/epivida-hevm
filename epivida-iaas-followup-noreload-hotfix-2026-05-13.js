(() => {
  "use strict";

  if (window.__epividaIaasFollowupNoReloadHotfix) return;
  window.__epividaIaasFollowupNoReloadHotfix = true;

  const STORE_KEY = "epivida-iaas-os-v1";
  const IAAS_POST_SAVE_KEY = "epivida-iaas-post-save-v1";
  const PREVENTIVE_POST_SAVE_KEY = "epivida-preventive-post-save-v2";
  const IAAS_STATUSES = ["NINGUNO", "NO IAAS", "RIESGO IAAS", "IAAS"];
  const nativeSetTimeout = window.setTimeout.bind(window);

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const nowIso = () => new Date().toISOString();

  function loadJson(storage, key, fallback) {
    try {
      return JSON.parse(storage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      // Local persistence must not block the clinical flow.
    }
  }

  function runtimeStore() {
    const exposed = window.__EPIVIDA_TEST__?.store;
    if (exposed && typeof exposed === "object") return exposed;
    return loadJson(localStorage, STORE_KEY, {});
  }

  function syncRuntimeStoreFromLocal() {
    const latest = loadJson(localStorage, STORE_KEY, null);
    const exposed = window.__EPIVIDA_TEST__?.store;
    if (latest && exposed && typeof exposed === "object") {
      Object.keys(exposed).forEach(key => delete exposed[key]);
      Object.assign(exposed, latest);
      return exposed;
    }
    return latest || exposed || {};
  }

  function activeDate() {
    const hashDate = String(location.hash || "").match(/^#\/(?:ronda|seguimiento-iaas)\/([^/]+)/)?.[1];
    if (hashDate) return hashDate;
    const store = runtimeStore();
    const uiDate = window.__EPIVIDA_TEST__?.ui?.sheets?.activeDate || store.activeDate || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(uiDate)) return uiDate;
    const latest = Object.keys(store.dailyCensus || {}).sort().at(-1);
    if (latest) return latest;
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function routeIaasPatient() {
    const match = String(location.hash || "").match(/^#\/seguimiento-iaas\/([^/]+)\/paciente\/([^/]+)/);
    return match ? { date: match[1], patientId: decodeURIComponent(match[2]) } : null;
  }

  function patientRow(store, date, patientId) {
    return store.dailyCensus?.[date]?.patients?.[patientId] || {};
  }

  function patientRecord(store, patientId) {
    store.patients ||= {};
    store.patients[patientId] ||= { patientId };
    return store.patients[patientId];
  }

  function addHistory(patient, date, status) {
    patient.iaasFollowUpHistory = Array.isArray(patient.iaasFollowUpHistory) ? patient.iaasFollowUpHistory : [];
    const entry = { date, status, updatedAt: nowIso(), month: String(date || "").slice(0, 7) };
    const index = patient.iaasFollowUpHistory.findIndex(item => item.date === date && norm(item.status) === status);
    if (index >= 0) patient.iaasFollowUpHistory[index] = { ...patient.iaasFollowUpHistory[index], ...entry };
    else patient.iaasFollowUpHistory.push(entry);
    patient.iaasFollowUpHistory.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function applyClassification(date, patientId, status, source = "classification_panel") {
    if (!IAAS_STATUSES.includes(status)) return;
    const store = runtimeStore();
    store.dailyCensus ||= {};
    store.dailyCensus[date] ||= { date, patients: {} };
    const patient = patientRecord(store, patientId);
    const row = patientRow(store, date, patientId);
    const riskValue = status === "NINGUNO" ? "" : status;

    patient.iaasFollowUpStatus = status;
    patient.iaasFollowUpEnteredAt ||= nowIso();
    patient.iaasFollowUpSource ||= source;
    patient.iaasFollowUpUpdatedAt = nowIso();
    patient.iaasFollowUpManagedRisk = true;
    patient.riesgo_iaas = riskValue;
    patient.updatedAt = nowIso();
    addHistory(patient, date, status);

    if (Object.keys(row).length) {
      row.riesgo_iaas = riskValue;
      row.syncStatus = "local_pending";
    }
    saveStore(store);
  }

  function markForIaasFollowUp(date, patientId) {
    const store = runtimeStore();
    const patient = patientRecord(store, patientId);
    const row = patientRow(store, date, patientId);
    patient.iaasFollowUpEnteredAt ||= nowIso();
    patient.iaasFollowUpSource ||= "preventive_redirect";
    patient.iaasFollowUpManagedRisk = true;
    if (!norm(`${patient.riesgo_iaas || ""} ${row.riesgo_iaas || ""}`).includes("IAAS")) {
      patient.riesgo_iaas = "SEGUIMIENTO IAAS";
      if (Object.keys(row).length) row.riesgo_iaas = "SEGUIMIENTO IAAS";
    }
    patient.updatedAt = nowIso();
    store.lastSavedAt = nowIso();
    saveStore(store);
  }

  function refreshWithoutReload() {
    const previousHash = location.hash;
    const x = window.scrollX;
    const y = window.scrollY;
    const iaasPayload = loadJson(sessionStorage, IAAS_POST_SAVE_KEY, null);
    const preventivePayload = loadJson(sessionStorage, PREVENTIVE_POST_SAVE_KEY, null);
    const payload = iaasPayload || preventivePayload || {};
    const targetHash = payload.targetHash || "";

    sessionStorage.removeItem(IAAS_POST_SAVE_KEY);
    sessionStorage.removeItem(PREVENTIVE_POST_SAVE_KEY);
    if (targetHash && location.hash !== targetHash) location.hash = targetHash;
    syncRuntimeStoreFromLocal();
    window.dispatchEvent(new Event("hashchange"));
    if (!targetHash || targetHash === previousHash) {
      [0, 90, 240].forEach(delay => nativeSetTimeout(() => window.scrollTo(x, y), delay));
    }
    if (navigator.onLine) nativeSetTimeout(() => window.dispatchEvent(new Event("online")), 80);
    nativeSetTimeout(scheduleRender, 120);
  }

  window.setTimeout = function epividaNoReloadSetTimeout(callback, delay, ...args) {
    const source = typeof callback === "function" ? Function.prototype.toString.call(callback) : "";
    if (source.includes("location.reload")) {
      return nativeSetTimeout(refreshWithoutReload, delay, ...args);
    }
    return nativeSetTimeout(callback, delay, ...args);
  };

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function patientIdFromHref(href) {
    const match = String(href || "").match(/\/paciente\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function canonicalService(value) {
    const key = norm(value);
    if (key.includes("AMBULATORIO")) return "AMBULATORIO";
    if (key.includes("MEDICINA INTERNA") || key === "MI") return "MEDICINA INTERNA";
    if (key.includes("CIRUGIA") || key.includes("TRAUMATOLOG")) return "CIRUGIA Y TRAUMATOLOGIA";
    if (key.includes("PEDIATR")) return key.includes("INTENSIVOS") || key === "UCIP" || key === "UTIP" ? "UCIP" : "PEDIATRIA";
    if (key.includes("NEONATAL") || key.includes("UCIN")) return "UCIN";
    if (key.includes("ADULTOS") || key.includes("UCIA")) return "UCIA";
    if (key.includes("URGENCIA")) return "URGENCIAS";
    return key || clean(value);
  }

  function isAmbulatory(store, date, patientId) {
    const patient = store.patients?.[patientId] || {};
    const row = patientRow(store, date, patientId);
    return canonicalService(patient.currentService || row.service || "") === "AMBULATORIO";
  }

  function riskText(store, date, patientId) {
    const patient = store.patients?.[patientId] || {};
    const row = patientRow(store, date, patientId);
    return `${patient.iaasFollowUpStatus || ""} ${patient.riesgo_iaas || ""} ${patient.epiText || ""} ${row.riesgo_iaas || ""} ${row.epiText || ""} ${row.epidemiologicalDiagnosis || ""} ${row.diagnostico_epidemiologico || ""}`;
  }

  function iaasCandidate(store, date, patientId) {
    if (isAmbulatory(store, date, patientId)) return false;
    const patient = store.patients?.[patientId] || {};
    const status = norm(patient.iaasFollowUpStatus || "");
    const managed = Boolean(patient.iaasFollowUpEnteredAt || patient.iaasFollowUpManagedRisk || patient.iaasFollowUpSource);
    if (IAAS_STATUSES.includes(status) && (status !== "NINGUNO" || managed)) return true;
    if (managed) return true;
    return norm(riskText(store, date, patientId)).includes("IAAS");
  }

  function serviceBedSort(a, b) {
    return String(a.service || "").localeCompare(String(b.service || ""), "es", { numeric: true })
      || String(a.bed || "").localeCompare(String(b.bed || ""), "es", { numeric: true });
  }

  function iaasRows(store, date) {
    return Object.values(store.dailyCensus?.[date]?.patients || {})
      .filter(row => row.patientId && iaasCandidate(store, date, row.patientId))
      .sort(serviceBedSort);
  }

  function patientName(store, row) {
    const patient = store.patients?.[row.patientId] || {};
    return clean(patient.patientName || patient.name || patient.fullName || row.patientName || row.patientId);
  }

  function followUpBadge(store, row) {
    const patient = store.patients?.[row.patientId] || {};
    const status = norm(patient.iaasFollowUpStatus || "");
    if (IAAS_STATUSES.includes(status)) return status;
    return clean(patient.riesgo_iaas || row.riesgo_iaas || row.epidemiologicalDiagnosis || "SEGUIMIENTO IAAS").toUpperCase();
  }

  function followUpCardPanel() {
    return [...document.querySelectorAll(".follow-up-hub .iaas-panel")]
      .find(panel => norm(panel.querySelector(".iaas-panel-head h2")?.textContent).includes("PACIENTES IAAS"));
  }

  function renderManualFollowUpCards() {
    if (String(location.hash || "") !== "#/seguimiento-iaas") return;
    const panel = followUpCardPanel();
    if (!panel) return;
    const date = activeDate();
    const store = runtimeStore();
    const rows = iaasRows(store, date);
    if (!rows.length) return;

    const subtitle = panel.querySelector(".iaas-panel-head p");
    if (subtitle && norm(subtitle.textContent).includes("SOLO PACIENTES")) {
      subtitle.textContent = "Se muestran pacientes con diagnostico IAAS o tomados manualmente desde Paquetes Preventivos.";
    }
    [...panel.querySelectorAll(":scope > p.muted")]
      .filter(node => norm(node.textContent).includes("SIN PACIENTES IAAS"))
      .forEach(node => node.remove());

    let list = panel.querySelector(":scope > .iaas-follow-list");
    if (!list) {
      list = document.createElement("div");
      list.className = "iaas-follow-list";
      panel.append(list);
    }

    const existing = new Set([...list.querySelectorAll('a[href*="/paciente/"]')].map(link => patientIdFromHref(link.getAttribute("href"))));
    rows.forEach(row => {
      if (!row.patientId || existing.has(row.patientId)) return;
      const patient = store.patients?.[row.patientId] || {};
      const href = `#/seguimiento-iaas/${date}/paciente/${encodeURIComponent(row.patientId)}`;
      const article = document.createElement("article");
      article.className = "iaas-follow-card manual-follow-card";
      article.dataset.patientId = row.patientId;
      article.innerHTML = `
        <div class="iaas-follow-avatar">
          <img src="./assets/epivida-pro/badges/badge-iaas.webp" alt="" loading="lazy">
        </div>
        <div class="iaas-follow-main">
          <strong>${escapeHtml(patientName(store, row))}</strong>
          <span>${escapeHtml(canonicalService(patient.currentService || row.service || "SIN SERVICIO"))} - Cama ${escapeHtml(patient.currentBed || row.bed || "S/C")}</span>
          <small>${escapeHtml(patient.currentDiagnosis || row.diagnosis || "Sin diagnostico hospitalario registrado")}</small>
        </div>
        <div class="iaas-follow-tags">
          <span class="badge reasoning-risk">Seguimiento IAAS</span>
          <span class="badge epi-iaas">${escapeHtml(followUpBadge(store, row))}</span>
          <span class="badge pendiente">Pendiente</span>
        </div>
        <div class="iaas-follow-actions">
          <a class="iaas-button primary" href="${href}">Revisar</a>
          <a class="iaas-button ghost" href="#/pacientes/${encodeURIComponent(row.patientId)}/seguimiento">Historial</a>
        </div>
      `;
      list.append(article);
      existing.add(row.patientId);
    });
  }

  function cleanupSaveToasts() {
    document.querySelectorAll(".iaas-toast").forEach(toast => {
      if (norm(toast.textContent).includes("ACTUALIZANDO")) toast.textContent = "Guardado.";
    });
  }

  function handleClassificationChange(event) {
    const select = event.target?.closest?.("[data-iaas-ownership-status]");
    const current = routeIaasPatient();
    if (!select || !current) return;
    const status = norm(select.value);
    if (IAAS_STATUSES.includes(status)) applyClassification(current.date, current.patientId, status);
    scheduleRender();
  }

  function handleFollowUpRedirect(event) {
    const link = event.target?.closest?.('a[href*="#/seguimiento-iaas/"][href*="/paciente/"], a[href*="/seguimiento-iaas/"][href*="/paciente/"]');
    if (!link || !norm(link.textContent).includes("SEGUIMIENTO IAAS")) return;
    const match = String(link.getAttribute("href") || "").match(/seguimiento-iaas\/([^/]+)\/paciente\/([^/?#]+)/);
    if (match) markForIaasFollowUp(match[1], decodeURIComponent(match[2]));
  }

  let renderQueued = false;

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    nativeSetTimeout(() => {
      renderQueued = false;
      cleanupSaveToasts();
      renderManualFollowUpCards();
    }, 60);
  }

  document.addEventListener("change", handleClassificationChange, true);
  document.addEventListener("click", handleFollowUpRedirect, true);
  window.addEventListener("hashchange", scheduleRender);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleRender, { once: true });
  else scheduleRender();

  const observer = new MutationObserver(scheduleRender);
  const startObserver = () => observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });
})();

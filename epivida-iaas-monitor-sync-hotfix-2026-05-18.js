(() => {
  "use strict";

  if (window.__epividaIaasMonitorSyncHotfix20260518) return;
  window.__epividaIaasMonitorSyncHotfix20260518 = true;

  const STORE_KEY = "epivida-iaas-os-v1";
  const REFRESH_KEY = "epivida-monitor-iaas-refresh-needed";
  const IAAS_STATUSES = new Set(["NINGUNO", "NO IAAS", "RIESGO IAAS", "IAAS"]);

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const nowIso = () => new Date().toISOString();

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "null") || {};
    } catch {
      return {};
    }
  }

  function saveStore(store) {
    try {
      store.lastSavedAt = nowIso();
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      // Local storage failure should not block the visible clinical workflow.
    }
  }

  function routeIaasPatient() {
    const match = String(location.hash || "").match(/^#\/seguimiento-iaas\/([^/]+)\/paciente\/([^/?#]+)/);
    return match ? { date: match[1], patientId: decodeURIComponent(match[2]) } : null;
  }

  function normalizeStatus(value) {
    const text = norm(value);
    if (text.includes("RIESGO") && text.includes("IAAS")) return "RIESGO IAAS";
    if (text.includes("NO") && text.includes("IAAS")) return "NO IAAS";
    if (text === "IAAS") return "IAAS";
    if (text === "NINGUNO") return "NINGUNO";
    return "";
  }

  function diagnosisFromStatus(status) {
    return status && status !== "NINGUNO" ? status : "";
  }

  function isOwnedDiagnosis(value) {
    const text = norm(value);
    return IAAS_STATUSES.has(text) || ["SEGUIMIENTO IAAS", "VIGILANCIA IAAS", "DESCARTAR IAAS"].includes(text);
  }

  function setDiagnosisFields(target, diagnosis) {
    if (!target) return;
    ["epidemiologicalDiagnosis", "currentEpidemiologicalDiagnosis", "diagnostico_epidemiologico", "dxEpidemiologico", "epiText"].forEach(key => {
      if (diagnosis) target[key] = diagnosis;
      else if (isOwnedDiagnosis(target[key])) target[key] = null;
    });
  }

  function ensureCensusRow(store, date, patientId, patient) {
    store.dailyCensus ||= {};
    store.dailyCensus[date] ||= { date, censusDate: date, patients: {} };
    store.dailyCensus[date].patients ||= {};
    const existing = store.dailyCensus[date].patients[patientId] || {};
    store.dailyCensus[date].patients[patientId] = {
      patientId,
      roundDate: date,
      service: existing.service || patient.currentService || "",
      bed: existing.bed || patient.currentBed || "",
      patientName: existing.patientName || patient.patientName || "",
      sector: existing.sector || patient.sector || "",
      age: existing.age ?? patient.age ?? "",
      sex: existing.sex || patient.sex || "",
      admissionDate: existing.admissionDate || patient.admissionDate || "",
      diagnosis: existing.diagnosis || patient.currentDiagnosis || "",
      observations: existing.observations || patient.observations || "",
      present: existing.present !== false,
      ...existing
    };
    return store.dailyCensus[date].patients[patientId];
  }

  function addHistory(patient, date, status) {
    patient.iaasFollowUpHistory = Array.isArray(patient.iaasFollowUpHistory) ? patient.iaasFollowUpHistory : [];
    const entry = { date, status, month: String(date || "").slice(0, 7), updatedAt: nowIso() };
    const index = patient.iaasFollowUpHistory.findIndex(item => item.date === date && norm(item.status) === status);
    if (index >= 0) patient.iaasFollowUpHistory[index] = { ...patient.iaasFollowUpHistory[index], ...entry };
    else patient.iaasFollowUpHistory.push(entry);
  }

  function upsertClassificationWrite(store, date, patientId, patient, row) {
    store.writeQueue ||= [];
    const hotfixKey = `iaas-monitor-sync:${date}:${patientId}`;
    const operation = { type: "patientUpdate", date, patientId, patient, censusRow: row, hotfixKey, source: "iaas-monitor-sync-hotfix" };
    const existing = store.writeQueue.find(item => item.operation?.hotfixKey === hotfixKey && item.status !== "server_synced");
    if (existing) {
      existing.status = "local_pending";
      existing.error = "";
      existing.operation = operation;
      return;
    }
    store.writeQueue.push({ id: `write-${Date.now()}-${Math.random().toString(16).slice(2)}`, status: "local_pending", createdAt: nowIso(), operation });
  }

  function applyStatus(date, patientId, rawStatus) {
    const status = normalizeStatus(rawStatus);
    if (!IAAS_STATUSES.has(status)) return false;
    const diagnosis = diagnosisFromStatus(status);
    const store = loadStore();
    store.patients ||= {};
    const patient = store.patients[patientId] ||= { patientId };
    const row = ensureCensusRow(store, date, patientId, patient);

    patient.iaasFollowUpStatus = status;
    patient.iaasFollowUpManagedRisk = true;
    patient.iaasFollowUpUpdatedAt = nowIso();
    patient.riesgo_iaas = diagnosis;
    setDiagnosisFields(patient, diagnosis);
    addHistory(patient, date, status);

    row.riesgo_iaas = diagnosis;
    setDiagnosisFields(row, diagnosis);
    row.syncStatus = "local_pending";
    row.present = row.present !== false;

    if (store.dailyRounds?.[date]?.entries?.[patientId]) {
      store.dailyRounds[date].entries[patientId].iaasFollowUpClassification = status;
      store.dailyRounds[date].entries[patientId].activeRoundSection = "iaas";
      store.dailyRounds[date].entries[patientId].syncStatus = "local_pending";
    }

    upsertClassificationWrite(store, date, patientId, patient, row);
    saveStore(store);
    try {
      sessionStorage.setItem(REFRESH_KEY, nowIso());
    } catch {
      // Best effort only.
    }
    return true;
  }

  function consumeMonitorRefresh() {
    if (String(location.hash || "") !== "#/monitoreo-epidemiologico") return;
    try {
      if (!sessionStorage.getItem(REFRESH_KEY)) return;
      sessionStorage.removeItem(REFRESH_KEY);
    } catch {
      return;
    }
    window.setTimeout(() => location.reload(), 80);
  }

  function cleanupResolvedSheetsMessages() {
    const text = norm(document.body?.innerText || "");
    const healthy = text.includes("SHEETS CONECTADO") && !text.includes("CONFLICTO SHEETS") && !text.includes("ERROR SHEETS");
    if (!healthy) return;
    document.querySelectorAll(".sheets-notice, .iaas-toast").forEach(node => {
      const message = norm(node.textContent || "");
      if (/CAMBIOS LOCALES PREVIOS|RECARGA SHEETS|CONFLICTO|ANTES DE ESCRIBIR EN LA BASE CLINICA/.test(message)) node.remove();
    });
  }

  document.addEventListener("change", event => {
    const select = event.target?.closest?.("[data-iaas-ownership-status]");
    const route = routeIaasPatient();
    if (!select || !route) return;
    window.setTimeout(() => {
      if (applyStatus(route.date, route.patientId, select.value)) {
        window.dispatchEvent(new Event("epivida:iaas-classification-synced"));
      }
    }, 0);
  }, true);

  window.addEventListener("hashchange", () => {
    consumeMonitorRefresh();
    cleanupResolvedSheetsMessages();
  });

  const observer = new MutationObserver(() => {
    consumeMonitorRefresh();
    cleanupResolvedSheetsMessages();
  });
  const start = () => {
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    consumeMonitorRefresh();
    cleanupResolvedSheetsMessages();
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
  window.setInterval(cleanupResolvedSheetsMessages, 1200);
})();

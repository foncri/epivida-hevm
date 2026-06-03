(() => {
  "use strict";

  if (window.__epividaIaasSheetsPreventiveHotfix20260518) return;
  window.__epividaIaasSheetsPreventiveHotfix20260518 = true;

  const STORE_KEY = "epivida-iaas-os-v1";
  const IAAS_STATUSES = new Set(["NINGUNO", "NO IAAS", "RIESGO IAAS", "IAAS"]);
  const PREVENTIVE_CHECK_KEYS = {
    "REGISTRO REVISION DIARIA": "dailyReview",
    "CURACION ASEPTICA DE CATETER": "asepticDressing",
    "APERTURA CORRECTA EN CASO DE INTERRUMPIR CONEXION": "correctOpening",
    "CAMBIO SISTEMA DE INFUSION": "infusionSystemChange",
    "NOTA DE EVOLUCION VIGENTE": "evolutionNote",
    "CON MEMBRETE": "hasLabel",
    "DE ACUERDO A SEXO": "sexMatch",
    "HIGIENE GENITAL": "genitalHygiene",
    "DRENAJE SIN OBSTRUCCION": "unobstructedDrainage",
    "CORRECTO NIVEL BOLSA COLECTORA": "correctBagLevel",
    "SISTEMA SIN DESCONEXION": "closedSystem",
    "NOTA DE EVOLUCION": "evolutionNote",
    "REGISTRO CARACTERISTICAS DE LA ORINA": "urineCharacteristics",
    "REGISTRO DIAS DE INSTALACION": "installationDaysRecord",
    "INTUBACION ASEPTICA": "asepticIntubation",
    "POSICION ADECUADA DEL PACIENTE": "patientPosition",
    "REGISTRO DE POSIBLE INTERRUPCION DE SEDACION": "sedationInterruption",
    "REGISTRO DE POSIBLE RETIRO VM": "possibleRemoval",
    "ASPIRACION DE SECRECIONES CON CIRCUITO CERRADO": "closedSuction",
    "HIGIENE ORAL": "oralHygiene",
    "HUMEDAD ACTIVA/PASIVA": "humidity",
    "PROFILAXIS PREQUIRURGICA ADECUADA": "preSurgicalProphylaxis",
    "RASURADO ADECUADO PREQUIRURGICO": "preSurgicalHairRemoval",
    "MONITOREO GLUCEMICO": "glucoseMonitoring",
    "TEMPERATURA MAYOR A 35.5 C": "temperature",
    "HERIDA CON APOSITO": "dressing",
    "ASIGNACION MEDIDAS DE PRECAUCION": "precautionAssignment",
    "ACTUALIZACION MEDIDAS DE PRECAUCION": "precautionUpdate",
    "RETIRO MEDIDAS DE PRECAUCION": "precautionRemoval",
    INSUMOS: "supplies",
    EDUCACION: "education",
    "PRESCRIPCION Y ACCION CONGRUENTE": "congruentPrescription",
    "TARJETAS DE PRECAUCION ADECUADAS": "precautionCards"
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

  function decodeRoutePart(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function routePatient() {
    const match = String(location.hash || "").match(/^#\/(ronda|seguimiento-iaas)\/([^/]+)\/paciente\/([^/?#]+)/);
    return match ? { page: match[1], date: match[2], patientId: decodeRoutePart(match[3]) } : null;
  }

  function currentStore() {
    const exposed = window.__EPIVIDA_TEST__?.store;
    if (exposed && typeof exposed === "object") return exposed;
    return loadJson(STORE_KEY, {});
  }

  function syncExposedStore(store) {
    const exposed = window.__EPIVIDA_TEST__?.store;
    if (!exposed || exposed === store || typeof exposed !== "object") return;
    Object.keys(exposed).forEach(key => delete exposed[key]);
    Object.assign(exposed, store);
  }

  function persistStore(store) {
    store.lastSavedAt = nowIso();
    saveJson(STORE_KEY, store);
    syncExposedStore(store);
  }

  function normalizeIaasStatus(value) {
    const text = norm(value);
    if (!text) return "";
    if (text === "SIN IAAS") return "NO IAAS";
    if (text.includes("RIESGO") && text.includes("IAAS")) return "RIESGO IAAS";
    if (text.includes("NO") && text.includes("IAAS")) return "NO IAAS";
    if (text === "IAAS" || text.includes("IAAS CONFIRMADA") || text.includes("IAAS PROBABLE")) return "IAAS";
    if (text === "NINGUNO" || text === "SIN ETIQUETA") return "NINGUNO";
    return "";
  }

  function diagnosisFromStatus(status) {
    return status && status !== "NINGUNO" ? status : "";
  }

  function isOwnedIaasDiagnosis(value) {
    const text = norm(value);
    return IAAS_STATUSES.has(text) || ["SEGUIMIENTO IAAS", "VIGILANCIA IAAS", "DESCARTAR IAAS"].includes(text);
  }

  function addHistory(patient, date, status) {
    patient.iaasFollowUpHistory = Array.isArray(patient.iaasFollowUpHistory) ? patient.iaasFollowUpHistory : [];
    const entry = { date, status, updatedAt: nowIso(), month: String(date || "").slice(0, 7) };
    const index = patient.iaasFollowUpHistory.findIndex(item => item.date === date && norm(item.status) === status);
    if (index >= 0) patient.iaasFollowUpHistory[index] = { ...patient.iaasFollowUpHistory[index], ...entry };
    else patient.iaasFollowUpHistory.push(entry);
    patient.iaasFollowUpHistory.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function ensureCensusDate(store, date) {
    store.dailyCensus ||= {};
    store.dailyCensus[date] ||= {
      date,
      censusDate: date,
      importedAt: nowIso(),
      importedBy: "iaas-hotfix",
      status: "imported",
      patients: {},
      conflicts: []
    };
    store.dailyCensus[date].patients ||= {};
    return store.dailyCensus[date];
  }

  function ensureCensusRow(store, date, patientId, patient = {}) {
    const census = ensureCensusDate(store, date);
    const existing = census.patients[patientId] || {};
    census.patients[patientId] = {
      ...existing,
      patientId,
      roundDate: existing.roundDate || date,
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
      manualEntry: existing.manualEntry || !existing.importedFromFile,
      reviewStatus: existing.reviewStatus || "pendiente",
      syncStatus: "local_pending",
      notes: existing.notes || patient.observations || ""
    };
    return census.patients[patientId];
  }

  function ensureRoundEntry(store, date, patientId, row = {}, patient = {}) {
    store.dailyRounds ||= {};
    store.dailyRounds[date] ||= {
      date,
      status: "in_progress",
      startedAt: nowIso(),
      startedBy: "local-user",
      entries: {},
      totalPatients: 0,
      reviewedPatients: 0,
      pendingPatients: 0,
      incompletePatients: 0,
      activeAlerts: 0,
      localPendingWritesCount: 0,
      serverSyncedWritesCount: 0,
      errorWritesCount: 0
    };
    store.dailyRounds[date].entries ||= {};
    const existing = store.dailyRounds[date].entries[patientId] || {};
    store.dailyRounds[date].entries[patientId] = {
      entryId: patientId,
      patientId,
      service: existing.service || row.service || patient.currentService || "",
      bed: existing.bed || row.bed || patient.currentBed || "",
      reviewedBy: existing.reviewedBy || null,
      reviewedAt: existing.reviewedAt || null,
      roundDate: date,
      hasInvasives: Boolean(existing.hasInvasives),
      noInvasivesConfirmed: Boolean(existing.noInvasivesConfirmed),
      reviewedDevices: existing.reviewedDevices || [],
      pendingIssuesAdded: existing.pendingIssuesAdded || [],
      alertsGenerated: existing.alertsGenerated || [],
      status: existing.status || "pendiente",
      notes: existing.notes || "",
      ...existing,
      iaasFollowUpClassification: existing.iaasFollowUpClassification || "",
      syncStatus: "local_pending",
      updatedAt: nowIso(),
      updatedBy: "local-user"
    };
    return store.dailyRounds[date].entries[patientId];
  }

  function recalculateRound(store, date) {
    const round = store.dailyRounds?.[date];
    if (!round) return;
    const entries = Object.values(round.entries || {});
    round.totalPatients = entries.length;
    round.reviewedPatients = entries.filter(entry => ["revisado", "alerta"].includes(entry.status)).length;
    round.pendingPatients = entries.filter(entry => entry.status === "pendiente").length;
    round.incompletePatients = entries.filter(entry => entry.status === "incompleto").length;
    round.localPendingWritesCount = entries.filter(entry => entry.syncStatus === "local_pending").length;
    round.serverSyncedWritesCount = entries.filter(entry => entry.syncStatus === "server_synced").length;
    round.errorWritesCount = entries.filter(entry => entry.syncStatus === "error").length;
  }

  function queueClassificationWrite(store, date, patientId, patient, row) {
    store.writeQueue ||= [];
    const queueKey = `iaas-status:${date}:${patientId}`;
    const operation = {
      type: "patientUpdate",
      date,
      patientId,
      patient,
      censusRow: row || null,
      hotfixKey: queueKey,
      source: "iaas-classification-hotfix"
    };
    const existing = store.writeQueue.find(item => item.operation?.hotfixKey === queueKey && item.status !== "server_synced");
    if (existing) {
      existing.status = "local_pending";
      existing.error = "";
      existing.operation = operation;
      return;
    }
    store.writeQueue.push({
      id: `write-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: "local_pending",
      createdAt: nowIso(),
      operation
    });
  }

  function applyIaasClassification(store, date, patientId, rawStatus, options = {}) {
    const status = normalizeIaasStatus(rawStatus);
    if (!IAAS_STATUSES.has(status)) return false;
    store.patients ||= {};
    const patient = store.patients[patientId] ||= { patientId };
    const diagnosis = diagnosisFromStatus(status);
    const shouldCensus = Boolean(diagnosis);
    const existingRow = store.dailyCensus?.[date]?.patients?.[patientId] || null;
    const row = shouldCensus || existingRow ? ensureCensusRow(store, date, patientId, patient) : null;

    patient.iaasFollowUpStatus = status;
    patient.iaasFollowUpEnteredAt ||= nowIso();
    patient.iaasFollowUpSource ||= options.source || "iaas-classification";
    patient.iaasFollowUpUpdatedAt = nowIso();
    patient.iaasFollowUpManagedRisk = true;
    patient.riesgo_iaas = diagnosis;
    patient.updatedAt = nowIso();

    if (diagnosis) {
      patient.epidemiologicalDiagnosis = diagnosis;
      patient.currentEpidemiologicalDiagnosis = diagnosis;
    } else {
      if (isOwnedIaasDiagnosis(patient.epidemiologicalDiagnosis)) patient.epidemiologicalDiagnosis = null;
      if (isOwnedIaasDiagnosis(patient.currentEpidemiologicalDiagnosis)) patient.currentEpidemiologicalDiagnosis = null;
    }
    addHistory(patient, date, status);

    if (row) {
      row.riesgo_iaas = diagnosis;
      if (diagnosis) row.epidemiologicalDiagnosis = diagnosis;
      else if (isOwnedIaasDiagnosis(row.epidemiologicalDiagnosis)) row.epidemiologicalDiagnosis = null;
      row.syncStatus = "local_pending";
      row.present = row.present !== false;
    }

    const entry = ensureRoundEntry(store, date, patientId, row || {}, patient);
    entry.iaasFollowUpClassification = status;
    entry.activeRoundSection = "iaas";
    entry.syncStatus = "local_pending";
    recalculateRound(store, date);

    if (options.queue !== false) queueClassificationWrite(store, date, patientId, patient, row);
    return true;
  }

  function repairStoredClassifications() {
    const store = currentStore();
    let changed = false;
    Object.entries(store.dailyCensus || {}).forEach(([date, census]) => {
      Object.values(census?.patients || {}).forEach(row => {
        const patient = store.patients?.[row.patientId] || {};
        const status = normalizeIaasStatus(patient.iaasFollowUpStatus || patient.riesgo_iaas || row.riesgo_iaas);
        if (!status || status === "NINGUNO") return;
        if (!isOwnedIaasDiagnosis(patient.epidemiologicalDiagnosis) || !isOwnedIaasDiagnosis(row.epidemiologicalDiagnosis)) {
          changed = applyIaasClassification(store, date, row.patientId, status, { queue: false, source: "classification-migration" }) || changed;
        }
      });
    });
    if (changed) persistStore(store);
  }

  function applyQueuedOperation(store, operation = {}) {
    const patientId = operation.patientId || operation.entry?.patientId || operation.patient?.patientId;
    const date = operation.date || operation.entry?.roundDate || operation.censusRow?.roundDate;
    if (patientId && operation.patient) {
      store.patients ||= {};
      store.patients[patientId] = { ...(store.patients[patientId] || {}), ...operation.patient };
    }
    if (date && operation.census) {
      store.dailyCensus ||= {};
      store.dailyCensus[date] = { ...(store.dailyCensus[date] || {}), ...operation.census, patients: store.dailyCensus[date]?.patients || {} };
    }
    if (date && patientId && operation.censusRow) {
      const census = ensureCensusDate(store, date);
      census.patients[patientId] = { ...(census.patients[patientId] || {}), ...operation.censusRow, syncStatus: "local_pending" };
    }
    if (date && operation.round) {
      store.dailyRounds ||= {};
      store.dailyRounds[date] = { ...(store.dailyRounds[date] || {}), ...operation.round, entries: store.dailyRounds[date]?.entries || {} };
    }
    if (date && patientId && operation.entry) {
      store.dailyRounds ||= {};
      store.dailyRounds[date] ||= { date, status: "in_progress", entries: {} };
      store.dailyRounds[date].entries ||= {};
      store.dailyRounds[date].entries[patientId] = { ...(store.dailyRounds[date].entries[patientId] || {}), ...operation.entry, syncStatus: "local_pending" };
    }
    (operation.episodes || []).forEach(episode => {
      if (!episode?.episodeId) return;
      store.deviceEpisodes ||= {};
      store.deviceEpisodes[episode.episodeId] = { ...(store.deviceEpisodes[episode.episodeId] || {}), ...episode, syncStatus: "local_pending" };
    });
  }

  let repairingSheets = false;

  function repairSheetsConflict() {
    const test = window.__EPIVIDA_TEST__;
    const sheets = test?.ui?.sheets;
    if (!sheets || sheets.status !== "sync_conflict") return false;
    const detail = norm(`${sheets.error || ""} ${sheets.errorDetail || ""}`);
    const canRepair = /CAMBIOS LOCALES PREVIOS|HOJA TIENE CAMBIOS POSTERIORES|RECARGA SHEETS/.test(detail);
    if (!canRepair && window.EPIVIDA_SHEETS_CONFIG?.appAuthoritative !== true) return false;

    const store = currentStore();
    const queue = (store.writeQueue || []).filter(item => item.status !== "server_synced");
    queue.forEach(item => {
      item.status = "local_pending";
      item.error = "";
      applyQueuedOperation(store, item.operation || {});
    });
    repairStoredClassifications();
    persistStore(store);

    sheets.status = sheets.connected ? (queue.length ? "sync_pending" : "connected") : "disconnected";
    sheets.error = "";
    sheets.errorDetail = "";
    if (window.EPIVIDA_SHEETS_CONFIG?.appAuthoritative === true && queue.length) sheets.lastWriteId = "";
    document.querySelectorAll(".sheets-notice").forEach(node => {
      if (norm(node.textContent).includes("CONFLICTO")) node.remove();
    });

    if (!repairingSheets && sheets.connected && queue.length && navigator.onLine) {
      repairingSheets = true;
      window.setTimeout(() => {
        window.dispatchEvent(new Event("online"));
        window.setTimeout(() => { repairingSheets = false; }, 2500);
      }, 120);
    }
    return true;
  }

  function requestRender(delay = 0) {
    window.setTimeout(() => window.dispatchEvent(new Event("hashchange")), delay);
  }

  function handleClassificationChange(event) {
    const select = event.target?.closest?.("[data-iaas-ownership-status]");
    const route = routePatient();
    if (!select || route?.page !== "seguimiento-iaas") return;
    window.setTimeout(() => {
      const store = currentStore();
      if (applyIaasClassification(store, route.date, route.patientId, select.value, { source: "iaas-panel" })) {
        persistStore(store);
        requestRender(80);
      }
    }, 0);
  }

  function setButtonState(button, activeClass) {
    const row = button.parentElement;
    if (!row) return;
    row.querySelectorAll("button").forEach(item => {
      const selected = item === button;
      item.classList.toggle(activeClass, selected);
      item.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function updateCompliance(card) {
    const values = [...card.querySelectorAll(".check-selector")].map(selector =>
      norm(selector.querySelector("button.active, button.selected")?.textContent || "")
    ).filter(value => value === "SI" || value === "NO");
    const target = card.querySelector(".compliance-box strong");
    if (!target) return;
    if (!values.length) {
      target.textContent = "Pendiente";
      return;
    }
    const yes = values.filter(value => value === "SI").length;
    target.textContent = `${Math.round((yes / values.length) * 100)}%`;
  }

  function directLabel(container) {
    const direct = [...(container?.children || [])].find(child => child.tagName === "SPAN");
    return clean(direct?.textContent || container?.querySelector("span")?.textContent || "");
  }

  function preventiveRouteAndApi() {
    const route = routePatient();
    const api = window.__EPIVIDA_TEST__;
    if (route?.page !== "ronda" || !api?.getReviewDraft || !api?.updateDeviceDraft) return null;
    return { route, api };
  }

  function preserveViewport(action) {
    const x = window.scrollX;
    const y = window.scrollY;
    action();
    [0, 80, 220].forEach(delay => window.setTimeout(() => window.scrollTo(x, y), delay));
  }

  function handlePackageSelector(event, context) {
    const button = event.target?.closest?.(".patient-round .package-selector");
    if (!button || !context.api.addDeviceDraft) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const type = clean(button.textContent);
    preserveViewport(() => context.api.addDeviceDraft(context.route.date, context.route.patientId, type));
    return true;
  }

  function patchForButtonGroup(label, value, device = {}) {
    const key = norm(label);
    if (key.includes("METODO HIGIENE ORAL")) return { oralHygieneMethod: value };
    if (key.includes("TIPO DE INVASIVO")) return { deviceType: value, deviceSubtype: norm(value) === "CATT HD" ? (device.deviceSubtype || "") : "" };
    if (key.includes("TIPO CATT HD")) return { deviceSubtype: value };
    if (key === "FRENCH") return { french: value };
    if (key.includes("TIPO DE MATERIAL")) return { material: value };
    if (key === "ESTADO") return { deviceState: value };
    if (key.includes("TIPO DE DISPOSITIVO")) return { deviceType: value };
    if (key.includes("INVASIVO ESPECIAL")) return { deviceType: value };
    return null;
  }

  function groupNeedsRender(label, value, device = {}) {
    const key = norm(label);
    return key.includes("TIPO DE INVASIVO") && (norm(value) === "CATT HD" || norm(device.deviceType) === "CATT HD");
  }

  function handleDraftOption(event, context) {
    const button = event.target?.closest?.(".patient-round .package-draft .check-selector button, .patient-round .package-draft .button-group-field button");
    if (!button) return false;
    const card = button.closest(".package-draft");
    const cards = [...document.querySelectorAll(".patient-round .package-draft")];
    const index = cards.indexOf(card);
    if (!card || index < 0) return false;

    const draft = context.api.getReviewDraft(context.route.date, context.route.patientId);
    const device = draft.deviceDrafts?.[index] || {};
    let patch = null;
    let activeClass = "selected";
    let rerender = false;

    const check = button.closest(".check-selector");
    if (check) {
      const key = PREVENTIVE_CHECK_KEYS[norm(directLabel(check))];
      if (!key) return false;
      patch = { preventiveChecks: { ...(device.preventiveChecks || {}), [key]: clean(button.textContent) } };
      activeClass = "active";
    } else {
      const group = button.closest(".button-group-field");
      const label = directLabel(group);
      const value = clean(button.textContent);
      patch = patchForButtonGroup(label, value, device);
      rerender = groupNeedsRender(label, value, device);
    }

    if (!patch) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    setButtonState(button, activeClass);
    if (check) updateCompliance(card);

    const update = () => context.api.updateDeviceDraft(context.route.date, context.route.patientId, index, patch, rerender);
    if (rerender) preserveViewport(update);
    else update();
    return true;
  }

  function handlePreventiveClick(event) {
    const context = preventiveRouteAndApi();
    if (!context) return;
    if (handlePackageSelector(event, context)) return;
    handleDraftOption(event, context);
  }

  document.addEventListener("change", handleClassificationChange, true);
  document.addEventListener("click", handlePreventiveClick, true);
  let scheduledRepair = 0;
  function schedulePassiveRepair(delay = 220) {
    if (scheduledRepair) return;
    scheduledRepair = window.setTimeout(() => {
      scheduledRepair = 0;
      repairSheetsConflict();
      repairStoredClassifications();
    }, delay);
  }
  window.addEventListener("hashchange", () => {
    schedulePassiveRepair(80);
  });
  window.addEventListener("online", () => schedulePassiveRepair(120));

  const observer = new MutationObserver(() => schedulePassiveRepair(320));
  const start = () => {
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    repairStoredClassifications();
    repairSheetsConflict();
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
  window.setInterval(() => {
    const store = currentStore();
    const queue = (store.writeQueue || []).filter(item => item.status !== "server_synced");
    const status = window.__EPIVIDA_TEST__?.ui?.sheets?.status || "";
    if (queue.length || status === "sync_conflict") repairSheetsConflict();
  }, 5000);
})();

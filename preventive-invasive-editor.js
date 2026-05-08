(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const POST_SAVE_KEY = "epivida-preventive-post-save-v2";

  function routePatient() {
    const match = String(location.hash || "").match(/^#\/ronda\/([^/]+)\/paciente\/([^/]+)/);
    if (!match) return null;
    return { date: match[1], patientId: decodeURIComponent(match[2]) };
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function normalized(value) {
    return clean(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeDate(value) {
    const text = clean(value);
    if (!text || ["NA", "AMB"].includes(normalized(text))) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validIso(text) ? text : "";
    const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!match) return "";
    const yy = match[3].length === 2 ? Number(match[3]) : null;
    const year = yy === null ? match[3] : String(yy <= (new Date().getFullYear() % 100) + 1 ? 2000 + yy : 1900 + yy);
    const iso = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    return validIso(iso) ? iso : "";
  }

  function validIso(iso) {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isFinite(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === iso;
  }

  function displayDate(value) {
    const iso = normalizeDate(value);
    if (!iso) return clean(value);
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }

  function daysBetween(start, end) {
    const aIso = normalizeDate(start);
    const bIso = normalizeDate(end);
    if (!aIso || !bIso) return 0;
    const a = new Date(`${aIso}T00:00:00`);
    const b = new Date(`${bIso}T00:00:00`);
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  function mergeUnique(a, b) {
    return [...new Set([...(a || []), ...(b || [])].filter(Boolean))];
  }

  function deviceDisplayName(device = {}) {
    return [device.deviceType, device.deviceSubtype].map(clean).filter(Boolean).join(" - ") || device.packageType || "Dispositivo";
  }

  function activeEpisodes(store, patientId, date) {
    return Object.values(store.deviceEpisodes || {}).filter(ep => {
      const installed = normalizeDate(ep.installationDate);
      const removed = normalizeDate(ep.removalDate);
      return ep.patientId === patientId && installed && installed <= date && (!removed || removed >= date);
    });
  }

  function activeLabelForEpisode(episode, date) {
    const removed = normalizeDate(episode.removalDate);
    return removed && removed <= date ? "Retirado" : "Activo";
  }

  function episodeDays(episode, date) {
    const install = normalizeDate(episode.installationDate);
    if (!install) return "";
    const end = normalizeDate(episode.removalDate) || normalizeDate(date) || todayIso();
    const days = daysBetween(install, end);
    return `${days} dia${days === 1 ? "" : "s"}`;
  }

  function patientEpisodes(store, patientId, date) {
    return Object.values(store.deviceEpisodes || {})
      .filter(ep => ep.patientId === patientId)
      .sort((a, b) => {
        const aActive = activeLabelForEpisode(a, date) === "Activo";
        const bActive = activeLabelForEpisode(b, date) === "Activo";
        if (aActive !== bActive) return aActive ? -1 : 1;
        if (aActive) return daysBetween(b.installationDate, date) - daysBetween(a.installationDate, date);
        return String(normalizeDate(b.removalDate) || "").localeCompare(String(normalizeDate(a.removalDate) || ""));
      });
  }

  function ensureDailyRound(store, date) {
    store.dailyRounds ||= {};
    store.dailyRounds[date] ||= {
      date,
      status: "not_started",
      startedAt: null,
      startedBy: null,
      closedAt: null,
      closedBy: null,
      entries: {},
      totalPatients: 0,
      reviewedPatients: 0,
      pendingPatients: 0,
      incompletePatients: 0,
      reconciliationPatients: 0,
      activeAlerts: 0,
      localPendingWritesCount: 0,
      serverSyncedWritesCount: 0,
      errorWritesCount: 0
    };
  }

  function recalculateRound(store, date) {
    const round = store.dailyRounds?.[date];
    if (!round) return;
    const entries = Object.values(round.entries || {});
    round.totalPatients = entries.length;
    round.reviewedPatients = entries.filter(entry => ["revisado", "alerta"].includes(entry.status)).length;
    round.pendingPatients = entries.filter(entry => entry.status === "pendiente").length;
    round.incompletePatients = entries.filter(entry => entry.status === "incompleto").length;
    round.reconciliationPatients = Object.values(store.patients || {}).filter(patient => ["requiere_conciliacion", "alta_probable", "alta_reportada"].includes(patient.hospitalizationStatus)).length;
    round.activeAlerts = entries.filter(entry => entry.status === "alerta").length;
    round.localPendingWritesCount = entries.filter(entry => entry.syncStatus === "local_pending").length;
    round.serverSyncedWritesCount = entries.filter(entry => entry.syncStatus === "server_synced").length;
    round.errorWritesCount = entries.filter(entry => entry.syncStatus === "error").length;
    if (round.status === "not_started" && entries.some(entry => entry.status !== "pendiente")) round.status = "in_progress";
  }

  function addAudit(store, actionType, payload = {}) {
    store.auditLogs ||= [];
    store.auditLogs.push({
      logId: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowIso(),
      userId: "local-user",
      actionType,
      ...payload
    });
  }

  function flash(message, tone = "ok") {
    const toast = document.createElement("div");
    toast.className = `toast iaas-toast ${tone}`;
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function fieldNode(labelText, input) {
    const label = document.createElement("label");
    label.className = "preventive-editor-field";
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(span, input);
    return label;
  }

  function textInput(value = "", name = "") {
    const input = document.createElement("input");
    input.type = "text";
    input.name = name;
    input.value = clean(value);
    return input;
  }

  function dateInput(value = "", name = "") {
    const input = document.createElement("input");
    input.type = "date";
    input.name = name;
    input.value = normalizeDate(value);
    return input;
  }

  function selectInput(value = "", name = "") {
    const select = document.createElement("select");
    select.name = name;
    ["Activo", "Retirado"].forEach(optionValue => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      if (normalized(optionValue) === normalized(value)) option.selected = true;
      select.append(option);
    });
    return select;
  }

  function queueEpisodeEdit(store, route, patient, episode, before) {
    ensureDailyRound(store, route.date);
    const previousEntry = store.dailyRounds[route.date]?.entries?.[route.patientId] || {};
    const row = store.dailyCensus?.[route.date]?.patients?.[route.patientId] || {};
    const entry = {
      ...previousEntry,
      entryId: route.patientId,
      patientId: route.patientId,
      service: patient.currentService || row.service || previousEntry.service || "",
      bed: patient.currentBed || row.bed || previousEntry.bed || "",
      reviewedBy: previousEntry.reviewedBy || "local-user",
      reviewedAt: previousEntry.reviewedAt || nowIso(),
      roundDate: route.date,
      hasInvasives: activeEpisodes(store, route.patientId, route.date).length > 0,
      reviewedDevices: mergeUnique(previousEntry.reviewedDevices || [], [episode.episodeId]),
      pendingIssuesAdded: previousEntry.pendingIssuesAdded || [],
      alertsGenerated: previousEntry.alertsGenerated || [],
      status: previousEntry.status || "pendiente",
      syncStatus: "local_pending",
      localSavedAt: nowIso(),
      serverConfirmedAt: null,
      notes: previousEntry.notes || "",
      activeRoundSection: "preventive",
      packageReviews: previousEntry.packageReviews || [],
      iaasAssessment: previousEntry.iaasAssessment || null,
      iaasAssessmentHistory: Array.isArray(previousEntry.iaasAssessmentHistory) ? previousEntry.iaasAssessmentHistory : [],
      iaasAssessmentUpdatedAt: previousEntry.iaasAssessmentUpdatedAt || null,
      updatedAt: nowIso(),
      updatedBy: "local-user"
    };
    store.dailyRounds[route.date].entries[route.patientId] = entry;
    addAudit(store, "DEVICE_EPISODE_EDITED", {
      patientId: route.patientId,
      deviceEpisodeId: episode.episodeId,
      roundDate: route.date,
      before,
      after: episode
    });
    store.writeQueue ||= [];
    store.writeQueue.push({
      id: `write-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: "local_pending",
      createdAt: nowIso(),
      operation: { type: "roundEntry", date: route.date, patientId: route.patientId, entry, patient, episodes: [episode] }
    });
    recalculateRound(store, route.date);
    store.lastSavedAt = nowIso();
  }

  function saveEpisodeEdit(episodeId, form) {
    const route = routePatient();
    if (!route) return;
    const store = loadJson(STORE_KEY, {});
    store.patients ||= {};
    store.dailyCensus ||= {};
    store.dailyRounds ||= {};
    store.deviceEpisodes ||= {};
    store.auditLogs ||= [];
    const patient = store.patients[route.patientId];
    const episode = store.deviceEpisodes[episodeId];
    if (!patient || !episode) {
      flash("No encontre este invasivo en la base local. Recarga la pagina e intenta de nuevo.", "error");
      return;
    }
    const before = { ...episode };
    const install = normalizeDate(form.elements.installationDate?.value);
    const removal = normalizeDate(form.elements.removalDate?.value);
    const selectedStatus = normalized(form.elements.status?.value);
    episode.deviceType = clean(form.elements.deviceType?.value) || episode.deviceType || "Dispositivo";
    episode.deviceSubtype = clean(form.elements.deviceSubtype?.value) || null;
    episode.french = clean(form.elements.french?.value) || null;
    episode.preventivePackage = clean(form.elements.preventivePackage?.value) || episode.preventivePackage || null;
    episode.installationDate = install || episode.installationDate || todayIso();
    episode.removalDate = removal || null;
    episode.status = removal || selectedStatus === "RETIRADO" ? "retirado" : "activo";
    if (episode.status === "retirado" && !episode.removalDate) episode.removalDate = normalizeDate(route.date) || todayIso();
    episode.notes = clean(form.elements.notes?.value);
    episode.observations = episode.notes;
    episode.updatedAt = nowIso();
    episode.updatedBy = "local-user";
    episode.syncStatus = "local_pending";
    episode.patientName = episode.patientName || patient.patientName || "";
    queueEpisodeEdit(store, route, patient, episode, before);
    saveJson(STORE_KEY, store);
    sessionStorage.setItem(POST_SAVE_KEY, JSON.stringify({
      savedAt: nowIso(),
      targetHash: "",
      message: "Invasivo actualizado. Si Sheets esta conectado, se sincronizara automaticamente."
    }));
    flash("Invasivo actualizado. Actualizando la vista...");
    window.setTimeout(() => location.reload(), 120);
  }

  function renderEpisodeEditorCard(episode, route) {
    const details = document.createElement("details");
    details.className = "preventive-invasive-editor iaas-history-card";
    const status = activeLabelForEpisode(episode, route.date);
    const summary = document.createElement("summary");
    summary.className = "preventive-invasive-summary";
    const name = document.createElement("strong");
    name.textContent = deviceDisplayName(episode);
    const meta = document.createElement("span");
    meta.textContent = [
      episode.preventivePackage || "Paquete no registrado",
      episode.french ? `French ${episode.french}` : "French S/D",
      `Instalacion ${displayDate(episode.installationDate) || "S/D"}`,
      episode.removalDate ? `Retiro ${displayDate(episode.removalDate)}` : "Sin retiro",
      episodeDays(episode, route.date)
    ].filter(Boolean).join(" | ");
    const badge = document.createElement("em");
    badge.textContent = status;
    badge.className = normalized(status) === "ACTIVO" ? "active" : "removed";
    summary.append(name, meta, badge);
    const form = document.createElement("form");
    form.className = "preventive-invasive-form";
    form.addEventListener("submit", event => {
      event.preventDefault();
      saveEpisodeEdit(episode.episodeId, form);
    });
    const notes = document.createElement("textarea");
    notes.name = "notes";
    notes.value = clean(episode.notes || episode.observations);
    notes.rows = 3;
    form.append(
      fieldNode("Tipo de invasivo", textInput(episode.deviceType, "deviceType")),
      fieldNode("Subtipo", textInput(episode.deviceSubtype, "deviceSubtype")),
      fieldNode("French", textInput(episode.french, "french")),
      fieldNode("Paquete", textInput(episode.preventivePackage, "preventivePackage")),
      fieldNode("Fecha de instalacion", dateInput(episode.installationDate, "installationDate")),
      fieldNode("Fecha de retiro", dateInput(episode.removalDate, "removalDate")),
      fieldNode("Estado", selectInput(status, "status")),
      fieldNode("Observaciones", notes)
    );
    const actions = document.createElement("div");
    actions.className = "preventive-invasive-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "iaas-button primary";
    save.textContent = "Guardar cambios del invasivo";
    actions.append(save);
    form.append(actions);
    details.append(summary, form);
    return details;
  }

  function renderInvasiveHistoryEditor() {
    const route = routePatient();
    if (!route) return;
    const root = document.querySelector(".patient-round");
    if (!root) return;
    root.querySelector(":scope > .preventive-invasive-history")?.remove();
    const store = loadJson(STORE_KEY, {});
    const episodes = patientEpisodes(store, route.patientId, route.date);
    const details = document.createElement("details");
    details.className = "iaas-study-history preventive-invasive-history";
    const summary = document.createElement("summary");
    summary.textContent = `Historial y edicion de invasivos (${episodes.length})`;
    details.append(summary);
    if (!episodes.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Sin invasivos registrados para este paciente.";
      details.append(empty);
    } else {
      const list = document.createElement("div");
      list.className = "iaas-history-list preventive-invasive-list";
      episodes.forEach(episode => list.append(renderEpisodeEditorCard(episode, route)));
      details.append(list);
    }
    const packagePanel = [...root.querySelectorAll(":scope > .iaas-panel")]
      .find(panel => normalized(panel.querySelector("h2")?.textContent).includes("AGREGAR PAQUETE PREVENTIVO"));
    const saveBar = root.querySelector(":scope > .round-save-bar");
    if (packagePanel) packagePanel.after(details);
    else if (saveBar) saveBar.before(details);
    else root.append(details);
  }

  function scheduleRender() {
    [0, 80, 250, 700].forEach(delay => window.setTimeout(renderInvasiveHistoryEditor, delay));
  }

  window.addEventListener("hashchange", scheduleRender);
  document.addEventListener("click", event => {
    if (!routePatient()) return;
    if (event.target.closest?.(".patient-round .package-selector, .patient-round .package-draft button, .patient-round .compact-device-card input")) {
      scheduleRender();
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRender, { once: true });
  } else {
    scheduleRender();
  }
})();

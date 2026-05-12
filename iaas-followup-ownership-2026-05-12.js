(() => {
  "use strict";

  if (window.__epividaIaasFollowupOwnership) return;
  window.__epividaIaasFollowupOwnership = true;

  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const POST_SAVE_KEY = "epivida-iaas-post-save-v1";
  const IAAS_STATUSES = ["NINGUNO", "NO IAAS", "RIESGO IAAS", "IAAS"];
  const HISTORY_FILTERS = ["TODOS", "NINGUNO", "NO IAAS", "RIESGO IAAS", "IAAS", "RIESGO IAAS + IAAS", "NO IAAS + RIESGO IAAS", "BASE PACIENTES"];

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const nowIso = () => new Date().toISOString();
  const load = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  };
  const loadSession = (key, fallback) => {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  function route() {
    const hash = String(location.hash || "");
    let match = hash.match(/^#\/seguimiento-iaas\/([^/]+)\/paciente\/([^/]+)/);
    if (match) return { page: "seguimiento-iaas", section: "iaas", date: match[1], patientId: decodeURIComponent(match[2]) };
    match = hash.match(/^#\/ronda\/([^/]+)\/paciente\/([^/]+)/);
    if (match) return { page: "ronda", section: "preventive", date: match[1], patientId: decodeURIComponent(match[2]) };
    if (hash === "#/seguimiento-iaas") return { page: "seguimiento-iaas", section: "hub", date: activeDate() };
    return null;
  }

  function activeDate() {
    const hashDate = String(location.hash || "").match(/^#\/(?:ronda|seguimiento-iaas)\/([^/]+)/)?.[1];
    if (hashDate) return hashDate;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function displayDate(value) {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : clean(value);
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
    return key;
  }

  function patientIdFromHref(href) {
    const match = String(href || "").match(/\/paciente\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function patientRow(store, date, patientId) {
    return store.dailyCensus?.[date]?.patients?.[patientId] || {};
  }

  function patientRecord(store, patientId) {
    store.patients ||= {};
    store.patients[patientId] ||= { patientId };
    return store.patients[patientId];
  }

  function isAmbulatory(store, date, patientId) {
    const patient = store.patients?.[patientId] || {};
    const row = patientRow(store, date, patientId);
    return canonicalService(patient.currentService || row.service || "") === "AMBULATORIO";
  }

  function riskText(store, date, patientId) {
    const patient = store.patients?.[patientId] || {};
    const row = patientRow(store, date, patientId);
    return `${patient.iaasFollowUpStatus || ""} ${patient.riesgo_iaas || ""} ${patient.epiText || ""} ${row.riesgo_iaas || ""} ${row.epiText || ""} ${row.diagnostico_epidemiologico || ""}`;
  }

  function iaasCandidate(store, date, patientId) {
    if (isAmbulatory(store, date, patientId)) return false;
    const status = norm(store.patients?.[patientId]?.iaasFollowUpStatus || "");
    if (status && status !== "NINGUNO") return true;
    return norm(riskText(store, date, patientId)).includes("IAAS");
  }

  function getCensusRows(store, date) {
    return Object.values(store.dailyCensus?.[date]?.patients || {});
  }

  function serviceBedSort(a, b) {
    return String(a.service || "").localeCompare(String(b.service || ""), "es", { numeric: true })
      || String(a.bed || "").localeCompare(String(b.bed || ""), "es", { numeric: true });
  }

  function iaasRows(store, date) {
    return getCensusRows(store, date)
      .filter(row => row.patientId && iaasCandidate(store, date, row.patientId))
      .sort(serviceBedSort);
  }

  function activeEpisodes(store, patientId, date) {
    return Object.values(store.deviceEpisodes || {}).filter(ep => {
      if (ep.patientId !== patientId) return false;
      const installed = clean(ep.installationDate);
      const removed = clean(ep.removalDate);
      return (!installed || installed <= date) && (!removed || removed > date) && ep.status !== "retirado";
    });
  }

  function ensureDailyRound(store, date) {
    store.dailyRounds ||= {};
    store.dailyRounds[date] ||= {
      date,
      status: "in_progress",
      startedAt: nowIso(),
      startedBy: "local-user",
      closedAt: null,
      closedBy: null,
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
  }

  function recalculateRound(store, date) {
    const round = store.dailyRounds?.[date];
    if (!round) return;
    const entries = Object.values(round.entries || {});
    round.totalPatients = entries.length;
    round.reviewedPatients = entries.filter(entry => ["revisado", "alerta"].includes(entry.status)).length;
    round.pendingPatients = entries.filter(entry => entry.status === "pendiente").length;
    round.incompletePatients = entries.filter(entry => entry.status === "incompleto").length;
    round.activeAlerts = entries.filter(entry => entry.status === "alerta").length;
    round.localPendingWritesCount = entries.filter(entry => entry.syncStatus === "local_pending").length;
    round.serverSyncedWritesCount = entries.filter(entry => entry.syncStatus === "server_synced").length;
    round.errorWritesCount = entries.filter(entry => entry.syncStatus === "error").length;
    if (round.status === "not_started") round.status = "in_progress";
  }

  function requestedStatus(button) {
    const text = norm(button?.textContent);
    if (text.includes("INCOMPLETO")) return "incompleto";
    if (text.includes("PENDIENTE")) return "pendiente";
    return "revisado";
  }

  function navigationIntent(button) {
    const text = norm(button?.textContent);
    if (text.includes("SIGUIENTE")) return "next";
    if (text.includes("ANTERIOR")) return "previous";
    return "";
  }

  function flash(message, tone = "ok") {
    document.querySelectorAll(".iaas-toast").forEach(toast => toast.remove());
    const toast = document.createElement("div");
    toast.className = `toast iaas-toast ${tone}`;
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2800);
  }

  function installStyle() {
    if (document.getElementById("epivida-iaas-followup-ownership-style")) return;
    const style = document.createElement("style");
    style.id = "epivida-iaas-followup-ownership-style";
    style.textContent = `
      .iaas-ownership-panel { border: 2px solid rgba(88,80,236,.28) !important; }
      .iaas-ownership-grid { display: grid; grid-template-columns: minmax(220px, 360px) 1fr; gap: 14px; align-items: end; }
      .iaas-ownership-grid label { display: grid; gap: 6px; font-weight: 800; color: #10204a; }
      .iaas-ownership-grid select, .iaas-history-controls select, .iaas-history-controls input { min-height: 38px; border: 1px solid rgba(185,196,220,.95); border-radius: 999px; padding: 0 12px; background: #fff; color: #10204a; font: inherit; font-weight: 800; }
      .iaas-ownership-note { color: #4d5b78; font-weight: 700; }
      .iaas-history-panel { margin-top: 18px; }
      .iaas-history-panel summary { cursor: pointer; font-weight: 900; color: #10204a; }
      .iaas-history-controls { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; align-items: center; }
      .iaas-history-list { display: grid; gap: 8px; }
      .iaas-history-row { display: grid; grid-template-columns: 96px 1fr 150px 160px; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid rgba(185,196,220,.75); border-radius: 8px; background: #fff; color: #10204a; }
      .iaas-history-row strong { font-size: .95rem; }
      .iaas-history-row span, .iaas-history-row small { color: #4d5b78; font-weight: 700; }
      @media (max-width: 820px) { .iaas-ownership-grid, .iaas-history-row { grid-template-columns: 1fr; } }
    `;
    document.head.append(style);
  }

  function currentClassification(store, date, patientId) {
    const patient = store.patients?.[patientId] || {};
    const entry = store.dailyRounds?.[date]?.entries?.[patientId] || {};
    const drafts = load(DRAFT_KEY, {});
    const draft = drafts[`${date}:${patientId}`] || {};
    const value = norm(draft.iaasFollowUpClassification || entry.iaasFollowUpClassification || patient.iaasFollowUpStatus || "");
    return IAAS_STATUSES.includes(value) ? value : "";
  }

  function saveDraftClassification(date, patientId, status) {
    const drafts = load(DRAFT_KEY, {});
    const key = `${date}:${patientId}`;
    drafts[key] = { ...(drafts[key] || {}), activeRoundSection: "iaas", iaasFollowUpClassification: status };
    save(DRAFT_KEY, drafts);
  }

  function ensureClassificationPanel() {
    const current = route();
    if (current?.section !== "iaas") return;
    const target = document.querySelector(".patient-round .iaas-assessment-panel") || document.querySelector(".patient-round .round-save-bar");
    if (!target || document.querySelector(".iaas-ownership-panel")) return;
    const store = load(STORE_KEY, {});
    const selected = currentClassification(store, current.date, current.patientId);
    const panel = document.createElement("section");
    panel.className = "iaas-panel iaas-ownership-panel";
    panel.innerHTML = `
      <div class="iaas-panel-head compact">
        <div>
          <h2>Ingreso a Seguimiento IAAS</h2>
          <p>Clasificacion obligatoria para tomar al paciente dentro del seguimiento epidemiologico.</p>
        </div>
        <span class="badge epi-iaas">IAAS</span>
      </div>
      <div class="iaas-ownership-grid">
        <label>
          <span>Clasificacion inicial</span>
          <select data-iaas-ownership-status required>
            <option value="">Seleccionar estado IAAS</option>
            ${IAAS_STATUSES.map(status => `<option value="${status}">${status}</option>`).join("")}
          </select>
        </label>
        <div class="iaas-ownership-note">Debe seleccionarse antes de guardar el seguimiento IAAS.</div>
      </div>
    `;
    target.before(panel);
    const select = panel.querySelector("[data-iaas-ownership-status]");
    select.value = selected;
    select.addEventListener("change", () => saveDraftClassification(current.date, current.patientId, select.value));
  }

  function statusFromPanel(date, patientId) {
    const selected = norm(document.querySelector("[data-iaas-ownership-status]")?.value || "");
    if (IAAS_STATUSES.includes(selected)) return selected;
    return currentClassification(load(STORE_KEY, {}), date, patientId);
  }

  function addHistory(patient, date, status) {
    patient.iaasFollowUpHistory = Array.isArray(patient.iaasFollowUpHistory) ? patient.iaasFollowUpHistory : [];
    const entry = {
      date,
      status,
      updatedAt: nowIso(),
      month: date.slice(0, 7)
    };
    const index = patient.iaasFollowUpHistory.findIndex(item => item.date === date && norm(item.status) === status);
    if (index >= 0) patient.iaasFollowUpHistory[index] = { ...patient.iaasFollowUpHistory[index], ...entry };
    else patient.iaasFollowUpHistory.push(entry);
    patient.iaasFollowUpHistory.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function applyClassification(store, date, patientId, status) {
    const patient = patientRecord(store, patientId);
    const row = patientRow(store, date, patientId);
    patient.iaasFollowUpStatus = status;
    patient.iaasFollowUpUpdatedAt = nowIso();
    patient.iaasFollowUpManagedRisk = true;
    addHistory(patient, date, status);
    const riskValue = status === "NINGUNO" ? "" : status;
    patient.riesgo_iaas = riskValue;
    if (row && Object.keys(row).length) {
      row.riesgo_iaas = riskValue;
      row.syncStatus = "local_pending";
    }
  }

  function markForIaasFollowUp(date, patientId) {
    const store = load(STORE_KEY, {});
    const patient = patientRecord(store, patientId);
    const row = patientRow(store, date, patientId);
    patient.iaasFollowUpEnteredAt ||= nowIso();
    patient.iaasFollowUpSource ||= "preventive_redirect";
    if (!norm(patient.iaasFollowUpStatus)) patient.iaasFollowUpStatus = "";
    if (!norm(`${patient.riesgo_iaas || ""} ${row.riesgo_iaas || ""}`).includes("IAAS")) {
      patient.riesgo_iaas = "SEGUIMIENTO IAAS";
      patient.iaasFollowUpManagedRisk = true;
      if (row && Object.keys(row).length) row.riesgo_iaas = "SEGUIMIENTO IAAS";
    }
    patient.updatedAt = nowIso();
    store.lastSavedAt = nowIso();
    save(STORE_KEY, store);
  }

  function mergeAssessmentHistory(previousEntry, assessment) {
    const history = Array.isArray(previousEntry.iaasAssessmentHistory) ? previousEntry.iaasAssessmentHistory.slice(-19) : [];
    if (previousEntry.iaasAssessment) {
      history.push({
        date: previousEntry.roundDate,
        editedAt: previousEntry.iaasAssessmentUpdatedAt || previousEntry.reviewedAt || nowIso(),
        assessment: previousEntry.iaasAssessment
      });
    }
    return assessment ? history.slice(-20) : history;
  }

  function targetHashAfterSave(store, date, patientId, direction) {
    if (!direction) return "";
    const rows = iaasRows(store, date);
    const index = rows.findIndex(row => row.patientId === patientId);
    if (index < 0) return "#/seguimiento-iaas";
    const next = rows[direction === "next" ? index + 1 : index - 1];
    return next?.patientId ? `#/seguimiento-iaas/${date}/paciente/${encodeURIComponent(next.patientId)}` : "#/seguimiento-iaas";
  }

  function saveIaasDirectly(button) {
    const current = route();
    if (current?.section !== "iaas") return false;
    const classification = statusFromPanel(current.date, current.patientId);
    if (!IAAS_STATUSES.includes(classification)) {
      flash("Selecciona obligatoriamente NINGUNO, NO IAAS, RIESGO IAAS o IAAS antes de guardar.", "error");
      document.querySelector("[data-iaas-ownership-status]")?.focus();
      return true;
    }

    const store = load(STORE_KEY, {});
    const drafts = load(DRAFT_KEY, {});
    const draftKey = `${current.date}:${current.patientId}`;
    const draft = { activeRoundSection: "iaas", ...(drafts[draftKey] || {}) };
    ensureDailyRound(store, current.date);
    const patient = patientRecord(store, current.patientId);
    const row = patientRow(store, current.date, current.patientId);
    const previousEntry = store.dailyRounds[current.date].entries[current.patientId] || {};
    const episodes = activeEpisodes(store, current.patientId, current.date);
    const assessment = draft.iaasAssessment || previousEntry.iaasAssessment || null;
    applyClassification(store, current.date, current.patientId, classification);

    const status = requestedStatus(button);
    const entry = {
      ...previousEntry,
      entryId: current.patientId,
      patientId: current.patientId,
      service: patient.currentService || row.service || previousEntry.service || "",
      bed: patient.currentBed || row.bed || previousEntry.bed || "",
      reviewedBy: "local-user",
      reviewedAt: nowIso(),
      roundDate: current.date,
      hasInvasives: episodes.length > 0,
      noInvasivesConfirmed: previousEntry.noInvasivesConfirmed || false,
      reviewedDevices: [...new Set([...(previousEntry.reviewedDevices || []), ...episodes.map(ep => ep.episodeId)])],
      pendingIssuesAdded: previousEntry.pendingIssuesAdded || [],
      alertsGenerated: previousEntry.alertsGenerated || [],
      status,
      syncStatus: "local_pending",
      localSavedAt: nowIso(),
      serverConfirmedAt: null,
      notes: draft.notes || previousEntry.notes || "",
      activeRoundSection: "iaas",
      packageReviews: previousEntry.packageReviews || [],
      iaasAssessment: assessment,
      iaasAssessmentHistory: mergeAssessmentHistory(previousEntry, assessment),
      iaasAssessmentUpdatedAt: nowIso(),
      iaasFollowUpClassification: classification,
      updatedAt: nowIso(),
      updatedBy: "local-user"
    };
    store.dailyRounds[current.date].entries[current.patientId] = entry;
    if (row && Object.keys(row).length) {
      row.reviewStatus = status;
      row.reviewedAt = entry.reviewedAt;
      row.syncStatus = "local_pending";
    }
    patient.latestRoundDate = current.date;
    patient.latestRoundStatus = status;
    patient.updatedAt = nowIso();
    patient.updatedBy = "local-user";
    store.auditLogs ||= [];
    store.auditLogs.push({
      logId: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: nowIso(),
      userId: "local-user",
      actionType: "IAAS_FOLLOWUP_SAVED",
      patientId: current.patientId,
      roundDate: current.date,
      after: entry
    });
    store.writeQueue ||= [];
    store.writeQueue.push({
      id: `write-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: "local_pending",
      createdAt: nowIso(),
      operation: { type: "roundEntry", date: current.date, patientId: current.patientId, entry, patient, episodes: [] }
    });
    delete drafts[draftKey];
    recalculateRound(store, current.date);
    store.lastSavedAt = nowIso();
    save(DRAFT_KEY, drafts);
    save(STORE_KEY, store);

    const targetHash = targetHashAfterSave(store, current.date, current.patientId, navigationIntent(button));
    sessionStorage.setItem(POST_SAVE_KEY, JSON.stringify({ message: "Seguimiento IAAS guardado localmente.", targetHash }));
    flash("Seguimiento IAAS guardado. Actualizando vista...", "ok");
    window.setTimeout(() => {
      if (targetHash && location.hash !== targetHash) location.hash = targetHash;
      location.reload();
    }, 120);
    return true;
  }

  function emergencyLabel(value) {
    const key = norm(value).replace(/\s+/g, "");
    if (key === "AISLADOP" || key === "AISP") return "AIS P";
    if (key === "AISLADO1" || key === "AIS1") return "AIS 1 UX";
    if (key === "AISLADO2" || key === "AIS2") return "AIS 2 UX";
    if (key === "CHOQUE") return "CH";
    return "";
  }

  function cleanupVisibleUi() {
    cleanupNode(document);
  }

  function cleanupNode(root) {
    if (!root?.querySelectorAll) return;
    const current = route();
    const store = load(STORE_KEY, {});
    const date = current?.date || activeDate();
    const filterRoots = [];
    if (root.matches?.(".round-service-filter")) filterRoots.push(root);
    root.querySelectorAll(".round-service-filter").forEach(filter => filterRoots.push(filter));
    filterRoots.forEach(filter => {
      filter.querySelectorAll("button").forEach(button => {
        if (canonicalService(button.textContent || button.title || "") === "AMBULATORIO") button.remove();
      });
      filter.querySelectorAll("select option").forEach(option => {
        if (canonicalService(option.value || option.textContent) === "AMBULATORIO") option.remove();
      });
    });
    root.querySelectorAll(".round-service-filter button").forEach(button => {
      if (canonicalService(button.textContent || button.title || "") === "AMBULATORIO") button.remove();
    });
    root.querySelectorAll(".round-add-bed-form select option").forEach(option => {
      if (canonicalService(option.value || option.textContent) === "AMBULATORIO") option.remove();
    });
    root.querySelectorAll(".bed-tile strong").forEach(label => {
      const next = emergencyLabel(label.textContent);
      if (next) label.textContent = next;
    });
    root.querySelectorAll('.bed-board .bed-tile[href*="/paciente/"], .round-nav-board .bed-tile[href*="/paciente/"]').forEach(tile => {
      const patientId = patientIdFromHref(tile.getAttribute("href"));
      if (patientId && isAmbulatory(store, date, patientId)) tile.remove();
    });
    root.querySelectorAll(".iaas-follow-card").forEach(card => {
      const patientId = patientIdFromHref(card.querySelector('a[href*="/paciente/"]')?.getAttribute("href"));
      if (patientId && isAmbulatory(store, date, patientId)) card.remove();
    });
    root.querySelectorAll(".bed-board").forEach(board => {
      const tiles = [...board.querySelectorAll(".bed-board-grid .bed-tile")];
      const spans = board.querySelectorAll(".bed-board-totals span");
      if (spans[0]) spans[0].textContent = `${tiles.length} cama(s)`;
      if (spans[1]) spans[1].textContent = `${tiles.filter(tile => tile.classList.contains("reviewed")).length} vistas`;
    });
  }

  function patientName(store, patientId) {
    const patient = store.patients?.[patientId] || {};
    return clean(patient.patientName || patient.name || patient.fullName || patientId);
  }

  function combinedCategory(statuses) {
    const set = new Set(statuses.map(norm));
    if (set.has("RIESGO IAAS") && set.has("IAAS")) return "RIESGO IAAS + IAAS";
    if (set.has("NO IAAS") && set.has("RIESGO IAAS")) return "NO IAAS + RIESGO IAAS";
    if (set.has("IAAS")) return "IAAS";
    if (set.has("RIESGO IAAS")) return "RIESGO IAAS";
    if (set.has("NO IAAS")) return "NO IAAS";
    if (set.has("NINGUNO")) return "BASE PACIENTES";
    return "";
  }

  function collectHistory(store) {
    const rows = [];
    Object.entries(store.patients || {}).forEach(([patientId, patient]) => {
      const history = Array.isArray(patient.iaasFollowUpHistory) ? patient.iaasFollowUpHistory : [];
      const statuses = history.map(item => norm(item.status)).filter(Boolean);
      if (patient.iaasFollowUpStatus) statuses.push(norm(patient.iaasFollowUpStatus));
      const category = combinedCategory(statuses);
      history.forEach(item => {
        const status = norm(item.status);
        if (!IAAS_STATUSES.includes(status)) return;
        rows.push({
          patientId,
          patientName: patientName(store, patientId),
          date: clean(item.date || item.updatedAt?.slice(0, 10)),
          month: clean(item.month || item.date?.slice(0, 7) || item.updatedAt?.slice(0, 7)),
          status,
          category,
          service: clean(patient.currentService),
          bed: clean(patient.currentBed)
        });
      });
    });
    Object.entries(store.dailyRounds || {}).forEach(([date, round]) => {
      Object.values(round.entries || {}).forEach(entry => {
        const status = norm(entry.iaasFollowUpClassification);
        if (!IAAS_STATUSES.includes(status)) return;
        rows.push({
          patientId: entry.patientId,
          patientName: patientName(store, entry.patientId),
          date,
          month: date.slice(0, 7),
          status,
          category: combinedCategory([status]),
          service: clean(entry.service),
          bed: clean(entry.bed)
        });
      });
    });
    const seen = new Set();
    return rows.filter(row => {
      const key = `${row.patientId}|${row.date}|${row.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(row.date);
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.patientName.localeCompare(b.patientName, "es"));
  }

  function historyMatches(row, filter) {
    if (filter === "TODOS") return row.status !== "NINGUNO";
    if (filter === "BASE PACIENTES") return row.status === "NINGUNO" || row.category === "BASE PACIENTES";
    if (filter.includes("+")) return row.category === filter;
    return row.status === filter;
  }

  const nativeReplaceChildren = Element.prototype.replaceChildren;
  const nativeAppend = Element.prototype.append;
  const nativePrepend = Element.prototype.prepend;
  let internalDomPatch = false;

  function cleanupIncoming(nodes) {
    if (internalDomPatch) return;
    nodes.forEach(node => {
      if (node?.nodeType === Node.ELEMENT_NODE || node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE) cleanupNode(node);
    });
  }

  Element.prototype.replaceChildren = function epividaIaasReplaceChildren(...nodes) {
    cleanupIncoming(nodes);
    internalDomPatch = true;
    try {
      return nativeReplaceChildren.apply(this, nodes);
    } finally {
      internalDomPatch = false;
    }
  };

  Element.prototype.append = function epividaIaasAppend(...nodes) {
    cleanupIncoming(nodes);
    internalDomPatch = true;
    try {
      return nativeAppend.apply(this, nodes);
    } finally {
      internalDomPatch = false;
    }
  };

  Element.prototype.prepend = function epividaIaasPrepend(...nodes) {
    cleanupIncoming(nodes);
    internalDomPatch = true;
    try {
      return nativePrepend.apply(this, nodes);
    } finally {
      internalDomPatch = false;
    }
  };

  function renderHistoryPanel() {
    const current = route();
    if (current?.section !== "hub") return;
    const host = document.querySelector(".follow-up-hub") || document.querySelector(".iaas-page");
    if (!host) return;
    document.querySelector(".iaas-history-panel")?.remove();
    const store = load(STORE_KEY, {});
    const rows = collectHistory(store);
    const months = [...new Set(rows.map(row => row.month).filter(Boolean))].sort().reverse();
    const selectedMonth = sessionStorage.getItem("epivida-iaas-history-month") || months[0] || "";
    const selectedFilter = sessionStorage.getItem("epivida-iaas-history-filter") || "TODOS";
    const selectedDate = sessionStorage.getItem("epivida-iaas-history-date") || "";
    const visible = rows
      .filter(row => !selectedMonth || row.month === selectedMonth)
      .filter(row => !selectedDate || row.date === selectedDate)
      .filter(row => historyMatches(row, selectedFilter));

    const panel = document.createElement("details");
    panel.className = "iaas-panel iaas-history-panel";
    panel.open = true;
    panel.innerHTML = `
      <summary>PACIENTES IAAS</summary>
      <div class="iaas-history-controls">
        <select data-iaas-history-month>
          ${months.length ? months.map(month => `<option value="${month}">${month}</option>`).join("") : '<option value="">Sin registros</option>'}
        </select>
        <select data-iaas-history-filter>
          ${HISTORY_FILTERS.map(filter => `<option value="${filter}">${filter}</option>`).join("")}
        </select>
        <input data-iaas-history-date type="date" value="${selectedDate}" />
      </div>
      <div class="iaas-history-list">
        ${visible.length ? visible.map(row => `
          <div class="iaas-history-row">
            <span>${displayDate(row.date)}</span>
            <strong>${row.patientName}</strong>
            <span>${row.status}</span>
            <small>${clean(`${row.service}${row.bed ? ` - ${row.bed}` : ""}`) || "Sin cama"}</small>
          </div>
        `).join("") : '<p class="muted">Sin pacientes en este filtro.</p>'}
      </div>
    `;
    host.append(panel);
    const monthSelect = panel.querySelector("[data-iaas-history-month]");
    const filterSelect = panel.querySelector("[data-iaas-history-filter]");
    const dateInput = panel.querySelector("[data-iaas-history-date]");
    monthSelect.value = selectedMonth;
    filterSelect.value = selectedFilter;
    monthSelect.addEventListener("change", () => {
      sessionStorage.setItem("epivida-iaas-history-month", monthSelect.value);
      renderHistoryPanel();
    });
    filterSelect.addEventListener("change", () => {
      sessionStorage.setItem("epivida-iaas-history-filter", filterSelect.value);
      renderHistoryPanel();
    });
    dateInput.addEventListener("change", () => {
      sessionStorage.setItem("epivida-iaas-history-date", dateInput.value);
      renderHistoryPanel();
    });
  }

  document.addEventListener("click", event => {
    const link = event.target.closest?.('a[href*="#/seguimiento-iaas/"][href*="/paciente/"], a[href*="/seguimiento-iaas/"][href*="/paciente/"]');
    if (!link || !norm(link.textContent).includes("SEGUIMIENTO IAAS")) return;
    const href = link.getAttribute("href") || "";
    const match = href.match(/seguimiento-iaas\/([^/]+)\/paciente\/([^/?#]+)/);
    if (match) markForIaasFollowUp(match[1], decodeURIComponent(match[2]));
  }, true);

  document.addEventListener("click", event => {
    const button = event.target.closest?.(".patient-round .round-save-bar button, .patient-round .round-save-bar .iaas-button");
    if (!button || !norm(button.textContent).includes("GUARDAR") && !norm(button.textContent).includes("PENDIENTE")) return;
    const current = route();
    if (current?.section !== "iaas") return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    saveIaasDirectly(button);
  }, true);

  function run() {
    installStyle();
    cleanupVisibleUi();
    ensureClassificationPanel();
    renderHistoryPanel();
  }

  const afterSave = loadSession(POST_SAVE_KEY, null);
  if (afterSave) {
    sessionStorage.removeItem(POST_SAVE_KEY);
    window.setTimeout(() => flash(afterSave.message || "Guardado."), 600);
  }

  const schedule = () => [0, 120, 450, 900].forEach(delay => window.setTimeout(run, delay));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
  window.addEventListener("hashchange", schedule);
})();

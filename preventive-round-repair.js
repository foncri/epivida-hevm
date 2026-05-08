(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const POST_SAVE_KEY = "epivida-preventive-post-save-v2";
  const CULTURE_RE = /cultivo|hemocultivo|urocultivo|pcr|microorganismo|secreci[o\u00f3]n|bacteria|candida|pseudomona|staph|resultado/i;
  const DEVICE_PACKAGES = new Set(["ITS - CC", "ITU - CU", "NAVM", "ESPECIAL"]);
  const PACKAGE_DEFAULTS = {
    "ITS - CC": { deviceType: "CVPC" },
    "ITU - CU": { deviceType: "Sonda Foley", material: "SILICON", deviceState: "CIRCUITO CERRADO" },
    NAVM: { deviceType: "PUNTAS NASALES" },
    ESPECIAL: { deviceType: "SONDA NASOGASTRICA" },
    ISQ: { deviceType: "ISQ" },
    "P.E. Y P.B.M.T.": { deviceType: "P.E. Y P.B.M.T." }
  };
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

  function routePatient() {
    const match = String(location.hash || "").match(/^#\/ronda\/([^/]+)\/paciente\/([^/]+)/);
    if (!match) return null;
    return { date: match[1], patientId: decodeURIComponent(match[2]) };
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function normalized(value) {
    return clean(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00b0/g, "");
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

  function loadSessionJson(key, fallback) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
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
    return Number.isFinite(d.getTime()) && todayString(d) === iso;
  }

  function todayString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

  function hashText(input) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    const text = String(input || "");
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function mergeUnique(a, b) {
    return [...new Set([...(a || []), ...(b || [])].filter(Boolean))];
  }

  function packageCreatesDevice(device) {
    return DEVICE_PACKAGES.has(clean(typeof device === "string" ? device : device?.packageType));
  }

  function deviceDisplayName(device = {}) {
    return [device.deviceType, device.deviceSubtype].map(clean).filter(Boolean).join(" - ") || device.packageType || "Dispositivo";
  }

  function defaultPreventiveDevice(packageType) {
    const defaults = PACKAGE_DEFAULTS[packageType] || { deviceType: packageType || "Dispositivo" };
    return {
      packageType,
      createsDevice: packageCreatesDevice(packageType),
      deviceType: defaults.deviceType,
      deviceSubtype: "",
      material: defaults.material || "",
      deviceState: defaults.deviceState || "",
      french: "",
      installationDate: packageCreatesDevice(packageType) ? todayIso() : "",
      removalDate: "",
      preventiveChecks: {},
      oralHygieneMethod: "",
      observations: "",
      notes: ""
    };
  }

  function compliance(checks = {}) {
    const values = Object.values(checks).map(normalized).filter(value => value === "SI" || value === "NO");
    if (!values.length) return "";
    const yes = values.filter(value => value === "SI").length;
    return `${Math.round((yes / values.length) * 100)}%`;
  }

  function activeEpisodes(store, patientId, date) {
    return Object.values(store.deviceEpisodes || {})
      .filter(ep => ep.patientId === patientId)
      .filter(ep => {
        const installed = normalizeDate(ep.installationDate);
        const removed = normalizeDate(ep.removalDate);
        return installed && installed <= date && (!removed || removed >= date);
      });
  }

  function matchingEpisode(store, patientId, device) {
    const type = normalized(device.deviceType || device.packageType);
    const installed = normalizeDate(device.installationDate);
    const french = normalized(device.french);
    return Object.values(store.deviceEpisodes || {}).find(ep =>
      ep.patientId === patientId
      && normalized(ep.deviceType) === type
      && normalizeDate(ep.installationDate) === installed
      && normalized(ep.french) === french
    ) || null;
  }

  function getCensusRows(store, date) {
    return Object.values(store.dailyCensus?.[date]?.patients || {});
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
    getCensusRows(store, date).forEach(row => {
      store.dailyRounds[date].entries[row.patientId] ||= {
        entryId: row.patientId,
        patientId: row.patientId,
        service: row.service || "",
        bed: row.bed || "",
        reviewedBy: null,
        reviewedAt: null,
        roundDate: date,
        hasInvasives: activeEpisodes(store, row.patientId, date).length > 0,
        noInvasivesConfirmed: false,
        reviewedDevices: [],
        pendingIssuesAdded: [],
        alertsGenerated: [],
        status: "pendiente",
        syncStatus: "server_synced",
        localSavedAt: null,
        serverConfirmedAt: null,
        notes: "",
        activeRoundSection: "preventive",
        iaasAssessment: null,
        iaasAssessmentHistory: [],
        iaasAssessmentUpdatedAt: null
      };
    });
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

  function patientCultures(store, date, patientId) {
    const patient = store.patients?.[patientId] || {};
    const row = store.dailyCensus?.[date]?.patients?.[patientId] || {};
    const rows = [];
    [patient.cultureStatus, row.cultureStatus, patient.observations, row.observations, row.notes]
      .map(clean)
      .filter(value => value && CULTURE_RE.test(value))
      .forEach(value => rows.push({ title: value, meta: "Censo/observaciones", pending: true }));
    (patient.activePendingIssues || [])
      .map(clean)
      .filter(value => value && CULTURE_RE.test(value))
      .forEach(value => rows.push({ title: value, meta: "Pendiente activo", pending: true }));
    Object.entries(store.dailyRounds || {})
      .filter(([, round]) => round?.entries?.[patientId])
      .sort(([a], [b]) => String(b).localeCompare(String(a)))
      .forEach(([roundDate, round]) => {
        const entry = round.entries[patientId] || {};
        const assessments = [];
        if (entry.iaasAssessment) assessments.push(entry.iaasAssessment);
        (entry.iaasAssessmentHistory || []).forEach(item => assessments.push(item.assessment || item));
        assessments.forEach(assessment => {
          (assessment?.cultures || []).forEach(culture => {
            const type = clean(culture.type) || "Cultivo";
            const site = clean(culture.woundSite);
            const result = displayDate(culture.resultDate);
            const micro = clean(culture.microorganism);
            if (result && micro) return;
            rows.push({
              title: `${type}${site ? ` (${site})` : ""}`,
              meta: `Pendiente desde ${displayDate(culture.collectionDate || roundDate) || "fecha no registrada"}`,
              pending: true
            });
          });
        });
      });
    const seen = new Set();
    return rows.filter(item => {
      const key = `${item.title}|${item.meta}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
  }

  function summaryRail(summary) {
    let rail = summary.querySelector(":scope > .preventive-summary-rail");
    const risk = summary.querySelector(":scope > .risk");
    if (!rail) {
      rail = document.createElement("aside");
      rail.className = "preventive-summary-rail";
      summary.append(rail);
    }
    if (risk && risk.parentElement !== rail) rail.prepend(risk);
    return rail;
  }

  function renderCultures() {
    const route = routePatient();
    if (!route) return;
    const summary = document.querySelector(".patient-round .patient-sticky-summary");
    if (!summary) return;
    const rail = summaryRail(summary);
    rail.querySelector(".preventive-culture-summary")?.remove();
    const panel = document.createElement("aside");
    panel.className = "preventive-culture-summary";
    const title = document.createElement("strong");
    title.textContent = "Cultivos pendientes";
    panel.append(title);
    const cultures = patientCultures(loadJson(STORE_KEY, {}), route.date, route.patientId);
    if (!cultures.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Sin cultivos pendientes";
      panel.append(empty);
    } else {
      const list = document.createElement("ul");
      cultures.forEach(item => {
        const li = document.createElement("li");
        const name = document.createElement("b");
        const meta = document.createElement("span");
        name.textContent = item.title;
        meta.textContent = item.meta;
        li.append(name, meta);
        list.append(li);
      });
      panel.append(list);
    }
    rail.append(panel);
  }

  function removeRedundantPendingPanel() {
    document.querySelectorAll(".patient-round > .iaas-panel").forEach(panel => {
      const title = normalized(panel.querySelector("h2")?.textContent);
      if (title === "PENDIENTES Y OBSERVACIONES") panel.remove();
    });
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
        device.deviceType = defaultPreventiveDevice(device.packageType).deviceType;
        changed = true;
      }
    });
    if (changed) saveJson(DRAFT_KEY, drafts);
  }

  function selectedButtonText(container) {
    return clean(container.querySelector("button.selected, button.active")?.textContent);
  }

  function dateFromField(card, labelNeedle) {
    const labels = [...card.querySelectorAll("label.field")];
    const label = labels.find(item => normalized(item.querySelector("span")?.textContent).includes(labelNeedle));
    return normalizeDate(label?.querySelector("input")?.value) || "";
  }

  function draftFromDom() {
    return [...document.querySelectorAll(".patient-round .package-draft")].map(card => {
      const packageType = clean(card.querySelector(".device-draft-head strong")?.textContent);
      if (!packageType) return null;
      const device = defaultPreventiveDevice(packageType);
      [...card.querySelectorAll(".button-group-field")].forEach(field => {
        const label = normalized(field.querySelector(":scope > span")?.textContent);
        const value = selectedButtonText(field);
        if (!value) return;
        if (label.includes("TIPO DE INVASIVO") || label.includes("TIPO DE DISPOSITIVO") || label.includes("INVASIVO ESPECIAL")) device.deviceType = value;
        else if (label.includes("TIPO CATT")) device.deviceSubtype = value;
        else if (label.includes("FRENCH")) device.french = value;
        else if (label.includes("TIPO DE MATERIAL")) device.material = value;
        else if (label === "ESTADO") device.deviceState = value;
        else if (label.includes("METODO HIGIENE ORAL")) device.oralHygieneMethod = value;
      });
      [...card.querySelectorAll(".check-selector")].forEach(field => {
        const label = normalized(field.querySelector(":scope > span")?.textContent);
        const key = PREVENTIVE_CHECK_KEYS[label];
        const value = selectedButtonText(field);
        if (key && value) device.preventiveChecks[key] = value;
      });
      device.installationDate = dateFromField(card, "FECHA DE INSTALACION") || device.installationDate || todayIso();
      device.removalDate = dateFromField(card, "FECHA DE RETIRO");
      const observations = card.querySelector("textarea")?.value;
      device.observations = clean(observations);
      device.notes = clean(observations);
      return device;
    }).filter(Boolean);
  }

  function removalsFromDom(store, route) {
    const active = activeEpisodes(store, route.patientId, route.date);
    const removals = {};
    [...document.querySelectorAll(".patient-round .compact-device-card")].forEach(card => {
      const date = normalizeDate(card.querySelector('input[type="date"]')?.value);
      if (!date) return;
      const name = normalized(card.querySelector("strong")?.textContent);
      const matched = active.find(ep => normalized(deviceDisplayName(ep)) === name || name.includes(normalized(ep.deviceType)));
      if (matched?.episodeId) removals[matched.episodeId] = date;
    });
    return removals;
  }

  function prepareDraft(route, store) {
    const key = `${route.date}:${route.patientId}`;
    const drafts = loadJson(DRAFT_KEY, {});
    const draft = {
      deviceDrafts: [],
      removals: {},
      pendingText: "",
      notes: "",
      noInvasivesConfirmed: false,
      activeRoundSection: "preventive",
      ...(drafts[key] || {})
    };
    const domDrafts = draftFromDom();
    if (domDrafts.length) draft.deviceDrafts = domDrafts;
    draft.removals = { ...(draft.removals || {}), ...removalsFromDom(store, route) };
    draft.deviceDrafts = (draft.deviceDrafts || []).map(item => {
      const device = { ...defaultPreventiveDevice(item.packageType || item.deviceType), ...item };
      if (packageCreatesDevice(device)) {
        device.installationDate = normalizeDate(device.installationDate) || normalizeDate(route.date) || todayIso();
        if (!device.deviceType) device.deviceType = defaultPreventiveDevice(device.packageType).deviceType;
      }
      return device;
    });
    drafts[key] = draft;
    saveJson(DRAFT_KEY, drafts);
    return { draft, drafts, key };
  }

  function packageReviewSummary(device = {}) {
    return {
      packageType: device.packageType || "",
      deviceType: deviceDisplayName(device),
      material: device.material || "",
      deviceState: device.deviceState || "",
      french: device.french || "",
      installationDate: normalizeDate(device.installationDate) || device.installationDate || "",
      removalDate: normalizeDate(device.removalDate) || device.removalDate || "",
      preventiveChecks: device.preventiveChecks || {},
      compliance: compliance(device.preventiveChecks || {}),
      oralHygieneMethod: device.oralHygieneMethod || "",
      observations: clean(device.observations || device.notes)
    };
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

  function buildEpisode(store, route, patient, device) {
    const existing = matchingEpisode(store, route.patientId, device);
    if (existing) return { episode: existing, created: false };
    const install = normalizeDate(device.installationDate) || normalizeDate(route.date) || todayIso();
    const removal = normalizeDate(device.removalDate);
    const episode = {
      episodeId: `dev_${hashText(`${route.patientId}|${deviceDisplayName(device)}|${install}|${device.french || ""}|${Date.now()}`)}`,
      patientId: route.patientId,
      deviceType: device.deviceType || device.packageType || "Dispositivo",
      deviceSubtype: device.deviceSubtype || null,
      french: device.french || null,
      material: device.material || null,
      deviceState: device.deviceState || null,
      preventivePackage: device.packageType || null,
      preventiveChecks: device.preventiveChecks || {},
      preventiveCompliance: compliance(device.preventiveChecks || {}),
      oralHygieneMethod: device.oralHygieneMethod || null,
      anatomicalSite: device.anatomicalSite || null,
      installationDate: install,
      removalDate: removal || null,
      status: removal ? "retirado" : "activo",
      isReinstallation: false,
      previousEpisodeId: null,
      dressingCurrent: null,
      dressingDate: null,
      careStatus: "no_valorado",
      infectionSigns: null,
      infectionSignsDescription: null,
      notes: clean(device.notes || device.observations),
      createdDuringRoundDate: route.date,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: "local-user",
      updatedBy: "local-user",
      source: "nursing_round",
      syncStatus: "local_pending",
      patientName: patient.patientName || ""
    };
    store.deviceEpisodes[episode.episodeId] = episode;
    return { episode, created: true };
  }

  function requestedStatusFromButton(button) {
    const text = normalized(button?.textContent);
    if (text.includes("INCOMPLETO")) return "incompleto";
    if (text.includes("PENDIENTE")) return "pendiente";
    return "revisado";
  }

  function navigationIntentFromButton(button) {
    const text = normalized(button?.textContent);
    if (text.includes("SIGUIENTE")) return "next";
    if (text.includes("ANTERIOR")) return "prev";
    return "";
  }

  function nextPatientHash(store, route, direction) {
    if (!direction) return "";
    const rows = getCensusRows(store, route.date);
    const index = rows.findIndex(row => row.patientId === route.patientId);
    if (index < 0) return "";
    const nextIndex = direction === "next" ? index + 1 : index - 1;
    const target = rows[nextIndex];
    return target?.patientId ? `#/ronda/${route.date}/paciente/${encodeURIComponent(target.patientId)}` : `#/ronda/${route.date}`;
  }

  function savePreventiveRoundDirectly(button) {
    const route = routePatient();
    if (!route) return;
    const store = loadJson(STORE_KEY, {});
    store.patients ||= {};
    store.dailyCensus ||= {};
    store.dailyRounds ||= {};
    store.deviceEpisodes ||= {};
    store.auditLogs ||= [];
    store.writeQueue ||= [];

    const patient = store.patients[route.patientId];
    const row = store.dailyCensus?.[route.date]?.patients?.[route.patientId] || {};
    if (!patient) {
      flash("No encontre al paciente en la base local. Recarga Sheets e intenta de nuevo.", "error");
      return;
    }
    const { draft, drafts, key } = prepareDraft(route, store);
    ensureDailyRound(store, route.date);

    const packageReviews = [];
    const createdEpisodeIds = [];
    const createdEpisodes = [];
    (draft.deviceDrafts || []).forEach(device => {
      packageReviews.push(packageReviewSummary(device));
      if (!packageCreatesDevice(device)) return;
      const { episode, created } = buildEpisode(store, route, patient, device);
      createdEpisodeIds.push(episode.episodeId);
      if (created) {
        createdEpisodes.push(episode);
        addAudit(store, "DEVICE_EPISODE_CREATED", {
          patientId: route.patientId,
          deviceEpisodeId: episode.episodeId,
          roundDate: route.date,
          after: episode
        });
      }
    });

    Object.entries(draft.removals || {}).forEach(([episodeId, removalDate]) => {
      const episode = store.deviceEpisodes?.[episodeId];
      const date = normalizeDate(removalDate);
      if (!episode || !date) return;
      episode.removalDate = date;
      episode.status = "retirado";
      episode.updatedAt = nowIso();
      episode.updatedBy = "local-user";
      episode.syncStatus = "local_pending";
      addAudit(store, "DEVICE_EPISODE_REMOVED", { patientId: route.patientId, deviceEpisodeId: episodeId, roundDate: route.date, after: episode });
    });

    const pendingAdded = draft.pendingText ? [clean(draft.pendingText)] : [];
    if (pendingAdded.length) patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], pendingAdded);
    const activeNow = activeEpisodes(store, route.patientId, route.date);
    const previousEntry = store.dailyRounds[route.date]?.entries?.[route.patientId] || {};
    const status = requestedStatusFromButton(button);
    const entry = {
      ...previousEntry,
      entryId: route.patientId,
      patientId: route.patientId,
      service: patient.currentService || row.service || previousEntry.service || "",
      bed: patient.currentBed || row.bed || previousEntry.bed || "",
      reviewedBy: "local-user",
      reviewedAt: nowIso(),
      roundDate: route.date,
      hasInvasives: activeNow.length > 0 || createdEpisodeIds.length > 0,
      noInvasivesConfirmed: Boolean(draft.noInvasivesConfirmed) && activeNow.length === 0 && createdEpisodeIds.length === 0,
      reviewedDevices: mergeUnique(previousEntry.reviewedDevices || [], mergeUnique(activeNow.map(ep => ep.episodeId), createdEpisodeIds)),
      pendingIssuesAdded: mergeUnique(previousEntry.pendingIssuesAdded || [], pendingAdded),
      alertsGenerated: previousEntry.alertsGenerated || [],
      status,
      syncStatus: "local_pending",
      localSavedAt: nowIso(),
      serverConfirmedAt: null,
      notes: draft.notes || previousEntry.notes || "",
      activeRoundSection: "preventive",
      packageReviews: [...(previousEntry.packageReviews || []), ...packageReviews],
      iaasAssessment: previousEntry.iaasAssessment || null,
      iaasAssessmentHistory: Array.isArray(previousEntry.iaasAssessmentHistory) ? previousEntry.iaasAssessmentHistory : [],
      iaasAssessmentUpdatedAt: previousEntry.iaasAssessmentUpdatedAt || null,
      updatedAt: nowIso(),
      updatedBy: "local-user"
    };
    store.dailyRounds[route.date].entries[route.patientId] = entry;

    if (store.dailyCensus?.[route.date]?.patients?.[route.patientId]) {
      const censusRow = store.dailyCensus[route.date].patients[route.patientId];
      censusRow.reviewedByNursing = status === "revisado" || status === "alerta";
      censusRow.reviewStatus = status;
      censusRow.reviewedAt = entry.reviewedAt;
      censusRow.syncStatus = "local_pending";
    }
    patient.latestRoundDate = route.date;
    patient.latestRoundStatus = status;
    patient.updatedAt = nowIso();
    patient.updatedBy = "local-user";
    addAudit(store, "ROUND_ENTRY_SAVED", { patientId: route.patientId, roundDate: route.date, after: entry });
    recalculateRound(store, route.date);

    delete drafts[key];
    store.writeQueue.push({
      id: `write-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: "local_pending",
      createdAt: nowIso(),
      operation: { type: "roundEntry", date: route.date, patientId: route.patientId, entry, patient, episodes: createdEpisodes }
    });
    store.lastSavedAt = nowIso();
    saveJson(DRAFT_KEY, drafts);
    saveJson(STORE_KEY, store);

    const targetHash = nextPatientHash(store, route, navigationIntentFromButton(button));
    sessionStorage.setItem(POST_SAVE_KEY, JSON.stringify({
      savedAt: nowIso(),
      targetHash,
      message: "Guardado. Si Sheets esta conectado, se sincronizara automaticamente."
    }));
    flash("Guardado. Actualizando la vista...", "ok");
    window.setTimeout(() => {
      if (targetHash) location.hash = targetHash;
      location.reload();
    }, 120);
  }

  function flash(message, tone = "ok") {
    const toast = document.createElement("div");
    toast.className = `toast iaas-toast ${tone}`;
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function repairPatientRound() {
    if (!routePatient()) return;
    ensureDraftInstallationDates();
    removeRedundantPendingPanel();
    renderCultures();
  }

  function scheduleRepair() {
    [0, 80, 250, 700].forEach(delay => window.setTimeout(repairPatientRound, delay));
  }

  function isSaveButton(button) {
    const text = normalized(button?.textContent);
    return Boolean(button) && (text.includes("GUARDAR") || text.includes("MARCAR PENDIENTE"));
  }

  document.addEventListener("click", event => {
    const saveButton = event.target.closest?.(".patient-round .round-save-bar button, .patient-round .round-save-bar .iaas-button");
    if (!isSaveButton(saveButton)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    ensureDraftInstallationDates();
    savePreventiveRoundDirectly(saveButton);
  }, true);

  document.addEventListener("click", event => {
    if (!routePatient()) return;
    if (event.target.closest?.(".patient-round .package-selector, .patient-round .package-draft button")) {
      scheduleRepair();
    }
  }, true);

  window.addEventListener("hashchange", scheduleRepair);

  const afterSave = loadSessionJson(POST_SAVE_KEY, null);
  if (afterSave) {
    sessionStorage.removeItem(POST_SAVE_KEY);
    if (afterSave.targetHash && location.hash !== afterSave.targetHash) location.hash = afterSave.targetHash;
    window.setTimeout(() => {
      flash(afterSave.message || "Guardado.");
      window.dispatchEvent(new Event("online"));
    }, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRepair, { once: true });
  } else {
    scheduleRepair();
  }
})();

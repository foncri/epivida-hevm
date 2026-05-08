(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const CULTURE_RE = /cultivo|hemocultivo|urocultivo|pcr|microorganismo|secreci[o\u00f3]n|bacteria|candida|pseudomona|staph|resultado/i;

  function routePatient() {
    const match = String(location.hash || "").match(/^#\/ronda\/([^/]+)\/paciente\/([^/]+)/);
    if (!match) return null;
    return { date: match[1], patientId: decodeURIComponent(match[2]) };
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function normalized(value) {
    return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

  function createsDevice(device) {
    const type = typeof device === "string" ? device : device?.packageType;
    return !["ISQ", "P.E. Y P.B.M.T."].includes(type);
  }

  function ensureDraftInstallationDates() {
    const route = routePatient();
    if (!route) return;
    const defaultDate = route.date || todayIso();
    document.querySelectorAll(".patient-round .package-draft label.field").forEach(label => {
      const labelText = normalized(label.querySelector("span")?.textContent);
      const input = label.querySelector('input[type="date"]');
      if (!input || input.value || !labelText.includes("fecha de instalacion")) return;
      input.value = defaultDate;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const key = `${route.date}:${route.patientId}`;
    const drafts = loadJson(DRAFT_KEY, {});
    const draft = drafts[key];
    if (!draft?.deviceDrafts?.length) return;
    let changed = false;
    draft.deviceDrafts.forEach(device => {
      if (createsDevice(device) && !device.installationDate) {
        device.installationDate = defaultDate;
        changed = true;
      }
    });
    if (changed) saveJson(DRAFT_KEY, drafts);
  }

  function removeRedundantPendingPanel() {
    document.querySelectorAll(".patient-round > .iaas-panel").forEach(panel => {
      const title = normalized(panel.querySelector("h2")?.textContent);
      if (title === "pendientes y observaciones") panel.remove();
    });
  }

  function displayDate(value) {
    const text = clean(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
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
            const collection = displayDate(culture.collectionDate || roundDate);
            const result = displayDate(culture.resultDate);
            const micro = clean(culture.microorganism);
            const pending = !result || !micro;
            rows.push({
              title: `${type}${site ? ` (${site})` : ""}`,
              meta: pending ? `Pendiente desde ${collection || "fecha no registrada"}` : `Resultado ${result}: ${micro}`,
              pending
            });
          });
        });
      });
    const seen = new Set();
    return rows.filter(item => item.pending).filter(item => {
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

  function repairPatientRound() {
    if (!routePatient()) return;
    ensureDraftInstallationDates();
    removeRedundantPendingPanel();
    renderCultures();
  }

  function scheduleRepair() {
    [0, 80, 250, 700].forEach(delay => window.setTimeout(repairPatientRound, delay));
  }

  function isSaveControl(control) {
    const text = normalized(control?.textContent);
    return Boolean(control) && (text.includes("guardar") || text.includes("marcar pendiente"));
  }

  document.addEventListener("click", event => {
    if (!routePatient()) return;
    if (event.target.closest?.(".patient-round .package-selector, .patient-round .package-draft button")) {
      scheduleRepair();
    }
  }, true);

  window.addEventListener("click", event => {
    const saveButton = event.target.closest?.(".patient-round .round-save-bar .iaas-button, .patient-round .round-save-bar button");
    if (!isSaveControl(saveButton)) return;
    ensureDraftInstallationDates();
    scheduleRepair();
  }, true);

  window.addEventListener("hashchange", scheduleRepair);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRepair, { once: true });
  } else {
    scheduleRepair();
  }
})();

(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const CULTURE_RE = /cultivo|hemocultivo|urocultivo|pcr|microorganismo|secreci[oó]n|bacteria|candida|pseudomona|staph|resultado/i;

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function routePatient() {
    const match = String(location.hash || "").match(/^#\/ronda\/([^/]+)\/paciente\/([^/]+)/);
    if (!match) return null;
    return { date: match[1], patientId: decodeURIComponent(match[2]) };
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
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

    const unique = [];
    const seen = new Set();
    rows.filter(item => item.pending).forEach(item => {
      const key = `${item.title}|${item.meta}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
    return unique.slice(0, 4);
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
    const cultures = patientCultures(loadStore(), route.date, route.patientId);
    const panel = document.createElement("aside");
    panel.className = "preventive-culture-summary";
    const title = document.createElement("strong");
    title.textContent = "Cultivos pendientes";
    panel.append(title);
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
        name.textContent = item.title;
        const meta = document.createElement("span");
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
      const title = clean(panel.querySelector("h2")?.textContent).toLowerCase();
      if (title === "pendientes y observaciones") panel.remove();
    });
  }

  function defaultInstallationDates() {
    const today = todayIso();
    document.querySelectorAll(".patient-round .package-draft label.field").forEach(label => {
      const labelText = clean(label.querySelector("span")?.textContent).toLowerCase();
      const input = label.querySelector('input[type="date"]');
      if (!input || input.value || input.dataset.hotfixDefaulted) return;
      if (!labelText.includes("instalación") && !labelText.includes("instalacion")) return;
      input.value = today;
      input.dataset.hotfixDefaulted = "1";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function enhanceNavigationButtons() {
    const route = routePatient();
    if (!route) return;
    document.querySelectorAll(".patient-round a, .patient-round button").forEach(control => {
      const text = clean(control.textContent).toLowerCase();
      if (text.includes("ir a seguimiento iaas")) {
        control.classList.add("iaas-button", "primary");
        if (control.tagName === "A") control.setAttribute("href", `#/seguimiento-iaas/${route.date}/paciente/${route.patientId}`);
      }
      if (text.includes("ir a vigilancia hospitalaria")) {
        control.classList.add("iaas-button", "ghost");
        if (control.tagName === "A") control.setAttribute("href", "#/censo-hospitalario");
      }
    });
  }

  function showToast(message) {
    document.querySelector(".preventive-hotfix-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "preventive-hotfix-toast";
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }

  let restoreOnlineTimer = 0;
  let onlineRestore = null;
  function forceFastLocalQueue() {
    if (!onlineRestore) {
      const restorers = [];
      const targets = [Navigator.prototype, navigator];
      for (const target of targets) {
        const descriptor = Object.getOwnPropertyDescriptor(target, "onLine");
        try {
          Object.defineProperty(target, "onLine", { configurable: true, get: () => false });
          restorers.push(() => {
            if (descriptor) Object.defineProperty(target, "onLine", descriptor);
            else delete target.onLine;
          });
          break;
        } catch (error) {
          // Continue with the next target; some browsers expose onLine differently.
        }
      }
      onlineRestore = () => restorers.reverse().forEach(restore => restore());
    }
    window.clearTimeout(restoreOnlineTimer);
    restoreOnlineTimer = window.setTimeout(() => {
      onlineRestore?.();
      onlineRestore = null;
    }, 2500);
  }

  function preserveScroll() {
    const y = window.scrollY;
    [0, 80, 180].forEach(delay => window.setTimeout(() => window.scrollTo({ top: y, left: 0 }), delay));
  }

  function enhance() {
    if (!routePatient()) return;
    removeRedundantPendingPanel();
    renderCultures();
    defaultInstallationDates();
    enhanceNavigationButtons();
  }

  function scheduleEnhance(delay = 60) {
    window.setTimeout(enhance, delay);
  }

  document.addEventListener("click", event => {
    if (!routePatient()) return;
    const selector = event.target.closest?.(".patient-round .package-draft .button-chip-row button, .patient-round .package-draft .button-segment button, .patient-round .package-selector");
    if (selector) {
      preserveScroll();
      scheduleEnhance(100);
    }
    const saveButton = event.target.closest?.(".patient-round .round-save-bar .iaas-button, .patient-round .round-save-bar button");
    const saveText = clean(saveButton?.textContent).toLowerCase();
    if (saveButton && (saveText.includes("guardar") || saveText.includes("marcar pendiente"))) {
      forceFastLocalQueue();
      saveButton.classList.add("hotfix-saving");
      showToast("Guardando sin bloquear la pantalla. La sincronización quedará en cola si Sheets tarda.");
      window.setTimeout(() => saveButton.classList.remove("hotfix-saving"), 1800);
    }
    const nav = event.target.closest?.(".patient-round button, .patient-round a");
    if (nav) {
      const text = clean(nav.textContent).toLowerCase();
      const route = routePatient();
      if (text.includes("ir a seguimiento iaas")) {
        event.preventDefault();
        location.hash = `#/seguimiento-iaas/${route.date}/paciente/${route.patientId}`;
      } else if (text.includes("ir a vigilancia hospitalaria")) {
        event.preventDefault();
        location.hash = "#/censo-hospitalario";
      }
    }
  }, true);

  window.addEventListener("hashchange", () => scheduleEnhance(120));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scheduleEnhance(0), { once: true });
  } else {
    scheduleEnhance(0);
  }
})();

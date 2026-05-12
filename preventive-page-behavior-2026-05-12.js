(() => {
  "use strict";

  if (window.__epividaPreventivePageBehavior) return;
  window.__epividaPreventivePageBehavior = true;

  const STORE_KEY = "epivida-iaas-os-v1";
  const CUSTOM_BEDS_KEY = "epivida-preventive-custom-beds-v1";
  const POST_SAVE_KEY = "epivida-preventive-post-save-v2";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const services = [
    ["MEDICINA INTERNA", "Medicina Interna"],
    ["CIRUGIA Y TRAUMATOLOGIA", "Cirugia y Traumatologia"],
    ["PEDIATRIA", "Pediatria"],
    ["CUNEROS", "Cuneros"],
    ["UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", "UCIN"],
    ["HEMODIALISIS", "Hemodialisis"],
    ["ONCOLOGIA", "Oncologia"],
    ["GINECOLOGIA Y OBSTETRICIA", "Ginecologia y Obstetricia"],
    ["UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS", "UCIP"],
    ["UNIDAD DE CUIDADOS INTENSIVOS ADULTOS", "UCIA"],
    ["URGENCIAS", "Urgencias"],
    ["AMBULATORIO", "Ambulatorio"]
  ];

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const load = (key, fallback = {}) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  function canonicalService(value) {
    const key = norm(value);
    if (!key || key === "TODOS") return "";
    if (key.includes("MEDICINA INTERNA") || key === "MI") return "MEDICINA INTERNA";
    if (key.includes("CIRUGIA") || key.includes("TRAUMATOLOG") || /\b(CX|TX)\b/.test(key)) return "CIRUGIA Y TRAUMATOLOGIA";
    if (key.includes("CUNERO")) return "CUNEROS";
    if (key.includes("NEONATAL") || key.includes("UCIN")) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
    if (key.includes("HEMODIALISIS") || key === "HEM") return "HEMODIALISIS";
    if (key.includes("PEDIATRIC") || key === "UCIP" || key === "UTIP") return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
    if (key.includes("PEDIATRIA") || /\bPED\b/.test(key)) return "PEDIATRIA";
    if (key.includes("ADULTOS") || key.includes("UCIA")) return "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS";
    if (key.includes("GINECO") || key.includes("OBSTETRIC") || key.includes("GYO") || key === "GO") return "GINECOLOGIA Y OBSTETRICIA";
    if (key.includes("URGENCIA") || key === "URG") return "URGENCIAS";
    if (key.includes("AMBULATORIO")) return "AMBULATORIO";
    if (key.includes("ONCOLOGIA")) return "ONCOLOGIA";
    return "";
  }

  function selectedService() {
    const active = document.querySelector(".round-service-filter button.active:not(.round-add-bed-toggle)");
    return canonicalService(active?.getAttribute("title")?.split(":")[0] || active?.textContent || "");
  }

  function bedKey(value) {
    return norm(value).replace(/[\s.-]+/g, "");
  }

  function installStyle() {
    if (document.getElementById("epivida-preventive-behavior-style")) return;
    const style = document.createElement("style");
    style.id = "epivida-preventive-behavior-style";
    style.textContent = `
      .preventive-command-hero { display: none !important; }
      .preventive-command { display: block !important; }
      .preventive-package-grid { width: 100% !important; grid-template-columns: repeat(4, minmax(210px, 1fr)) !important; }
      .round-add-bed-toggle { width: 38px !important; min-width: 38px !important; flex: 0 0 38px !important; padding-inline: 0 !important; font-size: 18px !important; }
      .round-add-bed-form { width: min(100%, 560px); display: grid; grid-template-columns: minmax(180px, .95fr) minmax(150px, .8fr) auto; gap: 8px; align-items: center; margin-left: 6px; }
      .round-add-bed-form[hidden] { display: none !important; }
      .round-add-bed-form select, .round-add-bed-form input { min-height: 38px; border: 1px solid rgba(204,214,235,.95); border-radius: 999px; padding: 0 12px; color: #0d1b3f; background: #fff; font: inherit; font-weight: 800; }
      .compact-device-card.active { border-color: rgba(239,68,68,.55) !important; background: #fff7f8 !important; }
      .compact-device-card.removed { border-color: rgba(14,116,184,.48) !important; background: #eff8ff !important; }
      .compact-device-card.active strong { color: #dc2626 !important; }
      .compact-device-card.removed strong { color: #1976b9 !important; }
      @media (max-width: 1180px) { .preventive-package-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } }
      @media (max-width: 760px) { .preventive-package-grid, .round-add-bed-form { grid-template-columns: 1fr !important; } }
    `;
    document.head.append(style);
  }

  function cleanupPanels() {
    document.querySelectorAll(".preventive-command-hero").forEach(node => node.remove());
    document.querySelectorAll(".metric-card, .round-metric, .stat-card").forEach(card => {
      if (norm(card.textContent).includes("SYNC PENDIENTE")) card.remove();
    });
  }

  function ensureManualBedUi() {
    const filter = document.querySelector(".round-service-filter");
    if (!filter || filter.querySelector("[data-epivida-add-bed-toggle]")) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "round-add-bed-toggle";
    toggle.dataset.epividaAddBedToggle = "true";
    toggle.title = "Agregar cama manual";
    toggle.setAttribute("aria-label", "Agregar cama manual");
    toggle.innerHTML = "&#9998;";

    const form = document.createElement("form");
    form.className = "round-add-bed-form";
    form.hidden = true;
    form.innerHTML = "<select aria-label=\"Servicio para cama nueva\"></select><input name=\"bed\" placeholder=\"Nombre de cama\" autocomplete=\"off\" /><button class=\"iaas-button compact\" type=\"submit\">Agregar</button>";
    const select = form.querySelector("select");
    services.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    select.value = selectedService() || "MEDICINA INTERNA";

    const anchor = [...filter.querySelectorAll("button")].find(button => canonicalService(button.textContent) === "AMBULATORIO") || filter.querySelector("button:last-of-type");
    if (anchor) anchor.after(toggle, form);
    else filter.append(toggle, form);

    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector("input")?.focus();
    });

    form.addEventListener("submit", event => {
      event.preventDefault();
      const service = canonicalService(select.value);
      const bed = clean(form.elements.bed.value);
      if (!service || !bed) return;
      const data = load(CUSTOM_BEDS_KEY, {});
      const next = data && typeof data === "object" && !Array.isArray(data) ? data : {};
      next[service] ||= [];
      if (!next[service].some(item => bedKey(item) === bedKey(bed))) next[service].push(bed);
      save(CUSTOM_BEDS_KEY, next);
      form.elements.bed.value = "";
      form.hidden = true;
      const active = [...filter.querySelectorAll("button:not(.round-add-bed-toggle)")].find(button => canonicalService(button.textContent) === service);
      active?.click();
    });
  }

  function routeDate() {
    return String(location.hash || "").match(/^#\/ronda\/([^/]+)/)?.[1] || "";
  }

  function patientIdFromTile(tile) {
    const match = String(tile?.getAttribute("href") || "").match(/\/paciente\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function entrySaved(entry) {
    return Boolean(entry && (entry.reviewedAt || entry.localSavedAt || entry.serverConfirmedAt || ["revisado", "alerta", "incompleto"].includes(String(entry.status || "").toLowerCase())));
  }

  function timestamp(value) {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }

  function markOnlyTrueOverdue() {
    const date = routeDate();
    if (!date) return;
    const store = load(STORE_KEY, {});
    document.querySelectorAll(".bed-board.preventive .bed-tile[href]").forEach(tile => {
      const row = store.dailyCensus?.[date]?.patients?.[patientIdFromTile(tile)];
      if (!row) return;
      const entry = store.dailyRounds?.[date]?.entries?.[row.patientId];
      const enteredAt = timestamp(row.importedAt || row.createdAt || row.censusImportedAt || row.ingresoCensoAt || row.updatedAt)
        || timestamp(store.dailyCensus?.[date]?.importedAt || store.dailyCensus?.[date]?.createdAt)
        || timestamp(`${date}T00:00:00`);
      const overdue = !entrySaved(entry) && enteredAt && Date.now() - enteredAt >= DAY_MS;
      tile.classList.toggle("overdue", Boolean(overdue));
      if (!overdue && !tile.classList.contains("reviewed")) tile.classList.add("available");
      if (overdue) tile.title = "Pendiente de ronda preventiva por mas de 24 horas";
    });
  }

  function routePatient() {
    const hash = String(location.hash || "");
    let match = hash.match(/^#\/ronda\/([^/]+)\/paciente\/([^/]+)/);
    if (match) return { date: match[1], patientId: decodeURIComponent(match[2]), preventive: true };
    match = hash.match(/^#\/seguimiento-iaas\/([^/]+)\/paciente\/([^/]+)/);
    return match ? { date: match[1], patientId: decodeURIComponent(match[2]), preventive: false } : null;
  }

  function installSaveNavigationShim() {
    if (window.__epividaBehaviorSaveShim) return;
    window.__epividaBehaviorSaveShim = true;
    window.addEventListener("click", event => {
      const button = event.target.closest?.(".patient-round .round-save-bar button, .patient-round .round-save-bar .iaas-button");
      const label = norm(button?.textContent);
      if (!button || !label.includes("GUARDAR") || (!label.includes("SIGUIENTE") && !label.includes("ANTERIOR"))) return;
      const route = routePatient();
      if (!route?.preventive) return;
      const store = load(STORE_KEY, {});
      const row = store.dailyCensus?.[route.date]?.patients?.[route.patientId] || {};
      const service = norm((store.patients?.[route.patientId]?.currentService || row.service || "")).replace(/\s*\/\s*/g, "/");
      const rows = Object.values(store.dailyCensus?.[route.date]?.patients || {})
        .filter(item => !service || norm(item.service).replace(/\s*\/\s*/g, "/") === service)
        .sort((a, b) => clean(a.bed).localeCompare(clean(b.bed), "es", { numeric: true }));
      const index = rows.findIndex(item => item.patientId === route.patientId);
      const target = rows[label.includes("SIGUIENTE") ? index + 1 : index - 1];
      if (!target) return;
      const targetHash = `#/ronda/${route.date}/paciente/${encodeURIComponent(target.patientId)}`;
      const original = button.textContent;
      button.textContent = "Guardar";
      setTimeout(() => { if (button.isConnected) button.textContent = original; }, 40);
      setTimeout(() => {
        const payload = load(POST_SAVE_KEY, {});
        if (payload && typeof payload === "object") {
          payload.targetHash = targetHash;
          save(POST_SAVE_KEY, payload);
        }
        if (location.hash !== targetHash) location.hash = targetHash;
      }, 120);
    }, true);
  }

  function run() {
    installStyle();
    cleanupPanels();
    ensureManualBedUi();
    markOnlyTrueOverdue();
  }

  installSaveNavigationShim();
  const schedule = () => [0, 120, 450].forEach(delay => setTimeout(run, delay));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
  window.addEventListener("hashchange", schedule);
  document.addEventListener("click", event => {
    if (event.target.closest?.(".round-service-filter button, .bed-board-picker select")) schedule();
  }, true);
})();

(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const CUSTOM_BEDS_KEY = "epivida-preventive-custom-beds-v1";
  const POST_SAVE_KEY = "epivida-preventive-post-save-v2";
  const HOUR = 60 * 60 * 1000;
  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
  const prefixed = (prefix, start, end) => range(start, end).map(number => `${prefix} ${number}`);

  const SERVICE_OPTIONS = [
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

  const BED_CATALOG = {
    "MEDICINA INTERNA": [...range(1, 30), "AIS 1 MI", "AIS 2 MI", "AIS 3 MI", "OBS 1", "OBS 2"],
    "CIRUGIA Y TRAUMATOLOGIA": [...range(43, 66), "AIS 1 CX", "AIS 2 CX", "AIS 3 CX"],
    "PEDIATRIA": [...range(67, 74), "AIS 1 PED", "AIS 2 PED", "AIS 3 PED", "ESC 1", "ESC 2", "ESC 3"],
    "CUNEROS": ["CUN 1", "CUN 2", "CUN 3"],
    "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES": ["UCIN 1", "UCIN 2"],
    "HEMODIALISIS": prefixed("HEM", 1, 100),
    "GINECOLOGIA Y OBSTETRICIA": prefixed("ALOJ", 1, 5),
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS": ["UTIP 1"],
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS": ["UCIA 2", "UCIA 3", "UCIA AIS 4", "UCIA 5", "UCIA 6", "UCIA AIS 7", "UCIA 8"],
    "URGENCIAS": [
      "F1", "F2", "F3", "F4",
      ...prefixed("UX", 1, 11),
      "P1", "P2", "P3", "P4", "P5",
      "AISLADO P", "AISLADO 1", "AISLADO 2", "CHOQUE",
      "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13", "B14"
    ]
  };

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function text(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
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

  function normalizeDate(value) {
    const raw = clean(value);
    if (!raw || ["NA", "N/A", "AMB"].includes(text(raw))) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (!match) return "";
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }

  function displayDate(value) {
    const iso = normalizeDate(value);
    if (!iso) return "";
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }

  function daysBetween(start, end) {
    const a = normalizeDate(start);
    const b = normalizeDate(end);
    if (!a || !b) return 0;
    return Math.max(0, Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000));
  }

  function canonicalService(value) {
    const key = text(value);
    if (!key || key === "TODOS") return "";
    if (key.includes("MEDICINA INTERNA") || key === "MI") return "MEDICINA INTERNA";
    if (key.includes("CIRUGIA") || key.includes("TRAUMATOLOG") || /\b(CX|TX)\b/.test(key)) return "CIRUGIA Y TRAUMATOLOGIA";
    if (key.includes("CUNERO")) return "CUNEROS";
    if (key.includes("NEONATAL") || key === "UCIN" || key.includes("UCIN")) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
    if (key.includes("HEMODIALISIS") || key === "HEM") return "HEMODIALISIS";
    if (key.includes("PEDIATRIC") || key === "UCIP" || key === "UTIP") return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
    if (key.includes("PEDIATRIA") || /\bPED\b/.test(key)) return "PEDIATRIA";
    if (key.includes("ADULTOS") || key === "UCIA" || key.includes("UCIA")) return "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS";
    if (key.includes("GINECO") || key.includes("OBSTETRIC") || key.includes("GYO") || key === "GO") return "GINECOLOGIA Y OBSTETRICIA";
    if (key.includes("URGENCIA") || key === "URG") return "URGENCIAS";
    if (key.includes("AMBULATORIO")) return "AMBULATORIO";
    if (key.includes("ONCOLOGIA")) return "ONCOLOGIA";
    return BED_CATALOG[key] ? key : "";
  }

  function serviceDisplayLabel(service) {
    return SERVICE_OPTIONS.find(([key]) => key === service)?.[1] || service;
  }

  function serviceKey(value) {
    return text(value).replace(/\s*\/\s*/g, "/");
  }

  function bedKey(value) {
    return text(value)
      .replace(/^CAMA\s+/, "")
      .replace(/^CAM\s+/, "")
      .replace(/^ALOJA\b/, "ALOJ")
      .replace(/\bALOJAMIENTO\b/g, "ALOJ")
      .replace(/\bCUNEROS\b/g, "CUN")
      .replace(/\bESCOLARES\b/g, "ESC")
      .replace(/\bESCOLAR\b/g, "ESC")
      .replace(/\bUCIP\b/g, "UTIP")
      .replace(/[\s.-]+/g, "");
  }

  function catalogKeys(bed, service) {
    const base = new Set([bedKey(bed)]);
    let match = text(bed).match(/^AIS\s+(\d+)\s+(MI|CX|PED)$/);
    if (match) {
      base.add(`AIS${match[1]}`);
      base.add(`AISLADO${match[1]}`);
    }
    match = text(bed).match(/^ALOJ\s+(\d+)$/);
    if (match) base.add(`ALOJAMIENTO${match[1]}`);
    match = text(bed).match(/^CUN\s+(\d+)$/);
    if (match) base.add(`CUNEROS${match[1]}`);
    match = text(bed).match(/^ESC\s+(\d+)$/);
    if (match) base.add(`ESCOLARES${match[1]}`);
    match = text(bed).match(/^HEM\s+(\d+)$/);
    if (match) base.add(`HEMODIALISIS${match[1]}`);
    if (service === "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS" && bed === "UTIP 1") {
      base.add("UCIP1");
    }
    if (service === "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS") {
      const number = text(bed).match(/(\d+)$/)?.[1];
      if (number) base.add(number);
    }
    return [...base];
  }

  function loadManualBeds() {
    const data = loadJson(CUSTOM_BEDS_KEY, {});
    return data && typeof data === "object" ? data : {};
  }

  function catalogFor(service) {
    const base = BED_CATALOG[service] || [];
    const custom = loadManualBeds()[service] || [];
    const seen = new Set();
    return [...base, ...custom].filter(bed => {
      const key = bedKey(bed);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function saveManualBed(service, bed) {
    const canonical = canonicalService(service);
    const label = clean(bed);
    if (!canonical || !label) return false;
    const data = loadManualBeds();
    data[canonical] ||= [];
    if (!data[canonical].some(item => bedKey(item) === bedKey(label))) data[canonical].push(label);
    saveJson(CUSTOM_BEDS_KEY, data);
    return true;
  }

  function selectedPreventiveService() {
    const active = document.querySelector(".round-service-filter button.active:not(.round-add-bed-toggle)");
    if (!active) return "";
    const titleService = active.getAttribute("title")?.split(":")[0] || "";
    return canonicalService(titleService || active.textContent);
  }

  function serviceFromRoundNav(board) {
    const label = board.querySelector(".round-nav-head strong")?.textContent || "";
    return canonicalService(label.replace(/^Camas\s+/i, ""));
  }

  function tileBed(tile) {
    return tile?.querySelector("strong")?.textContent || "";
  }

  function patientIdFromTile(tile) {
    const href = tile?.getAttribute?.("href") || "";
    const match = href.match(/\/paciente\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function makeVacantTile(bed, roundNav = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;
    button.className = `bed-tile ${roundNav ? "round-nav-tile " : ""}vacant epivida-catalog-vacant`;
    button.title = "Cama desocupada";
    button.setAttribute("aria-label", `${bed}: Cama desocupada`);
    button.innerHTML = "<strong></strong><span>Vacia</span><small>Sin paciente</small>";
    button.querySelector("strong").textContent = bed;
    return button;
  }

  function updateTileBedLabel(tile, bed) {
    const strong = tile?.querySelector("strong");
    if (strong) strong.textContent = bed;
    const status = tile?.getAttribute("title") || "Cama";
    tile?.setAttribute("aria-label", `${bed}: ${status}`);
  }

  function rebuildGrid(grid, service, roundNav = false) {
    const catalog = catalogFor(service);
    if (!grid || !catalog.length) return;
    const signature = `${service}|${catalog.map(bedKey).join("|")}`;
    if (grid.dataset.epividaCatalogSignature === signature) return;
    const existing = [...grid.querySelectorAll(".bed-tile")];
    const byKey = new Map();
    existing.forEach(tile => {
      const key = bedKey(tileBed(tile));
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(tile);
    });
    const usedTiles = new Set();
    const next = catalog.map(bed => {
      let tile = null;
      for (const key of catalogKeys(bed, service)) {
        const candidates = byKey.get(key) || [];
        tile = candidates.find(item => !usedTiles.has(item));
        if (tile) break;
      }
      if (!tile) return makeVacantTile(bed, roundNav);
      usedTiles.add(tile);
      updateTileBedLabel(tile, bed);
      return tile;
    });
    existing.forEach(tile => {
      if (usedTiles.has(tile)) return;
      if (!tile.classList.contains("vacant") && !tile.disabled) next.push(tile);
    });
    grid.replaceChildren(...next);
    grid.dataset.epividaCatalogSignature = signature;
  }

  function updateTotals(board) {
    const tiles = [...board.querySelectorAll(".bed-board-grid .bed-tile, .round-nav-grid .bed-tile")];
    const totals = board.querySelector(".bed-board-totals");
    if (!tiles.length || !totals) return;
    const spans = totals.querySelectorAll("span");
    if (spans[0]) spans[0].textContent = `${tiles.length} cama(s)`;
    if (spans[1]) spans[1].textContent = `${tiles.filter(tile => tile.classList.contains("reviewed")).length} vistas`;
    const pending = tiles.filter(tile => tile.classList.contains("overdue")).length;
    let strong = totals.querySelector("strong");
    if (pending && !strong) {
      strong = document.createElement("strong");
      totals.append(strong);
    }
    if (strong) {
      strong.hidden = !pending;
      strong.textContent = pending ? `${pending} pendientes` : "";
    }
  }

  function runBedCatalog() {
    const service = selectedPreventiveService();
    document.querySelectorAll(".bed-board.preventive").forEach(board => {
      const grid = board.querySelector(".bed-board-grid");
      if (service && grid) {
        rebuildGrid(grid, service, false);
        updateTotals(board);
      }
    });
    document.querySelectorAll(".round-nav-board").forEach(board => {
      const grid = board.querySelector(".round-nav-grid");
      const navService = serviceFromRoundNav(board);
      if (grid && navService) rebuildGrid(grid, navService, true);
    });
  }

  function ensureManualBedUi() {
    const filter = document.querySelector(".round-service-filter");
    if (!filter || filter.querySelector("[data-epivida-add-bed-toggle]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "round-add-bed-toggle";
    button.dataset.epividaAddBedToggle = "true";
    button.title = "Agregar cama manual";
    button.setAttribute("aria-label", "Agregar cama manual");
    button.innerHTML = "&#9998;";

    const form = document.createElement("form");
    form.className = "round-add-bed-form";
    form.hidden = true;
    form.dataset.epividaAddBedForm = "true";
    form.innerHTML = `
      <select aria-label="Servicio para cama nueva"></select>
      <input type="text" name="bed" placeholder="Nombre de cama" autocomplete="off" />
      <button type="submit" class="iaas-button compact">Agregar</button>
    `;
    const select = form.querySelector("select");
    SERVICE_OPTIONS.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    select.value = selectedPreventiveService() || "MEDICINA INTERNA";

    const anchor = [...filter.querySelectorAll("button")].find(item => canonicalService(item.textContent) === "AMBULATORIO")
      || filter.querySelector("button:last-of-type");
    if (anchor) anchor.after(button, form);
    else filter.append(button, form);

    button.addEventListener("click", () => {
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector("input")?.focus();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const targetService = canonicalService(select.value);
      const bedName = clean(form.elements.bed?.value);
      if (!saveManualBed(targetService, bedName)) return;
      form.elements.bed.value = "";
      form.hidden = true;
      [...filter.querySelectorAll("button:not(.round-add-bed-toggle)")].find(item => canonicalService(item.textContent) === targetService)?.click();
      document.querySelectorAll(".bed-board.preventive .bed-board-grid").forEach(grid => {
        delete grid.dataset.epividaCatalogSignature;
      });
      setTimeout(() => {
        runBedCatalog();
        adjustPreventiveOverdueTiles();
      }, 80);
    });
  }

  function isEntrySaved(entry) {
    if (!entry) return false;
    if (entry.reviewedAt || entry.localSavedAt || entry.serverConfirmedAt) return true;
    return ["revisado", "alerta", "incompleto"].includes(String(entry.status || "").toLowerCase());
  }

  function timestampMs(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function censusEntryTimestamp(store, date, row) {
    const fromRow = timestampMs(row?.importedAt || row?.createdAt || row?.censusImportedAt || row?.ingresoCensoAt || row?.updatedAt);
    if (fromRow) return fromRow;
    const fromCensus = timestampMs(store.dailyCensus?.[date]?.importedAt || store.dailyCensus?.[date]?.createdAt);
    if (fromCensus) return fromCensus;
    return timestampMs(`${date}T00:00:00`);
  }

  function isRowOverdue(store, date, row) {
    const entry = store.dailyRounds?.[date]?.entries?.[row?.patientId];
    if (!row?.patientId || isEntrySaved(entry)) return false;
    const enteredAt = censusEntryTimestamp(store, date, row);
    return Boolean(enteredAt && Date.now() - enteredAt >= 24 * HOUR);
  }

  function routeRoundDate() {
    const match = String(location.hash || "").match(/^#\/ronda\/([^/]+)/);
    return match?.[1] || "";
  }

  function adjustPreventiveOverdueTiles() {
    const date = routeRoundDate();
    if (!date) return;
    const store = loadJson(STORE_KEY, {});
    document.querySelectorAll(".bed-board.preventive .bed-board-grid .bed-tile[href]").forEach(tile => {
      const patientId = patientIdFromTile(tile);
      const row = store.dailyCensus?.[date]?.patients?.[patientId];
      if (!row) return;
      const overdue = isRowOverdue(store, date, row);
      if (overdue) {
        tile.classList.remove("available");
        tile.classList.add("overdue");
        tile.title = "Pendiente de ronda preventiva por mas de 24 horas";
      } else if (tile.classList.contains("overdue")) {
        tile.classList.remove("overdue");
        tile.classList.add("available");
        tile.title = "Disponible para ronda preventiva";
      }
      const bed = tileBed(tile);
      tile.setAttribute("aria-label", `${bed}: ${tile.title}`);
    });
    document.querySelectorAll(".bed-board.preventive").forEach(updateTotals);
  }

  function cleanupPreventivePanels() {
    document.querySelectorAll(".preventive-command-hero").forEach(node => node.remove());
    document.querySelectorAll(".metric-card, .round-metric, .stat-card").forEach(card => {
      if (text(card.textContent).includes("SYNC PENDIENTE")) card.remove();
    });
  }

  function routePatient() {
    const hash = String(location.hash || "");
    let match = hash.match(/^#\/ronda\/([^/]+)\/paciente\/([^/]+)/);
    if (match) return { mode: "preventive", date: match[1], patientId: decodeURIComponent(match[2]) };
    match = hash.match(/^#\/seguimiento-iaas\/([^/]+)\/paciente\/([^/]+)/);
    if (match) return { mode: "iaas", date: match[1], patientId: decodeURIComponent(match[2]) };
    return null;
  }

  function deviceDisplayName(ep = {}) {
    return [ep.deviceType, ep.deviceSubtype].map(clean).filter(Boolean).join(" - ") || ep.preventivePackage || ep.packageType || "Dispositivo";
  }

  function isDeviceActive(ep = {}, date = "") {
    const removed = normalizeDate(ep.removalDate);
    if (removed && (!date || removed <= date)) return false;
    return text(ep.status || "activo") !== "RETIRADO";
  }

  function compareDevices(a, b, date) {
    const aActive = isDeviceActive(a, date);
    const bActive = isDeviceActive(b, date);
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (aActive) {
      return daysBetween(b.installationDate, date) - daysBetween(a.installationDate, date)
        || deviceDisplayName(a).localeCompare(deviceDisplayName(b), "es");
    }
    const aRemoval = normalizeDate(a.removalDate) || "";
    const bRemoval = normalizeDate(b.removalDate) || "";
    return String(bRemoval).localeCompare(String(aRemoval))
      || deviceDisplayName(a).localeCompare(deviceDisplayName(b), "es");
  }

  function patientDevices(store, route) {
    return Object.values(store.deviceEpisodes || {})
      .filter(ep => ep.patientId === route.patientId)
      .filter(ep => {
        const installed = normalizeDate(ep.installationDate);
        return !installed || installed <= route.date;
      })
      .sort((a, b) => compareDevices(a, b, route.date));
  }

  function cardKeyFromEpisode(ep) {
    return `${text(deviceDisplayName(ep))}|${normalizeDate(ep.installationDate)}`;
  }

  function cardKeyFromNode(card) {
    const name = text(card.querySelector("strong")?.textContent);
    const installText = [...card.querySelectorAll("span")].map(span => span.textContent).find(value => text(value).includes("INSTAL"));
    return `${name}|${normalizeDate(clean(installText || "").replace(/.*?:\s*/, ""))}`;
  }

  function makeDeviceCard(ep, date, compact = true) {
    const active = isDeviceActive(ep, date);
    const article = document.createElement("article");
    article.className = compact
      ? `device-card compact-device-card ${active ? "active" : "removed"} epivida-added-device-card`
      : `iaas-invasive-card ${active ? "active" : "inactive"} epivida-added-device-card`;
    const endDate = normalizeDate(ep.removalDate);
    const days = daysBetween(ep.installationDate, active ? date : endDate || date);
    if (compact) {
      article.innerHTML = `
        <strong></strong>
        <span>French: ${clean(ep.french || ep.deviceFrench) || "S/D"}</span>
        <span>Instalacion: ${displayDate(ep.installationDate) || "S/D"}</span>
        <span>Retiro: ${displayDate(endDate) || "Activo"}</span>
        <em>${days} dia${days === 1 ? "" : "s"}</em>
      `;
    } else {
      article.innerHTML = `
        <strong></strong>
        <span>Instalacion: ${displayDate(ep.installationDate) || "S/D"}</span>
        <span>Retiro: ${displayDate(endDate) || "Activo"}</span>
      `;
    }
    article.querySelector("strong").textContent = deviceDisplayName(ep);
    return article;
  }

  function decoratePreventiveDevicePanel(route, episodes) {
    const panels = [...document.querySelectorAll(".patient-round .iaas-panel")];
    const panel = panels.find(item => text(item.querySelector("h2")?.textContent).includes("INVASIVOS"));
    if (!panel) return;
    const list = panel.querySelector(".device-list.compact-device-grid") || document.createElement("div");
    if (!list.parentElement) {
      list.className = "device-list compact-device-grid";
      panel.querySelector(".iaas-panel-head")?.after(list);
    }
    const signature = episodes.map(ep => `${ep.episodeId || cardKeyFromEpisode(ep)}:${normalizeDate(ep.removalDate)}:${ep.status}`).join("|");
    if (list.dataset.epividaDeviceSignature === signature) return;

    panel.querySelector("h2").textContent = "Invasivos activos e inactivos";
    const description = panel.querySelector(".iaas-panel-head p");
    if (description) description.textContent = "Activos en rojo por mayor tiempo; retirados en azul por retiro mas reciente.";
    const activeCount = episodes.filter(ep => isDeviceActive(ep, route.date)).length;
    const badge = panel.querySelector(".iaas-panel-actions .badge");
    if (badge) badge.textContent = activeCount ? `${activeCount} activo(s)` : "Sin invasivos activos";

    const existingCards = [...list.querySelectorAll(".compact-device-card:not(.epivida-added-device-card)")];
    const byKey = new Map();
    existingCards.forEach(card => {
      const key = cardKeyFromNode(card);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(card);
    });
    const used = new Set();
    const nodes = episodes.map(ep => {
      const key = cardKeyFromEpisode(ep);
      const node = (byKey.get(key) || []).find(card => !used.has(card));
      if (node) {
        used.add(node);
        node.classList.toggle("active", isDeviceActive(ep, route.date));
        node.classList.toggle("removed", !isDeviceActive(ep, route.date));
        return node;
      }
      return makeDeviceCard(ep, route.date, true);
    });
    if (nodes.length) list.replaceChildren(...nodes);
    else list.replaceChildren();
    list.dataset.epividaDeviceSignature = signature;
  }

  function decorateIaasDeviceSummary(route, episodes) {
    const list = document.querySelector(".iaas-invasive-summary .iaas-invasive-list");
    if (!list) return;
    const signature = episodes.map(ep => `${ep.episodeId || cardKeyFromEpisode(ep)}:${normalizeDate(ep.removalDate)}:${ep.status}`).join("|");
    if (list.dataset.epividaDeviceSignature === signature) return;
    list.replaceChildren(...episodes.map(ep => makeDeviceCard(ep, route.date, false)));
    list.dataset.epividaDeviceSignature = signature;
  }

  function decorateDeviceOrdering() {
    const route = routePatient();
    if (!route) return;
    const episodes = patientDevices(loadJson(STORE_KEY, {}), route);
    if (route.mode === "preventive") decoratePreventiveDevicePanel(route, episodes);
    decorateIaasDeviceSummary(route, episodes);
  }

  function adjacentHash(direction) {
    const route = routePatient();
    if (!route || route.mode !== "preventive" || !direction) return "";
    const store = loadJson(STORE_KEY, {});
    const row = store.dailyCensus?.[route.date]?.patients?.[route.patientId] || {};
    const patient = store.patients?.[route.patientId] || {};
    const service = serviceKey(patient.currentService || row.service);
    const rows = Object.values(store.dailyCensus?.[route.date]?.patients || {})
      .filter(item => !service || serviceKey(item.service) === service)
      .sort((a, b) => clean(a.bed).localeCompare(clean(b.bed), "es", { numeric: true }));
    const index = rows.findIndex(item => item.patientId === route.patientId);
    if (index < 0) return "";
    const target = rows[direction === "next" ? index + 1 : index - 1];
    return target?.patientId ? `#/ronda/${route.date}/paciente/${encodeURIComponent(target.patientId)}` : `#/ronda/${route.date}`;
  }

  function installSaveNavigationShim() {
    if (window.__epividaPreventiveSaveShim) return;
    window.__epividaPreventiveSaveShim = true;
    window.addEventListener("click", event => {
      const button = event.target.closest?.(".patient-round .round-save-bar button, .patient-round .round-save-bar .iaas-button");
      const label = text(button?.textContent);
      if (!button || !label.includes("GUARDAR") || (!label.includes("SIGUIENTE") && !label.includes("ANTERIOR"))) return;
      const targetHash = adjacentHash(label.includes("SIGUIENTE") ? "next" : "previous");
      if (!targetHash) return;
      const original = button.textContent;
      button.textContent = "Guardar";
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = original;
      }, 40);
      window.setTimeout(() => {
        try {
          const payload = loadJson(POST_SAVE_KEY, {});
          if (payload && typeof payload === "object") {
            payload.targetHash = targetHash;
            saveJson(POST_SAVE_KEY, payload);
          }
        } catch {
          // The direct save repair still owns persistence; this shim only corrects navigation.
        }
        if (location.hash !== targetHash) location.hash = targetHash;
      }, 90);
    }, true);
  }

  function installStyles() {
    if (document.getElementById("epivida-preventive-upgrade-style")) return;
    const style = document.createElement("style");
    style.id = "epivida-preventive-upgrade-style";
    style.textContent = `
      .preventive-command-hero { display: none !important; }
      .command-shell .preventive-command,
      .preventive-command { display: block !important; }
      .preventive-package-grid {
        width: 100% !important;
        grid-template-columns: repeat(4, minmax(210px, 1fr)) !important;
      }
      .round-add-bed-toggle {
        width: 38px !important;
        min-width: 38px !important;
        flex: 0 0 38px !important;
        padding-inline: 0 !important;
        font-size: 18px !important;
        line-height: 1 !important;
      }
      .round-add-bed-form {
        width: min(100%, 560px);
        display: grid;
        grid-template-columns: minmax(180px, .95fr) minmax(150px, .8fr) auto;
        gap: 8px;
        align-items: center;
        margin-left: 6px;
      }
      .round-add-bed-form[hidden] { display: none !important; }
      .round-add-bed-form select,
      .round-add-bed-form input {
        min-height: 38px;
        border: 1px solid rgba(204, 214, 235, .95);
        border-radius: 999px;
        padding: 0 12px;
        color: #0d1b3f;
        background: #fff;
        font: inherit;
        font-weight: 800;
      }
      .compact-device-card.active {
        border-color: rgba(239, 68, 68, .55) !important;
        background: #fff7f8 !important;
      }
      .compact-device-card.removed {
        border-color: rgba(14, 116, 184, .48) !important;
        background: #eff8ff !important;
      }
      .compact-device-card.active strong { color: #dc2626 !important; }
      .compact-device-card.removed strong { color: #1976b9 !important; }
      @media (max-width: 1180px) {
        .preventive-package-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      }
      @media (max-width: 760px) {
        .preventive-package-grid,
        .round-add-bed-form { grid-template-columns: 1fr !important; }
        .round-add-bed-toggle { flex: 0 0 38px !important; }
      }
    `;
    document.head.append(style);
  }

  function run() {
    installStyles();
    cleanupPreventivePanels();
    ensureManualBedUi();
    runBedCatalog();
    adjustPreventiveOverdueTiles();
    decorateDeviceOrdering();
  }

  installSaveNavigationShim();
  const schedule = () => [0, 80, 250, 700].forEach(delay => window.setTimeout(run, delay));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
  window.addEventListener("hashchange", schedule);
  window.addEventListener("storage", schedule);
  const observer = new MutationObserver(() => requestAnimationFrame(run));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();

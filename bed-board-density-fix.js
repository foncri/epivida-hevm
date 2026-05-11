(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
  const prefixed = (prefix, start, end, spaced = true) => range(start, end).map(number => `${prefix}${spaced ? " " : ""}${number}`);
  const BED_CATALOG = {
    "MEDICINA INTERNA": [...range(1, 30), "AISLADO 1", "AISLADO 2", "AISLADO 3", "OBS 1", "OBS 2"],
    "CIRUGIA Y TRAUMATOLOGIA": [...range(43, 66), "AISLADO 1", "AISLADO 2", "AISLADO 3"],
    "PEDIATRIA": [
      ...range(67, 74),
      "AISLADO 1",
      "ESCOLARES 1",
      "ESCOLARES 2",
      "ESCOLARES 3",
      "UTIP 1",
      "UTIP 2",
      "UTIP 3",
      ...prefixed("CUNEROS", 1, 6),
      ...prefixed("UCIN", 1, 4)
    ],
    "CUNEROS": prefixed("CUNEROS", 1, 6),
    "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES": prefixed("UCIN", 1, 4),
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS": prefixed("UTIP", 1, 3),
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS": range(1, 8),
    "GINECOLOGIA Y OBSTETRICIA": prefixed("ALOJAMIENTO", 1, 5),
    "URGENCIAS": [
      ...prefixed("F", 1, 4, false),
      ...prefixed("UX", 1, 11),
      ...prefixed("P", 1, 5, false),
      "AISLADO P",
      "AISLADO 1",
      "AISLADO 2",
      "CHOQUE",
      ...prefixed("B", 1, 14, false)
    ]
  };

  function text(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  }

  function canonicalService(value) {
    const key = text(value);
    if (!key || key === "TODOS") return "";
    if (key.includes("MEDICINA INTERNA") || key === "MI") return "MEDICINA INTERNA";
    if (key.includes("CIRUGIA") || key.includes("TRAUMATOLOG") || /\b(CX|TX)\b/.test(key)) return "CIRUGIA Y TRAUMATOLOGIA";
    if (key.includes("CUNERO")) return "CUNEROS";
    if (key.includes("NEONATAL") || key.includes("UCIN")) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
    if (key.includes("PEDIATRIC") || key.includes("UCIP") || key.includes("UTIP")) return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
    if (key.includes("PEDIATRIA") || /\bPED\b/.test(key)) return "PEDIATRIA";
    if (key.includes("ADULTOS") || key.includes("UCIA")) return "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS";
    if (key.includes("GINECO") || key.includes("OBSTETRIC") || key.includes("GYO") || key === "GO") return "GINECOLOGIA Y OBSTETRICIA";
    if (key.includes("URGENCIA") || key === "URG") return "URGENCIAS";
    return BED_CATALOG[key] ? key : "";
  }

  function bedKey(value) {
    return text(value)
      .replace(/^CAMA\s+/, "")
      .replace(/^CAM\s+/, "")
      .replace(/^ALOJA\b/, "ALOJAMIENTO")
      .replace(/\bUCIP\b/g, "UTIP")
      .replace(/\bESCOLAR\b/g, "ESCOLARES")
      .replace(/[\s.-]+/g, "");
  }

  function tileBed(tile) {
    return tile?.querySelector("strong")?.textContent || "";
  }

  function selectedPreventiveService() {
    const active = document.querySelector(".round-service-filter button.active");
    if (!active) return "";
    const titleService = active.getAttribute("title")?.split(":")[0] || "";
    return canonicalService(titleService || active.textContent);
  }

  function serviceFromRoundNav(board) {
    const label = board.querySelector(".round-nav-head strong")?.textContent || "";
    return canonicalService(label.replace(/^Camas\s+/i, ""));
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function patientIdFromTile(tile) {
    const href = tile?.getAttribute?.("href") || "";
    const match = href.match(/\/paciente\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function rowServiceForPatient(patientId) {
    if (!patientId) return "";
    const store = loadStore();
    const dates = Object.keys(store.dailyCensus || {}).sort().reverse();
    for (const date of dates) {
      const row = store.dailyCensus?.[date]?.patients?.[patientId];
      const service = String(row?.service || row?.currentService || "").split(/\s*\/\s*/).map(canonicalService).find(Boolean);
      if (service) return service;
    }
    const patient = store.patients?.[patientId];
    return canonicalService(patient?.currentService || "");
  }

  function serviceFromBed(value, currentService = "") {
    const key = bedKey(value);
    if (/^F[1-4]$/.test(key) || /^UX(?:[1-9]|1[01])$/.test(key) || /^P[1-5]$/.test(key) || /^B(?:[1-9]|1[0-4])$/.test(key) || key === "AISLADOP" || key === "CHOQUE") return "URGENCIAS";
    if (/^ALOJAMIENTO[1-5]$/.test(key)) return "GINECOLOGIA Y OBSTETRICIA";
    if (/^CUNEROS[1-6]$/.test(key)) return "CUNEROS";
    if (/^UCIN[1-4]$/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
    if (/^UTIP[1-3]$/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
    const n = Number(key);
    if (Number.isFinite(n)) {
      if (n >= 43 && n <= 66) return "CIRUGIA Y TRAUMATOLOGIA";
      if (n >= 67 && n <= 74) return "PEDIATRIA";
      if (currentService === "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS" && n >= 1 && n <= 8) return currentService;
      if (currentService === "MEDICINA INTERNA" && n >= 1 && n <= 30) return currentService;
    }
    return "";
  }

  function makeVacantTile(bed, roundNav = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;
    button.className = `bed-tile ${roundNav ? "round-nav-tile " : ""}vacant epivida-catalog-vacant`;
    button.title = "Cama desocupada";
    button.setAttribute("aria-label", `${bed}: Cama desocupada`);
    button.innerHTML = `<strong></strong><span>Vacia</span><small>Sin paciente</small>`;
    button.querySelector("strong").textContent = bed;
    return button;
  }

  function rebuildGrid(grid, service, roundNav = false) {
    const catalog = BED_CATALOG[service];
    if (!catalog?.length || grid.dataset.epividaCatalogService === service) return;
    const existing = [...grid.querySelectorAll(".bed-tile")];
    const byBed = new Map();
    existing.forEach(tile => {
      const key = bedKey(tileBed(tile));
      if (key && !byBed.has(key)) byBed.set(key, tile);
    });
    const used = new Set();
    const next = catalog.map(bed => {
      const key = bedKey(bed);
      const tile = byBed.get(key);
      if (tile) {
        used.add(key);
        return tile;
      }
      return makeVacantTile(bed, roundNav);
    });
    existing.forEach(tile => {
      const key = bedKey(tileBed(tile));
      if (!used.has(key) && !tile.classList.contains("vacant") && !tile.disabled) next.push(tile);
    });
    grid.replaceChildren(...next);
    grid.dataset.epividaCatalogService = service;
  }

  function updateTotals(board) {
    const tiles = [...board.querySelectorAll(".bed-board-grid .bed-tile")];
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
      strong.textContent = pending ? `${pending} pendientes` : "";
      strong.hidden = !pending;
    }
  }

  function inferIaasService(board) {
    const occupiedTiles = [...board.querySelectorAll(".bed-board-grid .bed-tile:not(.vacant):not(.locked)")];
    const services = new Set(occupiedTiles.map(tile => {
      const rowService = rowServiceForPatient(patientIdFromTile(tile));
      return serviceFromBed(tileBed(tile), rowService) || rowService;
    }).filter(Boolean));
    return services.size === 1 ? [...services][0] : "";
  }

  function run() {
    const preventiveService = selectedPreventiveService();
    document.querySelectorAll(".bed-board.preventive").forEach(board => {
      const grid = board.querySelector(".bed-board-grid");
      if (grid && preventiveService) {
        rebuildGrid(grid, preventiveService, false);
        updateTotals(board);
      }
    });
    document.querySelectorAll(".bed-board.iaas").forEach(board => {
      const grid = board.querySelector(".bed-board-grid");
      const service = inferIaasService(board);
      if (grid && service) {
        rebuildGrid(grid, service, false);
        updateTotals(board);
      }
    });
    document.querySelectorAll(".round-nav-board").forEach(board => {
      const grid = board.querySelector(".round-nav-grid");
      const service = serviceFromRoundNav(board);
      if (grid && service) rebuildGrid(grid, service, true);
    });
  }

  const observer = new MutationObserver(() => requestAnimationFrame(run));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(run, 80));
  window.addEventListener("storage", () => setTimeout(run, 80));
})();

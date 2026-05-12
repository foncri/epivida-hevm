(() => {
  "use strict";

  if (window.__epividaPreventiveBedPrerender) return;
  window.__epividaPreventiveBedPrerender = true;

  const CUSTOM_BEDS_KEY = "epivida-preventive-custom-beds-v1";
  const nativeReplaceChildren = Element.prototype.replaceChildren;
  const nativeAppend = Element.prototype.append;
  const nativePrepend = Element.prototype.prepend;
  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
  const prefixed = (prefix, start, end, spaced = true) => range(start, end).map(number => `${prefix}${spaced ? " " : ""}${number}`);
  let internalMutation = false;

  const CATALOGS = {
    "MEDICINA INTERNA": [...range(1, 30), "AIS 1 MI", "AIS 2 MI", "AIS 3 MI", "OBS 1", "OBS 2"],
    "CIRUGIA Y TRAUMATOLOGIA": [...range(43, 66), "AIS 1 CX", "AIS 2 CX", "AIS 3 CX"],
    PEDIATRIA: [...range(67, 74), "AIS 1 PED", "AIS 2 PED", "AIS 3 PED", "ESC 1", "ESC 2", "ESC 3"],
    CUNEROS: ["CUN 1", "CUN 2", "CUN 3"],
    "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES": ["UCIN 1", "UCIN 2"],
    HEMODIALISIS: prefixed("HEM", 1, 100),
    HEMODIÁLISIS: prefixed("HEM", 1, 100),
    "GINECOLOGIA Y OBSTETRICIA": prefixed("ALOJ", 1, 5),
    "GINECOLOGÍA Y OBSTETRICIA": prefixed("ALOJ", 1, 5),
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS": ["UTIP 1"],
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS": ["UTIP 1"],
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS": ["UCIA 2", "UCIA 3", "UCIA AIS 4", "UCIA 5", "UCIA 6", "UCIA AIS 7", "UCIA 8"],
    URGENCIAS: [
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

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function normalized(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  }

  function canonicalService(value) {
    const key = normalized(value);
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
    if (key.includes("ONCOLOGIA")) return "ONCOLOGIA";
    if (key.includes("AMBULATORIO")) return "AMBULATORIO";
    return CATALOGS[key] ? key : "";
  }

  function bedKey(value) {
    return normalized(value)
      .replace(/^CAMA\s+/, "")
      .replace(/^CAM\s+/, "")
      .replace(/^AISLADO\b/, "AIS")
      .replace(/^ALOJA\b/, "ALOJ")
      .replace(/^ALOJAMIENTO\b/, "ALOJ")
      .replace(/\bCUNEROS\b/g, "CUN")
      .replace(/\bESCOLARES?\b/g, "ESC")
      .replace(/\bUCIP\b/g, "UTIP")
      .replace(/[\s.-]+/g, "");
  }

  function aliasesForBed(value, service) {
    const key = bedKey(value);
    const keys = new Set([key]);
    const isolated = key.match(/^AIS([1-3])$/);
    if (isolated) {
      const suffix = service === "MEDICINA INTERNA" ? "MI"
        : service === "CIRUGIA Y TRAUMATOLOGIA" ? "CX"
          : service === "PEDIATRIA" ? "PED"
            : "";
      if (suffix) keys.add(`AIS${isolated[1]}${suffix}`);
    }
    const aloj = key.match(/^ALOJ(?:AMIENTO)?([1-5])$/);
    if (aloj) keys.add(`ALOJ${aloj[1]}`);
    const cun = key.match(/^CUN(?:EROS)?([1-6])$/);
    if (cun) keys.add(`CUN${cun[1]}`);
    const esc = key.match(/^ESC(?:OLARES)?([1-3])$/);
    if (esc) keys.add(`ESC${esc[1]}`);
    const hem = key.match(/^HEM(?:ODIALISIS)?([1-9][0-9]?|100)$/);
    if (hem) keys.add(`HEM${hem[1]}`);
    if (service === "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS" && /^[2-8]$/.test(key)) {
      keys.add(key === "4" || key === "7" ? `UCIAAIS${key}` : `UCIA${key}`);
    }
    if (service === "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS" && key === "UCIP1") keys.add("UTIP1");
    return [...keys].filter(Boolean);
  }

  function loadCustomBeds(service) {
    try {
      const data = JSON.parse(localStorage.getItem(CUSTOM_BEDS_KEY) || "null");
      if (Array.isArray(data)) {
        return data.filter(item => canonicalService(item?.service) === service).map(item => clean(item?.bed)).filter(Boolean);
      }
      if (data && typeof data === "object") {
        return (data[service] || []).map(clean).filter(Boolean);
      }
    } catch {
      return [];
    }
    return [];
  }

  function catalogFor(service) {
    const catalog = CATALOGS[service] || [];
    const custom = loadCustomBeds(service);
    const seen = new Set();
    return [...catalog, ...custom].filter(bed => {
      const key = bedKey(bed);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function selectedService(root) {
    const active = root?.querySelector?.(".round-service-filter button.active:not(.round-add-bed-toggle)")
      || document.querySelector(".round-service-filter button.active:not(.round-add-bed-toggle)");
    return canonicalService(active?.getAttribute("title")?.split(":")[0] || active?.textContent || "");
  }

  function serviceFromRoundNav(board) {
    return canonicalService((board.querySelector(".round-nav-head strong")?.textContent || "").replace(/^Camas\s+/i, ""));
  }

  function tileBed(tile) {
    return tile?.querySelector("strong")?.textContent || "";
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

  function renameTile(tile, bed) {
    const label = tile.querySelector("strong");
    if (label) label.textContent = bed;
    const title = tile.getAttribute("title") || "Cama";
    tile.setAttribute("aria-label", `${bed}: ${title}`);
  }

  function rebuildGrid(grid, service, roundNav = false) {
    const catalog = catalogFor(service);
    if (!grid || !catalog.length) return;
    const signature = `${service}|${catalog.map(bedKey).join("|")}`;
    if (grid.dataset.epividaPrerenderCatalog === signature) return;

    const existing = [...grid.querySelectorAll(".bed-tile")];
    const byKey = new Map();
    existing.forEach(tile => {
      aliasesForBed(tileBed(tile), service).forEach(key => {
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(tile);
      });
    });

    const usedTiles = new Set();
    const next = catalog.map(bed => {
      const key = bedKey(bed);
      const tile = (byKey.get(key) || []).find(candidate => !usedTiles.has(candidate));
      if (!tile) return makeVacantTile(bed, roundNav);
      usedTiles.add(tile);
      renameTile(tile, bed);
      return tile;
    });

    existing.forEach(tile => {
      if (!usedTiles.has(tile) && !tile.disabled && !tile.classList.contains("vacant")) next.push(tile);
    });

    internalMutation = true;
    try {
      nativeReplaceChildren.call(grid, ...next);
    } finally {
      internalMutation = false;
    }
    grid.dataset.epividaPrerenderCatalog = signature;
  }

  function updateTotals(board) {
    const totals = board.querySelector(".bed-board-totals");
    if (!totals) return;
    const tiles = [...board.querySelectorAll(".bed-board-grid .bed-tile")];
    const spans = totals.querySelectorAll("span");
    if (spans[0]) spans[0].textContent = `${tiles.length} cama(s)`;
    if (spans[1]) spans[1].textContent = `${tiles.filter(tile => tile.classList.contains("reviewed")).length} vistas`;
  }

  function processRoot(root) {
    if (!root || internalMutation) return;
    const service = selectedService(root);
    const preventiveBoards = [];
    if (root.matches?.(".bed-board.preventive")) preventiveBoards.push(root);
    root.querySelectorAll?.(".bed-board.preventive").forEach(board => preventiveBoards.push(board));
    preventiveBoards.forEach(board => {
      if (!service) return;
      rebuildGrid(board.querySelector(".bed-board-grid"), service, false);
      updateTotals(board);
    });

    const navBoards = [];
    if (root.matches?.(".round-nav-board")) navBoards.push(root);
    root.querySelectorAll?.(".round-nav-board").forEach(board => navBoards.push(board));
    navBoards.forEach(board => {
      const navService = serviceFromRoundNav(board);
      if (navService) rebuildGrid(board.querySelector(".round-nav-grid"), navService, true);
    });
  }

  function processNodes(nodes) {
    nodes.forEach(node => {
      if (node?.nodeType === Node.ELEMENT_NODE || node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE) processRoot(node);
    });
  }

  Element.prototype.replaceChildren = function patchedReplaceChildren(...nodes) {
    if (!internalMutation) processNodes(nodes);
    return nativeReplaceChildren.apply(this, nodes);
  };

  Element.prototype.append = function patchedAppend(...nodes) {
    if (!internalMutation) processNodes(nodes);
    return nativeAppend.apply(this, nodes);
  };

  Element.prototype.prepend = function patchedPrepend(...nodes) {
    if (!internalMutation) processNodes(nodes);
    return nativePrepend.apply(this, nodes);
  };
})();

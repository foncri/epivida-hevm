(() => {
  "use strict";

  if (window.__epividaHospitalBedServiceNormalizer20260602) return;
  window.__epividaHospitalBedServiceNormalizer20260602 = true;

  const LEGACY_PATCH_DEBUG = window.EPIVIDA_LEGACY_PATCH_DEBUG === true;

  function injectStyle() {
    if (document.getElementById("epivida-import-remove-patients-style")) return;
    const style = document.createElement("style");
    style.id = "epivida-import-remove-patients-style";
    style.textContent = `
      .import-removal-panel { margin: .85rem 0; padding: .85rem; border: 1px solid rgba(148,163,184,.35); border-radius: 8px; background: rgba(255,255,255,.72); }
      .import-removal-panel h3 { margin: 0 0 .6rem; font-size: 1rem; color: #0f172a; }
      .import-removal-list { display: grid; gap: .5rem; max-height: 360px; overflow: auto; }
      .import-removal-row { display: grid; grid-template-columns: minmax(90px, 130px) 1fr minmax(120px, auto); gap: .6rem; align-items: center; padding: .55rem .65rem; border: 1px solid rgba(148,163,184,.28); border-radius: 8px; background: #fff; }
      .import-removal-row.excluded { opacity: .62; background: #f8fafc; }
      .import-removal-row strong { color: #0f172a; font-size: .88rem; }
      .import-removal-row span { color: #334155; font-size: .84rem; }
      .import-removal-row small { color: #64748b; font-weight: 700; }
      .import-removal-row .iaas-button { justify-self: end; white-space: nowrap; }
      @media (max-width: 720px) {
        .import-removal-row { grid-template-columns: 1fr; }
        .import-removal-row .iaas-button { justify-self: stretch; }
      }
    `;
    document.head.append(style);
  }

  function replaceOnce(source, pattern, replacement, label) {
    const next = source.replace(pattern, replacement);
    if (next === source && LEGACY_PATCH_DEBUG) console.warn("No se pudo aplicar normalizador de camas:", label);
    return next;
  }

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const normalized = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  function detectDelimiter(lines) {
    if (lines.some(line => line.includes("\t"))) return "\t";
    return [",", ";", "|"]
      .map(delimiter => [delimiter, Math.max(...lines.map(line => line.split(delimiter).length))])
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  function preRepairHumanCensusText(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const delimiter = detectDelimiter(lines.filter(line => line.trim()));
    return lines.map(line => {
      if (!line.trim()) return line;
      const cells = line.split(delimiter);
      const first = clean(cells[0]);
      const key = normalized(first);
      if (/^CUN\s*\d+\b/.test(key)) cells[0] = first.replace(/^CUN\s*(\d+)/i, "CUNERO $1");
      if (/^OBSERVACI(?:ON|ONES)\s*\d+\b/.test(key)) cells[0] = first.replace(/^OBSERVACI(?:ON|ONES)\s*(\d+)/i, "OBS $1");
      if (/^AISLAD[OA]\s*\d+\b/.test(key)) cells[0] = first.replace(/^AISLAD[OA]\s*(\d+)/i, "AIS $1");
      return cells.join(delimiter);
    }).join("\n");
  }

  function repairImportTextareaBeforeLegacyRepair() {
    const textarea = document.querySelector?.("#import-text");
    if (!textarea?.value) return;
    const repaired = preRepairHumanCensusText(textarea.value);
    if (repaired === textarea.value) return;
    textarea.value = repaired;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function serviceSuffixFromLabel(service) {
    const key = normalized(service);
    if (key === "MEDICINA INTERNA") return "MI";
    if (key.includes("CIRUGIA") || key.includes("TRAUMATOLOG")) return "CX";
    if (key === "PEDIATRIA") return "PED";
    if (key.includes("URGENCIA")) return "URG";
    return "";
  }

  function serviceFromActiveFilter(root) {
    const active = root?.querySelector?.(".round-service-filter button.active:not(.round-add-bed-toggle)")
      || document.querySelector?.(".round-service-filter button.active:not(.round-add-bed-toggle)");
    return clean(active?.getAttribute?.("title")?.split(":")[0] || active?.textContent || "");
  }

  function serviceFromBoard(board) {
    const nav = clean(board?.querySelector?.(".round-nav-head strong")?.textContent || "").replace(/^Camas\s+/i, "");
    return nav || serviceFromActiveFilter(board);
  }

  function canonicalVisibleBedLabel(label, service) {
    const suffix = serviceSuffixFromLabel(service);
    if (!suffix) return clean(label);
    const key = normalized(label);
    const match = key.match(/^(AIS|OBS)\s*(\d+)(?:\s+(MI|CX|PED|URG))?$/);
    if (!match) return clean(label);
    return `${match[1]} ${match[2]} ${match[3] || suffix}`;
  }

  function renameTile(tile, label) {
    const strong = tile?.querySelector?.("strong");
    if (!strong) return;
    const previous = clean(strong.textContent);
    if (previous === label) return;
    strong.textContent = label;
    const title = tile.getAttribute?.("title") || "Cama";
    tile.setAttribute?.("aria-label", `${label}: ${title}`);
  }

  function normalizeBoardTiles(board) {
    const grid = board?.querySelector?.(".bed-board-grid, .round-nav-grid");
    if (!grid) return;
    const service = serviceFromBoard(board);
    const seen = new Map();
    [...grid.querySelectorAll(".bed-tile")].forEach(tile => {
      const strong = tile.querySelector?.("strong");
      const label = canonicalVisibleBedLabel(strong?.textContent || "", service);
      renameTile(tile, label);
      const key = normalized(label);
      const previous = seen.get(key);
      if (!previous) {
        seen.set(key, tile);
        return;
      }
      const previousVacant = previous.disabled || previous.classList?.contains("vacant");
      const currentVacant = tile.disabled || tile.classList?.contains("vacant");
      if (previousVacant && !currentVacant) {
        previous.remove?.();
        seen.set(key, tile);
      } else if (currentVacant) {
        tile.remove?.();
      }
    });
    const totals = board.querySelector?.(".bed-board-totals span");
    if (totals) totals.textContent = `${grid.querySelectorAll(".bed-tile").length} cama(s)`;
  }

  function normalizeVisibleBedBoards(root = document) {
    root.querySelectorAll?.(".bed-board.preventive, .round-nav-board").forEach(normalizeBoardTiles);
    if (root.matches?.(".bed-board.preventive, .round-nav-board")) normalizeBoardTiles(root);
  }

  function installRuntimeNormalizers() {
    document.addEventListener?.("click", event => {
      const button = event.target?.closest?.("button");
      if (!button || !/PEGAR\s+Y\s+VALIDAR\s+CENSO/i.test(normalized(button.textContent || ""))) return;
      repairImportTextareaBeforeLegacyRepair();
    }, true);
    const observer = window.MutationObserver ? new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes?.forEach(node => {
        if (node?.nodeType === Node.ELEMENT_NODE) normalizeVisibleBedBoards(node);
      }));
    }) : null;
    observer?.observe?.(document.body || document.documentElement, { childList: true, subtree: true });
    window.setTimeout?.(() => normalizeVisibleBedBoards(), 0);
  }

  function knownBedsSource() {
    return `  // epividaAisPKnownBedsForBoard: AIS P queda integrado en el catalogo general de camas.
  const KNOWN_SERVICE_BEDS = {
    "MEDICINA INTERNA": [
      ...Array.from({ length: 30 }, (_, index) => String(index + 1)),
      "AIS 1 MI", "AIS 2 MI", "AIS 3 MI", "OBS 1 MI", "OBS 2 MI"
    ],
    "CIRUG\\u00cdA Y TRAUMATOLOG\\u00cdA": [
      ...Array.from({ length: 24 }, (_, index) => String(index + 43)),
      "AIS 1 CX", "AIS 2 CX", "AIS 3 CX", "OBS 1 CX", "OBS 2 CX"
    ],
    "PEDIATR\\u00cdA": [
      ...Array.from({ length: 8 }, (_, index) => String(index + 67)),
      "AIS 1 PED", "AIS 2 PED", "AIS 3 PED", "ESC 1", "ESC 2", "ESC 3"
    ],
    CUNEROS: ["CUN 1", "CUN 2", "CUN 3"],
    "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES": ["UCIN 1", "UCIN 2"],
    "HEMODI\\u00c1LISIS": Array.from({ length: 100 }, (_, index) => "HEM " + (index + 1)),
    "GINECOLOG\\u00cdA Y OBSTETRICIA": Array.from({ length: 5 }, (_, index) => "ALOJ " + (index + 1)),
    "UNIDAD DE CUIDADOS INTENSIVOS PEDI\\u00c1TRICOS": ["UTIP 1"],
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS": ["UCIA 2", "UCIA 3", "UCIA AIS 4", "UCIA 5", "UCIA 6", "UCIA AIS 7", "UCIA 8"],
    URGENCIAS: [
      ...Array.from({ length: 4 }, (_, index) => "F" + (index + 1)),
      ...Array.from({ length: 11 }, (_, index) => "UX " + (index + 1)),
      ...Array.from({ length: 5 }, (_, index) => "P" + (index + 1)),
      "AIS P", "AISLADO 1", "AISLADO 2", "OBS 1 URG", "OBS 2 URG", "CHOQUE",
      ...Array.from({ length: 14 }, (_, index) => "B" + (index + 1))
    ]
  };`;
  }

  function helperSource() {
    return `  function epividaBedSuffixForService(service) {
    const key = normalizeText(primaryService(service) || service);
    if (key === "MEDICINA INTERNA") return "MI";
    if (key.includes("CIRUGIA") || key.includes("TRAUMATOLOG")) return "CX";
    if (key === "PEDIATRIA") return "PED";
    if (key === "CUNEROS") return "CUN";
    if (key.includes("NEONATAL") || key === "UCIN") return "UCIN";
    if (key.includes("PEDIATRICOS") || key === "UCIP" || key === "UTIP") return "UCIP";
    if (key.includes("ADULTOS") || key === "UCIA") return "UCIA";
    if (key.includes("GINECO") || key.includes("OBSTETRIC")) return "GYO";
    if (key.includes("HEMODI")) return "HEM";
    if (key.includes("ONCOLOG")) return "ONCO";
    if (key.includes("URGENCIA")) return "URG";
    return "";
  }

  function epividaServiceFromBedSuffix(suffix) {
    const key = normalizeText(suffix).replace(/\\s+/g, "");
    if (key === "MI") return "MEDICINA INTERNA";
    if (key === "CX" || key === "TX" || key === "CIR") return "CIRUG\\u00cdA Y TRAUMATOLOG\\u00cdA";
    if (key === "PED" || key === "PEDS") return "PEDIATR\\u00cdA";
    if (key === "CUN") return "CUNEROS";
    if (key === "UCIN") return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
    if (key === "UCIP" || key === "UTIP") return "UNIDAD DE CUIDADOS INTENSIVOS PEDI\\u00c1TRICOS";
    if (key === "UCIA") return "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS";
    if (key === "GYO" || key === "GO") return "GINECOLOG\\u00cdA Y OBSTETRICIA";
    if (key === "HEM" || key === "HD") return "HEMODI\\u00c1LISIS";
    if (key === "ONCO") return "ONCOLOG\\u00cdA";
    if (key === "URG") return "URGENCIAS";
    return "";
  }

  function epividaCleanBedToken(value) {
    if (normalizeDate(value)) return "";
    let text = cleanCell(value).toUpperCase();
    if (!text || /[\\/()]/.test(text) || text.length > 36) return "";
    text = text.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
    text = text
      .replace(/^CAMA\\s*[:#-]?\\s*/i, "")
      .replace(/^CAM\\s*[:#-]?\\s*/i, "")
      .replace(/^CAMILLA\\s*[:#-]?\\s*/i, "")
      .replace(/\\bAISLAD[OA]\\b/g, "AIS")
      .replace(/\\bOBSERVACIONES?\\b/g, "OBS")
      .replace(/\\bCUNEROS?\\b/g, "CUN")
      .replace(/\\bCUNERO\\b/g, "CUN")
      .replace(/\\bESCOLARES?\\b/g, "ESC")
      .replace(/\\bALOJAMIENTO\\b/g, "ALOJ")
      .replace(/\\bUCIP\\b/g, "UTIP")
      .replace(/[._-]+/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
    text = text.replace(/^(AIS|OBS|CUN|ESC|UX|URX|HEM|ALOJ|UTIP|UCIN|UCIA|F|P|B)(\\d+)/, "$1 $2");
    text = text.replace(/^(AIS|OBS)\\s*(\\d+)\\s*(MI|CX|TX|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEM|HD|ONCO|URG)\\b/, "$1 $2 $3");
    text = text.replace(/^AIS\\s*P$/, "AIS P");
    return text.trim();
  }

  function epividaServiceFromBed(value) {
    const bed = epividaCleanBedToken(value);
    const key = normalizeText(bed);
    const special = key.match(/^(AIS|OBS)\\s*\\d+\\s+([A-Z]{2,4})\\b/);
    if (special) return epividaServiceFromBedSuffix(special[2]);
    if (/^AIS\\s*P\\b/.test(key)) return "URGENCIAS";
    if (/^CUN\\s*\\d+\\b/.test(key)) return "CUNEROS";
    if (/^UTIP\\s*\\d+\\b|\\b(UCIP|UTIP)\\b/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS PEDI\\u00c1TRICOS";
    if (/^UCIN\\s*\\d+\\b|\\bUCIN\\b/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
    if (/^UCIA\\b|\\bUCIA\\b/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS";
    if (/^HEM\\s*\\d+\\b|\\b(HEMO|HD)\\b/.test(key)) return "HEMODI\\u00c1LISIS";
    if (/\\b(CX|TX|CIR|TRAUMA)\\b/.test(key)) return "CIRUG\\u00cdA Y TRAUMATOLOG\\u00cdA";
    if (/\\b(MI|MED\\s*INT)\\b/.test(key)) return "MEDICINA INTERNA";
    if (/\\b(PED|PEDS)\\b/.test(key)) return "PEDIATR\\u00cdA";
    if (/\\b(GYO|GO|ALOJ)\\b/.test(key)) return "GINECOLOG\\u00cdA Y OBSTETRICIA";
    if (/\\bONCO\\b/.test(key)) return "ONCOLOG\\u00cdA";
    if (/^(F|UX|URX|P|B)\\s*-?\\s*\\d+\\b|\\b(URG|URGENCIA)\\b/.test(key)) return "URGENCIAS";
    return "";
  }

  function epividaCanonicalBed(value, service = "") {
    let text = epividaCleanBedToken(value);
    if (!text) return "";
    text = text.replace(/^(\\d+)\\.0$/, "$1");
    const cun = text.match(/^CUN\\s*(\\d+)\\b/);
    if (cun) return "CUN " + cun[1];
    const aisOrObs = text.match(/^(AIS|OBS)\\s*(\\d+)\\s*([A-Z]{2,4})?\\b/);
    if (aisOrObs) {
      const suffix = aisOrObs[3] || epividaBedSuffixForService(service);
      return [aisOrObs[1], aisOrObs[2], suffix].filter(Boolean).join(" ");
    }
    if (/^AIS\\s*P\\b/.test(text)) return "AIS P";
    if (/^UTIP\\s*1\\b|^UCIP\\s*1\\b/.test(text)) return "UTIP 1";
    return text
      .replace(/\\s+(CX\\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HEM|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "")
      .replace(/(\\d+)[\\s-]+(CX\\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HEM|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "$1")
      .trim();
  }

  function epividaNormalizeImportLocation(serviceValue, bedValue, serviceBedValue) {
    const serviceBed = splitServiceBed(serviceBedValue || "");
    const rawBed = bedValue || serviceBed.bed || "";
    let service = normalizeImportService(serviceValue || serviceBed.service || "");
    const bedService = epividaServiceFromBed(rawBed);
    const bed = epividaCanonicalBed(rawBed, service || bedService);
    if (/^CUN\\s+\\d+\\b/.test(normalizeText(bed))) service = "CUNEROS";
    if (!service && bedService) service = bedService;
    return { service, bed };
  }

  function isOncologyOperationalService(service) {
    return normalizeText(primaryService(service) || service).includes("ONCOLOG");
  }

  function activeImportDraftRows(draft) {
    return (draft?.rows || []).filter(row => !row.excluded);
  }

  function rebuildImportDraftAfterExclusion(draft) {
    if (!draft) return draft;
    const activeRows = activeImportDraftRows(draft);
    const validRows = activeRows.filter(row => !row.errors.length);
    const mode = draft.importOptions?.mode || ui.importMode || "auto";
    const date = draft.plan?.date || ui.importDate || activeDate() || isoToday();
    const plan = buildImportPlanV2(validRows.map(row => row.normalized), date, { mode });
    const summary = {
      totalRows: draft.rows.length,
      activeRows: activeRows.length,
      removedRows: draft.rows.filter(row => row.excluded).length,
      validRows: validRows.length,
      errorRows: activeRows.filter(row => row.errors.length).length,
      warningRows: activeRows.filter(row => row.warnings.length).length,
      newPatients: plan.newPatients.length,
      updatedPatients: plan.updatedPatients.length,
      duplicates: plan.duplicates.length,
      conflicts: plan.conflicts.length,
      probableDischarges: plan.reconciliationMissing.length,
      automaticDischarges: (plan.automaticDischarges || []).length,
      reportedDischarges: plan.rows.filter(row => row.dischargeReported).length,
      existingDuplicates: (plan.duplicateExisting || []).length,
      importScope: plan.importScope
    };
    return {
      ...draft,
      plan,
      summary,
      conflicts: plan.conflicts,
      reconciliationMissing: plan.reconciliationMissing,
      automaticDischarges: plan.automaticDischarges || [],
      reportedDischarges: plan.rows.filter(row => row.dischargeReported)
    };
  }

  function toggleImportRowExclusion(rowIndex) {
    const draft = ui.importDraft;
    if (!draft) return;
    const row = (draft.rows || []).find(item => item.index === rowIndex);
    if (!row) return;
    row.excluded = !row.excluded;
    ui.importDraft = rebuildImportDraftAfterExclusion(draft);
    renderIaas();
  }

  function renderImportPatientRemovalPanel(draft) {
    const rows = draft?.rows || [];
    if (!rows.length) return "";
    return h("section", { class: "import-removal-panel" }, [
      h("h3", {}, ["Revisi\\u00f3n previa de pacientes"]),
      h("div", { class: "import-removal-list" }, rows.map(row => {
        const item = row.normalized || {};
        const excluded = Boolean(row.excluded);
        return h("article", { class: "import-removal-row" + (excluded ? " excluded" : "") }, [
          h("strong", {}, [item.cama || "PENDIENTE"]),
          h("span", {}, [
            (item.patient_name || item.patient_id || "Paciente sin nombre") + " · " + (item.servicio || "SIN SERVICIO")
          ]),
          h("button", {
            class: excluded ? "iaas-button ghost" : "iaas-button danger ghost",
            type: "button",
            onclick: () => toggleImportRowExclusion(row.index)
          }, [excluded ? "Restaurar" : "Quitar"])
        ]);
      }))
    ]);
  }

`;
  }

  function bedBoardSource() {
    return `  function bedBoardItems(rows, date, mode) {
    // epividaAisPKnownBedsForBoard: AIS P y camas especiales quedan integradas en el catalogo general.
    const sorted = dedupeBedBoardRows(rows).sort(sortByServiceBed);
    const serviceNames = unique(sorted.map(row => normalizeService(row.service)).filter(Boolean));
    if (serviceNames.length !== 1) {
      return sorted.map(row => ({ bed: row.bed || "S/C", row }));
    }
    const knownBeds = knownBedsForService(serviceNames[0], sorted);
    const numericRows = sorted
      .map(row => ({ row, number: bedNumberToken(row.bed) }))
      .filter(item => Number.isFinite(item.number));
    if (numericRows.length < Math.max(3, Math.floor(sorted.length * 0.6))) {
      return mergeKnownBedItems(sorted.map(row => ({ bed: row.bed || "S/C", row })), knownBeds);
    }
    const min = Math.min(...numericRows.map(item => item.number));
    const max = Math.max(...numericRows.map(item => item.number));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max - min > 80) {
      return mergeKnownBedItems(sorted.map(row => ({ bed: row.bed || "S/C", row })), knownBeds);
    }
    const byNumber = new Map();
    numericRows.forEach(item => {
      if (!byNumber.has(item.number)) byNumber.set(item.number, item.row);
    });
    const inferred = [];
    for (let number = min; number <= max; number += 1) {
      const row = byNumber.get(number);
      inferred.push({ bed: row?.bed || String(number), row: row || null });
    }
    return mergeKnownBedItems(inferred, knownBeds);
  }

  function dedupeBedBoardRows(rows) {
    const byLocation = new Map();
    (rows || []).filter(isActiveCensusRow).forEach(row => {
      const key = normalizeService(row.service || "") + "|" + normalizeText(row.bed || "S/C");
      const current = byLocation.get(key);
      if (!current) {
        byLocation.set(key, row);
        return;
      }
      const currentEntry = store.dailyRounds[row.roundDate || activeDate()]?.entries?.[current.patientId];
      const nextEntry = store.dailyRounds[row.roundDate || activeDate()]?.entries?.[row.patientId];
      const currentScore = (current.present === false ? -10 : 0) + (currentEntry?.status === "revisado" ? 1 : 0);
      const nextScore = (row.present === false ? -10 : 0) + (nextEntry?.status === "revisado" ? 1 : 0);
      if (nextScore > currentScore) byLocation.set(key, row);
    });
    return [...byLocation.values()];
  }

  function knownBedsForService(service, rows = []) {
    const knownBeds = KNOWN_SERVICE_BEDS[normalizeService(service)] || [];
    const existing = rows.map(row => row.bed).filter(Boolean);
    return unique([...knownBeds, ...existing]).filter(Boolean).sort(comparePrintBeds);
  }

  function mergeKnownBedItems(items, knownBeds = []) {
    if (!knownBeds.length) return items;
    const byBed = new Map(items.map(item => [normalizeText(item.bed), item]));
    knownBeds.forEach(bed => {
      const key = normalizeText(bed);
      if (!byBed.has(key)) byBed.set(key, { bed, row: null });
    });
    return [...byBed.values()].sort((a, b) => comparePrintBeds(a.bed, b.bed));
  }

  function bedNumberToken`;
  }

  function patchSource(source) {
    if (typeof source !== "string") return source;
    if (!source.includes("function normalizeImportRow(raw, index, fallbackDate)")
      || !source.includes("function renderImportPreview(draft)")
      || !source.includes("function bedBoardItems(rows, date, mode)")) {
      return source;
    }
    if (source.includes("epividaHospitalBedServiceNormalizerApplied")) return source;

    let next = source;
    if (/  const KNOWN_SERVICE_BEDS = \{[\s\S]*?\n  \};/.test(next)) {
      next = replaceOnce(next, /  const KNOWN_SERVICE_BEDS = \{[\s\S]*?\n  \};/, knownBedsSource(), "catalogo de camas conocidas");
    } else {
      next = replaceOnce(next, "  function bedBoardItems(rows, date, mode) {\n", knownBedsSource() + "\n\n  function bedBoardItems(rows, date, mode) {\n", "insertar catalogo de camas conocidas");
    }
    next = replaceOnce(
      next,
      /  function bedBoardItems\(rows, date, mode\) \{[\s\S]*?\n  function bedNumberToken/,
      bedBoardSource(),
      "tablero con catalogo de camas"
    );
    next = replaceOnce(next, "  function buildImportDraft(rawRows, fallbackDate, options = {}) {\n", helperSource() + "  function buildImportDraft(rawRows, fallbackDate, options = {}) {\n", "helpers centrales");
    next = replaceOnce(
      next,
      "    const rows = rawRows.map((raw, index) => normalizeImportRow(raw, index, fallbackDate));\n    const validRows = rows.filter(row => !row.errors.length);\n",
      "    const rows = rawRows.map((raw, index) => normalizeImportRow(raw, index, fallbackDate));\n    const activeRows = rows.filter(row => !row.excluded);\n    const validRows = activeRows.filter(row => !row.errors.length);\n",
      "filas activas en buildImportDraft"
    );
    next = replaceOnce(
      next,
      "      totalRows: rows.length,\n      validRows: validRows.length,\n      errorRows: rows.filter(row => row.errors.length).length,\n      warningRows: rows.filter(row => row.warnings.length).length,\n",
      "      totalRows: rows.length,\n      activeRows: activeRows.length,\n      removedRows: rows.filter(row => row.excluded).length,\n      validRows: validRows.length,\n      errorRows: activeRows.filter(row => row.errors.length).length,\n      warningRows: activeRows.filter(row => row.warnings.length).length,\n",
      "resumen de filas activas"
    );
    next = replaceOnce(
      next,
      "    return { rows, plan, summary, conflicts: plan.conflicts, reconciliationMissing: plan.reconciliationMissing, automaticDischarges: plan.automaticDischarges || [], reportedDischarges: plan.rows.filter(row => row.dischargeReported) };\n",
      "    return { rows, plan, summary, importOptions: options, conflicts: plan.conflicts, reconciliationMissing: plan.reconciliationMissing, automaticDischarges: plan.automaticDischarges || [], reportedDischarges: plan.rows.filter(row => row.dischargeReported) };\n",
      "opciones de importacion"
    );
    next = replaceOnce(
      next,
      "    const serviceBed = splitServiceBed(mapped.servicio_cama);\n    const service = normalizeImportService(mapped.servicio || serviceBed.service);\n    const bed = normalizeBed(mapped.cama || serviceBed.bed);\n",
      "    const serviceBed = splitServiceBed(mapped.servicio_cama);\n    const importLocation = epividaNormalizeImportLocation(mapped.servicio || serviceBed.service, mapped.cama || serviceBed.bed, mapped.servicio_cama);\n    const service = importLocation.service;\n    const bed = importLocation.bed;\n",
      "normalizacion servicio/cama"
    );
    next = replaceOnce(
      next,
      "        [\"Errores\", s.errorRows, \"No se guardan\"],\n        [\"Advertencias\", s.warningRows, \"Revisar\"],\n",
      "        [\"Errores\", s.errorRows, \"No se guardan\"],\n        [\"Quitados\", s.removedRows || 0, \"No se importan\"],\n        [\"Advertencias\", s.warningRows, \"Revisar\"],\n",
      "metrica de quitados"
    );
    next = replaceOnce(
      next,
      "      renderImportIssues(draft),\n      h(\"div\", { class: \"table-wrap\" }, [\n",
      "      renderImportPatientRemovalPanel(draft),\n      renderImportIssues(draft),\n      h(\"div\", { class: \"table-wrap\" }, [\n",
      "panel para quitar pacientes"
    );
    next = replaceOnce(
      next,
      "  async function confirmImport() {\n    const draft = ui.importDraft;\n    if (!draft) return;\n",
      "  async function confirmImport() {\n    let draft = ui.importDraft;\n    if (!draft) return;\n    draft = rebuildImportDraftAfterExclusion(draft);\n    ui.importDraft = draft;\n    if (!draft.summary.validRows) {\n      flashIaas(\"No hay pacientes activos para importar.\");\n      renderIaas();\n      return;\n    }\n",
      "confirmacion con exclusiones"
    );
    next = replaceOnce(
      next,
      "  function renderRoundPage(date) {\n    ensureDailyRound(date);\n    const round = store.dailyRounds[date];\n    const rows = getCensusRows(date);\n",
      "  function renderRoundPage(date) {\n    ensureDailyRound(date);\n    const round = store.dailyRounds[date];\n    const rows = getCensusRows(date).filter(row => !isOncologyOperationalService(row.service));\n",
      "ocultar oncologia en paquetes preventivos"
    );
    next = replaceOnce(
      next,
      "    return h(\"section\", { class: \"service-filter round-service-filter\", \"aria-label\": \"Filtrar camas por servicio\" }, ROUND_SERVICE_FILTERS.map(filter => {\n",
      "    return h(\"section\", { class: \"service-filter round-service-filter\", \"aria-label\": \"Filtrar camas por servicio\" }, ROUND_SERVICE_FILTERS.filter(filter => !isOncologyOperationalService(filter.value)).map(filter => {\n",
      "filtro sin oncologia"
    );
    next = replaceOnce(
      next,
      "  function iaasFollowUpRows(date) {\n    return monitoringRows(date)\n      .filter(item => isIaasFollowUpCandidate(item, date))\n      .sort((a, b) => sortByServiceBed(a.row, b.row));\n  }\n",
      "  function iaasFollowUpRows(date) {\n    return monitoringRows(date)\n      .filter(item => !isOncologyOperationalService(item.service || item.row?.service || item.patient?.currentService))\n      .filter(item => isIaasFollowUpCandidate(item, date))\n      .sort((a, b) => sortByServiceBed(a.row, b.row));\n  }\n",
      "ocultar oncologia en seguimiento IAAS"
    );
    next = replaceOnce(
      next,
      /  function looksLikeBedCell\(value\) \{[\s\S]*?\n  \}\n\n  function looksLikePatientNameCell/,
      `  function looksLikeBedCell(value) {
    const text = normalizeText(value);
    if (!text || normalizeDate(value) || text.length > 36) return false;
    if (/[\\/()]/.test(text)) return false;
    const bed = epividaCleanBedToken(value);
    return Boolean(bed && (/^(CAMA|CAM|SILLON|SILLON|AIS|AISLADO|AISLADA|OBS|OBSERVACION|AMB|AMBULATORIO|A|B|C|UCIA|UCIN|UCIP|UTIP|CUN|CUNERO|ESC|ESCOLAR|CUBICULO|CUBICULO|CAMILLA|UX|URX|F|P|HEM|ALOJ|CHOQUE)[\\s:-]*[A-Z0-9-]+(?:\\s+[A-Z]{1,4})?$/.test(bed) || /^\\d{1,3}(?:\\s|-)?[A-Z]{0,4}(?:\\s+[A-Z]{1,4})?$/.test(bed)));
  }

  function looksLikePatientNameCell`,
      "detector de camas"
    );
    next = replaceOnce(
      next,
      /  function serviceFromBedCell\(value\) \{[\s\S]*?\n  \}\n\n  function normalizeBed/,
      `  function serviceFromBedCell(value) {
    return epividaServiceFromBed(value);
  }

  function normalizeBed`,
      "servicio desde cama"
    );
    next = replaceOnce(
      next,
      /  function normalizeBed\(value\) \{[\s\S]*?\n  \}\n\n  function normalizeSex/,
      `  function normalizeBed(value) {
    return epividaCanonicalBed(value);
  }

  function normalizeSex`,
      "normalizador de cama"
    );

    return next + "\n;window.epividaHospitalBedServiceNormalizerApplied = true;\n";
  }

  window.__EPIVIDA_SYSTEM_PATCHERS__ ||= [];
  window.__EPIVIDA_SYSTEM_PATCHERS__.push({
    name: "hospital-bed-service-normalizer",
    priority: 50,
    patch: patchSource
  });

  if (window.EPIVIDA_USE_GLOBAL_EVAL_PATCHERS === true) {
    const nativeEval = window.eval;
    window.eval = function epividaHospitalBedServiceNormalizerEval(source) {
      return nativeEval.call(this, patchSource(source));
    };
  }

  injectStyle();
  installRuntimeNormalizers();
})();

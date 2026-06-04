(() => {
  "use strict";

  if (window.__epividaUrgenciasAisPSystemPreloader20260601) return;
  window.__epividaUrgenciasAisPSystemPreloader20260601 = true;

  function patchServiceFromBedCell(source) {
    const marker = "if (/^AIS[-\\s]*P\\b/.test(key)) return \"URGENCIAS\";";
    if (source.includes(marker)) return source;
    return source.replace(
      "  function serviceFromBedCell(value) {\n    const key = normalizeText(value);\n",
      "  function serviceFromBedCell(value) {\n    const key = normalizeText(value);\n    if (/^AIS[-\\s]*P\\b/.test(key)) return \"URGENCIAS\";\n"
    );
  }

  function patchBedBoardItems(source) {
    if (source.includes("epividaAisPKnownBedsForBoard")) return source;
    const replacement = `  function epividaAisPKnownBedsForBoard(service, rows = []) {
    if (normalizeService(service) !== "URGENCIAS") return [];
    const existing = rows.map(row => row.bed).filter(Boolean);
    return unique(["AIS P", ...existing]).filter(Boolean).sort(comparePrintBeds);
  }

  function epividaAisPMergeBoardBeds(items, knownBeds = []) {
    if (!knownBeds.length) return items;
    const byBed = new Map(items.map(item => [normalizeText(item.bed), item]));
    knownBeds.forEach(bed => {
      const key = normalizeText(bed);
      if (!byBed.has(key)) byBed.set(key, { bed, row: null });
    });
    return [...byBed.values()].sort((a, b) => comparePrintBeds(a.bed, b.bed));
  }

  function bedBoardItems(rows, date, mode) {
    const sorted = [...rows].sort(sortByServiceBed);
    const serviceNames = unique(sorted.map(row => normalizeService(row.service)).filter(Boolean));
    if (serviceNames.length !== 1) {
      return sorted.map(row => ({ bed: row.bed || "S/C", row }));
    }
    const knownBeds = epividaAisPKnownBedsForBoard(serviceNames[0], sorted);
    const numericRows = sorted
      .map(row => ({ row, number: bedNumberToken(row.bed) }))
      .filter(item => Number.isFinite(item.number));
    if (numericRows.length < Math.max(3, Math.floor(sorted.length * 0.6))) {
      return epividaAisPMergeBoardBeds(sorted.map(row => ({ bed: row.bed || "S/C", row })), knownBeds);
    }
    const min = Math.min(...numericRows.map(item => item.number));
    const max = Math.max(...numericRows.map(item => item.number));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max - min > 80) {
      return epividaAisPMergeBoardBeds(sorted.map(row => ({ bed: row.bed || "S/C", row })), knownBeds);
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
    return epividaAisPMergeBoardBeds(inferred, knownBeds);
  }
`;
    return source.replace(
      /  function bedBoardItems\(rows, date, mode\) \{[\s\S]*?\n  \}\n\n  function bedNumberToken/,
      `${replacement}\n  function bedNumberToken`
    );
  }

  function patchSystemSource(source) {
    if (typeof source !== "string") return source;
    if (!source.includes("function bedBoardItems(rows, date, mode)")
      || !source.includes("function serviceFromBedCell(value)")
      || !source.includes("function renderBedTile(item, date, mode)")) {
      return source;
    }
    const patched = patchBedBoardItems(patchServiceFromBedCell(source));
    if (!patched.includes("epividaAisPKnownBedsForBoard") || !patched.includes("AIS P")) {
      console.warn("No se pudo aplicar la existencia permanente de AIS P en Urgencias.");
      return source;
    }
    return patched;
  }

  window.__EPIVIDA_SYSTEM_PATCHERS__ ||= [];
  window.__EPIVIDA_SYSTEM_PATCHERS__.push({
    name: "urgencias-aisp",
    priority: 60,
    patch: patchSystemSource
  });

  if (window.EPIVIDA_USE_GLOBAL_EVAL_PATCHERS === true) {
    const nativeEval = window.eval;
    window.eval = function epividaUrgenciasAisPSystemEval(source) {
      return nativeEval.call(this, patchSystemSource(source));
    };
  }
})();

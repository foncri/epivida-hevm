(() => {
  "use strict";

  if (window.__epividaPeSummaryVisibility20260601) return;
  window.__epividaPeSummaryVisibility20260601 = true;

  const nativeEval = window.eval;

  function replace(source, pattern, replacement, label) {
    const next = source.replace(pattern, replacement);
    if (next === source) console.warn("No se pudo aplicar resumen P.E.:", label);
    return next;
  }

  function peHelpers() {
    return `  function isPePackageType(type) {
    const key = normalizeText(type).replace(/[^A-Z]/g, "");
    return key === "PEYPBMT" || key === "PE" || key.includes("PRECAUCIONESESTANDAR");
  }

  function preventivePackageReviewTimeline(patientId, packageType) {
    const items = [];
    Object.values(store.dailyRounds || {}).forEach(round => {
      Object.values(round.entries || {})
        .filter(entry => entry.patientId === patientId)
        .forEach(entry => {
          (entry.packageReviews || []).forEach(review => {
            const matches = packageType ? normalizeText(review.packageType) === normalizeText(packageType) || isPePackageType(review.packageType) : isPePackageType(review.packageType);
            if (matches) {
              items.push({ ...review, roundDate: normalizeDate(entry.roundDate) || entry.roundDate || review.reviewDate || "" });
            }
          });
        });
    });
    return items.sort((a, b) => String(b.roundDate || b.reviewDate || "").localeCompare(String(a.roundDate || a.reviewDate || "")));
  }

  function preventivePeSummaryItems(patientId, date = activeDate(), draft = null) {
    const byId = new Map();
    const add = (item, source) => {
      if (!item || !isPePackageType(item.packageType)) return;
      const reviewDate = normalizeDate(item.reviewDate) || normalizeDate(item.roundDate) || normalizeDate(date) || date || "";
      const key = item.packageReviewId || [source, reviewDate, item.packageType, JSON.stringify(item.preventiveChecks || {})].join("|");
      byId.set(key, { ...item, reviewDate, roundDate: item.roundDate || reviewDate, source });
    };
    preventivePackageReviewTimeline(patientId, "P.E. Y P.B.M.T.").forEach(item => add(item, "saved"));
    (draft?.deviceDrafts || [])
      .filter(device => isPePackageType(device.packageType))
      .forEach(device => add(packageReviewSummary({ ...device, reviewDate: date, savedReviewDate: date }), "draft"));
    return [...byId.values()].sort((a, b) => String(b.reviewDate || b.roundDate || "").localeCompare(String(a.reviewDate || a.roundDate || "")));
  }

  function renderPeSummaryZone(patientId, date = activeDate(), draft = null) {
    if (!patientId) return "";
    const items = preventivePeSummaryItems(patientId, date, draft);
    if (!items.length) return "";
    return h("div", { class: "pe-summary-zone", "data-pe-summary": "true" }, [
      h("div", { class: "summary-grid" }, items.map(item => h("article", { class: "pe-summary-card" }, [
        h("strong", { class: "pe-title" }, ["P.E."]),
        h("span", {}, ["Fecha: " + (formatDisplayDate(item.reviewDate || item.roundDate) || item.reviewDate || item.roundDate || "Sin fecha")]),
        h("span", {}, ["Cumplimiento: " + (item.compliance || preventiveCompliance(item.preventiveChecks || {}) || "Pendiente")]),
        item.source === "draft" ? h("small", {}, ["En captura"]) : "",
        item.observations ? h("small", {}, [item.observations]) : ""
      ])))
    ]);
  }

`;
  }

  function patchSource(source) {
    if (typeof source !== "string") return source;
    if (!source.includes("epividaPreventivePackagesEnhancementApplied")) return source;
    if (source.includes("epividaPeSummaryVisibilityApplied")) return source;

    let next = source;
    if (!next.includes("renderPeSummaryZone(patientId, date, draft)")) {
      next = replace(
        next,
        /(deviceCards\.length \? h\("div", \{ class: "device-list compact-device-grid" \}, deviceCards\.map\(ep => renderActiveDevice\(ep, draft, date\)\)\) : h\("p", \{ class: "muted" \}, \["No hay invasivos activos capturados\."\]\),\n)(\s+!hasAnyInvasive \?)/,
        "$1        renderPeSummaryZone(patientId, date, draft),\n$2",
        "resumen preventivo"
      );
    }

    next = next.replace("renderPeSummaryZone(patientId)\n    ]);", "renderPeSummaryZone(patientId, date, null)\n    ]);");
    next = replace(
      next,
      /  function preventivePackageReviewTimeline\(patientId, packageType\) \{[\s\S]*?\n  function renderDailyPreventiveHistory/,
      peHelpers() + "  function renderDailyPreventiveHistory",
      "helpers P.E."
    );

    return next + "\n;window.epividaPeSummaryVisibilityApplied = true;\n";
  }

  window.eval = function epividaPeSummaryVisibilityEval(source) {
    return nativeEval.call(this, patchSource(source));
  };
})();
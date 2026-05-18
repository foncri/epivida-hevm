(() => {
  "use strict";

  if (window.__epividaIaasFollowupCountsHotfix20260518) return;
  window.__epividaIaasFollowupCountsHotfix20260518 = true;

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  function followHub() {
    return document.querySelector(".follow-up-hub");
  }

  function followCards() {
    return [...document.querySelectorAll(".follow-up-hub .iaas-follow-card")];
  }

  function patientIdFromCard(card) {
    const href = card.querySelector('a[href*="/paciente/"]')?.getAttribute("href") || "";
    const match = href.match(/\/paciente\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function isInactiveNoneCard(card) {
    const text = norm(card.textContent || "");
    return text.includes("NINGUNO") && !text.includes("NO IAAS") && !text.includes("RIESGO IAAS");
  }

  function setMetric(labelNeedle, value) {
    const needle = norm(labelNeedle);
    const metric = [...document.querySelectorAll(".follow-up-hub .iaas-metric")]
      .find(card => norm(card.querySelector("span")?.textContent || "").includes(needle));
    const target = metric?.querySelector("strong");
    if (target) target.textContent = String(value);
  }

  function patchBedBoardCount(count) {
    const totals = document.querySelector(".follow-up-hub .bed-board.iaas .bed-board-totals");
    const totalLabels = totals ? [...totals.querySelectorAll("span, strong, b")] : [];
    const bedLabel = totalLabels.find(node => norm(node.textContent).includes("CAMA(S)"));
    if (bedLabel) bedLabel.textContent = `${count} cama(s)`;
  }

  function removeInactiveCards(cards) {
    const inactiveIds = new Set();
    cards.filter(isInactiveNoneCard).forEach(card => {
      const patientId = patientIdFromCard(card);
      if (patientId) inactiveIds.add(patientId);
      card.remove();
    });
    inactiveIds.forEach(patientId => {
      document
        .querySelectorAll(`.follow-up-hub .bed-board.iaas a[href*="/paciente/${CSS.escape(patientId)}"]`)
        .forEach(node => node.remove());
    });
  }

  function repairCounts() {
    if (String(location.hash || "") !== "#/seguimiento-iaas") return;
    if (!followHub()) return;
    removeInactiveCards(followCards());
    const cards = followCards().filter(card => !isInactiveNoneCard(card));
    const cardCount = cards.length;
    const pending = cards.filter(card => norm(card.textContent).includes("PENDIENTE")).length;
    setMetric("PACIENTES IAAS/RIESGO", cardCount);
    setMetric("VALORACION PENDIENTE", pending);
    patchBedBoardCount(cardCount);
  }

  let queued = false;
  function scheduleRepair() {
    if (queued) return;
    queued = true;
    [0, 80, 220, 500].forEach(delay => {
      window.setTimeout(() => {
        queued = false;
        repairCounts();
      }, delay);
    });
  }

  window.addEventListener("hashchange", scheduleRepair);
  window.addEventListener("load", scheduleRepair);
  const observer = new MutationObserver(scheduleRepair);
  const start = () => observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
  scheduleRepair();
})();

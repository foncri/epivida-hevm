(() => {
  "use strict";

  const PILOT_RESET_VERSION = "2026-05-11-empty-pilot01";
  const PILOT_RESET_KEY = `epivida-pilot-reset-${PILOT_RESET_VERSION}`;

  function runPilotReset() {
    try {
      if (localStorage.getItem(PILOT_RESET_KEY) === "done") return false;
      localStorage.removeItem("epivida-iaas-os-v1");
      localStorage.removeItem("epivida-iaas-drafts-v1");
      localStorage.setItem(PILOT_RESET_KEY, "done");
      return true;
    } catch (error) {
      console.warn("No se pudo limpiar el estado local para piloto", error);
      return false;
    }
  }

  if (runPilotReset()) {
    window.setTimeout(() => window.location.reload(), 50);
    return;
  }

  let scheduled = false;

  function isPreventivePatientRound() {
    return /^#\/ronda\/[^/]+\/paciente\/[^/]+/.test(String(location.hash || ""));
  }

  function findCulturePanel(summary, rail) {
    return rail.querySelector(".preventive-culture-summary, .patient-culture-alerts")
      || summary.querySelector(".preventive-culture-summary, .patient-culture-alerts");
  }

  function prepareRail(summary) {
    const rail = summary.querySelector(".preventive-summary-rail") || summary.querySelector(".patient-summary-side");
    if (!rail) return null;
    if (!rail.classList.contains("preventive-summary-rail")) rail.classList.add("preventive-summary-rail");
    rail.style.display = "grid";
    rail.style.gap = "8px";
    rail.style.alignContent = "start";
    rail.style.justifyItems = "end";
    rail.style.justifySelf = "end";
    rail.style.alignSelf = "start";
    rail.style.width = "min(360px, 100%)";
    rail.style.marginTop = "0";
    return rail;
  }

  function moveBeforeCultures(rail, risk, panel) {
    if (risk) {
      risk.style.order = "0";
      risk.style.margin = "0 0 2px 0";
      risk.style.justifySelf = "end";
      if (risk.parentElement !== rail || rail.firstElementChild !== risk) {
        rail.insertBefore(risk, rail.firstElementChild || null);
      }
    }

    if (panel) {
      panel.style.display = "block";
      panel.style.order = "1";
      panel.style.margin = "0";
      panel.style.justifySelf = "end";
      panel.style.width = "100%";
      if (risk) {
        if (panel.parentElement !== rail || panel.previousElementSibling !== risk) {
          risk.after(panel);
        }
      } else if (panel.parentElement !== rail || rail.firstElementChild !== panel) {
        rail.insertBefore(panel, rail.firstElementChild || null);
      }
    }
  }

  function placePreventiveCultures() {
    scheduled = false;
    if (!isPreventivePatientRound()) return;
    document.querySelectorAll(".patient-round .patient-sticky-summary").forEach(summary => {
      const rail = prepareRail(summary);
      if (!rail) return;
      const risk = summary.querySelector(".risk") || rail.querySelector(".risk");
      const panel = findCulturePanel(summary, rail);
      moveBeforeCultures(rail, risk, panel);
    });
  }

  function requestPlacement() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(placePreventiveCultures);
  }

  function schedulePlacement() {
    [0, 60, 180, 500, 1200].forEach(delay => window.setTimeout(requestPlacement, delay));
  }

  const observer = new MutationObserver(requestPlacement);

  function start() {
    schedulePlacement();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener("hashchange", schedulePlacement);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

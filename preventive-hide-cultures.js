(() => {
  "use strict";

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
    rail.classList.add("preventive-summary-rail");
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

  function placePreventiveCultures() {
    if (!isPreventivePatientRound()) return;
    document.querySelectorAll(".patient-round .patient-sticky-summary").forEach(summary => {
      const rail = prepareRail(summary);
      if (!rail) return;
      const risk = summary.querySelector(".risk");
      const panel = findCulturePanel(summary, rail);
      if (risk) {
        risk.style.order = "0";
        risk.style.margin = "0 0 2px 0";
        risk.style.justifySelf = "end";
        rail.prepend(risk);
      }
      if (panel) {
        panel.style.display = "block";
        panel.style.order = "1";
        panel.style.margin = "0";
        panel.style.justifySelf = "end";
        panel.style.width = "100%";
        if (risk) risk.after(panel);
        else rail.prepend(panel);
      }
    });
  }

  function schedulePlacement() {
    [0, 40, 120, 300, 800, 1600].forEach(delay => window.setTimeout(placePreventiveCultures, delay));
  }

  const observer = new MutationObserver(() => placePreventiveCultures());

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

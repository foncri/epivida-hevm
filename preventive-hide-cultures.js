(() => {
  "use strict";

  function isPreventivePatientRound() {
    return /^#\/ronda\/[^/]+\/paciente\/[^/]+/.test(String(location.hash || ""));
  }

  function placePreventiveCultures() {
    if (!isPreventivePatientRound()) return;
    document.querySelectorAll(".patient-round .preventive-summary-rail").forEach(rail => {
      const risk = rail.querySelector(".risk");
      const panel = rail.querySelector(".preventive-culture-summary");
      rail.style.display = "grid";
      rail.style.alignContent = "start";
      rail.style.justifyItems = "end";
      if (risk) {
        risk.style.order = "0";
        risk.style.margin = "0";
        rail.prepend(risk);
      }
      if (panel) {
        panel.style.display = "block";
        panel.style.order = "1";
        panel.style.margin = "0";
        panel.style.justifySelf = "end";
        if (risk && panel.previousElementSibling !== risk) risk.after(panel);
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

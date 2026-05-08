(() => {
  "use strict";

  function isPreventivePatientRound() {
    return /^#\/ronda\/[^/]+\/paciente\/[^/]+/.test(String(location.hash || ""));
  }

  function placePreventiveCultures() {
    if (!isPreventivePatientRound()) return;
    document.querySelectorAll(".patient-round .preventive-culture-summary").forEach(panel => {
      panel.style.display = "block";
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

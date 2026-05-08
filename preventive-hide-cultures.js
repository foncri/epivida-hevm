(() => {
  "use strict";

  function isPreventivePatientRound() {
    return /^#\/ronda\/[^/]+\/paciente\/[^/]+/.test(String(location.hash || ""));
  }

  function removePreventiveCultures() {
    if (!isPreventivePatientRound()) return;
    document.querySelectorAll(".patient-round .preventive-culture-summary").forEach(panel => panel.remove());
  }

  function scheduleRemoval() {
    [0, 40, 120, 300, 800, 1600].forEach(delay => window.setTimeout(removePreventiveCultures, delay));
  }

  const observer = new MutationObserver(() => removePreventiveCultures());

  function start() {
    scheduleRemoval();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener("hashchange", scheduleRemoval);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

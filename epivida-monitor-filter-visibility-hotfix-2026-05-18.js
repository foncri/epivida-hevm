(() => {
  "use strict";

  if (window.__epividaMonitorFilterVisibilityHotfix20260518) return;
  window.__epividaMonitorFilterVisibilityHotfix20260518 = true;

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  function monitorQuery(scope) {
    return norm(document.getElementById(`${scope}-monitor-search`)?.value || "");
  }

  function repairRows(scope) {
    const rows = [...document.querySelectorAll(`tr[data-monitor-scope="${scope}"]`)];
    if (!rows.length) return;
    const query = monitorQuery(scope);
    let visible = 0;
    rows.forEach(row => {
      const haystack = norm(row.dataset.monitorSearch || row.textContent || "");
      const match = !query || haystack.includes(query);
      row.hidden = !match;
      row.classList.toggle("search-hidden", !match);
      if (match) visible += 1;
    });
    const counter = document.querySelector(`[data-monitor-count="${scope}"]`);
    if (counter) counter.textContent = `${visible} / ${counter.dataset.monitorTotal || rows.length}`;
  }

  let pending = false;

  function repairMonitorFilters() {
    pending = false;
    if (!document.querySelector(".epidemiological-monitor")) return;
    repairRows("epi");
    repairRows("hospital");
  }

  function scheduleRepair() {
    if (pending) return;
    pending = true;
    [0, 80, 220].forEach(delay => window.setTimeout(repairMonitorFilters, delay));
  }

  document.addEventListener("input", event => {
    if (event.target?.matches?.("#epi-monitor-search, #hospital-monitor-search")) scheduleRepair();
  }, true);

  document.addEventListener("change", event => {
    if (event.target?.closest?.(".epidemiological-monitor .monitor-filter-row")) scheduleRepair();
  }, true);

  window.addEventListener("hashchange", scheduleRepair);

  const observer = new MutationObserver(scheduleRepair);
  const start = () => {
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    scheduleRepair();
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();

(() => {
  "use strict";

  if (window.__epividaMonitorFilterVisibilityHotfix20260518) return;
  window.__epividaMonitorFilterVisibilityHotfix20260518 = true;

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const cachedRows = new Map();

  function monitorQuery(scope) {
    return norm(document.getElementById(`${scope}-monitor-search`)?.value || "");
  }

  function filterSignature(scope) {
    const input = document.getElementById(`${scope}-monitor-search`);
    const row = input?.closest(".monitor-filter-row");
    return [...(row?.querySelectorAll("select") || [])].map(select => select.value).join("|");
  }

  function cacheKey(scope) {
    return `${scope}:${filterSignature(scope)}`;
  }

  function rowKey(row) {
    return row.dataset.monitorSearch || norm(row.textContent || "");
  }

  function rememberRows(scope) {
    const rows = [...document.querySelectorAll(`tr[data-monitor-scope="${scope}"]`)];
    if (!rows.length) return;
    const key = cacheKey(scope);
    const cache = cachedRows.get(key) || new Map();
    rows.forEach(row => {
      cache.set(rowKey(row), {
        html: row.outerHTML,
        search: row.dataset.monitorSearch || norm(row.textContent || "")
      });
    });
    cachedRows.set(key, cache);
  }

  function restoreMatchingRows(scope, query) {
    const cache = cachedRows.get(cacheKey(scope));
    if (!cache?.size) return;
    const currentRows = [...document.querySelectorAll(`tr[data-monitor-scope="${scope}"]`)];
    const tbody = currentRows[0]?.closest("tbody");
    if (!tbody) return;
    const existing = new Set(currentRows.map(rowKey));
    const fragment = document.createDocumentFragment();
    cache.forEach((entry, key) => {
      if (existing.has(key)) return;
      const match = !query || norm(entry.search).includes(query);
      if (!match) return;
      const template = document.createElement("template");
      template.innerHTML = entry.html.trim();
      const row = template.content.firstElementChild;
      if (!row) return;
      row.hidden = false;
      row.classList.remove("search-hidden");
      fragment.append(row);
    });
    if (fragment.childNodes.length) tbody.append(fragment);
  }

  function repairRows(scope) {
    rememberRows(scope);
    const query = monitorQuery(scope);
    restoreMatchingRows(scope, query);
    const rows = [...document.querySelectorAll(`tr[data-monitor-scope="${scope}"]`)];
    if (!rows.length) return;
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

(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const APP_TIME_ZONE = "America/Mexico_City";

  function appTodayIso() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: APP_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date()).reduce((out, part) => {
        out[part.type] = part.value;
        return out;
      }, {});
      if (parts.year && parts.month && parts.day) return `${parts.year}-${parts.month}-${parts.day}`;
    } catch {
      // Fall back to the browser local date if the timezone API is unavailable.
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function currentPathWithHash(hash) {
    return `${location.pathname}${location.search}${hash}`;
  }

  function normalizeClinicalHash() {
    const today = appTodayIso();
    const hash = location.hash || "";
    const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (!parts.length) return;

    let nextParts = null;
    if (parts[0] === "ronda") {
      nextParts = parts.slice();
      if (!isIsoDate(nextParts[1])) nextParts.splice(1, 0, today);
      else if (nextParts[1] !== today) nextParts[1] = today;
    }
    if (parts[0] === "seguimiento-iaas" && parts[2] === "paciente" && isIsoDate(parts[1]) && parts[1] !== today) {
      nextParts = parts.slice();
      nextParts[1] = today;
    }
    if (!nextParts) return;

    const nextHash = `#/${nextParts.join("/")}`;
    if (nextHash !== hash) history.replaceState(null, "", currentPathWithHash(nextHash));
  }

  function rewriteStoreActiveDate(value) {
    try {
      const parsed = JSON.parse(String(value || "null"));
      if (!parsed || typeof parsed !== "object") return value;
      parsed.activeDate = appTodayIso();
      return JSON.stringify(parsed);
    } catch {
      return value;
    }
  }

  function patchStoredActiveDate() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const patched = rewriteStoreActiveDate(raw);
    if (patched !== raw) localStorage.setItem(STORE_KEY, patched);
  }

  function patchLocalStorageWrites() {
    if (window.__epividaDateGuardStoragePatched) return;
    const storagePrototype = Object.getPrototypeOf(localStorage);
    const originalSetItem = storagePrototype.setItem;
    window.__epividaDateGuardStoragePatched = true;
    storagePrototype.setItem = function setItemWithCurrentClinicalDate(key, value) {
      return originalSetItem.call(this, key, key === STORE_KEY ? rewriteStoreActiveDate(value) : value);
    };
  }

  function looksLikeAppConfig(values) {
    if (!Array.isArray(values)) return false;
    return values.some(row => String(row?.[0] || "").toLowerCase() === "active_date")
      || values.some(row => String(row?.[0] || "").toLowerCase() === "schema_version")
      || values.some(row => String(row?.[0] || "").toLowerCase() === "last_write_id");
  }

  function rewriteAppConfigValues(values) {
    const today = appTodayIso();
    const rows = Array.isArray(values) && values.length ? values.map(row => Array.isArray(row) ? row.slice() : [row]) : [["key", "value"]];
    let found = false;
    rows.forEach(row => {
      if (String(row[0] || "").toLowerCase() === "active_date") {
        row[1] = today;
        found = true;
      }
    });
    if (!found) rows.push(["active_date", today]);
    return rows;
  }

  function rewriteSheetsPayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const next = Array.isArray(payload) ? payload.slice() : { ...payload };
    if (Array.isArray(next.valueRanges)) {
      next.valueRanges = next.valueRanges.map((range, index) => {
        if (index !== 0 || !range?.values) return range;
        return { ...range, values: rewriteAppConfigValues(range.values) };
      });
      return next;
    }
    if (next.values && (looksLikeAppConfig(next.values) || String(next.range || "").includes("APP_CONFIG"))) {
      next.values = rewriteAppConfigValues(next.values);
    }
    return next;
  }

  function patchSheetsReads() {
    if (window.__epividaDateGuardFetchPatched || typeof fetch !== "function") return;
    const originalFetch = window.fetch.bind(window);
    window.__epividaDateGuardFetchPatched = true;
    window.fetch = async (input, options = {}) => {
      const response = await originalFetch(input, options);
      const url = String(input?.url || input || "");
      const method = String(options?.method || input?.method || "GET").toUpperCase();
      const isSheetsRead = method === "GET" && url.includes("sheets.googleapis.com") && url.includes("/values");
      if (!isSheetsRead || !response.ok) return response;
      try {
        const payload = await response.clone().json();
        const rewritten = rewriteSheetsPayload(payload);
        return new Response(JSON.stringify(rewritten), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch {
        return response;
      }
    };
  }

  function refreshClinicalLinks() {
    const today = appTodayIso();
    document.querySelectorAll('a[href^="#/ronda"]').forEach(link => {
      const href = link.getAttribute("href") || "";
      const parts = href.replace(/^#\/?/, "").split("/").filter(Boolean);
      if (parts[0] !== "ronda") return;
      if (!isIsoDate(parts[1])) parts.splice(1, 0, today);
      else parts[1] = today;
      link.setAttribute("href", `#/${parts.join("/")}`);
    });
    document.querySelectorAll('a[href^="#/seguimiento-iaas/"]').forEach(link => {
      const href = link.getAttribute("href") || "";
      const parts = href.replace(/^#\/?/, "").split("/").filter(Boolean);
      if (parts[0] === "seguimiento-iaas" && parts[2] === "paciente" && isIsoDate(parts[1])) {
        parts[1] = today;
        link.setAttribute("href", `#/${parts.join("/")}`);
      }
    });
  }

  patchLocalStorageWrites();
  patchStoredActiveDate();
  patchSheetsReads();
  normalizeClinicalHash();
  window.addEventListener("hashchange", normalizeClinicalHash, true);
  window.addEventListener("hashchange", () => setTimeout(refreshClinicalLinks, 0), true);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshClinicalLinks, { once: true });
  } else {
    refreshClinicalLinks();
  }
})();

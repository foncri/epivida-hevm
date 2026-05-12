(() => {
  "use strict";

  if (window.__epividaEmergencyLabelGuard) return;
  window.__epividaEmergencyLabelGuard = true;

  const STORE_KEY = "epivida-iaas-os-v1";
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  function store() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "null") || {};
    } catch {
      return {};
    }
  }

  function activeDate() {
    return String(location.hash || "").match(/^#\/(?:ronda|seguimiento-iaas)\/([^/]+)/)?.[1] || "";
  }

  function serviceKey(value) {
    const key = norm(value);
    if (key.includes("URGENCIA")) return "URGENCIAS";
    if (key.includes("CIRUGIA") || key.includes("TRAUMATOLOG")) return "CX";
    if (key.includes("MEDICINA INTERNA") || key === "MI") return "MI";
    if (key.includes("PEDIATRIA")) return "PED";
    return "";
  }

  function patientId(tile) {
    const match = String(tile?.getAttribute("href") || "").match(/\/paciente\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function tileService(tile, data, date) {
    const id = patientId(tile);
    if (id) {
      const patient = data.patients?.[id] || {};
      const row = data.dailyCensus?.[date]?.patients?.[id] || {};
      return serviceKey(patient.currentService || row.service || "");
    }
    const nav = tile.closest(".round-nav-board")?.querySelector(".round-nav-head strong")?.textContent || "";
    const active = document.querySelector(".round-service-filter button.active:not(.round-add-bed-toggle)")?.textContent || "";
    return serviceKey(nav || active);
  }

  function wantedLabel(raw, service) {
    const key = norm(raw).replace(/\s+/g, "");
    const number = key.match(/^AIS(?:LADO)?([12])(?:UX|MI|CX|PED)?$/)?.[1];
    if (key === "AISLADOP" || key === "AISP") return service === "URGENCIAS" ? "AIS P" : raw;
    if (!number) return key === "CHOQUE" && service === "URGENCIAS" ? "CH" : raw;
    if (service === "URGENCIAS") return `AIS ${number} UX`;
    if (service === "CX") return `AIS ${number} CX`;
    if (service === "MI") return `AIS ${number} MI`;
    if (service === "PED") return `AIS ${number} PED`;
    return raw;
  }

  function fix(root = document) {
    const data = store();
    const date = activeDate();
    root.querySelectorAll?.(".bed-tile strong").forEach(label => {
      const tile = label.closest(".bed-tile");
      const next = wantedLabel(label.textContent, tileService(tile, data, date));
      if (next && next !== label.textContent) label.textContent = next;
    });
  }

  const nativeReplaceChildren = Element.prototype.replaceChildren;
  const nativeAppend = Element.prototype.append;
  const nativePrepend = Element.prototype.prepend;

  Element.prototype.replaceChildren = function guardedReplaceChildren(...nodes) {
    const result = nativeReplaceChildren.apply(this, nodes);
    fix(this);
    return result;
  };

  Element.prototype.append = function guardedAppend(...nodes) {
    const result = nativeAppend.apply(this, nodes);
    fix(this);
    return result;
  };

  Element.prototype.prepend = function guardedPrepend(...nodes) {
    const result = nativePrepend.apply(this, nodes);
    fix(this);
    return result;
  };

  const schedule = () => [0, 120, 450].forEach(delay => setTimeout(() => fix(), delay));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
  window.addEventListener("hashchange", schedule);
})();

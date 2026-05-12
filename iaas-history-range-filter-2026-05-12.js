(() => {
  "use strict";

  if (window.__epividaIaasHistoryRangeFilter) return;
  window.__epividaIaasHistoryRangeFilter = true;

  const START_KEY = "epivida-iaas-history-start";
  const END_KEY = "epivida-iaas-history-end";
  const OLD_DATE_KEY = "epivida-iaas-history-date";

  try {
    sessionStorage.removeItem(OLD_DATE_KEY);
  } catch {
    // Si sessionStorage no esta disponible, el filtro visual sigue funcionando.
  }

  function installStyle() {
    if (document.getElementById("epivida-iaas-history-range-style")) return;
    const style = document.createElement("style");
    style.id = "epivida-iaas-history-range-style";
    style.textContent = `
      .iaas-history-panel {
        background: rgba(19, 38, 89, .96) !important;
        border-color: rgba(141, 167, 255, .45) !important;
      }
      .iaas-history-panel summary {
        color: #ffffff !important;
        text-transform: uppercase !important;
        font-weight: 900 !important;
        font-size: 1.05rem !important;
        letter-spacing: 0 !important;
      }
      .iaas-history-date-field {
        display: grid;
        gap: 4px;
        color: #ffffff;
        font-size: .78rem;
        font-weight: 900;
        text-transform: uppercase;
      }
      .iaas-history-date-field span {
        color: #dce7ff;
      }
      .iaas-history-row[hidden] {
        display: none !important;
      }
    `;
    document.head.append(style);
  }

  function isoFromDisplay(value) {
    const text = String(value || "").trim();
    let match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? text : "";
  }

  function getSession(key) {
    try {
      return sessionStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function setSession(key, value) {
    try {
      sessionStorage.setItem(key, value || "");
    } catch {
      // No bloquea la interaccion del panel.
    }
  }

  function filterRows(panel) {
    const start = getSession(START_KEY);
    const end = getSession(END_KEY);
    panel.querySelectorAll(".iaas-history-row").forEach(row => {
      const dateText = row.querySelector("span")?.textContent || "";
      const iso = isoFromDisplay(dateText);
      const outsideStart = start && iso && iso < start;
      const outsideEnd = end && iso && iso > end;
      row.hidden = Boolean(outsideStart || outsideEnd);
    });
  }

  function ensureRangeInputs(panel) {
    const controls = panel.querySelector(".iaas-history-controls");
    if (!controls) return;
    controls.querySelector("[data-iaas-history-date]")?.remove();
    if (controls.querySelector("[data-iaas-history-start]")) return;

    const startLabel = document.createElement("label");
    startLabel.className = "iaas-history-date-field";
    startLabel.innerHTML = '<span>Inicio</span><input data-iaas-history-start type="date" />';

    const endLabel = document.createElement("label");
    endLabel.className = "iaas-history-date-field";
    endLabel.innerHTML = '<span>Final</span><input data-iaas-history-end type="date" />';

    controls.append(startLabel, endLabel);
    const start = startLabel.querySelector("input");
    const end = endLabel.querySelector("input");
    start.value = getSession(START_KEY);
    end.value = getSession(END_KEY);
    start.addEventListener("change", () => {
      setSession(START_KEY, start.value);
      filterRows(panel);
    });
    end.addEventListener("change", () => {
      setSession(END_KEY, end.value);
      filterRows(panel);
    });
  }

  function repairPanel() {
    installStyle();
    document.querySelectorAll(".iaas-history-panel").forEach(panel => {
      const summary = panel.querySelector("summary");
      if (summary) summary.textContent = "HISTORIAL PACIENTES IAAS";
      ensureRangeInputs(panel);
      filterRows(panel);
    });
  }

  const schedule = () => [0, 120, 450, 900].forEach(delay => setTimeout(repairPanel, delay));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
  window.addEventListener("hashchange", schedule);
  document.addEventListener("change", event => {
    if (event.target.closest?.(".iaas-history-controls")) schedule();
  }, true);
})();

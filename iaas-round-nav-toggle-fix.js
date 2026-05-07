(() => {
  "use strict";

  const BASE_KEY = "epivida-round-nav-collapsed-v1";

  function currentMode() {
    const hash = String(location.hash || "").toLowerCase();
    if (hash.includes("seguimiento-iaas")) return "iaas";
    if (hash.includes("ronda")) return "ronda";
    return "patient-round";
  }

  function storageKeys(mode) {
    return [
      `${BASE_KEY}:${mode}`,
      `${BASE_KEY}-${mode}`,
      `${BASE_KEY}.${mode}`,
      BASE_KEY
    ];
  }

  function persist(mode, collapsed) {
    try {
      storageKeys(mode).forEach(key => sessionStorage.setItem(key, collapsed ? "1" : "0"));
    } catch (error) {
      // This only preserves the visual preference; the clinical workflow still works without it.
    }
  }

  function setToggleLabel(button, collapsed) {
    if (!button) return;
    button.textContent = collapsed ? "Mostrar camas" : "Ocultar camas";
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.setAttribute("aria-pressed", collapsed ? "true" : "false");
  }

  function setBoardCollapsed(board, collapsed) {
    if (!board) return;
    board.classList.toggle("collapsed", collapsed);
    const grid = board.querySelector(".round-nav-grid");
    if (grid) grid.hidden = collapsed;
    setToggleLabel(board.querySelector(".round-nav-toggle"), collapsed);
    persist(board.dataset.roundMode || currentMode(), collapsed);
  }

  function syncExistingBoards() {
    document.querySelectorAll(".round-nav-board").forEach(board => {
      const collapsed = board.classList.contains("collapsed");
      const grid = board.querySelector(".round-nav-grid");
      if (grid) grid.hidden = collapsed;
      setToggleLabel(board.querySelector(".round-nav-toggle"), collapsed);
    });
  }

  document.addEventListener("click", event => {
    const button = event.target && event.target.closest ? event.target.closest(".round-nav-toggle") : null;
    if (!button) return;
    const board = button.closest(".round-nav-board");
    if (!board) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    setBoardCollapsed(board, !board.classList.contains("collapsed"));
  }, true);

  const observer = new MutationObserver(syncExistingBoards);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncExistingBoards, { once: true });
  } else {
    syncExistingBoards();
  }
})();

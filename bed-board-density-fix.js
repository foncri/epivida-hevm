(() => {
  "use strict";

  function tileIsVacant(tile) {
    return tile.classList.contains("vacant")
      || tile.classList.contains("locked")
      || tile.classList.contains("disabled")
      || tile.getAttribute("aria-disabled") === "true";
  }

  function compactSparseBoard(board) {
    const grid = board.querySelector(".bed-board-grid");
    if (!grid) return;
    const tiles = [...grid.querySelectorAll(".bed-tile")];
    if (!tiles.length) return;
    const occupied = tiles.filter(tile => !tileIsVacant(tile));
    const vacant = tiles.filter(tileIsVacant);
    const density = occupied.length / Math.max(1, tiles.length);
    const shouldCompact = occupied.length > 0
      && occupied.length < 12
      && vacant.length > occupied.length * 1.5
      && density < 0.55;

    vacant.forEach(tile => {
      if (shouldCompact) {
        tile.hidden = true;
        tile.dataset.sparseHidden = "true";
      } else if (tile.dataset.sparseHidden === "true") {
        tile.hidden = false;
        delete tile.dataset.sparseHidden;
      }
    });

    const total = board.querySelector(".bed-board-totals span:first-child");
    if (total) {
      total.textContent = shouldCompact
        ? `${occupied.length} cama(s) con paciente`
        : `${tiles.length} cama(s)`;
    }
  }

  function run() {
    document.querySelectorAll(".bed-board.preventive, .bed-board.iaas").forEach(compactSparseBoard);
  }

  const observer = new MutationObserver(() => window.requestAnimationFrame(run));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(run, 80));
})();

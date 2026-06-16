import { button, checkboxInput, el, field, notice, numberInput, table, textareaInput } from "./dom.js";
import {
  parseOperationalBackupText,
  restoreOperationalBackup,
  summarizeOperationalBackup
} from "../services/backupRestoreService.js";

export function renderBackupRestorePanel(app, onRestored = () => {}) {
  const state = app.state.moduleState.backupRestore ||= {
    text: "",
    backup: null,
    summary: [],
    selected: {},
    maxRows: 1000,
    message: ""
  };
  const root = el("section", { class: "row-card backup-restore-panel" });

  function redraw() {
    root.replaceChildren(
      el("strong", {}, ["Restauracion JSON operativa"]),
      el("span", { class: "muted" }, ["Carga un respaldo generado por Reportes y restaura datasets activos con cola offline segura."]),
      state.message ? notice(state.message, state.message.includes("Error") ? "warn" : "ok") : "",
      el("div", { class: "form-grid compact" }, [
        field("Archivo JSON", el("input", {
          type: "file",
          accept: "application/json,.json",
          onchange: async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            state.text = await file.text();
            analyzeBackup(state);
            redraw();
          }
        })),
        field("Max filas por dataset", numberInput({
          min: "1",
          max: "5000",
          step: "1",
          value: state.maxRows,
          onchange: event => { state.maxRows = Number(event.target.value) || 1000; }
        }))
      ]),
      field("Pegar JSON", textareaInput({
        rows: 6,
        value: state.text,
        oninput: event => { state.text = event.target.value; }
      })),
      el("div", { class: "toolbar" }, [
        button("Analizar JSON", () => {
          analyzeBackup(state);
          redraw();
        }, { class: "ghost" }),
        button("Restaurar seleccionados", async () => {
          const selected = Object.entries(state.selected).filter(([, value]) => value).map(([key]) => key);
          if (!state.backup || !selected.length) {
            state.message = "Error: no hay datasets restaurables seleccionados.";
            redraw();
            return;
          }
          if (!globalThis.confirm(`Restaurar ${selected.join(", ")} desde el JSON cargado?`)) return;
          const result = await restoreOperationalBackup(app, state.backup, selected, { maxRows: state.maxRows });
          state.message = result.results.map(item => `${item.label}: ${item.written}/${item.total}`).join(" | ");
          await onRestored(result);
          redraw();
        }, { class: "primary", disabled: !state.backup })
      ]),
      state.summary.length ? restoreSummaryTable(state) : ""
    );
  }

  redraw();
  return root;
}

function analyzeBackup(state) {
  try {
    state.backup = parseOperationalBackupText(state.text);
    state.summary = summarizeOperationalBackup(state.backup);
    state.selected = Object.fromEntries(state.summary.map(item => [item.key, item.supported && item.count > 0]));
    state.message = `Backup listo: ${state.summary.reduce((total, item) => total + item.count, 0)} registro(s) detectados.`;
  } catch (error) {
    state.backup = null;
    state.summary = [];
    state.selected = {};
    state.message = `Error: ${error.message || String(error || "JSON invalido.")}`;
  }
}

function restoreSummaryTable(state) {
  return table(["Restaurar", "Dataset", "Registros", "ID", "Destino"], state.summary.map(item =>
    el("tr", {}, [
      el("td", {}, [checkboxInput({
        checked: Boolean(state.selected[item.key]),
        disabled: !item.supported || item.count === 0,
        onchange: event => { state.selected[item.key] = event.target.checked; }
      })]),
      el("td", {}, [item.label]),
      el("td", {}, [String(item.count)]),
      el("td", {}, [item.idField || "No restaurable"]),
      el("td", {}, [item.supported ? item.collection : "Solo lectura"])
    ])
  ));
}

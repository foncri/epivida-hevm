import { button, dateInput, el, field, notice, numberInput, selectInput } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { listActiveDevices } from "../../services/deviceService.js";
import { listActiveIaas } from "../../services/iaasService.js";
import { listActivePatients } from "../../services/patientService.js";
import { downloadCsv, downloadJson } from "../../services/exportService.js";
import { listPendingWrites } from "../../services/offlineQueueService.js";
import { buildOperationalBackup, dailySnapshotRowsForRange, historicalExportOptions, pageHistoricalRows } from "../../services/reportService.js";

export async function render({ app }) {
  const state = app.state.moduleState.reportes ||= {
    from: todayIso(),
    to: todayIso(),
    history: {
      dataset: "nursing_rounds",
      from: todayIso(),
      to: todayIso(),
      pageSize: 100,
      cursor: null
    },
    message: ""
  };
  const body = el("div", { class: "stack" });

  function redraw() {
    body.replaceChildren(
      state.message ? notice(state.message, state.message.includes("primeros") ? "warn" : "ok") : "",
      renderDailySnapshotExport(app, state, redraw),
      renderHistoricalChunkExport(app, state, redraw),
      renderOperationalBackupExport(app, state, redraw),
      el("section", { class: "row-list" }, [
        exportCard("Censo actual CSV", "patients_active", async () => downloadCsv(app, `epivida-censo-${todayIso()}.csv`, await listActivePatients(), { dataset: "patients_active" })),
        exportCard("Dispositivos activos CSV", "devices_active", async () => downloadCsv(app, `epivida-dispositivos-${todayIso()}.csv`, await listActiveDevices(), { dataset: "devices_active" })),
        exportCard("IAAS activas CSV", "iaas_active", async () => downloadCsv(app, `epivida-iaas-${todayIso()}.csv`, await listActiveIaas(), { dataset: "iaas_active" })),
        exportCard("Sincronizacion pendiente CSV", "sync_queue local", async () => downloadCsv(app, `epivida-sync-pendiente-${todayIso()}.csv`, await listPendingWrites(), { dataset: "sync_queue" }))
      ])
    );
  }

  redraw();
  return modulePage("Reportes", "Exportadores bajo demanda. No se cargan librerias Excel al inicio.", [
    body
  ]);
}

function renderHistoricalChunkExport(app, state, redraw) {
  const history = state.history;
  const resetCursor = () => {
    history.cursor = null;
  };
  return el("section", { class: "form-card" }, [
    el("h2", {}, ["Historicos crudos por bloque"]),
    el("div", { class: "form-grid compact" }, [
      field("Dataset", selectInput(historicalExportOptions(), {
        value: history.dataset,
        onchange: event => {
          history.dataset = event.target.value;
          resetCursor();
        }
      })),
      field("Desde", dateInput({
        value: history.from,
        onchange: event => {
          history.from = event.target.value;
          resetCursor();
        }
      })),
      field("Hasta", dateInput({
        value: history.to,
        onchange: event => {
          history.to = event.target.value;
          resetCursor();
        }
      })),
      field("Bloque", numberInput({
        min: "1",
        max: "250",
        step: "1",
        value: history.pageSize,
        onchange: event => {
          history.pageSize = event.target.value;
          resetCursor();
        }
      }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Exportar siguiente bloque CSV", async () => {
        const result = await pageHistoricalRows(history.dataset, history.from, history.to, {
          ...(history.cursor || {}),
          pageSize: Number(history.pageSize) || 100,
          direction: "next"
        });
        if (result.error) {
          state.message = result.error;
          redraw();
          return;
        }
        await downloadCsv(app, `epivida-${result.dataset.key}-${result.from}-${result.to}.csv`, result.rows, {
          dataset: result.dataset.collection,
          from: result.from,
          to: result.to,
          chunked: true,
          hasNext: result.hasNext
        });
        history.cursor = {
          firstCursor: result.firstCursor,
          lastCursor: result.lastCursor,
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious,
          pageSize: result.pageSize
        };
        state.message = result.hasNext
          ? `Exportados ${result.rows.length} registro(s). Hay mas bloques disponibles.`
          : `Exportados ${result.rows.length} registro(s). No hay mas bloques en este rango.`;
        redraw();
      }, { class: "ghost" }),
      button("Reiniciar bloque", () => {
        resetCursor();
        state.message = "Cursor historico reiniciado.";
        redraw();
      }, { class: "ghost", disabled: !history.cursor })
    ])
  ]);
}

function renderOperationalBackupExport(app, state, redraw) {
  return el("section", { class: "form-card" }, [
    el("h2", {}, ["Respaldo operativo JSON"]),
    el("p", { class: "muted" }, ["Incluye censo activo, dispositivos activos, IAAS activas, cola pendiente y snapshots del rango seleccionado."]),
    el("div", { class: "toolbar" }, [
      button("Descargar respaldo JSON", async () => {
        const backup = await buildOperationalBackup(app, { includeSnapshots: true, from: state.from, to: state.to });
        await downloadJson(app, `epivida-backup-${todayIso()}.json`, backup, {
          dataset: "operational_backup",
          rows: backup.meta.patients + backup.meta.devices + backup.meta.iaas + backup.meta.pending + backup.meta.snapshots
        });
        state.message = `Respaldo JSON generado: ${backup.meta.patients} pacientes, ${backup.meta.devices} dispositivos, ${backup.meta.iaas} IAAS.`;
        redraw();
      }, { class: "ghost" })
    ])
  ]);
}

function renderDailySnapshotExport(app, state, redraw) {
  return el("section", { class: "form-card" }, [
    el("h2", {}, ["Snapshots diarios por rango"]),
    el("div", { class: "form-grid compact" }, [
      field("Desde", dateInput({
        value: state.from,
        onchange: event => {
          state.from = event.target.value;
        }
      })),
      field("Hasta", dateInput({
        value: state.to,
        onchange: event => {
          state.to = event.target.value;
        }
      }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Exportar snapshots CSV", async () => {
        const result = await dailySnapshotRowsForRange(state.from, state.to);
        await downloadCsv(app, `epivida-snapshots-${result.from}-${result.to}.csv`, result.rows, {
          dataset: "daily_snapshots",
          from: result.from,
          to: result.to,
          truncated: result.truncated
        });
        state.message = result.truncated
          ? `Exportados los primeros ${result.rows.length} dias. Acorta el rango para evitar cargas grandes.`
          : `Exportados ${result.rows.length} snapshot(s).`;
        redraw();
      }, { class: "ghost" })
    ])
  ]);
}

function exportCard(title, dataset, action) {
  return el("article", { class: "row-card" }, [
    el("strong", {}, [title]),
    el("span", { class: "muted" }, [`Fuente: ${dataset}.`]),
    button("Exportar", action, { class: "ghost" })
  ]);
}

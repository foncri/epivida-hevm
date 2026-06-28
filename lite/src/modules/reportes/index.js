import { button, dateInput, el, field, notice, numberInput, selectInput } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { listActiveDevices } from "../../services/deviceService.js";
import { listActiveIaas } from "../../services/iaasService.js";
import { listActivePatients } from "../../services/patientService.js";
import { downloadCsv, downloadJson } from "../../services/exportService.js";
import { listPendingWrites } from "../../services/offlineQueueService.js";
import { preventiveCedulaCsvRows, preventiveCedulaOptions, preventiveMonthlyCsvRows } from "../../services/preventiveCedulaService.js";
import { buildOperationalBackup, historicalExportOptions, pageHistoricalRows } from "../../services/reportService.js";
import { renderEpidemiologicalCensusExport } from "./epidemiologicalExports.js";
import { renderDailySnapshotExport } from "./snapshotExports.js";

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
    cedula: {
      packageKey: "its",
      date: todayIso(),
      month: todayIso()
    },
    message: ""
  };
  const body = el("div", { class: "stack" });

  function redraw() {
    body.replaceChildren(
      state.message ? notice(state.message, state.message.includes("primeros") ? "warn" : "ok") : "",
      renderDailySnapshotExport(app, state, redraw),
      renderPreventiveCedulaExport(app, state, redraw),
      renderEpidemiologicalCensusExport(app, state, redraw),
      renderHistoricalChunkExport(app, state, redraw),
      renderOperationalBackupExport(app, state, redraw),
      el("section", { class: "row-list" }, [
        exportCard("Censo actual", "patients_active", {
          csv: async () => downloadCsv(app, `epivida-censo-${todayIso()}.csv`, await listActivePatients(), { dataset: "patients_active" }),
          excel: async () => downloadExcel(app, `epivida-censo-${todayIso()}.xlsx`, await listActivePatients(), { dataset: "patients_active", sheetName: "Censo" })
        }),
        exportCard("Dispositivos activos", "devices_active", {
          csv: async () => downloadCsv(app, `epivida-dispositivos-${todayIso()}.csv`, await listActiveDevices(), { dataset: "devices_active" }),
          excel: async () => downloadExcel(app, `epivida-dispositivos-${todayIso()}.xlsx`, await listActiveDevices(), { dataset: "devices_active", sheetName: "Dispositivos" })
        }),
        exportCard("IAAS activas", "iaas_active", {
          csv: async () => downloadCsv(app, `epivida-iaas-${todayIso()}.csv`, await listActiveIaas(), { dataset: "iaas_active" }),
          excel: async () => downloadExcel(app, `epivida-iaas-${todayIso()}.xlsx`, await listActiveIaas(), { dataset: "iaas_active", sheetName: "IAAS" })
        }),
        exportCard("Sincronizacion pendiente", "sync_queue local", {
          csv: async () => downloadCsv(app, `epivida-sync-pendiente-${todayIso()}.csv`, await listPendingWrites(), { dataset: "sync_queue" }),
          excel: async () => downloadExcel(app, `epivida-sync-pendiente-${todayIso()}.xlsx`, await listPendingWrites(), { dataset: "sync_queue", sheetName: "Sync" })
        })
      ])
    );
  }

  redraw();
  return modulePage("Reportes", "Exportadores bajo demanda. No se cargan librerias Excel al inicio.", [
    body
  ]);
}

function renderPreventiveCedulaExport(app, state, redraw) {
  const cedula = state.cedula;
  return el("section", { class: "form-card" }, [
    el("h2", {}, ["Cedulas preventivas"]),
    el("p", { class: "muted" }, ["Genera archivos bajo demanda desde rondas guardadas; no carga Google Sheets ni librerias Excel al inicio."]),
    el("div", { class: "form-grid compact" }, [
      field("Paquete", selectInput(preventiveCedulaOptions(), {
        value: cedula.packageKey,
        onchange: event => { cedula.packageKey = event.target.value; }
      })),
      field("Dia", dateInput({
        value: cedula.date,
        onchange: event => { cedula.date = event.target.value; }
      })),
      field("Mes", dateInput({
        value: cedula.month,
        onchange: event => { cedula.month = event.target.value; }
      }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Exportar cedula diaria CSV", async () => {
        const result = await preventiveCedulaCsvRows(cedula.date, cedula.packageKey);
        await downloadCsv(app, `epivida-cedula-${result.spec.key}-${result.date}.csv`, result.rows, {
          dataset: "preventive_cedula",
          packageType: result.spec.packageType,
          date: result.date
        });
        state.message = `Cedula ${result.spec.defaultTitle} exportada: ${result.rows.length} fila(s).`;
        redraw();
      }, { class: "ghost" }),
      button("Exportar cedula diaria Excel", async () => {
        const result = await preventiveCedulaCsvRows(cedula.date, cedula.packageKey);
        await downloadExcel(app, `epivida-cedula-${result.spec.key}-${result.date}.xlsx`, result.rows, {
          dataset: "preventive_cedula",
          packageType: result.spec.packageType,
          date: result.date,
          sheetName: result.spec.key
        });
        state.message = `Cedula Excel ${result.spec.defaultTitle} exportada: ${result.rows.length} fila(s).`;
        redraw();
      }, { class: "ghost" }),
      button("Exportar mensual CSV", async () => {
        const result = await preventiveMonthlyCsvRows(cedula.month, cedula.packageKey);
        await downloadCsv(app, `epivida-cedula-mensual-${result.spec.key}-${result.month.monthKey}.csv`, result.rows, {
          dataset: "preventive_cedula_monthly",
          packageType: result.spec.packageType,
          month: result.month.monthKey
        });
        state.message = `Mensual ${result.spec.defaultTitle} exportado: ${result.rows.length} fila(s).`;
        redraw();
      }, { class: "ghost" }),
      button("Exportar mensual Excel", async () => {
        const result = await preventiveMonthlyCsvRows(cedula.month, cedula.packageKey);
        await downloadExcel(app, `epivida-cedula-mensual-${result.spec.key}-${result.month.monthKey}.xlsx`, result.rows, {
          dataset: "preventive_cedula_monthly",
          packageType: result.spec.packageType,
          month: result.month.monthKey,
          sheetName: `${result.spec.key} mensual`
        });
        state.message = `Mensual Excel ${result.spec.defaultTitle} exportado: ${result.rows.length} fila(s).`;
        redraw();
      }, { class: "ghost" })
    ])
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
      button("Exportar siguiente bloque Excel", async () => {
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
        await downloadExcel(app, `epivida-${result.dataset.key}-${result.from}-${result.to}.xlsx`, result.rows, {
          dataset: result.dataset.collection,
          from: result.from,
          to: result.to,
          chunked: true,
          hasNext: result.hasNext,
          sheetName: result.dataset.key
        });
        history.cursor = {
          firstCursor: result.firstCursor,
          lastCursor: result.lastCursor,
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious,
          pageSize: result.pageSize
        };
        state.message = result.hasNext
          ? `Exportados ${result.rows.length} registro(s) Excel. Hay mas bloques disponibles.`
          : `Exportados ${result.rows.length} registro(s) Excel. No hay mas bloques en este rango.`;
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
    el("p", { class: "muted" }, ["Incluye censo activo, dispositivos activos, IAAS activas, catalogos, cola pendiente y snapshots del rango seleccionado."]),
    el("div", { class: "toolbar" }, [
      button("Descargar respaldo JSON", async () => {
        const backup = await buildOperationalBackup(app, { includeSnapshots: true, from: state.from, to: state.to });
        await downloadJson(app, `epivida-backup-${todayIso()}.json`, backup, {
          dataset: "operational_backup",
          rows: backup.meta.patients + backup.meta.devices + backup.meta.iaas + backup.meta.catalogs + backup.meta.pending + backup.meta.snapshots
        });
        state.message = `Respaldo JSON generado: ${backup.meta.patients} pacientes, ${backup.meta.devices} dispositivos, ${backup.meta.iaas} IAAS, ${backup.meta.catalogs} catalogos.`;
        redraw();
      }, { class: "ghost" })
    ])
  ]);
}

function exportCard(title, dataset, actions) {
  return el("article", { class: "row-card" }, [
    el("strong", {}, [title]),
    el("span", { class: "muted" }, [`Fuente: ${dataset}.`]),
    el("div", { class: "toolbar" }, [
      button("CSV", actions.csv, { class: "ghost" }),
      button("Excel", actions.excel, { class: "ghost" })
    ])
  ]);
}

async function downloadExcel(app, filename, rows, meta = {}) {
  const { downloadWorkbook } = await import("../../services/excelExportService.js");
  return downloadWorkbook(app, filename, rows, meta);
}

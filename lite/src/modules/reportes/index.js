import { button, dateInput, el, field, notice } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { listActiveDevices } from "../../services/deviceService.js";
import { listActiveIaas } from "../../services/iaasService.js";
import { listActivePatients } from "../../services/patientService.js";
import { downloadCsv } from "../../services/exportService.js";
import { listPendingWrites } from "../../services/offlineQueueService.js";
import { dailySnapshotRowsForRange } from "../../services/reportService.js";

export async function render({ app }) {
  const state = app.state.moduleState.reportes ||= {
    from: todayIso(),
    to: todayIso(),
    message: ""
  };
  const body = el("div", { class: "stack" });

  function redraw() {
    body.replaceChildren(
      state.message ? notice(state.message, state.message.includes("primeros") ? "warn" : "ok") : "",
      renderDailySnapshotExport(app, state, redraw),
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

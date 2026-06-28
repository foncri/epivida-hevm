import { button, dateInput, el, field } from "../../components/dom.js";
import { downloadCsv } from "../../services/exportService.js";
import { dailySnapshotRowsForRange, monthlySnapshotRowsForRange, yearlySnapshotRowsForRange } from "../../services/reportService.js";

export function renderDailySnapshotExport(app, state, redraw) {
  return el("section", { class: "form-card" }, [
    el("h2", {}, ["Snapshots operativos por rango"]),
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
      }, { class: "ghost" }),
      button("Exportar snapshots Excel", async () => {
        const result = await dailySnapshotRowsForRange(state.from, state.to);
        await downloadExcel(app, `epivida-snapshots-${result.from}-${result.to}.xlsx`, result.rows, {
          dataset: "daily_snapshots",
          from: result.from,
          to: result.to,
          truncated: result.truncated,
          sheetName: "Snapshots"
        });
        state.message = result.truncated
          ? `Exportados en Excel los primeros ${result.rows.length} dias. Acorta el rango para evitar cargas grandes.`
          : `Exportados en Excel ${result.rows.length} snapshot(s).`;
        redraw();
      }, { class: "ghost" }),
      button("Exportar mensual CSV", async () => {
        const result = await monthlySnapshotRowsForRange(state.from, state.to);
        await downloadCsv(app, `epivida-snapshots-mensuales-${result.from}-${result.to}.csv`, result.rows, {
          dataset: "monthly_snapshots",
          from: result.from,
          to: result.to,
          truncated: result.truncated
        });
        state.message = result.truncated
          ? `Exportados los primeros ${result.rows.length} mes(es). Acorta el rango para evitar cargas grandes.`
          : `Exportados ${result.rows.length} snapshot(s) mensual(es).`;
        redraw();
      }, { class: "ghost" }),
      button("Exportar mensual Excel", async () => {
        const result = await monthlySnapshotRowsForRange(state.from, state.to);
        await downloadExcel(app, `epivida-snapshots-mensuales-${result.from}-${result.to}.xlsx`, result.rows, {
          dataset: "monthly_snapshots",
          from: result.from,
          to: result.to,
          truncated: result.truncated,
          sheetName: "Mensuales"
        });
        state.message = result.truncated
          ? `Exportados en Excel los primeros ${result.rows.length} mes(es). Acorta el rango para evitar cargas grandes.`
          : `Exportados en Excel ${result.rows.length} snapshot(s) mensual(es).`;
        redraw();
      }, { class: "ghost" }),
      button("Exportar anual CSV", async () => {
        const result = await yearlySnapshotRowsForRange(state.from, state.to);
        await downloadCsv(app, `epivida-snapshots-anuales-${result.from}-${result.to}.csv`, result.rows, {
          dataset: "yearly_snapshots",
          from: result.from,
          to: result.to,
          truncated: result.truncated
        });
        state.message = result.truncated
          ? `Exportados los primeros ${result.rows.length} anio(s). Acorta el rango para evitar cargas grandes.`
          : `Exportados ${result.rows.length} snapshot(s) anual(es).`;
        redraw();
      }, { class: "ghost" }),
      button("Exportar anual Excel", async () => {
        const result = await yearlySnapshotRowsForRange(state.from, state.to);
        await downloadExcel(app, `epivida-snapshots-anuales-${result.from}-${result.to}.xlsx`, result.rows, {
          dataset: "yearly_snapshots",
          from: result.from,
          to: result.to,
          truncated: result.truncated,
          sheetName: "Anuales"
        });
        state.message = result.truncated
          ? `Exportados en Excel los primeros ${result.rows.length} anio(s). Acorta el rango para evitar cargas grandes.`
          : `Exportados en Excel ${result.rows.length} snapshot(s) anual(es).`;
        redraw();
      }, { class: "ghost" })
    ])
  ]);
}

async function downloadExcel(app, filename, rows, meta = {}) {
  const { downloadWorkbook } = await import("../../services/excelExportService.js");
  return downloadWorkbook(app, filename, rows, meta);
}

import { button, el } from "../../components/dom.js";
import { todayIso } from "../../lib/date.js";
import { downloadCsv } from "../../services/exportService.js";
import { listActivePatients } from "../../services/patientService.js";
import {
  epidemiologicalCensusPatientRows,
  epidemiologicalCensusSummaryRows,
  epidemiologicalPrintReportModel
} from "../../services/reportService.js";

export function renderEpidemiologicalCensusExport(app, state, redraw) {
  return el("section", { class: "form-card" }, [
    el("h2", {}, ["Censo epidemiologico"]),
    el("div", { class: "toolbar" }, [
      button("Exportar resumen CSV", () => exportEpidemiologicalSummary(app, state, redraw, "csv"), { class: "ghost" }),
      button("Exportar resumen Excel", () => exportEpidemiologicalSummary(app, state, redraw, "excel"), { class: "ghost" }),
      button("Exportar detalle CSV", () => exportEpidemiologicalDetail(app, state, redraw, "csv"), { class: "ghost" }),
      button("Exportar detalle Excel", () => exportEpidemiologicalDetail(app, state, redraw, "excel"), { class: "ghost" }),
      button("Preparar vista imprimible", () => prepareEpidemiologicalPrint(app, state, redraw), { class: "ghost" })
    ]),
    state.epidemiologicalPrint ? renderEpidemiologicalPrintPreview(state, redraw) : ""
  ]);
}

async function exportEpidemiologicalSummary(app, state, redraw, format) {
  const patients = await listActivePatients();
  const rows = epidemiologicalCensusSummaryRows(patients);
  const date = todayIso();
  if (format === "excel") {
    await downloadExcel(app, `epivida-censo-epidemiologico-resumen-${date}.xlsx`, rows, {
      dataset: "patients_active_epidemiological_summary",
      sheetName: "Resumen epi"
    });
  } else {
    await downloadCsv(app, `epivida-censo-epidemiologico-resumen-${date}.csv`, rows, {
      dataset: "patients_active_epidemiological_summary"
    });
  }
  state.message = `Censo epidemiologico exportado: ${rows.length} indicador(es).`;
  redraw();
}

async function exportEpidemiologicalDetail(app, state, redraw, format) {
  const patients = await listActivePatients();
  const rows = epidemiologicalCensusPatientRows(patients);
  const date = todayIso();
  if (format === "excel") {
    await downloadExcel(app, `epivida-censo-epidemiologico-detalle-${date}.xlsx`, rows, {
      dataset: "patients_active_epidemiological_detail",
      sheetName: "Detalle epi"
    });
  } else {
    await downloadCsv(app, `epivida-censo-epidemiologico-detalle-${date}.csv`, rows, {
      dataset: "patients_active_epidemiological_detail"
    });
  }
  state.message = `Detalle epidemiologico exportado: ${rows.length} paciente(s).`;
  redraw();
}

async function prepareEpidemiologicalPrint(app, state, redraw) {
  const patients = await listActivePatients();
  state.epidemiologicalPrint = epidemiologicalPrintReportModel(patients);
  state.message = `Vista imprimible preparada: ${state.epidemiologicalPrint.totalPatients} paciente(s).`;
  redraw();
}

function renderEpidemiologicalPrintPreview(state, redraw) {
  const model = state.epidemiologicalPrint;
  return el("section", { class: "print-report-panel" }, [
    el("div", { class: "toolbar screen-only" }, [
      button("Imprimir vista", () => printPreparedEpiReport(), { class: "primary" }),
      button("Cerrar vista", () => {
        state.epidemiologicalPrint = null;
        redraw();
      }, { class: "ghost" })
    ]),
    renderReportHeader(model),
    renderReportTable(model),
    renderReportSummary(model)
  ]);
}

function renderReportHeader(model) {
  return el("div", { class: "print-report-head" }, [
    el("strong", {}, [model.institution]),
    el("h2", {}, [model.title]),
    el("p", {}, [model.hospital]),
    el("p", {}, [`Fecha: ${model.date} | Total pacientes: ${model.totalPatients}`])
  ]);
}

function renderReportTable(model) {
  return el("div", { class: "print-table-wrap" }, [
    el("table", { class: "print-report-table" }, [
      el("thead", {}, [el("tr", {}, model.columns.map(column => el("th", {}, [column])))]),
      el("tbody", {}, model.rows.length
        ? model.rows.map(row => el("tr", {}, [
          el("td", {}, [row.service]),
          el("td", {}, [row.bed]),
          el("td", {}, [row.patientName]),
          el("td", {}, [row.sector]),
          el("td", {}, [row.age]),
          el("td", {}, [row.sex]),
          el("td", {}, [row.admissionDate]),
          el("td", {}, [row.deih]),
          el("td", {}, [row.state]),
          el("td", {}, [row.hospitalDiagnosis]),
          el("td", {}, [row.epidemiologicalDiagnosis]),
          el("td", {}, [row.observations])
        ]))
        : [el("tr", {}, [el("td", { colspan: model.columns.length }, ["Sin pacientes activos."])])])
    ])
  ]);
}

function renderReportSummary(model) {
  return el("div", { class: "print-summary-grid" }, [
    el("section", {}, [
      el("h3", {}, ["Concentrado de indicadores"]),
      el("table", { class: "print-summary-table" }, [
        el("tbody", {}, model.summaryRows.map(row => el("tr", {}, [
          el("th", {}, [row.indicador]),
          el("td", {}, [row.valor])
        ])))
      ])
    ]),
    el("section", {}, [
      el("h3", {}, ["Validacion y responsables"]),
      el("p", {}, ["DRA. FABIOLA MONTERROSA HERNANDEZ"]),
      el("p", {}, ["JEFE DE DPTO. MED. PREV. Y EPIDEMIOLOGIA"]),
      el("p", {}, ["VIGILANCIA EPIDEMIOLOGICA HOSPITALARIA"])
    ])
  ]);
}

function printPreparedEpiReport() {
  document.body.classList.add("printing-epivida-report");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-epivida-report"), 250);
}

async function downloadExcel(app, filename, rows, meta = {}) {
  const { downloadWorkbook } = await import("../../services/excelExportService.js");
  return downloadWorkbook(app, filename, rows, meta);
}

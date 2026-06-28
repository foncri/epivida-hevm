import { badge, el, frameScheduler, link, pagedTable, selectInput, textInput } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { listActivePatients, listArchivedPatientsWithPendingOpd } from "../../services/patientService.js";
import { monitorFilterOptions, monitorOpdStatus, monitorPatientAgeYears, monitorPatientDeih, monitorPatientDiagnosis, monitorSeverity, monitorSeveritySummary, monitorStats, visibleMonitorPatients } from "../../services/monitorService.js";

export async function render() {
  const [patients, archivedOpdPatients] = await Promise.all([
    listActivePatients(),
    listArchivedPatientsWithPendingOpd({ limit: 25 })
  ]);
  const filterOptions = monitorFilterOptions(patients);
  const filters = { query: "", service: "Todos", sex: "Todos", status: "Todos", diagnosis: "Todos", ageRange: "Todos", epiBase: "Todos", priority: "Todos", sort: "servicio" };
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = visibleMonitorPatients(patients, filters);
    body.replaceChildren(
      stats(monitorStats(patients, visible)),
      archivedOpdPanel(archivedOpdPatients),
      el("div", { class: "toolbar" }, [
        textInput({ placeholder: "Buscar nombre, cama, diagnostico", value: filters.query, oninput: event => { filters.query = event.target.value; scheduleRedraw(); } }),
        selectInput(filterOptions.service, { value: filters.service, onchange: event => { filters.service = event.target.value; redraw(); } }),
        selectInput(filterOptions.diagnosis, { value: filters.diagnosis, onchange: event => { filters.diagnosis = event.target.value; redraw(); } }),
        selectInput(filterOptions.sex, { value: filters.sex, onchange: event => { filters.sex = event.target.value; redraw(); } }),
        selectInput(filterOptions.status, { value: filters.status, onchange: event => { filters.status = event.target.value; redraw(); } }),
        selectInput(filterOptions.ageRange, { value: filters.ageRange, onchange: event => { filters.ageRange = event.target.value; redraw(); } }),
        selectInput(filterOptions.epiBase, { value: filters.epiBase, onchange: event => { filters.epiBase = event.target.value; redraw(); } }),
        selectInput(filterOptions.priority, { value: filters.priority, onchange: event => { filters.priority = event.target.value; redraw(); } }),
        selectInput(filterOptions.sort, { value: filters.sort, onchange: event => { filters.sort = event.target.value; redraw(); } })
      ]),
      pagedTable(["Prioridad", "Motivo", "Servicio", "Cama", "Paciente", "Edad", "DEIH", "Sexo", "Dx epidemiologico", "OPD", "Sync"], visible, patient =>
        el("tr", {}, [
          el("td", {}, [badge(monitorSeverity(patient).label, monitorSeverityTone(patient))]),
          el("td", {}, [monitorSeveritySummary(patient)]),
          el("td", {}, [patient.service || patient.currentService || ""]),
          el("td", {}, [patient.bed || patient.currentBed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
          el("td", {}, [patientAgeLabel(patient)]),
          el("td", {}, [patientDeihLabel(patient)]),
          el("td", {}, [patient.sex || ""]),
          el("td", {}, [monitorPatientDiagnosis(patient)]),
          el("td", {}, [opdBadge(patient)]),
          el("td", {}, [patient.syncStatus === "local_pending" ? badge("Pendiente", "warn") : patient.syncStatus || ""])
        ])
      )
    );
  }

  const scheduleRedraw = frameScheduler(redraw);
  redraw();
  return modulePage("Monitoreo Epidemiologico", "Modulo prioritario. No carga ronda, IAAS completo, reportes ni importadores.", [body]);
}

function archivedOpdPanel(patients = []) {
  if (!patients.length) return "";
  return el("section", { class: "iaas-panel archived-opd-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Alta OPD archivada"]),
        el("p", {}, ["Pacientes egresados pendientes de cierre OPD."])
      ]),
      badge(String(patients.length), "warn")
    ]),
    el("div", { class: "row-list" }, patients.slice(0, 5).map(archivedOpdCard))
  ]);
}

function archivedOpdCard(patient = {}) {
  const status = monitorOpdStatus(patient);
  const patientId = patient.patientId || patient.id || "";
  return el("article", { class: "row-card" }, [
    el("strong", {}, [patient.patientName || patient.name || patientId || "Paciente archivado"]),
    el("span", { class: "muted" }, [`${patientArchivedLocation(patient)} - ${status.detail || status.label}`]),
    patientId ? link(patientCensoHref(patientId), "Cerrar OPD", { class: "button ghost small" }) : ""
  ]);
}

function monitorSeverityTone(patient) {
  const level = monitorSeverity(patient).level;
  if (level === "critica" || level === "alta") return "warn";
  if (level === "media") return "neutral";
  return "ok";
}

function opdBadge(patient) {
  const status = monitorOpdStatus(patient);
  const patientId = patient.patientId || patient.id || "";
  if (status.pending && patientId) {
    return link(patientCensoHref(patientId), status.label, { class: `badge ${status.tone}`, title: status.detail || "Abrir captura OPD" });
  }
  return badge(status.label, status.tone);
}

function patientCensoHref(patientId = "") {
  return patientId ? `#/censo/paciente/${encodeURIComponent(patientId)}` : "#/censo";
}

function patientArchivedLocation(patient = {}) {
  const service = patient.lastService || patient.service || patient.currentService || "Sin servicio";
  const bed = patient.lastBed || patient.bed || patient.currentBed || "sin cama";
  return `${service} cama ${bed}`;
}

function patientAgeLabel(patient = {}) {
  const age = monitorPatientAgeYears(patient);
  if (age === null) return "";
  if (age < 1) return "<1";
  return String(Math.floor(age));
}

function patientDeihLabel(patient = {}) {
  const value = monitorPatientDeih(patient);
  return value === null ? "" : String(value);
}

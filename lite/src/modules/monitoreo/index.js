import { badge, el, frameScheduler, pagedTable, selectInput, textInput } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { listActivePatients } from "../../services/patientService.js";
import { monitorFilterOptions, monitorOpdStatus, monitorPatientDiagnosis, monitorSeverity, monitorStats, visibleMonitorPatients } from "../../services/monitorService.js";

export async function render() {
  const patients = await listActivePatients();
  const filterOptions = monitorFilterOptions(patients);
  const filters = { query: "", service: "Todos", sex: "Todos", status: "Todos", diagnosis: "Todos", priority: "Todos", sort: "servicio" };
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = visibleMonitorPatients(patients, filters);
    body.replaceChildren(
      stats(monitorStats(patients, visible)),
      el("div", { class: "toolbar" }, [
        textInput({ placeholder: "Buscar nombre, cama, diagnostico", oninput: event => { filters.query = event.target.value; scheduleRedraw(); } }),
        selectInput(filterOptions.service, { onchange: event => { filters.service = event.target.value; redraw(); } }),
        selectInput(filterOptions.diagnosis, { onchange: event => { filters.diagnosis = event.target.value; redraw(); } }),
        selectInput(filterOptions.sex, { onchange: event => { filters.sex = event.target.value; redraw(); } }),
        selectInput(filterOptions.status, { onchange: event => { filters.status = event.target.value; redraw(); } }),
        selectInput(filterOptions.priority, { onchange: event => { filters.priority = event.target.value; redraw(); } }),
        selectInput(filterOptions.sort, { onchange: event => { filters.sort = event.target.value; redraw(); } })
      ]),
      pagedTable(["Prioridad", "Servicio", "Cama", "Paciente", "Sexo", "Dx epidemiologico", "OPD", "Sync"], visible, patient =>
        el("tr", {}, [
          el("td", {}, [badge(monitorSeverity(patient).label, monitorSeverityTone(patient))]),
          el("td", {}, [patient.service || patient.currentService || ""]),
          el("td", {}, [patient.bed || patient.currentBed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
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

function monitorSeverityTone(patient) {
  const level = monitorSeverity(patient).level;
  if (level === "critica" || level === "alta") return "warn";
  if (level === "media") return "neutral";
  return "ok";
}

function opdBadge(patient) {
  const status = monitorOpdStatus(patient);
  return badge(status.label, status.tone);
}

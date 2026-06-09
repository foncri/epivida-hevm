import { badge, el, frameScheduler, pagedTable, selectInput, textInput } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { epidemiologicalDiagnosis, filterPatients, listActivePatients, sortPatientsByServiceBed, uniqueValues } from "../../services/patientService.js";

export async function render() {
  const patients = await listActivePatients();
  const filters = { query: "", service: "Todos", sex: "Todos", status: "Todos", diagnosis: "Todos" };
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = sortPatientsByServiceBed(filterPatients(patients, filters));
    body.replaceChildren(
      stats([
        [String(visible.length), "Filtrados"],
        [String(patients.length), "Pacientes activos"],
        [String(new Set(visible.map(row => row.service).filter(Boolean)).size), "Servicios"],
        [String(visible.filter(row => String(epidemiologicalDiagnosis(row)).includes("IAAS")).length), "Con texto IAAS"]
      ]),
      el("div", { class: "toolbar" }, [
        textInput({ placeholder: "Buscar nombre, cama, diagnostico", oninput: event => { filters.query = event.target.value; scheduleRedraw(); } }),
        selectInput(uniqueValues(patients, "service"), { onchange: event => { filters.service = event.target.value; redraw(); } }),
        selectInput(uniqueValues(patients, "diagnosis"), { onchange: event => { filters.diagnosis = event.target.value; redraw(); } }),
        selectInput(uniqueValues(patients, "sex"), { onchange: event => { filters.sex = event.target.value; redraw(); } }),
        selectInput(uniqueValues(patients, "status"), { onchange: event => { filters.status = event.target.value; redraw(); } })
      ]),
      pagedTable(["Servicio", "Cama", "Paciente", "Sexo", "Dx epidemiologico", "Sync"], visible, patient =>
        el("tr", {}, [
          el("td", {}, [patient.service || patient.currentService || ""]),
          el("td", {}, [patient.bed || patient.currentBed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
          el("td", {}, [patient.sex || ""]),
          el("td", {}, [epidemiologicalDiagnosis(patient)]),
          el("td", {}, [patient.syncStatus === "local_pending" ? badge("Pendiente", "warn") : patient.syncStatus || ""])
        ])
      )
    );
  }

  const scheduleRedraw = frameScheduler(redraw);
  redraw();
  return modulePage("Monitoreo Epidemiologico", "Modulo prioritario. No carga ronda, IAAS completo, reportes ni importadores.", [body]);
}

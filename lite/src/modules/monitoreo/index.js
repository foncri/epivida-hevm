import { el, selectInput, table, textInput } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { filterPatients, listActivePatients, uniqueValues } from "../../services/patientService.js";

export async function render() {
  const patients = await listActivePatients();
  const filters = { query: "", service: "Todos", sex: "Todos", status: "Todos" };
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = filterPatients(patients, filters);
    body.replaceChildren(
      stats([
        [String(visible.length), "Filtrados"],
        [String(patients.length), "Pacientes activos"],
        [String(new Set(visible.map(row => row.service).filter(Boolean)).size), "Servicios"],
        [String(visible.filter(row => String(row.epidemiologicalDiagnosis || "").includes("IAAS")).length), "Con texto IAAS"]
      ]),
      el("div", { class: "toolbar" }, [
        textInput({ placeholder: "Buscar nombre, cama, diagnostico", oninput: event => { filters.query = event.target.value; redraw(); } }),
        selectInput(uniqueValues(patients, "service"), { onchange: event => { filters.service = event.target.value; redraw(); } }),
        selectInput(uniqueValues(patients, "sex"), { onchange: event => { filters.sex = event.target.value; redraw(); } }),
        selectInput(uniqueValues(patients, "status"), { onchange: event => { filters.status = event.target.value; redraw(); } })
      ]),
      table(["Servicio", "Cama", "Paciente", "Sexo", "Dx epidemiologico"], visible.map(patient =>
        el("tr", {}, [
          el("td", {}, [patient.service || ""]),
          el("td", {}, [patient.bed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
          el("td", {}, [patient.sex || ""]),
          el("td", {}, [patient.epidemiologicalDiagnosis || ""])
        ])
      ))
    );
  }

  redraw();
  return modulePage("Monitoreo Epidemiologico", "Modulo prioritario. No carga ronda, IAAS completo, reportes ni importadores.", [body]);
}

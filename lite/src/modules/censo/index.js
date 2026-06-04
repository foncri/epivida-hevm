import { button, el, table, textInput, selectInput } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { currentCensus } from "../../services/censusService.js";
import { filterPatients, uniqueValues } from "../../services/patientService.js";
import { canWrite } from "../../lib/security.js";

export async function render({ app }) {
  const census = await currentCensus();
  const patients = census.patients;
  const filters = { query: "", service: "Todos", status: "Todos" };
  const role = app.state.auth.profile?.role;
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = filterPatients(patients, filters);
    body.replaceChildren(
      toolbar(filters, patients, redraw),
      table(["Cama", "Paciente", "Servicio", "Estado", "DEIH"], visible.map(patient =>
        el("tr", {}, [
          el("td", {}, [patient.bed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
          el("td", {}, [patient.service || ""]),
          el("td", {}, [patient.status || ""]),
          el("td", {}, [patient.deih ?? ""])
        ])
      ))
    );
  }

  redraw();
  return modulePage("Censo", `Pacientes activos desde Firestore. Censo ${census.date}. Busqueda local sin consultar por cada tecla.`, [body], [
    canWrite("censo", role) ? button("Nuevo paciente", () => alert("Formulario de alta: siguiente iteracion de Fase 3."), { class: "ghost" }) : ""
  ]);
}

function toolbar(filters, patients, redraw) {
  const query = textInput({ placeholder: "Buscar nombre, cama, diagnostico", oninput: event => { filters.query = event.target.value; redraw(); } });
  const service = selectInput(uniqueValues(patients, "service"), { onchange: event => { filters.service = event.target.value; redraw(); } });
  const status = selectInput(uniqueValues(patients, "status"), { onchange: event => { filters.status = event.target.value; redraw(); } });
  return el("div", { class: "toolbar" }, [query, service, status]);
}

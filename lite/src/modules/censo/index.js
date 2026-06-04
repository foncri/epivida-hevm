import { badge, button, dateInput, el, field, notice, numberInput, selectInput, table, textareaInput, textInput } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { currentCensus } from "../../services/censusService.js";
import { archivePatient, filterPatients, savePatient } from "../../services/patientService.js";
import { canWrite } from "../../lib/security.js";

const SEX_OPTIONS = ["", "F", "M"];
const STATE_OPTIONS = ["", "ESTABLE", "DELICADO", "GRAVE", "MUY GRAVE", "CRITICO"];
const EPI_OPTIONS = ["", "VIG TRANSMISIBLE", "VIG NO TRANSMISIBLE", "NO IAAS", "RIESGO IAAS", "IAAS"];

export async function render({ app }) {
  const census = await currentCensus();
  let patients = census.patients;
  const filters = { query: "", service: "Todos", status: "Todos" };
  const role = app.state.auth.profile?.role;
  const writable = canWrite("censo", role);
  let editing = null;
  let message = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = filterPatients(patients, filters);
    body.replaceChildren(
      message ? notice(message, message.includes("pendiente") ? "warn" : "ok") : "",
      toolbar(filters, patients, redraw),
      editing ? patientForm(app, editing, async saved => {
        patients = upsertPatient(patients, saved);
        editing = null;
        message = saved.syncStatus === "local_pending"
          ? "Paciente guardado localmente; queda pendiente de sincronizar."
          : "Paciente sincronizado.";
        redraw();
      }, () => { editing = null; redraw(); }) : "",
      table(["Cama", "Paciente", "Servicio", "Estado", "DEIH", ...(writable ? ["Acciones"] : [])], visible.map(patient =>
        el("tr", {}, [
          el("td", {}, [patient.bed || patient.currentBed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
          el("td", {}, [patient.service || patient.currentService || ""]),
          el("td", {}, [patient.status || patient.currentState || ""]),
          el("td", {}, [
            patient.syncStatus === "local_pending" ? badge("Pendiente", "warn") : String(patient.deih ?? "")
          ]),
          writable ? el("td", { class: "actions-cell" }, [
            button("Editar", () => { editing = patient; redraw(); }, { class: "small ghost" }),
            button("Egreso", async () => {
              const saved = await archivePatient(app, patient, "egreso_manual");
              patients = patients.filter(row => row.patientId !== saved.patientId);
              message = saved.syncStatus === "local_pending"
                ? "Egreso guardado localmente; queda pendiente de sincronizar."
                : "Egreso sincronizado.";
              redraw();
            }, { class: "small ghost" })
          ]) : ""
        ])
      ))
    );
  }

  redraw();
  return modulePage("Censo", `Pacientes activos desde Firestore. Censo ${census.date}. Busqueda local sin consultar por cada tecla.`, [body], [
    writable ? button("Nuevo paciente", () => { editing = {}; redraw(); }, { class: "ghost" }) : ""
  ]);
}

function toolbar(filters, patients, redraw) {
  const query = textInput({ placeholder: "Buscar nombre, cama, diagnostico", oninput: event => { filters.query = event.target.value; redraw(); } });
  const service = selectInput(patientValues(patients, row => row.service || row.currentService), { onchange: event => { filters.service = event.target.value; redraw(); } });
  const status = selectInput(patientValues(patients, row => row.status || row.currentState), { onchange: event => { filters.status = event.target.value; redraw(); } });
  return el("div", { class: "toolbar" }, [query, service, status]);
}

function patientValues(patients, getter) {
  return ["Todos", ...new Set(patients.map(getter).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "es")))];
}

function patientForm(app, patient, onSaved, onCancel) {
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      const payload = {
        ...patient,
        patientName: data.patientName,
        service: data.service,
        currentService: data.service,
        bed: data.bed,
        currentBed: data.bed,
        sector: data.sector,
        sex: data.sex,
        age: data.age ? Number(data.age) : "",
        admissionDate: data.admissionDate,
        status: data.status,
        currentState: data.status,
        epidemiologicalDiagnosis: data.epidemiologicalDiagnosis,
        currentEpidemiologicalDiagnosis: data.epidemiologicalDiagnosis,
        hospitalDiagnosis: data.hospitalDiagnosis,
        currentDiagnosis: data.hospitalDiagnosis,
        observations: data.observations
      };
      const saved = await savePatient(app, payload);
      onSaved(saved);
    }
  }, [
    el("div", { class: "form-grid" }, [
      field("Paciente", textInput({ name: "patientName", required: true, value: patient.patientName || "" })),
      field("Servicio", textInput({ name: "service", required: true, value: patient.service || patient.currentService || "" })),
      field("Cama", textInput({ name: "bed", value: patient.bed || patient.currentBed || "" })),
      field("Sector", textInput({ name: "sector", value: patient.sector || "" })),
      field("Sexo", selectInput(SEX_OPTIONS, { name: "sex", value: patient.sex || "" })),
      field("Edad", numberInput({ name: "age", min: 0, max: 120, value: patient.age ?? "" })),
      field("Ingreso", dateInput({ name: "admissionDate", value: patient.admissionDate || "" })),
      field("Estado", selectInput(STATE_OPTIONS, { name: "status", value: patient.status || patient.currentState || "" })),
      field("Dx epidemiologico", selectInput(EPI_OPTIONS, { name: "epidemiologicalDiagnosis", value: patient.epidemiologicalDiagnosis || "" })),
      field("Dx hospitalario", textInput({ name: "hospitalDiagnosis", value: patient.hospitalDiagnosis || patient.currentDiagnosis || "" }))
    ]),
    field("Observaciones", textareaInput({ name: "observations", rows: 3, value: patient.observations || "" })),
    el("div", { class: "toolbar" }, [
      button("Guardar", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function upsertPatient(rows, patient) {
  const next = rows.filter(row => row.patientId !== patient.patientId);
  if (patient.active !== false) next.unshift(patient);
  return next;
}

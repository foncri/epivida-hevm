import { badge, button, dateInput, el, field, frameScheduler, notice, numberInput, pagedTable, selectInput, textareaInput, textInput } from "../../components/dom.js";
import { renderOpdFields } from "../../components/opdFields.js";
import { modulePage } from "../../components/moduleLayout.js";
import { currentCensus } from "../../services/censusService.js";
import { archivePatient, filterPatients, savePatient, sortPatientsByServiceBed } from "../../services/patientService.js";
import { opdEligibilityForText, opdFromFormData, opdHasContent } from "../../services/opdService.js";
import { canWrite } from "../../lib/security.js";

const SEX_OPTIONS = ["", "F", "M"];
const STATE_OPTIONS = ["", "ESTABLE", "DELICADO", "GRAVE", "MUY GRAVE", "CRITICO"];
const EPI_OPTIONS = ["", "VIG TRANSMISIBLE", "VIG NO TRANSMISIBLE", "MORBIMORTALIDAD MATERNA/PERINATAL", "NO IAAS", "RIESGO IAAS", "IAAS"];

export async function render({ app }) {
  const census = await currentCensus();
  let patients = census.patients;
  const filters = { query: "", service: "Todos", status: "Todos" };
  const role = app.state.auth.profile?.role;
  const writable = canWrite("censo", role);
  let editing = null;
  let message = "";
  let messageTone = "";
  let busyPatientId = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = sortPatientsByServiceBed(filterPatients(patients, filters));
    body.replaceChildren(
      message ? notice(message, messageTone || (message.includes("pendiente") ? "warn" : "ok")) : "",
      toolbar(filters, patients, redraw, scheduleRedraw),
      editing ? patientForm(app, editing, async saved => {
        patients = upsertPatient(patients, saved);
        editing = null;
        message = saved.syncStatus === "local_pending"
          ? "Paciente guardado localmente; queda pendiente de sincronizar."
          : "Paciente sincronizado.";
        messageTone = saved.syncStatus === "local_pending" ? "warn" : "ok";
        redraw();
      }, error => {
        message = error;
        messageTone = "warn";
        redraw();
      }, () => { editing = null; redraw(); }) : "",
      pagedTable(["Cama", "Paciente", "Servicio", "Estado", "DEIH", "Sync", ...(writable ? ["Acciones"] : [])], visible, patient =>
        el("tr", {}, [
          el("td", {}, [patient.bed || patient.currentBed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
          el("td", {}, [patient.service || patient.currentService || ""]),
          el("td", {}, [patient.status || patient.currentState || ""]),
          el("td", {}, [String(patient.deih ?? "")]),
          el("td", {}, [
            patient.syncStatus === "local_pending" ? badge("Pendiente", "warn") : patient.syncStatus || ""
          ]),
          writable ? el("td", { class: "actions-cell" }, [
            button("Editar", () => { editing = patient; redraw(); }, { class: "small ghost" }),
            button("Egreso", async () => {
              if (!globalThis.confirm(`Confirmar egreso de ${patient.patientName || patient.patientId || "paciente"}?`)) return;
              busyPatientId = patient.patientId || patient.id || "";
              redraw();
              try {
                const saved = await archivePatient(app, patient, "egreso_manual");
                patients = patients.filter(row => row.patientId !== saved.patientId);
                message = saved.syncStatus === "local_pending"
                  ? "Egreso guardado localmente; queda pendiente de sincronizar."
                  : "Egreso sincronizado.";
                messageTone = saved.syncStatus === "local_pending" ? "warn" : "ok";
              } catch (error) {
                message = error?.message || "No se pudo egresar el paciente.";
                messageTone = "warn";
              } finally {
                busyPatientId = "";
                redraw();
              }
            }, { class: "small ghost", disabled: busyPatientId === (patient.patientId || patient.id || "") })
          ]) : ""
        ])
      )
    );
  }

  const scheduleRedraw = frameScheduler(redraw);
  redraw();
  return modulePage("Censo", `Pacientes activos desde Firestore. Censo ${census.date}. Busqueda local sin consultar por cada tecla.`, [body], [
    writable ? button("Nuevo paciente", () => { editing = {}; redraw(); }, { class: "ghost" }) : ""
  ]);
}

function toolbar(filters, patients, redraw, scheduleRedraw) {
  const query = textInput({ placeholder: "Buscar nombre, cama, diagnostico", oninput: event => { filters.query = event.target.value; scheduleRedraw(); } });
  const service = selectInput(patientValues(patients, row => row.service || row.currentService), { onchange: event => { filters.service = event.target.value; redraw(); } });
  const status = selectInput(patientValues(patients, row => row.status || row.currentState), { onchange: event => { filters.status = event.target.value; redraw(); } });
  return el("div", { class: "toolbar" }, [query, service, status]);
}

function patientValues(patients, getter) {
  return ["Todos", ...new Set(patients.map(getter).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "es")))];
}

function patientForm(app, patient, onSaved, onError, onCancel) {
  let saving = false;
  const saveButton = button("Guardar", null, { type: "submit", dataset: { saveButton: "patient" } });
  const epiSelect = selectInput(EPI_OPTIONS, { name: "epidemiologicalDiagnosis", value: patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis || "" });
  const opdContainer = el("div", {});
  const renderOpd = () => {
    const eligibility = opdEligibilityForText(epiSelect.value);
    opdContainer.replaceChildren(eligibility.eligible || opdHasContent(patient.opd)
      ? renderOpdFields(patient.opd, { eligibility })
      : "");
  };
  epiSelect.addEventListener("change", renderOpd);
  renderOpd();
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      if (saving) return;
      saving = true;
      saveButton.disabled = true;
      saveButton.textContent = "Guardando";
      try {
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        const opdEligibility = opdEligibilityForText(data.epidemiologicalDiagnosis);
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
          observations: data.observations,
          opd: opdEligibility.eligible || opdHasContent(patient.opd)
            ? opdFromFormData(data, patient.opd)
            : patient.opd
        };
        const saved = await savePatient(app, payload);
        onSaved(saved);
      } catch (error) {
        onError(error?.message || "No se pudo guardar el paciente.");
        saving = false;
        saveButton.disabled = false;
        saveButton.textContent = "Guardar";
      }
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
      field("Dx epidemiologico", epiSelect),
      field("Dx hospitalario", textInput({ name: "hospitalDiagnosis", value: patient.hospitalDiagnosis || patient.currentDiagnosis || "" }))
    ]),
    opdContainer,
    field("Observaciones", textareaInput({ name: "observations", rows: 3, value: patient.observations || "" })),
    el("div", { class: "toolbar" }, [
      saveButton,
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function upsertPatient(rows, patient) {
  const next = rows.filter(row => row.patientId !== patient.patientId);
  if (patient.active !== false) next.unshift(patient);
  return next;
}

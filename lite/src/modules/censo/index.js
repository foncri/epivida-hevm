import { badge, button, dateInput, el, field, frameScheduler, link, notice, numberInput, pagedTable, selectInput, textareaInput, textInput } from "../../components/dom.js";
import { renderOpdFields } from "../../components/opdFields.js";
import { modulePage } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { currentCensus } from "../../services/censusService.js";
import { DISCHARGE_SHIFTS, DISCHARGE_TYPES, dischargeReasonForType, normalizeDischargeShift, normalizeDischargeType } from "../../services/dischargeService.js";
import { archivePatient, filterPatients, getPatientById, saveArchivedPatient, savePatient, sortPatientsByServiceBed } from "../../services/patientService.js";
import { completeOpdForSave, opdEligibilityForPatient, opdEligibilityForText, opdFromFormData, opdHasContent } from "../../services/opdService.js";
import { canWrite } from "../../lib/security.js";
import { EPI_OPTIONS } from "./epiOptions.js";
import { renderPatientSearchPanel } from "./searchPanel.js";

const SEX_OPTIONS = ["", "F", "M"];
const STATE_OPTIONS = ["", "ESTABLE", "DELICADO", "GRAVE", "MUY GRAVE", "CRITICO"];

export async function render({ app, route }) {
  const routePatientId = patientIdFromRoute(route);
  const census = routePatientId ? { date: "", patients: [] } : await currentCensus();
  const routePatient = routePatientId ? await getPatientById(routePatientId) : null;
  let patients = routePatientId ? [routePatient].filter(Boolean) : census.patients;
  const filters = { query: "", service: "Todos", status: "Todos" };
  const role = app.state.auth.profile?.role;
  const writable = canWrite("censo", role);
  const searchState = app.state.moduleState.patientSearch ||= { query: "", activeOnly: false, rows: [], message: "" };
  let editing = routePatient || null;
  let discharging = null;
  let message = routePatientId && !routePatient ? "No se encontro el paciente solicitado." : "";
  let messageTone = "";
  let busyPatientId = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = sortPatientsByServiceBed(filterPatients(patients, filters));
    body.replaceChildren(
      message ? notice(message, messageTone || (message.includes("pendiente") ? "warn" : "ok")) : "",
      routePatientId ? renderPatientRouteContext(routePatientId, routePatient) : "",
      routePatientId ? "" : toolbar(filters, patients, redraw, scheduleRedraw),
      routePatientId ? "" : renderPatientSearchPanel(searchState, redraw),
      editing ? patientForm(app, editing, async saved => {
        patients = upsertPatient(patients, saved);
        editing = routePatientId ? saved : null;
        message = saved.syncStatus === "local_pending"
          ? "Paciente guardado localmente; queda pendiente de sincronizar."
          : "Paciente sincronizado.";
        messageTone = saved.syncStatus === "local_pending" ? "warn" : "ok";
        redraw();
      }, error => {
        message = error;
        messageTone = "warn";
        redraw();
      }, () => { editing = null; redraw(); }) : discharging ? dischargeForm(app, discharging, async saved => {
        patients = patients.filter(row => row.patientId !== saved.patientId);
        discharging = null;
        message = saved.syncStatus === "local_pending"
          ? "Egreso guardado localmente; queda pendiente de sincronizar."
          : "Egreso sincronizado.";
        messageTone = saved.syncStatus === "local_pending" ? "warn" : "ok";
        redraw();
      }, error => {
        message = error;
        messageTone = "warn";
        redraw();
      }, () => { discharging = null; redraw(); }) : "",
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
            button("Egreso", () => {
              discharging = patient;
              editing = null;
              redraw();
            }, { class: "small ghost", disabled: busyPatientId === (patient.patientId || patient.id || "") })
          ]) : ""
        ])
      )
    );
  }

  const scheduleRedraw = frameScheduler(redraw);
  redraw();
  const description = routePatientId
    ? "Edicion directa OPD/censo por paciente."
    : `Pacientes activos. Censo ${census.date}. Busqueda local sin consulta por tecla.`;
  return modulePage("Censo", description, [body], [
    writable && !routePatientId ? button("Nuevo paciente", () => { editing = {}; redraw(); }, { class: "ghost" }) : ""
  ]);
}

function dischargeForm(app, patient, onSaved, onError, onCancel) {
  let saving = false;
  const saveButton = button("Confirmar egreso", null, { type: "submit", dataset: { saveButton: "discharge" } });
  const defaultDate = patient.dischargeDate || todayIso();
  const dischargeType = normalizeDischargeType(patient.dischargeType || "");
  const dischargeShift = normalizeDischargeShift(patient.dischargeShift || "");
  const eligibility = opdEligibilityForPatient(patient);
  const opdValue = eligibility.eligible || opdHasContent(patient.opd)
    ? completeOpdForSave(patient.opd, { ...patient, dischargeType, dischargeDate: defaultDate })
    : patient.opd;
  return el("form", {
    class: "form-card discharge-form",
    onsubmit: async event => {
      event.preventDefault();
      if (saving) return;
      saving = true;
      saveButton.disabled = true;
      saveButton.textContent = "Guardando";
      try {
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const normalizedType = normalizeDischargeType(data.dischargeType);
        const normalizedShift = normalizeDischargeShift(data.dischargeShift);
        const dischargeDate = data.dischargeDate || defaultDate;
        const nextPatient = {
          ...patient,
          hospitalizationStatus: "egresado",
          dischargeType: normalizedType,
          dischargeDate,
          dischargeShift: normalizedShift,
          deathCertificateFolio: data.deathCertificateFolio || patient.deathCertificateFolio || "",
          opd: eligibility.eligible || opdHasContent(patient.opd)
            ? completeOpdForSave(opdFromFormData({
              ...data,
              opdDischargeDate: data.opdDischargeDate || dischargeDate
            }, opdValue), { ...patient, dischargeType: normalizedType, dischargeDate })
            : patient.opd
        };
        const saved = await archivePatient(app, nextPatient, dischargeReasonForType(normalizedType));
        onSaved(saved);
      } catch (error) {
        onError(error?.message || "No se pudo egresar el paciente.");
        saving = false;
        saveButton.disabled = false;
        saveButton.textContent = "Confirmar egreso";
      }
    }
  }, [
    el("div", { class: "section-heading" }, [
      el("strong", {}, [`Egreso hospitalario - ${patient.patientName || patient.patientId || "paciente"}`]),
      badge("Revision requerida", "warn")
    ]),
    el("div", { class: "form-grid" }, [
      field("Tipo de alta", selectInput(DISCHARGE_TYPES, { name: "dischargeType", value: dischargeType })),
      field("Fecha de alta", dateInput({ name: "dischargeDate", required: true, value: defaultDate })),
      field("Turno", selectInput(DISCHARGE_SHIFTS, { name: "dischargeShift", value: dischargeShift })),
      field("Folio defuncion", textInput({ name: "deathCertificateFolio", value: patient.deathCertificateFolio || "", placeholder: "Solo si aplica" }))
    ]),
    eligibility.eligible || opdHasContent(opdValue) ? renderOpdFields(opdValue, { eligibility }) : "",
    field("Contexto clinico", textareaInput({ rows: 3, disabled: true, value: patient.observations || patient.hospitalDiagnosis || patient.currentDiagnosis || "" })),
    el("div", { class: "toolbar" }, [
      saveButton,
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function patientIdFromRoute(route = {}) {
  const parts = route.parts || [];
  const patientIndex = parts.indexOf("paciente");
  const raw = patientIndex >= 0 ? parts[patientIndex + 1] : "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function renderPatientRouteContext(patientId, patient = {}) {
  const label = patient?.patientName || patientId;
  const location = [patient?.service || patient?.currentService, patient?.bed || patient?.currentBed].filter(Boolean).join(" / ");
  return el("section", { class: "row-card" }, [
    el("strong", {}, [`Paciente ${label}`]),
    el("span", { class: "muted" }, [
      patient
        ? `Ruta directa OPD/Censo${location ? ` - ${location}` : ""}. Se cargo por ID desde Firestore/cola local.`
        : "Ruta directa OPD/Censo. No se encontro registro activo o archivado para este folio."
    ]),
    el("div", { class: "toolbar" }, [
      link("#/censo", "Ver censo completo", { class: "button ghost small" }),
      patient ? link(`#/pacientes/${encodeURIComponent(patientId)}/expediente`, "Expediente", { class: "button ghost small" }) : ""
    ])
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
  const patientNameInput = textInput({ name: "patientName", required: true, value: patient.patientName || "" });
  const serviceInput = textInput({ name: "service", required: true, value: patient.service || patient.currentService || "" });
  const bedInput = textInput({ name: "bed", value: patient.bed || patient.currentBed || "" });
  const sectorInput = textInput({ name: "sector", value: patient.sector || "" });
  const sexInput = selectInput(SEX_OPTIONS, { name: "sex", value: patient.sex || "" });
  const ageInput = numberInput({ name: "age", min: 0, max: 120, value: patient.age ?? "" });
  const admissionInput = dateInput({ name: "admissionDate", value: patient.admissionDate || "" });
  const statusInput = selectInput(STATE_OPTIONS, { name: "status", value: patient.status || patient.currentState || "" });
  const diagnosisInput = textInput({ name: "hospitalDiagnosis", value: patient.hospitalDiagnosis || patient.currentDiagnosis || "" });
  const opdContainer = el("div", {});
  const renderOpd = () => {
    const eligibility = opdEligibilityForText(epiSelect.value, { service: serviceInput.value, assumeHospitalized: true });
    opdContainer.replaceChildren(eligibility.eligible || opdHasContent(patient.opd)
      ? renderOpdFields(patient.opd, { eligibility })
      : "");
  };
  epiSelect.addEventListener("change", renderOpd);
  serviceInput.addEventListener("input", renderOpd);
  serviceInput.addEventListener("change", renderOpd);
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
        const opdEligibility = opdEligibilityForText(data.epidemiologicalDiagnosis, { service: data.service, assumeHospitalized: true });
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
        const saved = patient.active === false ? await saveArchivedPatient(app, payload) : await savePatient(app, payload);
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
      field("Paciente", patientNameInput),
      field("Servicio", serviceInput),
      field("Cama", bedInput),
      field("Sector", sectorInput),
      field("Sexo", sexInput),
      field("Edad", ageInput),
      field("Ingreso", admissionInput),
      field("Estado", statusInput),
      field("Dx epidemiologico", epiSelect),
      field("Dx hospitalario", diagnosisInput)
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

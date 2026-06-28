import { badge, button, dateInput, el, field, link, notice, selectInput } from "../../components/dom.js";
import { normalizeDate } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { archivePatient, savePatient } from "../../services/patientService.js";
import { DISCHARGE_SHIFTS, DISCHARGE_TYPES, PROBABLE_DISCHARGE_MESSAGE, REPORTED_DISCHARGE_MESSAGE } from "./roundConstants.js";
import {
  normalizeRoundText,
  patientBed,
  patientLabel,
  patientService,
  sortByServiceBed
} from "./roundHelpers.js";
import {
  normalizeStatusKey,
  roundPatientHref
} from "./roundPatientUtils.js";

export function renderDischargeReviewPanel(app, local, date, patients, onResolved) {
  const rows = patients.filter(isDischargeReviewPatient).sort(sortByServiceBed);
  if (!rows.length) return "";
  const canEdit = canWrite("censo", app.state.auth.profile?.role);
  return el("section", { class: "iaas-panel discharge-review-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Altas por verificar"]),
        el("p", {}, ["Pacientes ausentes, reportados con alta o encontrados en otro servicio."])
      ]),
      badge(`${rows.length} pendiente(s)`, "warn")
    ]),
    !canEdit ? notice("Solo epidemiologia puede confirmar alta o marcar que sigue hospitalizado.", "warn") : "",
    el("div", { class: "discharge-review-list" }, rows.map(patient =>
      renderDischargeReviewCard(app, local, date, patient, canEdit, onResolved)
    ))
  ]);
}

function renderDischargeReviewCard(app, local, date, patient, canEdit, onResolved) {
  const draft = dischargeDraft(local, date, patient);
  return el("article", { class: "discharge-review-card" }, [
    el("div", { class: "discharge-review-main" }, [
      el("strong", {}, [patientLabel(patient).toUpperCase()]),
      el("span", {}, [`${patientService(patient)} - cama ${patientBed(patient)}`]),
      el("small", {}, [dischargeReviewReason(patient)])
    ]),
    el("div", { class: "discharge-review-fields" }, [
      field("Tipo de alta", selectInput(DISCHARGE_TYPES, {
        value: draft.type,
        disabled: !canEdit,
        onchange: event => { draft.type = event.target.value; }
      })),
      field("Fecha de alta", dateInput({
        value: draft.date,
        disabled: !canEdit,
        onchange: event => { draft.date = event.target.value; }
      })),
      field("Turno", selectInput(DISCHARGE_SHIFTS, {
        value: draft.shift,
        disabled: !canEdit,
        onchange: event => { draft.shift = event.target.value; }
      }))
    ]),
    el("div", { class: "discharge-review-actions" }, [
      link(`#/pacientes/${patient.patientId}/expediente`, "Expediente", { class: "button ghost" }),
      link(roundPatientHref(date, patient.patientId), "Revisar ronda", { class: "button ghost" }),
      button("Confirmar alta", async () => {
        if (!canEdit) return;
        const saved = await archivePatient(app, {
          ...patient,
          hospitalizationStatus: "egresado",
          dischargeDate: draft.date || date,
          dischargeType: draft.type || "SIN DATO",
          dischargeShift: draft.shift || "SIN TURNO",
          dischargeReviewRequired: false,
          probableDischarge: false,
          dischargeReported: false
        }, draft.type || "alta_verificada");
        delete local.dischargeDrafts[patient.patientId];
        onResolved(saved, saved.syncStatus === "local_pending" ? "Alta confirmada localmente; queda pendiente de sincronizar." : "Alta confirmada.");
      }, { class: "primary", disabled: !canEdit }),
      button("Sigue hospitalizado", async () => {
        if (!canEdit) return;
        const saved = await savePatient(app, patientStillHospitalizedPayload(patient));
        delete local.dischargeDrafts[patient.patientId];
        onResolved(saved, saved.syncStatus === "local_pending" ? "Conciliacion guardada localmente; queda pendiente de sincronizar." : "Paciente marcado como hospitalizado.");
      }, { class: "ghost", disabled: !canEdit })
    ])
  ]);
}

function dischargeDraft(local, date, patient) {
  const key = patient.patientId;
  local.dischargeDrafts[key] ||= {
    type: patient.dischargeType || patient.dischargeReason || DISCHARGE_TYPES[0],
    date: normalizeDate(patient.dischargeDate || patient.dischargedAt) || date,
    shift: patient.dischargeShift || DISCHARGE_SHIFTS.at(-1)
  };
  return local.dischargeDrafts[key];
}

function isDischargeReviewPatient(patient = {}) {
  const status = normalizeStatusKey(patient.hospitalizationStatus || patient.statusReason || "");
  const issues = normalizeRoundText((patient.activePendingIssues || []).join(" "));
  return Boolean(
    patient.dischargeReviewRequired
    || patient.probableDischarge
    || patient.dischargeReported
    || ["ALTA PROBABLE", "ALTA REPORTADA", "REQUIERE CONCILIACION"].includes(status)
    || issues.includes("ALTA")
    || issues.includes("MOVIDO")
  );
}

function dischargeReviewReason(patient = {}) {
  if (patient.dischargeReported || normalizeStatusKey(patient.hospitalizationStatus) === "ALTA REPORTADA") return REPORTED_DISCHARGE_MESSAGE;
  if (patient.probableDischarge || normalizeStatusKey(patient.hospitalizationStatus) === "ALTA PROBABLE") return PROBABLE_DISCHARGE_MESSAGE;
  const issues = (patient.activePendingIssues || []).filter(Boolean).join(" | ");
  return issues || "Investigar fecha, causa y turno de alta hospitalaria.";
}

function patientStillHospitalizedPayload(patient = {}) {
  const activePendingIssues = (patient.activePendingIssues || []).filter(issue => !isDischargeIssue(issue));
  return {
    ...patient,
    active: true,
    hospitalizationStatus: "hospitalizado",
    dischargeReviewRequired: false,
    probableDischarge: false,
    dischargeReported: false,
    dischargeDate: "",
    dischargeType: "",
    dischargeShift: "",
    dischargeReason: "",
    activePendingIssues
  };
}

function isDischargeIssue(value = "") {
  const text = normalizeRoundText(value);
  return text.includes("ALTA") || text.includes("MOVIDO") || text.includes("CONCILIACION");
}

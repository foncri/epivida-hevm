import { badge, checkboxInput, dateInput, el, field, notice, textInput } from "./dom.js";
import { normalizeOpdData, opdStatus } from "../services/opdService.js";

export function renderOpdFields(value = {}, options = {}) {
  const opd = normalizeOpdData(value);
  const eligibility = options.eligibility || { eligible: false, label: "" };
  const status = opdStatus(opd, eligibility);
  return el("div", { class: "opd-fields stack" }, [
    el("div", { class: "section-heading" }, [
      el("strong", {}, ["OPD"]),
      renderOpdBadge(opd, eligibility)
    ]),
    el("span", { class: "muted" }, [eligibility.label || "Captura OPD manual para seguimiento operativo."]),
    status.detail ? notice(status.detail, status.pending ? "warn" : "ok") : "",
    el("div", { class: "form-grid compact" }, [
      field("Direccion", textInput({ name: "opdAddress", value: opd.address || "" })),
      field("Telefono", textInput({ name: "opdPhone", value: opd.phone || "" })),
      field("Inicio sintomas", dateInput({ name: "opdSymptomStartDate", value: opd.symptomStartDate || "" })),
      field("Fecha egreso", dateInput({ name: "opdDischargeDate", value: opd.dischargeDate || "" })),
      field("Subido a OPD", checkboxInput({ name: "opdUploaded", checked: opd.uploaded })),
      field("Alta OPD", checkboxInput({ name: "opdDischarged", checked: opd.discharged }))
    ])
  ]);
}

export function renderOpdBadge(value = {}, eligibility = { eligible: false }) {
  const status = opdStatus(value, eligibility);
  return badge(status.label, status.tone);
}

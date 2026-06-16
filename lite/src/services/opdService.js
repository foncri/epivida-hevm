import { normalizeDate, nowIso } from "../lib/date.js";
import { cleanText } from "../lib/validators.js";
import { epidemiologicalDiagnosis } from "./patientService.js";

function normalizedText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function defaultOpdData() {
  return {
    address: "",
    phone: "",
    symptomStartDate: "",
    dischargeDate: "",
    uploaded: false,
    discharged: false,
    updatedAt: ""
  };
}

export function normalizeOpdData(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...defaultOpdData(),
    address: cleanText(source.address || source.direccion || "", 300),
    phone: cleanText(source.phone || source.telefono || "", 80),
    symptomStartDate: normalizeDate(source.symptomStartDate || source.fechaInicioSintomas) || "",
    dischargeDate: normalizeDate(source.dischargeDate || source.fechaEgreso) || "",
    uploaded: opdFlag(source.uploaded ?? source.subido),
    discharged: opdFlag(source.discharged ?? source.alta),
    updatedAt: cleanText(source.updatedAt || "", 80)
  };
}

export function opdFromFormData(source = {}, previous = {}) {
  const previousOpd = normalizeOpdData(previous);
  const next = normalizeOpdData({
    address: source.opdAddress ?? previousOpd.address,
    phone: source.opdPhone ?? previousOpd.phone,
    symptomStartDate: source.opdSymptomStartDate ?? previousOpd.symptomStartDate,
    dischargeDate: source.opdDischargeDate ?? previousOpd.dischargeDate,
    uploaded: source.opdUploaded === "on",
    discharged: source.opdDischarged === "on",
    updatedAt: previousOpd.updatedAt
  });
  if (opdHasContent(next)) next.updatedAt = nowIso();
  return next;
}

export function opdHasContent(value = {}) {
  const opd = normalizeOpdData(value);
  return Boolean(opd.address || opd.phone || opd.symptomStartDate || opd.dischargeDate || opd.uploaded || opd.discharged);
}

export function opdRequiredMissing(value = {}) {
  const opd = normalizeOpdData(value);
  const missing = [];
  if (!opd.address) missing.push("direccion");
  if (!opd.phone) missing.push("telefono");
  if (!opd.symptomStartDate) missing.push("fecha de inicio de sintomas");
  if (!opd.dischargeDate) missing.push("fecha de egreso");
  return missing;
}

export function opdEligibilityForText(value = "") {
  const text = normalizedText(value);
  const isVig = text.includes("VIG TRANSMISIBLE")
    || text.includes("VIG NO TRANSMISIBLE")
    || text.includes("MORBIMORTALIDAD")
    || text.includes("MATERNA")
    || text.includes("PERINATAL");
  if (isVig) return { eligible: true, scope: "vig", label: "Vigilancia Hospitalaria" };
  const hasIaas = text.includes("IAAS") && !text.includes("NO IAAS") && !text.includes("RIESGO IAAS");
  if (hasIaas) return { eligible: true, scope: "iaas", label: "IAAS confirmada" };
  return { eligible: false, scope: "", label: "" };
}

export function opdEligibilityForPatient(patient = {}) {
  return opdEligibilityForText([
    epidemiologicalDiagnosis(patient),
    patient.hospitalDiagnosis,
    patient.currentDiagnosis
  ].filter(Boolean).join(" "));
}

export function opdEligibilityForIaasCase(iaas = {}) {
  const status = normalizedText(iaas.status);
  if (status === "CONFIRMADA" || status === "CONFIRMED") {
    return { eligible: true, scope: "iaas", label: "IAAS confirmada" };
  }
  return opdEligibilityForText([
    iaas.patientClassification,
    iaas.epidemiologicalDiagnosis,
    iaas.iaasType
  ].filter(Boolean).join(" "));
}

export function opdStatus(value = {}, eligibility = { eligible: false }) {
  const opd = normalizeOpdData(value);
  if (!eligibility.eligible && !opdHasContent(opd)) {
    return { label: "No aplica", tone: "neutral", pending: false, detail: "" };
  }
  const missing = opdRequiredMissing(opd);
  if (missing.length) {
    return { label: "OPD incompleto", tone: "warn", pending: true, detail: `Faltan: ${missing.join(", ")}` };
  }
  if (!opd.uploaded) {
    return { label: "Subir OPD", tone: "warn", pending: true, detail: "Datos completos; falta marcar Subido." };
  }
  if (opd.dischargeDate && !opd.discharged) {
    return { label: "Alta OPD", tone: "warn", pending: true, detail: "Fecha de egreso registrada; falta marcar Alta." };
  }
  return { label: "OPD completo", tone: "ok", pending: false, detail: "Datos OPD completos." };
}

function opdFlag(value) {
  if (typeof value === "boolean") return value;
  const text = normalizedText(value);
  return ["1", "SI", "TRUE", "YES", "X"].includes(text);
}

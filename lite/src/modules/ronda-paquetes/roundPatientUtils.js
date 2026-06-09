import { normalizeDate } from "../../lib/date.js";
import { bedBoardItems, normalizeRoundText, normalizeServiceKey, patientService, sortByServiceBed } from "./roundHelpers.js";

export function roundStatus(round) {
  if (!round?.status) return "pendiente";
  if (round.status === "reviewed") return "revisado";
  return round.status;
}

export function statusLabel(status = "") {
  const normalized = roundStatus({ status });
  if (normalized === "revisado") return "Revisado";
  if (normalized === "alerta") return "Alerta";
  if (normalized === "incompleto") return "Incompleto";
  return "Pendiente";
}

export function syncLabel(syncStatus = "") {
  if (syncStatus === "local_pending") return "Pendiente sync";
  if (syncStatus === "error") return "Error sync";
  return "Sincronizado";
}

export function deviceActiveOnDate(device = {}, value = "") {
  const date = normalizeDate(value);
  if (!date) return false;
  if (normalizeDate(device.createdDuringRoundDate) === date || normalizeDate(device.roundDate) === date) return true;
  const start = normalizeDate(device.installationDate || device.createdAt);
  const end = normalizeDate(device.removalDate);
  if (!start) return false;
  return start <= date && (!end || end >= date);
}

export function isPePackageType(type = "") {
  const key = normalizeRoundText(type).replace(/[^A-Z]/g, "");
  return key === "PEYPBMT" || key === "PE" || key.includes("PRECAUCIONESESTANDAR");
}

export function navigationPatientId(patient, patients = [], direction) {
  const service = patientService(patient);
  const serviceKey = normalizeServiceKey(service);
  const rows = bedBoardItems(
    patients.filter(row => normalizeServiceKey(patientService(row)) === serviceKey).sort(sortByServiceBed),
    service
  )
    .map(item => item.patient?.patientId)
    .filter(Boolean);
  const index = rows.indexOf(patient.patientId);
  if (index === -1) return "";
  return direction === "previous" ? rows[index - 1] || "" : rows[index + 1] || "";
}

export function roundPatientHref(date, patientId) {
  return `#/ronda/${date}/paciente/${patientId}`;
}

export function daysBetween(start, end) {
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (!startDate || !endDate) return null;
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.floor((endMs - startMs) / 86400000));
}

export function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}...` : text;
}

export function normalizeStatusKey(value) {
  return normalizeRoundText(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function isCvcDevice(device) {
  return ["CVC", "CVPC", "PICC", "CATT HD", "C. PUERTO", "ONFALOCLISIS", "ITS - CC"].includes(device.deviceType) || device.preventivePackage === "ITS - CC";
}

export function isFoleyDevice(device) {
  return device.deviceType === "Sonda Foley" || device.preventivePackage === "ITU - CU";
}

export function isNavDevice(device) {
  const text = normalizeRoundText([device.deviceType, device.preventivePackage].join(" "));
  return /NAVM|VENTILACION|ENDOTRAQUEAL|TRAQUEOSTOMIA|CPAP|BPAP|COT|CET/.test(text);
}

export function isSurgicalSignal(patient = {}) {
  const text = normalizeRoundText([
    patient.currentService,
    patient.service,
    patient.currentDiagnosis,
    patient.hospitalDiagnosis,
    patient.epidemiologicalDiagnosis,
    patient.currentEpidemiologicalDiagnosis,
    patient.notes
  ].filter(Boolean).join(" "));
  return /QUIRURG|CIRUG|TRAUMATOLOG|HERIDA|ISQ|POST ?OP|POP|LAPE|COLEC|FRACTURA|TUMOR|COLOSTOM/.test(text);
}

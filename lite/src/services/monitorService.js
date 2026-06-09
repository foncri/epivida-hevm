import { epidemiologicalDiagnosis, filterPatients, sortPatientsByServiceBed, uniqueValues } from "./patientService.js";

function normalizedText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function monitorDiagnosisGroup(patient = {}) {
  const text = normalizedText(epidemiologicalDiagnosis(patient));
  if (!text) return "sin_clasificar";
  if (text.includes("NO IAAS") || text.includes("SIN IAAS")) return "no_iaas";
  if (text.includes("RIESGO")) return "riesgo_iaas";
  if (text.includes("VIGILANCIA") || text.includes("TRANSMISIBLE")) return "vigilancia";
  if (text.includes("IAAS")) return "iaas";
  return "sin_clasificar";
}

export function visibleMonitorPatients(patients = [], filters = {}) {
  return sortPatientsByServiceBed(filterPatients(patients, filters));
}

export function monitorFilterOptions(patients = []) {
  return {
    service: uniqueValues(patients, "service"),
    diagnosis: uniqueValues(patients, "diagnosis"),
    sex: uniqueValues(patients, "sex"),
    status: uniqueValues(patients, "status")
  };
}

export function monitorMetrics(patients = [], visible = patients) {
  const groups = visible.reduce((acc, patient) => {
    const group = monitorDiagnosisGroup(patient);
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {});
  return {
    filtered: visible.length,
    active: patients.length,
    services: new Set(visible.map(row => row.service || row.currentService).filter(Boolean)).size,
    iaas: groups.iaas || 0,
    riskIaas: groups.riesgo_iaas || 0,
    noIaas: groups.no_iaas || 0,
    surveillance: groups.vigilancia || 0,
    unclassified: groups.sin_clasificar || 0,
    pendingSync: visible.filter(row => row.syncStatus === "local_pending").length
  };
}

export function monitorStats(patients = [], visible = patients) {
  const summary = monitorMetrics(patients, visible);
  return [
    [String(summary.filtered), "Filtrados"],
    [String(summary.active), "Pacientes activos"],
    [String(summary.services), "Servicios"],
    [String(summary.iaas), "IAAS"],
    [String(summary.riskIaas), "Riesgo IAAS"],
    [String(summary.noIaas), "No IAAS"],
    [String(summary.surveillance), "Vigilancia"],
    [String(summary.pendingSync), "Sync pendiente"]
  ];
}

export function monitorPatientDiagnosis(patient = {}) {
  return epidemiologicalDiagnosis(patient);
}

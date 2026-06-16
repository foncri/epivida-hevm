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
  const priority = String(filters.priority || "");
  const rows = filterPatients(patients, filters)
    .filter(patient => !priority || priority === "Todos" || monitorSeverity(patient).level === priority);
  if (filters.sort === "prioridad") {
    return [...rows].sort((a, b) =>
      monitorSeverity(b).score - monitorSeverity(a).score
      || String(a.service || a.currentService || "").localeCompare(String(b.service || b.currentService || ""), "es")
      || String(a.bed || a.currentBed || "").localeCompare(String(b.bed || b.currentBed || ""), "es", { numeric: true })
    );
  }
  return sortPatientsByServiceBed(rows);
}

export function monitorFilterOptions(patients = []) {
  return {
    service: uniqueValues(patients, "service"),
    diagnosis: uniqueValues(patients, "diagnosis"),
    sex: uniqueValues(patients, "sex"),
    status: uniqueValues(patients, "status"),
    priority: [["Todos", "Prioridad"], ["critica", "Critica"], ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]],
    sort: [["servicio", "Servicio/cama"], ["prioridad", "Prioridad clinica"]]
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
    criticalPriority: visible.filter(row => monitorSeverity(row).level === "critica").length,
    highPriority: visible.filter(row => monitorSeverity(row).level === "alta").length,
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
    [String(summary.criticalPriority), "Prioridad critica"],
    [String(summary.highPriority), "Prioridad alta"],
    [String(summary.pendingSync), "Sync pendiente"]
  ];
}

export function monitorPatientDiagnosis(patient = {}) {
  return epidemiologicalDiagnosis(patient);
}

export function monitorSeverity(patient = {}) {
  const status = normalizedText(patient.status || patient.currentState);
  const diagnosis = normalizedText(epidemiologicalDiagnosis(patient));
  const observations = normalizedText([
    patient.observations,
    patient.pendingIssues,
    patient.currentDiagnosis,
    patient.hospitalDiagnosis
  ].join(" "));
  const deih = Number(patient.deih || patient.daysInHospital || 0);
  let score = 0;
  if (/CRIT|INTUB|VENTIL/.test(status + " " + observations)) score += 50;
  else if (/MUY\s+GRAVE/.test(status)) score += 42;
  else if (/GRAVE/.test(status)) score += 34;
  else if (/DELIC/.test(status)) score += 18;
  if (diagnosis.includes("IAAS") && !diagnosis.includes("NO IAAS")) score += diagnosis.includes("RIESGO") ? 18 : 28;
  if (/SEPSIS|BACTERIEM|FIEBRE|FEBRIL|LEUCOCIT|CULTIVO|HEMOCULT|UROCULT|PROCALCITON|PCR/.test(observations)) score += 14;
  if (deih >= 14) score += 8;
  else if (deih >= 7) score += 4;
  if (score >= 55) return { level: "critica", label: "Critica", score };
  if (score >= 35) return { level: "alta", label: "Alta", score };
  if (score >= 15) return { level: "media", label: "Media", score };
  return { level: "baja", label: "Baja", score };
}

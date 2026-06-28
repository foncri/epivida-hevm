import { epidemiologicalDiagnosis, filterPatients, sortPatientsByServiceBed, uniqueValues } from "./patientService.js";
import { opdEligibilityForPatient, opdStatus } from "./opdService.js";

export const MONITOR_STATE_ORDER = [
  "ESTABLE",
  "DELICADO",
  "GRAVE",
  "GRAVE INTUBADO",
  "MUY GRAVE",
  "MUY GRAVE INTUBADO",
  "CRITICO",
  "CRITICO INTUBADO"
];

export const MONITOR_AGE_RANGES = [
  { value: "0-9", label: "0 a 9 anos", min: 0, max: 9 },
  { value: "10-19", label: "10 a 19 anos", min: 10, max: 19 },
  { value: "20-29", label: "20 a 29 anos", min: 20, max: 29 },
  { value: "30-39", label: "30 a 39 anos", min: 30, max: 39 },
  { value: "40-49", label: "40 a 49 anos", min: 40, max: 49 },
  { value: "50-59", label: "50 a 59 anos", min: 50, max: 59 },
  { value: "60-69", label: "60 a 69 anos", min: 60, max: 69 },
  { value: "70-79", label: "70 a 79 anos", min: 70, max: 79 },
  { value: "80-89", label: "80 a 89 anos", min: 80, max: 89 },
  { value: "90+", label: "90 anos o mas", min: 90, max: Infinity }
];

const MONITOR_SORT_OPTIONS = [
  ["servicio", "Servicio/cama"],
  ["prioridad", "Prioridad clinica"],
  ["deih-desc", "DEIH mayor a menor"],
  ["deih-asc", "DEIH menor a mayor"],
  ["state-asc", "Estado estable a critico"],
  ["state-desc", "Estado critico a estable"]
];

const MONITOR_EPIDEMIOLOGICAL_BASES = [
  ["iaas", "IAAS"],
  ["riesgo_iaas", "Riesgo IAAS"],
  ["no_iaas", "No IAAS"],
  ["vigilancia", "Vigilancia"],
  ["covid_influenza", "COVID/Influenza"],
  ["esavi", "ESAVI"],
  ["maternal_perinatal", "Morbimortalidad"],
  ["sin_clasificar", "Sin clasificar"]
];

const RISK_DEVICE_PATTERNS = [
  ["CVC", /\b(CVC|CATETER VENOSO CENTRAL|CATETER CENTRAL|LINEA CENTRAL|VIA CENTRAL)\b/],
  ["CATT HD", /\b(MAHURKAR|MAHURCAR|CATETER HD|CAT HD|CATETER PARA HEMODIALISIS|ACCESO HD|PERMACATH|PERMA CATH)\b/],
  ["PICC", /\b(PICC|CATETER CENTRAL PERIFERICO|CATETER CENTRAL DE INSERCION PERIFERICA)\b/],
  ["Puerto", /\b(PUERTO|PORT A CATH|PORTACATH|PORT-A-CATH|CATETER PUERTO)\b/],
  ["CU", /\b(SONDA FOLEY|FOLEY|CATETER URINARIO|CATETER VESICAL|SONDA VESICAL)\b|(^|[\s,.;:/-])C\.?U\.?($|[\s,.;:/-])/],
  ["VM", /\b(VENTILACION MECANICA|VM|NAVM|TUBO ENDOTRAQUEAL|OROTRAQUEAL|INTUBACION|TRAQUEOSTOMIA)\b/],
  ["Drenaje", /\b(DRENOVAC|DRENO VAC|DRENAJE|DREN)\b/]
];

function normalizedText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function monitorDiagnosisGroup(patient = {}) {
  const bases = monitorEpidemiologicalBases(patient);
  if (bases.includes("no_iaas")) return "no_iaas";
  if (bases.includes("riesgo_iaas")) return "riesgo_iaas";
  if (bases.includes("iaas")) return "iaas";
  if (bases.includes("covid_influenza")) return "covid_influenza";
  if (bases.includes("esavi")) return "esavi";
  if (bases.includes("maternal_perinatal")) return "maternal_perinatal";
  if (bases.includes("vigilancia")) return "vigilancia";
  return "sin_clasificar";
}

export function monitorEpidemiologicalBases(patient = {}) {
  const text = normalizedText(epidemiologicalDiagnosis(patient));
  if (!text) return ["sin_clasificar"];
  const bases = new Set();
  if (/\b(COVID|SARS\s*COV|INFLUENZA|GRIPE)\b/.test(text)) bases.add("covid_influenza");
  if (/\bESAVI\b/.test(text)) bases.add("esavi");
  if (/\b(MORBIMORTALIDAD|MATERNA|PERINATAL|PUERPERA|OBSTETR)\b/.test(text)) bases.add("maternal_perinatal");
  if (/\b(VIG|VIGILANCIA|TRANSMISIBLE)\b/.test(text)) bases.add("vigilancia");
  const noIaas = /\b(NO|SIN)\s+IAAS\b/.test(text) || /\bNO[-\s]?IAAS\b/.test(text);
  const riskIaas = /\bRIESGO\b/.test(text) && /\bIAAS\b/.test(text);
  if (noIaas) bases.add("no_iaas");
  else if (riskIaas) bases.add("riesgo_iaas");
  else if (/\b([1-4]\s*)?IAAS\b/.test(text) || /\bIAAS\s+(ACTIVA|IMPORTADA|CONFIRMADA|PROBABLE)\b/.test(text)) bases.add("iaas");
  if (!bases.size) bases.add("sin_clasificar");
  return MONITOR_EPIDEMIOLOGICAL_BASES
    .map(([value]) => value)
    .filter(value => bases.has(value));
}

export function visibleMonitorPatients(patients = [], filters = {}) {
  const priority = String(filters.priority || "");
  const ageRange = String(filters.ageRange || "");
  const epiBase = String(filters.epiBase || "");
  const rows = filterPatients(patients, filters)
    .filter(patient => !priority || priority === "Todos" || monitorSeverity(patient).level === priority)
    .filter(patient => !ageRange || ageRange === "Todos" || monitorAgeRangeMatches(patient, ageRange))
    .filter(patient => !epiBase || epiBase === "Todos" || monitorEpidemiologicalBases(patient).includes(epiBase));
  if (filters.sort === "prioridad") {
    return [...rows].sort((a, b) =>
      monitorSeverity(b).score - monitorSeverity(a).score
      || String(a.service || a.currentService || "").localeCompare(String(b.service || b.currentService || ""), "es")
      || String(a.bed || a.currentBed || "").localeCompare(String(b.bed || b.currentBed || ""), "es", { numeric: true })
    );
  }
  if (filters.sort === "deih-desc") {
    return [...rows].sort((a, b) => monitorDeihValue(b, -1) - monitorDeihValue(a, -1) || compareByServiceBed(a, b));
  }
  if (filters.sort === "deih-asc") {
    return [...rows].sort((a, b) => monitorDeihValue(a, 9999) - monitorDeihValue(b, 9999) || compareByServiceBed(a, b));
  }
  if (filters.sort === "state-asc") {
    return [...rows].sort((a, b) => monitorStateRank(a) - monitorStateRank(b) || compareByServiceBed(a, b));
  }
  if (filters.sort === "state-desc") {
    return [...rows].sort((a, b) => monitorStateRank(b) - monitorStateRank(a) || compareByServiceBed(a, b));
  }
  return sortPatientsByServiceBed(rows);
}

export function monitorFilterOptions(patients = []) {
  return {
    service: uniqueValues(patients, "service"),
    diagnosis: uniqueValues(patients, "diagnosis"),
    sex: uniqueValues(patients, "sex"),
    status: uniqueValues(patients, "status"),
    ageRange: [["Todos", "Todas las edades"], ...MONITOR_AGE_RANGES.map(range => [range.value, range.label])],
    epiBase: [["Todos", "Etiqueta epi"], ...MONITOR_EPIDEMIOLOGICAL_BASES.map(([value, label]) => [value, label])],
    priority: [["Todos", "Prioridad"], ["critica", "Critica"], ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]],
    sort: MONITOR_SORT_OPTIONS
  };
}

export function monitorMetrics(patients = [], visible = patients) {
  const baseCounts = visible.reduce((acc, patient) => {
    monitorEpidemiologicalBases(patient).forEach(base => {
      acc[base] = (acc[base] || 0) + 1;
    });
    return acc;
  }, {});
  return {
    filtered: visible.length,
    active: patients.length,
    services: new Set(visible.map(row => row.service || row.currentService).filter(Boolean)).size,
    iaas: baseCounts.iaas || 0,
    riskIaas: baseCounts.riesgo_iaas || 0,
    noIaas: baseCounts.no_iaas || 0,
    surveillance: baseCounts.vigilancia || 0,
    covidInfluenza: baseCounts.covid_influenza || 0,
    esavi: baseCounts.esavi || 0,
    maternalPerinatal: baseCounts.maternal_perinatal || 0,
    unclassified: baseCounts.sin_clasificar || 0,
    ageKnown: visible.filter(row => monitorPatientAgeYears(row) !== null).length,
    deihKnown: visible.filter(row => monitorDeihValue(row, null) !== null).length,
    criticalPriority: visible.filter(row => monitorSeverity(row).level === "critica").length,
    highPriority: visible.filter(row => monitorSeverity(row).level === "alta").length,
    opdPending: visible.filter(row => monitorOpdStatus(row).pending).length,
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
    [String(summary.covidInfluenza), "COVID/Influenza"],
    [String(summary.esavi), "ESAVI"],
    [String(summary.maternalPerinatal), "Morbimortalidad"],
    [String(summary.ageKnown), "Edad registrada"],
    [String(summary.deihKnown), "DEIH registrado"],
    [String(summary.criticalPriority), "Prioridad critica"],
    [String(summary.highPriority), "Prioridad alta"],
    [String(summary.opdPending), "OPD pendientes"],
    [String(summary.pendingSync), "Sync pendiente"]
  ];
}

export function monitorPatientDiagnosis(patient = {}) {
  return epidemiologicalDiagnosis(patient);
}

export function monitorPatientAgeYears(patient = {}) {
  const direct = parseAgeYears(patient.age ?? patient.currentAge ?? patient.ageYears ?? patient.edad);
  if (direct !== null) return direct;
  const birthDate = patient.birthDate || patient.dateOfBirth || patient.fechaNacimiento;
  const referenceDate = patient.censusDate || patient.lastCensusDate || patient.updatedAt || "";
  return ageYearsFromBirthDate(birthDate, referenceDate);
}

export function monitorPatientDeih(patient = {}) {
  return monitorDeihValue(patient, null);
}

export function monitorOpdStatus(patient = {}) {
  return opdStatus(patient.opd, opdEligibilityForPatient(patient));
}

export function monitorSeverity(patient = {}) {
  const reasons = [];
  const status = normalizedText(patient.status || patient.currentState);
  const diagnosis = normalizedText(epidemiologicalDiagnosis(patient));
  const text = monitorRiskText(patient);
  const locationText = normalizedText(`${patient.service || patient.currentService || ""} ${patient.bed || patient.currentBed || ""}`);
  const riskDevices = inferredRiskDevicesForText(text);
  const deih = Number(patient.deih || patient.daysInHospital || 0);
  const opd = monitorOpdStatus(patient);
  let score = 0;
  if (/CRIT|CHOQUE|INTUB|VENTIL/.test(`${status} ${text}`)) score += reason(reasons, "Estado critico/intubacion/ventilacion", 50);
  else if (/MUY\s+GRAVE/.test(status)) score += reason(reasons, "Estado muy grave", 42);
  else if (/GRAVE/.test(status)) score += reason(reasons, "Estado grave", 34);
  else if (/DELIC/.test(status)) score += reason(reasons, "Estado delicado", 18);
  if (/\b(UCIA|UCIN|UCIP|UTIP|AIS|AISLAD|OBS|OBSERVACION)\b/.test(locationText)) score += reason(reasons, "Area critica o aislamiento", 12);
  if (diagnosis.includes("IAAS") && !diagnosis.includes("NO IAAS")) {
    score += diagnosis.includes("RIESGO")
      ? reason(reasons, "Riesgo IAAS documentado", 18)
      : reason(reasons, "IAAS probable/confirmada", 28);
  }
  if (riskDevices.length) score += reason(reasons, `Invasivo relevante: ${riskDevices.slice(0, 3).join(", ")}`, Math.min(18, 8 + riskDevices.length * 4));
  if (/SEPSIS|BACTERIEM|INFECCION|NEUMON|FIEBRE|FEBRIL|LEUCOCIT|CULTIVO|HEMOCULT|UROCULT|PROCALCITON|PCR|SECRECION/.test(text)) {
    score += reason(reasons, "Senal infecciosa/microbiologica", 14);
  }
  if (deih >= 14) score += reason(reasons, "DEIH >= 14 dias", 8);
  else if (deih >= 7) score += reason(reasons, "DEIH >= 7 dias", 4);
  if (opd.pending) score += reason(reasons, "OPD pendiente", 5);
  const base = score >= 55
    ? { level: "critica", label: "Critica" }
    : score >= 35
      ? { level: "alta", label: "Alta" }
      : score >= 15
        ? { level: "media", label: "Media" }
        : { level: "baja", label: "Baja" };
  return { ...base, score, reasons, riskDevices };
}

export function monitorSeveritySummary(patient = {}) {
  const severity = monitorSeverity(patient);
  return severity.reasons.length ? severity.reasons.join(" | ") : "Sin senales de prioridad clinica.";
}

function monitorRiskText(patient = {}) {
  return normalizedText([
    patient.observations,
    patient.pendingIssues,
    patient.currentDiagnosis,
    patient.hospitalDiagnosis,
    patient.diagnosis,
    patient.epidemiologicalDiagnosis,
    patient.currentEpidemiologicalDiagnosis,
    patient.riskIaas,
    patient.cultivosPendientes,
    patient.cultivos_pendientes,
    patient.notes
  ].join(" "));
}

function inferredRiskDevicesForText(value = "") {
  return RISK_DEVICE_PATTERNS
    .filter(([, pattern]) => pattern.test(value))
    .map(([label]) => label)
    .filter((label, index, rows) => rows.indexOf(label) === index);
}

function reason(reasons, label, score) {
  reasons.push(label);
  return score;
}

function monitorAgeRangeMatches(patient = {}, value = "") {
  const age = monitorPatientAgeYears(patient);
  if (age === null) return false;
  const range = MONITOR_AGE_RANGES.find(item => item.value === value);
  return Boolean(range) && age >= range.min && age <= range.max;
}

function parseAgeYears(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  const text = String(value || "").trim();
  const key = normalizedText(text);
  const n = Number(text.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(n)) return null;
  if (/\b(DIA|DIAS)\b/.test(key)) return n / 365;
  if (/\b(MES|MESES)\b/.test(key)) return n / 12;
  return Math.max(0, n);
}

function ageYearsFromBirthDate(value = "", reference = "") {
  if (!value) return null;
  const birth = Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
  const end = reference ? Date.parse(`${String(reference).slice(0, 10)}T00:00:00Z`) : Date.now();
  if (!Number.isFinite(birth) || !Number.isFinite(end) || birth > end) return null;
  const birthDate = new Date(birth);
  const endDate = new Date(end);
  let years = endDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday = endDate.getUTCMonth() < birthDate.getUTCMonth()
    || (endDate.getUTCMonth() === birthDate.getUTCMonth() && endDate.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) years -= 1;
  return Math.max(0, years);
}

function monitorDeihValue(patient = {}, fallback = 0) {
  const value = patient.deih ?? patient.daysInHospital ?? patient.currentDeih ?? patient.estanciaDias;
  const n = Number(String(value ?? "").match(/\d+/)?.[0]);
  if (Number.isFinite(n)) return Math.max(0, n);
  const admission = patient.admissionDate || patient.currentAdmissionDate || patient.fechaIngreso;
  const reference = patient.censusDate || patient.lastCensusDate || patient.updatedAt || "";
  const calculated = daysBetweenDateValues(admission, reference);
  return calculated === null ? fallback : calculated;
}

function monitorStateRank(patient = {}) {
  const state = normalizedText(patient.status || patient.currentState);
  const index = MONITOR_STATE_ORDER.findIndex(item => normalizedText(item) === state);
  return index >= 0 ? index : MONITOR_STATE_ORDER.length;
}

function compareByServiceBed(a = {}, b = {}) {
  const serviceCompare = String(a.service || a.currentService || "").localeCompare(String(b.service || b.currentService || ""), "es", { numeric: true });
  if (serviceCompare) return serviceCompare;
  const bedCompare = String(a.bed || a.currentBed || "").localeCompare(String(b.bed || b.currentBed || ""), "es", { numeric: true });
  if (bedCompare) return bedCompare;
  return String(a.patientName || a.patientId || "").localeCompare(String(b.patientName || b.patientId || ""), "es", { numeric: true });
}

function daysBetweenDateValues(start = "", end = "") {
  const startText = String(start || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startText)) return null;
  const endText = String(end || "").slice(0, 10);
  const startDate = Date.parse(`${startText}T00:00:00Z`);
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endText) ? Date.parse(`${endText}T00:00:00Z`) : Date.now();
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate) || startDate > endDate) return null;
  return Math.max(0, Math.floor((endDate - startDate) / 86400000));
}

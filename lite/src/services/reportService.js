import { normalizeDate, nowIso, todayIso } from "../lib/date.js";
import { getDocData, paginateQuery } from "./firestoreService.js";
import { listActiveDevices } from "./deviceService.js";
import { listActiveIaas } from "./iaasService.js";
import { listPendingWrites } from "./offlineQueueService.js";
import { epidemiologicalDiagnosis, listActivePatients } from "./patientService.js";
import { loadCatalogs } from "./catalogService.js";
import { normalizeBed, normalizeService, normalizeText } from "../lib/normalize.js";
import { monitorEpidemiologicalBases } from "./monitorService.js";
import {
  aggregateDailySnapshots,
  aggregateMonthlySnapshots,
  monthKeyForDate,
  summarizeMonthlySnapshot,
  summarizeYearlySnapshot,
  yearKeyForDate
} from "./snapshotService.js";

const MAX_DAILY_SNAPSHOT_DAYS = 31;
const MAX_MONTHLY_SNAPSHOT_MONTHS = 12;
const MAX_YEARLY_SNAPSHOT_YEARS = 10;
const HISTORICAL_PAGE_SIZE = 100;
const EPIDEMIOLOGICAL_CENSUS_INDICATORS = [
  ["totalActivePatients", "PACIENTES ACTIVOS"],
  ["covidInfluenza", "CONFIRMADOS INFLUENZA/COVID"],
  ["esavi", "ESAVIS"],
  ["riskIaas", "RIESGO IAAS"],
  ["noIaas", "NO IAAS"],
  ["iaas", "IAAS CONFIRMADAS/PROBABLES"],
  ["vigTransmisible", "VIG TRANSMISIBLES"],
  ["vigNoTransmisible", "VIG NO TRANSMISIBLES"],
  ["maternalPerinatal", "MORBIMORTALIDAD MATERNA/PERINATAL"],
  ["unclassified", "SIN CLASIFICAR"]
];
const HISTORICAL_DATASETS = [
  { key: "nursing_rounds", label: "Rondas de enfermeria", collection: "nursing_rounds", dateField: "date", isoDate: false },
  { key: "devices_archive", label: "Dispositivos retirados", collection: "devices_archive", dateField: "removalDate", isoDate: false },
  { key: "iaas_archive", label: "IAAS cerradas", collection: "iaas_archive", dateField: "closedAt", isoDate: true },
  { key: "cultures", label: "Cultivos", collection: "cultures", dateField: "requestedAt", isoDate: false },
  { key: "antimicrobials", label: "Antimicrobianos", collection: "antimicrobials", dateField: "startDate", isoDate: false },
  { key: "audit_logs", label: "Auditoria", collection: "audit_logs", dateField: "createdAt", isoDate: true },
  { key: "exports_log", label: "Registro de exportaciones", collection: "exports_log", dateField: "createdAt", isoDate: true }
];

function addDaysIso(date, days) {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

export function reportDateRange(from = todayIso(), to = todayIso(), maxDays = MAX_DAILY_SNAPSHOT_DAYS) {
  const start = normalizeDate(from) || todayIso();
  const end = normalizeDate(to) || start;
  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const dates = [];
  let current = first;
  while (current && current <= last && dates.length < maxDays) {
    dates.push(current);
    current = addDaysIso(current, 1);
  }
  return {
    from: first,
    to: last,
    dates,
    truncated: current <= last,
    maxDays
  };
}

export async function dailySnapshotRowsForRange(from, to, options = {}) {
  const range = reportDateRange(from, to, options.maxDays || MAX_DAILY_SNAPSHOT_DAYS);
  const snapshots = await Promise.all(range.dates.map(date =>
    getDocData(`daily_snapshots/${date}`).catch(() => null)
  ));
  const rows = snapshots.map((snapshot, index) => dailySnapshotCsvRow(range.dates[index], snapshot));
  return {
    ...range,
    rows
  };
}

export async function monthlySnapshotRowsForRange(from, to, options = {}) {
  const range = snapshotMonthRange(from, to, options.maxMonths || MAX_MONTHLY_SNAPSHOT_MONTHS);
  const rows = await Promise.all(range.months.map(async month => {
    const stored = await getDocData(`monthly_snapshots/${month}`).catch(() => null);
    if (stored) return monthlySnapshotCsvRow(summarizeMonthlySnapshot(month, stored));
    const daily = await dailySnapshotRowsForRange(`${month}-01`, monthEndDate(month));
    return monthlySnapshotCsvRow(aggregateDailySnapshots(month, daily.rows));
  }));
  return {
    ...range,
    rows
  };
}

export async function yearlySnapshotRowsForRange(from, to, options = {}) {
  const range = snapshotYearRange(from, to, options.maxYears || MAX_YEARLY_SNAPSHOT_YEARS);
  const rows = await Promise.all(range.years.map(async year => {
    const stored = await getDocData(`yearly_snapshots/${year}`).catch(() => null);
    if (stored) return yearlySnapshotCsvRow(summarizeYearlySnapshot(year, stored));
    const monthly = await monthlySnapshotRowsForRange(`${year}-01-01`, `${year}-12-31`, { maxMonths: 12 });
    return yearlySnapshotCsvRow(aggregateMonthlySnapshots(year, monthly.rows));
  }));
  return {
    ...range,
    rows
  };
}

export function epidemiologicalCensusSummary(patients = []) {
  return patients.reduce((summary, patient) => {
    const bases = monitorEpidemiologicalBases(patient);
    const diagnosis = normalizeText(epidemiologicalDiagnosis(patient));
    summary.totalActivePatients += 1;
    if (bases.includes("covid_influenza")) summary.covidInfluenza += 1;
    if (bases.includes("esavi")) summary.esavi += 1;
    if (bases.includes("riesgo_iaas")) summary.riskIaas += 1;
    if (bases.includes("no_iaas")) summary.noIaas += 1;
    if (bases.includes("iaas")) summary.iaas += 1;
    if (bases.includes("maternal_perinatal")) summary.maternalPerinatal += 1;
    if (bases.includes("sin_clasificar")) summary.unclassified += 1;
    if (isVigNoTransmisible(diagnosis)) summary.vigNoTransmisible += 1;
    else if (isVigTransmisible(diagnosis)) summary.vigTransmisible += 1;
    return summary;
  }, emptyEpidemiologicalCensusSummary());
}

export function epidemiologicalCensusSummaryRows(patients = []) {
  const summary = epidemiologicalCensusSummary(patients);
  return EPIDEMIOLOGICAL_CENSUS_INDICATORS.map(([key, label]) => ({
    indicador: label,
    valor: summary[key] || 0
  }));
}

export function epidemiologicalCensusPatientRows(patients = []) {
  return patients.map(patient => {
    const diagnosis = normalizeText(epidemiologicalDiagnosis(patient));
    const bases = monitorEpidemiologicalBases(patient);
    return {
      patientId: patient.patientId || patient.id || "",
      paciente: patient.patientName || patient.name || "",
      servicio: patient.service || patient.currentService || "",
      cama: patient.bed || patient.currentBed || "",
      sexo: patient.sex || "",
      edad: patient.age ?? patient.currentAge ?? patient.ageYears ?? patient.edad ?? "",
      deih: patient.deih ?? patient.daysInHospital ?? "",
      diagnosticoEpidemiologico: epidemiologicalDiagnosis(patient),
      covidInfluenza: bases.includes("covid_influenza") ? 1 : 0,
      esavi: bases.includes("esavi") ? 1 : 0,
      riesgoIaas: bases.includes("riesgo_iaas") ? 1 : 0,
      noIaas: bases.includes("no_iaas") ? 1 : 0,
      iaas: bases.includes("iaas") ? 1 : 0,
      vigTransmisible: isVigTransmisible(diagnosis) ? 1 : 0,
      vigNoTransmisible: isVigNoTransmisible(diagnosis) ? 1 : 0,
      morbimortalidadMaternaPerinatal: bases.includes("maternal_perinatal") ? 1 : 0,
      opdPendiente: patient.opdPending || patient.opd?.pending ? 1 : 0
    };
  });
}

export function epidemiologicalPrintReportModel(patients = [], options = {}) {
  const date = normalizeDate(options.date) || todayIso();
  const rows = [...patients].sort(comparePrintPatients).map(epidemiologicalPrintPatientRow);
  const summaryRows = epidemiologicalCensusSummaryRows(rows);
  return {
    title: "CENSO DE VIGILANCIA EPIDEMIOLOGICA HOSPITALARIA",
    institution: "INSTITUTO DE SEGURIDAD SOCIAL DE LOS TRABAJADORES DEL ESTADO DE CHIAPAS",
    hospital: "HOSPITAL DE ESPECIALIDADES VIDA MEJOR",
    date,
    totalPatients: rows.length,
    columns: [
      "SERVICIO",
      "CAMA",
      "PACIENTE",
      "SECTOR",
      "EDAD",
      "SEXO",
      "INGRESO",
      "DEIH",
      "ESTADO",
      "DX HOSPITALARIOS",
      "DX EPIDEMIOLOGICOS",
      "OBSERVACIONES"
    ],
    rows,
    summaryRows,
    generatedAt: nowIso()
  };
}

export function snapshotMonthRange(from = todayIso(), to = todayIso(), maxMonths = MAX_MONTHLY_SNAPSHOT_MONTHS) {
  const first = monthKeyForDate(from);
  const last = monthKeyForDate(to);
  const start = first <= last ? first : last;
  const end = first <= last ? last : first;
  const months = [];
  let current = start;
  while (current && current <= end && months.length < maxMonths) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return {
    from: start,
    to: end,
    months,
    truncated: current <= end,
    maxMonths
  };
}

export function snapshotYearRange(from = todayIso(), to = todayIso(), maxYears = MAX_YEARLY_SNAPSHOT_YEARS) {
  const first = yearKeyForDate(from);
  const last = yearKeyForDate(to);
  const start = first <= last ? first : last;
  const end = first <= last ? last : first;
  const years = [];
  let current = start;
  while (current && current <= end && years.length < maxYears) {
    years.push(current);
    current = String(Number(current) + 1);
  }
  return {
    from: start,
    to: end,
    years,
    truncated: current <= end,
    maxYears
  };
}

export function historicalExportOptions() {
  return HISTORICAL_DATASETS.map(item => [item.key, item.label]);
}

export async function pageHistoricalRows(datasetKey, from, to, cursorState = {}) {
  const dataset = HISTORICAL_DATASETS.find(item => item.key === datasetKey) || HISTORICAL_DATASETS[0];
  const first = normalizeDate(from) || todayIso();
  const last = normalizeDate(to) || first;
  const rangeStart = first <= last ? first : last;
  const rangeEnd = first <= last ? last : first;
  const pageSize = Math.min(250, Math.max(1, Number(cursorState.pageSize) || HISTORICAL_PAGE_SIZE));
  const filters = [
    [dataset.dateField, ">=", boundaryValue(dataset, rangeStart, false)],
    [dataset.dateField, "<=", boundaryValue(dataset, rangeEnd, true)]
  ];
  try {
    const page = await paginateQuery(
      dataset.collection,
      filters,
      [[dataset.dateField, "asc"]],
      pageSize,
      cursorState,
      cursorState.direction || "next"
    );
    return {
      ...page,
      dataset,
      from: rangeStart,
      to: rangeEnd,
      truncated: page.hasNext
    };
  } catch (error) {
    return {
      rows: [],
      firstCursor: null,
      lastCursor: null,
      hasNext: false,
      hasPrevious: false,
      pageSize,
      dataset,
      from: rangeStart,
      to: rangeEnd,
      truncated: false,
      error: error.message || String(error || "No se pudo leer historico.")
    };
  }
}

export async function buildOperationalBackup(app, options = {}) {
  const [patients, devices, iaasRows, catalogs, pending] = await Promise.all([
    listActivePatients(),
    listActiveDevices(),
    listActiveIaas(),
    loadCatalogs(),
    listPendingWrites()
  ]);
  const snapshotRange = options.includeSnapshots
    ? await dailySnapshotRowsForRange(options.from || todayIso(), options.to || todayIso()).catch(error => ({ rows: [], error: error.message }))
    : null;
  return {
    schema: "epivida-lite-operational-backup-v1",
    createdAt: nowIso(),
    createdBy: app.state.auth.user?.uid || "",
    userEmail: app.state.auth.user?.email || "",
    role: app.state.auth.profile?.role || "",
    note: "Respaldo operativo bajo demanda. No convierte JSON en fuente de verdad clinica.",
    datasets: {
      patients_active: patients,
      devices_active: devices,
      iaas_active: iaasRows,
      catalogs,
      sync_queue: pending,
      daily_snapshots: snapshotRange?.rows || []
    },
    meta: {
      patients: patients.length,
      devices: devices.length,
      iaas: iaasRows.length,
      catalogs: catalogs.length,
      pending: pending.length,
      snapshots: snapshotRange?.rows?.length || 0,
      snapshotError: snapshotRange?.error || ""
    }
  };
}

function dailySnapshotCsvRow(date, snapshot = null) {
  const byService = snapshot?.patientsByService || {};
  return {
    date,
    found: Boolean(snapshot),
    totalActivePatients: snapshot?.totalActivePatients ?? "",
    totalIAASActive: snapshot?.totalIAASActive ?? "",
    totalDevicesActive: snapshot?.totalDevicesActive ?? "",
    totalPendingIssues: snapshot?.totalPendingIssues ?? "",
    servicesCount: Object.keys(byService).length,
    patientsByService: JSON.stringify(byService),
    lastUpdatedAt: snapshot?.lastUpdatedAt || ""
  };
}

function emptyEpidemiologicalCensusSummary() {
  return {
    totalActivePatients: 0,
    covidInfluenza: 0,
    esavi: 0,
    riskIaas: 0,
    noIaas: 0,
    iaas: 0,
    vigTransmisible: 0,
    vigNoTransmisible: 0,
    maternalPerinatal: 0,
    unclassified: 0
  };
}

function isVigNoTransmisible(value = "") {
  return /\bVIG\s+NO\s+TRANSMISIBLE\b/.test(value) || /\bVIGILANCIA\s+NO\s+TRANSMISIBLE\b/.test(value);
}

function isVigTransmisible(value = "") {
  if (isVigNoTransmisible(value)) return false;
  return /\bVIG\s+TRANSMISIBLE\b/.test(value) || /\bVIGILANCIA\s+TRANSMISIBLE\b/.test(value);
}

function epidemiologicalPrintPatientRow(patient = {}) {
  const service = patient.service || patient.currentService || "";
  const admissionDate = normalizeDate(patient.admissionDate || patient.ingreso || patient.hospitalAdmissionDate || "");
  const dischargeText = dischargePrintText(patient);
  return {
    service: printServiceLabel(service),
    bed: printBedLabel(patient.bed || patient.currentBed),
    patientName: cleanPrintCell(patient.patientName || patient.name).toUpperCase(),
    sector: cleanPrintCell(patient.sector).toUpperCase(),
    age: cleanPrintCell(patient.age ?? patient.currentAge ?? patient.ageYears ?? patient.edad),
    sex: sexAbbreviation(patient.sex),
    admissionDate: isAmbulatoryService(service) ? "AMB" : printDate(admissionDate),
    deih: isAmbulatoryService(service) ? "NA" : cleanPrintCell(patient.deih ?? patient.daysInHospital),
    state: cleanPrintCell(patient.status || patient.currentState).toUpperCase(),
    hospitalDiagnosis: cleanPrintCell(patient.hospitalDiagnosis || patient.currentDiagnosis || patient.diagnosis || "SIN DIAGNOSTICO HOSPITALARIO").toUpperCase(),
    epidemiologicalDiagnosis: cleanPrintCell(epidemiologicalDiagnosis(patient) || "SIN DX EPIDEMIOLOGICO").toUpperCase(),
    observations: cleanPrintCell(dischargeText || patient.observations || patient.pendingIssues || patient.notes || "SIN OBSERVACIONES").toUpperCase()
  };
}

function comparePrintPatients(a = {}, b = {}) {
  const serviceCompare = normalizeService(a.service || a.currentService || "")
    .localeCompare(normalizeService(b.service || b.currentService || ""), "es", { numeric: true });
  if (serviceCompare) return serviceCompare;
  const leftBed = normalizeBed(a.bed || a.currentBed || "");
  const rightBed = normalizeBed(b.bed || b.currentBed || "");
  const bedCompare = leftBed.localeCompare(rightBed, "es", { numeric: true, sensitivity: "base" });
  if (bedCompare) return bedCompare;
  return String(a.patientName || a.patientId || "").localeCompare(String(b.patientName || b.patientId || ""), "es", { numeric: true });
}

function printServiceLabel(value = "") {
  return cleanPrintCell(normalizeService(value) || value || "SIN SERVICIO").toUpperCase();
}

function printBedLabel(value = "") {
  const text = cleanPrintCell(value).toUpperCase();
  if (!text) return "S/C";
  return text.replace(/^(CAMA|SILLON|CAMILLA|CUBICULO)\s*[-:]?\s*/i, "").trim() || text;
}

function cleanPrintCell(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sexAbbreviation(value = "") {
  const text = normalizeText(value);
  if (text.startsWith("M")) return "M";
  if (text.startsWith("F")) return "F";
  return cleanPrintCell(value).slice(0, 3).toUpperCase();
}

function printDate(value = "") {
  const date = normalizeDate(value);
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function isAmbulatoryService(value = "") {
  return ["AMBULATORIO", "HEMODIALISIS", "ONCOLOGIA"].includes(normalizeService(value));
}

function dischargePrintText(patient = {}) {
  const type = cleanPrintCell(patient.dischargeType || patient.dischargeReason || "");
  const date = normalizeDate(patient.dischargeDate || patient.dischargedAt || "");
  const status = cleanPrintCell(patient.dischargeStatus || "");
  if (!type || !date || !status) return "";
  return `${type} ${printDate(date)}`;
}

function monthlySnapshotCsvRow(summary) {
  return periodSnapshotCsvRow(summary, "month");
}

function yearlySnapshotCsvRow(summary) {
  return periodSnapshotCsvRow(summary, "year");
}

function periodSnapshotCsvRow(summary, keyField) {
  const latest = summary.latest || {};
  return {
    [keyField]: summary.key,
    found: Boolean(summary.found),
    lastSnapshotDate: summary.lastSnapshotDate || "",
    daysFound: summary.daysFound || "",
    monthsFound: summary.monthsFound || "",
    latestActivePatients: latest.totalActivePatients ?? "",
    latestImportedPatients: latest.totalImportedPatients ?? "",
    latestReconciliationPatients: latest.totalReconciliationPatients ?? "",
    latestIAASActive: latest.totalIAASActive ?? "",
    latestDevicesActive: latest.totalDevicesActive ?? "",
    latestPendingIssues: latest.totalPendingIssues ?? "",
    averageActivePatients: summary.averages?.totalActivePatients ?? "",
    peakActivePatients: summary.peaks?.totalActivePatients ?? "",
    sumImportedPatients: summary.sums?.totalImportedPatients ?? "",
    sumReconciliationPatients: summary.sums?.totalReconciliationPatients ?? "",
    sumReportedDischarges: summary.sums?.reportedDischarges ?? "",
    sumProbableDischarges: summary.sums?.probableDischarges ?? ""
  };
}

function boundaryValue(dataset, date, endOfDay) {
  if (!dataset.isoDate) return date;
  return `${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
}

function addMonths(month, count) {
  const [year, rawMonth] = month.split("-").map(Number);
  if (!year || !rawMonth) return "";
  const date = new Date(Date.UTC(year, rawMonth - 1 + count, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthEndDate(month) {
  const next = addMonths(month, 1);
  if (!next) return `${month}-31`;
  const ms = Date.parse(`${next}-01T00:00:00Z`) - 86400000;
  const date = new Date(ms);
  return date.toISOString().slice(0, 10);
}

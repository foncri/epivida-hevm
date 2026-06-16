import { normalizeDate, todayIso } from "../lib/date.js";
import { listActiveDevices } from "./deviceService.js";
import { listCulturesByStatus } from "./cultureService.js";
import { listPendingWrites, syncQueueSummary } from "./offlineQueueService.js";
import { listActivePatients, sortPatientsByServiceBed } from "./patientService.js";
import { listTodayRounds } from "./roundService.js";
import { monitorDiagnosisGroup, monitorOpdStatus, monitorSeverity } from "./monitorService.js";

export const OPERATIONAL_ALERTS_VERSION = "lite-operational-alerts-2026-06-16-v1";

const REVIEWED_STATUSES = new Set(["reviewed", "revisado", "alerta"]);
const NON_IAAS_RISK_DEVICE_TYPES = new Set([
  "CATETER PERIFERICO",
  "CATETER PERIFERICO CORTO",
  "PUNTAS NASALES",
  "CANULA NASAL",
  "PUNTAS NASALES/CANULA NASAL"
]);
const CULTURE_PENDING_STATUSES = ["solicitado", "pendiente"];

function normalizedText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function daysBetween(start, end) {
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (!startDate || !endDate) return null;
  const diff = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.floor(diff / 86400000));
}

export async function loadOperationalAlerts(options = {}) {
  const date = normalizeDate(options.date) || todayIso();
  const today = normalizeDate(options.today) || todayIso();
  const cultureLimit = Math.min(100, Math.max(1, Number(options.cultureLimit) || 25));
  const [patients, devices, rounds, queue, culturesByStatus] = await Promise.all([
    listActivePatients(),
    listActiveDevices(),
    listTodayRounds(date),
    listPendingWrites(),
    Promise.all(CULTURE_PENDING_STATUSES.map(status => listCulturesByStatus(status, { limit: cultureLimit })))
  ]);
  return buildOperationalAlerts({
    date,
    today,
    patients,
    devices,
    rounds,
    queue,
    cultures: dedupeById(culturesByStatus.flat(), "cultureId")
  });
}

export function buildOperationalAlerts({ date = todayIso(), today = todayIso(), patients = [], devices = [], rounds = [], cultures = [], queue = [] } = {}) {
  const activePatients = patients.filter(patient => patient.active !== false);
  const activeDevices = devices.filter(device => device.active !== false && !device.removalDate && device.status !== "retirado");
  const roundMap = new Map(rounds.map(round => [round.patientId, round]));
  const devicesByPatient = groupBy(activeDevices, "patientId");
  const sync = syncQueueSummary(queue);
  const preventiveAlerts = [
    ...probableDischargeAlerts(activePatients, date),
    ...movementAlerts(activePatients, date),
    ...roundPendingAlerts(activePatients, roundMap, date),
    ...surgicalSignalAlerts(activePatients, date)
  ];
  const iaasAlerts = [
    ...culturePendingAlerts(cultures, activePatients, today),
    ...criticalPatientAlerts(activePatients),
    ...iaasRiskDeviceAlerts(activePatients, devicesByPatient, date)
  ];
  const vigAlerts = [
    ...opdPendingAlerts(activePatients),
    ...syncAlerts(sync)
  ];
  const panels = [
    panel("preventive", "Preventivas", "#/ronda-paquetes", preventiveAlerts),
    panel("iaas", "IAAS y cultivos", "#/epi-iaas", iaasAlerts),
    panel("vig", "Vigilancia", "#/monitoreo-epidemiologico", vigAlerts)
  ];
  return {
    version: OPERATIONAL_ALERTS_VERSION,
    date,
    today,
    totals: {
      activePatients: activePatients.length,
      activeDevices: activeDevices.length,
      roundPending: activePatients.filter(patient => !REVIEWED_STATUSES.has(roundStatus(roundMap.get(patient.patientId)))).length,
      criticalPatients: activePatients.filter(patient => monitorSeverity(patient).level === "critica").length,
      highPriorityPatients: activePatients.filter(patient => monitorSeverity(patient).level === "alta").length,
      culturesDue: culturePendingAlerts(cultures, activePatients, today).filter(alert => alert.due).length,
      opdPending: activePatients.filter(patient => monitorOpdStatus(patient).pending).length,
      syncPending: sync.pending,
      syncBlocked: sync.blocked
    },
    panels
  };
}

function panel(key, title, href, items = []) {
  return {
    key,
    title,
    href,
    items: items.slice(0, 5)
  };
}

function probableDischargeAlerts(patients = [], date = "") {
  return patients
    .filter(patient => {
      const status = normalizedText(patient.hospitalizationStatus || patient.statusReason || "");
      const issues = normalizedText((patient.activePendingIssues || []).join(" "));
      return patient.dischargeReviewRequired
        || patient.probableDischarge
        || patient.dischargeReported
        || status.includes("ALTA")
        || status.includes("CONCILIACION")
        || issues.includes("ALTA");
    })
    .sort(comparePatients)
    .slice(0, 5)
    .map(patient => alertItem({
      key: `discharge:${patient.patientId}`,
      kind: "discharge",
      tone: "critical",
      title: "Alta por investigar",
      detail: `${patientLabel(patient)} - ${patientLocation(patient)}`,
      href: `#/ronda/${date}/paciente/${patient.patientId}`,
      time: "Urgente",
      patientId: patient.patientId
    }));
}

function movementAlerts(patients = [], date = "") {
  return patients
    .flatMap(patient => (patient.activePendingIssues || [])
      .filter(issue => {
        const text = normalizedText(issue);
        return text.includes("MOVIDO") || text.includes("CAMBIO") || text.includes("CONCILIACION");
      })
      .map(issue => ({ patient, issue })))
    .slice(0, 5)
    .map(({ patient, issue }) => alertItem({
      key: `movement:${patient.patientId}:${normalizedText(issue)}`,
      kind: "movement",
      tone: "warn",
      title: "Cambio de cama/servicio",
      detail: `${patientLabel(patient)} - ${issue}`,
      href: `#/ronda/${date}/paciente/${patient.patientId}`,
      time: "Turno",
      patientId: patient.patientId
    }));
}

function roundPendingAlerts(patients = [], roundMap = new Map(), date = "") {
  const pending = patients
    .filter(patient => !REVIEWED_STATUSES.has(roundStatus(roundMap.get(patient.patientId))))
    .sort(comparePatients);
  if (!pending.length) return [];
  return [alertItem({
    key: "round:pending",
    kind: "round",
    tone: pending.length > 10 ? "critical" : "warn",
    title: `${pending.length} paciente(s) sin ronda revisada`,
    detail: pending.slice(0, 3).map(patient => patientLocation(patient)).join(" | "),
    href: `#/ronda/${date}`,
    time: "Hoy"
  })];
}

function surgicalSignalAlerts(patients = [], date = "") {
  const rows = patients.filter(isSurgicalSignal).sort(comparePatients);
  if (!rows.length) return [];
  return [alertItem({
    key: "surgical:signals",
    kind: "isq",
    tone: "info",
    title: `${rows.length} senal(es) quirurgicas visibles`,
    detail: rows.slice(0, 3).map(patient => patientLocation(patient)).join(" | "),
    href: `#/ronda/${date}`,
    time: "ISQ"
  })];
}

function criticalPatientAlerts(patients = []) {
  return patients
    .map(patient => ({ patient, severity: monitorSeverity(patient) }))
    .filter(item => item.severity.level === "critica" || item.severity.level === "alta")
    .sort((a, b) => b.severity.score - a.severity.score || comparePatients(a.patient, b.patient))
    .slice(0, 5)
    .map(({ patient, severity }) => alertItem({
      key: `severity:${patient.patientId}`,
      kind: "severity",
      tone: severity.level === "critica" ? "critical" : "warn",
      title: `Prioridad ${severity.label}`,
      detail: `${patientLabel(patient)} - ${patientLocation(patient)} - score ${severity.score}`,
      href: `#/pacientes/${patient.patientId}/expediente`,
      time: "Ahora",
      patientId: patient.patientId
    }));
}

function iaasRiskDeviceAlerts(patients = [], devicesByPatient = new Map(), date = "") {
  return patients
    .filter(patient => ["iaas", "riesgo_iaas"].includes(monitorDiagnosisGroup(patient)))
    .map(patient => ({
      patient,
      devices: (devicesByPatient.get(patient.patientId) || []).filter(isIaasRiskRelevantDevice)
    }))
    .filter(item => item.devices.length)
    .sort((a, b) => b.devices.length - a.devices.length || comparePatients(a.patient, b.patient))
    .slice(0, 5)
    .map(({ patient, devices }) => alertItem({
      key: `risk-device:${patient.patientId}`,
      kind: "risk-device",
      tone: "critical",
      title: "Riesgo IAAS con invasivo relevante",
      detail: `${patientLabel(patient)} - ${devices.map(device => device.deviceType || device.preventivePackage).filter(Boolean).join(", ")}`,
      href: `#/ronda/${date}/paciente/${patient.patientId}`,
      time: "IAAS",
      patientId: patient.patientId
    }));
}

function culturePendingAlerts(cultures = [], patients = [], today = todayIso()) {
  const patientsById = new Map(patients.map(patient => [patient.patientId, patient]));
  return cultures
    .filter(isCulturePending)
    .map(culture => {
      const day = daysBetween(culture.requestedAt || culture.collectionDate, today);
      const threshold = isBloodCulture(culture.sampleType || culture.type) ? 7 : 2;
      return { culture, day: day ?? 0, threshold, due: Number.isFinite(day) && day >= threshold, patient: patientsById.get(culture.patientId) || {} };
    })
    .sort((a, b) => Number(b.due) - Number(a.due) || b.day - a.day)
    .slice(0, 5)
    .map(({ culture, day, threshold, due, patient }) => alertItem({
      key: `culture:${culture.cultureId || culture.id}`,
      kind: "culture",
      tone: due ? "critical" : "warn",
      title: due ? "Cultivo con resultado probable" : "Cultivo pendiente",
      detail: `${culture.sampleType || culture.type || "Cultivo"} - ${patientLabel(patient) || culture.patientName || culture.patientId || "Paciente"} - dia ${day}/${threshold}`,
      href: culture.patientId ? `#/pacientes/${culture.patientId}/expediente` : "#/epi-iaas",
      time: due ? "Recabar" : "Pendiente",
      patientId: culture.patientId || "",
      due
    }));
}

function opdPendingAlerts(patients = []) {
  const rows = patients.filter(patient => monitorOpdStatus(patient).pending).slice(0, 5);
  if (!rows.length) return [];
  return [alertItem({
    key: "opd:pending",
    kind: "opd",
    tone: "warn",
    title: `${rows.length} OPD pendiente(s)`,
    detail: rows.map(patient => patientLabel(patient)).join(" | "),
    href: "#/monitoreo-epidemiologico",
    time: "OPD"
  })];
}

function syncAlerts(sync = {}) {
  const alerts = [];
  if (sync.blocked) {
    alerts.push(alertItem({
      key: "sync:blocked",
      kind: "sync",
      tone: "critical",
      title: `${sync.blocked} sincronizacion(es) bloqueada(s)`,
      detail: "Revisar permisos, reglas o datos rechazados en Admin.",
      href: "#/admin",
      time: "Admin"
    }));
  }
  if (sync.pending) {
    alerts.push(alertItem({
      key: "sync:pending",
      kind: "sync",
      tone: "warn",
      title: `${sync.pending} escritura(s) pendiente(s)`,
      detail: "Datos locales en cola de sincronizacion.",
      href: "#/admin",
      time: "Sync"
    }));
  }
  return alerts;
}

function alertItem(item) {
  return {
    ...item,
    title: String(item.title || ""),
    detail: String(item.detail || ""),
    href: item.href || "#/inicio",
    tone: item.tone || "info",
    time: item.time || ""
  };
}

function isCulturePending(culture = {}) {
  const status = normalizedText(culture.status || "");
  const organism = normalizedText(culture.organism || culture.microorganism || "");
  const resultAt = normalizeDate(culture.resultAt || culture.resultDate);
  return CULTURE_PENDING_STATUSES.map(normalizedText).includes(status)
    && !resultAt
    && (!organism || organism === "PENDIENTE" || organism === "SIN RESULTADO");
}

function isBloodCulture(type = "") {
  return normalizedText(type).includes("HEMOCULTIVO");
}

function isIaasRiskRelevantDevice(device = {}) {
  const text = normalizedText(device.deviceType || device.preventivePackage || "");
  return Boolean(text) && !NON_IAAS_RISK_DEVICE_TYPES.has(text);
}

function isSurgicalSignal(patient = {}) {
  const text = normalizedText([
    patient.currentService,
    patient.service,
    patient.currentDiagnosis,
    patient.hospitalDiagnosis,
    patient.epidemiologicalDiagnosis,
    patient.currentEpidemiologicalDiagnosis,
    patient.observations,
    (patient.activePendingIssues || []).join(" ")
  ].filter(Boolean).join(" "));
  return /QUIRURG|CIRUG|TRAUMATOLOG|HERIDA|ISQ|POST ?OP|POP|LAPE|COLEC|FRACTURA|TUMOR|COLOSTOM/.test(text);
}

function roundStatus(round = {}) {
  const status = String(round?.status || "").trim();
  return status === "reviewed" ? "reviewed" : status;
}

function patientLabel(patient = {}) {
  return patient.patientName || patient.name || patient.fullName || patient.patientId || "";
}

function patientLocation(patient = {}) {
  return `${patient.service || patient.currentService || "Sin servicio"} cama ${patient.bed || patient.currentBed || "S/C"}`;
}

function groupBy(rows = [], field = "") {
  return rows.reduce((map, row) => {
    const key = row[field] || "";
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
}

function dedupeById(rows = [], idField = "id") {
  return [...rows.reduce((map, row) => {
    const id = row[idField] || row.id || JSON.stringify(row);
    map.set(id, { ...map.get(id), ...row });
    return map;
  }, new Map()).values()];
}

function comparePatients(a = {}, b = {}) {
  const sorted = sortPatientsByServiceBed([a, b]);
  if (sorted[0] === a && sorted[1] === b) return -1;
  if (sorted[0] === b && sorted[1] === a) return 1;
  return 0;
}

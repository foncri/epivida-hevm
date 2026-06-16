import { normalizeDate, nowIso, todayIso } from "../lib/date.js";
import { getDocData, paginateQuery } from "./firestoreService.js";
import { listActiveDevices } from "./deviceService.js";
import { listActiveIaas } from "./iaasService.js";
import { listPendingWrites } from "./offlineQueueService.js";
import { listActivePatients } from "./patientService.js";

const MAX_DAILY_SNAPSHOT_DAYS = 31;
const HISTORICAL_PAGE_SIZE = 100;
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
  const [patients, devices, iaasRows, pending] = await Promise.all([
    listActivePatients(),
    listActiveDevices(),
    listActiveIaas(),
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
      sync_queue: pending,
      daily_snapshots: snapshotRange?.rows || []
    },
    meta: {
      patients: patients.length,
      devices: devices.length,
      iaas: iaasRows.length,
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

function boundaryValue(dataset, date, endOfDay) {
  if (!dataset.isoDate) return date;
  return `${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
}

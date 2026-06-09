import { normalizeDate, todayIso } from "../lib/date.js";
import { getDocData } from "./firestoreService.js";

const MAX_DAILY_SNAPSHOT_DAYS = 31;

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

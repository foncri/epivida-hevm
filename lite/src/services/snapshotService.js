import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { normalizeDate, todayIso } from "../lib/date.js";
import { getDocData } from "./firestoreService.js";

const snapshotPromises = new Map();
const MAX_SNAPSHOT_TREND_DAYS = 30;

function snapshotCacheKey(date) {
  return `daily_snapshots:${date}`;
}

async function loadSnapshot(date) {
  if (appConfig().testMode) {
    const cached = await cacheGet(snapshotCacheKey(date));
    return cached?.value || null;
  }
  try {
    const snapshot = await getDocData(`daily_snapshots/${date}`);
    if (snapshot) cacheSet(snapshotCacheKey(date), snapshot).catch(() => undefined);
    return snapshot;
  } catch {
    const cached = await cacheGet(snapshotCacheKey(date));
    return cached?.value || null;
  }
}

export async function todaySnapshot(date = todayIso()) {
  const key = date || todayIso();
  if (!snapshotPromises.has(key)) {
    snapshotPromises.set(key, loadSnapshot(key).finally(() => {
      snapshotPromises.delete(key);
    }));
  }
  return snapshotPromises.get(key);
}

export function snapshotTrendDates(endDate = todayIso(), days = 7) {
  const end = normalizeDate(endDate) || todayIso();
  const count = Math.min(MAX_SNAPSHOT_TREND_DAYS, Math.max(2, Number(days) || 7));
  return Array.from({ length: count }, (_, index) => addDaysIso(end, index - count + 1));
}

export async function snapshotTrend(endDate = todayIso(), days = 7) {
  const dates = snapshotTrendDates(endDate, days);
  const rows = await Promise.all(dates.map(async date => ({
    date,
    snapshot: await todaySnapshot(date).catch(() => null)
  })));
  return summarizeSnapshotTrend(rows);
}

export function summarizeSnapshotTrend(rows = []) {
  const normalized = rows.map(row => ({
    date: row.date,
    found: Boolean(row.snapshot),
    totalActivePatients: numberValue(row.snapshot?.totalActivePatients),
    totalIAASActive: numberValue(row.snapshot?.totalIAASActive),
    totalDevicesActive: numberValue(row.snapshot?.totalDevicesActive),
    totalPendingIssues: numberValue(row.snapshot?.totalPendingIssues)
  }));
  const found = normalized.filter(row => row.found);
  const latest = found.at(-1) || null;
  const previous = found.length > 1 ? found.at(-2) : null;
  return {
    rows: normalized,
    foundDays: found.length,
    latest,
    previous,
    deltas: {
      totalActivePatients: metricDelta(latest, previous, "totalActivePatients"),
      totalIAASActive: metricDelta(latest, previous, "totalIAASActive"),
      totalDevicesActive: metricDelta(latest, previous, "totalDevicesActive"),
      totalPendingIssues: metricDelta(latest, previous, "totalPendingIssues")
    },
    peaks: {
      totalActivePatients: maxMetric(found, "totalActivePatients"),
      totalIAASActive: maxMetric(found, "totalIAASActive"),
      totalDevicesActive: maxMetric(found, "totalDevicesActive"),
      totalPendingIssues: maxMetric(found, "totalPendingIssues")
    }
  };
}

function addDaysIso(date, days) {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function metricDelta(latest, previous, field) {
  if (!latest || !previous) return 0;
  return numberValue(latest[field]) - numberValue(previous[field]);
}

function maxMetric(rows, field) {
  return rows.length ? Math.max(...rows.map(row => numberValue(row[field]))) : 0;
}

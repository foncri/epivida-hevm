import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { normalizeDate, todayIso } from "../lib/date.js";
import { getDocData } from "./firestoreService.js";

const snapshotPromises = new Map();
const periodSnapshotPromises = new Map();
const MAX_SNAPSHOT_TREND_DAYS = 30;
const METRIC_FIELDS = [
  "totalActivePatients",
  "totalImportedPatients",
  "totalReconciliationPatients",
  "totalIAASActive",
  "totalDevicesActive",
  "totalPendingIssues",
  "reportedDischarges",
  "probableDischarges"
];
const METRIC_ALIASES = {
  totalActivePatients: ["latestActivePatients"],
  totalImportedPatients: ["sumImportedPatients", "latestImportedPatients"],
  totalReconciliationPatients: ["sumReconciliationPatients", "latestReconciliationPatients"],
  totalIAASActive: ["latestIAASActive"],
  totalDevicesActive: ["latestDevicesActive"],
  totalPendingIssues: ["latestPendingIssues"],
  reportedDischarges: ["sumReportedDischarges"],
  probableDischarges: ["sumProbableDischarges"]
};

function snapshotCacheKey(date) {
  return `daily_snapshots:${date}`;
}

function periodSnapshotCacheKey(collection, key) {
  return `${collection}:${key}`;
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

export function monthKeyForDate(date = todayIso()) {
  const normalized = normalizeDate(date) || todayIso();
  return normalized.slice(0, 7);
}

export function yearKeyForDate(date = todayIso()) {
  const normalized = normalizeDate(date) || todayIso();
  return normalized.slice(0, 4);
}

export async function monthSnapshot(monthKey = monthKeyForDate()) {
  return periodSnapshot("monthly_snapshots", monthKey);
}

export async function yearSnapshot(yearKey = yearKeyForDate()) {
  return periodSnapshot("yearly_snapshots", yearKey);
}

export async function snapshotPeriodOverview(date = todayIso()) {
  const month = monthKeyForDate(date);
  const year = yearKeyForDate(date);
  const [monthly, yearly] = await Promise.all([
    monthSnapshot(month).catch(() => null),
    yearSnapshot(year).catch(() => null)
  ]);
  return {
    month: summarizeMonthlySnapshot(month, monthly),
    year: summarizeYearlySnapshot(year, yearly)
  };
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

export function snapshotMetricFromDaily(date, snapshot = {}) {
  const metric = { date };
  METRIC_FIELDS.forEach(field => {
    metric[field] = numberValue(snapshot?.[field]);
  });
  return metric;
}

export function summarizeMonthlySnapshot(monthKey = monthKeyForDate(), snapshot = null) {
  if (!snapshot) return emptyPeriodSummary(monthKey, "month");
  const metrics = Object.entries(snapshot.dailyMetrics || {})
    .map(([date, metric]) => ({ date, ...numericMetric(metric) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return summarizePeriodMetrics(monthKey, "month", metrics, snapshot.latest || null, snapshot.lastSnapshotDate || "");
}

export function summarizeYearlySnapshot(yearKey = yearKeyForDate(), snapshot = null) {
  if (!snapshot) return emptyPeriodSummary(yearKey, "year");
  const metrics = Object.entries(snapshot.monthlyMetrics || {})
    .map(([month, metric]) => ({ month, date: metric.lastSnapshotDate || `${month}-01`, ...numericMetric(metric) }))
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  return summarizePeriodMetrics(yearKey, "year", metrics, snapshot.latest || null, snapshot.lastSnapshotDate || "");
}

export function aggregateDailySnapshots(monthKey = monthKeyForDate(), rows = []) {
  const metrics = rows
    .filter(row => row.found)
    .map(row => snapshotMetricFromDaily(row.date, row))
    .sort((a, b) => a.date.localeCompare(b.date));
  return summarizePeriodMetrics(monthKey, "month", metrics, metrics.at(-1) || null, metrics.at(-1)?.date || "");
}

export function aggregateMonthlySnapshots(yearKey = yearKeyForDate(), rows = []) {
  const metrics = rows
    .filter(row => row.found)
    .map(row => ({
      month: row.month,
      date: row.lastSnapshotDate || `${row.month}-01`,
      ...numericMetric(row)
    }))
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  return summarizePeriodMetrics(yearKey, "year", metrics, metrics.at(-1) || null, metrics.at(-1)?.date || "");
}

async function periodSnapshot(collection, key) {
  const id = String(key || "").trim();
  if (!id) return null;
  const promiseKey = `${collection}/${id}`;
  if (!periodSnapshotPromises.has(promiseKey)) {
    periodSnapshotPromises.set(promiseKey, loadPeriodSnapshot(collection, id).finally(() => {
      periodSnapshotPromises.delete(promiseKey);
    }));
  }
  return periodSnapshotPromises.get(promiseKey);
}

async function loadPeriodSnapshot(collection, key) {
  if (appConfig().testMode) {
    const cached = await cacheGet(periodSnapshotCacheKey(collection, key));
    return cached?.value || null;
  }
  try {
    const snapshot = await getDocData(`${collection}/${key}`);
    if (snapshot) cacheSet(periodSnapshotCacheKey(collection, key), snapshot).catch(() => undefined);
    return snapshot;
  } catch {
    const cached = await cacheGet(periodSnapshotCacheKey(collection, key));
    return cached?.value || null;
  }
}

function emptyPeriodSummary(key, period) {
  return {
    key,
    period,
    found: false,
    daysFound: 0,
    monthsFound: 0,
    lastSnapshotDate: "",
    latest: null,
    averages: emptyMetrics(),
    peaks: emptyMetrics(),
    sums: emptyMetrics()
  };
}

function summarizePeriodMetrics(key, period, metrics = [], latestFallback = null, lastSnapshotDate = "") {
  const latest = numericMetric(latestFallback || metrics.at(-1) || {});
  const peaks = {};
  const sums = {};
  const averages = {};
  METRIC_FIELDS.forEach(field => {
    const values = metrics.map(row => numberValue(row[field]));
    const sum = values.reduce((total, value) => total + value, 0);
    sums[field] = sum;
    peaks[field] = values.length ? Math.max(...values) : numberValue(latest[field]);
    averages[field] = values.length ? Math.round((sum / values.length) * 10) / 10 : 0;
  });
  return {
    key,
    period,
    found: metrics.length > 0 || Boolean(latestFallback),
    daysFound: period === "month" ? metrics.length : 0,
    monthsFound: period === "year" ? metrics.length : 0,
    lastSnapshotDate: lastSnapshotDate || metrics.at(-1)?.date || "",
    latest,
    averages,
    peaks,
    sums
  };
}

function numericMetric(metric = {}) {
  const normalized = {};
  METRIC_FIELDS.forEach(field => {
    const aliases = METRIC_ALIASES[field] || [];
    const value = metric?.[field] ?? aliases.map(alias => metric?.[alias]).find(item => item !== undefined);
    normalized[field] = numberValue(value);
  });
  return normalized;
}

function emptyMetrics() {
  return numericMetric({});
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

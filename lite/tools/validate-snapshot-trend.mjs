const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const {
  aggregateDailySnapshots,
  aggregateMonthlySnapshots,
  monthKeyForDate,
  snapshotMetricFromDaily,
  snapshotTrendDates,
  summarizeSnapshotTrend,
  summarizeMonthlySnapshot,
  summarizeYearlySnapshot,
  yearKeyForDate
} = await import("../src/services/snapshotService.js");

const dates = snapshotTrendDates("2026-06-16", 7);
requireValue(dates.join(",") === "2026-06-10,2026-06-11,2026-06-12,2026-06-13,2026-06-14,2026-06-15,2026-06-16", "snapshotTrendDates debe crear ventana de 7 dias cerrada en la fecha final.");
requireValue(snapshotTrendDates("2026-06-16", 120).length === 30, "snapshotTrendDates debe acotar tendencias a 30 dias para no leer historicos completos.");

const trend = summarizeSnapshotTrend([
  { date: "2026-06-10", snapshot: null },
  { date: "2026-06-11", snapshot: { totalActivePatients: 10, totalIAASActive: 1, totalDevicesActive: 4, totalPendingIssues: 8 } },
  { date: "2026-06-12", snapshot: { totalActivePatients: 11, totalIAASActive: 2, totalDevicesActive: 3, totalPendingIssues: 6 } },
  { date: "2026-06-13", snapshot: null },
  { date: "2026-06-14", snapshot: { totalActivePatients: 14, totalIAASActive: 2, totalDevicesActive: 7, totalPendingIssues: 5 } }
]);

requireValue(trend.rows.length === 5, "Tendencia debe conservar filas faltantes para que Inicio muestre huecos operativos.");
requireValue(trend.foundDays === 3, "Tendencia debe contar solo snapshots existentes.");
requireValue(trend.latest.date === "2026-06-14" && trend.previous.date === "2026-06-12", "Tendencia debe comparar los dos ultimos snapshots existentes, no el ultimo hueco.");
requireValue(trend.deltas.totalActivePatients === 3, "Delta de pacientes debe compararse contra snapshot previo existente.");
requireValue(trend.deltas.totalDevicesActive === 4, "Delta de invasivos debe calcularse desde agregados diarios.");
requireValue(trend.deltas.totalPendingIssues === -1, "Delta de pendientes debe conservar signo negativo si mejoro.");
requireValue(trend.peaks.totalActivePatients === 14 && trend.peaks.totalDevicesActive === 7, "Picos deben salir de snapshots encontrados.");

requireValue(monthKeyForDate("2026-06-16") === "2026-06", "monthKeyForDate debe derivar llave mensual YYYY-MM.");
requireValue(yearKeyForDate("2026-06-16") === "2026", "yearKeyForDate debe derivar llave anual YYYY.");
const metric = snapshotMetricFromDaily("2026-06-16", {
  totalActivePatients: 15,
  totalImportedPatients: 12,
  totalReconciliationPatients: 3,
  reportedDischarges: 1
});
requireValue(metric.totalActivePatients === 15 && metric.reportedDischarges === 1, "snapshotMetricFromDaily debe normalizar metricas diarias para agregados.");

const monthlySummary = aggregateDailySnapshots("2026-06", [
  { date: "2026-06-01", found: true, totalActivePatients: 10, totalImportedPatients: 10, totalReconciliationPatients: 0, reportedDischarges: 0, probableDischarges: 0 },
  { date: "2026-06-02", found: true, totalActivePatients: 12, totalImportedPatients: 11, totalReconciliationPatients: 1, reportedDischarges: 1, probableDischarges: 1 },
  { date: "2026-06-03", found: false, totalActivePatients: 0 }
]);
requireValue(monthlySummary.found && monthlySummary.daysFound === 2, "Agregado mensual debe contar solo dias con snapshot.");
requireValue(monthlySummary.latest.totalActivePatients === 12, "Agregado mensual debe conservar ultimo snapshot encontrado.");
requireValue(monthlySummary.peaks.totalActivePatients === 12 && monthlySummary.sums.totalImportedPatients === 21, "Agregado mensual debe calcular picos y sumas operativas.");

const storedMonthly = summarizeMonthlySnapshot("2026-06", {
  lastSnapshotDate: "2026-06-02",
  latest: { totalActivePatients: 12, totalImportedPatients: 11 },
  dailyMetrics: {
    "2026-06-01": { totalActivePatients: 10, totalImportedPatients: 10 },
    "2026-06-02": { totalActivePatients: 12, totalImportedPatients: 11 }
  }
});
requireValue(storedMonthly.daysFound === 2 && storedMonthly.averages.totalActivePatients === 11, "summarizeMonthlySnapshot debe leer dailyMetrics guardado.");

const yearlySummary = aggregateMonthlySnapshots("2026", [
  { month: "2026-05", found: true, lastSnapshotDate: "2026-05-31", latestActivePatients: 9, sumImportedPatients: 90 },
  { month: "2026-06", found: true, lastSnapshotDate: "2026-06-30", latestActivePatients: 12, sumImportedPatients: 110 }
]);
requireValue(yearlySummary.found && yearlySummary.monthsFound === 2, "Agregado anual debe contar meses con snapshot.");
requireValue(yearlySummary.latest.totalActivePatients === 12 && yearlySummary.sums.totalImportedPatients === 200, "Agregado anual debe combinar ultimos activos y sumas mensuales.");

const storedYearly = summarizeYearlySnapshot("2026", {
  lastSnapshotDate: "2026-06-30",
  latest: { totalActivePatients: 12 },
  monthlyMetrics: {
    "2026-05": { month: "2026-05", lastSnapshotDate: "2026-05-31", totalActivePatients: 9 },
    "2026-06": { month: "2026-06", lastSnapshotDate: "2026-06-30", totalActivePatients: 12 }
  }
});
requireValue(storedYearly.monthsFound === 2 && storedYearly.peaks.totalActivePatients === 12, "summarizeYearlySnapshot debe leer monthlyMetrics guardado.");

if (failures.length) {
  console.error(`EPIVIDA Lite snapshot trend validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite snapshot trend validation OK");

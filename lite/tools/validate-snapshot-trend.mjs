const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const {
  snapshotTrendDates,
  summarizeSnapshotTrend
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

if (failures.length) {
  console.error(`EPIVIDA Lite snapshot trend validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite snapshot trend validation OK");

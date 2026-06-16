const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const {
  buildOperationalAlerts,
  OPERATIONAL_ALERTS_VERSION
} = await import("../src/services/operationalAlertService.js");

const patients = [
  {
    patientId: "p_risk",
    patientName: "Paciente Riesgo",
    service: "MEDICINA INTERNA",
    bed: "12",
    status: "GRAVE",
    epidemiologicalDiagnosis: "RIESGO IAAS",
    hospitalDiagnosis: "Sepsis con cateter venoso central",
    activePendingIssues: ["Movido de cama 10 a 12"],
    active: true
  },
  {
    patientId: "p_discharge",
    patientName: "Paciente Alta",
    service: "URGENCIAS",
    bed: "CHOQUE",
    epidemiologicalDiagnosis: "VIG NO TRANSMISIBLE",
    hospitalDiagnosis: "Alta probable por mejoria",
    probableDischarge: true,
    dischargeReviewRequired: true,
    opd: { address: "", phone: "", symptomStartDate: "2026-06-01", uploaded: false, discharged: false },
    active: true
  },
  {
    patientId: "p_isq",
    patientName: "Paciente ISQ",
    service: "CIRUGIA Y TRAUMATOLOGIA",
    bed: "44",
    epidemiologicalDiagnosis: "NO IAAS",
    hospitalDiagnosis: "Post operatorio por fractura",
    active: true
  }
];

const alerts = buildOperationalAlerts({
  date: "2026-06-09",
  today: "2026-06-09",
  patients,
  devices: [
    { episodeId: "d_cvc", patientId: "p_risk", deviceType: "CVC", active: true, installationDate: "2026-06-01" },
    { episodeId: "d_puntas", patientId: "p_risk", deviceType: "Puntas nasales", active: true, installationDate: "2026-06-01" }
  ],
  rounds: [
    { roundId: "2026-06-09_p_isq", date: "2026-06-09", patientId: "p_isq", status: "reviewed" }
  ],
  cultures: [
    { cultureId: "c_hemo", patientId: "p_risk", sampleType: "Hemocultivo central", requestedAt: "2026-06-01", status: "solicitado", organism: "Pendiente" },
    { cultureId: "c_result", patientId: "p_isq", sampleType: "Urocultivo", requestedAt: "2026-06-07", status: "resultado", organism: "E coli" }
  ],
  queue: [
    { id: "q1", status: "local_pending" },
    { id: "q2", status: "sync_blocked" }
  ]
});

const allItems = alerts.panels.flatMap(panel => panel.items);

requireValue(alerts.version === OPERATIONAL_ALERTS_VERSION, "Alertas operativas deben exponer version.");
requireValue(alerts.panels.length === 3, "Alertas operativas deben conservar paneles preventive/iaas/vig.");
requireValue(allItems.some(item => item.kind === "discharge" && item.patientId === "p_discharge"), "Debe detectar altas por investigar.");
requireValue(allItems.some(item => item.kind === "movement" && item.patientId === "p_risk"), "Debe detectar movimientos/conciliacion desde pendientes activos.");
requireValue(allItems.some(item => item.kind === "round" && item.title.includes("2 paciente")), "Debe detectar pacientes sin ronda revisada del dia.");
requireValue(allItems.some(item => item.kind === "isq"), "Debe detectar senales quirurgicas/ISQ.");
requireValue(allItems.some(item => item.kind === "risk-device" && item.detail.includes("CVC") && !item.detail.includes("Puntas")), "Debe filtrar invasivos relevantes para riesgo IAAS.");
requireValue(allItems.some(item => item.kind === "culture" && item.due === true), "Debe detectar cultivos pendientes vencidos por umbral.");
requireValue(allItems.some(item => item.kind === "opd"), "Debe detectar OPD pendiente.");
requireValue(allItems.some(item => item.kind === "sync" && item.tone === "critical"), "Debe detectar sincronizacion bloqueada.");
requireValue(alerts.totals.culturesDue === 1, "Totales deben contar solo cultivos vencidos.");
requireValue(alerts.totals.syncPending === 1 && alerts.totals.syncBlocked === 1, "Totales de sync deben separar pendientes y bloqueadas.");

if (failures.length) {
  console.error(`EPIVIDA Lite operational alerts validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite operational alerts validation OK");

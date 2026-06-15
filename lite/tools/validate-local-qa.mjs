globalThis.window = {
  __EPIVIDA_LITE_TEST_MODE__: true,
  EPIVIDA_LITE_REQUIRE_AUTH: true
};
globalThis.location = {
  hostname: "localhost",
  search: "?epividaTest=1",
  hash: "#/ronda/2026-06-04"
};

const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const testData = await import("../src/services/testDataService.js");
const monitor = await import("../src/services/monitorService.js");
const router = await import("../src/router.js");
const iaasService = await import("../src/services/iaasService.js");
const offlineQueue = await import("../src/services/offlineQueueService.js");

const patients = testData.testActivePatients();
const devices = testData.testActiveDevices();
const roundsToday = testData.testRounds("2026-06-04");
const historyRounds = testData.testRoundsForPatient("p_history");

requireValue(testData.testDataEnabled(), "El modo QA local debe activarse con epividaTest.");
requireValue(patients.length >= 3, "QA local debe exponer al menos 3 pacientes sinteticos.");
requireValue(patients.some(row => row.patientId === "p_uci_02" && row.bed === "UCIA 2"), "QA local debe incluir p_uci_02 en UCIA 2.");
requireValue(patients.some(row => row.patientId === "p_history"), "QA local debe incluir p_history para historial preventivo.");
requireValue(patients.some(row => row.patientId === "p_discharge" && row.dischargeReviewRequired), "QA local debe incluir alta por verificar.");
requireValue(devices.some(row => row.patientId === "p_uci_02" && row.preventivePackage === "NAVM"), "QA local debe incluir NAVM para p_uci_02.");
requireValue(devices.some(row => row.patientId === "p_history" && row.deviceType === "CVC"), "QA local debe incluir CVC historico para p_history.");
requireValue(roundsToday.some(row => row.patientId === "p_history" && row.status === "reviewed"), "QA local debe incluir ronda revisada del dia.");
requireValue(historyRounds.some(row => row.date === "2026-06-03"), "QA local debe incluir historial preventivo del dia previo.");
requireValue(historyRounds.some(row => (row.packageReviews || []).some(review => review.packageType === "P.E. Y P.B.M.T.")), "QA local debe conservar P.E. Y P.B.M.T. en historial.");

globalThis.location.search = "?epividaTest=1&seedPatients=300";
const seededPatients = testData.testActivePatients();
const startedAt = Date.now();
const seededVisible = monitor.visibleMonitorPatients(seededPatients, { query: "sintetico riesgo", diagnosis: "RIESGO IAAS" });
const elapsed = Date.now() - startedAt;
const seededMetrics = monitor.monitorMetrics(seededPatients, seededVisible);
requireValue(seededPatients.length === 300, "QA local debe generar 300 pacientes sinteticos anonimos con seedPatients=300.");
requireValue(seededVisible.length > 0, "Monitoreo QA debe filtrar pacientes sinteticos por busqueda y diagnostico.");
requireValue(seededMetrics.active === 300 && seededMetrics.riskIaas === seededVisible.length, "Metricas de monitoreo deben calcularse sobre 300 pacientes sin Firebase.");
requireValue(elapsed < 75, `Filtro local de 300 pacientes debe ser rapido; tomo ${elapsed} ms.`);

const parsedRound = router.parseRoute();
requireValue(parsedRound.key === "ronda-paquetes", "Alias legacy #/ronda/YYYY-MM-DD debe resolver a ronda-paquetes.");
requireValue(parsedRound.parts[1] === "2026-06-04", "La fecha legacy de ronda debe preservarse en route.parts.");
globalThis.location.hash = "#/ronda/2026-06-04/paciente/p_uci_02";
const parsedPatient = router.parseRoute();
requireValue(parsedPatient.key === "ronda-paquetes", "Ruta legacy por paciente debe resolver a ronda-paquetes.");
requireValue(parsedPatient.parts[3] === "p_uci_02", "Ruta legacy por paciente debe preservar patientId.");

const app = {
  state: {
    auth: {
      user: { uid: "qa-user", email: "qa@epivida.local" },
      profile: { role: "admin_epidemiologia" }
    }
  }
};
requireValue(iaasService.patientClassificationForIaasStatus("confirmada") === "IAAS", "IAAS confirmada debe sincronizar paciente como IAAS.");
requireValue(iaasService.patientClassificationForIaasStatus("sospecha") === "RIESGO IAAS", "IAAS sospecha debe sincronizar paciente como RIESGO IAAS.");
requireValue(iaasService.patientClassificationForIaasStatus("descartada") === "NO IAAS", "IAAS descartada debe sincronizar paciente como NO IAAS.");
const savedIaas = await iaasService.saveIaasCase(app, {
  patientId: "p_history",
  patientName: "Paciente QA Historial",
  service: "MEDICINA INTERNA",
  bed: "12",
  iaasType: "ITS-CVC",
  status: "confirmada",
  onsetDate: "2026-06-05",
  probableOrigin: "Cateter venoso central",
  criteria: "Validacion QA de sincronizacion IAAS",
  active: true
});
const pendingPatientSync = await offlineQueue.pendingPayloadsForCollection("patients_active");
requireValue(savedIaas.patientClassification === "IAAS", "saveIaasCase debe devolver clasificacion de paciente sincronizada.");
requireValue(pendingPatientSync.some(row => row.patientId === "p_history" && row.epidemiologicalDiagnosis === "IAAS"), "Guardar IAAS debe encolar sincronizacion de clasificacion en patients_active.");

globalThis.window.__EPIVIDA_LITE_TEST_MODE__ = false;
globalThis.location.search = "";
requireValue(testData.testActivePatients().length === 0, "Datos QA no deben exponerse fuera de modo local de prueba.");

if (failures.length) {
  console.error(`EPIVIDA Lite local QA validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite local QA validation OK");

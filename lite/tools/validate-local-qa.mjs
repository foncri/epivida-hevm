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
const router = await import("../src/router.js");

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

const parsedRound = router.parseRoute();
requireValue(parsedRound.key === "ronda-paquetes", "Alias legacy #/ronda/YYYY-MM-DD debe resolver a ronda-paquetes.");
requireValue(parsedRound.parts[1] === "2026-06-04", "La fecha legacy de ronda debe preservarse en route.parts.");
globalThis.location.hash = "#/ronda/2026-06-04/paciente/p_uci_02";
const parsedPatient = router.parseRoute();
requireValue(parsedPatient.key === "ronda-paquetes", "Ruta legacy por paciente debe resolver a ronda-paquetes.");
requireValue(parsedPatient.parts[3] === "p_uci_02", "Ruta legacy por paciente debe preservar patientId.");

globalThis.window.__EPIVIDA_LITE_TEST_MODE__ = false;
globalThis.location.search = "";
requireValue(testData.testActivePatients().length === 0, "Datos QA no deben exponerse fuera de modo local de prueba.");

if (failures.length) {
  console.error(`EPIVIDA Lite local QA validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite local QA validation OK");

const failures = [];

globalThis.window = {
  __EPIVIDA_LITE_TEST_MODE__: true
};
globalThis.location = {
  hostname: "localhost",
  search: "?epividaTest=1",
  hash: ""
};

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const { filterPatients, patientFilterText, patientSearchIndexData, patientSearchTokens, searchPatientsIndex, sortPatientsByServiceBed, uniqueValues } = await import("../src/services/patientService.js");
const { MONITOR_AGE_RANGES, monitorDiagnosisGroup, monitorEpidemiologicalBases, monitorMetrics, monitorPatientAgeYears, monitorPatientDeih, visibleMonitorPatients } = await import("../src/services/monitorService.js");

const patients = [
  {
    patientId: "p_1",
    patientName: "Ana Perez",
    service: "MEDICINA INTERNA",
    bed: "12",
    status: "GRAVE",
    sex: "F",
    age: 45,
    deih: 5,
    epidemiologicalDiagnosis: "IAAS",
    hospitalDiagnosis: "Neumonia"
  },
  {
    patientId: "p_2",
    patientName: "Luis Gomez",
    currentService: "PEDIATRIA",
    currentBed: "67",
    currentState: "ESTABLE",
    sex: "M",
    age: "8 anos",
    daysInHospital: 2,
    currentEpidemiologicalDiagnosis: "NO IAAS",
    currentDiagnosis: "Bronquiolitis"
  },
  {
    patientId: "p_3",
    patientName: "Rosa Diaz",
    service: "UCI",
    bed: "4",
    status: "CRITICO",
    sex: "F",
    age: 91,
    deih: 18,
    epidemiologicalDiagnosis: "RIESGO IAAS",
    syncStatus: "local_pending"
  }
];

const epiPatients = [
  {
    patientId: "p_covid",
    patientName: "Caso COVID",
    service: "AISLAMIENTO",
    bed: "1",
    epidemiologicalDiagnosis: "COVID/INFLUENZA",
    age: 35
  },
  {
    patientId: "p_esavi",
    patientName: "Caso ESAVI",
    service: "PEDIATRIA",
    bed: "2",
    epidemiologicalDiagnosis: "ESAVI",
    age: 12
  },
  {
    patientId: "p_maternal",
    patientName: "Caso Materna",
    service: "GINECOLOGIA",
    bed: "3",
    epidemiologicalDiagnosis: "MORBIMORTALIDAD MATERNA/PERINATAL",
    age: 28
  },
  {
    patientId: "p_vig_iaas",
    patientName: "Caso Vigilancia IAAS",
    service: "UCI",
    bed: "4",
    epidemiologicalDiagnosis: "VIG TRANSMISIBLE / 1 IAAS",
    age: 55
  }
];

requireValue(filterPatients(patients, { query: "neumonia" }).map(row => row.patientId).join(",") === "p_1", "Busqueda debe encontrar diagnostico hospitalario.");
requireValue(filterPatients(patients, { service: "PEDIATRIA" }).map(row => row.patientId).join(",") === "p_2", "Filtro de servicio debe usar currentService.");
requireValue(filterPatients(patients, { status: "ESTABLE", sex: "M" }).map(row => row.patientId).join(",") === "p_2", "Filtros de estado y sexo deben combinarse.");
requireValue(filterPatients(patients, { diagnosis: "IAAS" }).map(row => row.patientId).join(",") === "p_1", "Filtro de diagnostico epidemiologico debe usar campos actuales y legacy.");

const before = patientFilterText(patients[0]);
patients[0].hospitalDiagnosis = "Sepsis";
const after = patientFilterText(patients[0]);
requireValue(before.includes("neumonia") && after.includes("sepsis"), "Cache de busqueda debe invalidarse cuando cambia la firma clinica.");
const searchDoc = patientSearchIndexData(patients[0]);
requireValue(searchDoc.searchText.includes("ANA PEREZ") && searchDoc.searchTokens.includes("SEPSIS"), "patients_search debe guardar texto normalizado y tokens clinicos.");
requireValue(patientSearchTokens("neumonia grave").includes("NEU") && patientSearchTokens("neumonia grave").includes("GRAVE"), "Tokens de busqueda deben incluir prefijos y palabras completas.");
const indexedRows = await searchPatientsIndex("historial medicina", { activeOnly: true, limit: 5 });
requireValue(indexedRows.some(row => row.patientId === "p_history"), "Busqueda indexada QA debe encontrar paciente por tokens sin listar historicos globales.");
requireValue(uniqueValues(patients, "service").includes("MEDICINA INTERNA") && uniqueValues(patients, "service").includes("PEDIATRIA"), "uniqueValues debe leer service y currentService.");
requireValue(uniqueValues(patients, "diagnosis").includes("IAAS") && uniqueValues(patients, "diagnosis").includes("NO IAAS"), "uniqueValues debe leer diagnostico epidemiologico.");
requireValue(sortPatientsByServiceBed([{ patientId: "b", service: "UCI", bed: "10" }, { patientId: "a", service: "UCI", bed: "2" }]).map(row => row.patientId).join(",") === "a,b", "Orden de pacientes debe ser natural por servicio y cama.");
requireValue(monitorDiagnosisGroup(patients[0]) === "iaas" && monitorDiagnosisGroup(patients[1]) === "no_iaas" && monitorDiagnosisGroup(patients[2]) === "riesgo_iaas", "monitorService debe separar IAAS, NO IAAS y RIESGO IAAS.");
const visible = visibleMonitorPatients(patients, { service: "UCI" });
const monitor = monitorMetrics(patients, visible);
requireValue(visible.map(row => row.patientId).join(",") === "p_3" && monitor.riskIaas === 1 && monitor.pendingSync === 1, "monitorService debe calcular visibles y metricas locales sin consulta por tecla.");
requireValue(MONITOR_AGE_RANGES.some(row => row.value === "90+"), "Monitoreo debe conservar rangos de edad legacy.");
requireValue(monitorPatientAgeYears({ age: "6 meses" }) > 0 && monitorPatientAgeYears({ age: "6 meses" }) < 1, "Monitoreo debe interpretar edades en meses/dias de censos legacy.");
requireValue(monitorPatientDeih({ admissionDate: "2026-06-01", lastCensusDate: "2026-06-04" }) === 3, "Monitoreo debe calcular DEIH desde fecha de ingreso cuando no venga explicito.");
requireValue(visibleMonitorPatients(patients, { ageRange: "0-9" }).map(row => row.patientId).join(",") === "p_2", "Monitoreo debe filtrar por rango de edad legacy.");
requireValue(visibleMonitorPatients(patients, { ageRange: "90+" }).map(row => row.patientId).join(",") === "p_3", "Monitoreo debe filtrar adultos mayores 90+.");
requireValue(visibleMonitorPatients(patients, { sort: "deih-desc" }).map(row => row.patientId).join(",") === "p_3,p_1,p_2", "Monitoreo debe ordenar por DEIH mayor a menor.");
requireValue(visibleMonitorPatients(patients, { sort: "state-desc" }).map(row => row.patientId)[0] === "p_3", "Monitoreo debe ordenar por estado critico a estable.");
requireValue(monitorDiagnosisGroup(epiPatients[0]) === "covid_influenza" && monitorDiagnosisGroup(epiPatients[1]) === "esavi" && monitorDiagnosisGroup(epiPatients[2]) === "maternal_perinatal", "monitorService debe separar COVID/Influenza, ESAVI y morbimortalidad legacy.");
requireValue(monitorEpidemiologicalBases(epiPatients[3]).includes("vigilancia") && monitorEpidemiologicalBases(epiPatients[3]).includes("iaas"), "Monitoreo debe conservar bases combinadas VIG + IAAS.");
requireValue(visibleMonitorPatients(epiPatients, { epiBase: "covid_influenza" }).map(row => row.patientId).join(",") === "p_covid", "Monitoreo debe filtrar por etiqueta epidemiologica COVID/Influenza.");
requireValue(visibleMonitorPatients(epiPatients, { epiBase: "maternal_perinatal" }).map(row => row.patientId).join(",") === "p_maternal", "Monitoreo debe filtrar por etiqueta epidemiologica de morbimortalidad.");
const epiMonitor = monitorMetrics(epiPatients, epiPatients);
requireValue(epiMonitor.covidInfluenza === 1 && epiMonitor.esavi === 1 && epiMonitor.maternalPerinatal === 1 && epiMonitor.surveillance === 1 && epiMonitor.iaas === 1, "Metricas de monitoreo deben contar etiquetas epidemiologicas legacy sin perder combinaciones.");

if (failures.length) {
  console.error(`EPIVIDA Lite patient filter validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite patient filter validation OK");

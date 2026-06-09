const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const { filterPatients, patientFilterText, sortPatientsByServiceBed, uniqueValues } = await import("../src/services/patientService.js");
const { monitorDiagnosisGroup, monitorMetrics, visibleMonitorPatients } = await import("../src/services/monitorService.js");

const patients = [
  {
    patientId: "p_1",
    patientName: "Ana Perez",
    service: "MEDICINA INTERNA",
    bed: "12",
    status: "GRAVE",
    sex: "F",
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
    currentEpidemiologicalDiagnosis: "NO IAAS",
    currentDiagnosis: "Bronquiolitis"
  },
  {
    patientId: "p_3",
    patientName: "Rosa Diaz",
    service: "UCI",
    bed: "4",
    status: "RIESGO",
    sex: "F",
    epidemiologicalDiagnosis: "RIESGO IAAS",
    syncStatus: "local_pending"
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
requireValue(uniqueValues(patients, "service").includes("MEDICINA INTERNA") && uniqueValues(patients, "service").includes("PEDIATRIA"), "uniqueValues debe leer service y currentService.");
requireValue(uniqueValues(patients, "diagnosis").includes("IAAS") && uniqueValues(patients, "diagnosis").includes("NO IAAS"), "uniqueValues debe leer diagnostico epidemiologico.");
requireValue(sortPatientsByServiceBed([{ patientId: "b", service: "UCI", bed: "10" }, { patientId: "a", service: "UCI", bed: "2" }]).map(row => row.patientId).join(",") === "a,b", "Orden de pacientes debe ser natural por servicio y cama.");
requireValue(monitorDiagnosisGroup(patients[0]) === "iaas" && monitorDiagnosisGroup(patients[1]) === "no_iaas" && monitorDiagnosisGroup(patients[2]) === "riesgo_iaas", "monitorService debe separar IAAS, NO IAAS y RIESGO IAAS.");
const visible = visibleMonitorPatients(patients, { service: "UCI" });
const monitor = monitorMetrics(patients, visible);
requireValue(visible.map(row => row.patientId).join(",") === "p_3" && monitor.riskIaas === 1 && monitor.pendingSync === 1, "monitorService debe calcular visibles y metricas locales sin consulta por tecla.");

if (failures.length) {
  console.error(`EPIVIDA Lite patient filter validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite patient filter validation OK");

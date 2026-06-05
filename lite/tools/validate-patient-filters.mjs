const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const { filterPatients, patientFilterText, uniqueValues } = await import("../src/services/patientService.js");

const patients = [
  {
    patientId: "p_1",
    patientName: "Ana Perez",
    service: "MEDICINA INTERNA",
    bed: "12",
    status: "GRAVE",
    sex: "F",
    hospitalDiagnosis: "Neumonia"
  },
  {
    patientId: "p_2",
    patientName: "Luis Gomez",
    currentService: "PEDIATRIA",
    currentBed: "67",
    currentState: "ESTABLE",
    sex: "M",
    currentDiagnosis: "Bronquiolitis"
  }
];

requireValue(filterPatients(patients, { query: "neumonia" }).map(row => row.patientId).join(",") === "p_1", "Busqueda debe encontrar diagnostico hospitalario.");
requireValue(filterPatients(patients, { service: "PEDIATRIA" }).map(row => row.patientId).join(",") === "p_2", "Filtro de servicio debe usar currentService.");
requireValue(filterPatients(patients, { status: "ESTABLE", sex: "M" }).map(row => row.patientId).join(",") === "p_2", "Filtros de estado y sexo deben combinarse.");

const before = patientFilterText(patients[0]);
patients[0].hospitalDiagnosis = "Sepsis";
const after = patientFilterText(patients[0]);
requireValue(before.includes("neumonia") && after.includes("sepsis"), "Cache de busqueda debe invalidarse cuando cambia la firma clinica.");
requireValue(uniqueValues(patients, "service").includes("MEDICINA INTERNA") && uniqueValues(patients, "service").includes("PEDIATRIA"), "uniqueValues debe leer service y currentService.");

if (failures.length) {
  console.error(`EPIVIDA Lite patient filter validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite patient filter validation OK");

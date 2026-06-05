const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const {
  bedBoardItems,
  filterAndSortRoundPatients,
  knownBedsForService,
  normalizeRoundText,
  normalizeServiceKey,
  roundPatientSearchText
} = await import("../src/modules/ronda-paquetes/roundHelpers.js");

const patients = [
  {
    patientId: "p_mi_02",
    patientName: "Maria Lopez",
    service: "MI",
    bed: "2",
    currentDiagnosis: "Neumonia adquirida",
    active: true
  },
  {
    patientId: "p_mi_01",
    patientName: "Jose Garcia",
    currentService: "Medicina Interna",
    currentBed: "1",
    hospitalDiagnosis: "Cateter venoso central",
    active: true
  },
  {
    patientId: "p_uip_01",
    patientName: "Paciente Pediatrico",
    service: "UTIP",
    bed: "UTIP 1",
    currentDiagnosis: "Ventilacion mecanica",
    active: true
  },
  {
    patientId: "p_inactive",
    patientName: "Paciente Egresado",
    service: "Medicina Interna",
    bed: "3",
    active: false
  }
];

requireValue(normalizeRoundText("  cateter venoso central  ") === "CATETER VENOSO CENTRAL", "normalizeRoundText debe quitar espacios, acentos y normalizar mayusculas.");
requireValue(normalizeServiceKey("MI") === "MEDICINA INTERNA", "MI debe mapearse a Medicina Interna.");
requireValue(normalizeServiceKey("UTIP") === "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS", "UTIP debe mapearse a UCIP/UTIP legacy.");
requireValue(knownBedsForService("MI").includes("30"), "Camas conocidas de MI deben estar disponibles para movimientos de cama.");

const miRows = filterAndSortRoundPatients(patients, { service: "MEDICINA INTERNA", query: "" });
requireValue(miRows.map(row => row.patientId).join(",") === "p_mi_01,p_mi_02", "Filtro de Medicina Interna debe excluir inactivos y ordenar por cama.");

const queryRows = filterAndSortRoundPatients(patients, { service: "Todos", query: "cateter" });
requireValue(queryRows.length === 1 && queryRows[0].patientId === "p_mi_01", "Busqueda debe normalizar acentos y encontrar diagnostico.");

const searchTextBefore = roundPatientSearchText(patients[0]);
patients[0].currentDiagnosis = "Neumonia nosocomial";
const searchTextAfter = roundPatientSearchText(patients[0]);
requireValue(searchTextBefore.includes("ADQUIRIDA") && searchTextAfter.includes("NOSOCOMIAL"), "Cache de busqueda por paciente debe invalidarse si cambia la firma clinica.");

const bedBoard = bedBoardItems(miRows, "MEDICINA INTERNA");
const occupiedBeds = bedBoard.filter(item => item.patient).map(item => `${item.bed}:${item.patient.patientId}`);
requireValue(occupiedBeds.includes("1:p_mi_01") && occupiedBeds.includes("2:p_mi_02"), "Mapa de camas debe conservar pacientes en camas ocupadas.");
requireValue(bedBoard.some(item => item.bed === "30" && !item.patient), "Mapa de Medicina Interna debe incluir camas conocidas vacias.");

if (failures.length) {
  console.error(`EPIVIDA Lite round helper validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite round helper validation OK");

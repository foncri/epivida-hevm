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
  roundPatientSearchText,
  upsertOrRemovePatient
} = await import("../src/modules/ronda-paquetes/roundHelpers.js");
const {
  daysBetween,
  deviceActiveOnDate,
  isCvcDevice,
  isFoleyDevice,
  isNavDevice,
  isSurgicalSignal,
  navigationPatientId,
  statusLabel,
  syncLabel,
  truncate
} = await import("../src/modules/ronda-paquetes/roundPatientUtils.js");
const { bedTileState } = await import("../src/modules/ronda-paquetes/bedBoard.js");
const { peSummaryItems, preventiveHistoryRounds, roundReviewDate, savedRoundActionLines, upsertRoundById } = await import("../src/modules/ronda-paquetes/patientRoundPanels.js");
const { ensurePatientActionDraft, patientMovementChanged } = await import("../src/modules/ronda-paquetes/preventiveForms.js");
const { draftFromRound, reviewDraft, roundState } = await import("../src/modules/ronda-paquetes/saveRoundFlow.js");
const { normalizeDate, validIsoDate } = await import("../src/lib/date.js");

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
const updatedRows = upsertOrRemovePatient(miRows, { ...patients[0], bed: "4" });
requireValue(updatedRows.some(row => row.patientId === "p_mi_02" && row.bed === "4"), "upsertOrRemovePatient debe actualizar paciente activo en memoria.");
requireValue(!upsertOrRemovePatient(miRows, { ...patients[0], active: false }).some(row => row.patientId === "p_mi_02"), "upsertOrRemovePatient debe retirar de la lista si el paciente queda inactivo.");

const searchTextBefore = roundPatientSearchText(patients[0]);
patients[0].currentDiagnosis = "Neumonia nosocomial";
const searchTextAfter = roundPatientSearchText(patients[0]);
requireValue(searchTextBefore.includes("ADQUIRIDA") && searchTextAfter.includes("NOSOCOMIAL"), "Cache de busqueda por paciente debe invalidarse si cambia la firma clinica.");

const bedBoard = bedBoardItems(miRows, "MEDICINA INTERNA");
const occupiedBeds = bedBoard.filter(item => item.patient).map(item => `${item.bed}:${item.patient.patientId}`);
requireValue(occupiedBeds.includes("1:p_mi_01") && occupiedBeds.includes("2:p_mi_02"), "Mapa de camas debe conservar pacientes en camas ocupadas.");
requireValue(bedBoard.some(item => item.bed === "30" && !item.patient), "Mapa de Medicina Interna debe incluir camas conocidas vacias.");
requireValue(navigationPatientId(patients[0], patients, "previous") === "p_mi_01", "Navegacion previa debe calcularse desde datos, no desde DOM.");
requireValue(daysBetween("2026-06-01", "2026-06-04") === 3, "daysBetween debe calcular dias de estancia por fecha ISO.");
requireValue(validIsoDate("2026-06-04") && normalizeDate("04/06/2026") === "2026-06-04", "date.js debe aceptar fechas reales ISO y dd/mm/yyyy.");
requireValue(!validIsoDate("2026-13-01") && normalizeDate("2026-02-31") === "" && normalizeDate("31/02/2026") === "", "date.js debe rechazar fechas imposibles para proteger rutas de ronda.");
requireValue(truncate("ABCDEFGHIJ", 5) === "ABCD...", "truncate debe limitar texto sin romper tablas.");
requireValue(statusLabel("reviewed") === "Revisado" && syncLabel("local_pending") === "Pendiente sync", "Labels de ronda deben conservar textos visibles.");
requireValue(isCvcDevice({ deviceType: "PICC" }), "PICC debe contar como dispositivo CVC/ITS.");
requireValue(isFoleyDevice({ preventivePackage: "ITU - CU" }), "Paquete ITU-CU debe contar como Foley.");
requireValue(isNavDevice({ deviceType: "CET" }), "CET debe contar como NAVM.");
requireValue(deviceActiveOnDate({ installationDate: "2026-06-01", removalDate: "2026-06-05" }, "2026-06-04"), "Dispositivo debe estar activo dentro del rango.");
requireValue(isSurgicalSignal({ hospitalDiagnosis: "Post operatorio por fractura" }), "Diagnostico quirurgico debe activar senal ISQ.");
requireValue(bedTileState({ patientId: "p_mi_01" }, new Map([["p_mi_01", { status: "reviewed" }]])).status === "reviewed", "Estado de cama revisada debe vivir en bedBoard.js.");

const app = { state: { moduleState: {} } };
const local = roundState(app);
const draft = reviewDraft(local, "2026-06-04", "p_mi_01", {
  roundId: "r_1",
  patientId: "p_mi_01",
  date: "2026-06-04",
  status: "reviewed",
  packageReviews: [{ packageType: "ITS - CC", preventiveChecks: { handHygiene: "SI" } }]
});
requireValue(local.drafts["2026-06-04:p_mi_01"] === draft, "roundState y reviewDraft deben administrar drafts fuera del orquestador principal.");
requireValue(draft.deviceDrafts.length === 1 && draft.deviceDrafts[0].packageType === "ITS - CC", "draftFromRound debe reconstruir revisiones preventivas guardadas.");
requireValue(draftFromRound(null, "2026-06-04", "p_new").quickDischarge.enabled === false, "draftFromRound debe crear draft vacio seguro.");

const actionDraft = {};
ensurePatientActionDraft(actionDraft, patients[0], "2026-06-04");
requireValue(actionDraft.patientMovement.service === "MI" && actionDraft.patientMovement.bed === "2", "preventiveForms debe inicializar movimiento desde servicio/cama actuales.");
requireValue(actionDraft.quickDischarge.enabled === false && actionDraft.quickDischarge.date === "2026-06-04", "preventiveForms debe inicializar alta rapida desactivada y fechada.");
requireValue(!patientMovementChanged(patients[0], actionDraft.patientMovement), "Movimiento sin dirty flag no debe marcar cambio de cama.");
actionDraft.patientMovement._dirty = true;
actionDraft.patientMovement.bed = "4";
requireValue(patientMovementChanged(patients[0], actionDraft.patientMovement), "Cambio de cama preparado debe detectarse sin consultar DOM.");

const sortedRounds = upsertRoundById([
  { roundId: "old", patientId: "p_mi_01", date: "2026-06-01" },
  { roundId: "new", patientId: "p_mi_01", roundDate: "2026-06-05" }
]);
requireValue(sortedRounds[0].roundId === "new" && roundReviewDate(sortedRounds[0]) === "2026-06-05", "patientRoundPanels debe ordenar historial preventivo por fecha descendente.");
requireValue(preventiveHistoryRounds([{ roundId: "empty" }, { roundId: "with_notes", date: "2026-06-02", notes: "Nota" }]).length === 1, "Historial preventivo debe ocultar rondas vacias.");
requireValue(savedRoundActionLines({
  patientMovement: { fromService: "MI", fromBed: "1", toService: "MI", toBed: "2" },
  quickDischarge: { enabled: true, date: "2026-06-04", type: "MEJORIA", shift: "MATUTINO" },
  generalObservations: "Observacion de prueba"
}).length === 3, "Paneles de paciente deben conservar acciones guardadas de movimiento, alta y observaciones.");
const peItems = peSummaryItems("p_mi_01", "2026-06-04", [{
  patientId: "p_mi_01",
  date: "2026-06-03",
  packageReviews: [{ packageType: "P.E. Y P.B.M.T.", preventiveChecks: { handHygiene: "SI" } }]
}], {
  deviceDrafts: [{ packageType: "P.E. Y P.B.M.T.", draftId: "draft_pe", preventiveChecks: { handHygiene: "NO" } }]
});
requireValue(peItems.length === 2 && peItems[0].source === "draft", "Resumen PE/PBMT debe combinar historial guardado y captura actual.");

if (failures.length) {
  console.error(`EPIVIDA Lite round helper validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite round helper validation OK");

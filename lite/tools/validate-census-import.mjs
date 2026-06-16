const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const { parseCensusInput } = await import("../src/services/importService.js");
const { CENSUS_REPAIR_VERSION, repairedHospitalCensusTsv, repairHospitalCensusInput } = await import("../src/services/censusRepairService.js");
const { canArchiveAbsentPatient, reconcileCensusRows } = await import("../src/services/reconciliationService.js");

const input = [
  "Paciente\tServicio\tCama\tEdad\tSexo\tDx epidemiologico\tDiagnostico hospitalario\tFecha ingreso",
  "Ana Perez\tMedicina Interna\tCama 12\t45\tF\tRiesgo IAAS\tNeumonia\t01/06/2026",
  "Ana Perez\tMedicina Interna\tCama 12\t45\tF\tRiesgo IAAS\tNeumonia\t01/06/2026",
  "Luis Gomez\tUCI Adultos\tUCIA 2\t61\tM\tNO IAAS\tEVC\t2026-06-02"
].join("\n");

const parsed = parseCensusInput(input);
requireValue(parsed.rows.length === 3, "Parser debe leer 3 filas de censo.");
requireValue(parsed.rows[0].service === "MEDICINA INTERNA", "Parser debe normalizar servicio.");
requireValue(parsed.rows[0].bed === "12", "Parser debe normalizar cama.");
requireValue(parsed.rows[0].sex === "F", "Parser debe normalizar sexo.");
requireValue(parsed.rows[0].epidemiologicalDiagnosis === "RIESGO IAAS", "Parser debe normalizar diagnostico epidemiologico.");
requireValue(parsed.rows[0].admissionDate === "2026-06-01", "Parser debe normalizar fechas dd/mm/yyyy.");

const locationInput = [
  "Paciente\tServicio/Cama\tEdad\tSexo\tDx epidemiologico",
  "Paciente Urgencias\tAIS P 4\t30\tF\tNO IAAS",
  "Paciente Hemo\tHEM 12\t70\tM\tRIESGO IAAS",
  "Paciente Onco\tONCO 7\t55\tF\tNO IAAS"
].join("\n");
const locationParsed = parseCensusInput(locationInput);
requireValue(locationParsed.rows[0].service === "URGENCIAS", "Parser debe inferir URGENCIAS desde AIS P.");
requireValue(locationParsed.rows[1].service === "HEMODIALISIS", "Parser debe inferir HEMODIALISIS desde cama HEM.");
requireValue(locationParsed.rows[2].service === "ONCOLOGIA", "Parser debe inferir ONCOLOGIA desde cama ONCO.");

const repairedHeaderInput = [
  "CAMA\tNOMBRE DEL PACIENTE\tFECHA DE NACIMIENTO\tEDAD\tSECTOR\tRFC\tSEXO\tFECHA INGRESO\tDEIH\tESTADO CLINICO\tDX ACTUAL\tPENDIENTES",
  "AIS 1\tMaria Lopez Perez CVC instalado\t45000\t3 meses\tMAG\tLOPM900101ABC\tFemenino\t15/06/26\t2\tGrave intubado\tNeumonia asociada\tHemocultivo pendiente"
].join("\n");
const repairedHeaderParsed = parseCensusInput(repairedHeaderInput, { date: "2026-06-16", sourceName: "Medicina Interna guardia.txt" });
requireValue(repairedHeaderParsed.repaired === true, "Parser debe activar reparacion legacy cuando encabezado hospitalario carece de servicio explicito.");
requireValue(repairedHeaderParsed.repairVersion === CENSUS_REPAIR_VERSION, "Parser debe marcar version de reparacion legacy.");
requireValue(repairedHeaderParsed.rows[0].service === "MEDICINA INTERNA", "Reparacion debe inferir servicio desde nombre de archivo.");
requireValue(repairedHeaderParsed.rows[0].bed === "AIS 1 MI", "Reparacion debe conservar AIS/OBS con sufijo del servicio.");
requireValue(repairedHeaderParsed.rows[0].patientName === "MARIA LOPEZ PEREZ", "Reparacion debe limpiar dispositivos pegados al nombre.");
requireValue(repairedHeaderParsed.rows[0].birthDate === "2023-03-15", "Reparacion debe aceptar serial Excel de fecha.");
requireValue(repairedHeaderParsed.rows[0].admissionDate === "2026-06-15", "Reparacion debe expandir anio de dos digitos por calendario actual.");
requireValue(repairedHeaderParsed.rows[0].age === "3 meses", "Reparacion debe conservar edad neonatal/pediatrica en meses.");
requireValue(repairedHeaderParsed.rows[0].sector === "MAGISTERIO", "Reparacion debe normalizar sector derechohabiente.");
requireValue(repairedHeaderParsed.rows[0].rfc === "LOPM900101ABC", "Reparacion debe preservar RFC/afiliacion como identificador hospitalario.");
requireValue(repairedHeaderParsed.rows[0].status === "GRAVE INTUBADO", "Reparacion debe conservar estados clinicos intubados.");

const repairedSignalInput = [
  "SERVICIO: URGENCIAS\tFECHA 16/06/2026",
  "Cama\tPaciente\tNacimiento\tSexo\tIngreso\tDx actual\tPendientes",
  "F1\tJose Ramirez Diaz\t01/01/1980\tMasculino\t15/06/2026\tTrauma craneoencefalico\tTAC pendiente",
  "UX2\tLuisa Ramos Soto\t02/02/1990\tF\t16/06/2026\tDolor abdominal\tValoracion cirugia"
].join("\n");
const repairedSignal = repairHospitalCensusInput(repairedSignalInput, { date: "2026-06-16", sourceName: "urgencias.tsv" });
requireValue(repairedSignal.attempted === true && repairedSignal.rows.length === 2, "Reparador debe leer censo hospitalario con filas guia y servicio contextual.");
requireValue(repairedSignal.rows[0].service === "URGENCIAS" && repairedSignal.rows[0].bed === "F1", "Reparador debe inferir camas de urgencias.");
requireValue(repairedSignal.rows[1].hospitalDiagnosis === "Dolor abdominal", "Reparador debe conservar diagnostico actual.");

const repairedTsv = repairedHospitalCensusTsv(repairedSignalInput, { date: "2026-06-16", sourceName: "urgencias.tsv" });
requireValue(repairedTsv.text.startsWith("Servicio\tCama\tPaciente"), "Reparador debe poder emitir TSV canonico compatible con el importador Lite.");

const active = [
  {
    patientId: "p_ana",
    patientName: "Ana Perez",
    normalizedPatientName: "ANA PEREZ",
    service: "PEDIATRIA",
    bed: "7",
    sex: "F",
    admissionDate: "2026-06-01",
    active: true
  },
  {
    patientId: "p_absent",
    patientName: "Paciente Ausente",
    normalizedPatientName: "PACIENTE AUSENTE",
    service: "CIRUGIA Y TRAUMATOLOGIA",
    bed: "18",
    active: true
  },
  {
    patientId: "p_hemo_absent",
    patientName: "Paciente Hemo Ausente",
    normalizedPatientName: "PACIENTE HEMO AUSENTE",
    service: "HEMODIALISIS",
    bed: "HEM 3",
    active: true
  }
];

const preview = reconcileCensusRows(parsed.rows, active);
requireValue(preview.summary.totalRows === 3, "Conciliacion debe conservar totalRows.");
requireValue(preview.summary.changedPatients === 1, "Conciliacion debe detectar paciente movido/actualizado.");
requireValue(preview.summary.newPatients === 1, "Conciliacion debe detectar paciente nuevo.");
requireValue(preview.summary.duplicateRows === 1, "Conciliacion debe detectar duplicado.");
requireValue(preview.summary.absentPatients === 2, "Conciliacion debe detectar ausentes.");
requireValue(preview.entries.some(entry => entry.patientId === "p_ana" && entry.changes.some(change => change.includes("servicio"))), "Paciente existente debe conservar patientId y cambios.");
requireValue(preview.absent.some(item => item.patientId === "p_absent" && item.canArchive === true), "Ausente no protegido debe ser archivable.");
requireValue(preview.absent.some(item => item.patientId === "p_hemo_absent" && item.canArchive === false), "Ausente de hemodialisis debe quedar protegido para revision.");
requireValue(canArchiveAbsentPatient({ service: "ONCOLOGIA", active: true }) === false, "Oncologia ausente no debe archivarse automaticamente.");

if (failures.length) {
  console.error(`EPIVIDA Lite census import validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite census import validation OK");

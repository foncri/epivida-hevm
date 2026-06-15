const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const { parseCensusInput } = await import("../src/services/importService.js");
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

const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const { parseCensusInput } = await import("../src/services/importService.js");
const { reconcileCensusRows } = await import("../src/services/reconciliationService.js");

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
  }
];

const preview = reconcileCensusRows(parsed.rows, active);
requireValue(preview.summary.totalRows === 3, "Conciliacion debe conservar totalRows.");
requireValue(preview.summary.changedPatients === 1, "Conciliacion debe detectar paciente movido/actualizado.");
requireValue(preview.summary.newPatients === 1, "Conciliacion debe detectar paciente nuevo.");
requireValue(preview.summary.duplicateRows === 1, "Conciliacion debe detectar duplicado.");
requireValue(preview.summary.absentPatients === 1, "Conciliacion debe detectar ausente.");
requireValue(preview.entries.some(entry => entry.patientId === "p_ana" && entry.changes.some(change => change.includes("servicio"))), "Paciente existente debe conservar patientId y cambios.");
requireValue(preview.absent[0].patientId === "p_absent", "Ausente debe conservar patientId activo.");

if (failures.length) {
  console.error(`EPIVIDA Lite census import validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite census import validation OK");

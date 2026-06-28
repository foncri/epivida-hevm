const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const { parseCensusInput } = await import("../src/services/importService.js");
const { spreadsheetBufferToTsv } = await import("../src/services/excelImportService.js");
const { CENSUS_REPAIR_VERSION, repairedHospitalCensusTsv, repairHospitalCensusInput, repairUrgenciasAisPImportText } = await import("../src/services/censusRepairService.js");
const { canArchiveAbsentPatient, extractReportedDischarge, reconcileCensusRows, resolveImportScope } = await import("../src/services/reconciliationService.js");

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

const quotedCsvInput = [
  "Paciente,Servicio,Cama,Edad,Sexo,Dx epidemiologico,Diagnostico hospitalario,Fecha ingreso,Observaciones",
  "\"Paciente, Con Coma\",Medicina Interna,\"Cama 14\",58,F,Riesgo IAAS,\"Neumonia, probable\",17/06/2026,\"Alta por mejoria 18/06/2026\""
].join("\n");
const quotedCsvParsed = parseCensusInput(quotedCsvInput, { date: "2026-06-17", sourceName: "censo.csv" });
requireValue(quotedCsvParsed.delimiter === "," && quotedCsvParsed.rows.length === 1, "Parser CSV debe soportar comillas y comas embebidas.");
requireValue(quotedCsvParsed.rows[0].patientName === "Paciente, Con Coma", "Parser CSV debe preservar nombre con coma entre comillas.");
requireValue(quotedCsvParsed.rows[0].hospitalDiagnosis === "Neumonia, probable", "Parser CSV debe preservar diagnostico con coma entre comillas.");
requireValue(quotedCsvParsed.rows[0].observations.includes("Alta por mejoria"), "Parser CSV debe conservar observaciones entre comillas.");

const legacyAliasInput = [
  "patient_name\tservicio_cama\tedad\tgenero\triesgo_iaas\tfecha_ingreso\tdx_ingreso\tdiagnostico_actual\tobservaciones_pendientes\tpendientes",
  "Paciente Alias\tCirugia y Traumatologia / OBS 2\t63\tF\tRIESGO IAAS\t17/06/2026\tDiabetes descontrolada\tNeumonia actual\tLaboratorio pendiente\tAlta probable 18/06/2026"
].join("\n");
const legacyAliasParsed = parseCensusInput(legacyAliasInput, { date: "2026-06-18", sourceName: "legacy_alias.tsv" });
requireValue(legacyAliasParsed.rows.length === 1, "Parser debe aceptar encabezados tecnicos legacy del runtime antiguo.");
requireValue(legacyAliasParsed.rows[0].patientName === "Paciente Alias", "Alias patient_name debe mapear nombre del paciente.");
requireValue(legacyAliasParsed.rows[0].service === "CIRUGIA Y TRAUMATOLOGIA" && legacyAliasParsed.rows[0].bed === "OBS 2 CX", "Alias servicio_cama debe dividir servicio y cama con sufijo canonico.");
requireValue(legacyAliasParsed.rows[0].epidemiologicalDiagnosis === "RIESGO IAAS", "Alias riesgo_iaas debe normalizar diagnostico epidemiologico.");
requireValue(legacyAliasParsed.rows[0].hospitalDiagnosis.includes("Diabetes descontrolada") && legacyAliasParsed.rows[0].hospitalDiagnosis.includes("Neumonia actual"), "Diagnosticos duplicados legacy deben fusionarse sin sobrescribir.");
requireValue(legacyAliasParsed.rows[0].observations.includes("Laboratorio pendiente") && legacyAliasParsed.rows[0].observations.includes("Alta probable"), "Observaciones y pendientes legacy deben fusionarse sin sobrescribir.");

const spreadsheetBuffer = await buildSpreadsheetBuffer([
  ["Paciente", "Servicio", "Cama", "Edad", "Sexo", "Dx epidemiologico", "Fecha ingreso", "Pendientes"],
  ["Excel Uno", "Medicina Interna", "Cama 10", "52", "F", "Riesgo IAAS", "01/06/2026", "Alta por traslado 18/06/2026"],
  ["Excel Dos", "Hemodialisis", "HEM 4", "70", "M", "NO IAAS", "02/06/2026", ""]
]);
const spreadsheetTsv = await spreadsheetBufferToTsv(spreadsheetBuffer);
const spreadsheetParsed = parseCensusInput(spreadsheetTsv, { date: "2026-06-20", sourceName: "censo.xlsx" });
requireValue(spreadsheetParsed.rows.length === 2, "Importador Excel debe convertir la primera hoja a filas TSV reutilizables.");
requireValue(spreadsheetParsed.rows[0].patientName === "Excel Uno", "Importador Excel debe conservar nombres de pacientes.");
requireValue(spreadsheetParsed.rows[0].service === "MEDICINA INTERNA" && spreadsheetParsed.rows[0].bed === "10", "Importador Excel debe reutilizar normalizacion de servicio/cama.");
requireValue(spreadsheetParsed.rows[0].admissionDate === "2026-06-01", "Importador Excel debe preservar fechas para normalizacion clinica.");
requireValue(spreadsheetParsed.rows[1].service === "HEMODIALISIS", "Importador Excel debe conservar servicios protegidos.");

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

const pediatricHeaderInput = [
  "SERVICIO: PEDIATRIA\tGUARDIA 17/06/2026",
  "CAMA/SILLON\tNOMBRE\tFECHA NAC.\tEDAD\tSECTOR\tAFILIACION\tSEX\tF. INGRESO\tEIH\tESTADO DE SALUD\tDX INGRESO\tDX ACTUAL\tOBSERVACIONES",
  "CUN 2\tBebe Uno Test\t16/06/2026\t1 dia\tPIM\tAF123\tF\t17/06/2026\t0\tDelicado\tPrematurez\tSepsis neonatal\tTamiz pendiente",
  "UCIN 3\tBebe Dos Test\t01/06/2026\t16 dias\tMAG\tAF456\tM\t16/06/2026\t1\tMuy grave intubado\tSDR\tNeumonia neonatal\tRX pendiente"
].join("\n");
const pediatricParsed = parseCensusInput(pediatricHeaderInput, { date: "2026-06-17", sourceName: "Pediatria guardia.txt" });
requireValue(pediatricParsed.repaired === true && pediatricParsed.rows.length === 2, "Reparacion debe cubrir formato pediatrico/neonatal con encabezados abreviados.");
requireValue(pediatricParsed.rows[0].service === "CUNEROS" && pediatricParsed.rows[0].bed === "CUN 2", "Reparacion pediatrica debe inferir CUNEROS desde cama CUN.");
requireValue(pediatricParsed.rows[1].service === "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES" && pediatricParsed.rows[1].bed === "UCIN 3", "Reparacion pediatrica debe inferir UCIN desde cama UCIN.");
requireValue(pediatricParsed.rows[0].age === "1 dia" && pediatricParsed.rows[1].age === "16 dias", "Reparacion pediatrica debe conservar edades en dias.");
requireValue(pediatricParsed.rows[0].hospitalDiagnosis.includes("Prematurez") && pediatricParsed.rows[0].hospitalDiagnosis.includes("Sepsis neonatal"), "Reparacion debe conservar DX ingreso y DX actual cuando ambos existen.");
requireValue(pediatricParsed.rows[1].status === "MUY GRAVE INTUBADO", "Reparacion pediatrica debe conservar estado intubado.");

const gyoHeaderInput = [
  "SERVICIO: GYO\tFECHA 17/06/2026",
  "CAMA\tPACIENTE\tNACIMIENTO\tEDAD\tSEXO\tINGRESO\tDX ACTUAL\tPENDIENTES",
  "ALOJ 4\tMama Uno Test\t01/01/1995\t31\tF\t16/06/2026\tPuerperio quirurgico\tAlta probable 18/06/2026",
  "OBS 2\tMama Dos Test\t01/01/1990\t36\tF\t17/06/2026\tPreeclampsia severa\tVigilar TA"
].join("\n");
const gyoParsed = parseCensusInput(gyoHeaderInput, { date: "2026-06-17", sourceName: "GYO guardia.txt" });
requireValue(gyoParsed.repaired === true && gyoParsed.rows.length === 2, "Reparacion debe cubrir formato GYO con servicio abreviado.");
requireValue(gyoParsed.rows.every(row => row.service === "GINECOLOGIA Y OBSTETRICIA"), "GYO debe normalizarse a GINECOLOGIA Y OBSTETRICIA.");
requireValue(gyoParsed.rows[0].bed === "ALOJ 4" && gyoParsed.rows[1].bed === "OBS 2 GYO", "GYO debe conservar ALOJ y sufijar OBS con servicio.");

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

const aispBrokenInput = [
  "AISLADO P\tCarlos Morales Vega",
  "\t01/03/1988\tAIMC880301H1\t38\tMasculino\t16/06/2026\tCrisis hipertensiva\tLaboratorio pendiente"
].join("\n");
const aispPrepared = repairUrgenciasAisPImportText(aispBrokenInput);
requireValue(aispPrepared.startsWith("URGENCIAS\nAIS P\tCarlos Morales Vega"), "Fix Urgencias/AISP debe insertar contexto URGENCIAS y normalizar AISLADO P.");
const aispParsed = parseCensusInput(aispBrokenInput, { date: "2026-06-16", sourceName: "guardia.txt" });
requireValue(aispParsed.repaired === true, "Parser debe activar reparacion para AISP legado con fila partida.");
requireValue(aispParsed.issues.some(issue => issue.includes("Urgencias/AIS P")), "Parser debe informar reparacion Urgencias/AIS P.");
requireValue(aispParsed.rows.length === 1, "AISP partido debe producir un solo paciente.");
requireValue(aispParsed.rows[0].service === "URGENCIAS", "AISP partido debe importar como URGENCIAS.");
requireValue(aispParsed.rows[0].bed === "AIS P", "AISP partido debe conservar cama AIS P canonica.");
requireValue(aispParsed.rows[0].patientName === "CARLOS MORALES VEGA", "AISP partido debe conservar nombre del paciente.");
requireValue(aispParsed.rows[0].birthDate === "1988-03-01", "AISP partido debe leer fecha de nacimiento de continuacion.");
requireValue(aispParsed.rows[0].rfc === "AIMC880301H1", "AISP partido debe conservar RFC aun cuando venia antes de edad.");
requireValue(String(aispParsed.rows[0].age) === "38", "AISP partido debe reordenar edad/RFC legado.");
requireValue(aispParsed.rows[0].sex === "M", "AISP partido debe leer sexo de continuacion.");
requireValue(aispParsed.rows[0].admissionDate === "2026-06-16", "AISP partido debe leer ingreso de continuacion.");
requireValue(aispParsed.rows[0].hospitalDiagnosis === "Crisis hipertensiva", "AISP partido debe conservar diagnostico de continuacion.");

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
requireValue(preview.summary.importScope === "full", "Conciliacion automatica debe tratar censo con cobertura suficiente como completo.");
requireValue(preview.summary.changedPatients === 1, "Conciliacion debe detectar paciente movido/actualizado.");
requireValue(preview.summary.newPatients === 1, "Conciliacion debe detectar paciente nuevo.");
requireValue(preview.summary.duplicateRows === 1, "Conciliacion debe detectar duplicado.");
requireValue(preview.summary.absentPatients === 2, "Conciliacion debe detectar ausentes.");
requireValue(preview.entries.some(entry => entry.patientId === "p_ana" && entry.changes.some(change => change.includes("servicio"))), "Paciente existente debe conservar patientId y cambios.");
requireValue(preview.entries.some(entry => entry.patientId === "p_ana" && entry.row.importAlerts?.some(message => message.includes("MOVIDO"))), "Movimiento de servicio/cama debe dejar alerta importable visible.");
requireValue(preview.absent.some(item => item.patientId === "p_absent" && item.canArchive === true && item.probableDischarge === true && item.hospitalizationStatus === "alta_probable"), "Ausente no protegido debe quedar como alta probable revisable.");
requireValue(preview.absent.some(item => item.patientId === "p_hemo_absent" && item.canArchive === false && item.reason === "protected_service_review_required"), "Ausente de hemodialisis debe quedar protegido para revision.");
requireValue(canArchiveAbsentPatient({ service: "ONCOLOGIA", active: true }) === false, "Oncologia ausente no debe archivarse automaticamente.");

const conflictInput = [
  "Paciente\tServicio\tCama\tEdad\tSexo\tDiagnostico hospitalario\tObservaciones",
  "Paciente Conflicto\tMedicina Interna\tCama 5\t50\tF\tNeumonia\t",
  "Paciente Conflicto\tMedicina Interna\tCama 6\t50\tF\tNeumonia con oxigeno\tLaboratorio pendiente"
].join("\n");
const conflictParsed = parseCensusInput(conflictInput, { date: "2026-06-20" });
const conflictPreview = reconcileCensusRows(conflictParsed.rows, [], { date: "2026-06-20" });
const keptConflict = conflictPreview.entries.find(entry => entry.conflict && !entry.duplicate);
requireValue(conflictPreview.summary.conflictRows === 1, "Conciliacion debe contar conflicto de mismo paciente en dos ubicaciones.");
requireValue(conflictPreview.summary.duplicateRows === 1, "Conciliacion debe omitir la fila menos completa del conflicto.");
requireValue(keptConflict?.action === "conflict" && keptConflict.row.bed === "6", "Conflicto debe conservar la fila mas completa para guardar.");
requireValue(keptConflict.row.importAlerts?.some(message => message.includes("dos ubicaciones")), "Conflicto debe dejar alerta importable visible para preview/auditoria.");

const duplicateExistingActive = [
  { patientId: "p_dup_keep", hospitalInternalId: "DUP001", patientName: "Paciente Duplicado", service: "MEDICINA INTERNA", bed: "4", active: true },
  { patientId: "p_dup_close", hospitalInternalId: "DUP001", patientName: "Paciente Duplicado", service: "CIRUGIA Y TRAUMATOLOGIA", bed: "12", active: true }
];
const duplicateExistingInput = [
  "Paciente\tExpediente\tServicio\tCama\tEdad\tSexo\tDiagnostico hospitalario",
  "Paciente Duplicado\tDUP001\tMedicina Interna\tCama 4\t50\tF\tNeumonia"
].join("\n");
const duplicateExistingParsed = parseCensusInput(duplicateExistingInput, { date: "2026-06-20" });
const duplicateExistingPreview = reconcileCensusRows(duplicateExistingParsed.rows, duplicateExistingActive, { date: "2026-06-20" });
const duplicateExistingEntry = duplicateExistingPreview.entries[0];
requireValue(duplicateExistingPreview.summary.duplicateExistingRows === 1, "Conciliacion debe detectar duplicado activo existente con mismo identificador hospitalario.");
requireValue(duplicateExistingPreview.duplicateExisting?.[0]?.patientId === "p_dup_close", "Conciliacion debe separar el registro activo duplicado para revision.");
requireValue(duplicateExistingEntry.duplicateExisting?.[0]?.patientId === "p_dup_close", "Preview de fila debe mostrar duplicado activo relacionado.");
requireValue(duplicateExistingEntry.row.importAlerts?.some(message => message.includes("duplicado")), "Fila importada debe advertir duplicado activo existente.");

const protectedAmbulatoryActive = [
  { patientId: "p_hd_keep", hospitalInternalId: "HD001", patientName: "Paciente Protegido", service: "HEMODIALISIS", currentService: "HEMODIALISIS", bed: "HEM 4", currentBed: "HEM 4", active: true, hospitalizationStatus: "ambulatorio" }
];
const protectedAmbulatoryInput = [
  "Paciente\tExpediente\tServicio\tCama\tEdad\tSexo\tDiagnostico hospitalario",
  "Paciente Protegido\tHD001\tMedicina Interna\tCama 8\t61\tM\tNeumonia"
].join("\n");
const protectedAmbulatoryParsed = parseCensusInput(protectedAmbulatoryInput, { date: "2026-06-20" });
const protectedAmbulatoryPreview = reconcileCensusRows(protectedAmbulatoryParsed.rows, protectedAmbulatoryActive, { date: "2026-06-20" });
const protectedCarry = protectedAmbulatoryPreview.entries.find(entry => entry.patientId === "p_hd_keep");
const protectedCompanion = protectedAmbulatoryPreview.entries.find(entry => entry.patientId === "p_hd_keep__hospital");
requireValue(protectedAmbulatoryPreview.entries.length === 2, "Conciliacion debe conservar registro protegido y agregar estancia hospitalaria acompanante.");
requireValue(protectedCarry?.row.service === "HEMODIALISIS" && protectedCarry.row.bed === "HEM 4", "Registro protegido no debe moverse a servicio hospitalario.");
requireValue(protectedCompanion?.row.ambulatoryCompanion === true && protectedCompanion.row.basePatientId === "p_hd_keep", "Estancia hospitalaria debe quedar vinculada al registro protegido.");
requireValue(protectedCompanion.row.service === "HEMODIALISIS / MEDICINA INTERNA" && protectedCompanion.row.bed === "8", "Estancia acompanante debe conservar servicio protegido y hospitalario.");
requireValue(protectedCompanion.row.importAlerts?.some(message => message.includes("conserva registro")), "Estancia acompanante debe explicar la separacion protegida.");
requireValue(protectedAmbulatoryPreview.absent.length === 0, "Registro protegido conservado no debe quedar como ausente.");

const automaticDischargeActive = [
  { patientId: "p_prev_alta", patientName: "Alta Probable Vieja", service: "MEDICINA INTERNA", currentService: "MEDICINA INTERNA", bed: "5", currentBed: "5", active: true, hospitalizationStatus: "alta_probable", latestCensusDate: "2026-06-18", lastCensusDate: "2026-06-18" },
  { patientId: "p_plain_amb", patientName: "Ambulatorio Viejo", service: "AMBULATORIO", currentService: "AMBULATORIO", bed: "AMB 1", currentBed: "AMB 1", active: true, hospitalizationStatus: "ambulatorio", latestCensusDate: "2026-06-18", lastCensusDate: "2026-06-18" },
  { patientId: "p_protected_old", patientName: "Hemo Protegido", service: "HEMODIALISIS", currentService: "HEMODIALISIS", bed: "HEM 2", currentBed: "HEM 2", active: true, hospitalizationStatus: "ambulatorio", latestCensusDate: "2026-06-18", lastCensusDate: "2026-06-18" },
  { patientId: "p_present", patientName: "Paciente Presente", normalizedPatientName: "PACIENTE PRESENTE", service: "MEDICINA INTERNA", currentService: "MEDICINA INTERNA", bed: "8", currentBed: "8", sex: "F", active: true }
];
const automaticDischargeInput = [
  "Paciente\tServicio\tCama\tEdad\tSexo\tDiagnostico hospitalario",
  "Paciente Presente\tMedicina Interna\tCama 8\t44\tF\tNeumonia"
].join("\n");
const automaticDischargeParsed = parseCensusInput(automaticDischargeInput, { date: "2026-06-20" });
const automaticDischargePreview = reconcileCensusRows(automaticDischargeParsed.rows, automaticDischargeActive, { date: "2026-06-20", mode: "full" });
const automaticDischargeIds = automaticDischargePreview.automaticDischarges.map(item => item.patientId);
requireValue(automaticDischargePreview.summary.automaticDischarges === 2, "Conciliacion debe aplicar altas automaticas legacy antes del censo completo.");
requireValue(automaticDischargeIds.includes("p_prev_alta") && automaticDischargeIds.includes("p_plain_amb"), "Alta probable previa y ambulatorio simple viejo deben egresar automaticamente.");
requireValue(automaticDischargePreview.absent.length === 1 && automaticDischargePreview.absent[0].patientId === "p_protected_old", "Servicios protegidos viejos no deben egresar automaticamente.");

const manyActive = Array.from({ length: 12 }, (_, index) => ({
  patientId: `p_scope_${index}`,
  patientName: `Paciente Scope ${index}`,
  service: index % 2 ? "MEDICINA INTERNA" : "PEDIATRIA",
  bed: String(index + 1),
  active: true
}));
const partialPreview = reconcileCensusRows([parsed.rows[0]], manyActive, { mode: "auto" });
requireValue(partialPreview.summary.importScope === "partial", "Conciliacion automatica debe proteger importaciones parciales pequenas.");
requireValue(partialPreview.summary.preserveExistingPatients === true, "Importacion parcial debe conservar pacientes existentes.");
requireValue(partialPreview.summary.absentPatients === 0 && partialPreview.absent.length === 0, "Importacion parcial no debe generar ausentes falsos.");

const forcedFullPreview = reconcileCensusRows([parsed.rows[0]], manyActive, { mode: "full" });
requireValue(forcedFullPreview.summary.importScope === "full", "Conciliacion debe permitir forzar censo completo.");
requireValue(forcedFullPreview.summary.absentPatients === 12, "Censo completo forzado debe conciliar ausentes.");

const dischargeInput = [
  "Paciente\tServicio\tCama\tEdad\tSexo\tPendientes",
  "Paciente Alta\tMedicina Interna\tCama 9\t44\tF\tAlta por traslado 18/06/2026"
].join("\n");
const dischargeParsed = parseCensusInput(dischargeInput, { date: "2026-06-19" });
const dischargePreview = reconcileCensusRows(dischargeParsed.rows, [], { date: "2026-06-19" });
const dischargeEntry = dischargePreview.entries[0];
requireValue(dischargePreview.summary.reportedDischarges === 1, "Conciliacion debe contar altas reportadas en observaciones/pendientes.");
requireValue(dischargeEntry.row.dischargeReported === true, "Fila con alta reportada debe marcar dischargeReported.");
requireValue(dischargeEntry.row.dischargeReviewRequired === true, "Alta reportada debe requerir revision.");
requireValue(dischargeEntry.row.dischargeType === "TRASLADO", "Alta reportada debe inferir tipo traslado.");
requireValue(dischargeEntry.row.dischargeDate === "2026-06-18", "Alta reportada debe inferir fecha desde texto.");
requireValue(dischargeEntry.row.hospitalizationStatus === "alta_reportada", "Alta reportada debe marcar estado hospitalario.");
const extractedDischarge = extractReportedDischarge({ observations: "Defuncion 19/06/2026" }, "2026-06-20");
requireValue(extractedDischarge.type === "DEFUNCION" && extractedDischarge.date === "2026-06-19", "Extractor debe reconocer defuncion y fecha embebida.");
const resolvedPartial = resolveImportScope([parsed.rows[0]], manyActive, { mode: "auto" });
requireValue(resolvedPartial.importScope === "partial" && resolvedPartial.scopeReason === "below_full_coverage", "Resolver de alcance debe exponer razon de importacion parcial.");

if (failures.length) {
  console.error(`EPIVIDA Lite census import validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite census import validation OK");

async function buildSpreadsheetBuffer(rows) {
  const shared = [];
  const sharedIndex = new Map();
  const sharedId = value => {
    const text = String(value ?? "");
    if (!sharedIndex.has(text)) {
      sharedIndex.set(text, shared.length);
      shared.push(text);
    }
    return sharedIndex.get(text);
  };
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="s"><v>${sharedId(value)}</v></c>`).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const entries = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Censo" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map(value => `<si><t>${xmlEscape(value)}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
  };
  return zipEntries(entries);
}

async function zipEntries(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, xml] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const sourceBytes = encoder.encode(xml);
    const compressed = await deflateRaw(sourceBytes);
    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 8, true);
    localView.setUint32(18, compressed.length, true);
    localView.setUint32(22, sourceBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 8, true);
    centralView.setUint32(20, compressed.length, true);
    centralView.setUint32(24, sourceBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  return concatBytes([...locals, ...centrals, end]).buffer;
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concatBytes(parts) {
  const total = parts.reduce((sum, item) => sum + item.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

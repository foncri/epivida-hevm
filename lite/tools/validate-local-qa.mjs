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
const monitor = await import("../src/services/monitorService.js");
const router = await import("../src/router.js");
const iaasCriteriaService = await import("../src/services/iaasCriteriaService.js");
const iaasService = await import("../src/services/iaasService.js");
const expedienteService = await import("../src/services/expedienteService.js");
const excelExportService = await import("../src/services/excelExportService.js");
const excelImportService = await import("../src/services/excelImportService.js");
const importService = await import("../src/services/importService.js");
const offlineQueue = await import("../src/services/offlineQueueService.js");
const auditService = await import("../src/services/auditService.js");
const backupRestoreService = await import("../src/services/backupRestoreService.js");
const catalogService = await import("../src/services/catalogService.js");
const microbiologyAlertService = await import("../src/services/microbiologyAlertService.js");
const microbiologyDashboardService = await import("../src/services/microbiologyDashboardService.js");
const reportService = await import("../src/services/reportService.js");
const expedientePrint = await import("../src/modules/expediente/print.js");
const reconciliationService = await import("../src/services/reconciliationService.js");
const patientService = await import("../src/services/patientService.js");
const opdService = await import("../src/services/opdService.js");
const operationalAlertService = await import("../src/services/operationalAlertService.js");

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
const deviceTimeline = await auditService.listAuditForEntity("d_cvc_history_removed", { limit: 10 });
requireValue(deviceTimeline.length >= 2, "QA local debe incluir timeline auditado por episodio de dispositivo.");
requireValue(deviceTimeline.every(row => row.entityId === "d_cvc_history_removed"), "Timeline de dispositivo debe filtrar audit_logs por entityId.");
const expedienteHistory = await expedienteService.loadPatientExpediente("p_history");
const expedientePrintPreview = expedientePrint.expedientePrintModel(expedienteHistory);
requireValue(expedientePrintPreview.title === "EXPEDIENTE CLINICO-EPIDEMIOLOGICO", "Expediente debe preparar vista imprimible local sin runtime legacy.");
requireValue(expedientePrintPreview.patientId === "p_history" && expedientePrintPreview.counts.rounds >= 1, "Vista imprimible de expediente debe usar el expediente ya cargado por patientId.");
requireValue(expedientePrintPreview.sections.iaas.some(row => row.some(cell => String(cell).includes("ITS"))), "Vista imprimible de expediente debe incluir seguimiento IAAS del paciente.");
const expedienteIaas = expedienteHistory.iaasRows.find(row => row.iaasId === "iaas_history_its");
requireValue(expedienteIaas?.relatedCultures?.some(row => row.cultureId === "culture_history_01"), "Expediente debe adjuntar cultivos vinculados al caso IAAS sin lecturas globales.");
requireValue(expedienteIaas?.relatedAntimicrobials?.some(row => row.antimicrobialId === "atb_history_01"), "Expediente debe adjuntar antimicrobianos vinculados al caso IAAS sin lecturas globales.");
const expedienteIaasDaily = iaasService.iaasClinicalTimelineTable(expedienteIaas, {
  cultures: expedienteIaas?.relatedCultures,
  antimicrobials: expedienteIaas?.relatedAntimicrobials
});
requireValue(expedienteIaasDaily.rows.some(row => row.group === "CULTIVOS" && row.label.includes("Hemocultivo")), "Expediente debe poder reconstruir historial diario IAAS con cultivos vinculados.");
requireValue(expedienteIaasDaily.rows.some(row => row.group === "TRATAMIENTO" && row.label === "Vancomicina"), "Expediente debe poder reconstruir historial diario IAAS con antimicrobianos vinculados.");
const patientArchiveAuditMeta = auditService.auditEventMeta({ actionType: "patient_archive", module: "censo", entityType: "patient" });
requireValue(patientArchiveAuditMeta.auditCoverageVersion === auditService.AUDIT_COVERAGE_VERSION, "Auditoria debe versionar la cobertura de eventos criticos.");
requireValue(patientArchiveAuditMeta.auditDomain === "pacientes" && patientArchiveAuditMeta.auditOperation === "archive" && patientArchiveAuditMeta.auditSeverity === "high", "Alta/egreso de paciente debe quedar clasificado como auditoria clinica critica.");
const deviceAuditMeta = auditService.auditEventMeta({ actionType: "device_reinstallation_create", module: "dispositivos", entityType: "device" });
requireValue(deviceAuditMeta.auditDomain === "dispositivos" && deviceAuditMeta.auditOperation === "reinstall" && deviceAuditMeta.auditClinical, "Reinstalacion de dispositivo debe quedar clasificada como evento clinico auditado.");
const fallbackAuditMeta = auditService.auditEventMeta({ actionType: "custom_export", module: "reportes", entityType: "export" });
requireValue(fallbackAuditMeta.auditDomain === "reportes" && fallbackAuditMeta.auditOperation === "export", "Auditoria debe clasificar eventos nuevos con fallback seguro.");

const criticalMonitorPatient = {
  patientId: "p_monitor_critical",
  patientName: "Paciente Monitor Critico",
  service: "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS",
  bed: "UCIA 1",
  status: "MUY GRAVE INTUBADO",
  currentEpidemiologicalDiagnosis: "IAAS",
  hospitalDiagnosis: "NAVM con ventilacion mecanica, fiebre y hemocultivo pendiente",
  deih: 18
};
const deviceRiskMonitorPatient = {
  patientId: "p_monitor_device",
  patientName: "Paciente Monitor Invasivo",
  service: "MEDICINA INTERNA",
  bed: "20",
  status: "ESTABLE",
  currentEpidemiologicalDiagnosis: "NO IAAS",
  hospitalDiagnosis: "Port a cath con fiebre y cultivo pendiente",
  deih: 5
};
const criticalSeverity = monitor.monitorSeverity(criticalMonitorPatient);
const deviceRiskSeverity = monitor.monitorSeverity(deviceRiskMonitorPatient);
requireValue(criticalSeverity.level === "critica" && criticalSeverity.reasons.some(item => item.includes("ventilacion")) && criticalSeverity.reasons.some(item => item.includes("IAAS")), "Monitoreo debe priorizar estado critico/intubacion con IAAS explicita.");
requireValue(deviceRiskSeverity.level === "media" && deviceRiskSeverity.riskDevices.includes("Puerto") && monitor.monitorSeveritySummary(deviceRiskMonitorPatient).includes("Senal infecciosa"), "Monitoreo debe inferir riesgo por invasivo y senal infecciosa desde texto del censo.");
const prioritySortedMonitor = monitor.visibleMonitorPatients([deviceRiskMonitorPatient, criticalMonitorPatient], { sort: "prioridad" });
requireValue(prioritySortedMonitor[0].patientId === "p_monitor_critical", "Monitoreo debe ordenar por prioridad clinica explicada.");

globalThis.location.search = "?epividaTest=1&seedPatients=300";
const seededPatients = testData.testActivePatients();
const startedAt = Date.now();
const seededVisible = monitor.visibleMonitorPatients(seededPatients, { query: "sintetico riesgo", diagnosis: "RIESGO IAAS" });
const elapsed = Date.now() - startedAt;
const seededMetrics = monitor.monitorMetrics(seededPatients, seededVisible);
requireValue(seededPatients.length === 300, "QA local debe generar 300 pacientes sinteticos anonimos con seedPatients=300.");
requireValue(seededVisible.length > 0, "Monitoreo QA debe filtrar pacientes sinteticos por busqueda y diagnostico.");
requireValue(seededMetrics.active === 300 && seededMetrics.riskIaas === seededVisible.length, "Metricas de monitoreo deben calcularse sobre 300 pacientes sin Firebase.");
requireValue(elapsed < 75, `Filtro local de 300 pacientes debe ser rapido; tomo ${elapsed} ms.`);

const epiReportPatients = [
  { patientId: "epi_covid", patientName: "Paciente COVID QA", service: "MEDICINA INTERNA", epidemiologicalDiagnosis: "COVID/INFLUENZA" },
  { patientId: "epi_esavi", patientName: "Paciente ESAVI QA", service: "PEDIATRIA", epidemiologicalDiagnosis: "ESAVI" },
  { patientId: "epi_iaas", patientName: "Paciente IAAS QA", service: "UCIA", epidemiologicalDiagnosis: "VIG TRANSMISIBLE / 1 IAAS" },
  { patientId: "epi_risk", patientName: "Paciente Riesgo QA", service: "CIRUGIA", epidemiologicalDiagnosis: "VIG NO TRANSMISIBLE / RIESGO IAAS" },
  { patientId: "epi_no", patientName: "Paciente No IAAS QA", service: "URGENCIAS", epidemiologicalDiagnosis: "VIG TRANSMISIBLE / NO IAAS" },
  { patientId: "epi_materna", patientName: "Paciente Materna QA", service: "GINECOLOGIA", epidemiologicalDiagnosis: "MORBIMORTALIDAD MATERNA/PERINATAL" }
];
const epiSummary = reportService.epidemiologicalCensusSummary(epiReportPatients);
requireValue(epiSummary.totalActivePatients === 6, "Reporte epidemiologico debe contar pacientes activos del censo.");
requireValue(epiSummary.covidInfluenza === 1 && epiSummary.esavi === 1 && epiSummary.maternalPerinatal === 1, "Reporte epidemiologico debe contar COVID/Influenza, ESAVI y morbimortalidad legacy.");
requireValue(epiSummary.iaas === 1 && epiSummary.riskIaas === 1 && epiSummary.noIaas === 1, "Reporte epidemiologico debe separar IAAS, riesgo IAAS y NO IAAS sin doble conteo.");
requireValue(epiSummary.vigTransmisible === 2 && epiSummary.vigNoTransmisible === 1, "Reporte epidemiologico debe distinguir VIG transmisible de VIG no transmisible.");
const epiSummaryRows = reportService.epidemiologicalCensusSummaryRows(epiReportPatients);
requireValue(epiSummaryRows.some(row => row.indicador === "CONFIRMADOS INFLUENZA/COVID" && row.valor === 1), "Resumen epidemiologico debe conservar fila legacy de confirmados influenza/COVID.");
requireValue(epiSummaryRows.some(row => row.indicador === "VIG NO TRANSMISIBLES" && row.valor === 1), "Resumen epidemiologico debe conservar fila legacy de VIG no transmisibles.");
const epiDetailRows = reportService.epidemiologicalCensusPatientRows(epiReportPatients);
requireValue(epiDetailRows.some(row => row.patientId === "epi_iaas" && row.iaas === 1 && row.vigTransmisible === 1), "Detalle epidemiologico debe marcar paciente VIG + IAAS.");
requireValue(epiDetailRows.some(row => row.patientId === "epi_risk" && row.riesgoIaas === 1 && row.vigNoTransmisible === 1 && row.vigTransmisible === 0), "Detalle epidemiologico no debe confundir VIG no transmisible con VIG transmisible.");
const epiPrint = reportService.epidemiologicalPrintReportModel(epiReportPatients, { date: "2026-06-27" });
requireValue(epiPrint.title === "CENSO DE VIGILANCIA EPIDEMIOLOGICA HOSPITALARIA", "Modelo imprimible debe conservar titulo legacy del censo epidemiologico.");
requireValue(epiPrint.columns.includes("DX EPIDEMIOLOGICOS") && epiPrint.columns.includes("OBSERVACIONES"), "Modelo imprimible debe conservar columnas clinicas legacy.");
requireValue(epiPrint.rows.length === epiReportPatients.length && epiPrint.totalPatients === epiReportPatients.length, "Modelo imprimible debe incluir todos los pacientes activos del reporte.");
requireValue(epiPrint.rows.some(row => row.patientName === "PACIENTE IAAS QA" && row.epidemiologicalDiagnosis === "VIG TRANSMISIBLE / 1 IAAS"), "Modelo imprimible debe normalizar paciente y diagnostico epidemiologico.");
requireValue(epiPrint.summaryRows.some(row => row.indicador === "MORBIMORTALIDAD MATERNA/PERINATAL" && row.valor === 1), "Modelo imprimible debe incluir concentrado de indicadores legacy.");

const parsedRound = router.parseRoute();
requireValue(parsedRound.key === "ronda-paquetes", "Alias legacy #/ronda/YYYY-MM-DD debe resolver a ronda-paquetes.");
requireValue(parsedRound.parts[1] === "2026-06-04", "La fecha legacy de ronda debe preservarse en route.parts.");
globalThis.location.hash = "#/ronda/2026-06-04/paciente/p_uci_02";
const parsedPatient = router.parseRoute();
requireValue(parsedPatient.key === "ronda-paquetes", "Ruta legacy por paciente debe resolver a ronda-paquetes.");
requireValue(parsedPatient.parts[3] === "p_uci_02", "Ruta legacy por paciente debe preservar patientId.");
globalThis.location.hash = "#/seguimiento-iaas/2026-06-04/paciente/p_history";
const parsedIaasPatient = router.parseRoute();
requireValue(parsedIaasPatient.key === "epi-iaas", "Ruta legacy de seguimiento IAAS debe resolver a epi-iaas.");
requireValue(parsedIaasPatient.parts[3] === "p_history", "Ruta legacy de seguimiento IAAS debe preservar patientId.");
globalThis.location.hash = "#/dispositivos/paciente/p_history";
const parsedDevicePatient = router.parseRoute();
requireValue(parsedDevicePatient.key === "dispositivos", "Ruta directa de dispositivos por paciente debe resolver a Dispositivos.");
requireValue(parsedDevicePatient.parts[2] === "p_history", "Ruta directa de dispositivos debe preservar patientId.");
globalThis.location.hash = "#/censo/paciente/p_discharge";
const parsedCensoPatient = router.parseRoute();
requireValue(parsedCensoPatient.key === "censo", "Ruta directa de Censo por paciente debe resolver a Censo.");
requireValue(parsedCensoPatient.parts[2] === "p_discharge", "Ruta directa de Censo debe preservar patientId para OPD.");

const app = {
  state: {
    auth: {
      user: { uid: "qa-user", email: "qa@epivida.local" },
      profile: { role: "admin_epidemiologia" }
    }
  }
};
const archivedOpdPatient = await patientService.archivePatient(app, {
  patientId: "p_opd_discharge_qa",
  patientName: "Paciente OPD Egreso QA",
  service: "MEDICINA INTERNA",
  bed: "10",
  active: true,
  epidemiologicalDiagnosis: "VIG TRANSMISIBLE",
  dischargeType: "MEJORIA",
  dischargeDate: "2026-06-20",
  dischargeShift: "MATUTINO",
  opd: {
    address: "Calle QA 1",
    phone: "5551234567",
    symptomStartDate: "2026-06-18",
    uploaded: true,
    discharged: false
  }
}, "alta_mejoria");
const archivedOpdStatus = opdService.opdStatus(archivedOpdPatient.opd, opdService.opdEligibilityForPatient(archivedOpdPatient));
const opdArchiveQueue = await offlineQueue.listPendingWrites();
requireValue(archivedOpdPatient.active === false && archivedOpdPatient.dischargeStatus === "confirmada" && archivedOpdPatient.dischargeType === "ALTA HOSPITALARIA POR MEJORIA", "Archivar paciente debe normalizar alta hospitalaria legacy y cerrar revision.");
requireValue(archivedOpdPatient.opd?.dischargeDate === "2026-06-20" && archivedOpdStatus.label === "Alta OPD", "Egreso OPD debe heredar fecha de alta y dejar pendiente alta en plataforma si ya fue subido.");
requireValue(opdService.opdEligibilityForText("COVID/INFLUENZA", { service: "MEDICINA INTERNA" }).scope === "vig", "OPD debe habilitar COVID/Influenza hospitalizado como vigilancia legacy.");
requireValue(opdService.opdEligibilityForText("ESAVI", { service: "URGENCIAS" }).scope === "vig", "OPD debe habilitar ESAVI hospitalizado como vigilancia legacy.");
requireValue(!opdService.opdEligibilityForText("COVID/INFLUENZA", { service: "AMBULATORIO" }).eligible, "OPD no debe habilitar COVID/Influenza ambulatorio segun regla legacy hospitalizada.");
requireValue(opdService.opdEligibilityForText("VIG TRANSMISIBLE / NO IAAS", { service: "AMBULATORIO" }).eligible, "OPD debe conservar VIG explicita aunque combine NO IAAS.");
requireValue(!opdService.opdEligibilityForText("1 IAAS", { service: "HEMODIALISIS" }).eligible, "OPD no debe habilitar IAAS confirmada en servicios excluidos legacy como hemodialisis.");
requireValue(opdService.opdAutoDischargeDate({ dischargeType: "ALTA HOSPITALARIA POR TRASLADO", dischargeDate: "2026-06-20" }) === "", "OPD no debe autocompletar egreso por traslado porque legacy no lo incluia en OPD_DISCHARGE_TYPES.");
requireValue(opdArchiveQueue.some(item => item.path === "patients_archive/p_opd_discharge_qa" && item.data?.opd?.dischargeDate === "2026-06-20"), "Archivo de paciente debe persistir OPD normalizado en patients_archive.");
const archivedOpdRows = await patientService.listArchivedPatientsWithPendingOpd({ limit: 10 });
requireValue(archivedOpdRows.some(row => row.patientId === "p_opd_discharge_qa"), "Archivados con Alta OPD pendiente deben consultarse desde patients_archive con limite.");
const archivedOpdAlerts = operationalAlertService.buildOperationalAlerts({
  date: "2026-06-20",
  today: "2026-06-20",
  patients: [],
  archivedPatients: archivedOpdRows
});
requireValue(archivedOpdAlerts.panels.flatMap(panel => panel.items).some(item => item.patientId === "p_opd_discharge_qa" && item.title.includes("Alta OPD pendiente")), "Inicio debe conservar alerta Alta OPD pendiente para pacientes archivados.");
const closedArchivedOpdPatient = await patientService.saveArchivedPatient(app, {
  ...archivedOpdPatient,
  opd: { ...archivedOpdPatient.opd, discharged: true }
});
requireValue(closedArchivedOpdPatient.active === false && closedArchivedOpdPatient.opdPending === false, "Cerrar Alta OPD en archivo debe actualizar patients_archive sin reactivar paciente.");
requireValue(iaasService.patientClassificationForIaasStatus("confirmada") === "IAAS", "IAAS confirmada debe sincronizar paciente como IAAS.");
requireValue(iaasService.patientClassificationForIaasStatus("sospecha") === "RIESGO IAAS", "IAAS sospecha debe sincronizar paciente como RIESGO IAAS.");
requireValue(iaasService.patientClassificationForIaasStatus("descartada") === "NO IAAS", "IAAS descartada debe sincronizar paciente como NO IAAS.");
requireValue(iaasCriteriaService.normalizeIaasType("ITS-CVC") === "ITS - CC", "Criterios IAAS deben reconocer alias legacy ITS-CVC.");
const completeIaasValidation = iaasCriteriaService.validateIaasClinicalCompleteness({
  patientId: "p_history",
  iaasType: "ITS-CVC",
  status: "confirmada",
  onsetDate: "2026-06-05",
  probableOrigin: "CVC subclavio derecho",
  criteria: "Fiebre, escalofrios y sospecha de ITS por CVC sin otro foco evidente.",
  criteriaVersion: iaasCriteriaService.criteriaVersionForType("ITS-CVC"),
  deviceEpisodeId: "d_cvc_history",
  vitalSigns: { temperature: "38.4 C" },
  labs: { biometry: "Leucocitosis" },
  followUp: { reviewDate: "2026-06-05", evolution: "Continua vigilancia estrecha.", carePlan: "Tomar hemocultivo y valorar retiro de CVC con vancomicina." }
}, {
  cultureDraft: { sampleType: "Hemocultivo central", requestedAt: "2026-06-05" },
  antimicrobialDraft: { drug: "Vancomicina", startDate: "2026-06-05" }
});
requireValue(completeIaasValidation.status === "completa" && completeIaasValidation.canConfirm, "Cedula IAAS completa debe quedar confirmable.");
const legacyItuValidation = iaasCriteriaService.validateIaasClinicalCompleteness({
  patientId: "p_history",
  iaasType: "IVU-CU",
  status: "confirmada",
  onsetDate: "2026-06-05",
  probableOrigin: "Sonda Foley instalada por retencion urinaria",
  criteria: "Fiebre persistente, bacteriuria y datos urinarios con sonda Foley activa.",
  criteriaVersion: iaasCriteriaService.criteriaVersionForType("ITU-CU"),
  followUp: {
    carePlan: "Retiro de sonda Foley, toma de urocultivo y tratamiento antimicrobiano dirigido."
  },
  iaasAssessment: {
    urinalysis: { studyDate: "2026-06-05", nitrites: "Positivo", leukocyteEsterase: "Positivo", bacteria: "Abundantes", leukocytes: "Campo lleno" },
    cultures: [{ type: "Urocultivo", collectionDate: "2026-06-05", microorganism: "E. coli" }],
    treatments: [{ drug: "Ceftriaxona", startDate: "2026-06-05" }]
  }
});
requireValue(legacyItuValidation.status === "completa" && legacyItuValidation.type === "ITU - CU", "Cedula ITU-CU debe aceptar EGO/urocultivo desde iaasAssessment legacy.");
const legacyCovidValidation = iaasCriteriaService.validateIaasClinicalCompleteness({
  patientId: "p_history",
  iaasType: "COVID",
  status: "confirmada",
  onsetDate: "2026-06-06",
  probableOrigin: "Vigilancia respiratoria intrahospitalaria",
  criteria: "Tos, disnea y saturacion baja con aislamiento respiratorio.",
  criteriaVersion: iaasCriteriaService.criteriaVersionForType("COVID/Influenza"),
  vitalSigns: { oxygenSaturation: "88%" },
  followUp: { carePlan: "Aislamiento, notificacion y seguimiento OPD al egreso." },
  iaasAssessment: {
    otherStudies: { viralPanel: [{ test: "Influenza", result: "Positivo" }] },
    treatments: [{ drug: "OSELTAMIVIR", startDate: "2026-06-06" }]
  }
});
requireValue(legacyCovidValidation.status === "completa" && legacyCovidValidation.type === "COVID/Influenza", "Cedula COVID/Influenza debe aceptar panel viral legacy como evidencia.");
const legacyHemodialysisItsValidation = iaasCriteriaService.validateIaasClinicalCompleteness({
  patientId: "p_history",
  iaasType: "ITS-CVC",
  status: "confirmada",
  onsetDate: "2026-06-07",
  probableOrigin: "CATT HD con secrecion en sitio de insercion",
  criteria: "Fiebre, escalofrios y secrecion purulenta en acceso de hemodialisis.",
  criteriaVersion: iaasCriteriaService.criteriaVersionForType("ITS-CVC"),
  followUp: { carePlan: "Hemocultivo, vigilancia de parche y retiro/cambio de cateter si persiste fiebre." },
  iaasAssessment: {
    infectionTracking: {
      assessmentDate: "2026-06-07",
      patchIntegrity: "No integro",
      patchMoisture: "Humedo",
      secretionPresence: "Con secrecion",
      secretionType: "Purulenta",
      insertionSite: "Yugular derecho",
      carePlan: "Cambio de parche y vigilancia de acceso."
    },
    cultures: [{ type: "Hemocultivo central", collectionDate: "2026-06-07" }],
    treatments: [{ drug: "Vancomicina", startDate: "2026-06-07" }]
  }
});
requireValue(legacyHemodialysisItsValidation.status === "completa", "Cedula ITS-CVC debe aceptar seguimiento de infecciones legacy en hemodialisis.");
const vitalTrendSeries = iaasService.iaasVitalTrendSeries({
  patientId: "p_history",
  iaasType: "ITS-CVC",
  status: "confirmada",
  clinicalTimeline: [
    { date: "2026-06-05", vitalSigns: { temperature: "38.1", heartRate: "98", spo2: "94%" } },
    { date: "2026-06-06", vitalSigns: { temperature: "39.0 C", heartRate: "110", spo2: "91%" } }
  ],
  vitalSigns: { temperature: "37.8", heartRate: "92", spo2: "96%" },
  followUp: { reviewDate: "2026-06-07" }
});
const temperatureTrend = vitalTrendSeries.find(row => row.key === "temperature");
const heartRateTrend = vitalTrendSeries.find(row => row.key === "heartRate");
requireValue(temperatureTrend?.points.length === 3 && temperatureTrend.latest.value === 37.8, "Tendencia IAAS debe conservar temperatura longitudinal y dato actual.");
requireValue(heartRateTrend?.points.length === 3 && heartRateTrend.max === 110, "Tendencia IAAS debe calcular FC longitudinal desde clinicalTimeline.");
const dailyIaasTable = iaasService.iaasClinicalTimelineTable({
  patientId: "p_history",
  clinicalTimeline: [
    { date: "2026-06-05", vitalSigns: { temperature: "38.1", fio2: "28" }, labs: { biometry: "Leucocitosis" }, followUp: { carePlan: "Hemocultivo" } },
    { date: "2026-06-06", vitalSigns: { temperature: "39.0 C", fio2: "35%" }, labs: { ego: "Sin datos" }, followUp: { evolution: "Persiste fiebre" } }
  ]
}, {
  cultures: [
    { sampleType: "Hemocultivo", requestedAt: "2026-06-05", resultDate: "2026-06-07", organism: "S. aureus", status: "solicitado" }
  ],
  antimicrobials: [
    { drug: "Vancomicina", startDate: "2026-06-05", endDate: "2026-06-08", status: "activo", indication: "ITS-CVC" }
  ]
});
requireValue(dailyIaasTable.dates.length === 4 && dailyIaasTable.dates[0] === "2026-06-05", "Tabla diaria IAAS debe ordenar columnas por fecha e incluir microbiologia/tratamiento.");
requireValue(dailyIaasTable.rows.some(row => row.group === "VENTILACION" && row.label === "FiO2" && row.values[0] === "28%"), "Tabla diaria IAAS debe mostrar ventilacion con unidades.");
requireValue(dailyIaasTable.rows.some(row => row.group === "LABORATORIO" && row.label === "Biometria" && row.values[0] === "Leucocitosis"), "Tabla diaria IAAS debe incluir laboratorio por fecha.");
requireValue(dailyIaasTable.rows.some(row => row.group === "SEGUIMIENTO" && row.label === "Plan" && row.values[0] === "Hemocultivo"), "Tabla diaria IAAS debe incluir plan clinico por fecha.");
requireValue(dailyIaasTable.rows.some(row => row.group === "CULTIVOS" && row.values[dailyIaasTable.dates.indexOf("2026-06-07")] === "Resultado: S. aureus"), "Tabla diaria IAAS debe incluir resultado de cultivo por fecha.");
requireValue(dailyIaasTable.rows.some(row => row.group === "TRATAMIENTO" && row.label === "Vancomicina" && row.values[dailyIaasTable.dates.indexOf("2026-06-05")].includes("ITS-CVC")), "Tabla diaria IAAS debe incluir tratamiento activo por fecha.");
const suspectIaasValidation = iaasCriteriaService.validateIaasClinicalCompleteness({
  patientId: "p_history",
  iaasType: "ITS - CC",
  status: "sospecha",
  onsetDate: "2026-06-05",
  criteria: iaasCriteriaService.buildCriteriaTemplate("ITS - CC"),
  criteriaVersion: iaasCriteriaService.criteriaVersionForType("ITS - CC")
});
requireValue(suspectIaasValidation.status === "revision" && suspectIaasValidation.warnings.includes("Origen probable documentado"), "Cedula IAAS sospecha con faltantes criticos debe quedar en revision.");
const incompleteNavmValidation = iaasCriteriaService.validateIaasClinicalCompleteness({
  patientId: "p_uci_02",
  iaasType: "NAVM",
  status: "confirmada",
  onsetDate: "2026-06-05",
  criteria: "Sospecha respiratoria",
  followUp: { carePlan: "" }
});
requireValue(incompleteNavmValidation.status === "incompleta" && !incompleteNavmValidation.canConfirm, "Cedula NAVM confirmada incompleta debe marcar faltantes criticos.");
const savedIaas = await iaasService.saveIaasCase(app, {
  patientId: "p_history",
  patientName: "Paciente QA Historial",
  service: "MEDICINA INTERNA",
  bed: "12",
  iaasType: "ITS-CVC",
  status: "confirmada",
  onsetDate: "2026-06-05",
  probableOrigin: "Cateter venoso central",
  criteria: "Validacion QA de sincronizacion IAAS",
  vitalSigns: { temperature: "38.0", heartRate: "100" },
  clinicalTimeline: [{ date: "2026-06-04", vitalSigns: { temperature: "37.5", heartRate: "88" } }],
  active: true
});
const pendingPatientSync = await offlineQueue.pendingPayloadsForCollection("patients_active");
requireValue(savedIaas.patientClassification === "IAAS", "saveIaasCase debe devolver clasificacion de paciente sincronizada.");
requireValue(savedIaas.clinicalValidationStatus === "incompleta" && savedIaas.clinicalValidation?.type === "ITS - CC", "saveIaasCase debe persistir validacion clinica y normalizar alias legacy.");
requireValue(Array.isArray(savedIaas.clinicalTimeline) && savedIaas.clinicalTimeline.length >= 2, "saveIaasCase debe conservar timeline clinico IAAS para tendencias ligeras.");
requireValue(pendingPatientSync.some(row => row.patientId === "p_history" && row.epidemiologicalDiagnosis === "IAAS"), "Guardar IAAS debe encolar sincronizacion de clasificacion en patients_active.");
const revisedIaas = await iaasService.saveIaasCase(app, {
  ...savedIaas,
  previousIaasSnapshot: savedIaas,
  followUp: { reviewDate: "2026-06-06", evolution: "Persiste febricula.", carePlan: "Escalar vigilancia y repetir cultivo." },
  vitalSigns: { temperature: "38.7", heartRate: "108" },
  labs: { ...savedIaas.labs, biometry: "Leucocitosis en ascenso" }
});
const revisionHistory = iaasService.iaasClinicalRevisionHistory(revisedIaas);
requireValue(revisionHistory.length === 1, "Editar IAAS debe conservar una revision clinica previa acotada.");
requireValue(revisionHistory[0].snapshot?.vitalSigns?.temperature === "38.0", "Revision IAAS debe guardar signos vitales previos antes de sobrescribir.");
requireValue(revisedIaas.clinicalTimeline.some(row => row.date === "2026-06-06" && row.followUp?.carePlan?.includes("repetir cultivo")), "Editar IAAS debe agregar nuevo snapshot al timeline clinico.");

const censusActive = [
  {
    patientId: "p_census_keep",
    patientName: "Paciente Conservado",
    normalizedPatientName: "PACIENTE CONSERVADO",
    service: "MEDICINA INTERNA",
    bed: "1",
    sex: "F",
    admissionDate: "2026-06-01",
    active: true
  },
  {
    patientId: "p_census_absent",
    patientName: "Paciente Ausente",
    normalizedPatientName: "PACIENTE AUSENTE",
    service: "CIRUGIA Y TRAUMATOLOGIA",
    bed: "18",
    active: true
  },
  {
    patientId: "p_census_hemo",
    patientName: "Paciente Hemo",
    normalizedPatientName: "PACIENTE HEMO",
    service: "HEMODIALISIS",
    bed: "HEM 1",
    active: true
  }
];
const censusInput = [
  "Paciente\tServicio\tCama\tEdad\tSexo\tFecha ingreso\tPendientes",
  "Paciente Conservado\tMedicina Interna\tCama 1\t40\tF\t01/06/2026\tAlta por traslado 18/06/2026"
].join("\n");
const censusParsed = importService.parseCensusInput(censusInput, { date: "2026-06-20" });
const censusPreview = reconciliationService.reconcileCensusRows(censusParsed.rows, censusActive, { date: "2026-06-20", mode: "full" });
const censusSaved = await reconciliationService.applyCensusImport(app, censusPreview, {
  date: "2026-06-20",
  archiveAbsent: false,
  source: "qa-local"
});
const censusQueue = await offlineQueue.listPendingWrites();
const censusDayWrite = censusQueue.find(item => item.path === "census_days/2026-06-20");
const censusSnapshotWrite = censusQueue.find(item => item.path === "daily_snapshots/2026-06-20");
const censusMonthSnapshotWrite = censusQueue.find(item => item.path === "monthly_snapshots/2026-06");
const censusYearSnapshotWrite = censusQueue.find(item => item.path === "yearly_snapshots/2026");
const censusPatientWrite = censusQueue.find(item => item.path === "patients_active/p_census_keep");
const absentWrite = censusQueue.find(item => item.path === "patients_active/p_census_absent");
const protectedWrite = censusQueue.find(item => item.path === "patients_active/p_census_hemo");
const absentCensusRow = censusQueue.find(item => item.path === "census_days/2026-06-20/patients/p_census_absent");
requireValue(censusSaved.syncStatus === "local_pending", "Guardar censo QA debe usar cola local en modo prueba.");
requireValue(censusDayWrite?.data.importScope === "full" && censusDayWrite.data.reportedDischarges === 1, "census_days debe guardar alcance completo y altas reportadas.");
requireValue(censusDayWrite?.data.reconciliationPatients === 2 && censusDayWrite.data.probableDischarges === 1, "census_days debe contar conciliaciones y altas probables.");
requireValue(censusSnapshotWrite?.data.totalActivePatients === 3 && censusSnapshotWrite.data.totalReconciliationPatients === 2, "daily_snapshots debe contar activos importados y ausentes en revision cuando no se archivan.");
requireValue(censusMonthSnapshotWrite?.data.dailyMetrics?.["2026-06-20"]?.totalActivePatients === 3, "Importar censo debe actualizar monthly_snapshots con metrica diaria.");
requireValue(censusYearSnapshotWrite?.data.monthlyMetrics?.["2026-06"]?.lastSnapshotDate === "2026-06-20", "Importar censo debe actualizar yearly_snapshots con metrica mensual.");
requireValue(censusPatientWrite?.data.dischargeReported === true && censusPatientWrite.data.dischargeType === "TRASLADO", "Paciente importado debe conservar alta reportada en patients_active.");
requireValue(absentWrite?.data.hospitalizationStatus === "alta_probable" && absentWrite.data.probableDischarge === true, "Ausente archivable debe quedar como alta probable en revision.");
requireValue(protectedWrite?.data.hospitalizationStatus === "requiere_conciliacion" && protectedWrite.data.probableDischarge === false, "Ausente protegido debe requerir conciliacion sin alta probable automatica.");
requireValue(absentCensusRow?.data.present === false && absentCensusRow.data.reconciliationRequired === true, "census_days/patients debe guardar fila de conciliacion para ausentes.");

const archivedPreview = reconciliationService.reconcileCensusRows(censusParsed.rows, censusActive, { date: "2026-06-21", mode: "full" });
await reconciliationService.applyCensusImport(app, archivedPreview, {
  date: "2026-06-21",
  archiveAbsent: true,
  source: "qa-local"
});
const archiveQueue = await offlineQueue.listPendingWrites();
const archivedSnapshotWrite = archiveQueue.find(item => item.path === "daily_snapshots/2026-06-21");
const archivedPatientWrite = archiveQueue.find(item => item.path === "patients_archive/p_census_absent");
requireValue(archivedSnapshotWrite?.data.totalActivePatients === 2 && archivedSnapshotWrite.data.totalReconciliationPatients === 2, "daily_snapshots no debe contar como activo al ausente archivable cuando se archiva.");
requireValue(archivedPatientWrite?.data.active === false && archivedPatientWrite.data.archiveReason === "egreso_por_conciliacion_censo", "Archivar ausentes confirmados debe escribir patients_archive.");

const workbookBuffer = await excelExportService.workbookBufferFromRows([
  { paciente: "Reporte QA", formula: "=1+1", detalles: { servicio: "MI", cama: "10" } }
], { sheetName: "QA" });
const workbookTsv = await excelImportService.spreadsheetBufferToTsv(workbookBuffer);
requireValue(workbookTsv.includes("Reporte QA"), "Exportador Excel debe generar libro legible por el importador Lite.");
requireValue(workbookTsv.includes("'=1+1"), "Exportador Excel debe proteger celdas que parecen formulas.");
requireValue(workbookTsv.includes("{\"servicio\":\"MI\",\"cama\":\"10\"}"), "Exportador Excel debe serializar objetos anidados.");

const generatedBackup = await reportService.buildOperationalBackup(app, {
  includeSnapshots: true,
  from: "2026-06-20",
  to: "2026-06-20"
});
requireValue(Array.isArray(generatedBackup.datasets.catalogs) && generatedBackup.datasets.catalogs.length > 0, "Respaldo operativo debe incluir catalogos clinicos restaurables.");
requireValue(generatedBackup.meta.catalogs === generatedBackup.datasets.catalogs.length, "Meta de respaldo debe contar catalogos incluidos.");
const generatedSummary = backupRestoreService.summarizeOperationalBackup(generatedBackup);
requireValue(generatedSummary.some(item => item.key === "catalogs" && item.supported), "Resumen de respaldo debe marcar catalogos como restaurables.");
requireValue(generatedSummary.some(item => item.key === "sync_queue" && !item.supported), "Resumen de respaldo debe dejar sync_queue como solo lectura.");

const restoreBackup = backupRestoreService.parseOperationalBackupText(JSON.stringify({
  schema: "epivida-lite-operational-backup-v1",
  createdAt: "2026-06-20T12:00:00.000Z",
  datasets: {
    patients_active: [
      { patientId: "restore_patient_ok", patientName: "Paciente Restaurado", service: "QA", bed: "1", active: true },
      { patientId: "restore/bad#id?", patientName: "Paciente ID Sanitizado", service: "QA", bed: "2", active: true },
      { patientName: "Paciente Sin ID" },
      null
    ],
    catalogs: [
      { catalogId: "restore_catalog_service_qa", type: "services", value: "SERVICIO QA", label: "Servicio QA", active: true }
    ],
    daily_snapshots: [
      { date: "2026-06-22", totalActivePatients: 1, totalIAASActive: 0, totalDevicesActive: 0 }
    ],
    sync_queue: [
      { path: "patients_active/restore_should_not_apply", data: { patientId: "restore_should_not_apply" } }
    ],
    unsupported_private: [
      { patientId: "restore_private_dataset" }
    ]
  }
}));
const restorePlan = backupRestoreService.restoreOperationalBackupPlan(restoreBackup, [
  "patients_active",
  "catalogs",
  "daily_snapshots",
  "sync_queue",
  "unsupported_private"
], { maxRows: 3 });
requireValue(restorePlan.writable === 4, "Plan de restauracion debe contar solo filas restaurables con ID valido.");
requireValue(restorePlan.skipped === 2, "Plan de restauracion debe contar filas omitidas por limite o ID invalido.");
requireValue(restorePlan.unsupported.includes("sync_queue") && restorePlan.unsupported.includes("unsupported_private"), "Plan de restauracion debe reportar datasets no restaurables.");
const restored = await backupRestoreService.restoreOperationalBackup(app, restoreBackup, [
  "patients_active",
  "catalogs",
  "daily_snapshots",
  "sync_queue",
  "unsupported_private"
], { maxRows: 3 });
const restoreQueue = await offlineQueue.listPendingWrites();
const restoredPatient = restoreQueue.find(item => item.path === "patients_active/restore_patient_ok");
const restoredSanitized = restoreQueue.find(item => item.path === "patients_active/restore_bad_id_");
const restoredCatalog = restoreQueue.find(item => item.path === "catalogs/restore_catalog_service_qa");
const restoredSnapshot = restoreQueue.find(item => item.path === "daily_snapshots/2026-06-22");
const restoreAudit = restoreQueue.find(item => item.collection === "audit_logs" && item.data?.after?.restoreRunId === restored.restoreRunId);
requireValue(restoredPatient?.data.restoreRunId === restored.restoreRunId, "Restauracion debe escribir paciente activo con restoreRunId trazable.");
requireValue(restoredSanitized?.data.patientId === "restore_bad_id_", "Restauracion debe sanear IDs antes de escribir rutas Firestore.");
requireValue(restoredCatalog?.data.restoreRunId === restored.restoreRunId, "Restauracion debe escribir catalogos restaurables.");
requireValue(restoredSnapshot?.data.restoreRunId === restored.restoreRunId, "Restauracion debe escribir snapshots diarios restaurables.");
requireValue(!restoreQueue.some(item => item.path === "patients_active/restore_should_not_apply"), "Restauracion no debe aplicar sync_queue como dataset restaurable.");
requireValue(restoreAudit?.data.actionType === "backup_restore" && restoreAudit.data.after.unsupported.includes("sync_queue"), "Restauracion debe auditar resultado y datasets ignorados.");

const catalogImport = catalogService.parseCatalogImportText([
  "type,value,label,service,bed,order,version,active",
  "services,TERAPIA INTERMEDIA,Terapia intermedia,,,120,qa-import,true",
  "known_beds,,AIS 9,URGENCIAS,AIS 9,130,qa-import,si",
  "bad_type,NO,No permitido,,,140,qa-import,true",
  "known_beds,,Cama sin servicio,,AIS X,150,qa-import,true"
].join("\n"));
requireValue(catalogImport.accepted.length === 2, "Importacion de catalogos debe aceptar filas validas CSV.");
requireValue(catalogImport.rejected.length === 2, "Importacion de catalogos debe rechazar tipos no permitidos y camas sin servicio.");
requireValue(catalogImport.accepted.some(row => row.catalogId === "services_terapia_intermedia"), "Importacion debe normalizar ID de servicio.");
requireValue(catalogImport.accepted.some(row => row.type === "known_beds" && row.value === "URGENCIAS|AIS 9"), "Importacion debe crear valor canonico servicio|cama.");
const importedCatalogs = await catalogService.importCatalogEntries(app, catalogImport.accepted, { source: "qa_catalog_import" });
const catalogQueue = await offlineQueue.listPendingWrites();
const importedService = catalogQueue.find(item => item.path === "catalogs/services_terapia_intermedia");
const importedBed = catalogQueue.find(item => item.path === "catalogs/known_beds_urgencias_ais_9");
const catalogImportAudit = catalogQueue.find(item => item.collection === "audit_logs" && item.data?.actionType === "catalog_import" && item.data?.after?.importBatchId === importedCatalogs.importBatchId);
requireValue(importedCatalogs.count === 2 && importedCatalogs.syncStatus === "local_pending", "Importacion masiva debe guardar filas aceptadas por cola local en QA.");
requireValue(importedService?.data.label === "Terapia intermedia" && importedService.data.importBatchId === importedCatalogs.importBatchId, "Servicio importado debe conservar etiqueta e importBatchId.");
requireValue(importedBed?.data.service === "URGENCIAS" && importedBed.data.bed === "AIS 9", "Cama importada debe conservar servicio y cama.");
requireValue(catalogImportAudit?.data.after.count === 2 && catalogImportAudit.data.after.types.includes("known_beds"), "Importacion masiva debe auditar lote y tipos afectados.");

const microbiologyAlerts = microbiologyAlertService.microbiologyClinicalAlerts({
  today: "2026-06-20",
  patients: [
    { patientId: "p_micro", patientName: "Paciente Micro", service: "MEDICINA INTERNA", bed: "8" },
    { patientId: "p_micro_neg", patientName: "Paciente Micro Negativo", service: "MEDICINA INTERNA", bed: "9" },
    { patientId: "p_micro_timeout", patientName: "Paciente Micro Timeout", service: "MEDICINA INTERNA", bed: "10" }
  ],
  cultures: [
    { cultureId: "c_micro_hemo", patientId: "p_micro", sampleType: "Hemocultivo central", requestedAt: "2026-06-13", status: "solicitado", organism: "Pendiente" },
    { cultureId: "c_micro_positive", patientId: "p_micro", sampleType: "Hemocultivo periferico", requestedAt: "2026-06-19", resultAt: "2026-06-20", status: "positivo", organism: "Klebsiella BLEE" },
    { cultureId: "c_micro_negative", patientId: "p_micro_neg", iaasId: "iaas_micro_negative", sampleType: "Urocultivo", requestedAt: "2026-06-17", resultAt: "2026-06-19", status: "negativo", organism: "Sin desarrollo" },
    { cultureId: "c_micro_timeout", patientId: "p_micro_timeout", iaasId: "iaas_micro_timeout", sampleType: "Hemocultivo central", requestedAt: "2026-06-18", status: "solicitado", organism: "Pendiente" }
  ],
  antimicrobials: [
    { antimicrobialId: "atb_micro_broad", patientId: "p_micro", drug: "Meropenem", startDate: "2026-06-16", status: "activo" },
    { antimicrobialId: "atb_micro_long", patientId: "p_micro", drug: "Ceftriaxona", startDate: "2026-06-01", status: "activo" },
    { antimicrobialId: "atb_micro_proph", patientId: "p_micro", drug: "Cefazolina", startDate: "2026-06-17", status: "profilaxis", indication: "Profilaxis quirurgica" },
    { antimicrobialId: "atb_micro_negative", patientId: "p_micro_neg", iaasId: "iaas_micro_negative", drug: "Meropenem", startDate: "2026-06-17", status: "ajustado" },
    { antimicrobialId: "atb_micro_timeout", patientId: "p_micro_timeout", iaasId: "iaas_micro_timeout", drug: "Ampicilina", startDate: "2026-06-18", status: "activo" }
  ]
});
requireValue(microbiologyAlerts.some(row => row.kind === "culture" && row.subtype === "positive-critical" && row.tone === "critical"), "Alertas microbiologicas deben elevar positivos criticos.");
requireValue(microbiologyAlerts.some(row => row.kind === "culture" && row.subtype === "pending-overdue" && row.due), "Alertas microbiologicas deben detectar cultivos vencidos por tipo.");
requireValue(microbiologyAlerts.some(row => row.kind === "antimicrobial" && row.title.includes("amplio sin cultivo")), "Alertas microbiologicas deben detectar antimicrobiano amplio sin cultivo.");
requireValue(microbiologyAlerts.some(row => row.kind === "antimicrobial" && row.title.includes("prolongado")), "Alertas microbiologicas deben detectar antimicrobiano activo prolongado.");
requireValue(microbiologyAlerts.some(row => row.kind === "antimicrobial" && row.subtype === "prophylaxis-prolonged"), "Alertas microbiologicas deben detectar profilaxis antimicrobiana prolongada.");
requireValue(microbiologyAlerts.some(row => row.kind === "antimicrobial" && row.subtype === "broad-negative-culture"), "Alertas microbiologicas deben sugerir revision de desescalamiento si amplio espectro tiene cultivo negativo vinculado.");
requireValue(microbiologyAlerts.some(row => row.kind === "antimicrobial" && row.subtype === "antibiotic-timeout"), "Alertas microbiologicas deben generar timeout antimicrobiano 48h cuando hay cultivo vinculado.");
const microbiologyDashboard = await microbiologyDashboardService.loadMicrobiologyDashboard({ today: "2026-06-27" });
requireValue(microbiologyDashboard.clinicalAlerts.some(row => row.kind === "culture" && row.due), "Tablero microbiologico debe mostrar cultivos vencidos con datos QA.");
requireValue(microbiologyDashboard.clinicalAlerts.some(row => row.kind === "antimicrobial" && row.due), "Tablero microbiologico debe mostrar antimicrobianos vencidos/prolongados con datos QA.");
requireValue(microbiologyDashboard.activeAntimicrobials.some(row => row.status === "profilaxis"), "Tablero microbiologico debe consultar antimicrobianos en profilaxis, no solo activos.");
requireValue(microbiologyDashboard.activeAntimicrobials.some(row => row.status === "ajustado"), "Tablero microbiologico debe consultar antimicrobianos ajustados para reglas de desescalamiento.");
requireValue(microbiologyDashboard.resultCultures.some(row => row.status === "negativo"), "Tablero microbiologico debe incluir cultivos negativos para reglas de desescalamiento.");

globalThis.window.__EPIVIDA_LITE_TEST_MODE__ = false;
globalThis.location.search = "";
requireValue(testData.testActivePatients().length === 0, "Datos QA no deben exponerse fuera de modo local de prueba.");

if (failures.length) {
  console.error(`EPIVIDA Lite local QA validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite local QA validation OK");

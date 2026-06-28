const failures = [];

function fail(message) {
  failures.push(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

const {
  buildOperationalAlerts,
  OPERATIONAL_ALERTS_VERSION
} = await import("../src/services/operationalAlertService.js");

const patients = [
  {
    patientId: "p_risk",
    patientName: "Paciente Riesgo",
    service: "MEDICINA INTERNA",
    bed: "12",
    status: "GRAVE",
    epidemiologicalDiagnosis: "RIESGO IAAS",
    hospitalDiagnosis: "Sepsis con cateter venoso central",
    activePendingIssues: ["Movido de cama 10 a 12"],
    active: true
  },
  {
    patientId: "p_discharge",
    patientName: "Paciente Alta",
    service: "URGENCIAS",
    bed: "CHOQUE",
    epidemiologicalDiagnosis: "VIG NO TRANSMISIBLE",
    hospitalDiagnosis: "Alta probable por mejoria",
    probableDischarge: true,
    dischargeReviewRequired: true,
    opd: { address: "", phone: "", symptomStartDate: "2026-06-01", uploaded: false, discharged: false },
    active: true
  },
  {
    patientId: "p_isq",
    patientName: "Paciente ISQ",
    service: "CIRUGIA Y TRAUMATOLOGIA",
    bed: "44",
    epidemiologicalDiagnosis: "NO IAAS",
    hospitalDiagnosis: "Post operatorio por fractura",
    active: true
  }
];

const alerts = buildOperationalAlerts({
  date: "2026-06-09",
  today: "2026-06-09",
  patients,
  archivedPatients: [
    {
      patientId: "p_archived_opd",
      patientName: "Paciente OPD Archivado",
      service: "MEDICINA INTERNA",
      bed: "10",
      active: false,
      archivedAt: "2026-06-09T12:00:00.000Z",
      epidemiologicalDiagnosis: "VIG TRANSMISIBLE",
      opd: {
        address: "Calle QA",
        phone: "5551234567",
        symptomStartDate: "2026-06-01",
        dischargeDate: "2026-06-09",
        uploaded: true,
        discharged: false
      },
      opdPending: true
    }
  ],
  devices: [
    { episodeId: "d_cvc", patientId: "p_risk", deviceType: "CVC", active: true, installationDate: "2026-06-01" },
    { episodeId: "d_puntas", patientId: "p_risk", deviceType: "Puntas nasales", active: true, installationDate: "2026-06-01" }
  ],
  rounds: [
    { roundId: "2026-06-09_p_isq", date: "2026-06-09", patientId: "p_isq", status: "reviewed" }
  ],
  cultures: [
    { cultureId: "c_hemo", patientId: "p_risk", sampleType: "Hemocultivo central", requestedAt: "2026-06-01", status: "solicitado", organism: "Pendiente" },
    { cultureId: "c_result", patientId: "p_isq", sampleType: "Urocultivo", requestedAt: "2026-06-07", status: "resultado", organism: "E coli" },
    { cultureId: "c_critical", patientId: "p_risk", sampleType: "Hemocultivo periferico", requestedAt: "2026-06-08", resultAt: "2026-06-09", status: "positivo", organism: "Staphylococcus aureus" }
  ],
  antimicrobials: [
    { antimicrobialId: "atb_broad", patientId: "p_discharge", drug: "Meropenem", startDate: "2026-06-05", status: "activo" },
    { antimicrobialId: "atb_proph", patientId: "p_isq", drug: "Cefazolina", startDate: "2026-06-06", status: "profilaxis", indication: "Profilaxis quirurgica" },
    { antimicrobialId: "atb_linked", patientId: "p_risk", iaasId: "iaas_risk", drug: "Vancomicina", startDate: "2026-06-08", status: "activo" }
  ],
  queue: [
    { id: "q1", status: "local_pending" },
    { id: "q2", status: "sync_blocked" }
  ]
});

const allItems = alerts.panels.flatMap(panel => panel.items);

requireValue(alerts.version === OPERATIONAL_ALERTS_VERSION, "Alertas operativas deben exponer version.");
requireValue(alerts.panels.length === 3, "Alertas operativas deben conservar paneles preventive/iaas/vig.");
requireValue(allItems.some(item => item.kind === "discharge" && item.patientId === "p_discharge"), "Debe detectar altas por investigar.");
requireValue(allItems.some(item => item.kind === "movement" && item.patientId === "p_risk"), "Debe detectar movimientos/conciliacion desde pendientes activos.");
requireValue(allItems.some(item => item.kind === "round" && item.title.includes("2 paciente")), "Debe detectar pacientes sin ronda revisada del dia.");
requireValue(allItems.some(item => item.kind === "device-surveillance" && item.title.includes("Dispositivos activos") && item.detail.includes("2 invasivo") && item.detail.includes("2 dispositivo-dia") && item.href === "#/reportes"), "Debe conservar aviso legacy de dispositivos activos para vigilancia sin lecturas adicionales.");
requireValue(allItems.some(item => item.kind === "isq"), "Debe detectar senales quirurgicas/ISQ.");
requireValue(allItems.some(item => item.kind === "risk-device" && item.detail.includes("CVC") && !item.detail.includes("Puntas")), "Debe filtrar invasivos relevantes para riesgo IAAS.");
requireValue(allItems.some(item => item.kind === "culture" && item.due === true), "Debe detectar cultivos pendientes vencidos por umbral.");
requireValue(allItems.some(item => item.kind === "culture" && item.title.includes("positivo critico")), "Debe elevar cultivos positivos criticos.");
requireValue(allItems.some(item => item.kind === "antimicrobial" && item.title.includes("amplio sin cultivo")), "Debe detectar antimicrobiano amplio sin cultivo vinculado.");
requireValue(allItems.some(item => item.kind === "antimicrobial" && item.title.includes("Profilaxis antimicrobiana prolongada")), "Debe detectar profilaxis antimicrobiana prolongada.");
requireValue(allItems.filter(item => item.kind === "culture" || item.kind === "antimicrobial").every(item => item.href.includes("#/seguimiento-iaas/")), "Alertas microbiologicas deben abrir seguimiento IAAS directo por paciente.");
requireValue(allItems.some(item => item.kind === "opd"), "Debe detectar OPD pendiente.");
requireValue(allItems.filter(item => item.kind === "opd").every(item => item.href.includes("#/censo/paciente/") && item.patientId), "Alertas OPD deben abrir Censo directo del paciente pendiente.");
requireValue(allItems.some(item => item.kind === "opd" && item.patientId === "p_archived_opd" && item.title.includes("Alta OPD pendiente") && item.time === "Alta OPD"), "Debe conservar alerta Alta OPD pendiente para pacientes archivados.");
requireValue(allItems.some(item => item.kind === "sync" && item.tone === "critical"), "Debe detectar sincronizacion bloqueada.");
requireValue(alerts.totals.culturesDue === 2, "Totales deben contar cultivos vencidos o positivos criticos.");
requireValue(alerts.totals.antimicrobialDue === 2, "Totales deben contar antimicrobianos que requieren accion clinica.");
requireValue(alerts.totals.totalDeviceDays === 2, "Totales deben conservar dispositivo-dia diario como conteo de invasivos activos legacy.");
requireValue(alerts.totals.opdPending === 2, "Totales OPD deben contar activos y archivados con Alta OPD pendiente.");
requireValue(alerts.totals.syncPending === 1 && alerts.totals.syncBlocked === 1, "Totales de sync deben separar pendientes y bloqueadas.");

if (failures.length) {
  console.error(`EPIVIDA Lite operational alerts validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite operational alerts validation OK");

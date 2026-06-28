import { button, el } from "../../components/dom.js";
import { todayIso } from "../../lib/date.js";

export function expedientePrintModel(expediente = {}) {
  const patient = expediente.patient || {};
  const rounds = expediente.rounds || [];
  const devices = expediente.devices || [];
  const iaasRows = expediente.iaasRows || [];
  const cultures = expediente.cultures || [];
  const antimicrobials = expediente.antimicrobials || [];
  const auditRows = expediente.auditRows || [];
  return {
    title: "EXPEDIENTE CLINICO-EPIDEMIOLOGICO",
    generatedAt: new Date().toISOString(),
    patientName: patient.patientName || patient.name || patient.patientId || "Paciente",
    patientId: patient.patientId || patient.id || "",
    service: patient.service || patient.currentService || "SIN SERVICIO",
    bed: patient.bed || patient.currentBed || "S/C",
    admissionDate: patient.admissionDate || patient.currentAdmissionDate || "NA",
    state: patient.status || patient.currentState || "Sin estado",
    epidemiologicalDiagnosis: patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis || "Sin clasificar",
    hospitalDiagnosis: patient.currentDiagnosis || patient.hospitalDiagnosis || patient.diagnosis || "Sin diagnostico",
    observations: patient.observations || patient.pendingIssues || patient.notes || "Sin observaciones",
    counts: {
      devices: devices.length,
      activeDevices: (expediente.activeDevices || []).length,
      rounds: rounds.length,
      iaas: iaasRows.length,
      cultures: cultures.length,
      antimicrobials: antimicrobials.length,
      audit: auditRows.length
    },
    sections: {
      rounds: rounds.map(roundPrintRow),
      devices: devices.map(devicePrintRow),
      iaas: iaasRows.map(iaasPrintRow),
      cultures: cultures.map(culturePrintRow),
      antimicrobials: antimicrobials.map(antimicrobialPrintRow),
      audit: auditRows.slice(0, 20).map(auditPrintRow)
    }
  };
}

export function renderExpedientePrintPanel(expediente, state, redraw) {
  if (!state?.ready) return "";
  const model = expedientePrintModel(expediente);
  return el("section", { class: "expediente-print-panel" }, [
    el("div", { class: "toolbar screen-only" }, [
      button("Imprimir expediente", () => printPreparedExpediente(), { class: "primary" }),
      button("Cerrar impresion", () => {
        state.ready = false;
        redraw();
      }, { class: "ghost" })
    ]),
    renderPrintHeader(model),
    renderPatientSummary(model),
    renderPrintSection("Historial de rondas", ["Fecha", "Servicio/cama", "Estado", "Alertas", "Notas"], model.sections.rounds),
    renderPrintSection("Episodios de dispositivos", ["Tipo", "Instalacion", "Retiro", "Estado", "Detalles"], model.sections.devices),
    renderPrintSection("Seguimiento IAAS", ["Tipo", "Estado", "Inicio", "Criterios", "Seguimiento"], model.sections.iaas),
    renderPrintSection("Cultivos", ["Muestra", "Solicitud", "Estado", "Resultado", "Microorganismo"], model.sections.cultures),
    renderPrintSection("Antimicrobianos", ["Farmaco", "Inicio", "Fin", "Estado", "Indicacion"], model.sections.antimicrobials),
    renderPrintSection("Auditoria reciente", ["Fecha", "Modulo", "Accion", "Usuario", "Entidad"], model.sections.audit)
  ]);
}

function renderPrintHeader(model) {
  return el("div", { class: "expediente-print-head" }, [
    el("strong", {}, [model.title]),
    el("h2", {}, [model.patientName]),
    el("p", {}, [`${model.service} | Cama ${model.bed} | Ingreso ${model.admissionDate}`]),
    el("p", {}, [`Generado ${todayIso()} | ID ${model.patientId}`])
  ]);
}

function renderPatientSummary(model) {
  return el("section", { class: "expediente-print-section" }, [
    el("h3", {}, ["Resumen del paciente"]),
    el("div", { class: "expediente-print-counts" }, [
      ["Invasivos activos", model.counts.activeDevices],
      ["Episodios", model.counts.devices],
      ["Rondas", model.counts.rounds],
      ["IAAS", model.counts.iaas],
      ["Cultivos", model.counts.cultures],
      ["Antimicrobianos", model.counts.antimicrobials]
    ].map(([label, value]) => el("span", {}, [el("strong", {}, [String(value)]), ` ${label}`]))),
    el("table", { class: "print-summary-table" }, [
      el("tbody", {}, [
        ["Estado clinico", model.state],
        ["Dx epidemiologico", model.epidemiologicalDiagnosis],
        ["Dx hospitalario", model.hospitalDiagnosis],
        ["Observaciones", model.observations]
      ].map(([label, value]) => el("tr", {}, [
        el("th", {}, [label]),
        el("td", {}, [text(value)])
      ])))
    ])
  ]);
}

function renderPrintSection(title, headers, rows = []) {
  return el("section", { class: "expediente-print-section" }, [
    el("h3", {}, [title]),
    el("div", { class: "print-table-wrap" }, [
      el("table", { class: "print-report-table" }, [
        el("thead", {}, [el("tr", {}, headers.map(header => el("th", {}, [header])))]),
        el("tbody", {}, rows.length
          ? rows.map(row => el("tr", {}, row.map(cell => el("td", {}, [text(cell)]))))
          : [el("tr", {}, [el("td", { colspan: headers.length }, ["Sin registros cargados."])])])
      ])
    ])
  ]);
}

function roundPrintRow(row = {}) {
  return [
    row.date || row.roundDate || "",
    [row.service, row.bed].filter(Boolean).join(" / "),
    statusLabel(row.status),
    (row.alertsGenerated || []).join(" | "),
    row.notes || (row.activePendingIssues || []).join(" | ")
  ];
}

function devicePrintRow(row = {}) {
  return [
    row.deviceType || "",
    row.installationDate || "",
    row.removalDate || "Activo",
    row.status || (row.active === false ? "retirado" : "activo"),
    [row.anatomicalSite, row.preventivePackage, row.careStatus].filter(Boolean).join(" | ")
  ];
}

function iaasPrintRow(row = {}) {
  return [
    row.iaasType || "",
    row.status || "",
    row.onsetDate || "",
    row.criteria || row.probableOrigin || "",
    [row.followUp?.reviewDate, row.followUp?.evolution, row.followUp?.carePlan].filter(Boolean).join(" | ")
  ];
}

function culturePrintRow(row = {}) {
  return [
    row.sampleType || "",
    row.requestedAt || "",
    row.status || "",
    row.resultAt || "",
    row.organism || ""
  ];
}

function antimicrobialPrintRow(row = {}) {
  return [
    row.drug || "",
    row.startDate || "",
    row.endDate || "Activo",
    row.status || "",
    row.indication || row.notes || ""
  ];
}

function auditPrintRow(row = {}) {
  return [
    row.createdAt || "",
    row.module || "",
    row.actionType || "",
    row.userEmail || row.userId || "",
    row.entityId || row.entityType || ""
  ];
}

function statusLabel(value = "") {
  const map = {
    reviewed: "Revisado",
    revisado: "Revisado",
    alerta: "Alerta",
    incompleto: "Incompleto",
    pendiente: "Pendiente"
  };
  return map[value] || value || "Pendiente";
}

function printPreparedExpediente() {
  document.body.classList.add("printing-expediente-report");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-expediente-report"), 250);
}

function text(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim() || "NA";
}

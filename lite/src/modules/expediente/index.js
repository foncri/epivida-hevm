import { badge, el, link, table } from "../../components/dom.js";
import { emptyModule, stats } from "../../components/moduleLayout.js";
import { todayIso, normalizeDate } from "../../lib/date.js";
import { loadPatientExpediente } from "../../services/expedienteService.js";

export async function render({ route }) {
  const patientId = patientIdFromRoute(route.parts);
  if (!patientId) return emptyModule("Expediente", "Selecciona un paciente desde censo, ronda o seguimiento IAAS.");

  const expediente = await loadPatientExpediente(patientId);
  const patient = expediente?.patient;
  if (!patient) {
    return emptyModule("Paciente no encontrado", "El paciente pudo eliminarse del censo activo. Los datos clinico-operativos de ronda y paquetes se conservan en sus colecciones.");
  }

  const { devices, activeDevices, rounds, iaasRows: patientIaas, cultures, antimicrobials } = expediente;
  const latestRound = rounds.at(-1) || {};
  return el("div", { class: "expediente-page stack" }, [
    renderHero(patient),
    stats([
      [String(daysBetween(patient.admissionDate || patient.currentAdmissionDate, todayIso()) ?? "NA"), "Estancia dias"],
      [String(activeDevices.length), "Invasivos activos"],
      [String(devices.length), "Episodios"],
      [String(rounds.length), "Rondas"],
      [String(patientIaas.length), "IAAS activas"]
    ]),
    renderSummary(patient, latestRound),
    el("section", { class: "iaas-grid two" }, [
      renderDeviceTimelinePanel(devices),
      renderRoundTimelinePanel(rounds)
    ]),
    renderPackageReviewPanel(rounds),
    renderDeviceTable(devices),
    renderCultureTable(cultures),
    renderAntimicrobialTable(antimicrobials),
    renderRoundTable(rounds),
    renderIaasPanel(patientIaas)
  ]);
}

function patientIdFromRoute(parts = []) {
  if (parts[0] === "pacientes") return parts[1] || "";
  if (parts[0] === "expediente") return parts[1] || "";
  return "";
}

function renderHero(patient) {
  return el("section", { class: "iaas-panel follow-hero expediente-hero" }, [
    el("div", {}, [
      el("h1", {}, [`Expediente - ${patientLabel(patient)}`]),
      el("p", {}, [`${patientService(patient)} - Cama ${patientBed(patient)} - Ingreso ${patient.admissionDate || "NA"}`]),
      el("div", { class: "expediente-status-row" }, [
        badge(patient.status || patient.currentState || "Sin estado", "neutral"),
        badge(patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis || "Sin clasificar", "neutral")
      ])
    ]),
    el("div", { class: "report-actions" }, [
      link("#/censo-hospitalario", "Volver al censo", { class: "button ghost" }),
      link(`#/ronda/${todayIso()}/paciente/${patient.patientId}`, "Revisar ronda", { class: "button primary" })
    ])
  ]);
}

function renderSummary(patient, latestRound = {}) {
  const rows = [
    ["Nombre", patientLabel(patient)],
    ["Servicio actual", patientService(patient)],
    ["Cama actual", patientBed(patient)],
    ["Fecha de ingreso", patient.admissionDate || "NA"],
    ["Edad / sexo", `${patient.age ?? "S/E"} / ${patient.sex || "S/S"}`],
    ["Sector", patient.sector || "Sin sector"],
    ["Estado clinico", patient.status || patient.currentState || "Sin estado"],
    ["Dx hospitalario", patient.currentDiagnosis || patient.hospitalDiagnosis || "Sin diagnostico"],
    ["Dx epidemiologico", patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis || "Sin clasificar"],
    ["Ultima ronda", latestRound.date || latestRound.roundDate || "Sin ronda"],
    ["Notas ultima ronda", latestRound.notes || "Sin notas"],
    ["Observaciones", patient.observations || "Sin observaciones"]
  ];
  return el("section", { class: "iaas-panel expediente-summary-panel" }, [
    el("h2", {}, ["Datos completos del paciente"]),
    el("div", { class: "expediente-data-grid" }, rows.map(([label, value]) =>
      el("div", { class: "expediente-data-item" }, [
        el("span", {}, [label]),
        el("strong", {}, [String(value || "NA")])
      ])
    ))
  ]);
}

function renderDeviceTimelinePanel(devices) {
  return el("article", { class: "iaas-panel" }, [
    el("h2", {}, ["Linea de tiempo de invasivos"]),
    devices.length ? el("div", { class: "timeline-wrap" }, devices.map(device => renderDeviceTimelineRow(device))) : el("p", { class: "muted" }, ["Sin episodios de invasivos."])
  ]);
}

function renderDeviceTimelineRow(device) {
  const active = device.active !== false && !device.removalDate && device.status !== "retirado";
  return el("div", { class: "timeline-row" }, [
    el("span", {}, [device.deviceType || "Dispositivo"]),
    el("div", { class: "timeline-track" }, [el("i", { style: { width: active ? "80%" : "45%" } })]),
    el("small", {}, [`${device.installationDate || "NA"} -> ${device.removalDate || "Activo"}`])
  ]);
}

function renderRoundTimelinePanel(rounds) {
  return el("article", { class: "iaas-panel" }, [
    el("h2", {}, ["Estado por ronda"]),
    rounds.length ? el("div", { class: "round-timeline" }, rounds.map(round =>
      el("div", { class: `round-dot ${round.status || "pendiente"}` }, [
        el("strong", {}, [round.date || round.roundDate || "NA"]),
        el("span", {}, [statusLabel(round.status)])
      ])
    )) : el("p", { class: "muted" }, ["Aun no hay rondas registradas."])
  ]);
}

function renderPackageReviewPanel(rounds) {
  const packages = rounds.flatMap(round => (round.packageReviews || []).map(item => ({
    ...item,
    date: round.date || round.roundDate || ""
  })));
  return el("section", { class: "iaas-panel expediente-history-panel" }, [
    el("h2", {}, ["Paquetes preventivos revisados"]),
    table(["Fecha", "Paquete", "Dispositivo", "Cumplimiento", "Observaciones"], packages.map(item =>
      el("tr", {}, [
        el("td", {}, [item.date || "NA"]),
        el("td", {}, [item.packageType || ""]),
        el("td", {}, [item.deviceType || ""]),
        el("td", {}, [item.compliance || "Pendiente"]),
        el("td", {}, [truncate(item.observations || "", 160)])
      ])
    ))
  ]);
}

function renderDeviceTable(devices) {
  return el("section", { class: "iaas-panel expediente-history-panel" }, [
    el("h2", {}, ["Episodios de dispositivos"]),
    table(["Tipo", "Instalacion", "Retiro", "Estado", "Paquete", "Cuidado"], devices.map(device =>
      el("tr", {}, [
        el("td", {}, [device.deviceType || ""]),
        el("td", {}, [device.installationDate || "Datos incompletos"]),
        el("td", {}, [device.removalDate || "Activo"]),
        el("td", {}, [device.status || "activo"]),
        el("td", {}, [device.preventivePackage || ""]),
        el("td", {}, [device.careStatus || "no_valorado"])
      ])
    ))
  ]);
}

function renderCultureTable(cultures = []) {
  return el("section", { class: "iaas-panel expediente-history-panel" }, [
    el("h2", {}, ["Cultivos"]),
    table(["Fecha", "Muestra", "Estado", "Microorganismo", "Susceptibilidad"], cultures.map(culture =>
      el("tr", {}, [
        el("td", {}, [culture.requestedAt || "NA"]),
        el("td", {}, [culture.sampleType || ""]),
        el("td", {}, [culture.status || ""]),
        el("td", {}, [culture.organism || ""]),
        el("td", {}, [truncate(culture.susceptibility || "", 170)])
      ])
    ))
  ]);
}

function renderAntimicrobialTable(rows = []) {
  return el("section", { class: "iaas-panel expediente-history-panel" }, [
    el("h2", {}, ["Antimicrobianos"]),
    table(["Inicio", "Fin", "Farmaco", "Indicacion", "Estado"], rows.map(row =>
      el("tr", {}, [
        el("td", {}, [row.startDate || "NA"]),
        el("td", {}, [row.endDate || "Activo"]),
        el("td", {}, [row.drug || ""]),
        el("td", {}, [truncate(row.indication || "", 170)]),
        el("td", {}, [row.status || ""])
      ])
    ))
  ]);
}

function renderRoundTable(rounds) {
  return el("section", { class: "iaas-panel expediente-history-panel" }, [
    el("h2", {}, ["Historial de rondas y alertas"]),
    table(["Fecha", "Servicio", "Cama", "Estado", "Alertas", "Notas"], rounds.map(round =>
      el("tr", {}, [
        el("td", {}, [round.date || round.roundDate || "NA"]),
        el("td", {}, [round.service || "Sin servicio"]),
        el("td", {}, [round.bed || "S/C"]),
        el("td", {}, [statusLabel(round.status)]),
        el("td", {}, [truncate((round.alertsGenerated || []).join(" | "), 170)]),
        el("td", {}, [truncate(round.notes || "", 170)])
      ])
    ))
  ]);
}

function renderIaasPanel(rows) {
  return el("section", { class: "iaas-panel expediente-history-panel" }, [
    el("h2", {}, ["Seguimiento IAAS diario"]),
    table(["Tipo", "Estado", "Fecha inicio", "Origen probable", "Notas"], rows.map(row =>
      el("tr", {}, [
        el("td", {}, [row.iaasType || ""]),
        el("td", {}, [row.status || ""]),
        el("td", {}, [row.onsetDate || ""]),
        el("td", {}, [row.probableOrigin || ""]),
        el("td", {}, [truncate(row.notes || "", 170)])
      ])
    ))
  ]);
}

function patientLabel(patient = {}) {
  return patient.patientName || patient.name || patient.fullName || patient.patientId || "Paciente";
}

function patientService(patient = {}) {
  return patient.service || patient.currentService || "SIN SERVICIO";
}

function patientBed(patient = {}) {
  return patient.bed || patient.currentBed || "S/C";
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

function daysBetween(start, end) {
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (!startDate || !endDate) return null;
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.floor((endMs - startMs) / 86400000));
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}...` : text;
}

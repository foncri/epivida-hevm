import { badge, button, el, link, table } from "../../components/dom.js";
import { todayIso, normalizeDate } from "../../lib/date.js";
import {
  renderAntimicrobialPanel,
  renderAuditPanel,
  renderCulturePanel,
  renderDevicePanel,
  renderIaasPanel,
  renderRoundPanel
} from "./eventPanels.js";

const SECTION_CONFIG = [
  ["resumen", "Resumen"],
  ["dispositivos", "Dispositivos"],
  ["cultivos", "Cultivos"],
  ["antimicrobianos", "Antimicrobianos"],
  ["rondas", "Rondas"],
  ["iaas", "IAAS"],
  ["auditoria", "Auditoria"]
];

export function renderHero(patient, actions = {}) {
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
      actions.onPrint ? button("Preparar impresion", actions.onPrint, { class: "ghost" }) : "",
      link(`#/ronda/${todayIso()}/paciente/${patient.patientId}`, "Revisar ronda", { class: "button primary" })
    ])
  ]);
}

export function renderSummary(patient, latestRound = {}) {
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

export function renderExpedienteSections(patientId, expediente, state = {}) {
  state.section ||= "resumen";
  const root = el("section", { class: "iaas-panel expediente-sections-panel" });

  function redraw() {
    root.replaceChildren(
      renderSectionTabs(expediente, state.section, key => {
        state.section = key;
        redraw();
      }),
      renderSelectedSection(patientId, expediente, state.section)
    );
  }

  redraw();
  return root;
}

function renderSectionTabs(expediente, activeKey, onSelect) {
  return el("div", { class: "expediente-tabs", role: "tablist" }, SECTION_CONFIG.map(([key, label]) =>
    button(`${label} ${sectionCountLabel(expediente, key)}`, () => onSelect(key), {
      class: `small ${key === activeKey ? "primary" : "ghost"}`,
      role: "tab",
      "aria-selected": key === activeKey
    })
  ));
}

function renderSelectedSection(patientId, expediente, key) {
  if (key === "dispositivos") return renderDevicePanel(patientId, expediente.devices, expediente.pages?.archivedDevices);
  if (key === "cultivos") return renderCulturePanel(patientId, expediente.cultures, expediente.pages?.cultures);
  if (key === "antimicrobianos") return renderAntimicrobialPanel(patientId, expediente.antimicrobials, expediente.pages?.antimicrobials);
  if (key === "rondas") return renderRoundPanel(patientId, expediente.rounds, expediente.pages?.rounds);
  if (key === "iaas") return renderIaasPanel(patientId, expediente.iaasRows, expediente.pages?.iaasRows);
  if (key === "auditoria") return renderAuditPanel(patientId, expediente.auditRows, expediente.pages?.auditRows);
  return el("div", { class: "stack" }, [
    el("section", { class: "iaas-grid two" }, [
      renderDeviceTimelinePanel(expediente.devices),
      renderRoundTimelinePanel(expediente.rounds)
    ]),
    renderPackageReviewPanel(expediente.rounds)
  ]);
}

function sectionCountLabel(expediente, key) {
  const counts = {
    resumen: "",
    dispositivos: expediente.devices?.length,
    cultivos: expediente.cultures?.length,
    antimicrobianos: expediente.antimicrobials?.length,
    rondas: expediente.rounds?.length,
    iaas: expediente.iaasRows?.length,
    auditoria: expediente.auditRows?.length
  };
  return counts[key] === "" || counts[key] === undefined ? "" : `(${counts[key]})`;
}

function renderDeviceTimelinePanel(devices = []) {
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

function renderRoundTimelinePanel(rounds = []) {
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

function renderPackageReviewPanel(rounds = []) {
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

export function patientLabel(patient = {}) {
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

export function daysBetween(start, end) {
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (!startDate || !endDate) return null;
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.floor((endMs - startMs) / 86400000));
}

function compactJson(value) {
  if (!value || typeof value !== "object") return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}...` : text;
}

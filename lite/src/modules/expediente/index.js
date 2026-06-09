import { badge, button, el, link, notice, table } from "../../components/dom.js";
import { emptyModule, stats } from "../../components/moduleLayout.js";
import { todayIso, normalizeDate } from "../../lib/date.js";
import { loadExpedienteSectionPage, loadPatientExpediente } from "../../services/expedienteService.js";

export async function render({ route }) {
  const patientId = patientIdFromRoute(route.parts);
  if (!patientId) return emptyModule("Expediente", "Selecciona un paciente desde censo, ronda o seguimiento IAAS.");

  const expediente = await loadPatientExpediente(patientId);
  const patient = expediente?.patient;
  if (!patient) {
    return emptyModule("Paciente no encontrado", "El paciente pudo eliminarse del censo activo. Los datos clinico-operativos de ronda y paquetes se conservan en sus colecciones.");
  }

  const { devices, activeDevices, rounds, iaasRows: patientIaas, cultures, antimicrobials, auditRows, pages = {} } = expediente;
  const latestRound = rounds[0] || {};
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
    renderDeviceTable(patientId, devices, pages.archivedDevices),
    renderCultureTable(patientId, cultures, pages.cultures),
    renderAntimicrobialTable(patientId, antimicrobials, pages.antimicrobials),
    renderRoundTable(patientId, rounds, pages.rounds),
    renderIaasPanel(patientId, patientIaas, pages.iaasRows),
    renderAuditTable(patientId, auditRows, pages.auditRows)
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

function renderDeviceTable(patientId, devices, pageInfo) {
  return renderCursorTablePanel({
    patientId,
    sectionKey: "archivedDevices",
    title: "Episodios de dispositivos",
    loadLabel: "Cargar mas retirados",
    pageInfo,
    initialRows: devices,
    rowKey: row => row.episodeId || row.id,
    headers: ["Tipo", "Instalacion", "Retiro", "Estado", "Paquete", "Cuidado"],
    rowRenderer: device => el("tr", {}, [
      el("td", {}, [device.deviceType || ""]),
      el("td", {}, [device.installationDate || "Datos incompletos"]),
      el("td", {}, [device.removalDate || "Activo"]),
      el("td", {}, [device.status || "activo"]),
      el("td", {}, [device.preventivePackage || ""]),
      el("td", {}, [device.careStatus || "no_valorado"])
    ])
  });
}

function renderCultureTable(patientId, cultures = [], pageInfo) {
  return renderCursorTablePanel({
    patientId,
    sectionKey: "cultures",
    title: "Cultivos",
    loadLabel: "Cargar mas cultivos",
    pageInfo,
    initialRows: cultures,
    rowKey: row => row.cultureId || row.id,
    headers: ["Fecha", "Muestra", "Estado", "Microorganismo", "Susceptibilidad"],
    rowRenderer: culture => el("tr", {}, [
      el("td", {}, [culture.requestedAt || "NA"]),
      el("td", {}, [culture.sampleType || ""]),
      el("td", {}, [culture.status || ""]),
      el("td", {}, [culture.organism || ""]),
      el("td", {}, [truncate(culture.susceptibility || "", 170)])
    ])
  });
}

function renderAntimicrobialTable(patientId, rows = [], pageInfo) {
  return renderCursorTablePanel({
    patientId,
    sectionKey: "antimicrobials",
    title: "Antimicrobianos",
    loadLabel: "Cargar mas antimicrobianos",
    pageInfo,
    initialRows: rows,
    rowKey: row => row.antimicrobialId || row.id,
    headers: ["Inicio", "Fin", "Farmaco", "Indicacion", "Estado"],
    rowRenderer: row => el("tr", {}, [
      el("td", {}, [row.startDate || "NA"]),
      el("td", {}, [row.endDate || "Activo"]),
      el("td", {}, [row.drug || ""]),
      el("td", {}, [truncate(row.indication || "", 170)]),
      el("td", {}, [row.status || ""])
    ])
  });
}

function renderRoundTable(patientId, rounds, pageInfo) {
  return renderCursorTablePanel({
    patientId,
    sectionKey: "rounds",
    title: "Historial de rondas y alertas",
    loadLabel: "Cargar mas rondas",
    pageInfo,
    initialRows: rounds,
    rowKey: row => row.roundId || row.id || `${row.date || row.roundDate}_${row.patientId}`,
    headers: ["Fecha", "Servicio", "Cama", "Estado", "Alertas", "Notas"],
    rowRenderer: round => el("tr", {}, [
      el("td", {}, [round.date || round.roundDate || "NA"]),
      el("td", {}, [round.service || "Sin servicio"]),
      el("td", {}, [round.bed || "S/C"]),
      el("td", {}, [statusLabel(round.status)]),
      el("td", {}, [truncate((round.alertsGenerated || []).join(" | "), 170)]),
      el("td", {}, [truncate(round.notes || "", 170)])
    ])
  });
}

function renderIaasPanel(patientId, rows, pageInfo) {
  return renderCursorTablePanel({
    patientId,
    sectionKey: "iaasRows",
    title: "Seguimiento IAAS diario",
    loadLabel: "Cargar mas IAAS",
    pageInfo,
    initialRows: rows,
    rowKey: row => row.iaasId || row.id,
    headers: ["Tipo", "Estado", "Fecha inicio", "Origen probable", "Criterios", "Seguimiento"],
    rowRenderer: row => el("tr", {}, [
      el("td", {}, [row.iaasType || ""]),
      el("td", {}, [row.status || ""]),
      el("td", {}, [row.onsetDate || ""]),
      el("td", {}, [row.probableOrigin || ""]),
      el("td", {}, [truncate(row.criteria || "", 170)]),
      el("td", {}, [truncate(iaasFollowUpText(row), 220)])
    ])
  });
}

function iaasFollowUpText(row = {}) {
  return [
    row.followUp?.reviewDate ? `Fecha ${row.followUp.reviewDate}` : "",
    row.followUp?.evolution || "",
    row.followUp?.carePlan ? `Plan: ${row.followUp.carePlan}` : "",
    row.vitalSigns?.temperature ? `Temp ${row.vitalSigns.temperature}` : "",
    row.labs?.biometry ? `BH ${row.labs.biometry}` : "",
    row.labs?.ego ? `EGO ${row.labs.ego}` : "",
    row.notes || ""
  ].filter(Boolean).join(" | ");
}

function renderAuditTable(patientId, rows = [], pageInfo) {
  return renderCursorTablePanel({
    patientId,
    sectionKey: "auditRows",
    title: "Auditoria relacionada",
    loadLabel: "Cargar mas auditoria",
    pageInfo,
    initialRows: rows,
    rowKey: row => row.auditId || row.id,
    headers: ["Fecha", "Modulo", "Accion", "Usuario", "Entidad"],
    rowRenderer: row => el("tr", {}, [
      el("td", {}, [row.createdAt || "NA"]),
      el("td", {}, [row.module || ""]),
      el("td", {}, [row.actionType || ""]),
      el("td", {}, [row.userEmail || row.userId || ""]),
      el("td", {}, [row.entityType || row.entityId || ""])
    ])
  });
}

function renderCursorTablePanel({ patientId, sectionKey, title, loadLabel, pageInfo = {}, initialRows = [], rowKey, headers, rowRenderer }) {
  const rows = [...initialRows];
  const cursorState = { ...pageInfo };
  const tableMount = el("div");
  const status = el("div", { class: "expediente-pagination-status" });
  const root = el("section", { class: "iaas-panel expediente-history-panel" }, [
    el("div", { class: "expediente-history-header" }, [
      el("h2", {}, [title]),
      el("span", { class: "muted" }, [`${rows.length} registros cargados`])
    ]),
    tableMount,
    status
  ]);

  function renderRows() {
    tableMount.replaceChildren(table(headers, rows.map(rowRenderer)));
    status.replaceChildren();
    if (cursorState.hasNext) {
      status.append(button(loadLabel, loadMore, { class: "small ghost" }));
    } else if (rows.length >= (cursorState.pageSize || 50)) {
      status.append(el("p", { class: "muted" }, ["No hay mas registros en esta pagina."]));
    }
  }

  async function loadMore() {
    const trigger = status.querySelector("button");
    if (trigger) {
      trigger.disabled = true;
      trigger.textContent = "Cargando...";
    }
    try {
      const page = await loadExpedienteSectionPage(patientId, sectionKey, { ...cursorState, direction: "next" });
      appendUniqueRows(rows, page.rows || [], rowKey);
      Object.assign(cursorState, {
        firstCursor: page.firstCursor || cursorState.firstCursor,
        lastCursor: page.lastCursor || null,
        hasNext: Boolean(page.hasNext),
        hasPrevious: Boolean(page.hasPrevious),
        pageSize: page.pageSize || cursorState.pageSize || 50
      });
      renderRows();
    } catch (error) {
      status.replaceChildren(notice(error.message || "No se pudo cargar mas historial.", "error"));
    }
  }

  renderRows();
  return root;
}

function appendUniqueRows(rows, nextRows = [], rowKey) {
  const seen = new Set(rows.map(row => rowKey(row)).filter(Boolean));
  nextRows.forEach(row => {
    const key = rowKey(row);
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    rows.push(row);
  });
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

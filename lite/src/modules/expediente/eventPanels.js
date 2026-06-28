import { badge, button, el, link, notice } from "../../components/dom.js";
import { todayIso } from "../../lib/date.js";
import { loadExpedienteSectionPage } from "../../services/expedienteService.js";
import { iaasClinicalTimelineTable, summarizeIaasCustomStudies } from "../../services/iaasService.js";

export function renderDevicePanel(patientId, devices = [], pageInfo) {
  return renderCursorEventPanel({
    patientId,
    sectionKey: "archivedDevices",
    title: "Episodios de dispositivos",
    loadLabel: "Cargar mas retirados",
    pageInfo,
    initialRows: devices,
    rowKey: row => row.episodeId || row.id,
    summary: device => [
      device.deviceType || "Dispositivo",
      `${device.installationDate || "NA"} -> ${device.removalDate || "Activo"}`,
      device.status || "activo"
    ],
    details: device => [
      ["Paquete", device.preventivePackage],
      ["Sitio", device.anatomicalSite],
      ["French", device.french],
      ["Cuidado", device.careStatus || "no_valorado"],
      ["Signos infeccion", device.infectionSigns ? "Si" : "No"],
      ["Folio", device.episodeId || device.id]
    ],
    actions: device => [
      link(devicePatientHref(device.patientId || patientId), "Editar en Dispositivos", { class: "button ghost small" }),
      link(`#/ronda/${todayIso()}/paciente/${device.patientId || patientId}`, "Revisar ronda", { class: "button ghost small" })
    ]
  });
}

export function renderCulturePanel(patientId, cultures = [], pageInfo) {
  return renderCursorEventPanel({
    patientId,
    sectionKey: "cultures",
    title: "Cultivos",
    loadLabel: "Cargar mas cultivos",
    pageInfo,
    initialRows: cultures,
    rowKey: row => row.cultureId || row.id,
    summary: culture => [culture.sampleType || "Cultivo", culture.requestedAt || "NA", culture.status || ""],
    details: culture => [
      ["Resultado", culture.resultAt],
      ["Microorganismo", culture.organism],
      ["Susceptibilidad", culture.susceptibility],
      ["Caso IAAS", culture.iaasId],
      ["Folio", culture.cultureId || culture.id]
    ],
    actions: culture => [
      link(iaasPatientHref(culture.patientId || patientId, culture.requestedAt || culture.resultAt), "Editar en EPI-IAAS", { class: "button ghost small" }),
      culture.iaasId ? link(iaasPatientHref(culture.patientId || patientId, culture.requestedAt || culture.resultAt), "Abrir seguimiento", { class: "button ghost small" }) : ""
    ]
  });
}

export function renderAntimicrobialPanel(patientId, rows = [], pageInfo) {
  return renderCursorEventPanel({
    patientId,
    sectionKey: "antimicrobials",
    title: "Antimicrobianos",
    loadLabel: "Cargar mas antimicrobianos",
    pageInfo,
    initialRows: rows,
    rowKey: row => row.antimicrobialId || row.id,
    summary: row => [row.drug || "Antimicrobiano", `${row.startDate || "NA"} -> ${row.endDate || "Activo"}`, row.status || ""],
    details: row => [
      ["Indicacion", row.indication],
      ["Caso IAAS", row.iaasId],
      ["Notas", row.notes],
      ["Folio", row.antimicrobialId || row.id]
    ],
    actions: row => [link(iaasPatientHref(row.patientId || patientId, row.startDate), "Editar en EPI-IAAS", { class: "button ghost small" })]
  });
}

export function renderRoundPanel(patientId, rounds = [], pageInfo) {
  return renderCursorEventPanel({
    patientId,
    sectionKey: "rounds",
    title: "Historial de rondas y alertas",
    loadLabel: "Cargar mas rondas",
    pageInfo,
    initialRows: rounds,
    rowKey: row => row.roundId || row.id || `${row.date || row.roundDate}_${row.patientId}`,
    summary: round => [round.date || round.roundDate || "Ronda", `${round.service || "Sin servicio"} / ${round.bed || "S/C"}`, statusLabel(round.status)],
    details: round => [
      ["Alertas", (round.alertsGenerated || []).join(" | ")],
      ["Pendientes", (round.activePendingIssues || []).join(" | ")],
      ["Acciones", (round.savedActions || []).join(" | ")],
      ["Notas", round.notes],
      ["Paquetes", (round.packageReviews || []).map(item => `${item.packageType}: ${item.compliance || "Pendiente"}`).join(" | ")]
    ],
    actions: round => [link(`#/ronda/${round.date || round.roundDate || todayIso()}/paciente/${patientId}`, "Editar registro completo", { class: "button ghost small" })]
  });
}

export function renderIaasPanel(patientId, rows = [], pageInfo) {
  return renderCursorEventPanel({
    patientId,
    sectionKey: "iaasRows",
    title: "Seguimiento IAAS diario",
    loadLabel: "Cargar mas IAAS",
    pageInfo,
    initialRows: rows,
    rowKey: row => row.iaasId || row.id,
    summary: row => [row.iaasType || "IAAS", row.status || "", row.onsetDate || ""],
    details: row => [
      ["Origen probable", row.probableOrigin],
      ["Criterios", row.criteria],
      ["Seguimiento", iaasFollowUpText(row)],
      ["Historial diario", iaasDailyHistoryText(row)],
      ["Folio", row.iaasId || row.id]
    ],
    actions: row => [link(iaasPatientHref(row.patientId || patientId, row.onsetDate || row.followUp?.reviewDate), "Editar en EPI-IAAS", { class: "button ghost small" })]
  });
}

export function renderAuditPanel(patientId, rows = [], pageInfo) {
  return renderCursorEventPanel({
    patientId,
    sectionKey: "auditRows",
    title: "Auditoria relacionada",
    loadLabel: "Cargar mas auditoria",
    pageInfo,
    initialRows: rows,
    rowKey: row => row.auditId || row.id,
    summary: row => [row.actionType || "Evento", row.createdAt || "NA", row.module || ""],
    details: row => [
      ["Usuario", row.userEmail || row.userId],
      ["Entidad", row.entityType || row.entityId],
      ["Antes", compactJson(row.before)],
      ["Despues", compactJson(row.after)]
    ],
    actions: () => []
  });
}

function renderCursorEventPanel({ patientId, sectionKey, title, loadLabel, pageInfo = {}, initialRows = [], rowKey, summary, details, actions }) {
  const rows = [...initialRows];
  const cursorState = { ...pageInfo };
  const listMount = el("div");
  const status = el("div", { class: "expediente-pagination-status" });
  const countLabel = el("span", { class: "muted" }, [`${rows.length} registros cargados`]);
  const root = el("section", { class: "expediente-history-panel" }, [
    el("div", { class: "expediente-history-header" }, [
      el("h2", {}, [title]),
      countLabel
    ]),
    listMount,
    status
  ]);

  function renderRows() {
    countLabel.textContent = `${rows.length} registros cargados`;
    listMount.replaceChildren(rows.length
      ? el("div", { class: "expediente-event-list" }, rows.map(row => renderEventCard(row, rowKey, summary, details, actions)))
      : el("p", { class: "muted" }, ["Sin registros."]));
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

function renderEventCard(row, rowKey, summary, details, actions) {
  const [title, subtitle, tone] = summary(row);
  return el("details", { class: "expediente-event-card" }, [
    el("summary", {}, [
      el("span", {}, [title || "Evento"]),
      el("small", {}, [subtitle || rowKey(row) || "Sin folio"]),
      tone ? badge(tone, tone === "activo" ? "ok" : "neutral") : ""
    ]),
    el("div", { class: "expediente-event-body" }, [
      el("div", { class: "expediente-data-grid compact" }, details(row).map(([label, value]) =>
        el("div", { class: "expediente-data-item" }, [
          el("span", {}, [label]),
          el("strong", {}, [truncate(value || "NA", 260)])
        ])
      )),
      el("div", { class: "preventive-history-actions" }, actions(row).filter(Boolean))
    ])
  ]);
}

function iaasFollowUpText(row = {}) {
  return [
    row.followUp?.reviewDate ? `Fecha ${row.followUp.reviewDate}` : "",
    row.followUp?.evolution || "",
    row.followUp?.carePlan ? `Plan: ${row.followUp.carePlan}` : "",
    row.vitalSigns?.temperature ? `Temp ${row.vitalSigns.temperature}` : "",
    row.labs?.biometry ? `BH ${row.labs.biometry}` : "",
    row.labs?.ego ? `EGO ${row.labs.ego}` : "",
    row.labs?.otherStudies || summarizeIaasCustomStudies(row.labs?.customStudies),
    row.notes || ""
  ].filter(Boolean).join(" | ");
}

function iaasDailyHistoryText(row = {}) {
  const table = iaasClinicalTimelineTable(row, {
    cultures: row.relatedCultures,
    antimicrobials: row.relatedAntimicrobials
  });
  return table.dates.slice(-3).map(date => {
    const index = table.dates.indexOf(date);
    const values = table.rows
      .map(item => item.values[index] ? `${item.label}: ${item.values[index]}` : "")
      .filter(Boolean)
      .slice(0, 4)
      .join("; ");
    return values ? `${date}: ${values}` : "";
  }).filter(Boolean).join(" | ");
}

function iaasPatientHref(patientId = "", date = todayIso()) {
  return patientId ? `#/seguimiento-iaas/${date || todayIso()}/paciente/${patientId}` : "#/epi-iaas";
}

function devicePatientHref(patientId = "") {
  return patientId ? `#/dispositivos/paciente/${encodeURIComponent(patientId)}` : "#/dispositivos";
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

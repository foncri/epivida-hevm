import { badge, button, el, link } from "../../components/dom.js";
import { normalizeDate } from "../../lib/date.js";
import { deviceDisplayName, packageLabel, packageReviewSummary, packageTone, preventiveCompliance } from "../../services/preventivePackageService.js";
import { patientBed, patientDiagnosis, patientLabel, patientService } from "./roundHelpers.js";
import { daysBetween, deviceActiveOnDate, isPePackageType, roundPatientHref, statusLabel, truncate } from "./roundPatientUtils.js";
import { draftFromRound } from "./saveRoundFlow.js";

export function renderPatientRoundSummary(patient, date) {
  const stay = daysBetween(patient.admissionDate || patient.currentAdmissionDate, date);
  return el("section", { class: "iaas-panel patient-sticky-summary" }, [
    el("div", { class: "patient-summary-main" }, [
      link(`#/ronda/${date}`, "Volver al servicio", { class: "back-link" }),
      el("h1", {}, [`Cama ${patientBed(patient)} - ${patientLabel(patient)}`]),
      el("p", {}, [`${patientService(patient)} - Estancia: ${stay ?? "NA"} dias`]),
      el("small", {}, [patientDiagnosis(patient) || "Sin diagnostico registrado"])
    ]),
    el("div", { class: "patient-summary-side" }, [
      badge(patient.currentRiskLevel || patient.riskLevel || "Sin riesgo", "neutral")
    ])
  ]);
}

export function renderSavedRoundPanel(round, draft, redraw) {
  const actionLines = savedRoundActionLines(round);
  if (!round?.packageReviews?.length && !round?.notes && !round?.pendingIssuesAdded?.length && !actionLines.length) return "";
  const reviews = round.packageReviews || [];
  return el("section", { class: "iaas-panel saved-round-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Revision guardada de hoy"]),
        el("p", {}, ["La captura previa se carga para edicion; guardar vuelve a sincronizar la revision de esta cama."])
      ]),
      badge(statusLabel(round.status), round.status === "alerta" ? "bad" : round.status === "incompleto" ? "warn" : "ok")
    ]),
    reviews.length ? el("div", { class: "preventive-history-grid" }, reviews.map(review => renderPreventiveReviewCard(review, round.date || round.roundDate))) : "",
    actionLines.length ? el("div", { class: "saved-action-list" }, actionLines.map(line => el("span", {}, [line]))) : "",
    round.pendingIssuesAdded?.length ? el("p", { class: "muted" }, [`Pendientes: ${round.pendingIssuesAdded.join(" | ")}`]) : "",
    round.notes ? el("p", { class: "muted" }, [`Notas: ${round.notes}`]) : "",
    el("div", { class: "toolbar" }, [
      button("Recargar revision guardada", () => {
        Object.assign(draft, draftFromRound(round, round.date || round.roundDate, round.patientId));
        redraw();
      }, { class: "ghost small" })
    ])
  ]);
}

export function savedRoundActionLines(round = {}) {
  const lines = [];
  if (round.patientMovement?.toService || round.patientMovement?.toBed) {
    lines.push(`Movimiento: ${round.patientMovement.fromService || "S/S"} / ${round.patientMovement.fromBed || "S/C"} -> ${round.patientMovement.toService || "S/S"} / ${round.patientMovement.toBed || "S/C"}`);
  }
  if (round.quickDischarge?.enabled) {
    lines.push(`Alta: ${round.quickDischarge.date || "S/F"} - ${round.quickDischarge.type || "SIN DATO"} - ${round.quickDischarge.shift || "SIN TURNO"}`);
  }
  if (round.generalObservations) {
    lines.push(`Observacion general: ${truncate(round.generalObservations, 120)}`);
  }
  return lines;
}

function renderPreventiveReviewCard(review = {}, date = "") {
  const fields = review.reviewedFields || Object.entries(review.preventiveChecks || {}).map(([key, value]) => ({ key, label: key, value }));
  return el("article", { class: `preventive-history-card ${packageTone(review.packageType)}` }, [
    el("strong", {}, [review.packageType || "Paquete preventivo"]),
    el("span", {}, [`Cumplimiento: ${review.compliance || preventiveCompliance(review.preventiveChecks || {}) || "Pendiente"}`]),
    el("span", {}, [`Fecha: ${review.reviewDate || date || "S/D"}`]),
    review.deviceType ? el("span", {}, [`Dispositivo: ${review.deviceType}`]) : "",
    review.french ? el("span", {}, [`French: ${review.french}`]) : "",
    fields.length ? el("ul", {}, fields.map(field =>
      el("li", {}, [`${field.label || field.key}: ${field.value || "Sin dato"}`])
    )) : "",
    review.observations ? el("small", {}, [review.observations]) : ""
  ]);
}

export function renderPeSummaryPanel(patientId, date, rounds, draft) {
  const peReviews = peSummaryItems(patientId, date, rounds, draft);
  if (!peReviews.length) return "";
  return el("section", { class: "iaas-panel pe-summary-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["P.E. y P.B.M.T."]),
        el("p", {}, ["Historial rapido de precauciones estandar y medidas basadas en transmision."])
      ]),
      badge(`${peReviews.length} registro(s)`, "neutral")
    ]),
    el("div", { class: "preventive-history-grid pe-summary-grid" }, peReviews.map(item =>
      el("article", { class: `preventive-history-card pe-summary-card ${item.source === "draft" ? "draft" : ""}` }, [
        el("strong", {}, [packageLabel(item.packageType)]),
        el("span", {}, [`Fecha: ${item.reviewDate || item.date || "S/D"}`]),
        el("span", {}, [`Cumplimiento: ${item.compliance || preventiveCompliance(item.preventiveChecks || {}) || "Pendiente"}`]),
        item.source === "draft" ? badge("En captura", "warn") : "",
        item.observations ? el("small", {}, [item.observations]) : ""
      ])
    ))
  ]);
}

export function renderDailyPreventiveHistoryPanel(activeDateValue, patientId, rounds = [], devices = []) {
  const rows = preventiveHistoryRounds(rounds);
  if (!rows.length) return "";
  return el("section", { class: "iaas-panel daily-preventive-history-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Historial preventivo por dia"]),
        el("p", {}, ["Paquetes e invasivos registrados para esta cama/paciente, ordenados del mas reciente al mas antiguo."])
      ]),
      badge(`${rows.length} dia(s)`, "neutral")
    ]),
    el("div", { class: "preventive-history-days" }, rows.map(round => renderPreventiveHistoryDay(activeDateValue, patientId, round, devices)))
  ]);
}

function renderPreventiveHistoryDay(activeDateValue, patientId, round, devices = []) {
  const date = roundReviewDate(round);
  const reviews = round.packageReviews || [];
  const dayDevices = devices.filter(device => deviceActiveOnDate(device, date));
  const actionLines = savedRoundActionLines(round);
  return el("details", { class: "preventive-history-day", open: date === activeDateValue }, [
    el("summary", {}, [
      el("span", {}, [date || "Sin fecha"]),
      el("small", {}, [`${reviews.length} paquete(s), ${dayDevices.length} invasivo(s)`])
    ]),
    el("div", { class: "preventive-history-content" }, [
      reviews.length
        ? el("div", { class: "preventive-history-grid" }, reviews.map(review => renderPreventiveReviewCard(review, date)))
        : el("p", { class: "muted" }, ["Sin paquetes capturados ese dia."]),
      actionLines.length ? el("div", { class: "saved-action-list" }, actionLines.map(line => el("span", {}, [line]))) : "",
      dayDevices.length ? el("div", { class: "preventive-history-grid" }, dayDevices.map(renderPreventiveDeviceHistoryCard)) : "",
      el("div", { class: "preventive-history-actions" }, [
        link(roundPatientHref(date || activeDateValue, patientId), "Editar registro completo", { class: "button ghost small" })
      ])
    ])
  ]);
}

function renderPreventiveDeviceHistoryCard(device = {}) {
  return el("article", { class: "preventive-history-card preventive-device-history-card" }, [
    el("strong", {}, [deviceDisplayName(device)]),
    el("span", {}, [`French: ${device.french || device.deviceFrench || "S/D"}`]),
    el("span", {}, [`Instalacion: ${normalizeDate(device.installationDate) || "S/D"}`]),
    el("span", {}, [`Retiro: ${normalizeDate(device.removalDate) || "Activo"}`]),
    device.preventivePackage ? badge(device.preventivePackage, "device") : ""
  ]);
}

export function peSummaryItems(patientId, date, rounds = [], draft = null) {
  const byKey = new Map();
  const add = (item, source, fallbackDate = date) => {
    if (!isPePackageType(item?.packageType)) return;
    const reviewDate = normalizeDate(item.reviewDate || item.roundDate || item.date) || fallbackDate || "";
    const key = item.packageReviewId || `${source}|${reviewDate}|${JSON.stringify(item.preventiveChecks || {})}`;
    byKey.set(key, { ...item, source, reviewDate });
  };
  rounds
    .filter(round => round.patientId === patientId)
    .forEach(round => (round.packageReviews || []).forEach(review => add(review, "saved", round.date || round.roundDate)));
  (draft?.deviceDrafts || [])
    .forEach(device => add({
      ...packageReviewSummary(device),
      packageReviewId: device.packageReviewId || device.draftId || "",
      reviewDate: device.reviewDate || date
    }, "draft", date));
  return [...byKey.values()]
    .sort((a, b) => String(b.reviewDate || "").localeCompare(String(a.reviewDate || "")));
}

export function upsertRoundById(rows = [], round = null) {
  const map = new Map();
  [...(rows || []), round].filter(Boolean).forEach(item => {
    map.set(roundRowKey(item), item);
  });
  return [...map.values()].sort((a, b) => String(roundReviewDate(b)).localeCompare(String(roundReviewDate(a))));
}

export function preventiveHistoryRounds(rounds = []) {
  return upsertRoundById(rounds)
    .filter(round => roundReviewDate(round)
      || round.packageReviews?.length
      || savedRoundActionLines(round).length
      || round.notes
      || round.pendingIssuesAdded?.length);
}

function roundRowKey(round = {}) {
  return round.roundId || round.id || `${roundReviewDate(round)}_${round.patientId || ""}`;
}

export function roundReviewDate(round = {}) {
  return normalizeDate(round.date || round.roundDate || round.reviewDate) || round.date || round.roundDate || round.reviewDate || "";
}

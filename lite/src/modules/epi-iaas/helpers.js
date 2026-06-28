import { badge, el } from "../../components/dom.js";
import { todayIso } from "../../lib/date.js";
import { listAntimicrobialsForIaas } from "../../services/antimicrobialService.js";
import { listCulturesForIaas } from "../../services/cultureService.js";
import { validateIaasClinicalCompleteness } from "../../services/iaasCriteriaService.js";
import { iaasClinicalRevisionHistory, iaasClinicalTimelineTable, iaasVitalTrendSeries, normalizeIaasClinicalFollowUp } from "../../services/iaasService.js";
import { opdEligibilityForIaasCase, opdFromFormData, opdHasContent, opdStatus } from "../../services/opdService.js";

export const IAAS_STATUS = [["sospecha", "Sospecha"], ["probable", "Probable"], ["confirmada", "Confirmada"], ["descartada", "Descartada"]];

export function syncMessage(saved = {}, label = "IAAS guardada") {
  const pending = saved.syncStatus === "local_pending" || saved.patientClassificationSyncStatus === "local_pending";
  if (saved.patientClassificationSyncStatus === "error") return `${label}, pero no se pudo sincronizar la clasificacion del paciente.`;
  return pending
    ? `${label} localmente; IAAS y clasificacion del paciente quedan pendientes de sincronizar.`
    : `${label}; IAAS y clasificacion del paciente sincronizadas.`;
}

export function patientOptions(patients) {
  return [["", "Seleccionar"], ...patients.map(patient => [
    patient.patientId,
    `${patient.bed || patient.currentBed || "S/C"} - ${patient.patientName || patient.patientId}`
  ])];
}

export function patientName(patients, patientId) {
  const patient = patients.find(row => row.patientId === patientId);
  return patient?.patientName || patientId || "";
}

export function statusLabel(value = "") {
  return IAAS_STATUS.find(([key]) => key === value)?.[1] || value;
}

export function followUpSummary(row = {}) {
  const parts = [
    row.followUp?.reviewDate,
    row.criteria ? "criterios" : "",
    row.followUp?.carePlan ? "plan" : "",
    row.vitalSigns?.temperature ? `T ${row.vitalSigns.temperature}` : "",
    row.vitalSigns?.fio2 ? `FiO2 ${row.vitalSigns.fio2}` : "",
    row.vitalSigns?.peep ? `PEEP ${row.vitalSigns.peep}` : "",
    opdStatus(row.opd, opdEligibilityForIaasCase(row)).pending ? "OPD pendiente" : "",
    row.labs?.biometry ? "BH" : "",
    row.labs?.customStudies?.length ? "otros estudios" : ""
  ].filter(Boolean);
  return parts.join(" / ") || "Sin seguimiento";
}

export function upsertIaas(rows, iaas) {
  const next = rows.filter(row => row.iaasId !== iaas.iaasId);
  if (!["closed", "cerrada", "archived"].includes(String(iaas.status || "").toLowerCase())) next.unshift(iaas);
  return next;
}

export function upsertById(rows = [], saved = {}, field) {
  const id = saved[field] || saved.id;
  return [saved, ...rows.filter(row => (row[field] || row.id) !== id)];
}

export function emptyClinical() {
  return { cultures: [], antimicrobials: [] };
}

export async function loadCaseClinical(row = {}) {
  if (!row.iaasId) return emptyClinical();
  const [cultures, antimicrobials] = await Promise.all([
    listCulturesForIaas(row.iaasId).catch(() => []),
    listAntimicrobialsForIaas(row.iaasId).catch(() => [])
  ]);
  return { cultures, antimicrobials };
}

export function iaasDraftFromFormData(iaas = {}, patients = [], data = {}) {
  const patient = patients.find(row => row.patientId === data.patientId) || {};
  const opdEligibility = opdEligibilityForIaasCase({ ...iaas, status: data.status });
  return {
    ...iaas,
    patientId: data.patientId,
    patientName: patient.patientName || iaas.patientName || "",
    service: patient.service || patient.currentService || iaas.service || "",
    bed: patient.bed || patient.currentBed || iaas.bed || "",
    iaasType: data.iaasType,
    status: data.status,
    onsetDate: data.onsetDate,
    probableOrigin: data.probableOrigin,
    notes: data.notes,
    ...normalizeIaasClinicalFollowUp(data, iaas),
    previousIaasSnapshot: iaas.iaasId ? iaas : undefined,
    opd: opdEligibility.eligible || opdHasContent(iaas.opd)
      ? opdFromFormData(data, iaas.opd)
      : iaas.opd
  };
}

export function linkedClinicalEvidence(data = {}) {
  return {
    cultureDraft: {
      sampleType: data.cultureSampleType,
      requestedAt: data.cultureRequestedAt,
      organism: data.cultureOrganism
    },
    antimicrobialDraft: {
      drug: data.antimicrobialDrug,
      startDate: data.antimicrobialStartDate,
      indication: data.antimicrobialIndication
    }
  };
}

export function clinicalValidationBadge(row = {}) {
  const validation = row.clinicalValidation?.version
    ? row.clinicalValidation
    : validateIaasClinicalCompleteness(row);
  const tone = validation.status === "completa" ? "ok" : validation.status === "revision" ? "warn" : "bad";
  return badge(`${validation.score}% ${validation.status}`, tone);
}

export function renderClinicalValidation(validation = {}) {
  const tone = validation.status === "completa" ? "ok" : validation.status === "revision" ? "warn" : "bad";
  const missing = validation.blocking?.length ? validation.blocking : validation.warnings || [];
  return [
    el("div", { class: "criteria-validation-head" }, [
      el("strong", {}, ["Validacion de cedula IAAS"]),
      badge(`${validation.score ?? 0}% ${validation.status || "revision"}`, tone)
    ]),
    missing.length
      ? el("ul", {}, missing.slice(0, 6).map(item => el("li", {}, [item])))
      : el("p", { class: "muted" }, ["Cedula completa para el nivel documentado."]),
    el("div", { class: "criteria-validation-grid" }, (validation.checks || []).map(check =>
      el("span", { class: check.ok ? "ok" : check.critical ? "bad" : "warn" }, [
        `${check.ok ? "OK" : check.critical ? "Falta" : "Revisar"}: ${check.label}`
      ])
    ))
  ];
}

export function renderVitalTrendPanel(iaas = {}) {
  const series = iaasVitalTrendSeries(iaas);
  if (!series.length) return "";
  return el("section", { class: "criteria-validation iaas-vital-trend-panel" }, [
    el("div", { class: "criteria-validation-head" }, [
      el("strong", {}, ["Tendencia de signos vitales"]),
      badge(`${series.reduce((sum, item) => sum + item.points.length, 0)} dato(s)`, "neutral")
    ]),
    el("div", { class: "iaas-vital-trend-grid" }, series.map(renderVitalTrendCard))
  ]);
}

export function renderDailyIaasTable(iaas = {}, clinical = {}) {
  const table = iaasClinicalTimelineTable(iaas, clinical);
  if (!table.dates.length || !table.rows.length) return "";
  return el("section", { class: "criteria-validation daily-iaas-lite-panel" }, [
    el("div", { class: "criteria-validation-head" }, [
      el("strong", {}, ["Tabla diaria IAAS"]),
      badge(`${table.dates.length} fecha(s)`, "neutral")
    ]),
    el("div", { class: "daily-iaas-lite-scroll" }, [
      el("table", { class: "daily-iaas-lite-table" }, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", {}, ["Grupo"]),
            el("th", {}, ["Campo"]),
            ...table.dates.map(date => el("th", {}, [date]))
          ])
        ]),
        el("tbody", {}, table.rows.map(row =>
          el("tr", {}, [
            el("th", {}, [row.group]),
            el("th", {}, [row.label]),
            ...row.values.map(value => el("td", {}, [value || "-"]))
          ])
        ))
      ])
    ])
  ]);
}

export function renderClinicalRevisionPanel(iaas = {}) {
  const rows = iaasClinicalRevisionHistory(iaas).slice(-5).reverse();
  if (!rows.length) return "";
  return el("section", { class: "criteria-validation iaas-revision-panel" }, [
    el("div", { class: "criteria-validation-head" }, [
      el("strong", {}, ["Ediciones previas IAAS"]),
      badge(`${rows.length} revision(es)`, "neutral")
    ]),
    el("div", { class: "iaas-revision-list" }, rows.map(row =>
      el("article", { class: "iaas-revision-card" }, [
        el("strong", {}, [revisionTitle(row)]),
        el("p", { class: "muted" }, [revisionSummary(row)])
      ])
    ))
  ]);
}

function renderVitalTrendCard(series = {}) {
  const spread = Math.max(1, Number(series.max) - Number(series.min));
  return el("article", { class: "iaas-vital-trend-card" }, [
    el("div", { class: "iaas-vital-trend-head" }, [
      el("span", {}, [series.label || "Signo vital"]),
      el("strong", {}, [vitalDisplay(series.latest, series.unit)])
    ]),
    el("div", { class: "iaas-vital-trend-points" }, series.points.map(point => {
      const width = Math.max(4, Math.min(100, ((Number(point.value) - Number(series.min)) / spread) * 100));
      return el("div", { class: "iaas-vital-trend-row" }, [
        el("span", {}, [point.date]),
        el("div", { class: "iaas-vital-trend-track" }, [
          el("i", { style: { width: `${width}%` } })
        ]),
        el("strong", {}, [vitalDisplay(point, series.unit)])
      ]);
    }))
  ]);
}

function revisionTitle(row = {}) {
  return [row.date || "Sin fecha", row.editedAt ? `editado ${String(row.editedAt).slice(0, 16)}` : ""].filter(Boolean).join(" - ");
}

function revisionSummary(row = {}) {
  const snapshot = row.snapshot || {};
  return [
    row.status ? `Estado ${row.status}` : "",
    snapshot.vitalSigns?.temperature ? `Temp ${snapshot.vitalSigns.temperature}` : "",
    snapshot.vitalSigns?.fio2 ? `FiO2 ${snapshot.vitalSigns.fio2}` : "",
    snapshot.labs?.biometry ? `BH ${snapshot.labs.biometry}` : "",
    snapshot.labs?.ego ? `EGO ${snapshot.labs.ego}` : "",
    snapshot.followUp?.carePlan ? `Plan ${snapshot.followUp.carePlan}` : "",
    row.criteria ? "Criterios documentados" : "",
    row.notes ? `Notas ${row.notes}` : ""
  ].filter(Boolean).join(" | ") || "Revision clinica previa.";
}

function vitalDisplay(point = {}, unit = "") {
  const raw = String(point.raw || "").trim();
  if (!raw) return "";
  if (!unit || raw.includes(unit) || (unit === "%" && raw.includes("%"))) return raw;
  return `${raw} ${unit}`;
}

export function patientIdFromRoute(route = {}) {
  const parts = route.parts || [];
  const patientIndex = parts.indexOf("paciente");
  if (patientIndex >= 0 && parts[patientIndex + 1]) return parts[patientIndex + 1];
  if (parts[1] === "paciente" && parts[2]) return parts[2];
  return "";
}

export function dateFromRoute(route = {}) {
  return (route.parts || []).find(part => /^\d{4}-\d{2}-\d{2}$/.test(part)) || todayIso();
}

export function draftIaasForRoutePatient(patient = {}, patientId = "", date = todayIso()) {
  return {
    patientId,
    patientName: patient?.patientName || "",
    service: patient?.service || patient?.currentService || "",
    bed: patient?.bed || patient?.currentBed || "",
    iaasType: "",
    status: statusFromPatientDiagnosis(patient),
    onsetDate: date,
    source: "lite_iaas_patient_route"
  };
}

function statusFromPatientDiagnosis(patient = {}) {
  const text = String([
    patient?.epidemiologicalDiagnosis,
    patient?.currentEpidemiologicalDiagnosis,
    patient?.epiDiagnosis
  ].filter(Boolean).join(" ")).toUpperCase();
  if (text.includes("NO IAAS")) return "descartada";
  if (text.includes("IAAS") && !text.includes("RIESGO")) return "confirmada";
  return "sospecha";
}

import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { nowIso } from "../lib/date.js";
import { cleanText, stripUndefined, validIaasCase } from "../lib/validators.js";
import { listCollectionWhere, paginateQuery } from "./firestoreService.js";
import { validateIaasClinicalCompleteness } from "./iaasCriteriaService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";
import { testActiveIaas, testIaasForPatient } from "./testDataService.js";

const CACHE_KEY = "iaas_active:last";
const IAAS_PATIENT_LIMIT = 50;
const IAAS_CLINICAL_TIMELINE_LIMIT = 30;
const IAAS_CLINICAL_REVISION_LIMIT = 20;
let activeIaasPromise = null;
const patientIaasPromises = new Map();

const VITAL_TREND_SPECS = [
  { key: "temperature", label: "Temperatura", unit: "C" },
  { key: "heartRate", label: "Frecuencia cardiaca", unit: "lpm" },
  { key: "respiratoryRate", label: "Frecuencia respiratoria", unit: "rpm" },
  { key: "bloodPressure", label: "Presion arterial sistolica", unit: "mmHg" },
  { key: "spo2", label: "Saturacion de oxigeno", unit: "%" },
  { key: "fio2", label: "FiO2", unit: "%" },
  { key: "peep", label: "PEEP", unit: "cmH2O" }
];

function makeIaasId() {
  if (globalThis.crypto?.randomUUID) return `iaas_${globalThis.crypto.randomUUID()}`;
  return `iaas_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function byIaasId(rows = []) {
  return rows.reduce((map, row) => {
    const id = row.iaasId || row.id;
    if (!id) return map;
    map.set(id, { ...map.get(id), ...row, iaasId: id });
    return map;
  }, new Map());
}

async function mergePending(rows = []) {
  const map = byIaasId(rows);
  const pending = await pendingPayloadsForCollection("iaas_active");
  pending.forEach(row => map.set(row.iaasId || row.id, { ...map.get(row.iaasId || row.id), ...row }));
  return [...map.values()];
}

async function mergeArchivePending(patientId, rows = []) {
  const map = byIaasId(rows);
  const pending = await pendingPayloadsForCollection("iaas_archive");
  pending
    .filter(row => row.patientId === patientId)
    .forEach(row => map.set(row.iaasId || row.id, { ...map.get(row.iaasId || row.id), ...row }));
  return [...map.values()];
}

function activeIaas(row = {}) {
  const status = String(row.status || "").toLowerCase();
  return row.active !== false && !["closed", "cerrada", "archived"].includes(status);
}

export function patientClassificationForIaasStatus(status = "") {
  const normalized = cleanText(status).toLowerCase();
  if (["confirmada", "confirmed", "iaas"].includes(normalized)) return "IAAS";
  if (["sospecha", "probable", "riesgo", "riesgo iaas"].includes(normalized)) return "RIESGO IAAS";
  if (["descartada", "closed", "cerrada", "archived", "no iaas"].includes(normalized)) return "NO IAAS";
  return "";
}

function strongestClassification(rows = []) {
  if (rows.some(row => patientClassificationForIaasStatus(row.status) === "IAAS")) return "IAAS";
  if (rows.some(row => patientClassificationForIaasStatus(row.status) === "RIESGO IAAS")) return "RIESGO IAAS";
  return "NO IAAS";
}

async function syncPatientClassificationFromIaas(app, iaas, fallbackClassification = "") {
  const classification = fallbackClassification || patientClassificationForIaasStatus(iaas.status);
  if (!iaas?.patientId || !classification) return null;
  const { syncPatientIaasClassification } = await import("./patientService.js");
  return syncPatientIaasClassification(app, iaas.patientId, classification, iaas);
}

async function loadActiveIaas() {
  if (appConfig().testMode) {
    return (await mergePending(testActiveIaas())).filter(activeIaas);
  }
  try {
    const rows = await listCollectionWhere("iaas_active", [["active", "==", true]]);
    const active = (await mergePending(rows)).filter(activeIaas);
    cacheSet(CACHE_KEY, active).catch(() => undefined);
    return active;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending(cached?.value || [])).filter(activeIaas);
  }
}

export async function listActiveIaas() {
  activeIaasPromise ||= loadActiveIaas().finally(() => {
    activeIaasPromise = null;
  });
  return activeIaasPromise;
}

async function loadIaasForPatient(patientId, limit = IAAS_PATIENT_LIMIT) {
  const pageSize = Math.min(100, Math.max(1, Number(limit) || IAAS_PATIENT_LIMIT));
  if (appConfig().testMode) {
    return (await mergePending(testIaasForPatient(patientId))).filter(row => row.patientId === patientId && activeIaas(row)).slice(0, pageSize);
  }
  try {
    const rows = await listCollectionWhere("iaas_active", [["patientId", "==", patientId], ["active", "==", true]], { limit: pageSize });
    return (await mergePending(rows)).filter(row => row.patientId === patientId && activeIaas(row));
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return (await mergePending(cached?.value || [])).filter(row => row.patientId === patientId && activeIaas(row));
  }
}

function invalidatePatientIaas(patientId) {
  if (!patientId) return;
  for (const key of [...patientIaasPromises.keys()]) {
    if (key.startsWith(`${patientId}:`)) patientIaasPromises.delete(key);
  }
}

export async function listIaasForPatient(patientId, options = {}) {
  if (!patientId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || IAAS_PATIENT_LIMIT));
  const key = `${patientId}:${limit}`;
  if (!patientIaasPromises.has(key)) {
    patientIaasPromises.set(key, loadIaasForPatient(patientId, limit).finally(() => {
      patientIaasPromises.delete(key);
    }));
  }
  return patientIaasPromises.get(key);
}

export async function pageIaasForPatient(patientId, cursorState = {}) {
  if (!patientId) return emptyCursorPage([], cursorState.pageSize || IAAS_PATIENT_LIMIT);
  const pageSize = Math.min(100, Math.max(1, Number(cursorState.pageSize) || IAAS_PATIENT_LIMIT));
  if (appConfig().testMode) {
    return emptyCursorPage(await listIaasForPatient(patientId, { limit: pageSize }), pageSize);
  }
  try {
    const [page, archived] = await Promise.all([
      paginateQuery("iaas_active", [["patientId", "==", patientId], ["active", "==", true]], [], pageSize, cursorState, cursorState.direction || "next"),
      listCollectionWhere("iaas_archive", [["patientId", "==", patientId]], {
        orderBy: [["closedAt", "desc"]],
        limit: pageSize
      }).catch(() => [])
    ]);
    const rows = (await mergePending(page.rows))
      .filter(row => row.patientId === patientId && activeIaas(row))
      .concat(await mergeArchivePending(patientId, archived))
      .sort((a, b) => String(b.closedAt || b.onsetDate || b.updatedAt || "").localeCompare(String(a.closedAt || a.onsetDate || a.updatedAt || "")))
      .slice(0, page.pageSize);
    return { ...page, rows };
  } catch {
    return emptyCursorPage(await listIaasForPatient(patientId, { limit: pageSize }), pageSize);
  }
}

function emptyCursorPage(rows = [], pageSize = IAAS_PATIENT_LIMIT) {
  return {
    rows,
    firstCursor: null,
    lastCursor: null,
    hasNext: false,
    hasPrevious: false,
    pageSize
  };
}

export function normalizeIaasClinicalFollowUp(source = {}, previous = {}) {
  const previousFollowUp = previous.followUp || {};
  const previousVitals = previous.vitalSigns || {};
  const previousLabs = previous.labs || {};
  const otherStudiesText = source.otherStudies ?? previousLabs.otherStudies ?? "";
  const customStudies = source.customStudies ?? (String(otherStudiesText || "").trim()
    ? customStudiesFromText(otherStudiesText)
    : previousLabs.customStudies);
  const normalized = stripUndefined({
    criteria: cleanText(source.criteria ?? previous.criteria ?? "", 1200),
    criteriaVersion: cleanText(source.criteriaVersion ?? previous.criteriaVersion ?? "", 80),
    deviceEpisodeId: cleanText(source.deviceEpisodeId ?? previous.deviceEpisodeId ?? "", 160),
    vitalSigns: stripUndefined({
      temperature: cleanText(source.vitalTemperature ?? previousVitals.temperature ?? "", 40),
      heartRate: cleanText(source.vitalHeartRate ?? previousVitals.heartRate ?? "", 40),
      respiratoryRate: cleanText(source.vitalRespiratoryRate ?? previousVitals.respiratoryRate ?? "", 40),
      bloodPressure: cleanText(source.vitalBloodPressure ?? previousVitals.bloodPressure ?? "", 80),
      spo2: cleanText(source.vitalSpo2 ?? previousVitals.spo2 ?? "", 40),
      fio2: cleanText(source.vitalFio2 ?? previousVitals.fio2 ?? "", 40),
      peep: cleanText(source.vitalPeep ?? previousVitals.peep ?? "", 40)
    }),
    labs: stripUndefined({
      biometry: cleanText(source.biometry ?? previousLabs.biometry ?? "", 500),
      ego: cleanText(source.ego ?? previousLabs.ego ?? "", 500),
      otherStudies: cleanText(otherStudiesText, 700),
      customStudies: normalizeIaasCustomStudies(customStudies, previousLabs.customStudies)
    }),
    followUp: stripUndefined({
      reviewDate: cleanText(source.followUpDate ?? previousFollowUp.reviewDate ?? "", 40),
      evolution: cleanText(source.clinicalEvolution ?? previousFollowUp.evolution ?? "", 1000),
      carePlan: cleanText(source.carePlan ?? previousFollowUp.carePlan ?? "", 1000)
    })
  });
  return stripUndefined({
    ...normalized,
    clinicalTimeline: mergeIaasClinicalTimeline(previous, normalized)
  });
}

export function iaasClinicalTimeline(iaas = {}) {
  return normalizeIaasClinicalTimeline([
    ...(Array.isArray(iaas.clinicalTimeline) ? iaas.clinicalTimeline : []),
    clinicalSnapshotFromIaas(iaas)
  ]);
}

export function iaasVitalTrendSeries(iaas = {}) {
  const timeline = iaasClinicalTimeline(iaas);
  return VITAL_TREND_SPECS.map(spec => {
    const points = timeline
      .map(item => {
        const raw = vitalRawValue(item.vitalSigns || {}, spec.key);
        const value = numericVitalValue(raw);
        return stripUndefined({ date: item.date, raw, value });
      })
      .filter(point => point.date && point.raw && Number.isFinite(point.value));
    if (!points.length) return null;
    const values = points.map(point => point.value);
    return {
      ...spec,
      points,
      latest: points[points.length - 1],
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }).filter(Boolean);
}

export function iaasClinicalTimelineTable(iaas = {}, clinical = {}) {
  const timeline = mergeClinicalTimelineByDate(iaasClinicalTimeline(iaas));
  const cultures = normalizeTableCultures(clinical.cultures || iaas.cultures || []);
  const antimicrobials = normalizeTableAntimicrobials(clinical.antimicrobials || iaas.antimicrobials || iaas.treatments || []);
  const dates = uniqueSortedDates([
    ...timeline.map(row => row.date),
    ...cultures.flatMap(row => [row.requestedAt, row.resultDate]),
    ...antimicrobials.flatMap(row => [row.startDate, row.endDate])
  ]);
  const fields = [
    { group: "SIGNOS VITALES", label: "Temperatura", value: item => appendClinicalUnit(item.vitalSigns?.temperature, "C") },
    { group: "SIGNOS VITALES", label: "Frecuencia cardiaca", value: item => appendClinicalUnit(item.vitalSigns?.heartRate, "lpm") },
    { group: "SIGNOS VITALES", label: "Frecuencia respiratoria", value: item => appendClinicalUnit(item.vitalSigns?.respiratoryRate, "rpm") },
    { group: "SIGNOS VITALES", label: "Presion arterial", value: item => appendClinicalUnit(item.vitalSigns?.bloodPressure, "mmHg") },
    { group: "SIGNOS VITALES", label: "SpO2", value: item => appendClinicalUnit(item.vitalSigns?.spo2, "%") },
    { group: "VENTILACION", label: "FiO2", value: item => appendClinicalUnit(item.vitalSigns?.fio2, "%") },
    { group: "VENTILACION", label: "PEEP", value: item => appendClinicalUnit(item.vitalSigns?.peep, "cmH2O") },
    { group: "LABORATORIO", label: "Biometria", value: item => item.labs?.biometry || "" },
    { group: "LABORATORIO", label: "EGO", value: item => item.labs?.ego || "" },
    { group: "LABORATORIO", label: "Otros estudios", value: item => item.labs?.otherStudies || summarizeIaasCustomStudies(item.labs?.customStudies) },
    { group: "SEGUIMIENTO", label: "Evolucion", value: item => item.followUp?.evolution || "" },
    { group: "SEGUIMIENTO", label: "Plan", value: item => item.followUp?.carePlan || "" }
  ];
  const rows = fields.map(field => {
    const values = dates.map(date => cleanText(field.value(timeline.find(item => item.date === date) || {}) || "", 700));
    return { group: field.group, label: field.label, values };
  }).filter(row => row.values.some(Boolean));
  return {
    dates,
    rows: [
      ...rows,
      ...cultures.map(cultureTimelineTableRow(dates, cultures.length)),
      ...antimicrobials.map(antimicrobialTimelineTableRow(dates, antimicrobials.length))
    ]
  };
}

export function iaasClinicalRevisionHistory(iaas = {}) {
  return normalizeIaasClinicalRevisionHistory(iaas.clinicalRevisionHistory || iaas.iaasAssessmentHistory || []);
}

function mergeIaasClinicalRevisionHistory(previous = {}, next = {}, metadata = {}) {
  const existing = iaasClinicalRevisionHistory(previous?.clinicalRevisionHistory ? previous : next);
  const previousEntry = clinicalRevisionEntryFromIaas(previous, metadata);
  const nextEntry = clinicalRevisionEntryFromIaas(next);
  if (!previousEntry || !nextEntry || clinicalRevisionKey(previousEntry) === clinicalRevisionKey(nextEntry)) return existing;
  return normalizeIaasClinicalRevisionHistory([...existing, previousEntry]);
}

function mergeIaasClinicalTimeline(previous = {}, normalized = {}) {
  return normalizeIaasClinicalTimeline([
    ...(Array.isArray(previous.clinicalTimeline) ? previous.clinicalTimeline : []),
    clinicalSnapshotFromIaas(previous),
    clinicalSnapshotFromIaas(normalized, normalized.followUp?.reviewDate || previous.followUp?.reviewDate || previous.onsetDate || "")
  ]);
}

function normalizeIaasClinicalTimeline(rows = []) {
  const seen = new Set();
  return rows
    .map(row => clinicalSnapshotFromIaas(row))
    .filter(Boolean)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .filter(row => {
      const key = clinicalTimelineKey(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-IAAS_CLINICAL_TIMELINE_LIMIT);
}

function mergeClinicalTimelineByDate(rows = []) {
  const map = new Map();
  rows.forEach(row => {
    if (!row?.date) return;
    const previous = map.get(row.date) || { date: row.date };
    map.set(row.date, {
      date: row.date,
      vitalSigns: { ...(previous.vitalSigns || {}), ...(row.vitalSigns || {}) },
      labs: {
        ...(previous.labs || {}),
        ...(row.labs || {}),
        customStudies: [
          ...normalizeIaasCustomStudies(previous.labs?.customStudies || []),
          ...normalizeIaasCustomStudies(row.labs?.customStudies || [])
        ].slice(-20)
      },
      followUp: { ...(previous.followUp || {}), ...(row.followUp || {}) }
    });
  });
  return [...map.values()].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function clinicalSnapshotFromIaas(row = {}, fallbackDate = "") {
  if (!row || typeof row !== "object") return null;
  const vitalSigns = normalizeClinicalVitals(row.vitalSigns || {});
  const labs = normalizeClinicalLabs(row.labs || {});
  const followUp = normalizeClinicalFollowUp(row.followUp || {});
  if (!hasClinicalContent(vitalSigns) && !hasClinicalContent(labs) && !hasClinicalContent(followUp)) return null;
  return stripUndefined({
    date: cleanText(row.date || followUp.reviewDate || row.onsetDate || String(row.updatedAt || row.createdAt || "").slice(0, 10) || fallbackDate || "", 40),
    vitalSigns,
    labs,
    followUp
  });
}

function normalizeClinicalVitals(vitals = {}) {
  return stripUndefined({
    temperature: cleanText(vitals.temperature || "", 40),
    heartRate: cleanText(vitals.heartRate || "", 40),
    respiratoryRate: cleanText(vitals.respiratoryRate || "", 40),
    bloodPressure: cleanText(vitals.bloodPressure || "", 80),
    spo2: cleanText(vitals.spo2 || vitals.oxygenSaturation || "", 40),
    fio2: cleanText(vitals.fio2 || "", 40),
    peep: cleanText(vitals.peep || "", 40)
  });
}

function normalizeClinicalLabs(labs = {}) {
  return stripUndefined({
    biometry: cleanText(labs.biometry || "", 500),
    ego: cleanText(labs.ego || "", 500),
    otherStudies: cleanText(labs.otherStudies || "", 700),
    customStudies: normalizeIaasCustomStudies(labs.customStudies || [])
  });
}

function normalizeClinicalFollowUp(followUp = {}) {
  return stripUndefined({
    reviewDate: cleanText(followUp.reviewDate || "", 40),
    evolution: cleanText(followUp.evolution || "", 1000),
    carePlan: cleanText(followUp.carePlan || "", 1000)
  });
}

function hasClinicalContent(value) {
  if (Array.isArray(value)) return value.some(hasClinicalContent);
  if (value && typeof value === "object") return Object.values(value).some(hasClinicalContent);
  return Boolean(cleanText(value));
}

function clinicalTimelineKey(row = {}) {
  return JSON.stringify([row.date || "", row.vitalSigns || {}, row.labs || {}, row.followUp || {}]);
}

function normalizeIaasClinicalRevisionHistory(rows = []) {
  const seen = new Set();
  return rows
    .map(row => normalizeClinicalRevisionEntry(row))
    .filter(Boolean)
    .sort((a, b) => String(a.editedAt || a.date || "").localeCompare(String(b.editedAt || b.date || "")))
    .filter(row => {
      const key = clinicalRevisionKey(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-IAAS_CLINICAL_REVISION_LIMIT);
}

function clinicalRevisionEntryFromIaas(row = {}, metadata = {}) {
  if (!row || typeof row !== "object") return null;
  const snapshot = clinicalSnapshotFromIaas(row);
  const criteria = cleanText(row.criteria || "", 1200);
  const notes = cleanText(row.notes || "", 700);
  if (!snapshot && !criteria && !notes) return null;
  return normalizeClinicalRevisionEntry({
    editedAt: metadata.editedAt || row.updatedAt || row.createdAt || nowIso(),
    editedBy: metadata.editedBy || row.updatedBy || row.createdBy || "",
    date: snapshot?.date || row.onsetDate || "",
    iaasType: row.iaasType || "",
    status: row.status || "",
    probableOrigin: row.probableOrigin || "",
    criteria,
    criteriaVersion: row.criteriaVersion || "",
    notes,
    snapshot
  });
}

function normalizeClinicalRevisionEntry(row = {}) {
  if (!row || typeof row !== "object") return null;
  const snapshot = clinicalSnapshotFromIaas(row.snapshot || row);
  const entry = stripUndefined({
    editedAt: cleanText(row.editedAt || row.updatedAt || row.createdAt || "", 40),
    editedBy: cleanText(row.editedBy || row.updatedBy || row.createdBy || "", 120),
    date: cleanText(row.date || snapshot?.date || "", 40),
    iaasType: cleanText(row.iaasType || "", 80),
    status: cleanText(row.status || "", 80),
    probableOrigin: cleanText(row.probableOrigin || "", 300),
    criteria: cleanText(row.criteria || "", 1200),
    criteriaVersion: cleanText(row.criteriaVersion || "", 80),
    notes: cleanText(row.notes || "", 700),
    snapshot
  });
  return Object.values(entry).some(hasClinicalContent) ? entry : null;
}

function clinicalRevisionKey(row = {}) {
  return JSON.stringify([
    row.date || "",
    row.iaasType || "",
    row.status || "",
    row.probableOrigin || "",
    row.criteria || "",
    row.notes || "",
    row.snapshot || {}
  ]);
}

function vitalRawValue(vitals = {}, key = "") {
  return cleanText(key === "spo2" ? vitals.spo2 || vitals.oxygenSaturation || "" : vitals[key] || "", 80);
}

function numericVitalValue(value = "") {
  const match = String(value || "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function appendClinicalUnit(value = "", unit = "") {
  const text = cleanText(value, 120);
  if (!text || !unit) return text;
  const normalized = text.toLowerCase();
  if (normalized.includes(unit.toLowerCase()) || (unit === "%" && text.includes("%"))) return text;
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
}

function uniqueSortedDates(values = []) {
  return [...new Set(values.map(value => cleanText(value || "", 40)).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)))]
    .sort((a, b) => a.localeCompare(b))
    .slice(-IAAS_CLINICAL_TIMELINE_LIMIT);
}

function normalizeTableCultures(rows = []) {
  return rows.map(row => stripUndefined({
    label: cleanText([row.sampleType || row.type || "Cultivo", row.woundSite || row.site || ""].filter(Boolean).join(" / "), 160),
    requestedAt: cleanText(row.requestedAt || row.collectionDate || "", 40),
    resultDate: cleanText(row.resultDate || row.resultAt || row.resultedAt || "", 40),
    status: cleanText(row.status || "", 80),
    organism: cleanText(row.organism || row.microorganism || "", 160)
  })).filter(row => row.label && row.requestedAt);
}

function normalizeTableAntimicrobials(rows = []) {
  return rows.map(row => stripUndefined({
    label: cleanText(row.drug || row.customDrug || "Antimicrobiano", 160),
    startDate: cleanText(row.startDate || "", 40),
    endDate: cleanText(row.endDate || "", 40),
    status: cleanText(row.status || "", 80),
    indication: cleanText(row.indication || row.notes || "", 240)
  })).filter(row => row.label && row.startDate);
}

function cultureTimelineTableRow(dates = [], total = 0) {
  return culture => ({
    group: "CULTIVOS",
    label: total > 1 ? culture.label : culture.label || "Cultivo",
    values: dates.map(date => cultureValueForDate(culture, date))
  });
}

function antimicrobialTimelineTableRow(dates = [], total = 0) {
  return antimicrobial => ({
    group: "TRATAMIENTO",
    label: total > 1 ? antimicrobial.label : antimicrobial.label || "Antimicrobiano",
    values: dates.map(date => antimicrobialValueForDate(antimicrobial, date))
  });
}

function cultureValueForDate(culture = {}, date = "") {
  if (!culture.requestedAt || date < culture.requestedAt) return "";
  if (culture.resultDate && date > culture.resultDate) return "";
  if (culture.resultDate && date === culture.resultDate) return culture.organism ? `Resultado: ${culture.organism}` : "Resultado disponible";
  if (date === culture.requestedAt) return culture.status || "Solicitado";
  return culture.status && !["solicitado", "pendiente"].includes(culture.status.toLowerCase()) ? culture.status : "Pendiente";
}

function antimicrobialValueForDate(antimicrobial = {}, date = "") {
  if (!antimicrobial.startDate || date < antimicrobial.startDate) return "";
  if (antimicrobial.endDate && date > antimicrobial.endDate) return "";
  const suffix = antimicrobial.indication ? `: ${antimicrobial.indication}` : "";
  if (antimicrobial.endDate && date === antimicrobial.endDate) return `Fin${suffix}`;
  return `${antimicrobial.status || "Activo"}${suffix}`;
}

export function normalizeIaasCustomStudies(value = [], fallback = []) {
  const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
  return source
    .map(row => ({
      name: cleanText(row.name || row.study || row.test || "", 120),
      value: cleanText(row.value || row.result || "", 240)
    }))
    .filter(row => row.name || row.value)
    .slice(0, 20);
}

export function summarizeIaasCustomStudies(rows = []) {
  return normalizeIaasCustomStudies(rows)
    .map(row => `${row.name || "Otro estudio"}${row.value ? `: ${row.value}` : ""}`)
    .join(" / ");
}

function customStudiesFromText(value = "") {
  return String(value || "")
    .split(/\r?\n|;/)
    .map(item => {
      const [name, ...rest] = item.split(":");
      const result = rest.join(":");
      return rest.length ? { name, value: result } : { name: item, value: "" };
    })
    .filter(row => cleanText(row.name || row.value));
}

export async function saveIaasCase(app, iaas) {
  if (!validIaasCase(iaas)) throw new Error("IAAS sin paciente, tipo o estado.");
  const { previousIaasSnapshot, ...iaasInput } = iaas;
  const iaasId = iaas.iaasId || makeIaasId();
  const timestamp = nowIso();
  const userId = app.state.auth.user?.uid || "";
  const previous = previousIaasSnapshot || (iaasInput.iaasId ? iaasInput : null);
  const basePayload = stripUndefined({
    ...iaasInput,
    iaasId,
    active: iaasInput.active !== false,
    updatedAt: timestamp,
    updatedBy: userId,
    createdAt: iaasInput.createdAt || timestamp,
    createdBy: iaasInput.createdBy || userId,
    source: iaasInput.source || "lite_iaas_module",
    clinicalTimeline: iaasClinicalTimeline(iaasInput),
    clinicalRevisionHistory: iaasInput.iaasId
      ? mergeIaasClinicalRevisionHistory(previous, iaasInput, { editedAt: timestamp, editedBy: userId })
      : iaasClinicalRevisionHistory(iaasInput)
  });
  const clinicalValidation = iaasInput.clinicalValidation?.version
    ? iaasInput.clinicalValidation
    : validateIaasClinicalCompleteness(basePayload);
  const payload = stripUndefined({
    ...basePayload,
    clinicalValidation,
    clinicalValidationStatus: clinicalValidation.status,
    clinicalValidationVersion: clinicalValidation.version
  });
  const saved = await setDocMergeOrQueue(app, `iaas_active/${iaasId}`, payload, {
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaasId
  });
  activeIaasPromise = null;
  invalidatePatientIaas(payload.patientId);
  await writeAudit(app, {
    actionType: iaasInput.iaasId ? "iaas_update" : "iaas_create",
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaasId,
    patientId: iaasInput.patientId,
    before: previousIaasSnapshot || undefined,
    after: saved
  });
  const patientSync = await syncPatientClassificationFromIaas(app, saved).catch(error => ({
    syncStatus: "error",
    error: error?.message || "No se pudo sincronizar clasificacion del paciente."
  }));
  return { ...saved, patientClassificationSyncStatus: patientSync?.syncStatus || "", patientClassification: patientSync?.epidemiologicalDiagnosis || "" };
}

export async function closeIaasCase(app, iaas, closedReason = "") {
  if (!iaas?.iaasId) throw new Error("IAAS sin identificador.");
  const timestamp = nowIso();
  const payload = stripUndefined({
    ...iaas,
    status: "closed",
    closedReason,
    closedAt: timestamp,
    active: false,
    updatedAt: timestamp,
    updatedBy: app.state.auth.user?.uid || ""
  });
  const archivePayload = stripUndefined({
    ...payload,
    archivedAt: timestamp,
    archivedBy: app.state.auth.user?.uid || "",
    archiveReason: closedReason || "iaas_closed"
  });
  const [savedActive, savedArchive] = await Promise.all([
    setDocMergeOrQueue(app, `iaas_active/${iaas.iaasId}`, payload, {
      module: "epi-iaas",
      entityType: "iaas_case",
      entityId: iaas.iaasId
    }),
    setDocMergeOrQueue(app, `iaas_archive/${iaas.iaasId}`, archivePayload, {
      module: "epi-iaas",
      entityType: "iaas_case",
      entityId: iaas.iaasId
    })
  ]);
  const saved = {
    ...savedActive,
    archiveSyncStatus: savedArchive.syncStatus || savedActive.syncStatus,
    syncStatus: [savedActive.syncStatus, savedArchive.syncStatus].includes("local_pending")
      ? "local_pending"
      : savedActive.syncStatus
  };
  activeIaasPromise = null;
  invalidatePatientIaas(payload.patientId);
  await writeAudit(app, {
    actionType: "iaas_close",
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: iaas.iaasId,
    patientId: iaas.patientId,
    before: iaas,
    after: saved
  });
  const remainingRows = (await listIaasForPatient(payload.patientId, { limit: IAAS_PATIENT_LIMIT }).catch(() => []))
    .filter(row => (row.iaasId || row.id) !== payload.iaasId)
    .filter(activeIaas);
  const patientSync = await syncPatientClassificationFromIaas(app, saved, strongestClassification(remainingRows)).catch(error => ({
    syncStatus: "error",
    error: error?.message || "No se pudo sincronizar clasificacion del paciente."
  }));
  return { ...saved, patientClassificationSyncStatus: patientSync?.syncStatus || "", patientClassification: patientSync?.epidemiologicalDiagnosis || "" };
}

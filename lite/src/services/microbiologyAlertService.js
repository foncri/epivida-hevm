import { normalizeDate, todayIso } from "../lib/date.js";

export const MICROBIOLOGY_ALERTS_VERSION = "lite-microbiology-alerts-2026-06-27-v2";

const BLOOD_CULTURE_THRESHOLD_DAYS = 5;
const STANDARD_CULTURE_THRESHOLD_DAYS = 2;
const ANTIBIOTIC_TIMEOUT_DAYS = 2;
const PROPHYLAXIS_REVIEW_DAYS = 2;
const ACTIVE_ANTIMICROBIAL_REVIEW_DAYS = 7;
const ACTIVE_ANTIMICROBIAL_CRITICAL_DAYS = 14;
const BROAD_SPECTRUM_REVIEW_DAYS = 3;
const CULTURE_LINK_WINDOW_DAYS = 2;

const PENDING_CULTURE_STATUSES = new Set(["SOLICITADO", "PENDIENTE", "EN PROCESO"]);
const NEGATIVE_OR_PENDING_ORGANISMS = new Set(["", "NEGATIVO", "NO DESARROLLO", "SIN DESARROLLO", "PENDIENTE", "SIN RESULTADO"]);
const NEGATIVE_CULTURE_VALUES = new Set(["NEGATIVO", "NO DESARROLLO", "SIN DESARROLLO", "SIN CRECIMIENTO"]);
const CRITICAL_ORGANISM_PATTERNS = [
  /S\.?\s*AUREUS|STAPHYLOCOCCUS\s+AUREUS/,
  /PSEUDOMONAS/,
  /ACINETOBACTER/,
  /KLEBSIELLA/,
  /ENTEROBACTER/,
  /CANDIDA/,
  /BLEE|ESBL/,
  /CARBAPENEM/,
  /MRSA|SARM/,
  /VRE|ERV/
];
const BROAD_SPECTRUM_PATTERNS = [
  /MEROPENEM|IMIPENEM|ERTAPENEM/,
  /VANCOMICINA|LINEZOLID/,
  /PIPERACILINA|TAZOBACTAM/,
  /CEFEPIME|CEFTAZIDIMA|CEFTRIAXONA/,
  /CIPROFLOXACINO|LEVOFLOXACINO/,
  /COLISTINA|TIGECICLINA/
];

export function microbiologyClinicalAlerts({ cultures = [], antimicrobials = [], patients = [], today = todayIso(), limit = 12 } = {}) {
  const patientMap = new Map(patients.map(patient => [patient.patientId, patient]));
  const cultureAlerts = cultures
    .map(culture => cultureClinicalAlert(culture, patientMap.get(culture.patientId), today))
    .filter(Boolean);
  const antimicrobialAlerts = antimicrobials
    .map(antimicrobial => antimicrobialClinicalAlert(antimicrobial, cultures, patientMap.get(antimicrobial.patientId), today))
    .filter(Boolean);
  return [...cultureAlerts, ...antimicrobialAlerts]
    .sort(compareMicrobiologyAlerts)
    .slice(0, Math.min(50, Math.max(1, Number(limit) || 12)));
}

export function cultureClinicalAlert(culture = {}, patient = {}, today = todayIso()) {
  const status = normalizedText(culture.status || "");
  const organism = normalizedText(culture.organism || culture.microorganism || "");
  const requestedAt = normalizeDate(culture.requestedAt || culture.collectionDate || culture.sampleDate);
  const resultAt = normalizeDate(culture.resultAt || culture.resultDate);
  const sampleType = culture.sampleType || culture.type || "Cultivo";
  const day = microbiologyDaysBetween(requestedAt, today);
  const threshold = isBloodCulture(sampleType) ? BLOOD_CULTURE_THRESHOLD_DAYS : STANDARD_CULTURE_THRESHOLD_DAYS;
  const positive = isPositiveCultureStatus(status, organism);
  const critical = positive && (isBloodCulture(sampleType) || isCriticalOrganism(organism));

  if (positive) {
    return alertRow({
      kind: "culture",
      subtype: critical ? "positive-critical" : "positive-result",
      tone: critical ? "critical" : "warn",
      priority: critical ? 100 : 80,
      title: critical ? "Cultivo positivo critico" : "Cultivo positivo",
      detail: `${sampleType} - ${patientLabel(patient, culture)} - ${culture.organism || organism}`,
      patientId: culture.patientId || "",
      href: iaasPatientHref(culture.patientId, resultAt || requestedAt),
      date: resultAt || requestedAt,
      due: critical,
      sourceId: culture.cultureId || culture.id || ""
    });
  }

  const pending = PENDING_CULTURE_STATUSES.has(status) && !resultAt && NEGATIVE_OR_PENDING_ORGANISMS.has(organism);
  if (!pending || day === null) return null;

  const due = day >= threshold;
  return alertRow({
    kind: "culture",
    subtype: due ? "pending-overdue" : "pending-followup",
    tone: due ? "critical" : "warn",
    priority: due ? 70 : 40,
    title: due ? "Cultivo vencido por recabar" : "Cultivo pendiente",
    detail: `${sampleType} - ${patientLabel(patient, culture)} - dia ${day}/${threshold}`,
    patientId: culture.patientId || "",
    href: iaasPatientHref(culture.patientId, requestedAt),
    date: requestedAt,
    due,
    daysOpen: day,
    threshold,
    sourceId: culture.cultureId || culture.id || ""
  });
}

export function antimicrobialClinicalAlert(antimicrobial = {}, cultures = [], patient = {}, today = todayIso()) {
  if (!isActiveAntimicrobial(antimicrobial)) return null;
  const startDate = normalizeDate(antimicrobial.startDate || antimicrobial.startedAt);
  const endDate = normalizeDate(antimicrobial.endDate || antimicrobial.endedAt);
  const day = microbiologyDaysBetween(startDate, today);
  const drug = antimicrobial.drug || antimicrobial.antimicrobial || "Antimicrobiano";

  if (endDate && normalizeDate(today) && Date.parse(`${endDate}T00:00:00Z`) < Date.parse(`${normalizeDate(today)}T00:00:00Z`)) {
    return alertRow({
      kind: "antimicrobial",
      subtype: "active-ended",
      tone: "critical",
      priority: 90,
      title: "Antimicrobiano activo con fin vencido",
      detail: `${drug} - ${patientLabel(patient, antimicrobial)} - fin ${endDate}`,
      patientId: antimicrobial.patientId || "",
      href: iaasPatientHref(antimicrobial.patientId, endDate || startDate),
      date: endDate,
      due: true,
      sourceId: antimicrobial.antimicrobialId || antimicrobial.id || ""
    });
  }

  if (day === null) return null;
  const broad = isBroadSpectrumDrug(drug);
  const linkedCulture = hasLinkedCulture(antimicrobial, cultures);
  const linkedNegativeCulture = hasLinkedNegativeCulture(antimicrobial, cultures);
  const prophylaxis = isProphylaxisAntimicrobial(antimicrobial);

  if (prophylaxis && day >= PROPHYLAXIS_REVIEW_DAYS) {
    return antimicrobialAlert(antimicrobial, patient, "Profilaxis antimicrobiana prolongada", `${drug} - dia ${day}`, "critical", 88, day, true, "prophylaxis-prolonged");
  }
  if (day >= ACTIVE_ANTIMICROBIAL_CRITICAL_DAYS) {
    return antimicrobialAlert(antimicrobial, patient, "Antimicrobiano activo prolongado", `${drug} - dia ${day}`, "critical", 85, day, true, "active-prolonged");
  }
  if (broad && linkedNegativeCulture && day >= ANTIBIOTIC_TIMEOUT_DAYS) {
    return antimicrobialAlert(antimicrobial, patient, "Revisar desescalamiento por cultivo negativo", `${drug} - dia ${day}`, "critical", 78, day, true, "broad-negative-culture");
  }
  if (broad && day >= BROAD_SPECTRUM_REVIEW_DAYS && !linkedCulture) {
    return antimicrobialAlert(antimicrobial, patient, "Antimicrobiano amplio sin cultivo vinculado", `${drug} - dia ${day}`, "critical", 75, day, true, "broad-no-culture");
  }
  if (!linkedCulture && day >= CULTURE_LINK_WINDOW_DAYS) {
    return antimicrobialAlert(antimicrobial, patient, "Tratamiento sin cultivo vinculado", `${drug} - dia ${day}`, "warn", 60, day, true, "no-linked-culture");
  }
  if (linkedCulture && day >= ANTIBIOTIC_TIMEOUT_DAYS) {
    return antimicrobialAlert(antimicrobial, patient, "Timeout antimicrobiano 48h", `${drug} - dia ${day}`, "warn", 55, day, false, "antibiotic-timeout");
  }
  if (day >= ACTIVE_ANTIMICROBIAL_REVIEW_DAYS) {
    return antimicrobialAlert(antimicrobial, patient, "Revisar continuidad antimicrobiana", `${drug} - dia ${day}`, "warn", 50, day, false, "active-review");
  }
  return null;
}

export function microbiologyDaysBetween(start, end) {
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (!startDate || !endDate) return null;
  const diff = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.floor(diff / 86400000));
}

function antimicrobialAlert(antimicrobial = {}, patient = {}, title = "", detail = "", tone = "warn", priority = 50, daysOpen = 0, due = false, subtype = "active-review") {
  return alertRow({
    kind: "antimicrobial",
    subtype,
    tone,
    priority,
    title,
    detail: `${detail} - ${patientLabel(patient, antimicrobial)}`,
    patientId: antimicrobial.patientId || "",
    href: iaasPatientHref(antimicrobial.patientId, antimicrobial.startDate || antimicrobial.startedAt),
    date: antimicrobial.startDate || "",
    due,
    daysOpen,
    sourceId: antimicrobial.antimicrobialId || antimicrobial.id || ""
  });
}

function alertRow(row = {}) {
  return {
    ...row,
    version: MICROBIOLOGY_ALERTS_VERSION,
    title: String(row.title || ""),
    detail: String(row.detail || ""),
    tone: row.tone || "warn",
    href: row.href || "#/epi-iaas"
  };
}

function iaasPatientHref(patientId = "", date = todayIso()) {
  return patientId ? `#/seguimiento-iaas/${normalizeDate(date) || todayIso()}/paciente/${patientId}` : "#/epi-iaas";
}

function compareMicrobiologyAlerts(a = {}, b = {}) {
  return Number(b.priority || 0) - Number(a.priority || 0)
    || String(b.date || "").localeCompare(String(a.date || ""))
    || String(a.detail || "").localeCompare(String(b.detail || ""), "es");
}

function normalizedText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isBloodCulture(type = "") {
  return normalizedText(type).includes("HEMOCULTIVO");
}

function isCriticalOrganism(organism = "") {
  const text = normalizedText(organism);
  return CRITICAL_ORGANISM_PATTERNS.some(pattern => pattern.test(text));
}

function isBroadSpectrumDrug(drug = "") {
  const text = normalizedText(drug);
  return BROAD_SPECTRUM_PATTERNS.some(pattern => pattern.test(text));
}

function isPositiveCultureStatus(status = "", organism = "") {
  if (status === "POSITIVO") return true;
  if (!["RESULTADO", "RESULTADO POSITIVO"].includes(status)) return false;
  return !NEGATIVE_OR_PENDING_ORGANISMS.has(organism);
}

function isActiveAntimicrobial(row = {}) {
  const status = normalizedText(row.status || "ACTIVO");
  return ["ACTIVO", "AJUSTADO", "PROFILAXIS"].includes(status);
}

function hasLinkedCulture(antimicrobial = {}, cultures = []) {
  return cultures.some(culture => isLinkedCulture(antimicrobial, culture));
}

function hasLinkedNegativeCulture(antimicrobial = {}, cultures = []) {
  return cultures.some(culture => isLinkedCulture(antimicrobial, culture) && isNegativeCulture(culture));
}

function isLinkedCulture(antimicrobial = {}, culture = {}) {
  if (antimicrobial.iaasId && culture.iaasId && antimicrobial.iaasId === culture.iaasId) return true;
  if (antimicrobial.patientId && culture.patientId && antimicrobial.patientId === culture.patientId) {
    const cultureDate = normalizeDate(culture.requestedAt || culture.collectionDate || culture.sampleDate || culture.resultAt || culture.resultDate);
    const startDate = normalizeDate(antimicrobial.startDate || antimicrobial.startedAt);
    const gap = signedDaysBetween(cultureDate, startDate);
    return gap !== null && Math.abs(gap) <= CULTURE_LINK_WINDOW_DAYS;
  }
  return false;
}

function isNegativeCulture(culture = {}) {
  const status = normalizedText(culture.status || "");
  const organism = normalizedText(culture.organism || culture.microorganism || "");
  return status === "NEGATIVO" || NEGATIVE_CULTURE_VALUES.has(organism);
}

function isProphylaxisAntimicrobial(antimicrobial = {}) {
  const text = normalizedText([
    antimicrobial.status,
    antimicrobial.indication,
    antimicrobial.notes,
    antimicrobial.reason
  ].filter(Boolean).join(" "));
  return /PROFILAX|PROPHYLAX/.test(text);
}

function signedDaysBetween(start, end) {
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (!startDate || !endDate) return null;
  const diff = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(diff)) return null;
  return Math.floor(diff / 86400000);
}

function patientLabel(patient = {}, row = {}) {
  return patient.patientName || patient.name || row.patientName || row.patientId || patient.patientId || "Paciente";
}

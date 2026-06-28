export const IAAS_CRITERIA_VERSION = "lite-iaas-criteria-2026-06-09-v1";
export const IAAS_CLINICAL_VALIDATION_VERSION = "lite-iaas-clinical-validation-2026-06-27-v2";

const CASE_TYPES = ["ITS - CC", "ITU - CU", "NAVM", "ISQ", "COVID/Influenza", "Otro"];
const CONFIRMATION_STATUSES = new Set(["PROBABLE", "PROBABLE IAAS", "CONFIRMADA", "CONFIRMED", "IAAS", "1 IAAS", "2 IAAS", "3 IAAS", "4 IAAS"]);

const CATALOG = {
  "ITS - CC": {
    label: "ITS - CC",
    deviceSignals: ["CVC", "CVPC", "PICC", "CATT HD", "C. PUERTO", "ONFALOCLISIS"],
    cultures: ["Hemocultivo central y periferico", "Cultivo de punta de CVC", "Cultivo de secrecion de insercion CVC"],
    criteria: [
      "Dispositivo vascular central activo o retirado recientemente.",
      "Fiebre, hipotermia, escalofrios o deterioro clinico sin otro foco evidente.",
      "Sitio de insercion con eritema, dolor, secrecion o datos de infeccion.",
      "Hemocultivos o cultivo de punta/sitio documentados cuando aplique.",
      "Plan: valorar retiro/cambio de cateter y antimicrobiano segun evolucion."
    ]
  },
  "ITU - CU": {
    label: "ITU - CU",
    deviceSignals: ["Sonda Foley", "Cateter urinario"],
    cultures: ["Urocultivo", "EGO"],
    criteria: [
      "Cateter urinario activo o retiro reciente.",
      "Fiebre, dolor suprapubico, urgencia urinaria o deterioro sin otro foco.",
      "EGO con piuria, nitritos, esterasa leucocitaria o bacteriuria cuando aplique.",
      "Urocultivo solicitado o resultado microbiologico documentado.",
      "Plan: evaluar retiro de sonda y tratamiento segun cultivo."
    ]
  },
  NAVM: {
    label: "NAVM",
    deviceSignals: ["Ventilacion mecanica", "COT", "CET", "Traqueostomia", "CPAP", "BPAP"],
    cultures: ["Cultivo de secrecion bronquial", "Cultivo de expectoracion", "Cultivo de esputo"],
    criteria: [
      "Ventilacion mecanica, tubo endotraqueal, traqueostomia o soporte ventilatorio relevante.",
      "Fiebre, leucocitosis/leucopenia, secreciones purulentas o aumento de requerimiento ventilatorio.",
      "Cambios respiratorios o radiologicos compatibles documentados cuando existan.",
      "Cultivo respiratorio solicitado o resultado microbiologico documentado.",
      "Plan: higiene oral, aspiracion segura, valorar retiro de VM y antimicrobiano."
    ]
  },
  ISQ: {
    label: "ISQ",
    deviceSignals: ["Herida quirurgica", "Postoperatorio", "Drenaje"],
    cultures: ["Cultivo de herida", "Cultivo de secrecion"],
    criteria: [
      "Procedimiento quirurgico reciente o herida/drenaje en seguimiento.",
      "Dolor, eritema, calor, secrecion, dehiscencia o fiebre asociada.",
      "Sitio quirurgico, fecha de cirugia y tipo de herida documentados.",
      "Cultivo de herida/secrecion solicitado o resultado documentado cuando aplique.",
      "Plan: curacion, control de herida, valorar drenaje/cultivo y antimicrobiano."
    ]
  },
  "COVID/Influenza": {
    label: "COVID/Influenza",
    deviceSignals: ["Aislamiento respiratorio", "Vigilancia transmisible"],
    cultures: ["PCR/SARS-CoV-2", "Prueba influenza", "Panel viral"],
    criteria: [
      "Sintomas respiratorios o vigilancia transmisible activa.",
      "Prueba viral solicitada o resultado documentado.",
      "Fecha de inicio de sintomas y aislamiento registrados cuando aplique.",
      "Plan: aislamiento, notificacion y seguimiento de egreso/OPD si corresponde."
    ]
  },
  Otro: {
    label: "Otro",
    deviceSignals: [],
    cultures: ["Otro cultivo"],
    criteria: [
      "Foco infeccioso, criterio clinico o vigilancia especial descrita.",
      "Evidencia microbiologica, laboratorio o gabinete documentada cuando aplique.",
      "Plan de seguimiento, aislamiento o tratamiento registrado."
    ]
  }
};

const TYPE_ALIASES = new Map([
  ["ITSCC", "ITS - CC"],
  ["ITSCVC", "ITS - CC"],
  ["ITSCCVC", "ITS - CC"],
  ["ITS CVC", "ITS - CC"],
  ["ITS-CVC", "ITS - CC"],
  ["ITUCU", "ITU - CU"],
  ["ITU CU", "ITU - CU"],
  ["ITU-CU", "ITU - CU"],
  ["IVUCU", "ITU - CU"],
  ["NAV", "NAVM"],
  ["NEUMONIAASOCIADAAVENTILACIONMECANICA", "NAVM"],
  ["NEUMONIAASOCIADAAVENTILADOR", "NAVM"],
  ["INFECCIONDESITIOQUIRURGICO", "ISQ"],
  ["SITIOQUIRURGICO", "ISQ"],
  ["COVID", "COVID/Influenza"],
  ["INFLUENZA", "COVID/Influenza"],
  ["COVIDINFLUENZA", "COVID/Influenza"],
  ["SARS COV 2", "COVID/Influenza"],
  ["SARSCOV2", "COVID/Influenza"]
]);

export function iaasTypeOptions() {
  return [["", "Seleccionar"], ...CASE_TYPES.map(type => [type, type])];
}

export function listIaasCaseTypes() {
  return [...CASE_TYPES];
}

export function normalizeIaasType(value = "") {
  const raw = String(value || "").trim();
  const text = normalizedText(raw);
  if (!text) return "";
  const compact = text.replace(/[^A-Z0-9]/g, "");
  const direct = CASE_TYPES.find(type => normalizedText(type) === text || normalizedText(type).replace(/[^A-Z0-9]/g, "") === compact);
  return direct || TYPE_ALIASES.get(text) || TYPE_ALIASES.get(compact) || "Otro";
}

export function getIaasCriteria(type = "") {
  return CATALOG[normalizeIaasType(type)] || CATALOG.Otro;
}

export function criteriaVersionForType(type = "") {
  return type ? IAAS_CRITERIA_VERSION : "";
}

export function buildCriteriaTemplate(type = "") {
  const criteria = getIaasCriteria(type);
  if (!type) return "";
  return criteria.criteria.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function defaultCultureTypeForIaas(type = "") {
  return getIaasCriteria(type).cultures[0] || "";
}

export function defaultAntimicrobialIndication(type = "") {
  const normalized = normalizeIaasType(type);
  return normalized ? `Seguimiento ${normalized}` : "";
}

export function validateIaasClinicalCompleteness(iaas = {}, evidence = {}) {
  const type = normalizeIaasType(iaas.iaasType);
  const status = normalizedText(iaas.status);
  const guide = getIaasCriteria(type || iaas.iaasType);
  const blocking = [];
  const warnings = [];
  const checks = [];
  const strict = CONFIRMATION_STATUSES.has(status);
  const hasCulture = hasCultureEvidence(iaas, evidence, guide);
  const hasAntimicrobial = hasAntimicrobialEvidence(iaas, evidence);
  const hasDevice = hasDeviceEvidence(iaas, guide);
  const hasVitals = hasVitalsEvidence(iaas);
  const hasLabs = hasLabsEvidence(iaas);

  requireCheck(checks, blocking, "type", "Tipo IAAS seleccionado", Boolean(type), true, strict);
  requireCheck(checks, blocking, "onsetDate", "Fecha de inicio documentada", hasValue(iaas.onsetDate), true, strict);
  requireCheck(checks, blocking, "origin", "Origen probable documentado", hasValue(iaas.probableOrigin), true, strict);
  requireCheck(checks, blocking, "criteria", "Criterios clinicos documentados", longEnough(iaas.criteria, 20), true, strict);
  requireCheck(checks, blocking, "followUp", "Seguimiento o evolucion documentada", longEnough(iaas.followUp?.evolution, 10), false, strict);
  requireCheck(checks, blocking, "carePlan", "Plan clinico documentado", longEnough(iaas.followUp?.carePlan, 10), true, strict);
  requireCheck(checks, blocking, "criteriaVersion", "Cedula versionada", iaas.criteriaVersion === criteriaVersionForType(type), false, strict);

  if (type === "ITS - CC") {
    requireCheck(checks, blocking, "vascularDevice", "Dispositivo vascular o cateter documentado", hasDevice, true, strict);
    requireCheck(checks, blocking, "bloodCulture", "Hemocultivo/cultivo de punta o sitio documentado", hasCulture, true, strict);
    requireCheck(checks, blocking, "systemicSigns", "Signos sistemicos o laboratorio documentados", hasVitals || hasLabs || textHasAny(iaas, ["FIEBRE", "ESCALOFRIO", "HIPOTERMIA", "HIPOTENSION", "LEUCO"]), false, strict);
  } else if (type === "ITU - CU") {
    requireCheck(checks, blocking, "urinaryDevice", "Cateter urinario o retiro reciente documentado", hasDevice || textHasAny(iaas, ["SONDA", "FOLEY", "CATETER URINARIO"]), true, strict);
    requireCheck(checks, blocking, "urinaryEvidence", "EGO o urocultivo documentado", hasCulture || hasValue(iaas.labs?.ego), true, strict);
    requireCheck(checks, blocking, "urinarySymptoms", "Datos urinarios o fiebre documentados", textHasAny(iaas, ["FIEBRE", "SUPRAPUBICO", "URIN", "PIURIA", "NITRITOS", "BACTERIURIA"]), false, strict);
  } else if (type === "NAVM") {
    requireCheck(checks, blocking, "ventilationDevice", "Ventilacion/tubo/traqueostomia documentado", hasDevice || hasVentilationEvidence(iaas), true, strict);
    requireCheck(checks, blocking, "respiratoryEvidence", "Evidencia respiratoria o ventilatoria documentada", hasRespiratoryEvidence(iaas), true, strict);
    requireCheck(checks, blocking, "respiratoryCulture", "Cultivo respiratorio documentado", hasCulture, false, strict);
  } else if (type === "ISQ") {
    requireCheck(checks, blocking, "surgeryEvidence", "Procedimiento/herida/drenaje documentado", hasSurgeryEvidence(iaas), true, strict);
    requireCheck(checks, blocking, "woundEvidence", "Datos de herida o secrecion documentados", textHasAny(iaas, ["HERIDA", "SECRECION", "ERITEMA", "DOLOR", "DEHISCENCIA", "DRENAJE"]), true, strict);
    requireCheck(checks, blocking, "woundCulture", "Cultivo de herida/secrecion documentado si aplica", hasCulture, false, strict);
  } else if (type === "COVID/Influenza") {
    requireCheck(checks, blocking, "respiratorySymptoms", "Sintomas respiratorios o vigilancia transmisible documentados", hasRespiratoryEvidence(iaas) || textHasAny(iaas, ["AISLAMIENTO", "TOS", "RINORREA", "DISNEA", "VIGILANCIA"]), true, strict);
    requireCheck(checks, blocking, "viralTest", "Prueba viral o panel respiratorio documentado", hasCulture || textHasAny(iaas, ["PCR", "SARS", "COVID", "INFLUENZA", "PANEL VIRAL"]), true, strict);
    requireCheck(checks, blocking, "opd", "OPD o seguimiento de egreso revisado cuando aplique", hasOpdEvidence(iaas), false, strict);
  } else if (type === "Otro") {
    requireCheck(checks, blocking, "otherFocus", "Foco infeccioso descrito", longEnough(iaas.criteria, 25) || longEnough(iaas.notes, 25), true, strict);
    requireCheck(checks, blocking, "otherEvidence", "Evidencia clinica, laboratorio o gabinete documentada", hasCulture || hasLabs || hasVitals, false, strict);
  }

  if (!strict) warnings.push(...checks.filter(check => !check.ok && check.critical).map(check => check.label));
  if (!hasCulture) warnings.push("Sin cultivo/evidencia microbiologica vinculada a la cedula.");
  if (!hasAntimicrobial) warnings.push("Sin antimicrobiano o plan terapeutico vinculado.");
  if (blocking.length && !strict) {
    warnings.push(...blocking);
    blocking.length = 0;
  }
  const completedChecks = checks.filter(check => check.ok).length;
  const score = checks.length ? Math.round((completedChecks / checks.length) * 100) : 0;
  const validationStatus = blocking.length ? "incompleta" : warnings.length ? "revision" : "completa";

  return {
    version: IAAS_CLINICAL_VALIDATION_VERSION,
    criteriaVersion: criteriaVersionForType(type),
    type,
    status: validationStatus,
    score,
    canConfirm: !blocking.length,
    blocking,
    warnings: uniqueItems(warnings),
    checks
  };
}

function requireCheck(checks, blocking, key, label, ok, critical = false, strict = false) {
  const row = { key, label, ok: Boolean(ok), critical: Boolean(critical) };
  checks.push(row);
  if (!row.ok && critical && strict) blocking.push(label);
}

function hasValue(value = "") {
  return String(value || "").trim().length > 0;
}

function longEnough(value = "", min = 10) {
  return String(value || "").trim().length >= min;
}

function normalizedText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function evidenceRows(value = {}) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return [value];
}

function evidenceText(rows = []) {
  return rows
    .map(row => flattenValues(row).join(" "))
    .join(" ");
}

function iaasText(iaas = {}) {
  const assessment = legacyAssessment(iaas);
  return normalizedText([
    iaas.iaasType,
    iaas.probableOrigin,
    iaas.criteria,
    iaas.notes,
    iaas.observations,
    iaas.deviceEpisodeId,
    iaas.vitalSigns?.temperature,
    iaas.vitalSigns?.spo2,
    iaas.vitalSigns?.oxygenSaturation,
    iaas.vitalSigns?.fio2,
    iaas.vitalSigns?.peep,
    iaas.labs?.biometry,
    iaas.labs?.ego,
    iaas.labs?.otherStudies,
    iaas.followUp?.evolution,
    iaas.followUp?.carePlan,
    iaas.followUp?.observations,
    evidenceText(iaas.labs?.customStudies || []),
    evidenceText(evidenceRows(assessment))
  ].filter(Boolean).join(" "));
}

function textHasAny(iaas = {}, terms = []) {
  const text = iaasText(iaas);
  return terms.some(term => text.includes(normalizedText(term)));
}

function hasDeviceEvidence(iaas = {}, guide = {}) {
  if (hasValue(iaas.deviceEpisodeId)) return true;
  const assessment = legacyAssessment(iaas);
  if (clinicalObjectHasValue(assessment.infectionTracking, ["assessmentDate"])) return true;
  const text = iaasText(iaas);
  return (guide.deviceSignals || []).some(signal => text.includes(normalizedText(signal)));
}

function hasCultureEvidence(iaas = {}, evidence = {}, guide = {}) {
  const assessment = legacyAssessment(iaas);
  const rows = [
    ...evidenceRows(evidence.cultureDraft),
    ...evidenceRows(evidence.cultures),
    ...evidenceRows(iaas.cultures),
    ...evidenceRows(assessment.cultures),
    ...evidenceRows(assessment.otherStudies?.viralPanel),
    ...evidenceRows(iaas.clinicalValidationEvidence?.cultures)
  ];
  if (rows.some(row => hasValue(row.sampleType || row.type || row.test || row.organism || row.microorganism || row.result || row.resultAt || row.resultDate || row.collectionDate))) return true;
  const text = iaasText(iaas);
  return (guide.cultures || []).some(culture => text.includes(normalizedText(culture)))
    || text.includes("CULTIVO")
    || text.includes("HEMOCULTIVO")
    || text.includes("UROCULTIVO")
    || text.includes("PCR")
    || text.includes("PANEL VIRAL");
}

function hasAntimicrobialEvidence(iaas = {}, evidence = {}) {
  const assessment = legacyAssessment(iaas);
  const rows = [
    ...evidenceRows(evidence.antimicrobialDraft),
    ...evidenceRows(evidence.antimicrobials),
    ...evidenceRows(iaas.treatments),
    ...evidenceRows(iaas.antimicrobials),
    ...evidenceRows(assessment.treatments),
    ...evidenceRows(iaas.clinicalValidationEvidence?.antimicrobials)
  ];
  if (rows.some(row => hasValue(row.drug || row.customDrug || row.antimicrobial || row.indication || row.startDate))) return true;
  return textHasAny(iaas, ["ANTIMICROBIANO", "ANTIBIOTICO", "TRATAMIENTO", "VANCOMICINA", "MEROPENEM", "CEFTRIAXONA"]);
}

function hasVitalsEvidence(iaas = {}) {
  const assessment = legacyAssessment(iaas);
  return [iaas.vitalSigns, iaas.followUp?.vitalSigns, assessment.vitalSigns].some(vitals =>
    clinicalObjectHasValue(vitals, ["studyDate"]) && [vitals.temperature, vitals.heartRate, vitals.respiratoryRate, vitals.bloodPressure, vitals.spo2, vitals.oxygenSaturation].some(hasValue)
  );
}

function hasLabsEvidence(iaas = {}) {
  const assessment = legacyAssessment(iaas);
  const labs = iaas.labs || {};
  return [labs.biometry, labs.ego, labs.otherStudies].some(hasValue)
    || clinicalObjectHasValue(labs.customStudies)
    || clinicalObjectHasValue(assessment.cbc, ["studyDate"])
    || clinicalObjectHasValue(assessment.urinalysis, ["studyDate"])
    || clinicalObjectHasValue(assessment.otherStudies, ["studyDate"]);
}

function hasVentilationEvidence(iaas = {}) {
  const assessment = legacyAssessment(iaas);
  const vitalRows = [iaas.vitalSigns, iaas.followUp?.vitalSigns, assessment.vitalSigns];
  return vitalRows.some(vitals => [vitals?.fio2, vitals?.peep].some(hasValue))
    || textHasAny(iaas, ["VENTIL", "COT", "CET", "TRAQUEOSTOMIA", "CPAP", "BPAP"]);
}

function hasRespiratoryEvidence(iaas = {}) {
  const assessment = legacyAssessment(iaas);
  const vitalRows = [iaas.vitalSigns, iaas.followUp?.vitalSigns, assessment.vitalSigns];
  return vitalRows.some(vitals => [vitals?.respiratoryRate, vitals?.spo2, vitals?.oxygenSaturation, vitals?.fio2, vitals?.peep].some(hasValue))
    || textHasAny(iaas, ["RESPIR", "SECRECION", "RADIOLOG", "NEUMON", "DISNEA", "SATURACION", "SPO2"]);
}

function hasSurgeryEvidence(iaas = {}) {
  return textHasAny(iaas, ["CIRUG", "QUIROFANO", "POSTOPERATORIO", "HERIDA", "DRENAJE", "SITIO QUIRURGICO"]);
}

function hasOpdEvidence(iaas = {}) {
  const opd = iaas.opd || {};
  return [opd.address, opd.phone, opd.symptomStartDate, opd.dischargeDate, opd.uploaded, opd.discharged].some(value => value === true || hasValue(value));
}

function uniqueItems(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function legacyAssessment(iaas = {}) {
  return iaas.iaasAssessment || iaas.assessment || iaas.dailyIaasAssessment || iaas.followUp?.iaasAssessment || {};
}

function flattenValues(value, depth = 0) {
  if (value === null || value === undefined || depth > 4) return [];
  if (Array.isArray(value)) return value.flatMap(item => flattenValues(item, depth + 1));
  if (typeof value === "object") return Object.values(value).flatMap(item => flattenValues(item, depth + 1));
  return [String(value)];
}

function clinicalObjectHasValue(value = {}, ignoredKeys = []) {
  if (!value) return false;
  if (Array.isArray(value)) return value.some(item => clinicalObjectHasValue(item, ignoredKeys));
  if (typeof value !== "object") return hasValue(value);
  const ignored = new Set(ignoredKeys);
  return Object.entries(value).some(([key, item]) => !ignored.has(key) && clinicalObjectHasValue(item, ignoredKeys));
}

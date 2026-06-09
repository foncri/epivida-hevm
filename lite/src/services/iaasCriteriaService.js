export const IAAS_CRITERIA_VERSION = "lite-iaas-criteria-2026-06-09-v1";

const CASE_TYPES = ["ITS - CC", "ITU - CU", "NAVM", "ISQ", "COVID/Influenza", "Otro"];

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

export function iaasTypeOptions() {
  return [["", "Seleccionar"], ...CASE_TYPES.map(type => [type, type])];
}

export function listIaasCaseTypes() {
  return [...CASE_TYPES];
}

export function normalizeIaasType(value = "") {
  const text = String(value || "").trim().toUpperCase();
  return CASE_TYPES.find(type => type.toUpperCase() === text) || (text ? "Otro" : "");
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

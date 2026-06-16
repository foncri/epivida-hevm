import { normalizeDate } from "../lib/date.js";

export const PREVENTIVE_ROUND_WORKFLOW_VERSION = "lite-preventive-round-workflow-2026-06-16-v1";
export const PREVENTIVE_PACKAGE_TYPES = ["ITS - CC", "ITU - CU", "NAVM", "ISQ", "P.E. Y P.B.M.T.", "ESPECIAL"];
export const YES_NO_NA = ["SI", "NO", "NA"];
export const SURGERY_ROOM_VALUES = ["SI", "NO"];
export const FRENCH_OPTIONS = ["3 Fr", "4 Fr", "5 Fr", "6 Fr", "7 Fr", "8 Fr", "9 Fr", "10 Fr", "12 Fr", "14 Fr", "16 Fr", "18 Fr", "20 Fr", "22 Fr", "24 Fr"];
export const ITS_DEVICE_TYPES = ["CVPC", "CVC", "PICC", "CATT HD", "C. PUERTO", "ONFALOCLISIS"];
export const ITU_MATERIAL_TYPES = ["SILICON", "LATEX"];
export const ITU_DEVICE_STATES = ["A DERIVACION", "CIRCUITO CERRADO"];
export const NAVM_DEVICE_TYPES = ["PUNTAS NASALES", "CANULA NASAL", "MASCARILLA RESERVORIO", "COT", "CET", "INTUBACION OROTRAQUEAL", "INTUBACION ENDOTRAQUEAL", "TRAQUEOSTOMIA", "CPAP", "BPAP"];
export const NAVM_ORAL_HYGIENE_TYPES = ["CLORHEXIDINA", "SALINA", "CEPILLO DENTAL"];
export const SPECIAL_DEVICE_TYPES = ["SONDA NASOGASTRICA", "SONDA OROGASTRICA", "GASTROSTOMIA", "COLOSTOMIA", "DRENOVAC", "PLEUROVAC"];

export const PREVENTIVE_CHECKS = {
  "ITS - CC": [
    ["dailyReview", "REGISTRO REVISION DIARIA"],
    ["asepticDressing", "CURACION ASEPTICA DE CATETER"],
    ["correctOpening", "APERTURA CORRECTA EN CASO DE INTERRUMPIR CONEXION"],
    ["infusionSystemChange", "CAMBIO SISTEMA DE INFUSION"],
    ["evolutionNote", "NOTA DE EVOLUCION VIGENTE"]
  ],
  "ITU - CU": [
    ["hasLabel", "CON MEMBRETE"],
    ["sexMatch", "DE ACUERDO A SEXO"],
    ["genitalHygiene", "HIGIENE GENITAL"],
    ["unobstructedDrainage", "DRENAJE SIN OBSTRUCCION"],
    ["correctBagLevel", "CORRECTO NIVEL BOLSA COLECTORA"],
    ["closedSystem", "SISTEMA SIN DESCONEXION"],
    ["evolutionNote", "NOTA DE EVOLUCION"],
    ["urineCharacteristics", "REGISTRO CARACTERISTICAS DE LA ORINA"],
    ["installationDaysRecord", "REGISTRO DIAS DE INSTALACION"]
  ],
  NAVM: [
    ["asepticIntubation", "INTUBACION ASEPTICA"],
    ["patientPosition", "POSICION ADECUADA DEL PACIENTE"],
    ["sedationInterruption", "REGISTRO DE POSIBLE INTERRUPCION DE SEDACION"],
    ["possibleRemoval", "REGISTRO DE POSIBLE RETIRO VM"],
    ["closedSuction", "ASPIRACION DE SECRECIONES CON CIRCUITO CERRADO"],
    ["oralHygiene", "HIGIENE ORAL"],
    ["humidity", "HUMEDAD ACTIVA/PASIVA"]
  ],
  ISQ: [
    ["preSurgicalProphylaxis", "PROFILAXIS PREQUIRURGICA ADECUADA"],
    ["preSurgicalHairRemoval", "RASURADO ADECUADO PREQUIRURGICO"],
    ["glucoseMonitoring", "MONITOREO GLUCEMICO"],
    ["temperature", "TEMPERATURA MAYOR A 35.5 C"],
    ["dressing", "HERIDA CON APOSITO"]
  ],
  "P.E. Y P.B.M.T.": [
    ["precautionAssignment", "ASIGNACION MEDIDAS DE PRECAUCION"],
    ["precautionUpdate", "ACTUALIZACION MEDIDAS DE PRECAUCION"],
    ["precautionRemoval", "RETIRO MEDIDAS DE PRECAUCION"],
    ["supplies", "INSUMOS"],
    ["education", "EDUCACION"],
    ["congruentPrescription", "PRESCRIPCION Y ACCION CONGRUENTE"],
    ["precautionCards", "TARJETAS DE PRECAUCION ADECUADAS"]
  ]
};

export function normalizeValue(value) {
  return String(value || "").trim().toUpperCase();
}

export function sanitizePreventiveRoundText(value) {
  const text = String(value || "")
    .replace(/\s*(?:\/|\||;)+\s*/g, " / ")
    .replace(/(?:^|\s)\/+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(?:\/|\||;|\s)*$/.test(text)) return "";
  return text
    .replace(/^\s*(?:\/|\||;)+\s*/, "")
    .replace(/\s*(?:\/|\||;)+\s*$/, "")
    .trim();
}

export function normalizeSurgeryRoomDraft(value = {}, fallbackDate = "") {
  const selected = normalizeValue(value.inOperatingRoom);
  const inOperatingRoom = SURGERY_ROOM_VALUES.includes(selected) ? selected : "";
  return {
    inOperatingRoom,
    date: normalizeDate(value.date) || normalizeDate(fallbackDate) || "",
    time: normalizeSurgeryRoomTime(value.time),
    _dirty: Boolean(value._dirty)
  };
}

export function surgeryRoomPayload(draft = {}, fallbackDate = "") {
  const source = draft.surgeryRoom || {};
  const room = normalizeSurgeryRoomDraft(source, fallbackDate);
  if (room.inOperatingRoom === "SI") {
    return {
      inOperatingRoom: "SI",
      date: room.date || normalizeDate(fallbackDate) || "",
      time: room.time
    };
  }
  if (room.inOperatingRoom === "NO" && (source._dirty || source.inOperatingRoom)) {
    return { inOperatingRoom: "NO" };
  }
  return null;
}

function normalizeSurgeryRoomTime(value) {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : "";
}

export function packageCreatesDevice(device) {
  const type = typeof device === "string" ? device : device?.packageType;
  return !["ISQ", "P.E. Y P.B.M.T."].includes(type);
}

export function defaultPreventiveDevice(packageType) {
  return {
    packageType,
    createsDevice: packageCreatesDevice(packageType),
    deviceType: packageType === "ITS - CC" ? "CVPC"
      : packageType === "ITU - CU" ? "Sonda Foley"
        : packageType === "NAVM" ? "PUNTAS NASALES"
          : packageType === "ESPECIAL" ? "SONDA NASOGASTRICA"
            : packageType,
    deviceSubtype: "",
    material: packageType === "ITU - CU" ? "SILICON" : "",
    deviceState: packageType === "ITU - CU" ? "CIRCUITO CERRADO" : "",
    french: "",
    installationDate: packageCreatesDevice(packageType) ? "" : "",
    removalDate: "",
    preventiveChecks: {},
    oralHygieneMethod: "",
    observations: "",
    notes: ""
  };
}

export function preventiveCompliance(checks = {}) {
  const values = Object.values(checks).map(normalizeValue).filter(value => value === "SI" || value === "NO");
  if (!values.length) return "";
  const yes = values.filter(value => value === "SI").length;
  return `${Math.round((yes / values.length) * 100)}%`;
}

export function packageReviewSummary(device = {}) {
  const checks = PREVENTIVE_CHECKS[device.packageType] || [];
  return {
    packageType: device.packageType || "",
    deviceType: deviceDisplayName(device),
    material: device.material || "",
    deviceState: device.deviceState || "",
    french: device.french || "",
    installationDate: device.installationDate || "",
    removalDate: device.removalDate || "",
    preventiveChecks: device.preventiveChecks || {},
    compliance: preventiveCompliance(device.preventiveChecks || {}),
    oralHygieneMethod: device.oralHygieneMethod || "",
    observations: device.observations || "",
    reviewedFields: checks.map(([key, label]) => ({ key, label, value: device.preventiveChecks?.[key] || "" }))
  };
}

export function deviceDisplayName(device = {}) {
  return [device.deviceType, device.deviceSubtype].filter(Boolean).join(" - ") || device.packageType || "Dispositivo";
}

export function packageTone(type = "") {
  if (type === "ITS - CC" || type === "CVC" || type === "CVPC") return "cvc";
  if (type === "ITU - CU" || type === "Sonda Foley") return "foley";
  if (type === "NAVM") return "nav";
  if (type === "ISQ") return "isq";
  if (type === "P.E. Y P.B.M.T.") return "precaution";
  if (type === "ESPECIAL") return "special";
  return "neutral";
}

export function packageLabel(type = "") {
  if (type === "ITS - CC") return "CVC";
  if (type === "ITU - CU") return "Cateter urinario";
  if (type === "NAVM") return "NAV";
  if (type === "P.E. Y P.B.M.T.") return "Precauciones";
  return type || "Valoracion rapida";
}

export function devicePackageSignal(device = {}) {
  const type = device.preventivePackage || device.packageType || device.deviceType || "";
  if (["CVC", "CVPC", "PICC", "CATT HD", "C. PUERTO", "ONFALOCLISIS"].includes(type) || ["CVC", "CVPC", "PICC", "CATT HD", "C. PUERTO", "ONFALOCLISIS"].includes(device.deviceType)) {
    return { label: "CVC", tone: "cvc" };
  }
  if (type === "Sonda Foley" || device.deviceType === "Sonda Foley") return { label: "Cateter urinario", tone: "foley" };
  if (["Ventilacion mecanica", "Tubo endotraqueal", "Traqueostomia", "NAVM", "COT", "CET", "CPAP", "BPAP"].includes(type) || ["Ventilacion mecanica", "Tubo endotraqueal", "Traqueostomia", "COT", "CET", "CPAP", "BPAP"].includes(device.deviceType)) {
    return { label: "NAV", tone: "nav" };
  }
  return { label: packageLabel(type), tone: packageTone(type) };
}

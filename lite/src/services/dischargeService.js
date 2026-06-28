import { normalizeDate, todayIso } from "../lib/date.js";
import { normalizeText } from "../lib/normalize.js";

export const DISCHARGE_TYPES = [
  "ALTA HOSPITALARIA POR MEJORIA",
  "ALTA HOSPITALARIA VOLUNTARIA",
  "ALTA HOSPITALARIA POR MAXIMO BENEFICIO",
  "ALTA HOSPITALARIA POR TRASLADO",
  "ALTA HOSPITALARIA NO AUTORIZADA",
  "DEFUNCION",
  "SIN DATO"
];

export const DISCHARGE_SHIFTS = ["MATUTINO", "VESPERTINO", "NOCTURNO", "JORNADA ESPECIAL", "SIN TURNO"];

const DISCHARGE_TYPE_ALIASES = new Map([
  ["MEJORIA", "ALTA HOSPITALARIA POR MEJORIA"],
  ["ALTA POR MEJORIA", "ALTA HOSPITALARIA POR MEJORIA"],
  ["ALTA HOSPITALARIA POR MEJORIA", "ALTA HOSPITALARIA POR MEJORIA"],
  ["VOLUNTARIA", "ALTA HOSPITALARIA VOLUNTARIA"],
  ["ALTA VOLUNTARIA", "ALTA HOSPITALARIA VOLUNTARIA"],
  ["ALTA HOSPITALARIA VOLUNTARIA", "ALTA HOSPITALARIA VOLUNTARIA"],
  ["MAXIMO BENEFICIO", "ALTA HOSPITALARIA POR MAXIMO BENEFICIO"],
  ["ALTA POR MAXIMO BENEFICIO", "ALTA HOSPITALARIA POR MAXIMO BENEFICIO"],
  ["ALTA HOSPITALARIA POR MAXIMO BENEFICIO", "ALTA HOSPITALARIA POR MAXIMO BENEFICIO"],
  ["TRASLADO", "ALTA HOSPITALARIA POR TRASLADO"],
  ["ALTA POR TRASLADO", "ALTA HOSPITALARIA POR TRASLADO"],
  ["ALTA HOSPITALARIA POR TRASLADO", "ALTA HOSPITALARIA POR TRASLADO"],
  ["NO AUTORIZADA", "ALTA HOSPITALARIA NO AUTORIZADA"],
  ["ALTA NO AUTORIZADA", "ALTA HOSPITALARIA NO AUTORIZADA"],
  ["ALTA HOSPITALARIA NO AUTORIZADA", "ALTA HOSPITALARIA NO AUTORIZADA"],
  ["DEFUNCION", "DEFUNCION"],
  ["SIN DATO", "SIN DATO"]
]);

export function normalizeDischargeType(value = "", fallback = DISCHARGE_TYPES[0]) {
  const key = normalizeText(value);
  if (!key) return fallback;
  return DISCHARGE_TYPE_ALIASES.get(key) || DISCHARGE_TYPES.find(item => normalizeText(item) === key) || fallback;
}

export function normalizeDischargeShift(value = "", fallback = DISCHARGE_SHIFTS.at(-1)) {
  const key = normalizeText(value);
  if (!key) return fallback;
  return DISCHARGE_SHIFTS.find(item => normalizeText(item) === key) || fallback;
}

export function dischargeDateValue(value = "", fallback = todayIso()) {
  return normalizeDate(value) || fallback;
}

export function dischargeReasonForType(type = "") {
  const normalized = normalizeDischargeType(type);
  if (normalizeText(normalized) === "DEFUNCION") return "defuncion";
  return `alta_${normalizeText(normalized).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "egreso"}`;
}

export function dischargeSummary(type = "", date = "", shift = "") {
  const normalizedType = normalizeDischargeType(type);
  const normalizedDate = dischargeDateValue(date, "");
  const normalizedShift = normalizeDischargeShift(shift);
  return [normalizedType, normalizedDate, `TURNO ${normalizedShift}`].filter(Boolean).join(" - ");
}

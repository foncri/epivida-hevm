import { todayMexico } from "./config.js";

export function todayIso() {
  return todayMexico();
}

export function normalizeDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return "";
}

export function nowIso() {
  return new Date().toISOString();
}

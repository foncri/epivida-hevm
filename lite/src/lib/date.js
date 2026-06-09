import { todayMexico } from "./config.js";

export function todayIso() {
  return todayMexico();
}

export function validIsoDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

export function normalizeDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validIsoDate(text) ? text : "";
  const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    const iso = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    if (validIsoDate(iso)) return iso;
  }
  return "";
}

export function nowIso() {
  return new Date().toISOString();
}

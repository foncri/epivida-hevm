import { todayMexico } from "./config.js";

export function todayIso() {
  return todayMexico();
}

export function normalizeDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    const iso = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    const parsed = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return iso;
  }
  return "";
}

export function nowIso() {
  return new Date().toISOString();
}

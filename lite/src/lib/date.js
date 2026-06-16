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
  if (!text || ["AMB", "NA", "N/A"].includes(text.toUpperCase())) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validIsoDate(text) ? text : "";
  const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? expandTwoDigitYear(match[3]) : match[3];
    const iso = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    if (validIsoDate(iso)) return iso;
  }
  const embedded = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (embedded && embedded[0] !== text) return normalizeDate(embedded[0]);
  if (/^\d+(?:\.\d+)?$/.test(text)) return excelSerialDateToIso(text);
  return "";
}

function excelSerialDateToIso(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 20000 || number > 80000) return "";
  const date = new Date(Math.round((number - 25569) * 86400000));
  const iso = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return validIsoDate(iso) ? iso : "";
}

function expandTwoDigitYear(value) {
  const number = Number(value);
  const current = new Date().getFullYear() % 100;
  return `${number <= current + 1 ? 2000 + number : 1900 + number}`;
}

export function nowIso() {
  return new Date().toISOString();
}

import { normalizeDate } from "../lib/date.js";
import { normalizeBed, normalizeEpidemiologicalDiagnosis, normalizeService, normalizeSex, normalizeStatus, normalizedPatientName, normalizeText } from "../lib/normalize.js";
import { cleanText, stripUndefined } from "../lib/validators.js";

const HEADER_ALIASES = {
  patientId: ["patientid", "id", "folio", "expediente", "registro"],
  hospitalInternalId: ["expediente", "registro", "numero expediente", "folio hospitalario"],
  patientName: ["paciente", "nombre", "nombre paciente", "nombre completo"],
  service: ["servicio", "area", "unidad", "piso"],
  bed: ["cama", "habitacion", "ubicacion", "cubiculo"],
  sector: ["sector"],
  sex: ["sexo", "genero"],
  age: ["edad"],
  birthDate: ["fecha nacimiento", "nacimiento"],
  admissionDate: ["fecha ingreso", "ingreso", "fecha admision", "admision"],
  deih: ["deih", "dias estancia", "dias de estancia"],
  status: ["estado", "gravedad", "condicion"],
  epidemiologicalDiagnosis: ["dx epidemiologico", "diagnostico epidemiologico", "riesgo iaas", "clasificacion"],
  hospitalDiagnosis: ["dx hospitalario", "diagnostico", "diagnostico hospitalario", "padecimiento"],
  isolation: ["aislamiento"],
  observations: ["observaciones", "notas", "pendientes"]
};

const CANONICAL_BY_HEADER = Object.entries(HEADER_ALIASES).reduce((map, [field, aliases]) => {
  aliases.forEach(alias => map.set(headerKey(alias), field));
  return map;
}, new Map());

function headerKey(value = "") {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function delimiterFor(lines) {
  const sample = lines.slice(0, 5).join("\n");
  const candidates = ["\t", ";", ",", "|"];
  return candidates
    .map(delimiter => ({ delimiter, count: sample.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || "\t";
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map(cell => cleanText(cell, 1000));
}

function looksLikeHeader(cells = []) {
  const mapped = cells.filter(cell => CANONICAL_BY_HEADER.has(headerKey(cell))).length;
  return mapped >= 2 || cells.some(cell => ["paciente", "servicio", "cama"].includes(headerKey(cell)));
}

function mapHeaders(cells = []) {
  return cells.map((cell, index) => CANONICAL_BY_HEADER.get(headerKey(cell)) || `extra_${index}`);
}

function fallbackHeaders(width) {
  return ["patientName", "service", "bed", "age", "sex", "hospitalDiagnosis", "epidemiologicalDiagnosis"]
    .slice(0, width);
}

export function parseCensusInput(input = "") {
  const lines = String(input || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], issues: ["No hay datos para importar."], delimiter: "" };
  const delimiter = delimiterFor(lines);
  const parsed = lines.map(line => splitDelimitedLine(line, delimiter));
  const hasHeader = looksLikeHeader(parsed[0]);
  const headers = hasHeader ? mapHeaders(parsed[0]) : fallbackHeaders(parsed[0].length);
  const dataRows = hasHeader ? parsed.slice(1) : parsed;
  const rows = dataRows.map((cells, index) => normalizeImportRow(cells, headers, index + 1)).filter(row => row.patientName || row.bed || row.service);
  const issues = [];
  if (!hasHeader) issues.push("No se detecto encabezado; se uso orden: paciente, servicio, cama, edad, sexo, diagnostico.");
  rows.forEach(row => {
    if (!row.patientName) issues.push(`Fila ${row.sourceRow}: falta paciente.`);
    if (!row.service) issues.push(`Fila ${row.sourceRow}: falta servicio.`);
  });
  return { rows, issues, delimiter, hasHeader };
}

export function normalizeImportRow(cells = [], headers = [], sourceRow = 1) {
  const raw = {};
  headers.forEach((field, index) => {
    if (field?.startsWith("extra_")) return;
    raw[field] = cells[index] || "";
  });
  const service = normalizeService(raw.service);
  const bed = normalizeBed(raw.bed);
  const patientName = cleanText(raw.patientName, 240);
  const admissionDate = normalizeDate(raw.admissionDate);
  const birthDate = normalizeDate(raw.birthDate);
  const age = Number(String(raw.age || "").match(/\d+/)?.[0]);
  return stripUndefined({
    sourceRow,
    patientId: cleanText(raw.patientId, 160),
    hospitalInternalId: cleanText(raw.hospitalInternalId, 160),
    patientName,
    normalizedPatientName: normalizedPatientName(patientName),
    service,
    currentService: service,
    bed,
    currentBed: bed,
    sector: normalizeText(raw.sector),
    sex: normalizeSex(raw.sex),
    age: Number.isFinite(age) ? age : "",
    birthDate,
    admissionDate,
    deih: cleanText(raw.deih, 40),
    status: normalizeStatus(raw.status),
    currentState: normalizeStatus(raw.status),
    epidemiologicalDiagnosis: normalizeEpidemiologicalDiagnosis(raw.epidemiologicalDiagnosis),
    currentEpidemiologicalDiagnosis: normalizeEpidemiologicalDiagnosis(raw.epidemiologicalDiagnosis),
    hospitalDiagnosis: cleanText(raw.hospitalDiagnosis, 500),
    currentDiagnosis: cleanText(raw.hospitalDiagnosis, 500),
    isolation: cleanText(raw.isolation, 120),
    observations: cleanText(raw.observations, 800),
    active: true
  });
}

export function importRowSignature(row = {}) {
  return [
    row.hospitalInternalId,
    row.normalizedPatientName,
    row.birthDate,
    row.admissionDate,
    row.sex
  ].map(value => String(value || "")).join("|");
}

export function hashImportRows(rows = []) {
  let hash = 2166136261;
  const text = rows.map(importRowSignature).join("\n");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

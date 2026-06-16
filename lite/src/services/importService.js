import { normalizeDate } from "../lib/date.js";
import { normalizeEpidemiologicalDiagnosis, normalizeImportLocation, normalizeSector, normalizeSex, normalizeStatus, normalizedPatientName, normalizeText } from "../lib/normalize.js";
import { cleanText, stripUndefined } from "../lib/validators.js";
import { CENSUS_REPAIR_VERSION, repairHospitalCensusInput } from "./censusRepairService.js";

const HEADER_ALIASES = {
  patientId: ["patientid", "id", "folio", "expediente", "registro"],
  hospitalInternalId: ["expediente", "registro", "numero expediente", "folio hospitalario", "rfc", "afiliacion", "nss", "numero afiliacion"],
  patientName: ["paciente", "nombre", "nombre paciente", "nombre completo", "nombre del paciente", "apellidos y nombres", "apellido y nombre"],
  service: ["servicio", "area", "unidad", "piso"],
  bed: ["cama", "cam", "habitacion", "ubicacion", "ubicacion cama", "cubiculo", "sillon", "cama/sillon"],
  serviceBed: ["servicio cama", "servicio/cama", "ubicacion cama", "cama servicio"],
  sector: ["sector", "derechohabiencia", "derecho habiencia", "tipo derechohabiente", "tipo de derechohabiente"],
  sex: ["sexo", "genero"],
  age: ["edad"],
  birthDate: ["fecha nacimiento", "fecha de nacimiento", "nacimiento", "f nac", "fnac", "fecha nac"],
  admissionDate: ["fecha ingreso", "fecha de ingreso", "ingreso", "f ingreso", "fecha admision", "admision"],
  deih: ["deih", "eih", "d e i h", "dias estancia", "dias de estancia", "estancia"],
  status: ["estado", "estado de salud", "estado clinico", "gravedad", "condicion"],
  epidemiologicalDiagnosis: ["dx epidemiologico", "diagnostico epidemiologico", "riesgo iaas", "clasificacion"],
  hospitalDiagnosis: ["dx hospitalario", "diagnostico", "diagnostico actual", "diagnostico hospitalario", "diagnosticos hospitalarios", "dx actual", "dx", "padecimiento", "diagnostico de ingreso", "dx ingreso"],
  isolation: ["aislamiento"],
  observations: ["observaciones", "obs", "notas", "pendientes", "observaciones y pendientes", "pendientes y observaciones", "indicaciones"]
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

export function parseCensusInput(input = "", options = {}) {
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
  const standard = { rows, issues, delimiter, hasHeader, repairVersion: "" };
  const repair = repairHospitalCensusInput(input, {
    date: options.date || "",
    sourceName: options.sourceName || ""
  });
  if (!shouldUseRepair(standard, repair)) return standard;
  const repairedRows = repair.rows
    .map((row, index) => normalizeImportRecord(row, row.sourceRow || index + 1))
    .filter(row => row.patientName || row.bed || row.service);
  const repairedIssues = [...repair.issues];
  repairedRows.forEach(row => {
    if (!row.patientName) repairedIssues.push(`Fila ${row.sourceRow}: falta paciente tras reparacion.`);
    if (!row.service || row.service === "PENDIENTE") repairedIssues.push(`Fila ${row.sourceRow}: servicio pendiente tras reparacion.`);
  });
  return {
    rows: repairedRows,
    issues: repairedIssues,
    delimiter: repair.delimiter || delimiter,
    hasHeader: Boolean(hasHeader),
    repaired: true,
    repairVersion: CENSUS_REPAIR_VERSION
  };
}

export function normalizeImportRow(cells = [], headers = [], sourceRow = 1) {
  const raw = {};
  headers.forEach((field, index) => {
    if (field?.startsWith("extra_")) return;
    raw[field] = cells[index] || "";
  });
  return normalizeImportRecord(raw, sourceRow);
}

export function normalizeImportRecord(raw = {}, sourceRow = 1) {
  const location = normalizeImportLocation(raw.service, raw.bed, raw.serviceBed);
  const service = location.service;
  const bed = location.bed;
  const patientName = cleanText(raw.patientName, 240);
  const admissionDate = normalizeDate(raw.admissionDate);
  const birthDate = normalizeDate(raw.birthDate);
  const rawAge = cleanText(raw.age, 40);
  const age = Number(String(rawAge || "").match(/\d+/)?.[0]);
  const hospitalDiagnosis = cleanText(raw.hospitalDiagnosis || raw.diagnosisNow || raw.diagnosisIn, 500);
  const hospitalInternalId = cleanText(raw.hospitalInternalId || raw.rfc, 160);
  return stripUndefined({
    sourceRow,
    patientId: cleanText(raw.patientId, 160),
    hospitalInternalId,
    rfc: cleanText(raw.rfc || hospitalInternalId, 160),
    patientName,
    normalizedPatientName: normalizedPatientName(patientName),
    service,
    currentService: service,
    bed,
    currentBed: bed,
    sector: normalizeSector(raw.sector),
    sex: normalizeSex(raw.sex),
    age: /[A-Za-z]/.test(rawAge) ? rawAge : Number.isFinite(age) ? age : rawAge,
    birthDate,
    admissionDate,
    deih: cleanText(raw.deih, 40),
    status: normalizeStatus(raw.status),
    currentState: normalizeStatus(raw.status),
    epidemiologicalDiagnosis: normalizeEpidemiologicalDiagnosis(raw.epidemiologicalDiagnosis),
    currentEpidemiologicalDiagnosis: normalizeEpidemiologicalDiagnosis(raw.epidemiologicalDiagnosis),
    hospitalDiagnosis,
    currentDiagnosis: hospitalDiagnosis,
    isolation: cleanText(raw.isolation, 120),
    observations: cleanText(raw.observations, 800),
    importRepairVersion: raw.repairVersion || "",
    active: true
  });
}

function shouldUseRepair(standard = {}, repair = {}) {
  if (!repair.attempted || !repair.rows?.length) return false;
  const standardComplete = standard.rows.filter(row => row.patientName && row.service && row.bed).length;
  const repairedComplete = repair.rows.filter(row => row.patientName && row.service && row.bed).length;
  if (!standard.hasHeader) return repairedComplete >= Math.max(1, standardComplete);
  if (repairedComplete > standardComplete) return true;
  if (standard.issues.some(issue => /falta paciente|falta servicio/i.test(issue))) return true;
  return false;
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

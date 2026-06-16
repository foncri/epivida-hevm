import { normalizeDate, todayIso } from "../lib/date.js";
import { normalizeBed, normalizeSector, normalizeService, normalizeSex, normalizeStatus, normalizeText, serviceFromBed } from "../lib/normalize.js";
import { cleanText } from "../lib/validators.js";

export const CENSUS_REPAIR_VERSION = "legacy-import-census-repair-2026-06-16-v1";

const OUTPUT_HEADERS = [
  "Servicio",
  "Cama",
  "Paciente",
  "Fecha de nacimiento",
  "Edad",
  "Sector",
  "RFC",
  "Sexo",
  "Ingreso",
  "DEIH",
  "Estado",
  "Diagnosticos hospitalarios",
  "Observaciones y pendientes"
];

const HEADER_ALIASES = {
  bed: [/^CAMA$/, /^CAM$/, /^CAMA\s*\/\s*SILLON$/, /^SILLON$/, /^UBICACION$/, /^UBICACION\s*CAMA$/, /^SERVICIO\s*\/\s*CAMA$/],
  patientName: [/^NOMBRE$/, /^NOMBRE\s+DEL\s+PACIENTE$/, /^NOMBRE\s+COMPLETO$/, /^PACIENTE$/, /^APELLIDOS?\s+Y\s+NOMBRES?$/],
  birthDate: [/^FECHA\s+DE\s+NACIMIENTO$/, /^NACIMIENTO$/, /^FECHA\s+NACIMIENTO$/, /^F\.?\s*NAC\.?$/, /^FNAC$/, /^FECHA\s+NAC\.?$/],
  hospitalInternalId: [/^RFC$/, /^AFILIACION$/, /^EXPEDIENTE$/, /^NSS$/, /^NUMERO\s+DE\s+AFILIACION$/],
  age: [/^EDAD$/],
  sex: [/^SEXO$/, /^GENERO$/, /^SEX$/],
  sector: [/^SECTOR$/, /^DERECHOHABIENCIA$/, /^DERECHO\s*HABIENCIA$/, /^TIPO\s+DERECHOHABIENTE$/, /^TIPO\s+DE\s+DERECHOHABIENTE$/],
  admissionDate: [/^FECHA\s+DE\s+INGRESO$/, /^FECHA\s+INGRESO$/, /^F\.?\s*INGRESO$/, /^INGRESO$/, /^FECHA\s+DE\s+ADMISION$/, /^ADMISION$/],
  deih: [/^DEIH$/, /^EIH$/, /^D\.?E\.?I\.?H\.?$/, /^DIAS\s+ESTANCIA$/, /^DIAS\s+DE\s+ESTANCIA$/, /^ESTANCIA$/],
  status: [/^ESTADO$/, /^ESTADO\s+DE\s+SALUD$/, /^ESTADO\s+CLINICO$/],
  diagnosisIn: [/^DIAGNOSTICO\s+DE\s+INGRESO$/, /^DX\s+INGRESO$/, /^DX\s+DE\s+INGRESO$/, /^DIAGNOSTICO\s+INGRESO$/],
  diagnosisNow: [/^DIAGNOSTICO\s+ACTUAL$/, /^DX\s+ACTUAL$/, /^DIAGNOSTICO$/, /^DX$/, /^DX\s+HOSPITALARIO$/, /^DX\s+HOSPITALARIOS$/, /^DIAGNOSTICOS\s+HOSPITALARIOS$/, /^PADECIMIENTO$/],
  observations: [/^PENDIENTES$/, /^OBSERVACIONES$/, /^OBS$/, /^OBSERVACIONES\s+Y\s+PENDIENTES$/, /^PENDIENTES\s+Y\s+OBSERVACIONES$/, /^INDICACIONES$/]
};

const DEVICE_RX = /\b(SONDA|FOLEY|PICC|CATETER|CATETERES|DRENOVAC|PENROSE|SNG|CVC|VVC|DRENAJE|INSTALACION)\b/i;
const LOCATION_RX = /^(TUXTLA|TUXTLA\s+GUTIERREZ|TUXLTA\s+GUTIERREZ|SAN\s+CRISTOBAL|JIQUIPILAS|VILLA\s+CORZO|BERRIOZABAL|COMITAN|JITOTOL|CHIAPA\s+DE\s+CORZO|CHIAPAS|TONALA|VILLAFLORES|VILLACORZO|CINTALAPA)$/;
const FILE_REFERENCE_RX = new RegExp("\\.(DOCX?|XL" + "SX?|PDF|CSV|TXT)\\b", "i");

export function repairHospitalCensusInput(input = "", options = {}) {
  const original = String(input || "").replace(/\r/g, "");
  const repairedInput = repairUrgenciasAisPImportText(original);
  const lines = repairedInput.split("\n").filter(line => line.trim());
  if (!lines.length) return { attempted: false, rows: [], issues: ["No hay datos para reparar."], version: CENSUS_REPAIR_VERSION };
  const delimiter = detectDelimiter(lines);
  const matrix = mergeContinuationRows(lines.map(line => splitLine(line, delimiter)));
  if (!looksLikeHospitalCensus(matrix, `${options.sourceName || ""} ${repairedInput}`)) {
    return { attempted: false, rows: [], issues: [], version: CENSUS_REPAIR_VERSION };
  }

  const headerInfo = findHeaderInfo(matrix);
  let currentService = inferDefaultService(matrix, options.sourceName || "");
  let currentDate = normalizeDate(options.date || "") || "";
  const startIndex = headerInfo ? headerInfo.rowIndex + 1 : 0;
  const rows = [];

  matrix.forEach((values, index) => {
    const service = rowService(values);
    const date = rowDate(values);
    if (service) currentService = service;
    if (date && !normalizeDate(options.date || "")) currentDate = date;
    if (index < startIndex || isGuideRow(values)) return;
    const row = headerInfo
      ? rowFromHeader(values, headerInfo.map, currentService, currentDate, options.sourceName || "")
      : rowFromSignals(values, currentService, currentDate, options.sourceName || "");
    if (row) rows.push({ ...row, sourceRow: index + 1, repairVersion: CENSUS_REPAIR_VERSION });
  });

  return {
    attempted: true,
    rows,
    delimiter,
    version: CENSUS_REPAIR_VERSION,
    issues: [
      repairedInput !== original ? "Se aplico reparacion legacy de Urgencias/AIS P." : "",
      rows.length ? `Se aplico reparacion legacy de censo hospitalario (${rows.length} paciente(s)).` : "No se reconocieron pacientes importables en el censo hospitalario."
    ].filter(Boolean)
  };
}

export function repairUrgenciasAisPImportText(input = "") {
  const rawLines = String(input || "").replace(/\r/g, "").split("\n").filter(line => line.trim());
  if (!rawLines.length) return String(input || "");
  const delimiter = detectDelimiter(rawLines);
  const stitched = [];
  rawLines.forEach(rawLine => {
    const cells = normalizeAisPCells(splitLine(rawLine, delimiter));
    const previous = stitched[stitched.length - 1] || "";
    if (previous && isUnfinishedUrgenciasLine(previous, delimiter) && isUrgenciasContinuationCells(cells)) {
      const previousCells = splitLine(previous, delimiter);
      const merged = normalizeUrgenciasLegacyColumnOrder([...previousCells, ...cells.filter(cell => cleanText(cell))]);
      stitched[stitched.length - 1] = joinLine(merged, delimiter);
      return;
    }
    const firstCell = cells.find(cell => cleanText(cell)) || "";
    if (isAisP(firstCell) && normalizeText(stitched[stitched.length - 1] || "") !== "URGENCIAS") {
      stitched.push("URGENCIAS");
    }
    stitched.push(joinLine(normalizeUrgenciasLegacyColumnOrder(cells), delimiter));
  });
  return stitched.join("\n");
}

export function repairedHospitalCensusTsv(input = "", options = {}) {
  const repair = repairHospitalCensusInput(input, options);
  if (!repair.attempted || !repair.rows.length) return { ...repair, text: "" };
  return {
    ...repair,
    text: toTsv(repair.rows)
  };
}

function splitLine(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
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

function joinLine(cells = [], delimiter = "\t") {
  return cells.join(delimiter);
}

function detectDelimiter(lines = []) {
  if (lines.some(line => line.includes("\t"))) return "\t";
  return [",", ";", "|"]
    .map(delimiter => [delimiter, Math.max(...lines.map(line => line.split(delimiter).length))])
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "\t";
}

function mergeContinuationRows(matrix = []) {
  const rows = [];
  matrix.forEach(values => {
    const previous = rows[rows.length - 1];
    const previousPatient = previous ? findPatientIndex(previous) : -1;
    const currentHasStructuredData = values.slice(1).some(value => normalizeDate(value) || looksLikeRfc(value) || normalizeSex(value));
    const isContinuation = previous
      && previousPatient >= 0
      && findBedIndex(previous, previousPatient) >= 0
      && !normalizeDate(previous[previousPatient + 1] || "")
      && !cleanText(values[0])
      && currentHasStructuredData;
    if (!isContinuation) {
      rows.push([...values]);
      return;
    }
    values.forEach((value, index) => {
      if (!index || !cleanText(value)) return;
      const targetIndex = index + previousPatient;
      previous[targetIndex] = previous[targetIndex] ? `${previous[targetIndex]} ${cleanText(value)}` : cleanText(value);
    });
  });
  return rows;
}

function looksLikeHospitalCensus(matrix = [], text = "") {
  const joined = normalizeText(text);
  if (/\b(NOMBRE\s+DEL\s+PACIENTE|NOMBRE|SERVICIO\s*:|GUARDIA|FECHA\s+INGRESO|PENDIENTES|E\s*C\s*D|HORA|DX\s+ACTUAL|DIAGNOSTICO\s+ACTUAL)\b/.test(joined)) return true;
  const candidates = censusCandidateCount(matrix);
  if (candidates >= 2) return true;
  return candidates >= 1 && /\b(AIS\s*P|AISLADO\s*P|URGENCIAS)\b/.test(joined);
}

function matrixLooksLikeCensus(matrix = []) {
  return censusCandidateCount(matrix) >= 2;
}

function censusCandidateCount(matrix = []) {
  let candidates = 0;
  matrix.forEach(values => {
    const patientIndex = findPatientIndex(values);
    if (patientIndex < 0) return;
    const hasBed = findBedIndex(values, patientIndex) >= 0;
    const dates = values.map(normalizeDate).filter(Boolean).length;
    const hasClinicalText = values.some((value, index) => index > patientIndex && isDiagnosisCell(value));
    if ((hasBed || dates >= 1) && hasClinicalText) candidates += 1;
  });
  return candidates;
}

function headerKey(value) {
  const key = normalizeText(value).replace(/\s+/g, " ").trim();
  if (!key) return "";
  return Object.entries(HEADER_ALIASES).find(([, tests]) => tests.some(pattern => pattern.test(key)))?.[0] || "";
}

function findHeaderInfo(matrix = []) {
  let best = null;
  matrix.forEach((row, rowIndex) => {
    const map = {};
    row.forEach((cell, index) => {
      const key = headerKey(cell);
      if (key && map[key] === undefined) map[key] = index;
    });
    if (map.patientName !== undefined && (map.birthDate !== undefined || map.admissionDate !== undefined) && (map.diagnosisNow !== undefined || map.diagnosisIn !== undefined || map.bed !== undefined)) {
      if (map.bed === undefined && row[0] === "" && map.patientName === 1) map.bed = 0;
      const score = Object.keys(map).length;
      if (!best || score > best.score) best = { rowIndex, map, score };
    }
  });
  return best;
}

function isGuideRow(cells = []) {
  const values = cells.map(cleanText).filter(Boolean);
  if (!values.length) return true;
  const patientIndex = findPatientIndex(cells);
  if (patientIndex >= 0 && findBedIndex(cells, patientIndex) >= 0) return false;
  const text = normalizeText(values.join(" "));
  if (/\b(NOMBRE\s+DEL\s+PACIENTE|FECHA\s+INGRESO|GUARDIA|ESPECIALIDAD|MEDICO|PENDIENTES|E\s*C\s*D|RESUMENES|INGRESOS|GRAVES|TOTAL|PACIENTES\s+EN\s+OTROS\s+SERVICIOS|ESPACIOS\s+SIN\s+CAMAS|ESPACIOS\s+CON\s+CAMAS|CAMAS\s+PARA|ALTAS)\b/.test(text)) return true;
  if (/https?:\/\//i.test(values.join(" ")) || FILE_REFERENCE_RX.test(values.join(" "))) return true;
  return false;
}

function rowService(cells = []) {
  const nonEmpty = cells.map(cleanText).filter(Boolean);
  const explicit = cells.find(cell => /\bSERVICIO\b/i.test(cell) && knownServiceFromText(cell));
  if (explicit) return knownServiceFromText(explicit);
  if (nonEmpty.some(looksLikeBedCell)) return "";
  return nonEmpty.length <= 4 ? knownServiceFromText(nonEmpty.join(" ")) : "";
}

function rowDate(cells = []) {
  const joined = cells.map(cleanText).filter(Boolean).join(" ");
  if (!/\b(SERVICIO|CENSO|FECHA|GUARDIA)\b/i.test(joined)) return "";
  return cells.map(normalizeDate).find(Boolean) || "";
}

function inferDefaultService(matrix = [], sourceName = "") {
  const fromName = serviceFromSourceName(sourceName);
  if (fromName) return fromName;
  const sample = normalizeText(matrix.slice(0, 18).map(row => row.filter(Boolean).join(" ")).join(" "));
  if (sample.includes("MEDICINA INTERNA")) return "MEDICINA INTERNA";
  if (sample.includes("GYO")) return "GINECOLOGIA Y OBSTETRICIA";
  if (/\b(UX\s*\d+|F\d+|URGENCIAS)\b/.test(sample)) return "URGENCIAS";
  if (/\b(CUNERO|CUNEROS|UCIN|UTIP|CAMA\s+7[0-9])\b/.test(sample)) return "PEDIATRIA";
  return knownServiceFromText(sample);
}

function serviceFromSourceName(name = "") {
  const key = normalizeText(name);
  if (key.includes("PEDIATRIA")) return "PEDIATRIA";
  if (key.includes("URGENCIAS")) return "URGENCIAS";
  return knownServiceFromText(key);
}

function knownServiceFromText(value = "") {
  const key = normalizeText(value).replace(/\s+/g, " ");
  if (!key) return "";
  const explicit = key.match(/\bSERVICIO\s*:?\s*(.+)$/);
  const target = explicit ? explicit[1] : key;
  const normalized = normalizeService(target);
  return normalized && normalized !== target ? normalized : "";
}

function findBedIndex(values = [], patientIndex = -1) {
  const limit = patientIndex >= 0 ? patientIndex : Math.min(values.length, 4);
  for (let index = 0; index < Math.min(limit, 4); index += 1) {
    if (looksLikeBedCell(values[index])) return index;
  }
  return -1;
}

function findPatientIndex(values = []) {
  const firstStructured = values.findIndex(value => normalizeDate(value) || looksLikeRfc(value) || normalizeSex(value));
  return values.findIndex((value, index) => looksLikeName(value) && (firstStructured < 0 || index <= firstStructured));
}

function getMapped(values = [], map = {}, key = "") {
  const index = map[key];
  return index === undefined ? "" : cleanText(values[index]);
}

function rowFromHeader(values = [], map = {}, currentService = "", currentDate = "", sourceName = "") {
  const patient = getMapped(values, map, "patientName");
  if (!looksLikeName(patient)) return null;
  const rawBed = getMapped(values, map, "bed") || values[0] || "";
  const location = locationForRow(rawBed, currentService, sourceName);
  const diagnoses = unique([getMapped(values, map, "diagnosisIn"), getMapped(values, map, "diagnosisNow")].filter(isDiagnosisCell));
  return normalizeRepairRow({
    service: location.service,
    bed: location.bed,
    patientName: cleanPatientName(patient),
    birthDate: normalizeDate(getMapped(values, map, "birthDate")),
    age: normalizeAge(getMapped(values, map, "age")),
    sector: normalizeSector(getMapped(values, map, "sector")) || "PENDIENTE",
    hospitalInternalId: cleanText(getMapped(values, map, "hospitalInternalId")),
    rfc: cleanText(getMapped(values, map, "hospitalInternalId")),
    sex: normalizeSex(getMapped(values, map, "sex")) || "PENDIENTE",
    admissionDate: normalizeDate(getMapped(values, map, "admissionDate")) || normalizeDate(currentDate),
    deih: cleanText(getMapped(values, map, "deih")).match(/\d+/)?.[0] || "",
    status: normalizeStatus(getMapped(values, map, "status")),
    hospitalDiagnosis: diagnoses.join(" / ") || "PENDIENTE",
    observations: cleanText(getMapped(values, map, "observations")) || "SP"
  });
}

function rowFromSignals(values = [], currentService = "", currentDate = "", sourceName = "") {
  const patientIndex = findPatientIndex(values);
  if (patientIndex < 0) return null;
  const bedIndex = findBedIndex(values, patientIndex);
  const rawBed = bedIndex >= 0 ? values[bedIndex] : "";
  const entries = values.map((value, index) => ({ value, index })).filter(item => cleanText(item.value));
  const dates = entries.map(item => ({ ...item, iso: normalizeDate(item.value) })).filter(item => item.iso);
  const censusDate = normalizeDate(currentDate) || todayIso();
  const birth = dates.find(item => Number(item.iso.slice(0, 4)) <= Number(censusDate.slice(0, 4)) - 1);
  const admission = dates.find(item => item.index !== birth?.index && item.index > patientIndex && item.iso <= censusDate)
    || dates.find(item => item.index !== birth?.index);
  const rfc = entries.find(item => looksLikeRfc(item.value));
  const sex = entries.find(item => normalizeSex(item.value));
  const sector = entries.find(item => normalizeSector(item.value));
  const state = entries.find(item => looksLikeState(item.value));
  const age = entries.find(item => item.index > (birth?.index ?? patientIndex) && item.index < (rfc?.index ?? values.length) && normalizeAge(item.value));
  const observations = entries.filter(item => item.index > patientIndex && isObservationCell(item.value)).map(item => item.value);
  const usedIndexes = new Set([
    bedIndex,
    patientIndex,
    birth?.index,
    admission?.index,
    rfc?.index,
    sex?.index,
    sector?.index,
    state?.index,
    age?.index,
    ...observations.map(obs => values.findIndex(value => value === obs)).filter(index => index >= 0)
  ].filter(index => Number.isFinite(index) && index >= 0));
  const diagnosis = entries
    .filter(item => item.index > patientIndex && !usedIndexes.has(item.index))
    .filter(item => isDiagnosisCell(item.value))
    .map(item => item.value);
  const location = locationForRow(rawBed, currentService, sourceName);
  return normalizeRepairRow({
    service: location.service,
    bed: location.bed,
    patientName: cleanPatientName(values[patientIndex]),
    birthDate: birth?.iso || "",
    age: normalizeAge(age?.value) || "",
    sector: normalizeSector(sector?.value) || "PENDIENTE",
    hospitalInternalId: cleanText(rfc?.value || ""),
    rfc: cleanText(rfc?.value || ""),
    sex: normalizeSex(sex?.value) || "PENDIENTE",
    admissionDate: admission?.iso || "",
    deih: "",
    status: normalizeStatus(state?.value),
    hospitalDiagnosis: unique(diagnosis).join(" / ") || "PENDIENTE",
    observations: unique(observations).join(" / ") || "SP"
  });
}

function locationForRow(rawBed = "", currentService = "", sourceName = "") {
  const sourceService = currentService || serviceFromSourceName(sourceName);
  const bedService = serviceFromBed(rawBed);
  let service = sourceService || bedService || "PENDIENTE";
  let bed = normalizeBed(rawBed) || "PENDIENTE";
  if (["CUNEROS", "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS"].includes(bedService)) service = bedService;
  if (/^(AIS|OBS)\s+\d+$/.test(bed)) {
    const suffix = suffixForService(service);
    if (suffix) bed = `${bed} ${suffix}`;
  }
  return { service, bed };
}

function suffixForService(service = "") {
  const normalized = normalizeService(service);
  if (normalized === "MEDICINA INTERNA") return "MI";
  if (normalized === "CIRUGIA Y TRAUMATOLOGIA") return "CX";
  if (normalized === "PEDIATRIA") return "PED";
  if (normalized === "GINECOLOGIA Y OBSTETRICIA") return "GYO";
  if (normalized === "HEMODIALISIS") return "HEM";
  if (normalized === "ONCOLOGIA") return "ONCO";
  if (normalized === "URGENCIAS") return "URG";
  return "";
}

function normalizeRepairRow(row = {}) {
  return {
    service: row.service || "PENDIENTE",
    bed: row.bed || "PENDIENTE",
    patientName: cleanPatientName(row.patientName).toUpperCase(),
    birthDate: row.birthDate || "",
    age: row.age || "",
    sector: row.sector || "PENDIENTE",
    hospitalInternalId: row.hospitalInternalId || "",
    rfc: row.rfc || "",
    sex: row.sex || "PENDIENTE",
    admissionDate: row.admissionDate || "",
    deih: row.deih || "",
    status: row.status || "",
    hospitalDiagnosis: row.hospitalDiagnosis || "PENDIENTE",
    observations: row.observations || "SP",
    active: true
  };
}

function cleanPatientName(value = "") {
  const text = cleanText(value, 240);
  if (!text) return "";
  const marker = text.search(DEVICE_RX);
  return cleanText(marker > 0 ? text.slice(0, marker) : text).replace(/\s+[.,:;-]+$/g, "").trim();
}

function looksLikeLocation(value = "") {
  return LOCATION_RX.test(normalizeText(value).replace(/\s+/g, " "));
}

function looksLikeName(value = "") {
  const text = cleanPatientName(value);
  const key = normalizeText(text);
  if (!text || text.length < 5) return false;
  if (looksLikeLocation(text) || knownServiceFromText(text) || looksLikeBedCell(text) || looksLikeRfc(text) || normalizeDate(text)) return false;
  if (/\b(NOMBRE|PACIENTE|SERVICIO|FECHA|SECTOR|GUARDIA|MEDICO|PENDIENTES|ESPECIALIDAD|RESUMENES|INGRESOS|GRAVES|TOTAL)\b/.test(key)) return false;
  if (/[\/:;]/.test(text) && text.length > 36) return false;
  return /[A-Z]{2,}\s+[A-Z]{2,}/i.test(key);
}

function looksLikeBedCell(value = "") {
  const text = normalizeText(value);
  if (!text || normalizeDate(value) || text.length > 36 || /[\/()]/.test(text)) return false;
  const bed = normalizeBed(value);
  if (!bed) return false;
  if (/^\d{1,3}(?:\s|-)?[A-Z]{0,4}(?:\s+[A-Z]{1,4})?$/.test(bed)) return true;
  if (/^(A|B|C|F|P)\s*-?\s*\d+\b/.test(bed)) return true;
  return /^(CAMA|CAM|SILLON|AIS|OBS|AMB|UCIA|UCIN|UCIP|UTIP|CUN|ESC|CUBICULO|CAMILLA|UX|URX|HEM|ALOJ|CHOQUE)[\s:-]*[A-Z0-9-]+/.test(bed);
}

function isAisP(value = "") {
  return /^AIS(?:LADO)?\s*P$/.test(normalizeText(value));
}

function normalizeAisPCells(cells = []) {
  return cells.map(cell => isAisP(cell) ? "AIS P" : cell);
}

function normalizeUrgenciasLegacyColumnOrder(cells = []) {
  const next = [...cells];
  for (let index = 0; index < next.length - 2; index += 1) {
    if (normalizeDate(next[index]) && looksLikeRfc(next[index + 1]) && normalizeAge(next[index + 2])) {
      const rfc = next[index + 1];
      next[index + 1] = next[index + 2];
      next[index + 2] = rfc;
      break;
    }
  }
  return next;
}

function isUnfinishedUrgenciasLine(line = "", delimiter = "\t") {
  const cells = splitLine(line, delimiter).filter(cell => cleanText(cell));
  if (!cells.length || cells.length > 6) return false;
  return cells.some(looksLikeBedCell)
    && cells.some(looksLikeName)
    && !cells.some(normalizeDate)
    && !cells.some(looksLikeRfc);
}

function isUrgenciasContinuationCells(cells = []) {
  const filled = cells.filter(cell => cleanText(cell));
  if (filled.length < 3) return false;
  const first = filled[0] || "";
  if (knownServiceFromText(first) || looksLikeBedCell(first)) return false;
  return filled.some(normalizeDate) || filled.some(looksLikeRfc) || filled.some(normalizeSex);
}

function looksLikeRfc(value = "") {
  return /^[A-Z&]{3,5}\d{6}-?[A-Z0-9]{1,4}$/.test(normalizeText(value).replace(/\s+/g, "").replace(/\s*-\s*/g, "-"));
}

function normalizeAge(value = "") {
  const text = cleanText(value, 60);
  if (normalizeDate(text) || /[\/\-.]\d{1,2}[\/\-.]/.test(text)) return "";
  const key = normalizeText(text);
  const number = Number(text.match(/\d+/)?.[0]);
  if (!Number.isFinite(number)) return "";
  if (/\b(DIA|DIAS)\b/.test(key)) return `${number} ${number === 1 ? "dia" : "dias"}`;
  if (/\b(MES|MESES)\b/.test(key)) return `${number} ${number === 1 ? "mes" : "meses"}`;
  if (number > 120) return "";
  return String(number);
}

function looksLikeState(value = "") {
  return [
    "ESTABLE",
    "DELICADO",
    "GRAVE",
    "GRAVE INTUBADO",
    "MUY GRAVE",
    "MUY GRAVE INTUBADO",
    "CRITICO",
    "CRITICO INTUBADO"
  ].includes(normalizeStatus(value));
}

function isAdministrativeCell(value = "") {
  const key = normalizeText(value);
  if (!key) return true;
  if (/^\d{1,3}$/.test(key) || /^\d{1,2}:\d{2}(?:\s*H(?:RS?|RAS)?)?$/.test(key)) return true;
  if (/^(AMERITA|NO AMERITA|VPO|VPA|A ROL|DR|DRA|DR\.|DRA\.|TYO|CX|MI|PED|ORL|URO|NEURO|CARDIO|ONCO|GINECO|OTORRINO|TRAUMA|MEDICO|GUARDIA|ESPECIALIDAD|GASTRO|NEFRO)$/.test(key)) return true;
  if (looksLikeLocation(value)) return true;
  if (/\bDR\.?\s|DRA\.?\s|GUARDIA|MEDICO|ESPECIALIDAD\b/.test(key)) return true;
  return false;
}

function isObservationCell(value = "") {
  const key = normalizeText(value);
  if (!key) return false;
  if (/^(SP|S\/P|S P|NA|N\/A|PENDIENTE)$/.test(key)) return true;
  return /\b(CITA|PROGRAMAR|VALORACION|LABORATORIO|PENDIENTE|VIGILAR|PROCEDIMIENTO|CONSULTA|PREALTA|ALTA|EGRESO|DEFUNCION|AYUNO|CIRUGIA\s+MANANA|RR\s+|UROCULTIVO|HEMOCULTIVO|TAMIZ|USG|RX|TAC|IC\s+|LABS)\b/.test(key);
}

function isDiagnosisCell(value = "") {
  const key = normalizeText(value);
  if (key.length < 3) return false;
  if (isAdministrativeCell(value) || knownServiceFromText(value) || looksLikeBedCell(value) || looksLikeRfc(value) || looksLikeSector(value) || normalizeSex(value) || looksLikeState(value) || normalizeDate(value)) return false;
  if (isObservationCell(value)) return false;
  return /[A-Z]{3,}/.test(key);
}

function looksLikeSector(value = "") {
  const key = normalizeText(value);
  return Boolean(key && (
    ["MAG", "MAGISTERIO", "BUR", "BUROCRACIA", "PIM", "PIB", "PGB", "PRIV", "PRIVADO", "PARTICULAR", "NA", "N/A"].includes(key)
    || key.includes("ISSTECH")
    || key.includes("DERECHOHAB")
    || key.includes("PENSIONADO")
  ));
}

function unique(items = []) {
  return [...new Set(items.map(item => cleanText(item)).filter(Boolean))];
}

function toTsv(rows = []) {
  const escapeCell = value => {
    const text = cleanText(value, 1000);
    return /[\t\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    OUTPUT_HEADERS.join("\t"),
    ...rows.map(row => [
      row.service,
      row.bed,
      row.patientName,
      row.birthDate,
      row.age,
      row.sector,
      row.rfc || row.hospitalInternalId,
      row.sex,
      row.admissionDate,
      row.deih,
      row.status,
      row.hospitalDiagnosis,
      row.observations
    ].map(escapeCell).join("\t"))
  ].join("\n");
}

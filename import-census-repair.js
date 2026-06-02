(() => {
  "use strict";

  // Legacy repair interception is disabled; the core importer now owns CSV, TSV, XLS and XLSX.
  window.__EPIVIDA_IMPORT_CENSUS_REPAIR_DISABLED__ = true;
  return;

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

  const SERVICE_ALIASES = [
    ["MEDICINA INTERNA", /\b(MI|MEDICINA\s+INTERNA|MED\s+INT)\b/],
    ["CIRUGIA Y TRAUMATOLOGIA", /\b(CX\s*TX|CX\s+TRAUMA|CIRUGIA\s+Y\s+TRAUMATOLOGIA|CIRUGIA|TRAUMATOLOGIA)\b/],
    ["PEDIATRIA", /\b(PED|PEDS|PEDIATRIA)\b/],
    ["CUNEROS", /\b(CUNERO|CUNEROS|ESCOLAR|ESCOLARES)\b/],
    ["UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", /\b(UCIN|NEONATAL|NEONATALES)\b/],
    ["HEMODIALISIS", /\b(HEMO|HD|HEMODIALISIS)\b/],
    ["ONCOLOGIA", /\b(ONCO|ONCOLOGIA)\b/],
    ["GINECOLOGIA Y OBSTETRICIA", /\b(GYO|GO|GINECO|GINECOLOGIA|OBSTETRICIA)\b/],
    ["UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS", /\b(UCIP|UTIP|UCI\s+PED)\b/],
    ["UNIDAD DE CUIDADOS INTENSIVOS ADULTOS", /\b(UCIA|UCI\s+ADULTO|UCI\s+ADULTOS|TERAPIA\s+INTENSIVA)\b/],
    ["URGENCIAS", /\b(URG|URGENCIAS|OBSERVACION|OBSERVACIONES)\b/],
    ["AMBULATORIO", /\b(AMB|AMBULATORIO|CONSULTA\s+EXTERNA)\b/]
  ];

  const STATE_OPTIONS = [
    "ESTABLE",
    "DELICADO",
    "GRAVE",
    "GRAVE INTUBADO",
    "MUY GRAVE",
    "MUY GRAVE INTUBADO",
    "CRITICO",
    "CRITICO INTUBADO"
  ];

  const HEADER_ALIASES = {
    cama: [/^CAMA$/, /^CAM$/, /^CAMA\s*\/\s*SILLON$/, /^SILLON$/, /^UBICACION$/, /^UBICACION\s*CAMA$/, /^SERVICIO\s*\/\s*CAMA$/],
    patientName: [/^NOMBRE$/, /^NOMBRE\s+DEL\s+PACIENTE$/, /^NOMBRE\s+COMPLETO$/, /^PACIENTE$/, /^APELLIDOS?\s+Y\s+NOMBRES?$/],
    birthDate: [/^FECHA\s+DE\s+NACIMIENTO$/, /^NACIMIENTO$/, /^FECHA\s+NACIMIENTO$/, /^F\.?\s*NAC\.?$/, /^FNAC$/, /^FECHA\s+NAC\.?$/],
    rfc: [/^RFC$/, /^AFILIACION$/, /^AFILIACION\s*$/, /^EXPEDIENTE$/, /^NSS$/, /^NUMERO\s+DE\s+AFILIACION$/],
    age: [/^EDAD$/],
    sex: [/^SEXO$/, /^GENERO$/, /^SEX$/],
    sector: [/^SECTOR$/, /^DERECHOHABIENCIA$/, /^DERECHO\s*HABIENCIA$/, /^TIPO\s+DERECHOHABIENTE$/, /^TIPO\s+DE\s+DERECHOHABIENTE$/],
    admissionDate: [/^FECHA\s+DE\s+INGRESO$/, /^FECHA\s+INGRESO$/, /^F\.?\s*INGRESO$/, /^INGRESO$/, /^FECHA\s+DE\s+ADMISION$/, /^ADMISION$/],
    deih: [/^DEIH$/, /^EIH$/, /^D\.?E\.?I\.?H\.?$/, /^DIAS\s+ESTANCIA$/, /^DIAS\s+DE\s+ESTANCIA$/, /^ESTANCIA$/],
    state: [/^ESTADO$/, /^ESTADO\s+DE\s+SALUD$/, /^ESTADO\s+CLINICO$/],
    diagnosisIn: [/^DIAGNOSTICO\s+DE\s+INGRESO$/, /^DX\s+INGRESO$/, /^DX\s+DE\s+INGRESO$/, /^DIAGNOSTICO\s+INGRESO$/],
    diagnosisNow: [/^DIAGNOSTICO\s+ACTUAL$/, /^DX\s+ACTUAL$/, /^DIAGNOSTICO$/, /^DX$/, /^DX\s+HOSPITALARIO$/, /^DX\s+HOSPITALARIOS$/, /^DIAGNOSTICOS\s+HOSPITALARIOS$/, /^PADECIMIENTO$/],
    observations: [/^PENDIENTES$/, /^OBSERVACIONES$/, /^OBS$/, /^OBSERVACIONES\s+Y\s+PENDIENTES$/, /^PENDIENTES\s+Y\s+OBSERVACIONES$/, /^INDICACIONES$/]
  };

  const cleanCell = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const normalizeText = value => cleanCell(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const unique = items => [...new Set(items.map(cleanCell).filter(Boolean))];

  function splitLine(line, delimiter) {
    const out = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        out.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(current);
    return out.map(cleanCell);
  }

  function detectDelimiter(lines) {
    if (lines.some(line => line.includes("\t"))) return "\t";
    return [",", ";", "|"]
      .map(delimiter => [delimiter, Math.max(...lines.map(line => line.split(delimiter).length))])
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  function normalizeDate(value) {
    const text = cleanCell(value);
    if (!text || ["AMB", "NA", "N/A"].includes(normalizeText(text))) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validIsoDate(text) ? text : "";
    const full = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (full) {
      const year = full[3].length === 2 ? expandTwoDigitYear(full[3]) : full[3];
      const iso = `${year}-${full[2].padStart(2, "0")}-${full[1].padStart(2, "0")}`;
      return validIsoDate(iso) ? iso : "";
    }
    const embedded = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (embedded) return normalizeDate(embedded[0]);
    if (/^\d+(?:\.\d+)?$/.test(text)) return excelSerialDateToIso(text);
    return "";
  }

  function excelSerialDateToIso(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 20000 || n > 80000) return "";
    const d = new Date(Math.round((n - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function expandTwoDigitYear(value) {
    const n = Number(value);
    const current = new Date().getFullYear() % 100;
    return `${n <= current + 1 ? 2000 + n : 1900 + n}`;
  }

  function validIsoDate(iso) {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isFinite(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === iso;
  }

  function knownServiceFromText(value) {
    const key = normalizeText(value).replace(/\s+/g, " ");
    if (!key) return "";
    const explicit = key.match(/\bSERVICIO\s*:?\s*(.+)$/);
    const target = explicit ? explicit[1] : key;
    const exact = SERVICE_ALIASES.find(([service]) => service === target);
    if (exact) return exact[0];
    const alias = SERVICE_ALIASES.find(([, pattern]) => pattern.test(target));
    return alias ? alias[0] : "";
  }

  function localIsoToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function looksLikeStandaloneService(value) {
    const key = normalizeText(value).replace(/\s+/g, " ");
    if (!key || key.length > 52 || /[\/,;]/.test(key)) return false;
    return Boolean(knownServiceFromText(key));
  }

  function serviceFromSourceName(name) {
    const key = normalizeText(name);
    if (key.includes("PEDIATRIA")) return "PEDIATRIA";
    if (key.includes("URGENCIAS")) return "URGENCIAS";
    return knownServiceFromText(key);
  }

  function serviceFromBed(value) {
    const key = normalizeText(value);
    if (/\b(CUNERO|CUNEROS|ESCOLAR|ESCOLARES)\b/.test(key)) return "CUNEROS";
    if (/\bUCIN\b/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
    if (/\b(UCIP|UTIP)\b/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
    if (/^(F|UX|URX|P)\s*-?\s*\d+\b/.test(key)) return "URGENCIAS";
    if (/\b(CX|TX|CIR|TRAUMA)\b/.test(key)) return "CIRUGIA Y TRAUMATOLOGIA";
    if (/\b(MI|MED\s*INT)\b/.test(key)) return "MEDICINA INTERNA";
    if (/\b(PED|PEDS)\b/.test(key)) return "PEDIATRIA";
    if (/\b(GYO|GO|ALOJA)\b/.test(key)) return "GINECOLOGIA Y OBSTETRICIA";
    if (/\b(UCIA|HEMO|HD|ONCO|URG|AMB)\b/.test(key)) return knownServiceFromText(key);
    return "";
  }

  function serviceForRow(bed, currentService, sourceName) {
    const sourceService = currentService || serviceFromSourceName(sourceName);
    const bedService = serviceFromBed(bed);
    if (["CUNEROS", "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS"].includes(bedService)) return bedService;
    if (sourceService) return sourceService;
    return bedService || "PENDIENTE";
  }

  function looksLikeBedCell(value) {
    const text = normalizeText(value);
    if (!text || normalizeDate(value) || text.length > 28 || /[\/()]/.test(text)) return false;
    if (/^\d{1,3}(?:\.0)?(?:\s|-)?(?:CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB)?$/.test(text)) return true;
    if (/^(F|UX|URX|P)\s*-?\s*\d+\b/.test(text)) return true;
    return /^(CAMA|CAM|SILLON|AIS|AISLADO|AISLADA|OBS|OBSERVACION|ALOJA|ESC|UTIP|UCIA|UCIN|UCIP|CUNERO|CUNEROS|ESCOLAR|CUBICULO|CAMILLA)[\s:-]*[A-Z0-9-]+/.test(text);
  }

  function normalizeBed(value) {
    const text = cleanCell(value)
      .replace(/^CAMA\s*[:#-]?\s*/i, "")
      .replace(/\s+/g, " ")
      .toUpperCase();
    if (!text || normalizeDate(text) || /[\/()]/.test(text) || text.length > 28) return "";
    return text
      .replace(/^(\d+)\.0$/, "$1")
      .replace(/\s+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "")
      .replace(/(\d+)[\s-]+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "$1")
      .trim();
  }

  function looksLikeName(value) {
    const text = cleanCell(value);
    const key = normalizeText(text);
    if (!text || text.length < 5) return false;
    if (knownServiceFromText(text) || looksLikeBedCell(text) || looksLikeRfc(text) || normalizeDate(text)) return false;
    if (/\b(NOMBRE|PACIENTE|SERVICIO|FECHA|SECTOR|GUARDIA|MEDICO|PENDIENTES|ESPECIALIDAD|RESUMENES|INGRESOS|GRAVES|TOTAL)\b/.test(key)) return false;
    if (/[\/:;]/.test(text) && text.length > 36) return false;
    return /[A-Z]{2,}\s+[A-Z]{2,}/i.test(key);
  }

  function looksLikeRfc(value) {
    return /^[A-Z&]{3,5}\d{6}-?[A-Z0-9]{1,4}$/.test(normalizeText(value).replace(/\s+/g, "").replace(/\s*-\s*/g, "-"));
  }

  function normalizeSector(value) {
    const key = normalizeText(value).replace(/\s+/g, " ");
    if (!key || ["NO APLICA", "SIN DATO", "SD", "S/D"].includes(key)) return "";
    if (["MAG", "MAGISTERIO"].includes(key)) return "MAGISTERIO";
    if (["BUR", "BUROCRACIA"].includes(key)) return "BUROCRACIA";
    if (["PIM", "PENSIONADO ISSTECH MAGISTERIO", "PENSIONADO MAGISTERIO"].includes(key)) return "PENSIONADO ISSTECH MAGISTERIO";
    if (["PIB", "PENSIONADO ISSTECH BUROCRACIA", "PENSIONADO BUROCRACIA"].includes(key)) return "PENSIONADO ISSTECH BUROCRACIA";
    if (key.includes("ISSTECH")) return key.includes("PENSIONADO") ? key : "ISSTECH";
    if (["PRIV", "PRIVADO", "PARTICULAR", "NA", "N/A"].includes(key)) return "PRIVADO";
    return "";
  }

  function normalizeSex(value) {
    const key = normalizeText(value);
    if (["M", "MASCULINO", "HOMBRE"].includes(key)) return "MASCULINO";
    if (["F", "FEMENINO", "MUJER"].includes(key)) return "FEMENINO";
    return "";
  }

  function normalizeAge(value) {
    const text = cleanCell(value);
    if (normalizeDate(text) || /[\/\-.]\d{1,2}[\/\-.]/.test(text)) return "";
    const key = normalizeText(text);
    const n = Number(text.match(/\d+/)?.[0]);
    if (!Number.isFinite(n)) return "";
    if (/\b(DIA|DIAS)\b/.test(key)) return `${n} ${n === 1 ? "dia" : "dias"}`;
    if (/\b(MES|MESES)\b/.test(key)) return `${n} ${n === 1 ? "mes" : "meses"}`;
    if (n > 120) return "";
    return String(n);
  }

  function normalizeState(value) {
    const key = normalizeText(value);
    if (key === "CRITICO") return "CRITICO";
    return STATE_OPTIONS.find(option => normalizeText(option) === key) || "";
  }

  function looksLikeState(value) {
    return Boolean(normalizeState(value));
  }

  function isAdministrativeCell(value) {
    const key = normalizeText(value);
    if (!key) return true;
    if (/^\d{1,3}$/.test(key) || /^\d{1,2}:\d{2}(?:\s*HRS?)?$/.test(key)) return true;
    if (/^(AMERITA|NO AMERITA|DR|DRA|DR\.|DRA\.|TYO|CX|MI|PED|ORL|URO|NEURO|CARDIO|ONCO|GINECO|OTORRINO|TRAUMA|MEDICO|GUARDIA|ESPECIALIDAD|GASTRO|NEFRO)$/.test(key)) return true;
    if (/^(TUXTLA|TUXTLA GUTIERREZ|SAN CRISTOBAL|JIQUIPILAS|VILLA CORZO|BERRIOZABAL|COMITAN|JITOTOL|CHIAPA DE CORZO|CHIAPAS|TONALA|VILLAFLORES|VILLACORZO)$/.test(key)) return true;
    if (/\bDR\.?\s|DRA\.?\s|GUARDIA|MEDICO|ESPECIALIDAD\b/.test(key)) return true;
    return false;
  }

  function isObservationCell(value) {
    const key = normalizeText(value);
    if (!key) return false;
    if (/^(SP|S\/P|S P|NA|N\/A|PENDIENTE)$/.test(key)) return true;
    return /\b(CITA|PROGRAMAR|VALORACION|LABORATORIO|PENDIENTE|VIGILAR|PROCEDIMIENTO|CONSULTA|PREALTA|ALTA|EGRESO|DEFUNCION|AYUNO|CIRUGIA\s+MANANA|RR\s+|UROCULTIVO|HEMOCULTIVO|TAMIZ|USG|RX|TAC|IC\s+|LABS)\b/.test(key);
  }

  function isDiagnosisCell(value) {
    const key = normalizeText(value);
    if (key.length < 3) return false;
    if (isAdministrativeCell(value) || looksLikeStandaloneService(value) || looksLikeBedCell(value) || looksLikeRfc(value) || normalizeSector(value) || normalizeSex(value) || looksLikeState(value) || normalizeDate(value)) return false;
    if (isObservationCell(value)) return false;
    return /[A-Z]{3,}/.test(key);
  }

  function headerKey(value) {
    const key = normalizeText(value).replace(/\s+/g, " ").trim();
    if (!key) return "";
    return Object.entries(HEADER_ALIASES).find(([, tests]) => tests.some(pattern => pattern.test(key)))?.[0] || "";
  }

  function findHeaderInfo(matrix) {
    let best = null;
    matrix.forEach((row, rowIndex) => {
      const map = {};
      row.forEach((cell, index) => {
        const key = headerKey(cell);
        if (key && map[key] === undefined) map[key] = index;
      });
      if (map.patientName !== undefined && map.birthDate !== undefined && (map.diagnosisNow !== undefined || map.diagnosisIn !== undefined)) {
        if (map.cama === undefined && row[0] === "" && map.patientName === 1) map.cama = 0;
        const score = Object.keys(map).length;
        if (!best || score > best.score) best = { rowIndex, map, score };
      }
    });
    return best;
  }

  function isGuideRow(cells) {
    const values = cells.map(cleanCell).filter(Boolean);
    if (!values.length) return true;
    const text = normalizeText(values.join(" "));
    if (/\b(NOMBRE\s+DEL\s+PACIENTE|FECHA\s+INGRESO|GUARDIA|ESPECIALIDAD|MEDICO|PENDIENTES|E\s*C\s*D|RESUMENES|INGRESOS|GRAVES|TOTAL|PACIENTES\s+EN\s+OTROS\s+SERVICIOS|ESPACIOS\s+SIN\s+CAMAS|ESPACIOS\s+CON\s+CAMAS|CAMAS\s+PARA|ALTAS)\b/.test(text)) return true;
    if (/https?:\/\//i.test(values.join(" ")) || /\.(DOCX?|XLSX?|PDF|CSV|TXT)\b/i.test(values.join(" "))) return true;
    return false;
  }

  function rowService(cells) {
    const nonEmpty = cells.map(cleanCell).filter(Boolean);
    const explicit = cells.find(cell => /\bSERVICIO\b/i.test(cell) && knownServiceFromText(cell));
    if (explicit) return knownServiceFromText(explicit);
    if (nonEmpty.some(looksLikeBedCell)) return "";
    return nonEmpty.length <= 4 ? knownServiceFromText(nonEmpty.join(" ")) : "";
  }

  function inferDefaultService(matrix, sourceName) {
    const fromName = serviceFromSourceName(sourceName);
    if (fromName) return fromName;
    const sample = normalizeText(matrix.slice(0, 18).map(row => row.filter(Boolean).join(" ")).join(" "));
    if (sample.includes("MEDICINA INTERNA")) return "MEDICINA INTERNA";
    if (sample.includes("GYO")) return "GINECOLOGIA Y OBSTETRICIA";
    if (/\b(UX\s*\d+|F\d+|URGENCIAS)\b/.test(sample)) return "URGENCIAS";
    if (/\b(CUNERO|CUNEROS|UCIN|UTIP|CAMA\s+7[0-9])\b/.test(sample)) return "PEDIATRIA";
    return knownServiceFromText(sample);
  }

  function rowDate(cells) {
    const joined = cells.map(cleanCell).filter(Boolean).join(" ");
    if (!/\b(SERVICIO|CENSO|FECHA|GUARDIA)\b/i.test(joined)) return "";
    return cells.map(normalizeDate).find(Boolean) || "";
  }

  function findBedIndex(values, patientIndex) {
    const limit = patientIndex >= 0 ? patientIndex : Math.min(values.length, 4);
    for (let i = 0; i < Math.min(limit, 4); i += 1) {
      if (looksLikeBedCell(values[i])) return i;
    }
    return -1;
  }

  function getMapped(values, map, key) {
    const index = map[key];
    return index === undefined ? "" : cleanCell(values[index]);
  }

  function rowFromHeader(values, map, currentService, currentDate, sourceName) {
    const patient = getMapped(values, map, "patientName");
    if (!looksLikeName(patient)) return null;
    const rawBed = getMapped(values, map, "cama") || values[0] || "";
    const bed = normalizeBed(rawBed);
    const dxParts = unique([getMapped(values, map, "diagnosisIn"), getMapped(values, map, "diagnosisNow")].filter(isDiagnosisCell));
    const obs = cleanCell(getMapped(values, map, "observations"));
    return {
      Servicio: serviceForRow(rawBed, currentService, sourceName),
      Cama: bed || "PENDIENTE",
      Paciente: patient.toUpperCase(),
      "Fecha de nacimiento": normalizeDate(getMapped(values, map, "birthDate")),
      Edad: normalizeAge(getMapped(values, map, "age")),
      Sector: normalizeSector(getMapped(values, map, "sector")) || "PENDIENTE",
      RFC: cleanCell(getMapped(values, map, "rfc")),
      Sexo: normalizeSex(getMapped(values, map, "sex")) || "PENDIENTE",
      Ingreso: normalizeDate(getMapped(values, map, "admissionDate")),
      DEIH: cleanCell(getMapped(values, map, "deih")).match(/\d+/)?.[0] || "",
      Estado: normalizeState(getMapped(values, map, "state")),
      "Diagnosticos hospitalarios": dxParts.join(" / ") || "PENDIENTE",
      "Observaciones y pendientes": obs || "SP"
    };
  }

  function rowFromSignals(values, currentService, currentDate, sourceName) {
    const patientIndex = values.findIndex(looksLikeName);
    if (patientIndex < 0) return null;
    const bedIndex = findBedIndex(values, patientIndex);
    const rawBed = bedIndex >= 0 ? values[bedIndex] : "";
    const entries = values.map((value, index) => ({ value, index })).filter(item => item.value);
    const dates = entries.map(item => ({ ...item, iso: normalizeDate(item.value) })).filter(item => item.iso);
    const censusDate = currentDate || localIsoToday();
    const birth = dates.find(item => Number(item.iso.slice(0, 4)) <= Number(censusDate.slice(0, 4)) - 1);
    const admission = dates.find(item => item.index !== birth?.index && item.index > patientIndex && item.iso <= censusDate) || dates.find(item => item.index !== birth?.index);
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
    return {
      Servicio: serviceForRow(rawBed, currentService, sourceName),
      Cama: normalizeBed(rawBed) || "PENDIENTE",
      Paciente: values[patientIndex].toUpperCase(),
      "Fecha de nacimiento": birth?.iso || "",
      Edad: normalizeAge(age?.value) || "",
      Sector: normalizeSector(sector?.value) || "PENDIENTE",
      RFC: cleanCell(rfc?.value || ""),
      Sexo: normalizeSex(sex?.value) || "PENDIENTE",
      Ingreso: admission?.iso || "",
      DEIH: "",
      Estado: normalizeState(state?.value),
      "Diagnosticos hospitalarios": unique(diagnosis).join(" / ") || "PENDIENTE",
      "Observaciones y pendientes": unique(observations).join(" / ") || "SP"
    };
  }

  function parseHospitalRows(text, fallbackDate = "", sourceName = "") {
    const lines = text.replace(/\r/g, "").split("\n").filter(line => line.trim());
    if (!lines.length) return null;
    const delimiter = detectDelimiter(lines);
    const matrix = lines.map(line => splitLine(line, delimiter));
    const joined = normalizeText(`${sourceName} ${text}`);
    const hospitalLike = /\b(NOMBRE\s+DEL\s+PACIENTE|NOMBRE|SERVICIO\s*:|GUARDIA|FECHA\s+INGRESO|PENDIENTES|E\s*C\s*D|HORA|DX\s+ACTUAL|DIAGNOSTICO\s+ACTUAL)\b/.test(joined) || matrixLooksLikeCensus(matrix);
    if (!hospitalLike) return null;

    const headerInfo = findHeaderInfo(matrix);
    let currentService = inferDefaultService(matrix, sourceName);
    let currentDate = normalizeDate(fallbackDate) || "";
    const startIndex = headerInfo ? headerInfo.rowIndex + 1 : 0;
    const rows = [];

    matrix.forEach((values, index) => {
      const service = rowService(values);
      const date = rowDate(values);
      if (service) currentService = service;
      if (date && !normalizeDate(fallbackDate)) currentDate = date;
      if (index < startIndex || isGuideRow(values)) return;
      const row = headerInfo
        ? rowFromHeader(values, headerInfo.map, currentService, currentDate, sourceName)
        : rowFromSignals(values, currentService, currentDate, sourceName);
      if (row) rows.push(row);
    });

    return rows.length ? rows : [];
  }

  function matrixLooksLikeCensus(matrix) {
    let candidates = 0;
    matrix.forEach(values => {
      const patientIndex = values.findIndex(looksLikeName);
      if (patientIndex < 0) return;
      const hasBed = findBedIndex(values, patientIndex) >= 0;
      const dates = values.map(normalizeDate).filter(Boolean).length;
      const hasClinicalText = values.some((value, index) => index > patientIndex && isDiagnosisCell(value));
      if ((hasBed || dates >= 1) && hasClinicalText) candidates += 1;
    });
    return candidates >= 2;
  }

  function toTsv(rows) {
    const escapeCell = value => {
      const text = cleanCell(value);
      return /[\t\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [OUTPUT_HEADERS.join("\t"), ...rows.map(row => OUTPUT_HEADERS.map(header => escapeCell(row[header])).join("\t"))].join("\n");
  }

  function writeRepairedText(text, sourceName = "") {
    const textarea = document.querySelector("#import-text");
    if (!textarea) return false;
    const date = document.querySelector("#import-date")?.value || "";
    const rows = parseHospitalRows(text, date, sourceName);
    if (!rows) return { ok: false, attempted: false, rows: 0 };
    if (!rows.length) {
      window.__EPIVIDA_LAST_CENSUS_REPAIR__ = {
        repairedAt: new Date().toISOString(),
        rows: 0,
        sourceName,
        error: "No se reconocieron pacientes importables en el censo hospitalario."
      };
      return { ok: false, attempted: true, rows: 0 };
    }
    const repaired = toTsv(rows);
    textarea.value = repaired;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    window.__EPIVIDA_LAST_CENSUS_REPAIR__ = {
      repairedAt: new Date().toISOString(),
      rows: rows?.length || 0,
      sourceName
    };
    return { ok: true, attempted: true, rows: rows.length };
  }

  function repairImportTextarea() {
    const textarea = document.querySelector("#import-text");
    if (!textarea || !textarea.value.trim()) return { ok: false, attempted: false, rows: 0 };
    return writeRepairedText(textarea.value, "");
  }

  function findValidateButton() {
    return [...document.querySelectorAll("button")]
      .find(button => /PEGAR\s+Y\s+VALIDAR\s+CENSO/i.test(normalizeText(button.textContent || "")));
  }

  document.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (!button) return;
    if (!/PEGAR\s+Y\s+VALIDAR\s+CENSO/i.test(normalizeText(button.textContent || ""))) return;
    const result = repairImportTextarea();
    if (result?.attempted && !result.ok) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("No se importo el censo porque el formato no se pudo interpretar con seguridad. Revisa que el archivo tenga al menos cama, paciente y datos clinicos, o pega el censo completo con sus encabezados.");
    }
  }, true);

  document.addEventListener("change", event => {
    const input = event.target?.closest?.("#census-file");
    const file = input?.files?.[0];
    if (!file || !/\.(csv|txt|tsv)$/i.test(file.name)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const reader = new FileReader();
    reader.onload = () => {
      const result = writeRepairedText(String(reader.result || ""), file.name);
      if (result?.attempted && !result.ok) {
        alert("No se importo el censo porque el formato no se pudo interpretar con seguridad. Revisa que el archivo tenga al menos cama, paciente y datos clinicos, o pega el censo completo con sus encabezados.");
        return;
      }
      if (result?.ok) setTimeout(() => findValidateButton()?.click(), 0);
    };
    reader.readAsText(file);
  }, true);
})();

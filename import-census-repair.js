(() => {
  "use strict";

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
    "Dx hospitalario",
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

  const nowIsoDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    const direct = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (direct) {
      const year = direct[3].length === 2 ? expandTwoDigitYear(direct[3]) : direct[3];
      const iso = `${year}-${direct[2].padStart(2, "0")}-${direct[1].padStart(2, "0")}`;
      return validIsoDate(iso) ? iso : "";
    }
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
    return Number.isFinite(d.getTime()) && nowIsoFromDate(d) === iso;
  }

  function nowIsoFromDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

  function serviceFromBed(value) {
    const key = normalizeText(value);
    if (/\b(CX|TX|CIR|TRAUMA)\b/.test(key)) return "CIRUGIA Y TRAUMATOLOGIA";
    if (/\b(MI|MED\s*INT)\b/.test(key)) return "MEDICINA INTERNA";
    if (/\b(PED|PEDS)\b/.test(key)) return "PEDIATRIA";
    if (/\b(CUNERO|CUNEROS|ESCOLAR|ESCOLARES)\b/.test(key)) return "CUNEROS";
    if (/\b(GYO|GO)\b/.test(key)) return "GINECOLOGIA Y OBSTETRICIA";
    if (/\b(UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB)\b/.test(key)) return knownServiceFromText(key);
    return "";
  }

  function looksLikeBedCell(value) {
    const text = normalizeText(value);
    if (!text || normalizeDate(value) || text.length > 24 || /[\/()]/.test(text)) return false;
    if (/^(CAMA|CAM|SILLON|AIS|AISLADO|AISLADA|OBS|OBSERVACION|AMB|AMBULATORIO|UCIA|UCIN|UCIP|CUNERO|ESCOLAR|CUBICULO|CAMILLA)[\s:-]*[A-Z0-9-]+/.test(text)) return true;
    return /^\d{1,3}(?:\s|-)?(?:CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB)?$/.test(text);
  }

  function normalizeBed(value) {
    const text = cleanCell(value)
      .replace(/^CAMA\s*[:#-]?\s*/i, "")
      .replace(/\s+/g, " ")
      .toUpperCase();
    if (!text || normalizeDate(text) || /[\/()]/.test(text) || text.length > 24) return "";
    return text
      .replace(/\s+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "")
      .replace(/(\d+)[\s-]+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "$1")
      .trim();
  }

  function looksLikeName(value) {
    const text = cleanCell(value);
    const key = normalizeText(text);
    if (!text || text.length < 5) return false;
    if (knownServiceFromText(text) || looksLikeBedCell(text) || looksLikeRfc(text) || normalizeDate(text)) return false;
    if (/\b(NOMBRE|PACIENTE|SERVICIO|FECHA|SECTOR|GUARDIA|MEDICO|PENDIENTES|ESPECIALIDAD|RESUMENES|INGRESOS|GRAVES)\b/.test(key)) return false;
    if (/[\/:;]/.test(text) && text.length > 36) return false;
    return /[A-Z]{2,}\s+[A-Z]{2,}/i.test(normalizeText(text));
  }

  function looksLikeRfc(value) {
    return /^[A-Z&]{3,5}\d{6}-?[A-Z0-9]{1,4}$/.test(normalizeText(value).replace(/\s+/g, ""));
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

  function looksLikeState(value) {
    const key = normalizeText(value);
    return STATE_OPTIONS.includes(key);
  }

  function isAdministrativeCell(value) {
    const key = normalizeText(value);
    if (!key) return true;
    if (/^\d{1,3}$/.test(key) || /^\d{1,2}:\d{2}$/.test(key)) return true;
    if (/^(AMERITA|NO AMERITA|DR|DRA|DR\.|DRA\.|TYO|CX|MI|PED|ORL|URO|NEURO|CARDIO|ONCO|GINECO|OTORRINO|TRAUMA|MEDICO|GUARDIA|ESPECIALIDAD)$/.test(key)) return true;
    if (/^(TUXTLA|TUXTLA GUTIERREZ|SAN CRISTOBAL|JIQUIPILAS|VILLA CORZO|BERRIOZABAL|COMITAN|JITOTOL|CHIAPA DE CORZO|CHIAPAS)$/.test(key)) return true;
    if (/\bDR\.?\s|DRA\.?\s|GUARDIA|MEDICO|ESPECIALIDAD\b/.test(key)) return true;
    return false;
  }

  function isObservationCell(value) {
    const key = normalizeText(value);
    if (!key) return false;
    if (/^(SP|S\/P|S P|NA|N\/A|PENDIENTE)$/.test(key)) return true;
    return /\b(CITA|PROGRAMAR|VALORACION|LABORATORIO|PENDIENTE|VIGILAR|PROCEDIMIENTO|CONSULTA|PREALTA|ALTA|EGRESO|DEFUNCION|AYUNO|CIRUGIA\s+MANANA)\b/.test(key);
  }

  function isDiagnosisCell(value) {
    const key = normalizeText(value);
    if (key.length < 3) return false;
    if (isAdministrativeCell(value) || knownServiceFromText(value) || looksLikeBedCell(value) || looksLikeRfc(value) || normalizeSector(value) || normalizeSex(value) || looksLikeState(value) || normalizeDate(value)) return false;
    if (isObservationCell(value)) return false;
    return /[A-Z]{3,}/.test(key);
  }

  function isGuideRow(cells) {
    const values = cells.map(cleanCell).filter(Boolean);
    if (!values.length) return true;
    const text = normalizeText(values.join(" "));
    if (/\b(NOMBRE\s+DEL\s+PACIENTE|FECHA\s+INGRESO|GUARDIA|ESPECIALIDAD|MEDICO|PENDIENTES|E\s*C\s*D|RESUMENES|INGRESOS|GRAVES)\b/.test(text)) return true;
    if (/\.(DOCX?|XLSX?|PDF|CSV|TXT)\b/.test(text)) return true;
    return false;
  }

  function rowService(cells) {
    const nonEmpty = cells.map(cleanCell).filter(Boolean);
    const explicit = cells.find(cell => /\bSERVICIO\b/i.test(cell) && knownServiceFromText(cell));
    if (explicit) return knownServiceFromText(explicit);
    return nonEmpty.length <= 3 ? knownServiceFromText(nonEmpty.join(" ")) : "";
  }

  function rowDate(cells) {
    const joined = cells.map(cleanCell).filter(Boolean).join(" ");
    if (!/\b(SERVICIO|CENSO|FECHA)\b/i.test(joined)) return "";
    return cells.map(normalizeDate).find(Boolean) || "";
  }

  function findBedIndex(values, patientIndex) {
    const limit = patientIndex >= 0 ? patientIndex : Math.min(values.length, 4);
    for (let i = 0; i < Math.min(limit, 4); i += 1) {
      if (looksLikeBedCell(values[i])) return i;
    }
    return -1;
  }

  function parseHospitalRows(text, fallbackDate) {
    const lines = text.replace(/\r/g, "").split("\n").filter(line => line.trim());
    if (!lines.length) return null;
    const delimiter = detectDelimiter(lines);
    const matrix = lines.map(line => splitLine(line, delimiter));
    const joined = normalizeText(text);
    const hospitalLike = /\b(NOMBRE\s+DEL\s+PACIENTE|SERVICIO\s*:|GUARDIA|FECHA\s+INGRESO|PENDIENTES|E\s*C\s*D|HORA)\b/.test(joined);
    if (!hospitalLike) return null;

    let currentService = "";
    let currentDate = normalizeDate(fallbackDate) || "";
    const rows = [];

    matrix.forEach(cells => {
      const values = cells.map(cleanCell);
      const nonEmpty = values.filter(Boolean);
      if (!nonEmpty.length) return;
      const service = rowService(values);
      const date = rowDate(values);
      if (service) currentService = service;
      if (date && !normalizeDate(fallbackDate)) currentDate = date;
      if (isGuideRow(values)) return;

      const patientIndex = values.findIndex(looksLikeName);
      if (patientIndex < 0) return;
      const bedIndex = findBedIndex(values, patientIndex);
      const entries = values.map((value, index) => ({ value, index })).filter(item => item.value);
      const dates = entries.map(item => ({ ...item, iso: normalizeDate(item.value) })).filter(item => item.iso);
      const censusDate = currentDate || normalizeDate(fallbackDate) || nowIsoDate();
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

      rows.push({
        Servicio: currentService || serviceFromBed(values[bedIndex]) || "PENDIENTE",
        Cama: normalizeBed(values[bedIndex]) || "PENDIENTE",
        Paciente: values[patientIndex].toUpperCase(),
        "Fecha de nacimiento": birth?.iso || "",
        Edad: normalizeAge(age?.value) || "",
        Sector: normalizeSector(sector?.value) || "PENDIENTE",
        RFC: cleanCell(rfc?.value || ""),
        Sexo: normalizeSex(sex?.value) || "PENDIENTE",
        Ingreso: admission?.iso || "",
        DEIH: "",
        Estado: state?.value || "",
        "Dx hospitalario": unique(diagnosis).join(" / ") || "PENDIENTE",
        "Observaciones y pendientes": unique(observations).join(" / ") || "SP"
      });
    });

    return rows.length ? rows : null;
  }

  function toTsv(rows) {
    const escapeCell = value => {
      const text = cleanCell(value);
      return /[\t\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [OUTPUT_HEADERS.join("\t"), ...rows.map(row => OUTPUT_HEADERS.map(header => escapeCell(row[header])).join("\t"))].join("\n");
  }

  function repairImportTextarea() {
    const textarea = document.querySelector("#import-text");
    if (!textarea || !textarea.value.trim()) return;
    const date = document.querySelector("#import-date")?.value || "";
    const rows = parseHospitalRows(textarea.value, date);
    if (!rows) return;
    const repaired = toTsv(rows);
    if (!repaired || repaired === textarea.value) return;
    textarea.value = repaired;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    window.__EPIVIDA_LAST_CENSUS_REPAIR__ = {
      repairedAt: new Date().toISOString(),
      rows: rows.length
    };
  }

  document.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (!button) return;
    if (!/PEGAR\s+Y\s+VALIDAR\s+CENSO/i.test(normalizeText(button.textContent || ""))) return;
    repairImportTextarea();
  }, true);
})();

(() => {
  "use strict";

  const HEADERS = ["Servicio", "Cama", "Paciente", "Fecha de nacimiento", "Edad", "Sector", "RFC", "Sexo", "Ingreso", "DEIH", "Estado", "Diagnosticos hospitalarios", "Observaciones y pendientes"];
  const SERVICES = [
    ["MEDICINA INTERNA", /\b(MI|MEDICINA\s+INTERNA|MED\s+INT)\b/],
    ["CIRUGIA Y TRAUMATOLOGIA", /\b(CX\s*TX|CX\s+TRAUMA|CX|TX|CIRUGIA|TRAUMATOLOGIA|TRAUMA)\b/],
    ["PEDIATRIA", /\b(PED|PEDS|PEDIATRIA)\b/],
    ["CUNEROS", /\b(CUNERO|CUNEROS|ESCOLAR|ESCOLARES)\b/],
    ["UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", /\b(UCIN|NEONATAL|NEONATALES)\b/],
    ["HEMODIALISIS", /\b(HEMO|HD|HEMODIALISIS)\b/],
    ["ONCOLOGIA", /\b(ONCO|ONCOLOGIA)\b/],
    ["GINECOLOGIA Y OBSTETRICIA", /\b(GYO|GO|GINECO|GINECOLOGIA|OBSTETRICIA|ALOJA)\b/],
    ["UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS", /\b(UCIP|UTIP|UCI\s+PED)\b/],
    ["UNIDAD DE CUIDADOS INTENSIVOS ADULTOS", /\b(UCIA|UCI\s+ADULTO|UCI\s+ADULTOS|TERAPIA\s+INTENSIVA)\b/],
    ["URGENCIAS", /\b(URG|URGENCIAS|OBSERVACION|OBSERVACIONES|UX|URX)\b/],
    ["AMBULATORIO", /\b(AMB|AMBULATORIO|CONSULTA\s+EXTERNA)\b/]
  ];
  const STATES = ["ESTABLE", "DELICADO", "GRAVE", "GRAVE INTUBADO", "MUY GRAVE", "MUY GRAVE INTUBADO", "CRITICO", "CRITICO INTUBADO"];
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const uniq = items => [...new Set(items.map(clean).filter(Boolean))];

  function serviceFromText(value) {
    const key = norm(value).replace(/\s+/g, " ");
    if (!key) return "";
    const explicit = key.match(/\bSERVICIO\s*:?\s*(.+)$/);
    const target = explicit ? explicit[1] : key;
    return SERVICES.find(([service]) => service === target)?.[0] || SERVICES.find(([, rx]) => rx.test(target))?.[0] || "";
  }

  function serviceFromBed(value) {
    const key = norm(value);
    if (/\b(CUNERO|CUNEROS|ESCOLAR|ESCOLARES)\b/.test(key)) return "CUNEROS";
    if (/\bUCIN\b/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
    if (/\b(UCIP|UTIP)\b/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
    if (/^(F|UX|URX|P)\s*-?\s*\d+\b/.test(key)) return "URGENCIAS";
    if (/\b(CX|TX|CIR|TRAUMA)\b/.test(key)) return "CIRUGIA Y TRAUMATOLOGIA";
    if (/\b(MI|MED\s*INT)\b/.test(key)) return "MEDICINA INTERNA";
    if (/\b(PED|PEDS)\b/.test(key)) return "PEDIATRIA";
    if (/\b(GYO|GO|ALOJA)\b/.test(key)) return "GINECOLOGIA Y OBSTETRICIA";
    if (/\b(UCIA|HEMO|HD|ONCO|URG|AMB)\b/.test(key)) return serviceFromText(key);
    return "";
  }

  function normalizeDate(value) {
    const text = clean(value);
    if (!text || ["AMB", "NA", "N/A"].includes(norm(text))) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return /^\d+(?:\.\d+)?$/.test(text) ? serialDate(text) : "";
    const year = m[3].length === 2 ? (Number(m[3]) <= 27 ? `20${m[3]}` : `19${m[3]}`) : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  function serialDate(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 20000 || n > 80000) return "";
    const d = new Date(Math.round((n - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function looksBed(value) {
    const key = norm(value);
    if (!key || normalizeDate(value) || key.length > 30 || /[\/()]/.test(key)) return false;
    if (/^\d{1,3}(?:\.0)?(?:\s|-)?(?:CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HD|ONCO|URG|AMB)?$/.test(key)) return true;
    if (/^(F|UX|URX|P)\s*-?\s*\d+\b/.test(key)) return true;
    return /^(CAMA|CAM|SILLON|AIS|AISLADO|AISLADA|OBS|OBSERVACION|ALOJA|ESC|UTIP|UCIA|UCIN|UCIP|CUNERO|CUNEROS|ESCOLAR|CUBICULO|CAMILLA)[\s:-]*[A-Z0-9-]+/.test(key);
  }

  function bedLabel(value) {
    return clean(value).replace(/^CAMA\s*[:#-]?\s*/i, "").toUpperCase()
      .replace(/^(\d+)\.0$/, "$1")
      .replace(/\s+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "")
      .replace(/(\d+)[\s-]+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "$1")
      .trim();
  }

  function sex(value) {
    const key = norm(value);
    if (["M", "MASCULINO", "HOMBRE"].includes(key)) return "MASCULINO";
    if (["F", "FEMENINO", "MUJER"].includes(key)) return "FEMENINO";
    return "";
  }

  function sector(value) {
    const key = norm(value).replace(/\s+/g, " ");
    if (["MAG", "MAGISTERIO"].includes(key)) return "MAGISTERIO";
    if (["BUR", "BUROCRACIA"].includes(key)) return "BUROCRACIA";
    if (["PIM", "PENSIONADO ISSTECH MAGISTERIO", "PENSIONADO MAGISTERIO"].includes(key)) return "PENSIONADO ISSTECH MAGISTERIO";
    if (["PIB", "PENSIONADO ISSTECH BUROCRACIA", "PENSIONADO BUROCRACIA"].includes(key)) return "PENSIONADO ISSTECH BUROCRACIA";
    if (key.includes("ISSTECH")) return key.includes("PENSIONADO") ? key : "ISSTECH";
    if (["PRIV", "PRIVADO", "PARTICULAR"].includes(key)) return "PRIVADO";
    return "";
  }

  function age(value) {
    if (normalizeDate(value)) return "";
    const n = Number(clean(value).match(/\d+/)?.[0]);
    return Number.isFinite(n) && n <= 120 ? String(n) : "";
  }

  function state(value) {
    const key = norm(value);
    return STATES.find(item => norm(item) === key) || "";
  }

  function rfc(value) {
    const key = norm(value).replace(/\s+/g, "");
    return /^[A-Z&]{3,5}\d{6}-?[A-Z0-9]{1,4}$/.test(key) ? clean(value).toUpperCase() : "";
  }

  function admin(value) {
    const key = norm(value);
    return !key || /^\d{1,3}$/.test(key) || /^\d{1,2}:\d{2}/.test(key)
      || /^(AMERITA|NO AMERITA|DR|DRA|TYO|CX|MI|PED|ORL|URO|NEURO|CARDIO|ONCO|GINECO|OTORRINO|TRAUMA|MEDICO|GUARDIA|ESPECIALIDAD)$/.test(key)
      || /^(TUXTLA|TUXTLA GUTIERREZ|SAN CRISTOBAL|JIQUIPILAS|VILLA CORZO|BERRIOZABAL|COMITAN|JITOTOL|CHIAPA DE CORZO|CHIAPAS)$/.test(key)
      || /\bDR\.?\s|DRA\.?\s|GUARDIA|MEDICO|ESPECIALIDAD\b/.test(key);
  }

  function observation(value) {
    const key = norm(value);
    if (/^(SP|S\/P|S P|NA|N\/A|PENDIENTE)$/.test(key)) return "SP";
    return /\b(CITA|PROGRAMAR|VALORACION|LABORATORIO|PENDIENTE|VIGILAR|PROCEDIMIENTO|CONSULTA|PREALTA|ALTA|EGRESO|DEFUNCION|AYUNO|CIRUGIA\s+MANANA|UROCULTIVO|HEMOCULTIVO|USG|RX|TAC|LABS)\b/.test(key) ? clean(value).toUpperCase() : "";
  }

  function diagnosis(value) {
    const key = norm(value);
    if (key.length < 3 || admin(value) || serviceFromText(value) || looksBed(value) || rfc(value) || sex(value) || sector(value) || state(value) || normalizeDate(value) || observation(value)) return false;
    return /[A-Z]{3,}/.test(key);
  }

  function looksName(value) {
    const text = clean(value);
    const key = norm(text);
    if (text.length < 5 || serviceFromText(text) || looksBed(text) || rfc(text) || normalizeDate(text)) return false;
    if (/\b(NOMBRE|PACIENTE|SERVICIO|FECHA|SECTOR|GUARDIA|MEDICO|PENDIENTES|ESPECIALIDAD|TOTAL)\b/.test(key)) return false;
    return /[A-Z]{2,}\s+[A-Z]{2,}/.test(key);
  }

  function splitLine(line, delimiter) {
    const out = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === delimiter && !quoted) { out.push(clean(cell)); cell = ""; }
      else cell += ch;
    }
    out.push(clean(cell));
    return out;
  }

  function delimiter(lines) {
    if (lines.some(line => line.includes("\t"))) return "\t";
    return [",", ";", "|"].map(d => [d, Math.max(...lines.map(line => line.split(d).length))]).sort((a, b) => b[1] - a[1])[0][0];
  }

  function guide(values) {
    const text = norm(values.filter(Boolean).join(" "));
    return !text || /\b(NOMBRE\s+DEL\s+PACIENTE|FECHA\s+INGRESO|GUARDIA|ESPECIALIDAD|MEDICO|PENDIENTES|E\s*C\s*D|RESUMENES|TOTAL|ALTAS)\b/.test(text);
  }

  function rowService(values) {
    const nonEmpty = values.map(clean).filter(Boolean);
    const explicit = nonEmpty.find(value => /\bSERVICIO\b/i.test(value) && serviceFromText(value));
    if (explicit) return serviceFromText(explicit);
    if (nonEmpty.some(looksBed)) return "";
    const text = nonEmpty.join(" ");
    if (/\b(ESPECIALIDAD|MEDICO|GUARDIA|PENDIENTES|HORA|DX|DIAGNOSTICO)\b/.test(norm(text))) return "";
    return nonEmpty.length <= 4 ? serviceFromText(text) : "";
  }

  function parseMatrix(matrix, fallbackDate = "", sourceName = "") {
    matrix = (matrix || []).map(row => (row || []).map(clean)).filter(row => row.some(Boolean));
    if (!matrix.length) return [];
    let currentService = serviceFromText(sourceName) || serviceFromText(matrix.slice(0, 12).map(row => row.join(" ")).join(" "));
    const censusDate = normalizeDate(fallbackDate) || new Date().toISOString().slice(0, 10);
    const rows = [];

    matrix.forEach(values => {
      const serviceLine = rowService(values);
      if (serviceLine) currentService = serviceLine;
      if (guide(values)) return;
      const patientIndex = values.findIndex(looksName);
      if (patientIndex < 0) return;
      let bedIndex = -1;
      for (let i = 0; i < Math.min(patientIndex, 4); i += 1) if (looksBed(values[i])) { bedIndex = i; break; }
      const rawBed = bedIndex >= 0 ? values[bedIndex] : "";
      const service = serviceFromBed(rawBed) || currentService || "PENDIENTE";
      const entries = values.map((value, index) => ({ value, index })).filter(item => item.value);
      const dates = entries.map(item => ({ ...item, iso: normalizeDate(item.value) })).filter(item => item.iso);
      const birth = dates.find(item => Number(item.iso.slice(0, 4)) <= Number(censusDate.slice(0, 4)) - 1);
      const admission = dates.find(item => item.index !== birth?.index && item.index > patientIndex && item.iso <= censusDate) || dates.find(item => item.index !== birth?.index);
      const sexItem = entries.find(item => sex(item.value));
      const sectorItem = entries.find(item => sector(item.value));
      const rfcItem = entries.find(item => rfc(item.value));
      const ageItem = entries.find(item => item.index > (birth?.index ?? patientIndex) && item.index < (sexItem?.index ?? values.length) && age(item.value));
      const stateItem = entries.find(item => state(item.value));
      const obs = uniq(entries.filter(item => item.index > patientIndex).map(item => observation(item.value)).filter(Boolean));
      const used = new Set([bedIndex, patientIndex, birth?.index, admission?.index, sexItem?.index, sectorItem?.index, rfcItem?.index, ageItem?.index, stateItem?.index].filter(index => index >= 0));
      const dx = uniq(entries.filter(item => item.index > patientIndex && !used.has(item.index) && diagnosis(item.value)).map(item => item.value));
      rows.push({
        Servicio: service,
        Cama: bedLabel(rawBed) || "PENDIENTE",
        Paciente: clean(values[patientIndex]).toUpperCase(),
        "Fecha de nacimiento": birth?.iso || "",
        Edad: age(ageItem?.value) || "",
        Sector: sector(sectorItem?.value) || "PENDIENTE",
        RFC: rfc(rfcItem?.value) || "",
        Sexo: sex(sexItem?.value) || "PENDIENTE",
        Ingreso: admission?.iso || "",
        DEIH: "",
        Estado: state(stateItem?.value) || "",
        "Diagnosticos hospitalarios": dx.join(" / ") || "PENDIENTE",
        "Observaciones y pendientes": obs.join(" / ") || "SP"
      });
    });
    return rows;
  }

  function toTsv(rows) {
    const esc = value => /[\t\n"]/.test(clean(value)) ? `"${clean(value).replace(/"/g, '""')}"` : clean(value);
    return [HEADERS.join("\t"), ...rows.map(row => HEADERS.map(header => esc(row[header])).join("\t"))].join("\n");
  }

  function parseText(text, date, sourceName = "") {
    const lines = String(text || "").replace(/\r/g, "").split("\n").filter(line => line.trim());
    if (!lines.length) return [];
    const d = delimiter(lines);
    return parseMatrix(lines.map(line => splitLine(line, d)), date, sourceName);
  }

  async function parseWorkbook(file, date) {
    if (!window.XLSX) await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    return workbook.SheetNames.flatMap(name => parseMatrix(window.XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", raw: false }), date, name));
  }

  function validateNow(button) {
    window.setTimeout(() => typeof button.onclick === "function" ? button.onclick() : button.dispatchEvent(new Event("click")), 0);
  }

  document.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (!button || !/PEGAR\s+Y\s+VALIDAR\s+CENSO/i.test(norm(button.textContent || ""))) return;
    const textarea = document.querySelector("#import-text");
    if (!textarea || !textarea.value.trim()) return;
    const rows = parseText(textarea.value, document.querySelector("#import-date")?.value || "");
    if (!rows.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    textarea.value = toTsv(rows);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    validateNow(button);
  }, true);

  document.addEventListener("change", event => {
    const input = event.target?.closest?.("#census-file");
    const file = input?.files?.[0];
    if (!file || !/\.(csv|txt|tsv|xlsx)$/i.test(file.name)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const date = document.querySelector("#import-date")?.value || "";
    const button = [...document.querySelectorAll("button")].find(item => /PEGAR\s+Y\s+VALIDAR\s+CENSO/i.test(norm(item.textContent || "")));
    const done = rows => {
      if (!rows.length) return alert("No se reconocieron pacientes importables en el censo. Revisa que incluya cama, paciente y datos clinicos.");
      const textarea = document.querySelector("#import-text");
      textarea.value = toTsv(rows);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      if (button) validateNow(button);
    };
    if (/\.xlsx$/i.test(file.name)) parseWorkbook(file, date).then(done).catch(error => alert(`No se importo el XLSX: ${error?.message || error}`));
    else file.text().then(text => done(parseText(text, date, file.name)));
  }, true);
})();

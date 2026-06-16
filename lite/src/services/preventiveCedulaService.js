import { normalizeDate, todayIso } from "../lib/date.js";
import { normalizeService, normalizeSex, normalizeText } from "../lib/normalize.js";
import { listTodayRounds } from "./roundService.js";

export const PREVENTIVE_CEDULA_VERSION = "lite-preventive-cedulas-2026-06-16-v1";

const TURN = "MATUTINO";
const DEFAULT_ROWS = 12;

export const PREVENTIVE_MONTHLY_SERVICES = [
  { key: "mi", label: "M.I" },
  { key: "cirugia", label: "CIRUGIA" },
  { key: "pediatria", label: "PEDIATRIA" },
  { key: "utip", label: "UTIP" },
  { key: "ucin", label: "UCIN" },
  { key: "cuneros", label: "CUNEROS" },
  { key: "gyo", label: "G Y O" },
  { key: "ucia", label: "UCIA" },
  { key: "urgencias", label: "URGENCIAS" },
  { key: "hemodialisis", label: "HEMODIALISIS" }
];

export const PREVENTIVE_CEDULA_SPECS = [
  {
    key: "its",
    defaultTitle: "ITS X CC",
    packageType: "ITS - CC",
    headers: [
      "No.", "FECHA", "TURNO", "SERVICIO", "NOMBRE COMPLETO",
      "FECHA DE NACIMIENTO", "IDENTIFICACION PACIENTE",
      "1. Registro de revision diaria del cateter",
      "2. Curacion con tecnica aseptica",
      "3. Apertura correcta con desinfectante",
      "4. Cambio de sistema de infusion",
      "5. Nota de evolucion sobre permanencia/retiro",
      "% CUMPLIMIENTO"
    ],
    columns: ["consecutive", "date", "turn", "service", "patientDeviceName", "birthDate", "rfc", "dailyReview", "asepticDressing", "correctOpening", "infusionSystemChange", "evolutionNote", "rowCompliance"],
    checkStart: 7,
    checkEnd: 11,
    complianceColumn: 12
  },
  {
    key: "itu",
    defaultTitle: "ITU X CU",
    packageType: "ITU - CU",
    headers: [
      "No.", "FECHA", "TURNO", "SERVICIO", "GENERO 1)MUJER, 2)HOMBRE",
      "NOMBRE COMPLETO", "FECHA DE NACIMIENTO", "IDENTIFICACION PACIENTE",
      "1. Sonda con membrete",
      "2. Cateter fijo de acuerdo al sexo",
      "3. Higiene genital diaria registrada",
      "4. Linea de drenaje libre de obstruccion",
      "5. Bolsa debajo de vejiga sin tocar suelo",
      "6. Sistema sin desconexiones",
      "7. Nota de evolucion sobre permanencia/retiro",
      "8. Caracteristicas macroscopicas de orina",
      "9. Dias de instalacion registrados",
      "% CUMPLIMIENTO"
    ],
    columns: ["consecutive", "date", "turn", "service", "genderCode", "patientDeviceName", "birthDate", "rfc", "hasLabel", "sexMatch", "genitalHygiene", "unobstructedDrainage", "correctBagLevel", "closedSystem", "evolutionNote", "urineCharacteristics", "installationDaysRecord", "rowCompliance"],
    checkStart: 8,
    checkEnd: 16,
    complianceColumn: 17
  },
  {
    key: "navm",
    defaultTitle: "NAVM",
    packageType: "NAVM",
    headers: [
      "No.", "FECHA", "TURNO", "SERVICIO", "NOMBRE COMPLETO",
      "FECHA DE NACIMIENTO", "IDENTIFICACION PACIENTE",
      "1. Intubacion con equipo desinfectado",
      "2. Posicion de cama adecuada",
      "3. Interrupcion de sedacion evaluada",
      "4. Retiro de ventilacion mecanica evaluado",
      "5. Aspiracion con sistema cerrado",
      "6. Higiene oral segun corresponde",
      "7. Humedad activa o pasiva",
      "% CUMPLIMIENTO"
    ],
    columns: ["consecutive", "date", "turn", "service", "patientDeviceName", "birthDate", "rfc", "asepticIntubation", "patientPosition", "sedationInterruption", "possibleRemoval", "closedSuction", "oralHygiene", "humidity", "rowCompliance"],
    checkStart: 7,
    checkEnd: 13,
    complianceColumn: 14
  },
  {
    key: "isq",
    defaultTitle: "ISQ",
    packageType: "ISQ",
    headers: [
      "No.", "FECHA", "TURNO", "SERVICIO", "NOMBRE COMPLETO",
      "FECHA DE NACIMIENTO", "IDENTIFICACION PACIENTE",
      "1. Profilaxis prequirurgica adecuada",
      "2. Retiro de vello adecuado",
      "3. Monitoreo glucemico",
      "4. Temperatura mayor a 35.5 C",
      "5. Herida con aposito",
      "% CUMPLIMIENTO"
    ],
    columns: ["consecutive", "date", "turn", "service", "patientDeviceName", "birthDate", "rfc", "preSurgicalProphylaxis", "preSurgicalHairRemoval", "glucoseMonitoring", "temperature", "dressing", "rowCompliance"],
    checkStart: 7,
    checkEnd: 11,
    complianceColumn: 12
  },
  {
    key: "pe",
    defaultTitle: "P.E.",
    packageType: "P.E. Y P.B.M.T.",
    headers: [
      "No.", "FECHA", "TURNO", "SERVICIO", "CAMA",
      "1. Asignacion de medidas de precaucion",
      "2. Actualizacion de medidas",
      "3. Retiro de medidas",
      "4. Insumos",
      "5. Educacion",
      "6. Prescripcion y accion congruente",
      "7. Tarjetas de precaucion adecuadas",
      "% CUMPLIMIENTO"
    ],
    columns: ["consecutive", "date", "turn", "service", "bed", "precautionAssignment", "precautionUpdate", "precautionRemoval", "supplies", "education", "congruentPrescription", "precautionCards", "rowCompliance"],
    checkStart: 5,
    checkEnd: 11,
    complianceColumn: 12
  }
];

export function preventiveCedulaOptions() {
  return PREVENTIVE_CEDULA_SPECS.map(spec => [spec.key, spec.defaultTitle]);
}

export function preventiveCedulaSpec(key = "") {
  return PREVENTIVE_CEDULA_SPECS.find(spec => spec.key === key) || PREVENTIVE_CEDULA_SPECS[0];
}

export async function preventiveCedulaCsvRows(date = todayIso(), key = "its") {
  const day = normalizeDate(date) || todayIso();
  const spec = preventiveCedulaSpec(key);
  const rounds = await listTodayRounds(day);
  const values = paddedCedulaRows(spec, cedulaRowsFromRounds(rounds, spec, day));
  const summary = preventiveCedulaSummaryRow(spec, values);
  return {
    spec,
    date: day,
    rows: [...values, summary].map(row => recordFromValues(spec.headers, row))
  };
}

export async function preventiveMonthlyCsvRows(date = todayIso(), key = "its") {
  const spec = preventiveCedulaSpec(key);
  const month = monthDescriptor(date);
  const days = Array.from({ length: month.daysInMonth }, (_, index) => index + 1);
  const dayRows = await Promise.all(days.map(async day => {
    const iso = `${month.monthKey}-${String(day).padStart(2, "0")}`;
    const rounds = await listTodayRounds(iso);
    return { day, rows: cedulaRowsFromRounds(rounds, spec, iso) };
  }));
  const totals = emptyMonthlyServiceMap();
  const rows = dayRows.map(({ day, rows }) => {
    const serviceMap = emptyMonthlyServiceMap();
    rows.forEach(row => {
      const service = monthlyServiceKey(row[3]);
      if (!serviceMap[service]) return;
      serviceMap[service].observed += 1;
      if (row[spec.complianceColumn] === 100) serviceMap[service].complying += 1;
    });
    PREVENTIVE_MONTHLY_SERVICES.forEach(service => {
      totals[service.key].observed += serviceMap[service.key].observed;
      totals[service.key].complying += serviceMap[service.key].complying;
    });
    return monthlyRecord(day, serviceMap);
  });
  rows.push(monthlyRecord("SUMA TOTAL", totals));
  return {
    spec,
    month,
    rows
  };
}

function cedulaRowsFromRounds(rounds = [], spec, date) {
  const seen = new Set();
  return rounds.flatMap(round => {
    const reviews = Array.isArray(round.packageReviews) ? round.packageReviews : [];
    return reviews
      .filter(review => preventivePackageMatches(review.packageType || review.preventivePackage, spec.packageType))
      .map((review, index) => cedulaItem(spec, round, review, index, date))
      .filter(item => {
        const signature = [item.patientId, item.roundId, item.spec.key, item.deviceName, JSON.stringify(item.checkValues)].join("|");
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      })
      .map((item, index) => spec.columns.map(column => cedulaColumnValue(column, item, index, date)));
  });
}

function cedulaItem(spec, round = {}, review = {}, index = 0) {
  return {
    spec,
    roundId: round.roundId || round.id || "",
    patientId: review.patientId || round.patientId || "",
    patientName: review.patientName || round.patientName || "",
    service: review.service || round.service || "",
    bed: review.bed || round.bed || "",
    sex: review.sex || round.sex || "",
    birthDate: review.birthDate || round.birthDate || "",
    rfc: review.rfc || review.patientIdentifier || round.rfc || round.patientIdentifier || "",
    deviceName: review.deviceType || review.deviceSubtype || review.deviceName || review.packageType || `Revision ${index + 1}`,
    checkValues: normalizeChecks(review.preventiveChecks || review.checks || {})
  };
}

function normalizeChecks(checks = {}) {
  return Object.fromEntries(Object.entries(checks).map(([key, value]) => [key, cedulaCheckValue(value)]));
}

function cedulaColumnValue(column, item, index, date) {
  if (column === "consecutive") return index + 1;
  if (column === "date") return date;
  if (column === "turn") return TURN;
  if (column === "service") return normalizeService(item.service) || item.service || "";
  if (column === "patientDeviceName") return patientDeviceName(item);
  if (column === "birthDate") return normalizeDate(item.birthDate) || item.birthDate || "";
  if (column === "rfc") return item.rfc || "";
  if (column === "genderCode") return genderCode(item.sex);
  if (column === "bed") return item.bed || "";
  if (column === "rowCompliance") return preventiveCedulaRowCompliance(item.spec, item.checkValues);
  return cedulaCheckValue(item.checkValues?.[column]);
}

function patientDeviceName(item = {}) {
  const name = item.patientName || item.patientId || "Paciente sin nombre";
  return item.deviceName ? `${name} (${item.deviceName})` : name;
}

function genderCode(value = "") {
  const sex = normalizeSex(value);
  if (sex === "F") return "1";
  if (sex === "M") return "2";
  return "";
}

export function preventiveCedulaRowCompliance(spec, checks = {}) {
  const values = spec.columns
    .slice(spec.checkStart, spec.checkEnd + 1)
    .map(key => cedulaCheckValue(checks[key]));
  const observed = values.filter(value => value === "SI" || value === "NO");
  if (!observed.length) return "";
  return roundedPercent((observed.filter(value => value === "SI").length / observed.length) * 100);
}

export function preventiveCedulaSummaryRow(spec, rows = []) {
  const summary = Array(spec.headers.length).fill("");
  summary[0] = "PORCENTAJE DE CUMPLIMIENTO";
  let totalObserved = 0;
  let totalYes = 0;
  for (let index = spec.checkStart; index <= spec.checkEnd; index += 1) {
    const values = rows.map(row => cedulaCheckValue(row[index])).filter(value => value === "SI" || value === "NO");
    if (!values.length) continue;
    const yes = values.filter(value => value === "SI").length;
    summary[index] = roundedPercent((yes / values.length) * 100);
    totalYes += yes;
    totalObserved += values.length;
  }
  if (totalObserved) summary[spec.complianceColumn] = roundedPercent((totalYes / totalObserved) * 100);
  return summary;
}

function paddedCedulaRows(spec, rows = []) {
  const rowCount = Math.max(DEFAULT_ROWS, rows.length);
  return Array.from({ length: rowCount }, (_, index) => rows[index] || Array(spec.headers.length).fill(""));
}

function recordFromValues(headers = [], values = []) {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
}

function monthlyRecord(day, serviceMap) {
  return Object.fromEntries([
    ["DIA", day],
    ...PREVENTIVE_MONTHLY_SERVICES.flatMap(service => [
      [`${service.label} OBSERVADOS`, serviceMap[service.key]?.observed || 0],
      [`${service.label} CUMPLIENDO`, serviceMap[service.key]?.complying || 0]
    ])
  ]);
}

function emptyMonthlyServiceMap() {
  return Object.fromEntries(PREVENTIVE_MONTHLY_SERVICES.map(service => [service.key, { observed: 0, complying: 0 }]));
}

function monthDescriptor(date = todayIso()) {
  const iso = normalizeDate(date) || todayIso();
  const [yearText, monthText] = iso.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return {
    year,
    month,
    monthKey,
    daysInMonth: new Date(year, month, 0).getDate()
  };
}

function monthlyServiceKey(service = "") {
  const normalized = normalizeService(service);
  const key = normalizeText(service).replace(/[^A-Z0-9]/g, "");
  if (normalized === "MEDICINA INTERNA" || key === "MI") return "mi";
  if (normalized === "CIRUGIA Y TRAUMATOLOGIA") return "cirugia";
  if (normalized === "PEDIATRIA") return "pediatria";
  if (normalized === "UCI PEDIATRICOS" || key === "UTIP") return "utip";
  if (normalized === "UCIN NEONATALES" || key === "UCIN") return "ucin";
  if (normalized === "CUNEROS") return "cuneros";
  if (normalized === "GINECOLOGIA Y OBSTETRICIA" || key === "GYO" || key === "GO") return "gyo";
  if (normalized === "UCI ADULTOS" || key === "UCIA") return "ucia";
  if (normalized === "URGENCIAS") return "urgencias";
  if (normalized === "HEMODIALISIS") return "hemodialisis";
  return "";
}

function preventivePackageMatches(value, target) {
  return normalizeText(value) === normalizeText(target);
}

function cedulaCheckValue(value) {
  const key = normalizeText(value);
  if (key === "SI") return "SI";
  if (key === "NO") return "NO";
  if (key === "NA" || key === "N/A") return "NA";
  return "";
}

function roundedPercent(value) {
  if (!Number.isFinite(value)) return "";
  return Math.round(value * 100) / 100;
}

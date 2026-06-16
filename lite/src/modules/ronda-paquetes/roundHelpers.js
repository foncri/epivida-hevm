import { normalizeBed, serviceFromBed } from "../../lib/normalize.js";

export const ROUND_SERVICE_FILTERS = [
  { value: "Todos", label: "Todos" },
  { value: "MEDICINA INTERNA", label: "Medicina Interna" },
  { value: "CIRUGIA Y TRAUMATOLOGIA", label: "Cirugia y Traumatologia" },
  { value: "PEDIATRIA", label: "Pediatria" },
  { value: "CUNEROS", label: "Cuneros" },
  { value: "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", label: "UCIN" },
  { value: "HEMODIALISIS", label: "Hemodialisis" },
  { value: "GINECOLOGIA Y OBSTETRICIA", label: "Ginecologia y Obstetricia" },
  { value: "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS", label: "UCIP" },
  { value: "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS", label: "UCIA" },
  { value: "URGENCIAS", label: "Urgencias" },
  { value: "AMBULATORIO", label: "Ambulatorio" }
];

const KNOWN_SERVICE_BEDS = {
  "MEDICINA INTERNA": [
    ...range(1, 30),
    "AIS 1 MI", "AIS 2 MI", "AIS 3 MI", "OBS 1 MI", "OBS 2 MI"
  ],
  "CIRUGIA Y TRAUMATOLOGIA": [
    ...range(43, 66),
    "AIS 1 CX", "AIS 2 CX", "AIS 3 CX", "OBS 1 CX", "OBS 2 CX"
  ],
  PEDIATRIA: [
    ...range(67, 74),
    "AIS 1 PED", "AIS 2 PED", "AIS 3 PED", "ESC 1", "ESC 2", "ESC 3"
  ],
  CUNEROS: ["CUN 1", "CUN 2", "CUN 3"],
  "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES": ["UCIN 1", "UCIN 2"],
  HEMODIALISIS: range(1, 100).map(number => `HEM ${number}`),
  "GINECOLOGIA Y OBSTETRICIA": range(1, 5).map(number => `ALOJ ${number}`),
  "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS": ["UTIP 1"],
  "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS": ["UCIA 2", "UCIA 3", "UCIA AIS 4", "UCIA 5", "UCIA 6", "UCIA AIS 7", "UCIA 8"],
  URGENCIAS: [
    ...range(1, 4).map(number => `F${number}`),
    ...range(1, 11).map(number => `UX ${number}`),
    ...range(1, 5).map(number => `P${number}`),
    "AIS P", "AISLADO 1", "AISLADO 2", "OBS 1 URG", "OBS 2 URG", "CHOQUE",
    ...range(1, 14).map(number => `B${number}`)
  ]
};

const NORMALIZE_CACHE_LIMIT = 1500;
const roundTextCache = new Map();
const serviceKeyCache = new Map();
const patientSearchCache = new WeakMap();

export function filterAndSortRoundPatients(patients, filters) {
  const serviceKey = normalizeServiceKey(filters.service || "Todos");
  const query = normalizeRoundText(filters.query || "");
  const rows = [];
  for (const patient of patients) {
    if (patient.active === false) continue;
    if (serviceKey !== "TODOS" && normalizeServiceKey(patientService(patient)) !== serviceKey) continue;
    if (query) {
      if (!roundPatientSearchText(patient).includes(query)) continue;
    }
    rows.push(patient);
  }
  return rows.sort(sortByServiceBed);
}

export function roundPatientSearchText(patient = {}) {
  const signature = [
    patientLabel(patient),
    patientBed(patient),
    patientService(patient),
    patientDiagnosis(patient),
    patient.sector,
    patient.status || patient.currentState,
    patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis
  ].join(" ");
  const cached = patientSearchCache.get(patient);
  if (cached?.signature === signature) return cached.text;
  const text = normalizeRoundText(signature);
  patientSearchCache.set(patient, { signature, text });
  return text;
}

export function bedBoardItems(patients, serviceFilter = "Todos", catalogs = []) {
  const sorted = dedupeBedRows(patients).sort(sortByServiceBed);
  const selectedServiceKey = normalizeServiceKey(serviceFilter === "Todos" ? "" : serviceFilter);
  const services = new Set(sorted.map(patient => normalizeServiceKey(patientService(patient))).filter(Boolean));
  const serviceKey = selectedServiceKey || (services.size === 1 ? [...services][0] : "");
  if (!serviceKey) return sorted.map(patient => ({ bed: patientBed(patient), patient }));
  const knownBeds = knownBedsForService(serviceKey, sorted, catalogs);
  const numericRows = sorted
    .map(patient => ({ patient, number: bedNumberToken(patientBed(patient)) }))
    .filter(item => Number.isFinite(item.number));
  const occupiedItems = sorted.map(patient => ({ bed: patientBed(patient), patient }));
  if (numericRows.length < Math.max(3, Math.floor(sorted.length * 0.6))) return mergeKnownBedItems(occupiedItems, knownBeds);
  const min = Math.min(...numericRows.map(item => item.number));
  const max = Math.max(...numericRows.map(item => item.number));
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min > 80) return mergeKnownBedItems(occupiedItems, knownBeds);
  const byNumber = new Map(numericRows.map(item => [item.number, item.patient]));
  const inferred = [];
  for (let number = min; number <= max; number += 1) {
    const patient = byNumber.get(number) || null;
    inferred.push({ bed: patient ? patientBed(patient) : String(number), patient });
  }
  return mergeKnownBedItems(inferred, knownBeds);
}

function dedupeBedRows(patients) {
  const map = new Map();
  patients.filter(patient => patient.active !== false).forEach(patient => {
    const key = `${normalizeServiceKey(patientService(patient))}|${normalizeRoundText(patientBed(patient))}`;
    if (!map.has(key)) map.set(key, patient);
  });
  return [...map.values()];
}

export function knownBedsForService(service, patients = [], catalogs = []) {
  const serviceKey = normalizeServiceKey(service);
  const catalogBeds = knownBedsFromCatalog(catalogs, serviceKey);
  const knownBeds = catalogBeds.length ? catalogBeds : KNOWN_SERVICE_BEDS[serviceKey] || [];
  const occupiedBeds = patients.map(patientBed).filter(Boolean);
  return uniqueValues([...knownBeds, ...occupiedBeds]).sort(compareBeds);
}

function knownBedsFromCatalog(catalogs = [], serviceKey = "") {
  return catalogs
    .filter(row => row?.type === "known_beds" && row.active !== false)
    .filter(row => normalizeServiceKey(row.service || bedServiceFromValue(row.value)) === serviceKey)
    .sort((a, b) => Number(a.order || 9990) - Number(b.order || 9990))
    .map(row => row.bed || bedFromCatalogRow(row))
    .filter(Boolean);
}

function bedServiceFromValue(value = "") {
  return String(value).split("|")[0] || "";
}

function bedFromCatalogRow(row = {}) {
  const value = String(row.value || "");
  return row.label || value.split("|").at(-1) || value;
}

function mergeKnownBedItems(items, knownBeds = []) {
  if (!knownBeds.length) return items;
  const byBed = new Map(items.map(item => [normalizeRoundText(item.bed), item]));
  knownBeds.forEach(bed => {
    const key = normalizeRoundText(bed);
    if (!byBed.has(key)) byBed.set(key, { bed, patient: null });
  });
  return [...byBed.values()].sort((a, b) => compareBeds(a.bed, b.bed));
}

export function uniqueValues(values = []) {
  const map = new Map();
  values.filter(Boolean).forEach(value => {
    const key = normalizeRoundText(value);
    if (!map.has(key)) map.set(key, value);
  });
  return [...map.values()];
}

export function patientLabel(patient = {}) {
  return patient.patientName || patient.name || patient.fullName || patient.patientId || "Paciente";
}

export function patientService(patient = {}) {
  const explicit = patient.service || patient.currentService || "";
  const explicitKey = normalizeRoundText(explicit);
  if (explicit && !["SIN SERVICIO", "SIN DATO", "SD", "S/D"].includes(explicitKey)) return explicit;
  return serviceFromBed(patientBed(patient)) || "SIN SERVICIO";
}

export function patientBed(patient = {}) {
  const raw = patient.bed || patient.currentBed || "";
  return normalizeBed(raw) || raw || "S/C";
}

export function patientDiagnosis(patient = {}) {
  return patient.currentDiagnosis || patient.hospitalDiagnosis || patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis || patient.diagnosis || "";
}

export function sortByServiceBed(a, b) {
  return patientService(a).localeCompare(patientService(b), "es")
    || compareBeds(patientBed(a), patientBed(b))
    || patientLabel(a).localeCompare(patientLabel(b), "es");
}

export function upsertOrRemovePatient(patients, saved) {
  const next = patients.filter(patient => patient.patientId !== saved.patientId);
  if (saved.active === false) return next;
  return [saved, ...next].sort(sortByServiceBed);
}

export function compareBeds(a, b) {
  const an = bedNumberToken(a);
  const bn = bedNumberToken(b);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
  return String(a || "").localeCompare(String(b || ""), "es", { numeric: true });
}

function bedNumberToken(bed) {
  const match = String(bed || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function rememberNormalized(cache, key, value) {
  if (!cache.has(key) && cache.size >= NORMALIZE_CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

export function normalizeRoundText(value) {
  const key = String(value || "");
  const cached = roundTextCache.get(key);
  if (cached !== undefined) return cached;
  return rememberNormalized(roundTextCache, key, key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase());
}

export function normalizeServiceKey(value) {
  const key = String(value || "");
  const cached = serviceKeyCache.get(key);
  if (cached !== undefined) return cached;
  const text = normalizeRoundText(value).replace(/\s+/g, " ");
  if (!text) return rememberNormalized(serviceKeyCache, key, "");
  if (text === "TODOS") return rememberNormalized(serviceKeyCache, key, "TODOS");
  if (text === "MI" || text.includes("MEDICINA INTERNA")) return rememberNormalized(serviceKeyCache, key, "MEDICINA INTERNA");
  if (text.includes("CIRUG") || text.includes("TRAUMATO")) return rememberNormalized(serviceKeyCache, key, "CIRUGIA Y TRAUMATOLOGIA");
  if ((text.includes("INTENSIVO") && text.includes("NEONAT")) || text.includes("UCIN")) return rememberNormalized(serviceKeyCache, key, "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES");
  if ((text.includes("INTENSIVO") && text.includes("PEDIATR")) || text.includes("UCIP") || text.includes("UTIP") || text === "UCI PEDIATRICOS") return rememberNormalized(serviceKeyCache, key, "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS");
  if ((text.includes("INTENSIVO") && text.includes("ADULTO")) || text.includes("UCIA") || text === "UCI ADULTOS") return rememberNormalized(serviceKeyCache, key, "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS");
  if (text.includes("PEDIATR")) return rememberNormalized(serviceKeyCache, key, "PEDIATRIA");
  if (text.includes("CUNERO") || text === "CUN") return rememberNormalized(serviceKeyCache, key, "CUNEROS");
  if (text.includes("HEMODI") || text === "HD") return rememberNormalized(serviceKeyCache, key, "HEMODIALISIS");
  if (text.includes("GINECO") || text.includes("OBSTETRIC")) return rememberNormalized(serviceKeyCache, key, "GINECOLOGIA Y OBSTETRICIA");
  if (text.includes("URGENCIA") || text === "URG") return rememberNormalized(serviceKeyCache, key, "URGENCIAS");
  if (text.includes("AMBULATOR")) return rememberNormalized(serviceKeyCache, key, "AMBULATORIO");
  const inferredFromBed = serviceFromBed(text);
  if (inferredFromBed) return rememberNormalized(serviceKeyCache, key, inferredFromBed);
  return rememberNormalized(serviceKeyCache, key, text);
}

function range(start, end) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => String(start + index));
}

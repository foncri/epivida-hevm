import { cacheGet, cacheSet } from "../lib/cache.js";
import { appConfig } from "../lib/config.js";
import { nowIso } from "../lib/date.js";
import { cleanText, stripUndefined } from "../lib/validators.js";
import { listCollection } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";
import { LEGACY_ANTIMICROBIALS, LEGACY_CULTURE_TYPES } from "./legacyClinicalCatalogs.js";

const CACHE_KEY = "catalogs:last";
let catalogsPromise = null;

const DEFAULT_CATALOG_VERSION = "legacy-2026-06";

const LEGACY_KNOWN_BEDS = {
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

const DEFAULT_CATALOGS = [
  ...rows("services", [
    "MEDICINA INTERNA",
    "CIRUGIA Y TRAUMATOLOGIA",
    "PEDIATRIA",
    "CUNEROS",
    "UCIN NEONATALES",
    "HEMODIALISIS",
    "ONCOLOGIA",
    "GINECOLOGIA Y OBSTETRICIA",
    "UCI PEDIATRICOS",
    "UCI ADULTOS",
    "URGENCIAS",
    "AMBULATORIO"
  ]),
  ...knownBedRows(),
  ...rows("device_types", [
    "CVC",
    "Cateter Mahurkar",
    "Cateter Permacath",
    "Cateter Tenckhoff",
    "Cateter Puerto",
    "PICC",
    "Cateter periferico",
    "Sonda Foley",
    "Ventilacion mecanica",
    "Tubo endotraqueal",
    "Traqueostomia",
    "Drenaje",
    "DrenoVAC",
    "Sonda nasogastrica",
    "Puntas nasales/Canula nasal",
    "Nutricion parenteral",
    "Otro"
  ]),
  ...rows("culture_types", LEGACY_CULTURE_TYPES),
  ...rows("culture_status", ["solicitado", "pendiente", "resultado", "negativo", "positivo", "contaminado"]),
  ...rows("antimicrobials", LEGACY_ANTIMICROBIALS),
  ...rows("antimicrobial_status", ["activo", "suspendido", "completado", "profilaxis", "ajustado"])
];

function rows(type, values = []) {
  return values.map((value, index) => ({
    catalogId: catalogIdFor(type, value),
    type,
    value,
    label: value,
    order: (index + 1) * 10,
    active: true,
    version: DEFAULT_CATALOG_VERSION,
    source: "legacy_catalog"
  }));
}

function knownBedRows() {
  return Object.entries(LEGACY_KNOWN_BEDS).flatMap(([service, beds], serviceIndex) =>
    beds.map((bed, bedIndex) => ({
      catalogId: catalogIdFor("known_beds", `${service}|${bed}`),
      type: "known_beds",
      value: `${service}|${bed}`,
      label: bed,
      service,
      bed,
      order: (serviceIndex + 1) * 1000 + bedIndex + 1,
      active: true,
      version: DEFAULT_CATALOG_VERSION,
      source: "legacy_bed_catalog"
    }))
  );
}

function catalogIdFor(type, value) {
  return `${type}_${String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90) || "item"}`;
}

function normalizeCatalog(row = {}) {
  const type = cleanText(row.type || row.catalogType || "", 80);
  const value = cleanText(row.value || row.key || row.code || row.label || "", 180);
  const label = cleanText(row.label || value, 220);
  return stripUndefined({
    ...row,
    catalogId: row.catalogId || row.id || catalogIdFor(type, value),
    type,
    value,
    label,
    order: Number.isFinite(Number(row.order)) ? Number(row.order) : 9990,
    active: row.active !== false,
    version: cleanText(row.version || DEFAULT_CATALOG_VERSION, 80)
  });
}

function mergeCatalogRows(...groups) {
  const map = new Map();
  groups.flat().filter(Boolean).forEach(row => {
    const normalized = normalizeCatalog(row);
    if (!normalized.type || !normalized.value) return;
    const key = normalized.catalogId || catalogIdFor(normalized.type, normalized.value);
    map.set(key, { ...map.get(key), ...normalized });
  });
  return [...map.values()].sort(compareCatalogRows);
}

function compareCatalogRows(a, b) {
  return String(a.type).localeCompare(String(b.type), "es")
    || Number(a.order || 9990) - Number(b.order || 9990)
    || String(a.label || a.value).localeCompare(String(b.label || b.value), "es");
}

async function loadCatalogRows() {
  const pending = await pendingPayloadsForCollection("catalogs");
  if (appConfig().testMode) {
    const cached = await cacheGet(CACHE_KEY);
    return mergeCatalogRows(DEFAULT_CATALOGS, cached?.value || [], pending);
  }
  try {
    const remoteRows = await listCollection("catalogs");
    const rows = mergeCatalogRows(DEFAULT_CATALOGS, remoteRows, pending);
    cacheSet(CACHE_KEY, rows).catch(() => undefined);
    return rows;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return mergeCatalogRows(DEFAULT_CATALOGS, cached?.value || [], pending);
  }
}

export async function loadCatalogs() {
  catalogsPromise ||= loadCatalogRows().finally(() => {
    catalogsPromise = null;
  });
  return catalogsPromise;
}

export function defaultCatalogRows() {
  return DEFAULT_CATALOGS.map(row => ({ ...row }));
}

export function catalogRowsByType(catalogs = [], type = "") {
  return catalogs
    .filter(row => row.type === type && row.active !== false)
    .sort(compareCatalogRows);
}

export function catalogOptions(catalogs = [], type = "", options = {}) {
  const rowsForType = catalogRowsByType(catalogs.length ? catalogs : DEFAULT_CATALOGS, type);
  const values = rowsForType.map(row => [row.value, row.label || row.value]);
  return options.includeBlank === false ? values : [["", options.blankLabel || "Seleccionar"], ...values];
}

function range(start, end) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => String(start + index));
}

export async function saveCatalogEntry(app, entry = {}) {
  const payload = normalizeCatalog({
    ...entry,
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || "",
    createdAt: entry.createdAt || nowIso(),
    createdBy: entry.createdBy || app.state.auth.user?.uid || ""
  });
  if (!payload.type || !payload.value || !payload.label) {
    throw new Error("Catalogo sin tipo, valor o etiqueta.");
  }
  const saved = await setDocMergeOrQueue(app, `catalogs/${payload.catalogId}`, payload, {
    module: "admin",
    entityType: "catalog",
    entityId: payload.catalogId
  });
  catalogsPromise = null;
  await writeAudit(app, {
    actionType: entry.catalogId ? "catalog_update" : "catalog_create",
    module: "admin",
    entityType: "catalog",
    entityId: payload.catalogId,
    after: saved
  });
  return saved;
}

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
export const CATALOG_IMPORT_MAX_ROWS = 500;

export const CATALOG_TYPES = [
  "services",
  "known_beds",
  "device_types",
  "culture_types",
  "culture_status",
  "antimicrobials",
  "antimicrobial_status"
];

const CATALOG_TYPE_SET = new Set(CATALOG_TYPES);
const DEFAULT_IMPORT_HEADERS = ["type", "value", "label", "service", "bed", "order", "version", "active"];
const IMPORT_HEADER_ALIASES = {
  activo: "active",
  active: "active",
  cama: "bed",
  catalogid: "catalogId",
  catalog_id: "catalogId",
  catalogo: "type",
  catalogtype: "type",
  codigo: "value",
  code: "value",
  etiqueta: "label",
  id: "catalogId",
  key: "value",
  label: "label",
  orden: "order",
  order: "order",
  servicio: "service",
  service: "service",
  tipo: "type",
  type: "type",
  valor: "value",
  value: "value",
  version: "version"
};

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

function normalizedHeader(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectDelimiter(line = "") {
  const candidates = ["\t", ",", ";"];
  return candidates
    .map(delimiter => ({ delimiter, count: parseDelimitedLine(line, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

function parseDelimitedLine(line = "", delimiter = ",") {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseImportActive(value = "") {
  const text = normalizedHeader(value);
  if (!text) return true;
  return !["0", "baja", "false", "inactivo", "inactive", "no", "n"].includes(text);
}

function hasImportHeader(cells = []) {
  return cells.some(cell => IMPORT_HEADER_ALIASES[normalizedHeader(cell)]);
}

function importHeaderKey(value = "") {
  return IMPORT_HEADER_ALIASES[normalizedHeader(value)] || normalizedHeader(value);
}

function importRawRow(cells = [], headers = []) {
  return headers.reduce((acc, header, index) => {
    if (header) acc[header] = cells[index] ?? "";
    return acc;
  }, {});
}

function normalizeCatalogImportRow(raw = {}, index = 0, options = {}) {
  const errors = [];
  const type = cleanText(raw.type || "", 80);
  let service = cleanText(raw.service || "", 120);
  let bed = cleanText(raw.bed || "", 120);
  let value = cleanText(raw.value || raw.label || "", 180);
  let label = cleanText(raw.label || value || bed, 220);

  if (!CATALOG_TYPE_SET.has(type)) {
    errors.push(`Tipo no permitido: ${type || "vacio"}.`);
  }

  if (type === "known_beds") {
    if ((!service || !bed) && value.includes("|")) {
      const [valueService, valueBed] = value.split("|");
      service ||= cleanText(valueService, 120);
      bed ||= cleanText(valueBed, 120);
    }
    if (!service || !bed) {
      errors.push("Cama conocida requiere servicio y cama.");
    }
    value = `${service}|${bed}`;
    label = label || bed;
  } else if (!value) {
    errors.push("Catalogo requiere valor.");
  }

  if (!label) {
    errors.push("Catalogo requiere etiqueta.");
  }

  if (errors.length) {
    return { errors };
  }

  return {
    row: normalizeCatalog({
      catalogId: raw.catalogId || "",
      type,
      value,
      label,
      service: type === "known_beds" ? service : undefined,
      bed: type === "known_beds" ? bed : undefined,
      order: raw.order || (index + 1) * 10,
      active: parseImportActive(raw.active),
      version: raw.version || options.defaultVersion || "admin-import",
      source: options.source || "admin_catalog_import"
    }),
    errors: []
  };
}

export function parseCatalogImportText(text = "", options = {}) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return {
      rows: [],
      accepted: [],
      rejected: [],
      issues: ["No hay catalogos para importar."],
      headers: [],
      delimiter: "",
      totalRows: 0,
      truncated: false
    };
  }

  const delimiter = options.delimiter || detectDelimiter(lines[0]);
  const firstCells = parseDelimitedLine(lines[0], delimiter);
  const headerPresent = hasImportHeader(firstCells);
  const headers = headerPresent
    ? firstCells.map(importHeaderKey)
    : DEFAULT_IMPORT_HEADERS.slice(0, firstCells.length);
  const dataLines = headerPresent ? lines.slice(1) : lines;
  const maxRows = Math.min(CATALOG_IMPORT_MAX_ROWS, Math.max(1, Number(options.maxRows) || CATALOG_IMPORT_MAX_ROWS));
  const accepted = [];
  const rejected = [];

  dataLines.slice(0, maxRows).forEach((line, index) => {
    const raw = importRawRow(parseDelimitedLine(line, delimiter), headers);
    const normalized = normalizeCatalogImportRow(raw, index, options);
    if (normalized.errors.length) {
      rejected.push({ line: index + (headerPresent ? 2 : 1), raw, errors: normalized.errors });
    } else {
      accepted.push(normalized.row);
    }
  });

  const truncated = dataLines.length > maxRows;
  const issues = [];
  if (truncated) issues.push(`Se previsualizaron ${maxRows} de ${dataLines.length} fila(s).`);
  if (rejected.length) issues.push(`${rejected.length} fila(s) no se importaran por errores de validacion.`);

  return {
    rows: accepted,
    accepted,
    rejected,
    issues,
    headers,
    delimiter,
    totalRows: dataLines.length,
    truncated
  };
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

export async function importCatalogEntries(app, rows = [], options = {}) {
  const maxRows = Math.min(CATALOG_IMPORT_MAX_ROWS, Math.max(1, Number(options.maxRows) || CATALOG_IMPORT_MAX_ROWS));
  const now = nowIso();
  const importBatchId = options.importBatchId || `catalog_import_${now.replace(/[^0-9]/g, "").slice(0, 14)}`;
  const userId = app.state.auth.user?.uid || "";
  const normalizedRows = rows.slice(0, maxRows).map((row, index) => normalizeCatalog({
    ...row,
    order: row.order ?? (index + 1) * 10,
    source: row.source || "admin_catalog_import",
    importBatchId,
    updatedAt: now,
    updatedBy: userId,
    createdAt: row.createdAt || now,
    createdBy: row.createdBy || userId
  }));

  const invalid = normalizedRows.find(row => !row.type || !row.value || !row.label || !CATALOG_TYPE_SET.has(row.type));
  if (invalid) {
    throw new Error(`Catalogo importado invalido: ${invalid.type || "sin tipo"} / ${invalid.value || "sin valor"}.`);
  }

  const savedRows = [];
  for (const payload of normalizedRows) {
    const saved = await setDocMergeOrQueue(app, `catalogs/${payload.catalogId}`, payload, {
      module: "admin",
      entityType: "catalog",
      entityId: payload.catalogId
    });
    savedRows.push(saved);
  }

  catalogsPromise = null;
  await writeAudit(app, {
    actionType: "catalog_import",
    module: "admin",
    entityType: "catalog_import",
    entityId: importBatchId,
    after: {
      importBatchId,
      count: savedRows.length,
      types: [...new Set(savedRows.map(row => row.type))],
      catalogIds: savedRows.map(row => row.catalogId).slice(0, 100),
      source: options.source || "admin_catalog_import"
    }
  });

  return {
    importBatchId,
    savedRows,
    count: savedRows.length,
    syncStatus: savedRows.some(row => row.syncStatus === "local_pending") ? "local_pending" : "server_synced"
  };
}

import { nowIso } from "../lib/date.js";
import { writeAudit } from "./auditService.js";
import { addDocOrQueue } from "./offlineQueueService.js";

const FORMULA_PREFIX = /^[=+\-@]/;
const MAX_WORKBOOK_ROWS = 5000;
const MAX_WORKBOOK_COLS = 120;
const encoder = new TextEncoder();

export async function workbookBufferFromRows(rows = [], options = {}) {
  const sheetName = safeSheetName(options.sheetName || "EPIVIDA");
  const normalized = normalizeRows(rows);
  const headers = normalized.headers.slice(0, MAX_WORKBOOK_COLS);
  const bodyRows = normalized.rows.slice(0, MAX_WORKBOOK_ROWS);
  const shared = [];
  const sharedIndex = new Map();
  const sharedId = value => {
    const text = safeCellText(value);
    if (!sharedIndex.has(text)) {
      sharedIndex.set(text, shared.length);
      shared.push(text);
    }
    return sharedIndex.get(text);
  };
  const rowsXml = [headers, ...bodyRows.map(row => headers.map(header => row[header]))]
    .map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) =>
        `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="s"><v>${sharedId(value)}</v></c>`
      ).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join("");
  const files = {
    "[Content_Types].xml": contentTypesXml(),
    "_rels/.rels": rootRelsXml(),
    "xl/workbook.xml": workbookXml(sheetName),
    "xl/_rels/workbook.xml.rels": workbookRelsXml(),
    "xl/sharedStrings.xml": sharedStringsXml(shared),
    "xl/worksheets/sheet1.xml": worksheetXml(rowsXml)
  };
  return zipFiles(files);
}

export async function downloadWorkbook(app, filename, rows = [], meta = {}) {
  const createdAt = nowIso();
  const buffer = await workbookBufferFromRows(rows, { sheetName: meta.sheetName || meta.dataset || "EPIVIDA" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  await writeAudit(app, {
    actionType: "export_excel",
    module: "reportes",
    entityType: "export",
    entityId: `${filename}:${createdAt}`,
    metadata: { filename, rows: rows.length, ...meta }
  }).catch(() => undefined);
  await addDocOrQueue(app, "exports_log", {
    createdAt,
    userId: app.state.auth.user?.uid || "",
    userEmail: app.state.auth.user?.email || "",
    role: app.state.auth.profile?.role || "",
    filename,
    rows: rows.length,
    dataset: meta.dataset || "",
    format: "excel",
    metadata: meta
  }, {
    module: "reportes",
    entityType: "export",
    entityId: filename
  }).catch(() => undefined);
}

function normalizeRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headers = [...new Set(safeRows.flatMap(row => Object.keys(row || {})))];
  return {
    headers: headers.length ? headers : ["sin_registros"],
    rows: headers.length ? safeRows : []
  };
}

function safeCellText(value) {
  let text = "";
  if (value === null || value === undefined) text = "";
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  text = text.replace(/\r?\n/g, " ").replace(/\t/g, " ").trim();
  return FORMULA_PREFIX.test(text.trimStart()) ? `'${text}` : text;
}

function safeSheetName(value = "") {
  const text = String(value || "EPIVIDA").replace(/[\[\]:*?/\\]/g, " ").slice(0, 31).trim();
  return text || "EPIVIDA";
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
    + `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    + `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>`
    + `</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
    + `</Relationships>`;
}

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>`
    + `</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>`
    + `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`
    + `</Relationships>`;
}

function sharedStringsXml(shared = []) {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">`
    + shared.map(value => `<si><t>${xmlEscape(value)}</t></si>`).join("")
    + `</sst>`;
}

function worksheetXml(rowsXml = "") {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

async function zipFiles(files = {}) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const sourceBytes = encoder.encode(text);
    const compressed = await deflateRaw(sourceBytes);
    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 8, true);
    localView.setUint32(18, compressed.length, true);
    localView.setUint32(22, sourceBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 8, true);
    centralView.setUint32(20, compressed.length, true);
    centralView.setUint32(24, sourceBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centralParts.length, true);
  endView.setUint16(10, centralParts.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  return concatBytes([...localParts, ...centralParts, end]).buffer;
}

async function deflateRaw(bytes) {
  if (typeof CompressionStream !== "function") throw new Error("Este navegador no puede generar Excel localmente.");
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concatBytes(parts) {
  const total = parts.reduce((sum, item) => sum + item.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
}

function xmlEscape(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

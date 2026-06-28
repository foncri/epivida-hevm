const ZIP_LOCAL_FILE = 0x04034b50;
const ZIP_CENTRAL_FILE = 0x02014b50;
const ZIP_END = 0x06054b50;
const MAX_SPREADSHEET_BYTES = 6 * 1024 * 1024;
const MAX_SPREADSHEET_ROWS = 2500;
const MAX_SPREADSHEET_COLS = 80;

const textDecoder = new TextDecoder();

export async function spreadsheetFileToTsv(file) {
  if (!file) throw new Error("Archivo no seleccionado.");
  if (Number(file.size || 0) > MAX_SPREADSHEET_BYTES) {
    throw new Error("El archivo Excel excede el limite ligero de 6 MB.");
  }
  const buffer = await file.arrayBuffer();
  return spreadsheetBufferToTsv(buffer);
}

export async function spreadsheetBufferToTsv(buffer) {
  const zip = await readZipEntries(buffer);
  const sheetPath = firstWorksheetPath(zip);
  const sheetXml = textFromZip(zip, sheetPath);
  const sharedStrings = sharedStringsFromXml(textFromZip(zip, "xl/sharedStrings.xml", false));
  return worksheetXmlToTsv(sheetXml, sharedStrings);
}

async function readZipEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(view);
  if (endOffset < 0) throw new Error("No se pudo leer el archivo Excel.");
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  const entries = new Map();
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== ZIP_CENTRAL_FILE) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = textDecoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength)).replaceAll("\\", "/");
    const dataStart = localDataOffset(view, localOffset);
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    entries.set(name, {
      name,
      method,
      bytes: await inflateZipEntry(compressed, method)
    });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view) {
  const min = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END) return offset;
  }
  return -1;
}

function localDataOffset(view, localOffset) {
  if (view.getUint32(localOffset, true) !== ZIP_LOCAL_FILE) throw new Error("Entrada Excel invalida.");
  const fileNameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  return localOffset + 30 + fileNameLength + extraLength;
}

async function inflateZipEntry(bytes, method) {
  if (method === 0) return bytes;
  if (method !== 8) throw new Error("Compresion Excel no soportada.");
  if (typeof DecompressionStream !== "function") {
    throw new Error("Este navegador no puede descomprimir Excel localmente.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function textFromZip(zip, path, required = true) {
  const entry = zip.get(path);
  if (!entry) {
    if (required) throw new Error(`Falta ${path} en el archivo Excel.`);
    return "";
  }
  return textDecoder.decode(entry.bytes);
}

function firstWorksheetPath(zip) {
  const workbook = textFromZip(zip, "xl/workbook.xml", false);
  const rels = textFromZip(zip, "xl/_rels/workbook.xml.rels", false);
  const firstSheet = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/i)?.[1] || "";
  if (firstSheet && rels) {
    const relPattern = new RegExp(`<Relationship\\b[^>]*Id="${escapeRegExp(firstSheet)}"[^>]*Target="([^"]+)"`, "i");
    const target = rels.match(relPattern)?.[1] || "";
    if (target) return normalizeSheetTarget(target);
  }
  if (zip.has("xl/worksheets/sheet1.xml")) return "xl/worksheets/sheet1.xml";
  const first = [...zip.keys()].find(path => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path));
  if (!first) throw new Error("El archivo Excel no contiene hojas legibles.");
  return first;
}

function normalizeSheetTarget(target = "") {
  const clean = target.replace(/^\/+/, "");
  if (clean.startsWith("xl/")) return clean;
  return `xl/${clean}`;
}

function sharedStringsFromXml(xml = "") {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/gi)].map(match => textFromRichXml(match[0]));
}

function worksheetXmlToTsv(xml = "", sharedStrings = []) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const reference = attr(attrs, "r");
      const column = Math.min(MAX_SPREADSHEET_COLS - 1, Math.max(0, columnIndex(reference)));
      cells[column] = cellValue(attrs, body, sharedStrings);
    }
    if (cells.some(Boolean)) rows.push(cells);
    if (rows.length >= MAX_SPREADSHEET_ROWS) break;
  }
  const width = Math.min(MAX_SPREADSHEET_COLS, Math.max(0, ...rows.map(row => row.length)));
  return rows
    .map(row => Array.from({ length: width }, (_, index) => safeTsvCell(row[index] || "")).join("\t"))
    .join("\n");
}

function cellValue(attrs = "", body = "", sharedStrings = []) {
  const type = attr(attrs, "t");
  if (type === "s") return sharedStrings[Number(textInTag(body, "v"))] || "";
  if (type === "inlineStr") return textFromRichXml(body);
  if (type === "b") return textInTag(body, "v") === "1" ? "SI" : "NO";
  return xmlDecode(textInTag(body, "v") || textInTag(body, "t"));
}

function textFromRichXml(xml = "") {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
    .map(match => xmlDecode(match[1]))
    .join("");
}

function textInTag(xml = "", tag = "") {
  return xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
}

function attr(attrs = "", name = "") {
  return attrs.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] || "";
}

function columnIndex(reference = "") {
  const letters = String(reference || "").match(/^[A-Z]+/i)?.[0] || "A";
  let value = 0;
  for (const letter of letters.toUpperCase()) value = value * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function safeTsvCell(value = "") {
  return String(value || "").replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

function xmlDecode(value = "") {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

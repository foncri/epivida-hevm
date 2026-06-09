import { nowIso } from "../lib/date.js";
import { writeAudit } from "./auditService.js";
import { addDocOrQueue } from "./offlineQueueService.js";

const CSV_FORMULA_PREFIX = /^[=+\-@]/;

function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function safeCsvCell(value) {
  const text = cellValue(value);
  return CSV_FORMULA_PREFIX.test(text.trimStart()) ? `'${text}` : text;
}

export function toCsv(rows = []) {
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const quote = value => `"${safeCsvCell(value).replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map(row => headers.map(header => quote(row[header])).join(","))].join("\n");
}

export async function downloadCsv(app, filename, rows, meta = {}) {
  const createdAt = nowIso();
  const csv = `\uFEFF${toCsv(rows)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  await writeAudit(app, {
    actionType: "export_csv",
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
    metadata: meta
  }, {
    module: "reportes",
    entityType: "export",
    entityId: filename
  }).catch(() => undefined);
}

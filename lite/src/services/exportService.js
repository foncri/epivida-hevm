import { nowIso } from "../lib/date.js";
import { writeAudit } from "./auditService.js";

export function toCsv(rows = []) {
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map(row => headers.map(header => quote(row[header])).join(","))].join("\n");
}

export async function downloadCsv(app, filename, rows, meta = {}) {
  const csv = toCsv(rows);
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
    entityId: `${filename}:${nowIso()}`,
    metadata: { filename, rows: rows.length, ...meta }
  }).catch(() => undefined);
}

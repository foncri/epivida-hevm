import { writeFileSync } from "node:fs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const [key, inlineValue] = arg.slice(2).split("=");
  const nextValue = inlineValue ?? (process.argv[index + 1]?.startsWith("--") ? "" : process.argv[++index]);
  args.set(key, nextValue || "true");
}

const count = Math.min(1000, Math.max(3, Number(args.get("count") || 300)));
const format = String(args.get("format") || "json").toLowerCase();
const out = args.get("out") || "";

globalThis.window = {
  __EPIVIDA_LITE_TEST_MODE__: true,
  EPIVIDA_LITE_REQUIRE_AUTH: true
};
globalThis.location = {
  hostname: "localhost",
  search: `?epividaTest=1&seedPatients=${count}`,
  hash: "#/monitoreo-epidemiologico"
};

const { testActivePatients } = await import("../src/services/testDataService.js");
const rows = testActivePatients();

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(data) {
  const headers = ["patientId", "patientName", "service", "bed", "sex", "age", "status", "epidemiologicalDiagnosis", "hospitalDiagnosis", "syncStatus"];
  return [
    headers.join(","),
    ...data.map(row => headers.map(header => csvCell(row[header])).join(","))
  ].join("\n");
}

const payload = format === "csv" ? toCsv(rows) : JSON.stringify(rows, null, 2);

if (out) {
  writeFileSync(out, payload);
  console.log(`Wrote ${rows.length} synthetic QA patients to ${out}`);
} else {
  console.log(payload);
}

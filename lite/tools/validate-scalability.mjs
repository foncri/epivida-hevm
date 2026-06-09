import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const repoRoot = resolve(root, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function requireIncludes(source, expected, label) {
  if (!source.includes(expected)) fail(`${label} debe incluir ${expected}.`);
}

const firestore = readFileSync(join(root, "src/services/firestoreService.js"), "utf8");
for (const expected of ["paginateQuery", "startAfter", "endBefore", "limitToLast", "limit(size)", "clampPageSize"]) {
  requireIncludes(firestore, expected, "firestoreService.js");
}

const pagination = readFileSync(join(root, "src/lib/pagination.js"), "utf8");
for (const expected of ["createCursorState", "getCursorState", "resetPagination", "loadNextPage", "loadPreviousPage", "MAX_PAGE_SIZE"]) {
  requireIncludes(pagination, expected, "pagination.js");
}

const dom = readFileSync(join(root, "src/components/dom.js"), "utf8");
for (const expected of ["rows.length > 100", "pageSize = options.pageSize || 50", "requestAnimationFrame"]) {
  requireIncludes(dom, expected, "components/dom.js");
}

const strategy = readFileSync(join(root, "docs/ONE_MILLION_PATIENT_STRATEGY.md"), "utf8");
for (const expected of ["Nunca cargar 1,000,000", "patients_active", "patients_archive", "patients_search", "limit", "cursor", "Snapshots"]) {
  requireIncludes(strategy, expected, "ONE_MILLION_PATIENT_STRATEGY.md");
}

for (const file of walk(join(root, "src")).filter(file => extname(file) === ".js")) {
  const source = readFileSync(file, "utf8");
  if (/listCollection\(\s*["']patients_archive["']\s*\)/.test(source)) {
    fail(`${relative(repoRoot, file)} lee patients_archive sin filtros ni cursor.`);
  }
  if (/listCollection\(\s*["'](devices_archive|iaas_archive|cultures|antimicrobials)["']\s*\)/.test(source)) {
    fail(`${relative(repoRoot, file)} lee historico completo sin filtros.`);
  }
}

if (failures.length) {
  console.error(`EPIVIDA Lite scalability validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite scalability validation OK");

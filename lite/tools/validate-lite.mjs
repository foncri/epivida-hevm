import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const repoRoot = resolve(root, "..");
const nodeBin = process.env.EPIVIDA_NODE_BIN || process.execPath;
const strictSyntax = process.env.EPIVIDA_STRICT_SYNTAX === "1";
const requiredFiles = [
  "index.html",
  "_headers",
  "epivida-lite-config.js",
  "epivida-lite-sw.js",
  "manifest.webmanifest",
  "src/main.js",
  "src/app.js",
  "src/router.js",
  "firebase/firestore.rules",
  "firebase/firestore.indexes.json"
];
const forbidden = [
  "innerHTML",
  "localStorage",
  "eval(",
  "new Function",
  "iaas-system",
  "FULL_SCRIPTS",
  "FULL_STYLES",
  "XLSX",
  "google.script"
];

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function checkSyntax(file) {
  const result = spawnSync(nodeBin, ["--check", file], { encoding: "utf8" });
  const relativeFile = relative(repoRoot, file);
  const blocked = result.error && ["EPERM", "EACCES"].includes(result.error.code);

  if (blocked && !strictSyntax) {
    warn(`Sintaxis no verificada por bloqueo del sandbox en ${relativeFile}. Ejecutar con EPIVIDA_STRICT_SYNTAX=1 en CI.`);
    return;
  }

  if (result.error || result.status !== 0) {
    fail(`Sintaxis invalida en ${relativeFile}\n${result.error?.message || result.stderr || result.stdout || `status ${result.status}`}`);
  }
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) fail(`Falta ${file}`);
}

for (const file of walk(join(root, "src")).filter(file => extname(file) === ".js")) {
  checkSyntax(file);
}

for (const file of [
  join(root, "epivida-lite-config.js"),
  join(root, "epivida-lite-sw.js"),
  join(root, "tools/validate-migration-package.mjs")
]) {
  if (!existsSync(file)) continue;
  checkSyntax(file);
}

for (const file of walk(join(root, "src")).filter(file => extname(file) === ".js")) {
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (text.includes(pattern)) fail(`Patron prohibido "${pattern}" en ${relative(repoRoot, file)}`);
  }
}

for (const file of [join(root, "firebase/firestore.indexes.json"), join(repoRoot, "firebase.json")]) {
  try {
    JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`JSON invalido en ${relative(repoRoot, file)}: ${error.message}`);
  }
}

const headers = readFileSync(join(root, "_headers"), "utf8");
for (const expected of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
  if (!headers.includes(expected)) fail(`Falta header ${expected} en lite/_headers`);
}

if (failures.length) {
  console.error(`EPIVIDA Lite validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

if (warnings.length) {
  console.warn(`EPIVIDA Lite validation warnings (${warnings.length})`);
  warnings.forEach(item => console.warn(`- ${item}`));
}

console.log("EPIVIDA Lite validation OK");

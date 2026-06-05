import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
const budgets = {
  indexHtmlBytes: 15_000,
  initialCssBytes: 50_000,
  initialJsBytes: 15_000,
  maxInitialStylesheets: 1,
  maxInitialScripts: 2
};

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

function getAttr(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? match[1] : "";
}

function htmlTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>`, "gi"))].map(match => match[1]);
}

function assertBudget(label, actual, limit) {
  if (actual > limit) fail(`${label} excede presupuesto: ${actual} bytes > ${limit} bytes`);
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

const indexFile = join(root, "index.html");
const indexHtml = readFileSync(indexFile, "utf8");
assertBudget("lite/index.html", statSync(indexFile).size, budgets.indexHtmlBytes);

for (const pattern of forbidden) {
  if (indexHtml.includes(pattern)) fail(`Patron prohibido "${pattern}" en lite/index.html`);
}

const initialScripts = htmlTags(indexHtml, "script").map(attrs => ({
  attrs,
  src: getAttr(attrs, "src"),
  type: getAttr(attrs, "type")
}));
const initialStylesheets = htmlTags(indexHtml, "link")
  .filter(attrs => getAttr(attrs, "rel").toLowerCase() === "stylesheet")
  .map(attrs => getAttr(attrs, "href"));

if (initialScripts.length > budgets.maxInitialScripts) {
  fail(`lite/index.html carga ${initialScripts.length} scripts iniciales; maximo ${budgets.maxInitialScripts}`);
}

if (initialStylesheets.length > budgets.maxInitialStylesheets) {
  fail(`lite/index.html carga ${initialStylesheets.length} hojas CSS iniciales; maximo ${budgets.maxInitialStylesheets}`);
}

const scriptSources = initialScripts.map(script => script.src);
for (const src of scriptSources) {
  if (!["./epivida-lite-config.js", "./src/main.js"].includes(src)) {
    fail(`Script inicial no permitido en lite/index.html: ${src || "inline"}`);
  }
}

if (!initialScripts.some(script => script.src === "./src/main.js" && script.type === "module")) {
  fail("lite/index.html debe cargar ./src/main.js como script type=module");
}

if (initialStylesheets.length !== 1 || initialStylesheets[0] !== "./src/styles/base.css") {
  fail("lite/index.html debe cargar solo ./src/styles/base.css como CSS inicial");
}

const initialJsBytes = ["epivida-lite-config.js", "src/main.js"]
  .map(file => statSync(join(root, file)).size)
  .reduce((sum, size) => sum + size, 0);
assertBudget("JS inicial de EPIVIDA Lite", initialJsBytes, budgets.initialJsBytes);
assertBudget("CSS inicial de EPIVIDA Lite", statSync(join(root, "src/styles/base.css")).size, budgets.initialCssBytes);

const routerSource = readFileSync(join(root, "src/router.js"), "utf8");
if (!routerSource.includes('app.state.auth.status !== "ready"') || !routerSource.includes("canAccessRoute(route.key")) {
  fail("src/router.js debe validar auth ready y rol antes de importar modulos clinicos.");
}

const deviceServiceSource = readFileSync(join(root, "src/services/deviceService.js"), "utf8");
if (!deviceServiceSource.includes("function activeDevice") || !deviceServiceSource.includes("filter(activeDevice)")) {
  fail("deviceService debe filtrar dispositivos activos tanto desde Firestore como desde cache/cola offline.");
}

const iaasServiceSource = readFileSync(join(root, "src/services/iaasService.js"), "utf8");
if (!iaasServiceSource.includes("function activeIaas") || !iaasServiceSource.includes("filter(activeIaas)")) {
  fail("iaasService debe filtrar IAAS activas tanto desde Firestore como desde cache/cola offline.");
}

const offlineQueueSource = readFileSync(join(root, "src/services/offlineQueueService.js"), "utf8");
if (!offlineQueueSource.includes("function retryableSyncError") || !offlineQueueSource.includes("sync_blocked")) {
  fail("offlineQueueService debe separar errores reintentables de errores bloqueados por reglas/permisos.");
}
if (!offlineQueueSource.includes('item.status === "local_pending"')) {
  fail("offlineQueueService solo debe mezclar en UI clinica escrituras local_pending.");
}

for (const file of walk(join(root, "src")).filter(file => extname(file) === ".js")) {
  checkSyntax(file);
}

for (const file of [
  join(root, "epivida-lite-config.js"),
  join(root, "epivida-lite-sw.js"),
  join(root, "tools/prepare-user-seed.mjs"),
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

for (const file of [join(root, "firebase/firestore.indexes.json"), join(root, "firebase/users.seed.example.json"), join(repoRoot, "firebase.json"), join(repoRoot, "package.json")]) {
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

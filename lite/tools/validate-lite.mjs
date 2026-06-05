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
  maxRouteModuleBytes: 15_000,
  roundRouteModuleBytes: 90_000,
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

for (const file of walk(join(root, "src/modules")).filter(file => file.endsWith("index.js"))) {
  const relativeFile = relative(root, file).replaceAll("\\", "/");
  const size = statSync(file).size;
  const limit = relativeFile === "src/modules/ronda-paquetes/index.js"
    ? budgets.roundRouteModuleBytes
    : budgets.maxRouteModuleBytes;
  assertBudget(`Modulo de ruta ${relativeFile}`, size, limit);
}

const routerSource = readFileSync(join(root, "src/router.js"), "utf8");
if (!routerSource.includes('app.state.auth.status !== "ready"') || !routerSource.includes("canAccessRoute(route.key")) {
  fail("src/router.js debe validar auth ready y rol antes de importar modulos clinicos.");
}
if (!routerSource.includes("export function preloadRoute") || !routerSource.includes("routePreloads")) {
  fail("src/router.js debe precargar modulos de ruta con cache sin ejecutar datos clinicos.");
}

const firebaseSource = readFileSync(join(root, "src/lib/firebase.js"), "utf8");
const authServiceSource = readFileSync(join(root, "src/services/authService.js"), "utf8");
const firestoreServiceSource = readFileSync(join(root, "src/services/firestoreService.js"), "utf8");
if (!firebaseSource.includes("firebaseAuthRuntime") || !firebaseSource.includes("firebaseFirestoreRuntime")) {
  fail("src/lib/firebase.js debe separar runtime de Auth y Firestore para aligerar el arranque.");
}
if (!authServiceSource.includes("firebaseAuthRuntime") || authServiceSource.includes("firebaseRuntime")) {
  fail("authService debe usar firebaseAuthRuntime sin cargar Firestore al iniciar sesion.");
}
if (!firestoreServiceSource.includes("firebaseFirestoreRuntime")) {
  fail("firestoreService debe usar firebaseFirestoreRuntime para cargar Firestore solo cuando se consulta datos.");
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
if (!offlineQueueSource.includes("queueBlockedWrite")) {
  fail("offlineQueueService debe registrar bloqueos iniciales como sync_blocked visibles en Admin.");
}
if (!offlineQueueSource.includes("clearBlockedWrites") || !offlineQueueSource.includes('item.status !== "sync_blocked"')) {
  fail("offlineQueueService debe permitir limpiar solo sync_blocked sin descartar escrituras local_pending.");
}
if (!offlineQueueSource.includes('item.status === "local_pending"')) {
  fail("offlineQueueService solo debe mezclar en UI clinica escrituras local_pending.");
}

const testDataSource = readFileSync(join(root, "src/services/testDataService.js"), "utf8");
for (const expected of ["p_uci_02", "p_history", "testDataEnabled", "appConfig().testMode"]) {
  if (!testDataSource.includes(expected)) {
    fail("testDataService debe proveer datos sinteticos solo en epividaTest para QA local de ronda.");
  }
}
const patientServiceSource = readFileSync(join(root, "src/services/patientService.js"), "utf8");
const roundServiceSource = readFileSync(join(root, "src/services/roundService.js"), "utf8");
if (!patientServiceSource.includes("testActivePatients") || !roundServiceSource.includes("testRoundsForPatient")) {
  fail("Servicios clinicos deben mezclar datos sinteticos de QA solo en modo local de prueba.");
}
if (!patientServiceSource.includes("patientFilterTextCache") || !patientServiceSource.includes("export function patientFilterText")) {
  fail("patientService debe cachear texto de busqueda local para censo/monitoreo.");
}
if (!patientServiceSource.includes("activePatientsPromise") || !deviceServiceSource.includes("activeDevicesPromise") || !iaasServiceSource.includes("activeIaasPromise") || !roundServiceSource.includes("todayRoundsPromises")) {
  fail("Servicios clinicos deben deduplicar lecturas Firestore en vuelo para evitar consultas repetidas entre modulos.");
}

const appSource = readFileSync(join(root, "src/app.js"), "utf8");
if (!appSource.includes("unhandledrejection") || !appSource.includes("runtimeError")) {
  fail("src/app.js debe mostrar errores async de acciones clinicas en el shell.");
}
if (!appSource.includes("preloadRoute") || !appSource.includes("onpointerenter") || !appSource.includes("onfocus")) {
  fail("src/app.js debe precargar modulos permitidos en hover/focus de navegacion.");
}

const domSource = readFileSync(join(root, "src/components/dom.js"), "utf8");
if (!domSource.includes("frameScheduler") || !domSource.includes("requestAnimationFrame")) {
  fail("components/dom.js debe exponer frameScheduler para coalescer redibujos clinicos.");
}
if (!domSource.includes("large-table") || !domSource.includes("rows.length > 40")) {
  fail("components/dom.js debe marcar tablas clinicas grandes para optimizar renderizado.");
}
for (const file of ["src/modules/censo/index.js", "src/modules/monitoreo/index.js", "src/modules/ronda-paquetes/index.js"]) {
  const source = readFileSync(join(root, file), "utf8");
  if (!source.includes("frameScheduler") || !source.includes("scheduleRedraw")) {
    fail(`${file} debe coalescer busquedas locales con frameScheduler.`);
  }
}

const cacheSource = readFileSync(join(root, "src/lib/cache.js"), "utf8");
if (!cacheSource.includes("let dbPromise") || !cacheSource.includes("if (dbPromise) return dbPromise")) {
  fail("src/lib/cache.js debe reutilizar la conexion IndexedDB para evitar aperturas repetidas.");
}

const cssSource = readFileSync(join(root, "src/styles/base.css"), "utf8");
if (!cssSource.includes("content-visibility: auto") || !cssSource.includes(".round-list > .round-card")) {
  fail("src/styles/base.css debe proteger listas clinicas largas con content-visibility.");
}
if (!cssSource.includes(".large-table tbody tr") || !cssSource.includes("contain-intrinsic-size: 44px")) {
  fail("src/styles/base.css debe proteger filas de tablas clinicas grandes con contencion de render.");
}

const exportServiceSource = readFileSync(join(root, "src/services/exportService.js"), "utf8");
if (!exportServiceSource.includes("CSV_FORMULA_PREFIX") || !exportServiceSource.includes("JSON.stringify(value)") || !exportServiceSource.includes("\\uFEFF")) {
  fail("exportService debe proteger CSV contra formulas, objetos anidados y compatibilidad UTF-8.");
}

const serviceWorkerSource = readFileSync(join(root, "epivida-lite-sw.js"), "utf8");
const coreMatch = serviceWorkerSource.match(/const CORE = \[(.*?)\];/s);
if (!coreMatch || coreMatch[1].includes("epivida-lite-config.js")) {
  fail("epivida-lite-sw.js no debe precachear epivida-lite-config.js.");
}
if (!serviceWorkerSource.includes("NEVER_CACHE") || !serviceWorkerSource.includes("/epivida-lite-config.js")) {
  fail("epivida-lite-sw.js debe excluir epivida-lite-config.js de cache runtime.");
}
if (!serviceWorkerSource.includes("cacheFirstWithRefresh") || !serviceWorkerSource.includes("shouldRuntimeCache") || !serviceWorkerSource.includes("RUNTIME_DESTINATIONS")) {
  fail("epivida-lite-sw.js debe cachear modulos dinamicos de ruta en runtime para acelerar navegacion movil/offline.");
}

const workflowFile = join(repoRoot, ".github/workflows/epivida-lite-validate.yml");
if (!existsSync(workflowFile)) {
  fail("Falta workflow GitHub Actions para validar EPIVIDA Lite.");
} else {
  const workflowSource = readFileSync(workflowFile, "utf8");
  if (!workflowSource.includes("EPIVIDA_STRICT_SYNTAX") || !workflowSource.includes("node lite/tools/validate-all.mjs")) {
    fail("El workflow de EPIVIDA Lite debe ejecutar validate-all en modo estricto.");
  }
}

for (const file of walk(join(root, "src")).filter(file => extname(file) === ".js")) {
  checkSyntax(file);
}

for (const file of [
  join(root, "epivida-lite-config.js"),
  join(root, "epivida-lite-sw.js"),
  join(root, "tools/prepare-user-seed.mjs"),
  join(root, "tools/validate-all.mjs"),
  join(root, "tools/validate-deploy-config.mjs"),
  join(root, "tools/validate-local-qa.mjs"),
  join(root, "tools/validate-offline-queue.mjs"),
  join(root, "tools/validate-patient-filters.mjs"),
  join(root, "tools/validate-round-helpers.mjs"),
  join(root, "tools/validate-security-config.mjs"),
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

const packageSource = readFileSync(join(repoRoot, "package.json"), "utf8");
if (!packageSource.includes('"validate"') || !packageSource.includes("validate-all.mjs")) {
  fail("package.json debe exponer validate para el preflight completo.");
}
if (!packageSource.includes("validate:lite:qa") || !packageSource.includes("validate-local-qa.mjs")) {
  fail("package.json debe exponer validate:lite:qa para fixtures locales de ronda.");
}
if (!packageSource.includes("validate:deploy") || !packageSource.includes("validate-deploy-config.mjs")) {
  fail("package.json debe exponer validate:deploy para Cloudflare/Firebase.");
}
if (!packageSource.includes("validate:security") || !packageSource.includes("validate-security-config.mjs")) {
  fail("package.json debe exponer validate:security para reglas y roles.");
}
if (!packageSource.includes("validate:offline") || !packageSource.includes("validate-offline-queue.mjs")) {
  fail("package.json debe exponer validate:offline para cola offline.");
}
if (!packageSource.includes("validate:round") || !packageSource.includes("validate-round-helpers.mjs")) {
  fail("package.json debe exponer validate:round para filtros y mapa de camas de ronda.");
}
if (!packageSource.includes("validate:patients") || !packageSource.includes("validate-patient-filters.mjs")) {
  fail("package.json debe exponer validate:patients para filtros de censo/monitoreo.");
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

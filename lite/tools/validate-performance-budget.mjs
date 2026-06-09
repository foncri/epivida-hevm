import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const repoRoot = resolve(root, "..");
const failures = [];
const budgets = {
  indexHtmlBytes: 15_000,
  initialCssBytes: 50_000,
  initialJsBytes: 15_000,
  maxInitialScripts: 2,
  maxInitialStylesheets: 1,
  maxRouteModuleBytes: 18_000,
  roundRouteModuleBytes: 90_000
};

function fail(message) {
  failures.push(message);
}

function htmlTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>`, "gi"))].map(match => match[1]);
}

function attr(attrs, name) {
  return attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] || "";
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function assertBudget(label, actual, limit) {
  if (actual > limit) fail(`${label} excede presupuesto: ${actual} bytes > ${limit} bytes.`);
}

const indexPath = join(root, "index.html");
const index = readFileSync(indexPath, "utf8");
assertBudget("lite/index.html", statSync(indexPath).size, budgets.indexHtmlBytes);

const scripts = htmlTags(index, "script").map(attrs => ({ src: attr(attrs, "src"), type: attr(attrs, "type") }));
const styles = htmlTags(index, "link")
  .filter(attrs => attr(attrs, "rel").toLowerCase() === "stylesheet")
  .map(attrs => attr(attrs, "href"));

if (scripts.length > budgets.maxInitialScripts) fail(`Scripts iniciales: ${scripts.length} > ${budgets.maxInitialScripts}.`);
if (styles.length > budgets.maxInitialStylesheets) fail(`CSS iniciales: ${styles.length} > ${budgets.maxInitialStylesheets}.`);
if (!scripts.some(script => script.src === "./src/main.js" && script.type === "module")) {
  fail("src/main.js debe ser script type=module inicial.");
}
if (styles.join(",") !== "./src/styles/base.css") {
  fail("El unico CSS inicial debe ser ./src/styles/base.css.");
}

const initialJsBytes = ["epivida-lite-config.js", "src/main.js"]
  .map(file => statSync(join(root, file)).size)
  .reduce((sum, size) => sum + size, 0);
assertBudget("JS inicial", initialJsBytes, budgets.initialJsBytes);
assertBudget("CSS inicial", statSync(join(root, "src/styles/base.css")).size, budgets.initialCssBytes);

for (const file of walk(join(root, "src/modules")).filter(file => file.endsWith("index.js"))) {
  const relativeFile = relative(root, file).replaceAll("\\", "/");
  const limit = relativeFile === "src/modules/ronda-paquetes/index.js"
    ? budgets.roundRouteModuleBytes
    : budgets.maxRouteModuleBytes;
  assertBudget(`Modulo ${relativeFile}`, statSync(file).size, limit);
}

const main = readFileSync(join(root, "src/main.js"), "utf8");
if (!main.includes('import("./services/authService.js")') || !main.includes('import("./lib/pwa.js")')) {
  fail("main.js debe diferir Auth y PWA con imports dinamicos.");
}

const app = readFileSync(join(root, "src/app.js"), "utf8");
if (!app.includes("HEAVY_PRELOAD_ROUTES") || !app.includes('"ronda-paquetes"') || !app.includes("requestIdleCallback")) {
  fail("app.js debe diferir rutas pesadas como ronda-paquetes hasta idle.");
}

const sw = readFileSync(join(root, "epivida-lite-sw.js"), "utf8");
if (!sw.includes("const APP_VERSION") || !sw.includes("cacheFirstWithRefresh") || sw.includes('"./epivida-lite-config.js"')) {
  fail("Service worker debe versionar cache, refrescar modulos visitados y excluir config.");
}

for (const file of [join(root, "src/modules/monitoreo/index.js"), join(root, "src/modules/censo/index.js")]) {
  if (!existsSync(file)) continue;
  const source = readFileSync(file, "utf8");
  if (!source.includes("pagedTable") || !source.includes("frameScheduler")) {
    fail(`${relative(repoRoot, file)} debe usar pagedTable y frameScheduler.`);
  }
}

if (failures.length) {
  console.error(`EPIVIDA Lite performance budget validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite performance budget validation OK");

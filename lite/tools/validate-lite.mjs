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

const mainSource = readFileSync(join(root, "src/main.js"), "utf8");
if (
  mainSource.includes('from "./services/authService.js"') ||
  mainSource.includes('from "./lib/pwa.js"') ||
  mainSource.includes("import { initAuthState }") ||
  mainSource.includes("import { registerLiteServiceWorker }")
) {
  fail("src/main.js debe diferir authService y PWA con imports dinamicos fuera del grafo inicial.");
}
if (
  !mainSource.includes('import("./services/authService.js")') ||
  !mainSource.includes('import("./lib/pwa.js")') ||
  !mainSource.includes("requestAnimationFrame")
) {
  fail("src/main.js debe iniciar auth/PWA despues del primer frame para acelerar el pintado inicial.");
}

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
if (!routerSource.includes('"importar-censo": () => import("./modules/importar-censo/index.js")')) {
  fail("src/router.js debe cargar importar-censo como modulo dinamico propio, no como alias a Admin.");
}
if (!routerSource.includes("export function preloadRoute") || !routerSource.includes("routePreloads")) {
  fail("src/router.js debe precargar modulos de ruta con cache sin ejecutar datos clinicos.");
}

const firebaseSource = readFileSync(join(root, "src/lib/firebase.js"), "utf8");
const authServiceSource = readFileSync(join(root, "src/services/authService.js"), "utf8");
const firestoreServiceSource = readFileSync(join(root, "src/services/firestoreService.js"), "utf8");
const dateSource = readFileSync(join(root, "src/lib/date.js"), "utf8");
if (!dateSource.includes("export function validIsoDate") || !dateSource.includes('parsed.toISOString().slice(0, 10) === text') || !dateSource.includes("validIsoDate(text) ? text : \"\"")) {
  fail("src/lib/date.js debe validar fechas ISO reales y rechazar rutas con fechas imposibles.");
}
if (!firebaseSource.includes("firebaseAuthRuntime") || !firebaseSource.includes("firebaseFirestoreRuntime")) {
  fail("src/lib/firebase.js debe separar runtime de Auth y Firestore para aligerar el arranque.");
}
if (!authServiceSource.includes("firebaseAuthRuntime") || authServiceSource.includes("firebaseRuntime")) {
  fail("authService debe usar firebaseAuthRuntime sin cargar Firestore al iniciar sesion.");
}
if (!firestoreServiceSource.includes("firebaseFirestoreRuntime")) {
  fail("firestoreService debe usar firebaseFirestoreRuntime para cargar Firestore solo cuando se consulta datos.");
}
if (!firestoreServiceSource.includes("readPromises") || !firestoreServiceSource.includes("readOnce") || !firestoreServiceSource.includes("readPromises.delete(key)") || !firestoreServiceSource.includes("invalidateReadsForPath")) {
  fail("firestoreService debe deduplicar lecturas Firestore concurrentes sin cache persistente de datos clinicos.");
}

const deviceServiceSource = readFileSync(join(root, "src/services/deviceService.js"), "utf8");
if (!deviceServiceSource.includes("function activeDevice") || !deviceServiceSource.includes("filter(activeDevice)")) {
  fail("deviceService debe filtrar dispositivos activos tanto desde Firestore como desde cache/cola offline.");
}
if (!deviceServiceSource.includes("devices_archive/${device.episodeId}") || !deviceServiceSource.includes("archivedAt") || !deviceServiceSource.includes("archiveSyncStatus")) {
  fail("deviceService debe archivar episodios retirados en devices_archive sin borrar historial clinico.");
}
if (!deviceServiceSource.includes("export async function listArchivedDevicesForPatient") || !deviceServiceSource.includes('"devices_archive", [["patientId", "==", patientId]]') || !deviceServiceSource.includes('orderBy: [["removalDate", "desc"]]') || !deviceServiceSource.includes('pendingPayloadsForCollection("devices_archive")')) {
  fail("deviceService debe leer devices_archive solo por patientId, con limite/orden y cola offline.");
}
if (!deviceServiceSource.includes("device_reinstallation_create") || !deviceServiceSource.includes("payload.isReinstallation")) {
  fail("deviceService debe auditar reinstalaciones como episodios nuevos, no como reactivacion de historicos.");
}

const iaasServiceSource = readFileSync(join(root, "src/services/iaasService.js"), "utf8");
if (!iaasServiceSource.includes("function activeIaas") || !iaasServiceSource.includes("filter(activeIaas)")) {
  fail("iaasService debe filtrar IAAS activas tanto desde Firestore como desde cache/cola offline.");
}
if (!iaasServiceSource.includes("vitalFio2") || !iaasServiceSource.includes("previousVitals.fio2") || !iaasServiceSource.includes("vitalPeep") || !iaasServiceSource.includes("previousVitals.peep")) {
  fail("iaasService debe conservar campos de ventilacion FiO2/PEEP del seguimiento IAAS legacy.");
}
const opdServiceSource = readFileSync(join(root, "src/services/opdService.js"), "utf8");
if (!opdServiceSource.includes("export function opdEligibilityForPatient") || !opdServiceSource.includes("export function opdEligibilityForIaasCase") || !opdServiceSource.includes("opdRequiredMissing") || !opdServiceSource.includes("opdFromFormData") || !opdServiceSource.includes("MORBIMORTALIDAD")) {
  fail("opdService debe migrar OPD legacy como servicio puro para vigilancia e IAAS, sin loader ni eval.");
}
const cultureServiceSource = readFileSync(join(root, "src/services/cultureService.js"), "utf8");
const legacyClinicalCatalogsSource = readFileSync(join(root, "src/services/legacyClinicalCatalogs.js"), "utf8");
for (const expected of ["ABACAVIR", "AMOXICILINA/ACIDO CLAVULANICO", "CEFTAZIDIMA/AVIBACTAM", "PIPERACILINA/TAZOBACTAM", "VANCOMICINA", "OTRO FARMACO", "Coproparasitoscopico", "Otro cultivo"]) {
  if (!legacyClinicalCatalogsSource.includes(expected)) {
    fail("legacyClinicalCatalogs debe conservar catalogos clinicos del loader IAAS followup legacy.");
  }
}
if (!cultureServiceSource.includes("export async function listCulturesForPatient") || !cultureServiceSource.includes('"cultures", [["patientId", "==", patientId]]') || !cultureServiceSource.includes("pendingPayloadsForCollection(\"cultures\")") || !cultureServiceSource.includes("export async function saveCulture")) {
  fail("cultureService debe consultar cultivos por paciente/caso y mezclar cola offline sin lecturas globales.");
}
const antimicrobialServiceSource = readFileSync(join(root, "src/services/antimicrobialService.js"), "utf8");
if (!antimicrobialServiceSource.includes("export async function listAntimicrobialsForPatient") || !antimicrobialServiceSource.includes('"antimicrobials", [["patientId", "==", patientId]]') || !antimicrobialServiceSource.includes("pendingPayloadsForCollection(\"antimicrobials\")") || !antimicrobialServiceSource.includes("export async function saveAntimicrobial")) {
  fail("antimicrobialService debe consultar antimicrobianos por paciente/caso y mezclar cola offline sin lecturas globales.");
}
const preventiveCedulaServiceSource = readFileSync(join(root, "src/services/preventiveCedulaService.js"), "utf8");
for (const expected of ["PREVENTIVE_CEDULA_SPECS", "ITS - CC", "ITU - CU", "NAVM", "ISQ", "P.E. Y P.B.M.T.", "preventiveCedulaCsvRows", "preventiveMonthlyCsvRows", "preventiveCedulaSummaryRow", "listTodayRounds"]) {
  if (!preventiveCedulaServiceSource.includes(expected)) {
    fail("preventiveCedulaService debe migrar cedulas preventivas diarias y mensuales desde rondas guardadas.");
  }
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
if (!offlineQueueSource.includes("queueReadPromise") || !offlineQueueSource.includes("queueSnapshot") || !offlineQueueSource.includes("QUEUE_SNAPSHOT_TTL_MS") || !offlineQueueSource.includes("queueVersion += 1")) {
  fail("offlineQueueService debe deduplicar lecturas IndexedDB de la cola offline y refrescar cache al escribir.");
}

const testDataSource = readFileSync(join(root, "src/services/testDataService.js"), "utf8");
for (const expected of ["p_uci_02", "p_history", "testDataEnabled", "appConfig().testMode"]) {
  if (!testDataSource.includes(expected)) {
    fail("testDataService debe proveer datos sinteticos solo en epividaTest para QA local de ronda.");
  }
}
const patientServiceSource = readFileSync(join(root, "src/services/patientService.js"), "utf8");
const monitorServiceSource = readFileSync(join(root, "src/services/monitorService.js"), "utf8");
const roundServiceSource = readFileSync(join(root, "src/services/roundService.js"), "utf8");
const expedienteServiceSource = readFileSync(join(root, "src/services/expedienteService.js"), "utf8");
const iaasCriteriaServiceSource = readFileSync(join(root, "src/services/iaasCriteriaService.js"), "utf8");
if (!patientServiceSource.includes("testActivePatients") || !roundServiceSource.includes("testRoundsForPatient")) {
  fail("Servicios clinicos deben mezclar datos sinteticos de QA solo en modo local de prueba.");
}
if (!patientServiceSource.includes("patientFilterTextCache") || !patientServiceSource.includes("export function patientFilterText")) {
  fail("patientService debe cachear texto de busqueda local para censo/monitoreo.");
}
if (!monitorServiceSource.includes("export function monitorMetrics") || !monitorServiceSource.includes("export function monitorDiagnosisGroup") || !monitorServiceSource.includes("visibleMonitorPatients") || !monitorServiceSource.includes("riesgo_iaas") || !monitorServiceSource.includes("no_iaas")) {
  fail("monitorService debe centralizar metricas/filtros de monitoreo sin lecturas historicas.");
}
if (!monitorServiceSource.includes("monitorOpdStatus") || !monitorServiceSource.includes("opdPending") || !monitorServiceSource.includes("opdEligibilityForPatient")) {
  fail("monitorService debe mostrar pendientes OPD derivados localmente, sin consultas adicionales.");
}
if (!patientServiceSource.includes("activePatientsPromise") || !deviceServiceSource.includes("activeDevicesPromise") || !deviceServiceSource.includes("devicePatientPromises") || !iaasServiceSource.includes("activeIaasPromise") || !iaasServiceSource.includes("patientIaasPromises") || !roundServiceSource.includes("todayRoundsPromises") || !roundServiceSource.includes("patientRoundsPromises") || !roundServiceSource.includes("roundSessionPromises")) {
  fail("Servicios clinicos deben deduplicar lecturas Firestore en vuelo para evitar consultas repetidas entre modulos.");
}
if (!roundServiceSource.includes("ROUND_HISTORY_LIMIT") || !roundServiceSource.includes('"nursing_rounds", [["patientId", "==", patientId]]') || !roundServiceSource.includes('orderBy: [["date", "desc"]]') || !roundServiceSource.includes("mergePendingForPatient(patientId") || !roundServiceSource.includes(".slice(0, pageSize)")) {
  fail("roundService debe leer historial de ronda por paciente con limite, orden descendente e indice patientId+date.");
}
if (!patientServiceSource.includes("export async function getPatientById") || !patientServiceSource.includes("getDocData(`patients_active/${patientId}`)") || !patientServiceSource.includes("getDocData(`patients_archive/${patientId}`)") || !patientServiceSource.includes('pendingPayloadsForCollection("patients_archive")')) {
  fail("patientService debe leer expediente por ID sin listar todos los pacientes activos y mezclando pendientes de archivo.");
}
if (!iaasServiceSource.includes("export async function listIaasForPatient") || !iaasServiceSource.includes('["patientId", "==", patientId]') || !iaasServiceSource.includes('["active", "==", true]')) {
  fail("iaasService debe exponer lectura IAAS filtrada por paciente para expediente.");
}
if (!iaasServiceSource.includes("patientClassificationForIaasStatus") || !iaasServiceSource.includes("syncPatientClassificationFromIaas") || !iaasServiceSource.includes("patientClassificationSyncStatus")) {
  fail("iaasService debe sincronizar clasificacion IAAS/riesgo/no IAAS hacia patients_active al guardar seguimiento.");
}
if (!patientServiceSource.includes("syncPatientIaasClassification") || !patientServiceSource.includes("patient_iaas_classification_sync") || !patientServiceSource.includes("currentEpidemiologicalDiagnosis")) {
  fail("patientService debe exponer sincronizacion auditada de clasificacion epidemiologica desde IAAS.");
}
if (!iaasServiceSource.includes("export function normalizeIaasClinicalFollowUp") || !iaasServiceSource.includes("vitalSigns") || !iaasServiceSource.includes("biometry") || !iaasServiceSource.includes("carePlan")) {
  fail("iaasService debe normalizar seguimiento IAAS clinico estructurado: criterios, vitales, labs y plan.");
}
if (!iaasServiceSource.includes("normalizeIaasCustomStudies") || !iaasServiceSource.includes("summarizeIaasCustomStudies") || !iaasServiceSource.includes("customStudiesFromText")) {
  fail("iaasService debe migrar Otros estudios del followup legacy como lista estructurada nombre/valor.");
}
if (!iaasCriteriaServiceSource.includes("IAAS_CRITERIA_VERSION") || !iaasCriteriaServiceSource.includes("buildCriteriaTemplate") || !iaasCriteriaServiceSource.includes("criteriaVersionForType") || !iaasCriteriaServiceSource.includes('"ITS - CC"') || !iaasCriteriaServiceSource.includes('"ITU - CU"') || !iaasCriteriaServiceSource.includes("NAVM") || !iaasCriteriaServiceSource.includes("ISQ")) {
  fail("iaasCriteriaService debe exponer cedulas IAAS versionadas sin cargar runtime legacy.");
}
if (expedienteServiceSource.includes("listActivePatients") || expedienteServiceSource.includes("listActiveIaas")) {
  fail("expedienteService no debe listar pacientes o IAAS globales al abrir un expediente.");
}
if (!expedienteServiceSource.includes("export async function loadPatientExpediente") || !expedienteServiceSource.includes("export async function loadExpedienteSectionPage") || !expedienteServiceSource.includes("getPatientById(patientId)") || !expedienteServiceSource.includes("pageIaasForPatient") || !expedienteServiceSource.includes("pageArchivedDevicesForPatient") || !expedienteServiceSource.includes("pageRoundsForPatient") || !expedienteServiceSource.includes("pageCulturesForPatient") || !expedienteServiceSource.includes("pageAntimicrobialsForPatient") || !expedienteServiceSource.includes("pageAuditForPatient") || !expedienteServiceSource.includes("mergeDeviceHistory") || !expedienteServiceSource.includes("DEVICE_HISTORY_LIMIT") || !expedienteServiceSource.includes("CLINICAL_HISTORY_LIMIT") || !expedienteServiceSource.includes("pageMeta")) {
  fail("expedienteService debe cargar expediente por paciente y mezclar dispositivos/cultivos/antimicrobianos con limites.");
}

const appSource = readFileSync(join(root, "src/app.js"), "utf8");
if (!appSource.includes("unhandledrejection") || !appSource.includes("runtimeError")) {
  fail("src/app.js debe mostrar errores async de acciones clinicas en el shell.");
}
if (!appSource.includes("preloadRoute") || !appSource.includes("onpointerenter") || !appSource.includes("onfocus")) {
  fail("src/app.js debe precargar modulos permitidos en hover/focus de navegacion.");
}
if (!appSource.includes("HEAVY_PRELOAD_ROUTES") || !appSource.includes('"ronda-paquetes"') || !appSource.includes("requestIdleCallback")) {
  fail("src/app.js debe diferir la precarga de rutas pesadas como ronda-paquetes hasta idle.");
}

const expedienteModuleSource = readFileSync(join(root, "src/modules/expediente/index.js"), "utf8");
if (!expedienteModuleSource.includes("loadPatientExpediente") || !expedienteModuleSource.includes("loadExpedienteSectionPage") || !expedienteModuleSource.includes("renderCursorTablePanel") || !expedienteModuleSource.includes("appendUniqueRows") || !expedienteModuleSource.includes("renderAuditTable") || expedienteModuleSource.includes("listDevicesForPatient") || expedienteModuleSource.includes("listActiveIaas") || expedienteModuleSource.includes("listActivePatients") || expedienteModuleSource.includes("listRoundsForPatient")) {
  fail("modules/expediente debe cargar datos por expedienteService para evitar consultas historicas dispersas.");
}
const monitoreoModuleSource = readFileSync(join(root, "src/modules/monitoreo/index.js"), "utf8");
if (!monitoreoModuleSource.includes("monitorStats") || !monitoreoModuleSource.includes("visibleMonitorPatients") || !monitoreoModuleSource.includes("monitorFilterOptions") || monitoreoModuleSource.includes("filterPatients") || monitoreoModuleSource.includes("uniqueValues")) {
  fail("modules/monitoreo debe delegar metricas/filtros a monitorService y conservar una sola lectura de pacientes activos.");
}
if (!monitoreoModuleSource.includes("monitorOpdStatus") || !monitoreoModuleSource.includes('"OPD"')) {
  fail("modules/monitoreo debe exponer estado OPD sin cargar seguimiento IAAS completo.");
}
const censoModuleSource = readFileSync(join(root, "src/modules/censo/index.js"), "utf8");
if (!censoModuleSource.includes("renderOpdFields") || !censoModuleSource.includes("opdFromFormData") || !censoModuleSource.includes("MORBIMORTALIDAD MATERNA/PERINATAL")) {
  fail("modules/censo debe capturar OPD para vigilancia hospitalaria desde el formulario de paciente.");
}
const epiIaasModuleSource = readFileSync(join(root, "src/modules/epi-iaas/index.js"), "utf8");
if (!epiIaasModuleSource.includes("saveLinkedCulture") || !epiIaasModuleSource.includes("saveLinkedAntimicrobial") || !epiIaasModuleSource.includes("saveCulture(app") || !epiIaasModuleSource.includes("saveAntimicrobial(app")) {
  fail("modules/epi-iaas debe permitir registrar cultivo y antimicrobiano asociados al caso sin cargar historicos globales.");
}
if (!epiIaasModuleSource.includes("normalizeIaasClinicalFollowUp(data, iaas)") || !epiIaasModuleSource.includes("iaasTypeOptions") || !epiIaasModuleSource.includes("renderCriteriaGuide") || !epiIaasModuleSource.includes('name: "criteriaVersion"') || !epiIaasModuleSource.includes('name: "criteria"') || !epiIaasModuleSource.includes('name: "biometry"') || !epiIaasModuleSource.includes('name: "carePlan"') || !epiIaasModuleSource.includes('name: "vitalFio2"') || !epiIaasModuleSource.includes('name: "vitalPeep"') || !epiIaasModuleSource.includes("followUpSummary")) {
  fail("modules/epi-iaas debe capturar seguimiento clinico IAAS estructurado sin cargar modulos externos.");
}
if (!epiIaasModuleSource.includes('textareaInput({ name: "otherStudies"') || !expedienteModuleSource.includes("summarizeIaasCustomStudies")) {
  fail("modules/epi-iaas y expediente deben capturar/mostrar Otros estudios del seguimiento legacy.");
}
if (!epiIaasModuleSource.includes("renderOpdFields") || !epiIaasModuleSource.includes("opdEligibilityForIaasCase") || !epiIaasModuleSource.includes("opdFromFormData")) {
  fail("modules/epi-iaas debe capturar OPD para IAAS confirmada sin loader legacy.");
}
const dispositivosModuleSource = readFileSync(join(root, "src/modules/dispositivos/index.js"), "utf8");
const dispositivosFormsSource = readFileSync(join(root, "src/modules/dispositivos/deviceForms.js"), "utf8");
if (!dispositivosModuleSource.includes("reinstallationDraft") || !dispositivosFormsSource.includes("previousEpisodeId") || !dispositivosFormsSource.includes("isReinstallation: true") || !dispositivosFormsSource.includes("saveDeviceEpisode(app")) {
  fail("modules/dispositivos debe exponer reinstalacion guiada como nuevo episodio activo desde historicos.");
}

const domSource = readFileSync(join(root, "src/components/dom.js"), "utf8");
if (!domSource.includes("frameScheduler") || !domSource.includes("requestAnimationFrame")) {
  fail("components/dom.js debe exponer frameScheduler para coalescer redibujos clinicos.");
}
if (!domSource.includes("export function pagedTable") || !domSource.includes("rows.length > 100") || !domSource.includes("pageSize = options.pageSize || 50")) {
  fail("components/dom.js debe paginar tablas clinicas grandes a partir de 100 filas.");
}
for (const file of ["src/modules/censo/index.js", "src/modules/monitoreo/index.js", "src/modules/ronda-paquetes/index.js"]) {
  const source = readFileSync(join(root, file), "utf8");
  if (!source.includes("frameScheduler") || !source.includes("scheduleRedraw")) {
    fail(`${file} debe coalescer busquedas locales con frameScheduler.`);
  }
}
const roundModuleSource = readFileSync(join(root, "src/modules/ronda-paquetes/index.js"), "utf8");
const patientRoundSource = readFileSync(join(root, "src/modules/ronda-paquetes/patientRound.js"), "utf8");
const roundPatientUtilsSource = readFileSync(join(root, "src/modules/ronda-paquetes/roundPatientUtils.js"), "utf8");
const bedBoardSource = readFileSync(join(root, "src/modules/ronda-paquetes/bedBoard.js"), "utf8");
const patientRoundPanelsSource = readFileSync(join(root, "src/modules/ronda-paquetes/patientRoundPanels.js"), "utf8");
const preventiveFormsSource = readFileSync(join(root, "src/modules/ronda-paquetes/preventiveForms.js"), "utf8");
const roundNavigationSource = readFileSync(join(root, "src/modules/ronda-paquetes/roundNavigation.js"), "utf8");
const saveRoundFlowSource = readFileSync(join(root, "src/modules/ronda-paquetes/saveRoundFlow.js"), "utf8");
if (
  roundModuleSource.includes("document.querySelectorAll") ||
  !roundPatientUtilsSource.includes("navigationPatientId(patient, patients = [], direction)") ||
  !roundPatientUtilsSource.includes("bedBoardItems(") ||
  !bedBoardSource.includes("export function renderBedBoard")
) {
  fail("ronda-paquetes debe calcular navegacion por cama desde datos cargados, sin consultar DOM renderizado.");
}
if (
  !roundModuleSource.includes("const { counts, activeCount } = serviceCounts(patients)") ||
  roundModuleSource.includes("function activePatientCount") ||
  roundModuleSource.includes("visiblePatients.filter(isSurgicalSignal)")
) {
  fail("ronda-paquetes debe evitar pasadas repetidas para conteos de filtros y senales ISQ.");
}
if (!saveRoundFlowSource.includes("createdEpisodeTasks") || !saveRoundFlowSource.includes("removalTasks") || !saveRoundFlowSource.includes("patientActionTask") || !saveRoundFlowSource.includes("Promise.all(createdEpisodeTasks)") || !saveRoundFlowSource.includes("activeDeviceById")) {
  fail("ronda-paquetes debe paralelizar escrituras independientes de dispositivos durante el guardado de ronda.");
}
if ((saveRoundFlowSource.match(/activeDeviceById/g) || []).length < 2) {
  fail("ronda-paquetes debe reutilizar mapas por episodeId para validar y guardar retiros sin busquedas lineales repetidas.");
}
if (
  !patientRoundSource.includes('from "./preventiveForms.js"') ||
  roundModuleSource.includes("function renderActiveDevicesPanel") ||
  roundModuleSource.includes("function renderPreventiveActionsPanel") ||
  !preventiveFormsSource.includes("export function renderActiveDevicesPanel") ||
  !preventiveFormsSource.includes("export function renderAddPackagePanel") ||
  !preventiveFormsSource.includes("export function renderPreventiveActionsPanel") ||
  !preventiveFormsSource.includes("ensurePatientActionDraft")
) {
  fail("ronda-paquetes debe mantener formularios preventivos y acciones de paciente en preventiveForms.js, no en el orquestador principal.");
}
if (
  !patientRoundSource.includes('from "./patientRoundPanels.js"') ||
  roundModuleSource.includes("function renderPatientRoundSummary") ||
  roundModuleSource.includes("function renderDailyPreventiveHistoryPanel") ||
  roundModuleSource.includes("function peSummaryItems") ||
  !patientRoundPanelsSource.includes("export function renderPatientRoundSummary") ||
  !patientRoundPanelsSource.includes("export function renderDailyPreventiveHistoryPanel") ||
  !patientRoundPanelsSource.includes("export function upsertRoundById") ||
  !patientRoundPanelsSource.includes("draftFromRound")
) {
  fail("ronda-paquetes debe mantener resumen e historial preventivo de paciente en patientRoundPanels.js.");
}
if (
  !roundModuleSource.includes('from "./patientRound.js"') ||
  roundModuleSource.includes("async function renderPatientRound") ||
  !patientRoundSource.includes("export async function renderPatientRound") ||
  !patientRoundSource.includes("renderRoundSaveBar") ||
  !patientRoundSource.includes("upsertOrRemovePatient")
) {
  fail("ronda-paquetes debe delegar el contenedor de paciente individual a patientRound.js.");
}
if (!deviceServiceSource.includes("export function activeDevice") || !patientRoundSource.includes("patientDevices.filter(activeDevice)") || !patientRoundSource.includes("const [patients, rounds, patientRounds, patientDevices]")) {
  fail("ronda-paquetes debe evitar lecturas globales de dispositivos al abrir la ronda individual de paciente.");
}
if (
  !roundNavigationSource.includes("export function renderRoundSaveBar") ||
  !roundNavigationSource.includes("rows.map(row => ({ bed: patientBed(row), patient: row }))") ||
  roundNavigationSource.includes("const items = bedBoardItems(rows, service);")
) {
  fail("ronda-paquetes debe evitar renderizar camas vacias no navegables en la ronda individual de paciente.");
}

const cacheSource = readFileSync(join(root, "src/lib/cache.js"), "utf8");
if (!cacheSource.includes("let dbPromise") || !cacheSource.includes("if (dbPromise) return dbPromise")) {
  fail("src/lib/cache.js debe reutilizar la conexion IndexedDB para evitar aperturas repetidas.");
}
const snapshotServiceSource = readFileSync(join(root, "src/services/snapshotService.js"), "utf8");
if (!snapshotServiceSource.includes("snapshotPromises") || !snapshotServiceSource.includes("cacheSet(snapshotCacheKey(date)") || !snapshotServiceSource.includes("cacheGet(snapshotCacheKey(date)")) {
  fail("snapshotService debe cachear daily_snapshots por fecha y deduplicar lecturas en vuelo para Inicio.");
}
const catalogServiceSource = readFileSync(join(root, "src/services/catalogService.js"), "utf8");
if (!catalogServiceSource.includes("catalogsPromise") || !catalogServiceSource.includes("cacheSet(CACHE_KEY, rows)") || !catalogServiceSource.includes("cacheGet(CACHE_KEY)")) {
  fail("catalogService debe cachear catalogos y deduplicar lecturas en vuelo.");
}

const cssSource = readFileSync(join(root, "src/styles/base.css"), "utf8");
if (!cssSource.includes("content-visibility: auto") || !cssSource.includes(".round-list > .round-card")) {
  fail("src/styles/base.css debe proteger listas clinicas largas con content-visibility.");
}
if (!cssSource.includes(".large-table tbody tr") || !cssSource.includes("contain-intrinsic-size: 44px")) {
  fail("src/styles/base.css debe proteger filas de tablas clinicas grandes con contencion de render.");
}
if (!cssSource.includes(".bed-board-grid > .bed-tile") || !cssSource.includes("contain-intrinsic-size: 88px 76px") || !cssSource.includes(".preventive-history-day")) {
  fail("src/styles/base.css debe aislar tableros de camas e historial preventivo con content-visibility.");
}

const exportServiceSource = readFileSync(join(root, "src/services/exportService.js"), "utf8");
if (!exportServiceSource.includes("CSV_FORMULA_PREFIX") || !exportServiceSource.includes("JSON.stringify(value)") || !exportServiceSource.includes("\\uFEFF")) {
  fail("exportService debe proteger CSV contra formulas, objetos anidados y compatibilidad UTF-8.");
}
if (!exportServiceSource.includes('addDocOrQueue(app, "exports_log"') || !exportServiceSource.includes('actionType: "export_csv"')) {
  fail("exportService debe registrar audit log y exports_log al exportar CSV.");
}
const reportServiceSource = readFileSync(join(root, "src/services/reportService.js"), "utf8");
const reportesModuleSource = readFileSync(join(root, "src/modules/reportes/index.js"), "utf8");
if (!reportServiceSource.includes("dailySnapshotRowsForRange") || !reportServiceSource.includes("MAX_DAILY_SNAPSHOT_DAYS") || !reportServiceSource.includes("getDocData(`daily_snapshots/${date}`)") || reportServiceSource.includes("listCollection(")) {
  fail("reportService debe exportar rangos desde daily_snapshots acotados, sin listar historicos completos.");
}
if (!reportesModuleSource.includes("dailySnapshotRowsForRange") || !reportesModuleSource.includes("Exportar snapshots CSV") || reportesModuleSource.includes("xlsx") || reportesModuleSource.includes("XLSX")) {
  fail("modules/reportes debe usar reportService bajo demanda y no cargar XLSX.");
}
if (!reportesModuleSource.includes("preventiveCedulaCsvRows") || !reportesModuleSource.includes("preventiveMonthlyCsvRows") || !reportesModuleSource.includes("Exportar cedula diaria CSV")) {
  fail("modules/reportes debe exponer cedulas preventivas legacy como CSV bajo demanda, sin Sheets ni Excel inicial.");
}
const auditServiceSource = readFileSync(join(root, "src/services/auditService.js"), "utf8");
if (!auditServiceSource.includes("export async function listAuditForPatient") || !auditServiceSource.includes('"audit_logs", [["patientId", "==", patientId]]') || !auditServiceSource.includes('orderBy: [["createdAt", "desc"]]') || !auditServiceSource.includes('pendingPayloadsForCollection("audit_logs")')) {
  fail("auditService debe leer auditoria por paciente con limite/orden y cola offline, sin listar audit_logs completo.");
}
if (!auditServiceSource.includes("export async function listRecentAuditLogs") || !auditServiceSource.includes('["module", "==", filters.module]') || !auditServiceSource.includes('["userId", "==", filters.userId]')) {
  fail("auditService debe exponer auditoria reciente filtrada por usuario o modulo, sin lectura global.");
}

const serviceWorkerSource = readFileSync(join(root, "epivida-lite-sw.js"), "utf8");
const coreMatch = serviceWorkerSource.match(/const CORE = \[(.*?)\];/s);
if (!serviceWorkerSource.includes("const APP_VERSION") || !serviceWorkerSource.includes("const CACHE_NAME = `epivida-lite-shell-${APP_VERSION}`")) {
  fail("epivida-lite-sw.js debe versionar cache con APP_VERSION y derivar CACHE_NAME.");
}
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
if (/\/\*\.js[\s\S]*?immutable/.test(headers) || /\/\*\.css[\s\S]*?immutable/.test(headers)) {
  fail("lite/_headers no debe declarar immutable global para JS/CSS sin fingerprint.");
}
if (/\/epivida-lite-config\.js\s*\r?\n(?:[^\n]*\r?\n){0,3}[^\n]*immutable/.test(headers)) {
  fail("epivida-lite-config.js debe permanecer no-cache.");
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

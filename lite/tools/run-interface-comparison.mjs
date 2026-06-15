import { mkdtempSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const outDir = mkdtempSync(join(tmpdir(), "epivida-ui-audit-"));
const timestamp = new Date().toISOString();

function staticServer(directory, port) {
  const proc = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", directory], {
    cwd: repoRoot,
    stdio: "ignore",
    windowsHide: true
  });
  return proc;
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms));
}

function resourceSummary(resources = []) {
  const byType = {};
  let transfer = 0;
  for (const row of resources) {
    byType[row.initiatorType || "other"] = (byType[row.initiatorType || "other"] || 0) + 1;
    transfer += Number(row.transferSize || 0);
  }
  return { count: resources.length, transfer, byType };
}

async function auditPage(browser, scenario) {
  const context = await browser.newContext({
    viewport: scenario.viewport || { width: 1366, height: 768 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  if (scenario.legacyTestMode) {
    await page.addInitScript(forceNoAuth => {
      window.__EPIVIDA_TEST_MODE__ = true;
      if (forceNoAuth) {
        Object.defineProperty(window, "EPIVIDA_REQUIRE_AUTH", {
          configurable: true,
          get() {
            return false;
          },
          set() {}
        });
      }
    }, Boolean(scenario.legacyFullApp));
  }
  const consoleRows = [];
  const pageErrors = [];
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      consoleRows.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", error => pageErrors.push(String(error?.message || error).slice(0, 500)));

  const started = Date.now();
  let loadError = "";
  let responseStatus = null;
  try {
    const response = await page.goto(scenario.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    responseStatus = response?.status() || null;
    if (scenario.legacyFullApp) {
      await page.waitForFunction(() => Boolean(window.__EPIVIDA_AUTH_GATE_TEST__?.loadFullApp), null, { timeout: 10000 });
      await page.evaluate(() => window.__EPIVIDA_AUTH_GATE_TEST__.loadFullApp("ui-audit"));
      await page.waitForTimeout(4200);
    }
    await page.waitForTimeout(scenario.waitMs || 1800);
  } catch (error) {
    loadError = error?.message || String(error);
  }

  if (scenario.interaction === "monitor-search") {
    scenario.interactionResult = { type: "monitor-search", beforeText: "" };
    scenario.interactionResult.beforeText = (await page.locator("body").innerText({ timeout: 5000 })).slice(0, 600);
    const input = page.locator("input[placeholder*='Buscar']").first();
    if (await input.count()) {
      await input.fill("riesgo");
      await page.waitForTimeout(500);
      scenario.interactionResult.afterText = (await page.locator("body").innerText({ timeout: 5000 })).slice(0, 600);
    }
  }
  if (scenario.interaction === "round-open-first-bed") {
    scenario.interactionResult = { type: "round-open-first-bed", beforeUrl: page.url() };
    const bedLinks = page.locator("a.bed-tile[href]");
    const count = await bedLinks.count();
    scenario.interactionResult.bedLinkCount = count;
    if (count > 0) {
      await bedLinks.first().click();
      await page.waitForTimeout(800);
      scenario.interactionResult.afterUrl = page.url();
      scenario.interactionResult.afterText = (await page.locator("body").innerText({ timeout: 5000 })).slice(0, 800);
    }
  }

  const data = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource").map(entry => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize || 0,
      encodedBodySize: entry.encodedBodySize || 0,
      duration: Math.round(entry.duration || 0)
    }));
    const text = document.body?.innerText || "";
    return {
      title: document.title,
      url: location.href,
      textSample: text.slice(0, 1600),
      textLength: text.length,
      scripts: Array.from(document.scripts).map(script => script.src || script.getAttribute("src") || "").filter(Boolean),
      styles: Array.from(document.querySelectorAll("link[rel='stylesheet']")).map(link => link.href || link.getAttribute("href") || "").filter(Boolean),
      resources,
      moduleSignals: {
        hasLogin: /Iniciar sesion|Inicia sesion|Google/i.test(text),
        hasMonitor: /Monitoreo Epidemiologico|Monitoreo Epidemiol/i.test(text),
        hasRonda: /Paquetes Preventivos|Ronda movil|Mapa de camas/i.test(text),
        hasCenso: /Censo hospitalario|Vigilancia Hospitalaria|Censo activo actual/i.test(text),
        hasReports: /Reportes|Exportar snapshots|Reporte diario/i.test(text),
        hasIaas: /Seguimiento IAAS|EPI-IAAS|Cedula/i.test(text),
        hasDispositivos: /Dispositivos|invasivos/i.test(text),
        hasAdmin: /Administracion|Usuarios|Firebase config/i.test(text),
        hasExpediente: /Expediente|Historial/i.test(text),
        has300Patients: /300\s+Pacientes activos|1-50 de 300/i.test(text),
        hasLegacyBrand: /EpiVida IAAS|Vigilancia Hospitalaria/i.test(text)
      },
      badLiteMarkers: resources
        .map(row => row.name)
        .filter(name => /iaas-system|epivida-auth-gate|google\\.script|xlsx|FULL_SCRIPTS|FULL_STYLES/i.test(name))
    };
  });

  const screenshot = join(outDir, `${scenario.id}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();

  const resourceStats = resourceSummary(data.resources);
  return {
    id: scenario.id,
    label: scenario.label,
    url: scenario.url,
    status: responseStatus,
    loadMs: Date.now() - started,
    loadError,
    title: data.title,
    textLength: data.textLength,
    textSample: data.textSample,
    scripts: data.scripts,
    styles: data.styles,
    resources: resourceStats,
    largestResources: data.resources
      .slice()
      .sort((a, b) => (b.transferSize || b.encodedBodySize) - (a.transferSize || a.encodedBodySize))
      .slice(0, 12),
    consoleRows,
    pageErrors,
    interactionResult: scenario.interactionResult || null,
    moduleSignals: data.moduleSignals,
    badLiteMarkers: data.badLiteMarkers,
    screenshot
  };
}

function scoreScenario(result) {
  let score = 100;
  if (result.loadError) score -= 50;
  if (result.pageErrors.length) score -= 20;
  if (result.consoleRows.some(row => row.type === "error")) score -= 15;
  if (result.resources.count > 20) score -= 10;
  if (result.badLiteMarkers.length) score -= 20;
  if (result.loadMs > 5000) score -= 10;
  return Math.max(0, score);
}

const legacyServer = staticServer(repoRoot, 8790);
const liteServer = staticServer(join(repoRoot, "lite"), 8791);

try {
  await sleep(1500);
  const scenarios = [
    {
      id: "legacy-public-auth",
      label: "Legacy public GitHub Pages auth gate",
      url: "https://foncri.github.io/epivida-hevm/index.html#/dashboard"
    },
    {
      id: "lite-public-login",
      label: "Lite public Cloudflare login",
      url: "https://epivida-hevm.pages.dev/?uiAudit=20260615#/login"
    },
    {
      id: "legacy-local-auth",
      label: "Legacy local root auth gate",
      url: "http://127.0.0.1:8790/index.html#/dashboard"
    },
    {
      id: "legacy-local-full-dashboard",
      label: "Legacy local forced full app dashboard",
      url: "http://127.0.0.1:8790/index.html#/dashboard",
      legacyTestMode: true,
      legacyFullApp: true
    },
    {
      id: "legacy-local-full-censo",
      label: "Legacy local forced full app censo",
      url: "http://127.0.0.1:8790/index.html#/censo-hospitalario",
      legacyTestMode: true,
      legacyFullApp: true
    },
    {
      id: "legacy-local-full-ronda",
      label: "Legacy local forced full app ronda",
      url: "http://127.0.0.1:8790/index.html#/ronda",
      legacyTestMode: true,
      legacyFullApp: true
    },
    {
      id: "legacy-local-full-iaas",
      label: "Legacy local forced full app seguimiento IAAS",
      url: "http://127.0.0.1:8790/index.html#/seguimiento-iaas",
      legacyTestMode: true,
      legacyFullApp: true
    },
    {
      id: "legacy-local-full-reportes",
      label: "Legacy local forced full app reporte diario",
      url: "http://127.0.0.1:8790/index.html#/reporte-diario",
      legacyTestMode: true,
      legacyFullApp: true
    },
    {
      id: "lite-local-inicio-300",
      label: "Lite local QA inicio 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/inicio"
    },
    {
      id: "lite-local-censo-300",
      label: "Lite local QA censo 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/censo"
    },
    {
      id: "lite-local-importar-censo-300",
      label: "Lite local QA importar censo 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/importar-censo"
    },
    {
      id: "lite-local-monitor-300",
      label: "Lite local QA monitoreo 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/monitoreo-epidemiologico",
      interaction: "monitor-search"
    },
    {
      id: "lite-local-ronda-300",
      label: "Lite local QA ronda 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/ronda-paquetes",
      interaction: "round-open-first-bed"
    },
    {
      id: "lite-local-epi-iaas-300",
      label: "Lite local QA EPI-IAAS 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/epi-iaas"
    },
    {
      id: "lite-local-dispositivos-300",
      label: "Lite local QA dispositivos 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/dispositivos"
    },
    {
      id: "lite-local-expediente",
      label: "Lite local QA expediente p_history",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/pacientes/p_history/expediente"
    },
    {
      id: "lite-local-reportes-300",
      label: "Lite local QA reportes 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/reportes"
    },
    {
      id: "lite-local-admin-300",
      label: "Lite local QA admin 300 pacientes",
      url: "http://127.0.0.1:8791/?epividaTest=1&seedPatients=300#/admin"
    }
  ];

  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const scenario of scenarios) {
    results.push(await auditPage(browser, scenario));
  }
  await browser.close();

  const report = {
    timestamp,
    outDir,
    browser: "playwright chromium",
    results: results.map(result => ({ ...result, score: scoreScenario(result) })),
    conclusion: {
      litePublicInitialLoadHasNoLegacy: results.find(row => row.id === "lite-public-login")?.badLiteMarkers.length === 0,
      liteLocalMonitorRenders300: Boolean(results.find(row => row.id === "lite-local-monitor-300")?.moduleSignals.has300Patients),
      liteLocalRondaRenders300: Number(results.find(row => row.id === "lite-local-ronda-300")?.interactionResult?.bedLinkCount || 0) >= 50,
      liteLocalRondaOpensPatient: Boolean(results.find(row => row.id === "lite-local-ronda-300")?.interactionResult?.afterUrl?.includes("/paciente/")),
      legacyForcedFullAppLoadsMonolith: Boolean(results.find(row => row.id === "legacy-local-full-dashboard")?.resources.count > 20),
      legacyClinicalBlockedByAuthInUnauthenticatedAudit: Boolean(results.find(row => row.id === "legacy-public-auth")?.moduleSignals.hasLogin)
    }
  };
  const reportPath = join(outDir, "interface-comparison.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
} finally {
  legacyServer.kill();
  liteServer.kill();
}

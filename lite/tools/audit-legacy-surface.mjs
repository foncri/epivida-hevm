import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const liteRoot = join(repoRoot, "lite");
const legacyExts = new Set([".js", ".css", ".html", ".md"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(repoRoot, full).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "lite", "assets"].some(prefix => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
      walk(full, files);
    } else if (legacyExts.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function linesOf(text) {
  return text ? text.split(/\r?\n/).length : 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

function matches(text, regex, group = 1) {
  return [...text.matchAll(regex)].map(match => match[group] || match[0]);
}

const legacyFiles = walk(repoRoot);
const surfaces = legacyFiles.map(file => {
  const text = readFileSync(file, "utf8");
  return {
    file: relative(repoRoot, file).replace(/\\/g, "/"),
    bytes: statSync(file).size,
    lines: linesOf(text),
    functions: unique(matches(text, /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)),
    exportedGlobals: unique(matches(text, /\bwindow\.([A-Za-z_$][\w$]*)/g)),
    storageKeys: unique([
      ...matches(text, /["'](epivida-[a-z0-9-]+(?:-v\d+)?)["']/gi),
      ...matches(text, /\b(?:STORE_KEY|DRAFT_KEY|CUSTOM_BEDS_KEY|SHEETS_SESSION_KEY|POST_SAVE_KEY)\s*=\s*["']([^"']+)["']/g)
    ]),
    routes: unique(matches(text, /#\/[A-Za-z0-9_:/.-]+/g, 0)),
    clinicalTerms: unique(matches(text, /\b(IAAS|CENSO|RONDA|DISPOSITIVOS?|CULTIVOS?|ANTIBIOTICOS?|ANTIMICROBIANOS?|EGRESO|ALTA|AIS|AISP|OPD|HEMODIALISIS|ONCOLOGIA|NAVM|ISQ|P\.E\.|P\.B\.M\.T\.)\b/gi, 0))
  };
});

const liteRouter = readFileSync(join(liteRoot, "src/router.js"), "utf8");
const parityMatrix = readFileSync(join(liteRoot, "docs/FUNCTIONAL_PARITY_MATRIX.md"), "utf8");
const inventory = readFileSync(join(liteRoot, "docs/LEGACY_FEATURE_INVENTORY.md"), "utf8");

function tableRows(markdown) {
  return [...markdown.matchAll(/^\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|$/gm)]
    .map(match => match.slice(1).map(value => value.trim()))
    .filter(cols => !cols.every(value => /^-+$/.test(value)))
    .filter(cols => !["Dominio", "Funcion legacy"].includes(cols[0]));
}

const pendingParityRows = tableRows(parityMatrix)
  .filter(cols => /pendiente|parcial|Falta|P0|P1/i.test(cols.join(" ")));
const pendingInventoryRows = tableRows(inventory)
  .filter(cols => /pendiente|parcial|requiere decision/i.test(cols[6]));

const report = {
  generatedAt: new Date().toISOString(),
  legacy: {
    files: surfaces.length,
    jsFiles: surfaces.filter(row => row.file.endsWith(".js")).length,
    cssFiles: surfaces.filter(row => row.file.endsWith(".css")).length,
    totalBytes: surfaces.reduce((sum, row) => sum + row.bytes, 0),
    totalLines: surfaces.reduce((sum, row) => sum + row.lines, 0),
    largestFiles: [...surfaces].sort((a, b) => b.bytes - a.bytes).slice(0, 20).map(row => ({
      file: row.file,
      kb: Math.round((row.bytes / 1024) * 10) / 10,
      lines: row.lines
    })),
    storageKeys: unique(surfaces.flatMap(row => row.storageKeys)),
    routes: unique(surfaces.flatMap(row => row.routes)),
    exportedGlobals: unique(surfaces.flatMap(row => row.exportedGlobals)).slice(0, 250),
    functionCount: surfaces.reduce((sum, row) => sum + row.functions.length, 0),
    clinicalTerms: unique(surfaces.flatMap(row => row.clinicalTerms))
  },
  lite: {
    routes: unique(matches(liteRouter, /^\s*["']?([A-Za-z0-9-]+)["']?\s*:\s*\(\)\s*=>\s*import/gm)),
    pendingParityRows: pendingParityRows.map(cols => ({
      domain: cols[0],
      feature: cols[1],
      gap: cols[3],
      priority: cols[4],
      test: cols[6]
    })),
    pendingInventoryRows: pendingInventoryRows.map(cols => ({
      legacyFunction: cols[0],
      legacyFile: cols[1],
      destination: cols[5],
      status: cols[6]
    }))
  }
};

console.log(JSON.stringify(report, null, 2));

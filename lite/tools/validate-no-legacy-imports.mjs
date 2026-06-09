import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const repoRoot = resolve(root, "..");
const failures = [];

const forbidden = [
  "iaas-system",
  "epivida-auth-gate",
  "FULL_SCRIPTS",
  "FULL_STYLES",
  "google.script",
  "EPIVIDA_SHEETS_CONFIG",
  "localStorage",
  "import XLSX",
  "from \"xlsx\"",
  "from 'xlsx'",
  "assets/epivida-pro",
  "assets\\epivida-pro"
];

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

const appFiles = [
  join(root, "index.html"),
  join(root, "epivida-lite-config.js"),
  join(root, "epivida-lite-sw.js"),
  ...walk(join(root, "src")).filter(file => [".js", ".css", ".html"].includes(extname(file)))
].filter(existsSync);

for (const file of appFiles) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    const relativeFile = relative(repoRoot, file);
    if (
      relativeFile.replaceAll("\\", "/") === "lite/epivida-lite-sw.js" &&
      ["iaas-system", "epivida-auth-gate"].includes(pattern)
    ) {
      continue;
    }
    if (source.includes(pattern)) {
      fail(`Patron legacy prohibido "${pattern}" en ${relativeFile}`);
    }
  }
}

const index = readFileSync(join(root, "index.html"), "utf8");
const scripts = [...index.matchAll(/<script\b([^>]*)>/gi)].map(match => match[1]);
for (const attrs of scripts) {
  const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || "";
  if (!["./epivida-lite-config.js", "./src/main.js"].includes(src)) {
    fail(`Script inicial no permitido en lite/index.html: ${src || "inline"}`);
  }
}

if (failures.length) {
  console.error(`EPIVIDA Lite no-legacy validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite no-legacy validation OK");

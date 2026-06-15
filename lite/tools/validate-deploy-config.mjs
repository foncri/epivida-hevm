import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const repoRoot = resolve(root, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function readRequired(path, label = path) {
  const file = join(repoRoot, path);
  if (!existsSync(file)) {
    fail(`Falta ${label}`);
    return "";
  }
  return readFileSync(file, "utf8");
}

function parseJson(path, label = path) {
  const source = readRequired(path, label);
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${label} no es JSON valido: ${error.message}`);
    return null;
  }
}

const wrangler = readRequired("wrangler.toml");
if (!/name\s*=\s*"epivida-hevm"/.test(wrangler)) {
  fail("wrangler.toml debe publicar el proyecto Cloudflare Pages epivida-hevm.");
}

function headerSection(source, path) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === path);
  if (start < 0) return "";
  const section = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > start && line.startsWith("/") && line.trim().length > 1) break;
    section.push(line);
  }
  return section.join("\n");
}
if (!/pages_build_output_dir\s*=\s*"lite"/.test(wrangler)) {
  fail("wrangler.toml debe usar pages_build_output_dir = \"lite\".");
}
if (!/compatibility_date\s*=\s*"2026-06-05"/.test(wrangler)) {
  fail("wrangler.toml debe fijar compatibility_date para despliegues reproducibles.");
}

const firebase = parseJson("firebase.json");
if (firebase) {
  if (firebase.firestore?.rules !== "lite/firebase/firestore.rules") {
    fail("firebase.json debe apuntar a lite/firebase/firestore.rules.");
  }
  if (firebase.firestore?.indexes !== "lite/firebase/firestore.indexes.json") {
    fail("firebase.json debe apuntar a lite/firebase/firestore.indexes.json.");
  }
}

const packageJson = parseJson("package.json");
if (packageJson) {
  const scripts = packageJson.scripts || {};
  if (scripts["deploy:pages"] !== "wrangler pages deploy lite --project-name epivida-hevm") {
    fail("package.json debe conservar deploy:pages para Cloudflare Pages epivida-hevm.");
  }
  if (scripts["deploy:firestore"] !== "firebase deploy --only firestore:rules,firestore:indexes") {
    fail("package.json debe conservar deploy:firestore para reglas e indices Firestore.");
  }
  if (!scripts["validate:lite"] || !scripts["validate:lite:qa"] || !scripts["validate:deploy"]) {
    fail("package.json debe exponer validate:lite, validate:lite:qa y validate:deploy.");
  }
}

const headers = readRequired("lite/_headers");
for (const expected of [
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "X-Frame-Options: DENY",
  "/",
  "/index.html",
  "/*.html",
  "/src/*",
  "/epivida-lite-config.js",
  "/epivida-lite-sw.js",
  "/assets/*",
  "/manifest.webmanifest",
  "Cache-Control: no-cache"
]) {
  if (!headers.includes(expected)) fail(`lite/_headers debe incluir ${expected}.`);
}

if (/\/\*\.js[\s\S]*?Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/.test(headers)) {
  fail("lite/_headers no debe usar immutable global para /*.js sin fingerprint.");
}
if (/\/\*\.css[\s\S]*?Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/.test(headers)) {
  fail("lite/_headers no debe usar immutable global para /*.css sin fingerprint.");
}
if (/\/\*\.js[\s\S]*immutable/.test(headers) && /\/src\/\*[\s\S]*Cache-Control:\s*no-cache/.test(headers)) {
  fail("lite/_headers no debe mezclar /*.js immutable con /src/* no-cache.");
}
if (/\/\*\.css[\s\S]*immutable/.test(headers) && /\/src\/\*[\s\S]*Cache-Control:\s*no-cache/.test(headers)) {
  fail("lite/_headers no debe mezclar /*.css immutable con /src/* no-cache.");
}
if (headerSection(headers, "/epivida-lite-config.js").includes("immutable")) {
  fail("epivida-lite-config.js no puede recibir immutable.");
}
if (!/\/\n\s+Cache-Control:\s*no-cache/.test(headers)) {
  fail("lite/_headers debe marcar / con Cache-Control: no-cache.");
}
for (const expected of [
  "Cache-Control: public, max-age=31536000, immutable"
]) {
  if (!headers.includes(expected)) fail(`lite/_headers debe incluir ${expected}.`);
}

const rules = readRequired("lite/firebase/firestore.rules");
for (const collection of [
  "users",
  "patients_active",
  "patients_archive",
  "nursing_rounds",
  "round_sessions",
  "devices_active",
  "audit_logs",
  "exports_log"
]) {
  if (!rules.includes(`match /${collection}/`)) {
    fail(`firestore.rules debe cubrir ${collection}.`);
  }
}
if (rules.includes("allow read, write: if true")) {
  fail("firestore.rules no debe incluir reglas abiertas.");
}

const indexes = parseJson("lite/firebase/firestore.indexes.json");
if (indexes) {
  const groups = new Set((indexes.indexes || []).map(index => index.collectionGroup));
  for (const group of ["patients_active", "devices_active", "iaas_active", "nursing_rounds", "round_sessions", "audit_logs"]) {
    if (!groups.has(group)) fail(`firestore.indexes.json debe incluir collectionGroup ${group}.`);
  }
}

if (failures.length) {
  console.error(`EPIVIDA Lite deploy config validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite deploy config validation OK");

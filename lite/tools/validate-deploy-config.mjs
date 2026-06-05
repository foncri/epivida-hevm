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
if (!/name\s*=\s*"epivida-lite"/.test(wrangler)) {
  fail("wrangler.toml debe publicar el proyecto Cloudflare Pages epivida-lite.");
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
  if (scripts["deploy:pages"] !== "wrangler pages deploy lite --project-name epivida-lite") {
    fail("package.json debe conservar deploy:pages para Cloudflare Pages epivida-lite.");
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
  "/src/*",
  "/epivida-lite-config.js",
  "Cache-Control: no-cache",
  "/*.js",
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

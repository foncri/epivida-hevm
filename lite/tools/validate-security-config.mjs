import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(path) {
  const file = join(root, path);
  if (!existsSync(file)) {
    fail(`Falta ${path}`);
    return "";
  }
  return readFileSync(file, "utf8");
}

function blockFor(source, collection) {
  const start = source.indexOf(`match /${collection}/`);
  if (start < 0) return "";
  const next = source.indexOf("\n    match /", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

const rules = read("firebase/firestore.rules");
const security = read("src/lib/security.js");
const authService = read("src/services/authService.js");
const offlineQueue = read("src/services/offlineQueueService.js");

if (/allow\s+read\s*,\s*write\s*:\s*if\s+true/.test(rules) || /allow\s+write\s*:\s*if\s+true/.test(rules)) {
  fail("Firestore rules no deben permitir escrituras abiertas.");
}
if (rules.includes("bootstrapAdmin")) {
  fail("Firestore rules no deben conservar bootstrapAdmin despues de confirmar el primer admin productivo.");
}

for (const role of ["admin_epidemiologia", "epidemiologia", "enfermeria", "lectura"]) {
  if (!security.includes(role) || !rules.includes(role)) {
    fail(`Rol ${role} debe existir en cliente y reglas Firestore.`);
  }
}

const usersBlock = blockFor(rules, "users");
if (!usersBlock.includes('changedOnlyAllowed(["lastLoginAt", "updatedAt"])')) {
  fail("users self-update debe limitarse a lastLoginAt y updatedAt.");
}
if (!usersBlock.includes("allow create: if admin();")) {
  fail("users create debe estar limitado a admin activo, sin bootstrap temporal.");
}
if (usersBlock.includes("allowedModules")) {
  fail("users self-update no debe depender de una lista negativa de campos administrativos.");
}

for (const collection of [
  "users",
  "patients_active",
  "patients_archive",
  "census_days",
  "nursing_rounds",
  "round_sessions",
  "devices_active",
  "devices_archive",
  "iaas_active",
  "iaas_archive",
  "daily_snapshots",
  "audit_logs",
  "catalogs",
  "sync_queue",
  "exports_log"
]) {
  const block = blockFor(rules, collection);
  if (!block) {
    fail(`Firestore rules deben cubrir ${collection}.`);
    continue;
  }
  if (!block.includes("allow delete: if false") && !block.includes("allow update, delete: if false")) {
    fail(`${collection} debe prohibir delete en Firestore rules.`);
  }
}

for (const expected of [
  'ronda-paquetes": ["admin_epidemiologia", "epidemiologia", "enfermeria"]',
  'dispositivos: ["admin_epidemiologia", "epidemiologia", "enfermeria"]',
  '"epi-iaas": ["admin_epidemiologia", "epidemiologia"]',
  'admin: ["admin_epidemiologia"]'
]) {
  if (!security.includes(expected)) {
    fail(`security.js debe conservar matriz de acceso: ${expected}`);
  }
}

if (!authService.includes("activeProfile(profile)") || !authService.includes("normalizeRole(profile.role)")) {
  fail("authService debe normalizar rol y rechazar perfiles inactivos antes de cargar modulos.");
}

for (const expected of ["NON_RETRYABLE_CODES", "permission-denied", "sync_blocked", "item.status === \"local_pending\""]) {
  if (!offlineQueue.includes(expected)) {
    fail(`offlineQueueService debe conservar proteccion offline: ${expected}`);
  }
}
if (!offlineQueue.includes('item.collection !== "audit_logs"')) {
  fail("offlineQueueService no debe colapsar auditorias offline por path.");
}
if (!offlineQueue.includes("export function nextQueueWithWrite")) {
  fail("offlineQueueService debe exponer nextQueueWithWrite para validar deduplicacion offline.");
}

if (failures.length) {
  console.error(`EPIVIDA Lite security config validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite security config validation OK");

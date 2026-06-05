import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const ROLES = new Set(["admin_epidemiologia", "epidemiologia", "enfermeria", "lectura"]);
const ROLE_MODULES = {
  admin_epidemiologia: ["inicio", "censo", "monitoreo-epidemiologico", "ronda-paquetes", "epi-iaas", "dispositivos", "reportes", "admin"],
  epidemiologia: ["inicio", "censo", "monitoreo-epidemiologico", "ronda-paquetes", "epi-iaas", "dispositivos", "reportes"],
  enfermeria: ["ronda-paquetes", "dispositivos", "expediente"],
  lectura: ["inicio", "censo", "monitoreo-epidemiologico", "reportes"]
};

function usage() {
  console.error("Uso: node lite/tools/prepare-user-seed.mjs lite/firebase/users.seed.local.json [--out ruta.json]");
}

function cleanText(value, max = 200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`No se pudo leer JSON ${file}: ${error.message}`);
  }
}

function validateUid(uid, index) {
  const clean = cleanText(uid, 128);
  if (!clean || clean.includes("/") || clean.length > 128) {
    fail(`users[${index}].uid invalido. Debe ser el UID exacto de Firebase Auth, sin diagonales.`);
  }
  return clean;
}

function validateEmail(email, index) {
  const clean = cleanText(email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    fail(`users[${index}].email invalido.`);
  }
  return clean;
}

function validateRole(role, index) {
  const clean = cleanText(role, 60);
  if (!ROLES.has(clean)) {
    fail(`users[${index}].role invalido: ${clean}. Roles permitidos: ${[...ROLES].join(", ")}`);
  }
  return clean;
}

function validateAllowedModules(modules, role, index) {
  if (modules === undefined) return ROLE_MODULES[role];
  if (!Array.isArray(modules)) fail(`users[${index}].allowedModules debe ser arreglo.`);
  const allowed = new Set(ROLE_MODULES[role]);
  const clean = modules.map(item => cleanText(item, 80)).filter(Boolean);
  const invalid = clean.filter(item => !allowed.has(item));
  if (invalid.length) {
    fail(`users[${index}].allowedModules contiene modulos no permitidos para ${role}: ${invalid.join(", ")}`);
  }
  return [...new Set(clean)];
}

function normalizeUser(user, index, now) {
  if (!user || typeof user !== "object" || Array.isArray(user)) fail(`users[${index}] debe ser objeto.`);
  const uid = validateUid(user.uid, index);
  const email = validateEmail(user.email, index);
  const role = validateRole(user.role, index);
  const active = user.active !== false;
  const displayName = cleanText(user.displayName || email, 120);
  const allowedModules = validateAllowedModules(user.allowedModules, role, index);

  return {
    path: `users/${uid}`,
    data: {
      uid,
      email,
      displayName,
      role,
      active,
      allowedModules,
      createdAt: now,
      updatedAt: now,
      seedSource: "epivida-lite-user-seed"
    }
  };
}

function parseArgs(argv) {
  const args = [...argv];
  const input = args.shift();
  const outFlag = args.indexOf("--out");
  const out = outFlag >= 0 ? args[outFlag + 1] : "";
  if (!input || (outFlag >= 0 && !out)) {
    usage();
    process.exit(1);
  }
  return { input: resolve(input), out: out ? resolve(out) : "" };
}

const { input, out } = parseArgs(process.argv.slice(2));
const source = readJson(input);
if (!Array.isArray(source.users) || source.users.length === 0) fail("El archivo debe contener users con al menos un usuario.");

const now = new Date().toISOString();
const documents = source.users.map((user, index) => normalizeUser(user, index, now));
const paths = new Set();
const emails = new Set();
for (const document of documents) {
  if (paths.has(document.path)) fail(`UID duplicado: ${document.path}`);
  if (emails.has(document.data.email)) fail(`Email duplicado: ${document.data.email}`);
  paths.add(document.path);
  emails.add(document.data.email);
}

const adminCount = documents.filter(document => document.data.role === "admin_epidemiologia" && document.data.active).length;
if (adminCount === 0) fail("Debe existir al menos un usuario activo con rol admin_epidemiologia.");

const payload = {
  generatedAt: now,
  source: basename(input),
  collection: "users",
  documents
};
const text = `${JSON.stringify(payload, null, 2)}\n`;

if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text, "utf8");
  console.log(`Paquete de usuarios generado: ${out}`);
  console.log(`Documentos: ${documents.length}`);
} else {
  process.stdout.write(text);
}

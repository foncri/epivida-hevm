import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const failures = [];

function fail(message) {
  failures.push(message);
}

function readDoc(name) {
  const file = join(root, "docs", name);
  if (!existsSync(file)) {
    fail(`Falta lite/docs/${name}`);
    return "";
  }
  return readFileSync(file, "utf8");
}

function requireIncludes(source, expected, label) {
  if (!source.toLowerCase().includes(expected.toLowerCase())) fail(`${label} debe incluir ${expected}.`);
}

const inventory = readDoc("LEGACY_FEATURE_INVENTORY.md");
const parity = readDoc("FUNCTIONAL_PARITY_MATRIX.md");
const migration = readDoc("MIGRATION_PLAN.md");
const audit = readDoc("LEGACY_VS_LITE_AUDIT_2026-06-15.md");

requireIncludes(
  inventory,
  "| Funcion legacy | Archivo legacy | Que hacia | Sigue siendo util | Problema de rendimiento | Modulo Lite destino | Estado |",
  "LEGACY_FEATURE_INVENTORY.md"
);

for (const status of [
  "pendiente",
  "migrado",
  "descartado por visual",
  "reemplazado por arquitectura nueva"
]) {
  requireIncludes(inventory, status, "LEGACY_FEATURE_INVENTORY.md");
}

for (const keyword of [
  "Auth gate",
  "Censo",
  "Importacion",
  "Monitoreo",
  "Ronda",
  "Paquetes preventivos",
  "Dispositivos",
  "IAAS",
  "Cultivos",
  "Antibioticos",
  "Expediente",
  "Reporte",
  "Offline",
  "Auditoria",
  "Google Sheets",
  "localStorage"
]) {
  requireIncludes(inventory, keyword, "LEGACY_FEATURE_INVENTORY.md");
}

requireIncludes(
  parity,
  "| Dominio | Feature antigua | En Lite actual | Brecha | Prioridad | Implementacion propuesta | Prueba |",
  "FUNCTIONAL_PARITY_MATRIX.md"
);

for (const domain of [
  "Auth",
  "Usuarios",
  "Censo",
  "Importacion",
  "Monitoreo",
  "Ronda",
  "Paquetes preventivos",
  "Dispositivos",
  "IAAS",
  "Cultivos",
  "Antibioticos",
  "Expediente",
  "Reportes",
  "Auditoria",
  "Offline",
  "Exportacion",
  "Dashboard",
  "Catalogos",
  "Rendimiento",
  "Seguridad"
]) {
  if (!new RegExp(`\\| ${domain} \\|`).test(parity)) {
    fail(`FUNCTIONAL_PARITY_MATRIX.md debe cubrir el dominio ${domain}.`);
  }
}

for (const priority of ["P0", "P1", "P2"]) {
  requireIncludes(parity + migration, priority, "Documentacion de paridad/migracion");
}

for (const expected of [
  "EPIVIDA Antiguo vs EPIVIDA Lite",
  "Dictamen Ejecutivo",
  "Evidencia De Tamano Y Riesgo Legacy",
  "Paridad Por Dominio",
  "Brechas Que Aun No Pueden Declararse Cerradas",
  "Cloudflare build marker",
  "2026-06-16-parity11"
]) {
  requireIncludes(audit, expected, "LEGACY_VS_LITE_AUDIT_2026-06-15.md");
}

for (const domain of [
  "Auth",
  "Censo",
  "Importacion",
  "Monitoreo",
  "Ronda",
  "Dispositivos",
  "IAAS",
  "Cultivos",
  "Antimicrobianos",
  "Expediente",
  "Reportes",
  "Offline",
  "Auditoria",
  "Seguridad",
  "Cloudflare"
]) {
  if (!new RegExp(`\\| ${domain} \\|`).test(audit)) {
    fail(`LEGACY_VS_LITE_AUDIT_2026-06-15.md debe auditar el dominio ${domain}.`);
  }
}

if (failures.length) {
  console.error(`EPIVIDA Lite feature parity validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite feature parity validation OK");

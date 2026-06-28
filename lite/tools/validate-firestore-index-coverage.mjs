import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const failures = [];

function fail(message) {
  failures.push(message);
}

const indexes = JSON.parse(readFileSync(join(root, "firebase/firestore.indexes.json"), "utf8")).indexes || [];
const dataModel = readFileSync(join(root, "docs/FIRESTORE_DATA_MODEL.md"), "utf8");
const strategy = readFileSync(join(root, "docs/ONE_MILLION_PATIENT_STRATEGY.md"), "utf8");

function indexKey(index) {
  return `${index.collectionGroup}|${(index.fields || []).map(field => `${field.fieldPath}:${field.order}`).join(",")}`;
}

const available = new Set(indexes.map(indexKey));

function requireIndex(collectionGroup, fields) {
  const key = `${collectionGroup}|${fields.map(([fieldPath, order]) => `${fieldPath}:${order}`).join(",")}`;
  if (!available.has(key)) fail(`Falta indice compuesto ${key}.`);
}

[
  ["patients_active", [["active", "ASCENDING"], ["service", "ASCENDING"]]],
  ["patients_active", [["active", "ASCENDING"], ["bed", "ASCENDING"]]],
  ["patients_active", [["active", "ASCENDING"], ["updatedAt", "DESCENDING"]]],
  ["patients_active", [["active", "ASCENDING"], ["epidemiologicalDiagnosis", "ASCENDING"]]],
  ["patients_active", [["active", "ASCENDING"], ["status", "ASCENDING"]]],
  ["patients_active", [["service", "ASCENDING"], ["bed", "ASCENDING"]]],
  ["patients_active", [["service", "ASCENDING"], ["status", "ASCENDING"]]],
  ["patients_active", [["normalizedPatientName", "ASCENDING"], ["active", "ASCENDING"]]],
  ["patients_archive", [["lastService", "ASCENDING"], ["archivedAt", "DESCENDING"]]],
  ["patients_archive", [["normalizedPatientName", "ASCENDING"], ["archivedAt", "DESCENDING"]]],
  ["patients_archive", [["opdPending", "ASCENDING"], ["archivedAt", "DESCENDING"]]],
  ["nursing_rounds", [["date", "ASCENDING"], ["service", "ASCENDING"]]],
  ["nursing_rounds", [["date", "ASCENDING"], ["patientId", "ASCENDING"]]],
  ["nursing_rounds", [["patientId", "ASCENDING"], ["date", "DESCENDING"]]],
  ["nursing_rounds", [["date", "ASCENDING"], ["status", "ASCENDING"]]],
  ["devices_active", [["active", "ASCENDING"], ["patientId", "ASCENDING"]]],
  ["devices_active", [["active", "ASCENDING"], ["deviceType", "ASCENDING"]]],
  ["devices_active", [["active", "ASCENDING"], ["service", "ASCENDING"]]],
  ["devices_active", [["patientId", "ASCENDING"], ["active", "ASCENDING"]]],
  ["devices_archive", [["patientId", "ASCENDING"], ["removalDate", "DESCENDING"]]],
  ["iaas_active", [["active", "ASCENDING"], ["service", "ASCENDING"]]],
  ["iaas_active", [["active", "ASCENDING"], ["iaasType", "ASCENDING"]]],
  ["iaas_active", [["patientId", "ASCENDING"], ["active", "ASCENDING"]]],
  ["iaas_active", [["status", "ASCENDING"], ["updatedAt", "DESCENDING"]]],
  ["iaas_archive", [["patientId", "ASCENDING"], ["closedAt", "DESCENDING"]]],
  ["cultures", [["patientId", "ASCENDING"], ["requestedAt", "DESCENDING"]]],
  ["cultures", [["iaasId", "ASCENDING"], ["requestedAt", "DESCENDING"]]],
  ["cultures", [["status", "ASCENDING"], ["requestedAt", "DESCENDING"]]],
  ["antimicrobials", [["patientId", "ASCENDING"], ["startDate", "DESCENDING"]]],
  ["antimicrobials", [["iaasId", "ASCENDING"], ["startDate", "DESCENDING"]]],
  ["antimicrobials", [["status", "ASCENDING"], ["startDate", "DESCENDING"]]],
  ["audit_logs", [["userId", "ASCENDING"], ["createdAt", "DESCENDING"]]],
  ["audit_logs", [["patientId", "ASCENDING"], ["createdAt", "DESCENDING"]]],
  ["audit_logs", [["module", "ASCENDING"], ["createdAt", "DESCENDING"]]],
  ["audit_logs", [["entityId", "ASCENDING"], ["createdAt", "DESCENDING"]]],
  ["exports_log", [["userId", "ASCENDING"], ["createdAt", "DESCENDING"]]]
].forEach(([collection, fields]) => requireIndex(collection, fields));

for (const expected of ["indices automaticos", "patients_archive", "limit", "cursor"]) {
  if (!`${dataModel}\n${strategy}`.includes(expected)) {
    fail(`La documentacion de modelo/escala debe mencionar ${expected}.`);
  }
}

if (failures.length) {
  console.error(`EPIVIDA Lite Firestore index coverage validation failed (${failures.length})`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log("EPIVIDA Lite Firestore index coverage validation OK");

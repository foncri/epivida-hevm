import { readFile } from "node:fs/promises";

const [, , file] = process.argv;

if (!file) {
  console.error("Uso: node lite/tools/validate-migration-package.mjs paquete.json");
  process.exit(2);
}

const pkg = JSON.parse(await readFile(file, "utf8"));
const errors = [];
const warnings = [];

if (pkg?.metadata?.packageVersion !== "epivida-lite-migration-v1") {
  errors.push("El paquete no declara packageVersion epivida-lite-migration-v1.");
}

const collections = pkg.collections || {};
const patients = arrayFor(collections.patients_active);
const devices = arrayFor(collections.devices_active);
const rounds = arrayFor(collections.nursing_rounds);
const iaas = arrayFor(collections.iaas_active);

patients.forEach((row, index) => {
  requireField(errors, row, "patientId", `patients_active[${index}]`);
  requireField(errors, row, "patientName", `patients_active[${index}]`);
  if (!row.service && !row.currentService) warnings.push(`patients_active[${index}] sin servicio.`);
});

devices.forEach((row, index) => {
  requireField(errors, row, "episodeId", `devices_active[${index}]`);
  requireField(errors, row, "patientId", `devices_active[${index}]`);
  requireField(errors, row, "deviceType", `devices_active[${index}]`);
  if (row.active !== false) requireField(warnings, row, "installationDate", `devices_active[${index}] activo`);
});

rounds.forEach((row, index) => {
  requireField(errors, row, "roundId", `nursing_rounds[${index}]`);
  requireField(errors, row, "patientId", `nursing_rounds[${index}]`);
  requireField(errors, row, "date", `nursing_rounds[${index}]`);
});

iaas.forEach((row, index) => {
  requireField(errors, row, "iaasId", `iaas_active[${index}]`);
  requireField(errors, row, "patientId", `iaas_active[${index}]`);
  requireField(warnings, row, "iaasType", `iaas_active[${index}]`);
});

const summary = {
  ok: errors.length === 0,
  counts: {
    patients_active: patients.length,
    devices_active: devices.length,
    nursing_rounds: rounds.length,
    iaas_active: iaas.length,
    audit_logs: arrayFor(collections.audit_logs).length
  },
  errors,
  warnings: [...warnings, ...(pkg.warnings || [])]
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);

function arrayFor(value) {
  return Array.isArray(value) ? value : [];
}

function requireField(target, row, field, label) {
  if (row?.[field] === undefined || row?.[field] === null || row?.[field] === "") {
    target.push(`${label} sin ${field}.`);
  }
}

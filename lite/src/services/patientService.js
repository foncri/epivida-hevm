import { cacheGet, cacheSet } from "../lib/cache.js";
import { cleanText, stripUndefined, validPatient } from "../lib/validators.js";
import { listCollection, setDocMerge } from "./firestoreService.js";
import { writeAudit } from "./auditService.js";
import { nowIso } from "../lib/date.js";

const CACHE_KEY = "patients_active:last";

export async function listActivePatients() {
  try {
    const rows = await listCollection("patients_active");
    const active = rows.filter(row => row.active !== false);
    cacheSet(CACHE_KEY, active).catch(() => undefined);
    return active;
  } catch {
    const cached = await cacheGet(CACHE_KEY);
    return cached?.value || [];
  }
}

export function filterPatients(patients, filters = {}) {
  const query = cleanText(filters.query || "").toLowerCase();
  const service = cleanText(filters.service || "");
  const status = cleanText(filters.status || "");
  const sex = cleanText(filters.sex || "");
  return patients.filter(patient => {
    const haystack = [
      patient.patientName,
      patient.bed,
      patient.service,
      patient.sector,
      patient.epidemiologicalDiagnosis,
      patient.hospitalDiagnosis
    ].join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (service && service !== "Todos" && patient.service !== service) return false;
    if (status && status !== "Todos" && patient.status !== status) return false;
    if (sex && sex !== "Todos" && patient.sex !== sex) return false;
    return true;
  });
}

export async function savePatient(app, patient) {
  if (!validPatient(patient)) throw new Error("Paciente sin nombre o servicio.");
  const patientId = patient.patientId || crypto.randomUUID();
  const payload = stripUndefined({
    ...patient,
    patientId,
    active: patient.active !== false,
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || "",
    createdAt: patient.createdAt || nowIso(),
    createdBy: patient.createdBy || app.state.auth.user?.uid || ""
  });
  await setDocMerge(`patients_active/${patientId}`, payload);
  await writeAudit(app, {
    actionType: patient.patientId ? "patient_update" : "patient_create",
    module: "censo",
    entityType: "patient",
    entityId: patientId,
    patientId,
    after: payload
  });
  return payload;
}

export function uniqueValues(rows, field) {
  return ["Todos", ...new Set(rows.map(row => cleanText(row[field])).filter(Boolean).sort((a, b) => a.localeCompare(b, "es")))];
}

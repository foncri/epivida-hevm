const LEGACY_STORE_KEY = "epivida-iaas-os-v1";
const LEGACY_DRAFTS_KEY = "epivida-iaas-drafts-v1";
const PACKAGE_VERSION = "epivida-lite-migration-v1";

let preparedPackage = null;

const statusNode = document.querySelector("#status");
const summaryNode = document.querySelector("#summary");
const downloadButton = document.querySelector("#download");
const fileInput = document.querySelector("#file-input");

document.querySelector("#read-local").addEventListener("click", () => {
  try {
    const store = readJson(localStorage.getItem(LEGACY_STORE_KEY));
    const drafts = readJson(localStorage.getItem(LEGACY_DRAFTS_KEY));
    if (!store) throw new Error(`No se encontro ${LEGACY_STORE_KEY} en este navegador.`);
    prepare(store, drafts, "localStorage");
  } catch (error) {
    showError(error);
  }
});

fileInput.addEventListener("change", async event => {
  try {
    const [file] = event.target.files || [];
    if (!file) return;
    const data = readJson(await file.text());
    const store = data?.store || data?.legacyStore || data;
    const drafts = data?.drafts || {};
    if (!store || typeof store !== "object") throw new Error("El JSON no contiene un store legacy valido.");
    prepare(store, drafts, file.name);
  } catch (error) {
    showError(error);
  } finally {
    event.target.value = "";
  }
});

downloadButton.addEventListener("click", () => {
  if (!preparedPackage) return;
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(`epivida-lite-migration-${stamp}.json`, preparedPackage);
});

function prepare(store, drafts, source) {
  preparedPackage = buildPackage(store, drafts, source);
  downloadButton.disabled = false;
  statusNode.replaceChildren(
    strong("Paquete preparado"),
    span("muted", `Origen: ${source}. Generado: ${preparedPackage.metadata.generatedAt}.`),
    span("muted", "Este archivo puede contener datos clinicos. No lo subas al repositorio.")
  );
  renderSummary(preparedPackage);
}

function buildPackage(store = {}, drafts = {}, source = "") {
  const patients = normalizePatients(store.patients);
  const devices = normalizeDevices(store.deviceEpisodes);
  const rounds = normalizeRounds(store.dailyRounds);
  const iaas = normalizeIaas(store, rounds);
  const auditLogs = Array.isArray(store.auditLogs) ? store.auditLogs.map(cleanObject) : [];
  const warnings = buildWarnings({ patients, devices, rounds, iaas, drafts });
  return {
    metadata: {
      packageVersion: PACKAGE_VERSION,
      generatedAt: new Date().toISOString(),
      source,
      sourceVersion: store.version || "",
      note: "Paquete de migracion generado en cliente. Revisar antes de importar a Firestore."
    },
    counts: {
      patients_active: patients.length,
      devices_active: devices.length,
      nursing_rounds: rounds.length,
      iaas_active: iaas.length,
      audit_logs: auditLogs.length,
      warnings: warnings.length
    },
    collections: {
      patients_active: patients,
      devices_active: devices,
      nursing_rounds: rounds,
      iaas_active: iaas,
      audit_logs: auditLogs
    },
    warnings
  };
}

function normalizePatients(value = {}) {
  return Object.values(value || {}).map(patient => cleanObject({
    patientId: patient.patientId,
    displayCode: patient.displayCode,
    patientName: patient.patientName,
    hospitalInternalId: patient.hospitalInternalId,
    service: patient.service || patient.currentService,
    currentService: patient.currentService || patient.service,
    bed: patient.bed || patient.currentBed,
    currentBed: patient.currentBed || patient.bed,
    sector: patient.sector,
    sex: patient.sex,
    age: patient.age,
    admissionDate: patient.admissionDate,
    status: patient.status || patient.currentState,
    currentState: patient.currentState || patient.status,
    hospitalDiagnosis: patient.hospitalDiagnosis || patient.currentDiagnosis,
    currentDiagnosis: patient.currentDiagnosis || patient.hospitalDiagnosis,
    epidemiologicalDiagnosis: patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis,
    currentEpidemiologicalDiagnosis: patient.currentEpidemiologicalDiagnosis || patient.epidemiologicalDiagnosis,
    observations: patient.observations,
    activePendingIssues: patient.activePendingIssues,
    presentInLatestCensus: patient.presentInLatestCensus,
    latestCensusDate: patient.latestCensusDate,
    latestRoundDate: patient.latestRoundDate,
    latestRoundStatus: patient.latestRoundStatus,
    active: patient.active !== false && patient.presentInLatestCensus !== false,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    source: "legacy_local_store"
  })).filter(patient => patient.patientId);
}

function normalizeDevices(value = {}) {
  return Object.values(value || {}).map(device => cleanObject({
    episodeId: device.episodeId,
    patientId: device.patientId,
    patientName: device.patientName,
    service: device.service,
    bed: device.bed,
    deviceType: device.deviceType || device.packageType,
    deviceSubtype: device.deviceSubtype,
    anatomicalSite: device.anatomicalSite,
    installationDate: device.installationDate,
    removalDate: device.removalDate,
    status: device.removalDate ? "retirado" : (device.status || "activo"),
    active: !device.removalDate && device.status !== "retirado",
    careStatus: device.careStatus || "no_valorado",
    infectionSigns: Boolean(device.infectionSigns),
    notes: device.notes,
    createdDuringRoundDate: device.createdDuringRoundDate,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    source: device.source || "legacy_local_store"
  })).filter(device => device.episodeId && device.patientId);
}

function normalizeRounds(value = {}) {
  return Object.entries(value || {}).flatMap(([date, round]) => {
    const entries = round?.entries || {};
    return Object.values(entries).map(entry => cleanObject({
      roundId: entry.roundId || `${entry.roundDate || date}_${entry.patientId}`,
      date: entry.date || entry.roundDate || date,
      patientId: entry.patientId,
      service: entry.service,
      bed: entry.bed,
      status: entry.status || "pendiente",
      hasDevices: Boolean(entry.hasInvasives || entry.reviewedDevices?.length),
      reviewedBy: entry.reviewedBy,
      reviewedAt: entry.reviewedAt,
      notes: entry.notes,
      alertsGenerated: entry.alertsGenerated,
      pendingIssuesAdded: entry.pendingIssuesAdded,
      packageReviews: entry.packageReviews,
      iaasAssessment: entry.iaasAssessment,
      updatedAt: entry.updatedAt || entry.reviewedAt,
      source: "legacy_local_store"
    })).filter(entry => entry.patientId);
  });
}

function normalizeIaas(store, rounds) {
  const patients = store.patients || {};
  const rows = [];
  rounds.forEach(round => {
    const patient = patients[round.patientId] || {};
    const text = [
      patient.epidemiologicalDiagnosis,
      patient.currentEpidemiologicalDiagnosis,
      round.iaasAssessment?.classification,
      round.iaasAssessment?.status
    ].filter(Boolean).join(" ").toUpperCase();
    const hasIaasText = text.includes("IAAS") && !text.includes("NO IAAS");
    const hasAssessment = round.iaasAssessment && Object.keys(round.iaasAssessment).length > 0;
    if (!hasIaasText && !hasAssessment) return;
    rows.push(cleanObject({
      iaasId: `legacy_${round.date}_${round.patientId}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
      patientId: round.patientId,
      patientName: patient.patientName,
      service: round.service || patient.currentService,
      bed: round.bed || patient.currentBed,
      iaasType: round.iaasAssessment?.iaasType || round.iaasAssessment?.classification || "Seguimiento IAAS",
      status: round.iaasAssessment?.status || (hasIaasText ? "sospecha" : "probable"),
      onsetDate: round.iaasAssessment?.onsetDate || round.date,
      notes: round.notes,
      active: true,
      source: "legacy_local_store"
    }));
  });
  return rows;
}

function buildWarnings({ patients, devices, rounds, iaas, drafts }) {
  const warnings = [];
  if (!patients.length) warnings.push("No se detectaron pacientes en el store legacy.");
  if (Object.keys(drafts || {}).length) warnings.push("Existen borradores legacy; revisar manualmente antes de migrar.");
  patients.filter(patient => !patient.patientName).forEach(patient => warnings.push(`Paciente sin nombre: ${patient.patientId}`));
  patients.filter(patient => !patient.service && !patient.currentService).forEach(patient => warnings.push(`Paciente sin servicio: ${patient.patientId}`));
  devices.filter(device => !device.installationDate && device.active).forEach(device => warnings.push(`Dispositivo activo sin fecha: ${device.episodeId}`));
  rounds.filter(round => !round.date).forEach(round => warnings.push(`Ronda sin fecha: ${round.roundId}`));
  iaas.filter(row => !row.iaasType).forEach(row => warnings.push(`IAAS sin tipo: ${row.iaasId}`));
  return warnings;
}

function renderSummary(pkg) {
  summaryNode.replaceChildren(
    card("Pacientes activos", pkg.counts.patients_active),
    card("Dispositivos activos", pkg.counts.devices_active),
    card("Rondas", pkg.counts.nursing_rounds),
    card("IAAS", pkg.counts.iaas_active),
    card("Auditoria", pkg.counts.audit_logs),
    card("Advertencias", pkg.counts.warnings, pkg.warnings.slice(0, 6).join(" | "))
  );
}

function card(title, value, detail = "") {
  return section("row-card", [strong(title), span("muted", String(value)), detail ? span("muted", detail) : ""]);
}

function showError(error) {
  preparedPackage = null;
  downloadButton.disabled = true;
  statusNode.replaceChildren(strong("No se pudo preparar"), span("muted", error?.message || String(error)));
  summaryNode.replaceChildren();
}

function readJson(text) {
  if (!text) return null;
  return JSON.parse(text);
}

function cleanObject(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function section(className, children) {
  const node = document.createElement("section");
  node.className = className;
  append(node, children);
  return node;
}

function strong(text) {
  const node = document.createElement("strong");
  node.textContent = text;
  return node;
}

function span(className, text) {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = text;
  return node;
}

function append(node, children) {
  children.flat().forEach(child => {
    if (child === "" || child === null || child === undefined) return;
    node.append(child);
  });
}

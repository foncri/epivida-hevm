import { normalizeDate } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { removeDeviceEpisode, saveDeviceEpisode } from "../../services/deviceService.js";
import { archivePatient, savePatient } from "../../services/patientService.js";
import {
  defaultPreventiveDevice,
  deviceDisplayName,
  packageCreatesDevice,
  packageReviewSummary,
  preventiveCompliance
} from "../../services/preventivePackageService.js";
import { saveRoundReview } from "../../services/roundService.js";
import { DISCHARGE_SHIFTS, DISCHARGE_TYPES } from "./roundConstants.js";
import { normalizeRoundText, patientBed, patientService } from "./roundHelpers.js";
import { navigationPatientId, normalizeStatusKey, roundPatientHref } from "./roundPatientUtils.js";

export async function savePatientRound(app, date, patient, patients, activeDevices, draft, requestedStatus, direction) {
  const errors = validateDraft(draft, activeDevices, requestedStatus);
  if (errors.length) return errors.join(" ");
  const createdEpisodeTasks = [];
  const packageReviews = [];

  for (const device of draft.deviceDrafts) {
    const reviewId = device.packageReviewId || device.draftId || `${patient.patientId}|${date}|${device.packageType || device.deviceType}`;
    packageReviews.push({
      ...packageReviewSummary(device),
      packageReviewId: reviewId,
      reviewDate: date,
      savedEpisodeId: device.savedEpisodeId || device.episodeId || ""
    });
    if (!packageCreatesDevice(device) || !device.installationDate) continue;
    createdEpisodeTasks.push(saveDeviceEpisode(app, {
      patientId: patient.patientId,
      deviceType: device.deviceType,
      deviceSubtype: device.deviceSubtype || "",
      french: device.french || "",
      material: device.material || "",
      deviceState: device.deviceState || "",
      preventivePackage: device.packageType || "",
      preventiveChecks: device.preventiveChecks || {},
      preventiveCompliance: preventiveCompliance(device.preventiveChecks || {}),
      oralHygieneMethod: device.oralHygieneMethod || "",
      installationDate: device.installationDate,
      removalDate: device.removalDate || "",
      notes: [device.notes, device.observations].filter(Boolean).join(" | "),
      roundDate: date,
      createdDuringRoundDate: date,
      source: "nursing_round"
    }));
  }

  const activeDeviceById = new Map(activeDevices.map(device => [device.episodeId, device]));
  const removalTasks = [];
  for (const [episodeId, removalDate] of Object.entries(draft.removals || {})) {
    if (!removalDate) continue;
    const device = activeDeviceById.get(episodeId);
    if (device) removalTasks.push(removeDeviceEpisode(app, device, removalDate));
  }

  const patientActionTask = applyPreventivePatientActions(app, date, patient, draft);
  const [createdEpisodes, patientForRound] = await Promise.all([
    Promise.all(createdEpisodeTasks),
    patientActionTask,
    Promise.all(removalTasks)
  ]);
  const patientMovement = patientMovementPayload(patient, draft);
  const quickDischarge = quickDischargePayload(draft);
  const hasNoCheck = packageReviews.some(review => Object.values(review.preventiveChecks || {}).some(value => normalizeRoundText(value) === "NO"));
  const status = requestedStatus === "incompleto" ? "incompleto" : hasNoCheck ? "alerta" : requestedStatus;
  const saved = await saveRoundReview(app, {
    date,
    patientId: patient.patientId,
    service: patientService(patientForRound),
    bed: patientBed(patientForRound),
    status,
    hasDevices: activeDevices.length > 0 || createdEpisodes.length > 0,
    noInvasivesConfirmed: Boolean(draft.noInvasivesConfirmed) && !activeDevices.length && !createdEpisodes.length,
    reviewedDevices: [...activeDevices.map(device => device.episodeId), ...createdEpisodes.map(device => device.episodeId)].filter(Boolean),
    packageReviews,
    pendingIssuesAdded: draft.pendingText ? [draft.pendingText.trim()] : [],
    alertsGenerated: hasNoCheck ? ["Criterio preventivo marcado como NO."] : [],
    notes: draft.notes || "",
    patientMovement,
    quickDischarge,
    generalObservations: String(draft.generalObservations || "").trim(),
    generalObservationDate: String(draft.generalObservations || "").trim() ? draft.generalObservationDate || date : "",
    activeRoundSection: "preventive"
  });
  resetDraft(draft);
  clearReviewDraft(roundState(app), date, patient.patientId);

  if (direction) {
    const target = navigationPatientId(patient, patients, direction);
    location.hash = target ? roundPatientHref(date, target) : `#/ronda/${date}`;
    return { message: "Revision guardada.", patient: patientForRound, savedRound: saved };
  }
  return {
    message: saved.syncStatus === "local_pending" ? "Revision guardada localmente; queda pendiente de sincronizar." : "Revision sincronizada.",
    patient: patientForRound,
    savedRound: saved
  };
}

async function applyPreventivePatientActions(app, date, patient, draft) {
  if (!canWrite("censo", app.state.auth.profile?.role)) return patient;
  const movement = patientMovementPayload(patient, draft);
  const discharge = quickDischargePayload(draft);
  const observations = String(draft.generalObservations || "").trim();
  let next = { ...patient };
  let changed = false;

  if (movement) {
    next = {
      ...next,
      service: movement.toService,
      currentService: movement.toService,
      bed: movement.toBed,
      currentBed: movement.toBed
    };
    changed = true;
  }

  if (observations) {
    next = {
      ...next,
      observations: mergePatientObservation(next.observations || "", draft.generalObservationDate || date, observations)
    };
    changed = true;
  }

  if (discharge) {
    const reason = quickDischargeReason(discharge);
    return archivePatient(app, {
      ...next,
      hospitalizationStatus: "egresado",
      dischargeDate: discharge.date,
      dischargeType: discharge.type,
      dischargeShift: discharge.shift,
      dischargeReason: reason,
      deathCertificateFolio: discharge.deathCertificateFolio || "",
      dischargeReviewRequired: false,
      probableDischarge: false,
      dischargeReported: false,
      activePendingIssues: (next.activePendingIssues || []).filter(issue => !isDischargeIssue(issue))
    }, reason);
  }

  return changed ? savePatient(app, next) : patient;
}

function patientMovementPayload(patient, draft) {
  const movement = draft.patientMovement || {};
  if (!patientMovementChanged(patient, movement)) return null;
  return {
    fromService: patientService(patient),
    fromBed: patientBed(patient),
    toService: movement.service || patientService(patient),
    toBed: movement.bed || patientBed(patient),
    changedAt: new Date().toISOString()
  };
}

function patientMovementChanged(patient, movement = {}) {
  if (!movement._dirty) return false;
  const service = movement.service || patientService(patient);
  const bed = movement.bed || patientBed(patient);
  return service !== patientService(patient) || bed !== patientBed(patient);
}

function quickDischargePayload(draft) {
  const discharge = draft.quickDischarge || {};
  if (!discharge.enabled) return null;
  return {
    enabled: true,
    date: normalizeDate(discharge.date) || "",
    type: discharge.type || DISCHARGE_TYPES[0],
    shift: discharge.shift || DISCHARGE_SHIFTS[DISCHARGE_SHIFTS.length - 1],
    deathCertificateFolio: discharge.deathCertificateFolio || "",
    confirmedAt: new Date().toISOString()
  };
}

function quickDischargeReason(discharge = {}) {
  return normalizeRoundText(discharge.type) === "DEFUNCION" ? "defuncion" : `alta_${normalizeRoundText(discharge.type || "egreso").toLowerCase().replace(/\s+/g, "_")}`;
}

function mergePatientObservation(existing, date, observations) {
  const nextNote = `Ronda preventiva ${date}: ${String(observations || "").trim()}`;
  const current = String(existing || "").trim();
  if (!current) return nextNote;
  if (normalizeRoundText(current).includes(normalizeRoundText(nextNote))) return current;
  return `${current}\n${nextNote}`;
}

function validateDraft(draft, activeDevices, requestedStatus) {
  const errors = [];
  if (requestedStatus !== "incompleto") {
    draft.deviceDrafts.filter(packageCreatesDevice).forEach(device => {
      if (!device.installationDate) errors.push(`${deviceDisplayName(device)}: falta fecha de instalacion.`);
    });
    const activeDeviceById = new Map(activeDevices.map(device => [device.episodeId, device]));
    Object.entries(draft.removals || {}).forEach(([episodeId, removalDate]) => {
      const device = activeDeviceById.get(episodeId);
      if (removalDate && device?.installationDate && removalDate < device.installationDate) {
        errors.push(`${deviceDisplayName(device)}: retiro antes de instalacion.`);
      }
    });
  }
  if (draft.noInvasivesConfirmed && activeDevices.length) errors.push("Hay invasivos activos. Registra retiro o guarda como incompleto.");
  if (draft.quickDischarge?.enabled) {
    if (!normalizeDate(draft.quickDischarge.date)) errors.push("Alta rapida: falta fecha de alta.");
    if (!draft.quickDischarge.type) errors.push("Alta rapida: falta tipo de alta.");
  }
  return errors;
}

export function roundState(app) {
  app.state.moduleState.rondaPaquetes ||= {
    filters: { service: "Todos", query: "" },
    drafts: {},
    dischargeDrafts: {}
  };
  app.state.moduleState.rondaPaquetes.filters ||= { service: "Todos", query: "" };
  app.state.moduleState.rondaPaquetes.drafts ||= {};
  app.state.moduleState.rondaPaquetes.dischargeDrafts ||= {};
  return app.state.moduleState.rondaPaquetes;
}

export function reviewDraft(local, date, patientId, round = null) {
  const key = `${date}:${patientId}`;
  const roundKey = roundDraftKey(round);
  local.drafts[key] ||= draftFromRound(round, date, patientId);
  if (roundKey && local.drafts[key]._loadedRoundKey !== roundKey && !draftTouched(local.drafts[key])) {
    local.drafts[key] = draftFromRound(round, date, patientId);
  }
  return local.drafts[key];
}

export function draftFromRound(round = null, date = "", patientId = "") {
  const packageReviews = round?.packageReviews || [];
  return {
    _loadedRoundKey: roundDraftKey(round),
    removals: {},
    pendingText: (round?.pendingIssuesAdded || []).join(" | "),
    notes: round?.notes || "",
    patientMovement: round?.patientMovement ? {
      ...round.patientMovement,
      service: round.patientMovement.toService || round.patientMovement.service || "",
      bed: round.patientMovement.toBed || round.patientMovement.bed || "",
      _dirty: false
    } : {},
    quickDischarge: round?.quickDischarge ? { ...round.quickDischarge, _dirty: false } : { enabled: false },
    generalObservations: round?.generalObservations || "",
    generalObservationDate: normalizeDate(round?.generalObservationDate) || date,
    noInvasivesConfirmed: Boolean(round?.noInvasivesConfirmed),
    deviceDrafts: packageReviews.map((review, index) => ({
      ...defaultPreventiveDevice(review.packageType || "ESPECIAL"),
      ...review,
      draftId: review.packageReviewId || `${patientId}|${date}|${index}`,
      packageReviewId: review.packageReviewId || `${patientId}|${date}|${review.packageType || "paquete"}|${index}`,
      savedEpisodeId: review.savedEpisodeId || review.episodeId || "",
      episodeId: review.savedEpisodeId || review.episodeId || "",
      reviewDate: review.reviewDate || date,
      preventiveChecks: review.preventiveChecks || {},
      observations: review.observations || ""
    }))
  };
}

function roundDraftKey(round = null) {
  if (!round) return "";
  return [
    round.id || "",
    round.updatedAt || "",
    round.reviewedAt || "",
    round.status || "",
    JSON.stringify(round.packageReviews || []),
    JSON.stringify(round.pendingIssuesAdded || []),
    round.notes || "",
    JSON.stringify(round.patientMovement || {}),
    JSON.stringify(round.quickDischarge || {}),
    round.generalObservations || "",
    round.generalObservationDate || ""
  ].join("|");
}

function draftTouched(draft = {}) {
  return Boolean(
    draft.deviceDrafts?.length
    || Object.keys(draft.removals || {}).length
    || draft.pendingText
    || draft.notes
    || draft.patientMovement?._dirty
    || draft.quickDischarge?._dirty
    || draft.generalObservations
    || draft.noInvasivesConfirmed
  );
}

function clearReviewDraft(local, date, patientId) {
  delete local.drafts[`${date}:${patientId}`];
}

function resetDraft(draft) {
  draft.deviceDrafts = [];
  draft.removals = {};
  draft.pendingText = "";
  draft.notes = "";
  draft.patientMovement = {};
  draft.quickDischarge = { enabled: false };
  draft.generalObservations = "";
  draft.generalObservationDate = "";
  draft.noInvasivesConfirmed = false;
}

function isDischargeIssue(value = "") {
  const text = normalizeStatusKey(value);
  return text.includes("ALTA") || text.includes("MOVIDO") || text.includes("CONCILIACION");
}

import { el, notice } from "../../components/dom.js";
import { emptyModule } from "../../components/moduleLayout.js";
import { activeDevice, listDevicesForPatient } from "../../services/deviceService.js";
import { listActivePatients } from "../../services/patientService.js";
import { listRoundsForPatient, listTodayRounds } from "../../services/roundService.js";
import { renderDailyPreventiveHistoryPanel, renderPatientRoundSummary, renderPeSummaryPanel, renderSavedRoundPanel, upsertRoundById } from "./patientRoundPanels.js";
import { renderActiveDevicesPanel, renderAddPackagePanel, renderPreventiveActionsPanel } from "./preventiveForms.js";
import { renderRoundSaveBar } from "./roundNavigation.js";
import { upsertOrRemovePatient } from "./roundHelpers.js";
import { reviewDraft, roundState, savePatientRound } from "./saveRoundFlow.js";

export async function renderPatientRound(app, parsed) {
  const local = roundState(app);
  const date = parsed.date;
  const [patients, rounds, patientRounds, patientDevices] = await Promise.all([
    listActivePatients(),
    listTodayRounds(date),
    listRoundsForPatient(parsed.patientId),
    listDevicesForPatient(parsed.patientId)
  ]);
  const patient = patients.find(row => row.patientId === parsed.patientId);
  if (!patient) {
    return emptyModule("Paciente no encontrado", "El paciente pudo eliminarse del censo. La ronda y el mapa de camas siguen disponibles.");
  }
  let currentPatient = patient;
  let currentPatients = patients;
  const roundMap = new Map(rounds.map(row => [row.patientId, row]));
  const activeDevices = patientDevices.filter(activeDevice);
  const existingRound = roundMap.get(patient.patientId);
  let currentRound = existingRound;
  let currentPatientRounds = upsertRoundById(patientRounds, existingRound);
  const draft = reviewDraft(local, date, patient.patientId, existingRound);
  const page = el("div", { class: "patient-round stack" });
  let message = "";

  function redraw() {
    page.replaceChildren(
      renderPatientRoundSummary(currentPatient, date),
      message ? notice(message, message.includes("pendiente") || message.includes("falta") ? "warn" : "ok") : "",
      renderSavedRoundPanel(currentRound, draft, redraw),
      renderActiveDevicesPanel(activeDevices, draft, redraw),
      renderPeSummaryPanel(patient.patientId, date, currentPatientRounds, draft),
      renderDailyPreventiveHistoryPanel(date, patient.patientId, currentPatientRounds, patientDevices),
      renderAddPackagePanel(date, patient.patientId, draft, redraw),
      renderPreventiveActionsPanel(app, date, currentPatient, draft, redraw),
      renderRoundSaveBar(app, date, currentPatient, currentPatients, roundMap, draft, async (status, direction) => {
        const result = await savePatientRound(app, date, currentPatient, currentPatients, activeDevices, draft, status, direction);
        message = result.message || result;
        if (result.patient) {
          currentPatient = result.patient;
          currentPatients = upsertOrRemovePatient(currentPatients, result.patient);
        }
        if (result.savedRound) {
          currentRound = result.savedRound;
          currentPatientRounds = upsertRoundById(currentPatientRounds, result.savedRound);
          roundMap.set(currentPatient.patientId, result.savedRound);
        }
        if (!direction) redraw();
      })
    );
  }

  redraw();
  return page;
}

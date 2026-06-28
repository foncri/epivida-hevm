import { el } from "../../components/dom.js";
import { emptyModule, stats } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { loadPatientExpediente } from "../../services/expedienteService.js";
import { daysBetween, patientLabel, renderExpedienteSections, renderHero, renderSummary } from "./panels.js";
import { renderExpedientePrintPanel } from "./print.js";

export async function render({ app, route }) {
  const patientId = patientIdFromRoute(route.parts);
  if (!patientId) return emptyModule("Expediente", "Selecciona un paciente desde censo, ronda o seguimiento IAAS.");

  const expediente = await loadPatientExpediente(patientId);
  const patient = expediente?.patient;
  if (!patient) {
    return emptyModule("Paciente no encontrado", "El paciente pudo eliminarse del censo activo. Los datos clinico-operativos de ronda y paquetes se conservan en sus colecciones.");
  }

  const sectionState = app.state.moduleState.expedienteSections ||= {};
  const printState = app.state.moduleState.expedientePrint ||= {};
  sectionState[patientId] ||= { section: "resumen" };
  printState[patientId] ||= { ready: false };
  const rounds = expediente.rounds || [];
  const latestRound = rounds[0] || {};
  const body = el("div", { class: "expediente-page stack" });

  function redraw() {
    body.replaceChildren(
      renderHero(patient, {
        onPrint: () => {
          printState[patientId].ready = true;
          redraw();
        }
      }),
      stats([
        [String(daysBetween(patient.admissionDate || patient.currentAdmissionDate, todayIso()) ?? "NA"), "Estancia dias"],
        [String((expediente.activeDevices || []).length), "Invasivos activos"],
        [String((expediente.devices || []).length), "Episodios"],
        [String(rounds.length), "Rondas"],
        [String((expediente.iaasRows || []).length), "IAAS activas"]
      ]),
      renderSummary(patient, latestRound),
      renderExpedientePrintPanel(expediente, printState[patientId], redraw),
      renderExpedienteSections(patientId, expediente, sectionState[patientId])
    );
  }

  redraw();
  return body;
}

function patientIdFromRoute(parts = []) {
  if (parts[0] === "pacientes") return parts[1] || "";
  if (parts[0] === "expediente") return parts[1] || "";
  return "";
}

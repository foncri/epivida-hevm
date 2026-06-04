import { badge, button, el, notice, selectInput, table, textInput } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { devicesByPatient, listActiveDevices } from "../../services/deviceService.js";
import { filterPatients, listActivePatients, uniqueValues } from "../../services/patientService.js";
import { listTodayRounds, saveRoundReview } from "../../services/roundService.js";

export async function render({ app }) {
  const date = todayIso();
  const [patients, devices, rounds] = await Promise.all([listActivePatients(), listActiveDevices(), listTodayRounds(date)]);
  const deviceMap = devicesByPatient(devices);
  const reviewed = new Set(rounds.filter(row => row.status === "reviewed" || row.status === "revisado").map(row => row.patientId));
  const syncByPatient = new Map(rounds.map(row => [row.patientId, row.syncStatus || "server_synced"]));
  const filters = { query: "", service: "Todos" };
  let message = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = filterPatients(patients, filters);
    body.replaceChildren(
      message ? notice(message, message.includes("pendiente") ? "warn" : "ok") : "",
      stats([
        [String(patients.length), "Pacientes activos"],
        [String(reviewed.size), "Revisados hoy"],
        [String(devices.length), "Dispositivos activos"],
        [date, "Fecha de ronda"]
      ]),
      el("div", { class: "toolbar" }, [
        textInput({ placeholder: "Buscar cama o paciente", oninput: event => { filters.query = event.target.value; redraw(); } }),
        selectInput(uniqueValues(patients, "service"), { onchange: event => { filters.service = event.target.value; redraw(); } })
      ]),
      table(["Cama", "Paciente", "Servicio", "Dispositivos", "Estado", ""], visible.map(patient => {
        const count = (deviceMap.get(patient.patientId) || []).length;
        const isReviewed = reviewed.has(patient.patientId);
        return el("tr", {}, [
          el("td", {}, [patient.bed || patient.currentBed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
          el("td", {}, [patient.service || patient.currentService || ""]),
          el("td", {}, [String(count)]),
          el("td", {}, [roundBadge(isReviewed, syncByPatient.get(patient.patientId))]),
          el("td", {}, [button("Revisado", async () => {
            const saved = await saveRoundReview(app, { date, patientId: patient.patientId, service: patient.service || patient.currentService, bed: patient.bed || patient.currentBed, hasDevices: count > 0 });
            reviewed.add(patient.patientId);
            syncByPatient.set(patient.patientId, saved.syncStatus || "server_synced");
            message = saved.syncStatus === "local_pending"
              ? "Revision guardada localmente; queda pendiente de sincronizar."
              : "Revision sincronizada.";
            redraw();
          }, { class: "small ghost" })])
        ]);
      }))
    );
  }

  redraw();
  return modulePage("Ronda Paquetes", "Captura movil minima. Lee pacientes activos y dispositivos activos; guarda solo ronda.", [body]);
}

function roundBadge(isReviewed, syncStatus) {
  if (!isReviewed) return badge("Pendiente", "warn");
  if (syncStatus === "local_pending") return badge("Pendiente sync", "warn");
  return badge("Revisado", "ok");
}

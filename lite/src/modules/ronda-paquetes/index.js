import { button, el, selectInput, table, textInput } from "../../components/dom.js";
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
  const filters = { query: "", service: "Todos" };
  const body = el("div", { class: "stack" });

  function redraw() {
    const visible = filterPatients(patients, filters);
    body.replaceChildren(
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
          el("td", {}, [patient.bed || ""]),
          el("td", {}, [patient.patientName || patient.patientId || ""]),
          el("td", {}, [patient.service || ""]),
          el("td", {}, [String(count)]),
          el("td", {}, [el("span", { class: `badge ${isReviewed ? "ok" : "warn"}` }, [isReviewed ? "Revisado" : "Pendiente"])]),
          el("td", {}, [button("Revisado", async () => {
            await saveRoundReview(app, { date, patientId: patient.patientId, service: patient.service, bed: patient.bed, hasDevices: count > 0 });
            reviewed.add(patient.patientId);
            redraw();
          }, { class: "small ghost" })])
        ]);
      }))
    );
  }

  redraw();
  return modulePage("Ronda Paquetes", "Captura movil minima. Lee pacientes activos y dispositivos activos; guarda solo ronda.", [body]);
}

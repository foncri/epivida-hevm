import { button, el } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { listActiveDevices } from "../../services/deviceService.js";
import { listActiveIaas } from "../../services/iaasService.js";
import { listActivePatients } from "../../services/patientService.js";
import { downloadCsv } from "../../services/exportService.js";

export async function render({ app }) {
  return modulePage("Reportes", "Exportadores bajo demanda. No se cargan librerias Excel al inicio.", [
    el("section", { class: "row-list" }, [
      exportCard("Censo actual CSV", "patients_active", async () => downloadCsv(app, `epivida-censo-${todayIso()}.csv`, await listActivePatients(), { dataset: "patients_active" })),
      exportCard("Dispositivos activos CSV", "devices_active", async () => downloadCsv(app, `epivida-dispositivos-${todayIso()}.csv`, await listActiveDevices(), { dataset: "devices_active" })),
      exportCard("IAAS activas CSV", "iaas_active", async () => downloadCsv(app, `epivida-iaas-${todayIso()}.csv`, await listActiveIaas(), { dataset: "iaas_active" }))
    ])
  ]);
}

function exportCard(title, dataset, action) {
  return el("article", { class: "row-card" }, [
    el("strong", {}, [title]),
    el("span", { class: "muted" }, [`Fuente: ${dataset}.`]),
    button("Exportar", action, { class: "ghost" })
  ]);
}

import { el, table } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { listActiveDevices } from "../../services/deviceService.js";

export async function render() {
  const devices = await listActiveDevices();
  return modulePage("Dispositivos", "Dispositivos activos como modulo propio.", [
    stats([
      [String(devices.length), "Activos"],
      [String(new Set(devices.map(row => row.deviceType).filter(Boolean)).size), "Tipos"],
      [String(devices.filter(row => row.infectionSigns).length), "Con signos"],
      [String(devices.filter(row => row.careStatus === "pendiente").length), "Cuidados pendientes"]
    ]),
    table(["Paciente", "Tipo", "Sitio", "Instalacion", "Estado"], devices.map(device =>
      el("tr", {}, [
        el("td", {}, [device.patientName || device.patientId || ""]),
        el("td", {}, [device.deviceType || ""]),
        el("td", {}, [device.anatomicalSite || ""]),
        el("td", {}, [device.installationDate || ""]),
        el("td", {}, [device.careStatus || ""])
      ])
    ))
  ]);
}

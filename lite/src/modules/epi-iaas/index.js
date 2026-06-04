import { el, table } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { listActiveIaas } from "../../services/iaasService.js";

export async function render() {
  const rows = await listActiveIaas();
  return modulePage("EPI-IAAS", "Seguimiento IAAS independiente. No carga dashboard, ronda ni exportadores.", [
    stats([
      [String(rows.length), "IAAS activas"],
      [String(new Set(rows.map(row => row.service).filter(Boolean)).size), "Servicios"],
      [String(rows.filter(row => row.status === "sospecha").length), "Sospechas"],
      [String(rows.filter(row => row.status === "confirmada").length), "Confirmadas"]
    ]),
    table(["Paciente", "Servicio", "Cama", "Tipo", "Estado"], rows.map(row =>
      el("tr", {}, [
        el("td", {}, [row.patientName || row.patientId || ""]),
        el("td", {}, [row.service || ""]),
        el("td", {}, [row.bed || ""]),
        el("td", {}, [row.iaasType || ""]),
        el("td", {}, [row.status || ""])
      ])
    ))
  ]);
}

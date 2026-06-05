import { el, link } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { todaySnapshot } from "../../services/snapshotService.js";
import { listPendingWrites, syncQueueSummary } from "../../services/offlineQueueService.js";

export async function render({ app }) {
  const [snapshot, pendingWrites] = await Promise.all([todaySnapshot(), listPendingWrites()]);
  const syncSummary = syncQueueSummary(pendingWrites);
  const role = app.state.auth.profile?.role || "";
  return modulePage("Inicio", "Resumen operativo minimo desde daily_snapshots. No carga reportes ni historico.", [
    stats([
      [snapshot?.totalActivePatients ?? "0", "Pacientes activos"],
      [snapshot?.totalIAASActive ?? "0", "IAAS activas"],
      [snapshot?.totalDevicesActive ?? "0", "Dispositivos activos"],
      [String(syncSummary.pending || snapshot?.totalPendingIssues || 0), "Pendientes sync"],
      [String(syncSummary.blocked), "Sync bloqueada"]
    ]),
    el("section", { class: "row-list" }, [
      quick("Monitoreo epidemiologico", "#/monitoreo-epidemiologico", "Tabla rapida de pacientes activos."),
      role === "enfermeria" ? quick("Ronda paquetes", "#/ronda-paquetes", "Captura movil para enfermeria.") : "",
      role !== "enfermeria" ? quick("Censo", "#/censo", "Gestion de pacientes activos.") : "",
      role !== "enfermeria" ? quick("Reportes", "#/reportes", "Exportacion bajo demanda.") : ""
    ])
  ]);
}

function quick(title, href, text) {
  return el("article", { class: "row-card" }, [
    el("strong", {}, [title]),
    el("span", { class: "muted" }, [text]),
    link(href, "Abrir", { class: "button ghost" })
  ]);
}

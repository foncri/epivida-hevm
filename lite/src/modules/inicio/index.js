import { badge, el, link } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { loadOperationalAlerts } from "../../services/operationalAlertService.js";
import { todaySnapshot } from "../../services/snapshotService.js";
import { listPendingWrites, syncQueueSummary } from "../../services/offlineQueueService.js";

export async function render({ app }) {
  const [snapshot, pendingWrites, alerts] = await Promise.all([
    todaySnapshot(),
    listPendingWrites(),
    loadOperationalAlerts().catch(() => null)
  ]);
  const syncSummary = syncQueueSummary(pendingWrites);
  const role = app.state.auth.profile?.role || "";
  return modulePage("Inicio", "Resumen operativo minimo desde daily_snapshots. No carga reportes ni historico.", [
    stats([
      [snapshot?.totalActivePatients ?? "0", "Pacientes activos"],
      [snapshot?.totalIAASActive ?? "0", "IAAS activas"],
      [snapshot?.totalDevicesActive ?? "0", "Dispositivos activos"],
      [String(alerts?.totals?.roundPending ?? snapshot?.totalPendingIssues ?? 0), "Pendientes ronda"],
      [String(alerts?.totals?.culturesDue ?? 0), "Cultivos por recabar"],
      [String(syncSummary.pending || snapshot?.totalPendingIssues || 0), "Pendientes sync"],
      [String(syncSummary.blocked), "Sync bloqueada"]
    ]),
    alerts ? renderOperationalAlertPanels(alerts) : "",
    el("section", { class: "row-list" }, [
      quick("Monitoreo epidemiologico", "#/monitoreo-epidemiologico", "Tabla rapida de pacientes activos."),
      role === "enfermeria" ? quick("Ronda paquetes", "#/ronda-paquetes", "Captura movil para enfermeria.") : "",
      role !== "enfermeria" ? quick("Censo", "#/censo", "Gestion de pacientes activos.") : "",
      role !== "enfermeria" ? quick("Reportes", "#/reportes", "Exportacion bajo demanda.") : ""
    ])
  ]);
}

function renderOperationalAlertPanels(alerts) {
  return el("section", { class: "iaas-panel operational-alerts-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Alertas operativas"]),
        el("p", {}, [`Version ${alerts.version}. Fecha de ronda ${alerts.date}.`])
      ]),
      badge(String(totalAlertItems(alerts)), "warn")
    ]),
    el("div", { class: "operational-alert-grid" }, alerts.panels.map(renderOperationalAlertPanel))
  ]);
}

function renderOperationalAlertPanel(panel) {
  return el("article", { class: `operational-alert-card ${panel.key}` }, [
    el("div", { class: "operational-alert-card-head" }, [
      el("strong", {}, [panel.title]),
      link(panel.href, "Abrir", { class: "button ghost small" })
    ]),
    panel.items.length
      ? el("div", { class: "operational-alert-list" }, panel.items.map(renderOperationalAlertItem))
      : el("p", { class: "muted" }, ["Sin alertas visibles."])
  ]);
}

function renderOperationalAlertItem(item) {
  return link(item.href, `${item.title} - ${item.detail}`, { class: `operational-alert-item ${item.tone}` });
}

function totalAlertItems(alerts) {
  return alerts.panels.reduce((sum, panel) => sum + panel.items.length, 0);
}

function quick(title, href, text) {
  return el("article", { class: "row-card" }, [
    el("strong", {}, [title]),
    el("span", { class: "muted" }, [text]),
    link(href, "Abrir", { class: "button ghost" })
  ]);
}

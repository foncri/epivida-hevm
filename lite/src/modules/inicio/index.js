import { badge, el, link } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { loadOperationalAlerts } from "../../services/operationalAlertService.js";
import { snapshotTrend, todaySnapshot } from "../../services/snapshotService.js";
import { listPendingWrites, syncQueueSummary } from "../../services/offlineQueueService.js";

export async function render({ app }) {
  const [snapshot, trend, pendingWrites, alerts] = await Promise.all([
    todaySnapshot(),
    snapshotTrend(undefined, 7).catch(() => null),
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
    trend ? renderSnapshotTrendPanel(trend) : "",
    alerts ? renderOperationalAlertPanels(alerts) : "",
    el("section", { class: "row-list" }, [
      quick("Monitoreo epidemiologico", "#/monitoreo-epidemiologico", "Tabla rapida de pacientes activos."),
      role === "enfermeria" ? quick("Ronda paquetes", "#/ronda-paquetes", "Captura movil para enfermeria.") : "",
      role !== "enfermeria" ? quick("Censo", "#/censo", "Gestion de pacientes activos.") : "",
      role !== "enfermeria" ? quick("Reportes", "#/reportes", "Exportacion bajo demanda.") : ""
    ])
  ]);
}

function renderSnapshotTrendPanel(trend) {
  const latest = trend.latest;
  const rows = trend.rows || [];
  const patientPeak = Math.max(1, trend.peaks?.totalActivePatients || 0);
  const deltas = trend.deltas || {};
  return el("section", { class: "iaas-panel snapshot-trend-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Tendencia operativa"]),
        el("p", {}, [latest ? `Ultimo snapshot: ${latest.date}` : "Sin snapshots recientes."])
      ]),
      badge(`${trend.foundDays || 0}/${rows.length || 0}`, trend.foundDays ? "ok" : "neutral")
    ]),
    latest ? el("div", { class: "snapshot-delta-grid" }, [
      deltaCard("Pacientes", latest.totalActivePatients, deltas.totalActivePatients),
      deltaCard("IAAS", latest.totalIAASActive, deltas.totalIAASActive),
      deltaCard("Invasivos", latest.totalDevicesActive, deltas.totalDevicesActive),
      deltaCard("Pendientes", latest.totalPendingIssues, deltas.totalPendingIssues)
    ]) : "",
    el("div", { class: "snapshot-trend-bars" }, rows.map(row =>
      el("div", { class: `snapshot-trend-row ${row.found ? "" : "missing"}`.trim() }, [
        el("span", {}, [row.date.slice(5)]),
        el("div", { class: "snapshot-trend-track" }, [
          el("i", { style: { width: `${row.found ? Math.max(6, (row.totalActivePatients / patientPeak) * 100) : 0}%` } })
        ]),
        el("strong", {}, [row.found ? String(row.totalActivePatients) : "S/D"])
      ])
    ))
  ]);
}

function deltaCard(label, value, delta) {
  const tone = delta > 0 ? "warn" : delta < 0 ? "ok" : "neutral";
  const prefix = delta > 0 ? "+" : "";
  return el("article", { class: `snapshot-delta-card ${tone}` }, [
    el("span", {}, [label]),
    el("strong", {}, [String(value ?? 0)]),
    el("small", {}, [`${prefix}${delta || 0} vs previo`])
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

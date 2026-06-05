import { button, el, link, notice, table } from "../../components/dom.js";
import { firebaseConfigStatus } from "../../lib/config.js";
import { modulePage } from "../../components/moduleLayout.js";
import { loadCatalogs } from "../../services/catalogService.js";
import { clearBlockedWrites, flushPendingWrites, listPendingWrites, syncQueueSummary } from "../../services/offlineQueueService.js";

export async function render() {
  const catalogs = await loadCatalogs();
  const firebaseStatus = firebaseConfigStatus();
  let pending = await listPendingWrites();
  let message = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    const summary = syncQueueSummary(pending);
    body.replaceChildren(
      message ? notice(message, summary.pending || summary.blocked ? "warn" : "ok") : "",
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Firebase"]),
        el("span", { class: "muted" }, [firebaseStatus.ready ? `Configurado: ${firebaseStatus.projectId}` : "Pendiente de configuracion productiva."]),
        firebaseStatus.missing.length ? el("span", { class: "muted" }, [`Faltan: ${firebaseStatus.missing.join(", ")}`]) : "",
      ]),
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Catalogos detectados"]),
        el("span", { class: "muted" }, [String(catalogs.length)]),
        el("span", { class: "muted" }, ["No hay datos clinicos seed en la app Lite."])
      ]),
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Sincronizacion pendiente"]),
        el("span", { class: "muted" }, [`${summary.pending} reintentable(s). ${summary.blocked} bloqueada(s).`]),
        button("Reintentar sincronizacion", async () => {
          const result = await flushPendingWrites();
          pending = await listPendingWrites();
          message = `Intentos: ${result.attempted}. Sincronizadas: ${result.synced}. Pendientes: ${result.pending}. Bloqueadas: ${result.blocked}.`;
          redraw();
        }, { class: "ghost", disabled: summary.pending === 0 }),
        button("Descartar bloqueadas revisadas", async () => {
          if (!globalThis.confirm("Esto elimina solo errores bloqueados locales. Las escrituras pendientes reintentables se conservan. Continuar?")) return;
          const result = await clearBlockedWrites();
          pending = await listPendingWrites();
          message = `Bloqueadas descartadas: ${result.removed}. Restantes: ${result.remaining}.`;
          redraw();
        }, { class: "ghost", disabled: summary.blocked === 0 })
      ]),
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Migracion legacy"]),
        el("span", { class: "muted" }, ["Prepara un paquete JSON desde el store legacy sin subir datos al servidor."]),
        link("./tools/legacy-export/index.html", "Abrir herramienta", { class: "button ghost" })
      ]),
      table(["Modulo", "Entidad", "Estado", "Creado", "Intentos", "Error"], pending.map(item =>
        el("tr", {}, [
          el("td", {}, [item.module || item.collection || ""]),
          el("td", {}, [item.entityType || item.kind || ""]),
          el("td", {}, [item.status || "local_pending"]),
          el("td", {}, [item.createdAt || ""]),
          el("td", {}, [String(item.attempts || 0)]),
          el("td", {}, [item.error || ""])
        ])
      ))
    );
  }

  redraw();
  return modulePage("Admin", "Administracion minima: usuarios, roles y catalogos se integran por fases.", [
    body
  ]);
}

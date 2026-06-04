import { button, el, notice, table } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { loadCatalogs } from "../../services/catalogService.js";
import { flushPendingWrites, listPendingWrites } from "../../services/offlineQueueService.js";

export async function render() {
  const catalogs = await loadCatalogs();
  let pending = await listPendingWrites();
  let message = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    body.replaceChildren(
      message ? notice(message, pending.length ? "warn" : "ok") : "",
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Catalogos detectados"]),
        el("span", { class: "muted" }, [String(catalogs.length)]),
        el("span", { class: "muted" }, ["No hay datos clinicos seed en la app Lite."])
      ]),
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Sincronizacion pendiente"]),
        el("span", { class: "muted" }, [`${pending.length} operaciones locales pendientes.`]),
        button("Reintentar sincronizacion", async () => {
          const result = await flushPendingWrites();
          pending = await listPendingWrites();
          message = `Intentos: ${result.attempted}. Sincronizadas: ${result.synced}. Pendientes: ${result.pending}.`;
          redraw();
        }, { class: "ghost" })
      ]),
      table(["Modulo", "Entidad", "Creado", "Intentos", "Error"], pending.map(item =>
        el("tr", {}, [
          el("td", {}, [item.module || item.collection || ""]),
          el("td", {}, [item.entityType || item.kind || ""]),
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

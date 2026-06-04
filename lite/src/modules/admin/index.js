import { el } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { loadCatalogs } from "../../services/catalogService.js";

export async function render() {
  const catalogs = await loadCatalogs();
  return modulePage("Admin", "Administracion minima: usuarios, roles y catalogos se integran por fases.", [
    el("section", { class: "row-card" }, [
      el("strong", {}, ["Catalogos detectados"]),
      el("span", { class: "muted" }, [String(catalogs.length)]),
      el("span", { class: "muted" }, ["No hay datos clinicos seed en la app Lite."])
    ])
  ]);
}

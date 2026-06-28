import { button, el, field, notice, pagedTable, textareaInput } from "../../components/dom.js";
import { importCatalogEntries, parseCatalogImportText } from "../../services/catalogService.js";

const CATALOG_TYPE_LABELS = {
  services: "Servicios",
  known_beds: "Camas por servicio",
  device_types: "Dispositivos",
  culture_types: "Cultivos",
  culture_status: "Estados de cultivo",
  antimicrobials: "Antimicrobianos",
  antimicrobial_status: "Estados de antimicrobiano"
};

export function renderCatalogImportPanel(app, state, onImported, redraw) {
  const preview = state.preview;
  const acceptedRows = preview?.accepted || [];
  const rejectedRows = preview?.rejected || [];
  return el("div", { class: "form-card" }, [
    el("strong", {}, ["Importacion masiva controlada"]),
    el("span", { class: "muted" }, [
      "Pega CSV o TSV aprobado. Columnas: type, value, label, service, bed, order, version, active."
    ]),
    state.message ? notice(state.message, rejectedRows.length ? "warn" : "ok") : "",
    field("Catalogos CSV/TSV", textareaInput({
      name: "catalogImportText",
      rows: 6,
      value: state.text,
      placeholder: "type,value,label,service,bed,order,version,active\nservices,TERAPIA INTERMEDIA,Terapia intermedia,,,120,local,true\nknown_beds,,AIS 4,URGENCIAS,AIS 4,130,local,true",
      oninput: event => {
        state.text = event.currentTarget.value;
      }
    })),
    el("div", { class: "toolbar" }, [
      button("Previsualizar importacion", () => {
        state.preview = parseCatalogImportText(state.text, { defaultVersion: "admin-import" });
        state.message = `${state.preview.accepted.length} aceptada(s), ${state.preview.rejected.length} rechazada(s).`;
        redraw();
      }, { class: "ghost" }),
      button("Importar aceptados", async () => {
        if (!acceptedRows.length || state.importing) return;
        state.importing = true;
        state.message = "Importando catalogos aceptados...";
        redraw();
        try {
          const result = await importCatalogEntries(app, acceptedRows, { source: "admin_catalog_import" });
          await onImported(result);
          state.text = "";
          state.preview = null;
          state.message = `Importadas ${result.count} entrada(s).`;
        } catch (error) {
          state.message = error?.message || "No se pudo importar el catalogo.";
        } finally {
          state.importing = false;
          redraw();
        }
      }, { disabled: !acceptedRows.length || state.importing }),
      button("Limpiar importacion", () => {
        state.text = "";
        state.preview = null;
        state.message = "";
        redraw();
      }, { class: "ghost", disabled: !state.text && !state.preview })
    ]),
    preview ? el("div", { class: "stack compact" }, [
      preview.issues.length ? notice(preview.issues.join(" "), "warn") : "",
      el("span", { class: "muted" }, [`Detectadas ${preview.totalRows} fila(s). Delimitador: ${preview.delimiter === "\t" ? "tab" : preview.delimiter}.`]),
      acceptedRows.length ? pagedTable(["Tipo", "Valor", "Etiqueta", "Servicio", "Cama", "Version"], acceptedRows, row =>
        el("tr", {}, [
          el("td", {}, [catalogTypeLabel(row.type)]),
          el("td", {}, [row.value || ""]),
          el("td", {}, [row.label || ""]),
          el("td", {}, [row.service || ""]),
          el("td", {}, [row.bed || ""]),
          el("td", {}, [row.version || ""])
        ]),
        { pageSize: 10, threshold: 12 }
      ) : notice("No hay filas aceptadas.", "warn"),
      rejectedRows.length ? pagedTable(["Linea", "Error", "Valor"], rejectedRows, row =>
        el("tr", {}, [
          el("td", {}, [String(row.line)]),
          el("td", {}, [row.errors.join(" ")]),
          el("td", {}, [row.raw?.value || row.raw?.label || row.raw?.bed || ""])
        ]),
        { pageSize: 10, threshold: 12 }
      ) : ""
    ]) : ""
  ]);
}

function catalogTypeLabel(type) {
  return CATALOG_TYPE_LABELS[type] || type || "";
}

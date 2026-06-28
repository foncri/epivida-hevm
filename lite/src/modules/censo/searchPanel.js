import { button, checkboxInput, el, field, link, notice, table, textInput } from "../../components/dom.js";
import { getPatientById, searchPatientsIndex } from "../../services/patientService.js";

export function renderPatientSearchPanel(state, redraw) {
  state.query ||= "";
  state.rows ||= [];
  state.message ||= "";
  state.activeOnly ??= false;
  return el("section", { class: "form-card patient-search-panel" }, [
    el("h2", {}, ["Busqueda avanzada por indice"]),
    el("p", { class: "muted" }, ["Consulta `patients_search` por tokens limitados. No recorre historicos completos ni consulta por cada tecla."]),
    state.message ? notice(state.message, state.message.includes("Error") ? "warn" : "ok") : "",
    el("div", { class: "form-grid compact" }, [
      field("Texto", textInput({
        value: state.query,
        placeholder: "Nombre, cama, servicio, diagnostico o folio",
        oninput: event => {
          state.query = event.target.value;
        }
      })),
      field("Solo activos", checkboxInput({
        checked: Boolean(state.activeOnly),
        onchange: event => {
          state.activeOnly = event.target.checked;
        }
      }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Buscar indice", async () => {
        await runSearch(state);
        redraw();
      }, { class: "ghost" }),
      button("Limpiar", () => {
        state.query = "";
        state.rows = [];
        state.message = "";
        redraw();
      }, { class: "ghost" })
    ]),
    state.rows.length ? renderSearchResults(state.rows) : ""
  ]);
}

async function runSearch(state) {
  try {
    const indexRows = await searchPatientsIndex(state.query, { activeOnly: state.activeOnly, limit: 25 });
    const hydrated = await Promise.all(indexRows.map(async row => ({
      ...row,
      patient: await getPatientById(row.patientId).catch(() => null)
    })));
    state.rows = hydrated;
    state.message = `${hydrated.length} resultado(s) encontrados.`;
  } catch (error) {
    state.rows = [];
    state.message = `Error: ${error.message || "No se pudo buscar en el indice."}`;
  }
}

function renderSearchResults(rows) {
  return table(["Paciente", "Ubicacion", "Estado", "Dx", "Acciones"], rows.map(row => {
    const patient = row.patient || row;
    return el("tr", {}, [
      el("td", {}, [patient.patientName || row.patientName || row.patientId || ""]),
      el("td", {}, [[patient.service || row.service || "", patient.bed || row.bed || ""].filter(Boolean).join(" / ")]),
      el("td", {}, [patient.active === false || row.active === false ? "Archivado" : (patient.status || row.status || "Activo")]),
      el("td", {}, [patient.epidemiologicalDiagnosis || row.epidemiologicalDiagnosis || ""]),
      el("td", { class: "actions-cell" }, [
        link(`#/pacientes/${row.patientId}/expediente`, "Expediente", { class: "button small ghost" })
      ])
    ]);
  }));
}

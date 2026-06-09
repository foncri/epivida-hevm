import { badge, button, checkboxInput, dateInput, el, field, frameScheduler, notice, pagedTable, textareaInput } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { parseCensusInput } from "../../services/importService.js";
import { applyCensusImport, reconcileCensusRows } from "../../services/reconciliationService.js";
import { listActivePatients, sortPatientsByServiceBed } from "../../services/patientService.js";

export async function render({ app }) {
  const role = app.state.auth.profile?.role;
  const writable = canWrite("importar-censo", role);
  const activePatients = await listActivePatients();
  const state = {
    date: todayIso(),
    raw: "",
    parsed: null,
    preview: null,
    message: "",
    tone: "",
    archiveAbsent: false,
    saving: false
  };
  const body = el("div", { class: "stack" });

  function parseAndPreview() {
    state.parsed = parseCensusInput(state.raw);
    state.preview = reconcileCensusRows(state.parsed.rows, activePatients);
    state.message = state.parsed.rows.length
      ? `Preview listo: ${state.parsed.rows.length} fila(s) validas.`
      : "No se encontraron filas validas.";
    state.tone = state.parsed.rows.length ? "ok" : "warn";
    redraw();
  }

  async function savePreview() {
    if (!state.preview?.entries?.length || state.saving) return;
    const absentCount = state.preview.absent?.length || 0;
    const archiveText = state.archiveAbsent && absentCount ? ` Tambien se archivaran ${absentCount} ausente(s).` : "";
    if (!globalThis.confirm(`Guardar censo del ${state.date}?${archiveText}`)) return;
    state.saving = true;
    redraw();
    try {
      const result = await applyCensusImport(app, state.preview, {
        date: state.date,
        archiveAbsent: state.archiveAbsent,
        source: "manual"
      });
      state.message = result.syncStatus === "local_pending"
        ? "Importacion guardada localmente; queda pendiente de sincronizar."
        : `Importacion sincronizada: ${result.savedPatients.length} paciente(s).`;
      state.tone = result.syncStatus === "local_pending" ? "warn" : "ok";
      state.raw = "";
      state.parsed = null;
      state.preview = null;
    } catch (error) {
      state.message = error?.message || "No se pudo guardar la importacion.";
      state.tone = "warn";
    } finally {
      state.saving = false;
      redraw();
    }
  }

  function redraw() {
    body.replaceChildren(
      state.message ? notice(state.message, state.tone) : "",
      !writable ? notice("Tu rol puede ver censo, pero no importar ni modificar pacientes.", "warn") : "",
      renderInputPanel(state, writable, schedulePreview, parseAndPreview),
      state.parsed?.issues?.length ? renderIssues(state.parsed.issues) : "",
      state.preview ? renderPreview(state, savePreview) : "",
      renderActiveContext(activePatients)
    );
  }

  const schedulePreview = frameScheduler(() => {
    if (state.raw.trim().length > 40) parseAndPreview();
  });
  redraw();
  return modulePage("Importar censo", "Importacion manual con preview y conciliacion antes de guardar.", [body]);
}

function renderInputPanel(state, writable, schedulePreview, parseAndPreview) {
  const textArea = textareaInput({
    rows: 10,
    value: state.raw,
    placeholder: "Pega aqui columnas desde Excel/CSV: paciente, servicio, cama, edad, sexo, diagnostico...",
    disabled: !writable || state.saving,
    oninput: event => {
      state.raw = event.target.value;
      schedulePreview();
    }
  });
  const file = el("input", {
    type: "file",
    accept: ".csv,.txt,.tsv",
    disabled: !writable || state.saving,
    onchange: event => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      selected.text().then(text => {
        state.raw = text;
        parseAndPreview();
      });
    }
  });
  return el("section", { class: "form-card" }, [
    el("div", { class: "form-grid" }, [
      field("Fecha de censo", dateInput({ value: state.date, disabled: !writable || state.saving, onchange: event => { state.date = event.target.value || todayIso(); } })),
      field("Archivo CSV/TSV", file)
    ]),
    field("Datos del censo", textArea),
    el("div", { class: "toolbar" }, [
      button("Generar preview", parseAndPreview, { disabled: !writable || state.saving || !state.raw.trim() }),
      button("Limpiar", () => {
        state.raw = "";
        state.parsed = null;
        state.preview = null;
        state.message = "";
        parseAndPreview();
      }, { class: "ghost", disabled: !writable || state.saving })
    ])
  ]);
}

function renderIssues(issues = []) {
  return el("section", { class: "row-card" }, [
    el("strong", {}, ["Observaciones de importacion"]),
    ...issues.slice(0, 8).map(issue => el("span", { class: "muted" }, [issue])),
    issues.length > 8 ? el("span", { class: "muted" }, [`+${issues.length - 8} observacion(es) mas.`]) : ""
  ]);
}

function renderPreview(state, onSave) {
  const summary = state.preview.summary;
  const entries = state.preview.entries;
  const absent = sortPatientsByServiceBed(state.preview.absent.map(item => item.patient));
  return el("section", { class: "stack" }, [
    el("section", { class: "row-card" }, [
      el("strong", {}, ["Conciliacion"]),
      el("span", {}, [`${summary.newPatients} nuevo(s), ${summary.changedPatients} movido(s)/actualizado(s), ${summary.unchangedPatients} sin cambio, ${summary.duplicateRows} duplicado(s), ${summary.absentPatients} ausente(s).`]),
      absent.length ? field("Archivar ausentes confirmados", checkboxInput({
        checked: state.archiveAbsent,
        disabled: state.saving,
        onchange: event => { state.archiveAbsent = event.target.checked; }
      })) : "",
      button(state.saving ? "Guardando" : "Guardar importacion", onSave, {
        disabled: state.saving || !entries.length
      })
    ]),
    pagedTable(["Fila", "Accion", "Paciente", "Servicio", "Cama", "Cambios"], entries, entry =>
      el("tr", {}, [
        el("td", {}, [String(entry.row.sourceRow || "")]),
        el("td", {}, [badge(actionLabel(entry.action), actionTone(entry.action))]),
        el("td", {}, [entry.row.patientName || entry.patientId]),
        el("td", {}, [entry.row.service || ""]),
        el("td", {}, [entry.row.bed || ""]),
        el("td", {}, [entry.changes.join("; ") || (entry.duplicate ? "Duplicado en archivo" : "")])
      ])
    ),
    absent.length ? pagedTable(["Ausente", "Servicio", "Cama", "Estado"], absent, patient =>
      el("tr", {}, [
        el("td", {}, [patient.patientName || patient.patientId || ""]),
        el("td", {}, [patient.service || patient.currentService || ""]),
        el("td", {}, [patient.bed || patient.currentBed || ""]),
        el("td", {}, [patient.status || patient.currentState || ""])
      ])
    ) : ""
  ]);
}

function renderActiveContext(activePatients) {
  return el("section", { class: "row-card" }, [
    el("strong", {}, ["Censo activo actual"]),
    el("span", { class: "muted" }, [`${activePatients.length} paciente(s) activos cargados para conciliacion local.`])
  ]);
}

function actionLabel(action) {
  return {
    new: "Nuevo",
    move_or_update: "Actualizar",
    unchanged: "Sin cambio",
    duplicate: "Duplicado"
  }[action] || action;
}

function actionTone(action) {
  if (action === "new") return "ok";
  if (action === "move_or_update") return "warn";
  if (action === "duplicate") return "bad";
  return "";
}

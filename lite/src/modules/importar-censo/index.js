import { badge, button, checkboxInput, dateInput, el, field, frameScheduler, notice, pagedTable, selectInput, textareaInput } from "../../components/dom.js";
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
    sourceName: "",
    parsed: null,
    preview: null,
    importMode: "auto",
    message: "",
    tone: "",
    archiveAbsent: false,
    saving: false
  };
  const body = el("div", { class: "stack" });

  function parseAndPreview() {
    state.parsed = parseCensusInput(state.raw, { date: state.date, sourceName: state.sourceName });
    state.preview = reconcileCensusRows(state.parsed.rows, activePatients, { date: state.date, mode: state.importMode });
    state.message = state.parsed.rows.length
      ? `Preview listo: ${state.parsed.rows.length} fila(s) validas.`
      : "No se encontraron filas validas.";
    state.tone = state.parsed.rows.length ? "ok" : "warn";
    redraw();
  }

  async function readSelectedFile(selected) {
    state.message = `Leyendo ${selected.name || "archivo"}...`;
    state.tone = "";
    redraw();
    try {
      state.raw = await readImportFile(selected);
      state.sourceName = selected.name || "";
      parseAndPreview();
    } catch (error) {
      state.message = error?.message || "No se pudo leer el archivo.";
      state.tone = "warn";
      redraw();
    }
  }

  async function savePreview() {
    if (!state.preview?.entries?.length || state.saving) return;
    const absentCount = state.preview.absent?.length || 0;
    const archivableAbsent = (state.preview.absent || []).filter(item => item.canArchive !== false).length;
    const protectedAbsent = Math.max(0, absentCount - archivableAbsent);
    const archiveText = state.archiveAbsent && archivableAbsent ? ` Tambien se archivaran ${archivableAbsent} ausente(s) elegible(s).` : "";
    const reviewCount = state.archiveAbsent ? protectedAbsent : absentCount;
    const reviewText = reviewCount ? ` ${reviewCount} ausente(s) quedaran para revision.` : "";
    if (!globalThis.confirm(`Guardar censo del ${state.date}?${archiveText}${reviewText}`)) return;
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
        : `Importacion sincronizada: ${result.savedPatients.length} paciente(s), ${result.reviewedAbsent.length} ausente(s) en revision.`;
      state.tone = result.syncStatus === "local_pending" ? "warn" : "ok";
      state.raw = "";
      state.sourceName = "";
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
      renderInputPanel(state, writable, schedulePreview, parseAndPreview, readSelectedFile, redraw),
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

function renderInputPanel(state, writable, schedulePreview, parseAndPreview, readSelectedFile, redraw) {
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
    accept: ".csv,.txt,.tsv,.xlsx,.xlsm",
    disabled: !writable || state.saving,
    onchange: event => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      readSelectedFile(selected);
    }
  });
  return el("section", { class: "form-card" }, [
    el("div", { class: "form-grid" }, [
      field("Fecha de censo", dateInput({
        value: state.date,
        disabled: !writable || state.saving,
        onchange: event => {
          state.date = event.target.value || todayIso();
          if (state.raw.trim()) parseAndPreview();
        }
      })),
      field("Tipo de importacion", selectInput([
        ["auto", "Automatico"],
        ["full", "Completo"],
        ["partial", "Parcial"]
      ], {
        value: state.importMode,
        disabled: !writable || state.saving,
        onchange: event => {
          state.importMode = event.target.value || "auto";
          if (state.raw.trim()) parseAndPreview();
        }
      })),
      field("Archivo CSV/TSV/Excel", file)
    ]),
    field("Datos del censo", textArea),
    el("div", { class: "toolbar" }, [
      button("Generar preview", parseAndPreview, { disabled: !writable || state.saving || !state.raw.trim() }),
      button("Limpiar", () => {
        state.raw = "";
        state.sourceName = "";
        state.parsed = null;
        state.preview = null;
        state.message = "";
        redraw();
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
  const absentItems = state.preview.absent || [];
  const absent = sortPatientsByServiceBed(absentItems.map(item => item.patient));
  const absentByPatient = new Map(absentItems.map(item => [item.patientId, item]));
  const archivableAbsent = absentItems.filter(item => item.canArchive !== false).length;
  return el("section", { class: "stack" }, [
    el("section", { class: "row-card" }, [
      el("strong", {}, ["Conciliacion"]),
      el("span", {}, [`${scopeLabel(summary.importScope)}: ${summary.newPatients} nuevo(s), ${summary.changedPatients} movido(s)/actualizado(s), ${summary.unchangedPatients} sin cambio, ${summary.duplicateRows} duplicado(s), ${summary.conflictRows || 0} conflicto(s), ${summary.duplicateExistingRows || 0} duplicado(s) activo(s), ${summary.automaticDischarges || 0} alta(s) automatica(s), ${summary.absentPatients} ausente(s).`]),
      summary.preserveExistingPatients ? el("span", { class: "muted" }, ["Importacion parcial: conserva pacientes activos que no vienen en este archivo."]) : "",
      summary.reportedDischarges ? el("span", {}, [badge(`${summary.reportedDischarges} alta(s) reportada(s)`, "warn")]) : "",
      absent.length ? field(`Archivar ausentes confirmados (${archivableAbsent} elegible(s))`, checkboxInput({
        checked: state.archiveAbsent,
        disabled: state.saving || !archivableAbsent,
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
        el("td", {}, [entryDetails(entry)])
      ])
    ),
    absent.length ? pagedTable(["Ausente", "Servicio", "Cama", "Estado", "Conciliacion"], absent, patient => {
      const item = absentByPatient.get(patient.patientId || patient.id) || {};
      return el("tr", {}, [
        el("td", {}, [patient.patientName || patient.patientId || ""]),
        el("td", {}, [patient.service || patient.currentService || ""]),
        el("td", {}, [patient.bed || patient.currentBed || ""]),
        el("td", {}, [patient.status || patient.currentState || ""]),
        el("td", {}, [item.canArchive === false ? badge("Revisar protegido", "warn") : badge("Alta probable", "warn")])
      ]);
    }) : ""
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
    conflict: "Conflicto",
    duplicate: "Duplicado"
  }[action] || action;
}

function actionTone(action) {
  if (action === "new") return "ok";
  if (action === "move_or_update") return "warn";
  if (action === "conflict") return "bad";
  if (action === "duplicate") return "bad";
  return "";
}

function scopeLabel(scope = "") {
  if (scope === "full") return "Censo completo";
  if (scope === "partial") return "Censo parcial";
  return "Censo automatico";
}

function entryDetails(entry = {}) {
  const details = [];
  if (entry.changes?.length) details.push(entry.changes.join("; "));
  if (entry.row?.dischargeReported) {
    details.push(`Alta reportada: ${entry.row.dischargeType || "tipo pendiente"} ${entry.row.dischargeDate || ""}`.trim());
  }
  if (entry.row?.importAlerts?.length) details.push(entry.row.importAlerts.join("; "));
  if (entry.conflictReason) details.push(entry.conflictReason);
  if (entry.duplicateExisting?.length) {
    details.push(`Duplicado activo: ${entry.duplicateExisting.map(item => `${item.patientName || item.patientId} ${item.service || ""} ${item.bed || ""}`.trim()).join(" | ")}`);
  }
  if (entry.duplicate) details.push("Duplicado en archivo");
  return details.join("; ");
}

async function readImportFile(file) {
  if (isSpreadsheetFile(file)) {
    const { spreadsheetFileToTsv } = await import("../../services/excelImportService.js");
    return spreadsheetFileToTsv(file);
  }
  return file.text();
}

function isSpreadsheetFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return /\.(xlsx|xlsm)$/.test(name) || type.includes("spreadsheetml");
}

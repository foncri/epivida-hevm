import { badge, button, dateInput, el, field, notice, selectInput, table, textareaInput, textInput } from "./dom.js";
import { todayIso } from "../lib/date.js";
import { catalogOptions } from "../services/catalogService.js";
import { saveAntimicrobial } from "../services/antimicrobialService.js";
import { saveCulture } from "../services/cultureService.js";

export function renderClinicalFollowUpPanel({
  app,
  context = {},
  cultures = [],
  antimicrobials = [],
  catalogs = [],
  writable = false,
  onClose = null,
  onChanged = null
}) {
  const state = {
    cultures: [...cultures],
    antimicrobials: [...antimicrobials],
    editingCulture: null,
    editingAntimicrobial: null,
    message: ""
  };
  const root = el("section", { class: "iaas-panel clinical-followup-panel" });

  function redraw() {
    root.replaceChildren(
      state.message ? notice(state.message, state.message.includes("pendiente") ? "warn" : "ok") : "",
      el("div", { class: "expediente-history-header" }, [
        el("div", {}, [
          el("h2", {}, [context.title || "Microbiologia y tratamiento"]),
          el("p", { class: "muted" }, [contextSubtitle(context)])
        ]),
        onClose ? button("Cerrar panel", onClose, { class: "small ghost" }) : ""
      ]),
      writable ? el("div", { class: "toolbar" }, [
        button("Agregar cultivo", () => {
          state.editingCulture = defaultCulture(context);
          redraw();
        }, { class: "ghost" }),
        button("Agregar antimicrobiano", () => {
          state.editingAntimicrobial = defaultAntimicrobial(context);
          redraw();
        }, { class: "ghost" })
      ]) : "",
      state.editingCulture ? cultureForm(app, context, state, catalogs, saved => {
        state.cultures = upsertBy(state.cultures, saved, row => row.cultureId || row.id);
        state.editingCulture = null;
        state.message = saved.syncStatus === "local_pending"
          ? "Cultivo guardado localmente; queda pendiente de sincronizar."
          : "Cultivo sincronizado.";
        onChanged?.({ type: "culture", saved });
        redraw();
      }, () => {
        state.editingCulture = null;
        redraw();
      }) : "",
      state.editingAntimicrobial ? antimicrobialForm(app, context, state, catalogs, saved => {
        state.antimicrobials = upsertBy(state.antimicrobials, saved, row => row.antimicrobialId || row.id);
        state.editingAntimicrobial = null;
        state.message = saved.syncStatus === "local_pending"
          ? "Antimicrobiano guardado localmente; queda pendiente de sincronizar."
          : "Antimicrobiano sincronizado.";
        onChanged?.({ type: "antimicrobial", saved });
        redraw();
      }, () => {
        state.editingAntimicrobial = null;
        redraw();
      }) : "",
      renderCultureTable(state, writable, redraw),
      renderAntimicrobialTable(state, writable, redraw)
    );
  }

  redraw();
  return root;
}

function contextSubtitle(context = {}) {
  const parts = [
    context.patientName || context.patientId,
    context.iaasType,
    context.iaasId ? `Caso ${context.iaasId}` : ""
  ].filter(Boolean);
  return parts.join(" / ") || "Seguimiento por paciente.";
}

function defaultCulture(context = {}) {
  return {
    patientId: context.patientId || "",
    iaasId: context.iaasId || "",
    sampleType: "",
    requestedAt: todayIso(),
    resultDate: "",
    organism: "",
    susceptibility: "",
    status: "solicitado",
    woundSite: "",
    notes: ""
  };
}

function defaultAntimicrobial(context = {}) {
  return {
    patientId: context.patientId || "",
    iaasId: context.iaasId || "",
    drug: "",
    startDate: todayIso(),
    endDate: "",
    indication: context.iaasType || "",
    status: "activo",
    notes: ""
  };
}

function cultureForm(app, context, state, catalogs, onSaved, onCancel) {
  const culture = state.editingCulture || defaultCulture(context);
  const selectedSample = isOtherCulture(culture.sampleType) ? "Otro cultivo" : culture.sampleType || "";
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const sampleType = isOtherCulture(data.sampleType)
        ? data.customSampleType || "Otro cultivo"
        : data.sampleType;
      try {
        const saved = await saveCulture(app, {
          ...culture,
          patientId: context.patientId || culture.patientId,
          iaasId: context.iaasId || culture.iaasId || "",
          sampleType,
          requestedAt: data.requestedAt,
          resultDate: data.resultDate,
          organism: data.organism,
          susceptibility: data.susceptibility,
          status: data.status,
          woundSite: data.woundSite,
          notes: data.notes
        });
        onSaved(saved);
      } catch (error) {
        state.message = error.message || "No se pudo guardar el cultivo.";
        renderErrorLater(event.currentTarget, state.message);
      }
    }
  }, [
    el("div", { class: "form-grid compact" }, [
      field("Tipo de cultivo", selectInput(optionsWithCurrent(catalogOptions(catalogs, "culture_types"), selectedSample), { name: "sampleType", required: true, value: selectedSample })),
      field("Otro cultivo", textInput({ name: "customSampleType", value: isOtherCulture(culture.sampleType) ? culture.sampleType : "" })),
      field("Fecha de toma", dateInput({ name: "requestedAt", required: true, value: culture.requestedAt || todayIso() })),
      field("Fecha de resultado", dateInput({ name: "resultDate", value: culture.resultDate || "" })),
      field("Estado", selectInput(catalogOptions(catalogs, "culture_status"), { name: "status", value: culture.status || "solicitado" })),
      field("Sitio anatomico", textInput({ name: "woundSite", value: culture.woundSite || "" }))
    ]),
    el("div", { class: "form-grid compact" }, [
      field("Microorganismo aislado", textInput({ name: "organism", value: culture.organism || culture.microorganism || "" })),
      field("Susceptibilidad", textareaInput({ name: "susceptibility", rows: 3, value: culture.susceptibility || "" })),
      field("Notas", textareaInput({ name: "notes", rows: 3, value: culture.notes || "" }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Guardar cultivo", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function antimicrobialForm(app, context, state, catalogs, onSaved, onCancel) {
  const antimicrobial = state.editingAntimicrobial || defaultAntimicrobial(context);
  const selectedDrug = isOtherDrug(antimicrobial.drug) ? "Otro farmaco" : antimicrobial.drug || "";
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const drug = isOtherDrug(data.drug) ? data.customDrug || "Otro farmaco" : data.drug;
      try {
        const saved = await saveAntimicrobial(app, {
          ...antimicrobial,
          patientId: context.patientId || antimicrobial.patientId,
          iaasId: context.iaasId || antimicrobial.iaasId || "",
          drug,
          startDate: data.startDate,
          endDate: data.endDate,
          indication: data.indication,
          status: data.status,
          notes: data.notes
        });
        onSaved(saved);
      } catch (error) {
        state.message = error.message || "No se pudo guardar el antimicrobiano.";
        renderErrorLater(event.currentTarget, state.message);
      }
    }
  }, [
    el("div", { class: "form-grid compact" }, [
      field("Farmaco", selectInput(optionsWithCurrent(catalogOptions(catalogs, "antimicrobials"), selectedDrug), { name: "drug", required: true, value: selectedDrug })),
      field("Otro farmaco", textInput({ name: "customDrug", value: isOtherDrug(antimicrobial.drug) ? antimicrobial.drug : "" })),
      field("Inicio", dateInput({ name: "startDate", required: true, value: antimicrobial.startDate || todayIso() })),
      field("Fin", dateInput({ name: "endDate", value: antimicrobial.endDate || "" })),
      field("Estado", selectInput(catalogOptions(catalogs, "antimicrobial_status"), { name: "status", value: antimicrobial.status || "activo" }))
    ]),
    field("Indicacion", textareaInput({ name: "indication", rows: 3, value: antimicrobial.indication || context.iaasType || "" })),
    field("Notas", textareaInput({ name: "notes", rows: 3, value: antimicrobial.notes || "" })),
    el("div", { class: "toolbar" }, [
      button("Guardar antimicrobiano", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function renderCultureTable(state, writable, redraw) {
  return el("article", { class: "row-card" }, [
    el("strong", {}, ["Cultivos"]),
    table(["Fecha", "Muestra", "Estado", "Microorganismo", "Susceptibilidad", ...(writable ? ["Acciones"] : [])], state.cultures.map(culture =>
      el("tr", {}, [
        el("td", {}, [culture.requestedAt || "NA"]),
        el("td", {}, [culture.sampleType || ""]),
        el("td", {}, [statusBadge(culture.status)]),
        el("td", {}, [culture.organism || culture.microorganism || ""]),
        el("td", {}, [truncate(culture.susceptibility || "", 140)]),
        writable ? el("td", { class: "actions-cell" }, [
          button("Editar", () => {
            state.editingCulture = culture;
            redraw();
          }, { class: "small ghost" })
        ]) : ""
      ])
    ))
  ]);
}

function renderAntimicrobialTable(state, writable, redraw) {
  return el("article", { class: "row-card" }, [
    el("strong", {}, ["Antimicrobianos"]),
    table(["Inicio", "Fin", "Farmaco", "Indicacion", "Estado", ...(writable ? ["Acciones"] : [])], state.antimicrobials.map(row =>
      el("tr", {}, [
        el("td", {}, [row.startDate || "NA"]),
        el("td", {}, [row.endDate || "Activo"]),
        el("td", {}, [row.drug || ""]),
        el("td", {}, [truncate(row.indication || "", 140)]),
        el("td", {}, [statusBadge(row.status)]),
        writable ? el("td", { class: "actions-cell" }, [
          button("Editar", () => {
            state.editingAntimicrobial = row;
            redraw();
          }, { class: "small ghost" })
        ]) : ""
      ])
    ))
  ]);
}

function statusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  const tone = ["positivo", "activo", "resultado"].includes(normalized) ? "warn" : normalized === "completado" ? "ok" : "neutral";
  return badge(status || "Sin estado", tone);
}

function upsertBy(rows, saved, keyFn) {
  const key = keyFn(saved);
  const next = rows.filter(row => keyFn(row) !== key);
  next.unshift(saved);
  return next;
}

function isOtherCulture(value = "") {
  return String(value || "").toLowerCase().includes("otro");
}

function isOtherDrug(value = "") {
  return String(value || "").toLowerCase().includes("otro");
}

function optionsWithCurrent(options = [], current = "") {
  if (!current || options.some(([value]) => value === current)) return options;
  return [...options, [current, current]];
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}...` : text;
}

function renderErrorLater(form, message) {
  const current = form.querySelector(".notice.error");
  current?.remove();
  form.prepend(notice(message, "error"));
}

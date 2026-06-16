import { badge, button, el, table } from "./dom.js";

export function renderMicrobiologyDashboard({ summary, loading = false, onRefresh = () => {} }) {
  const data = summary || emptySummary();
  return el("section", { class: "iaas-panel microbiology-dashboard" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Tablero microbiologico"]),
        el("p", {}, [`Cultivos y antimicrobianos por estado, limite ${data.limit || 40} por consulta.`])
      ]),
      button(loading ? "Actualizando" : "Actualizar", onRefresh, { class: "ghost", disabled: loading })
    ]),
    el("div", { class: "stats-grid compact" }, [
      microStat(data.pendingCultures.length, "Cultivos pendientes", "warn"),
      microStat(data.resultCultures.length, "Resultados recientes", "neutral"),
      microStat(data.positiveCultures.length, "Positivos", data.positiveCultures.length ? "bad" : "ok"),
      microStat(data.activeAntimicrobials.length, "Antimicrobianos activos", "device")
    ]),
    el("div", { class: "form-grid compact" }, [
      microTable("Cultivos pendientes", ["Fecha", "Paciente", "Muestra", "Estado"], data.pendingCultures, row => [
        row.requestedAt || "",
        row.patientName || row.patientId || "",
        row.sampleType || "",
        row.syncStatus === "local_pending" ? badge("Pendiente sync", "warn") : row.status || ""
      ]),
      microTable("Resultados/positivos", ["Fecha", "Paciente", "Muestra", "Microorganismo"], data.resultCultures, row => [
        row.resultAt || row.requestedAt || "",
        row.patientName || row.patientId || "",
        row.sampleType || "",
        row.organism || row.status || ""
      ]),
      microTable("Antimicrobianos activos", ["Inicio", "Paciente", "Farmaco", "Indicacion"], data.activeAntimicrobials, row => [
        row.startDate || "",
        row.patientName || row.patientId || "",
        row.drug || "",
        row.indication || ""
      ])
    ]),
    data.updatedAt ? el("p", { class: "muted" }, [`Actualizado: ${data.updatedAt}`]) : ""
  ]);
}

function microStat(value, label, tone) {
  return el("article", { class: "stat-card" }, [
    el("strong", {}, [String(value)]),
    el("span", {}, [label]),
    badge(tone === "bad" ? "Atencion" : "Vigente", tone)
  ]);
}

function microTable(title, headers, rows, mapRow) {
  return el("article", { class: "row-card" }, [
    el("strong", {}, [title]),
    table(headers, rows.slice(0, 10).map(row =>
      el("tr", {}, mapRow(row).map(value => el("td", {}, [value])))
    ))
  ]);
}

function emptySummary() {
  return {
    updatedAt: "",
    limit: 40,
    pendingCultures: [],
    resultCultures: [],
    positiveCultures: [],
    activeAntimicrobials: []
  };
}

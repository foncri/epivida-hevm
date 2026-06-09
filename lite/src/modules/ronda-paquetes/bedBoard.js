import { el, field, selectInput } from "../../components/dom.js";
import { bedBoardItems, patientBed, patientLabel } from "./roundHelpers.js";
import { roundPatientHref, truncate } from "./roundPatientUtils.js";

export function renderBedBoard(patients, roundMap, date, serviceFilter = "Todos") {
  const items = bedBoardItems(patients, serviceFilter);
  let pending = 0;
  let reviewed = 0;
  const boardItems = items.map(item => {
    if (!item.patient) return item;
    const state = bedTileState(item.patient, roundMap);
    if (state.status === "overdue") pending += 1;
    if (state.status === "reviewed") reviewed += 1;
    return { ...item, state };
  });
  return el("section", { class: "bed-board preventive" }, [
    el("div", { class: "bed-board-head" }, [
      el("div", {}, [
        el("h2", {}, ["Mapa de camas preventivas"]),
        el("p", {}, ["Toca una cama para abrir el paciente. Las vacias quedan bloqueadas y las pendientes aparecen en rojo."])
      ]),
      el("div", { class: "bed-board-totals" }, [
        el("span", {}, [`${boardItems.length} cama(s)`]),
        el("span", {}, [`${reviewed} vistas`]),
        pending ? el("strong", {}, [`${pending} pendientes`]) : ""
      ])
    ]),
    el("div", { class: "bed-board-legend" }, [
      el("span", { class: "legend available" }, ["Disponible"]),
      el("span", { class: "legend vacant" }, ["Desocupada"]),
      el("span", { class: "legend reviewed" }, ["Vista"]),
      el("span", { class: "legend overdue" }, ["Pendiente"])
    ]),
    renderBedBoardPicker(boardItems, date),
    el("div", { class: "bed-board-grid" }, boardItems.map(item => renderBedTile(item, date, roundMap)))
  ]);
}

function renderBedBoardPicker(items, date) {
  const selectable = items.filter(item => item.patient && !item.state?.disabled);
  if (!selectable.length) return "";
  return field("Ir a cama preventiva", selectInput([
    ["", "Seleccionar cama disponible"],
    ...selectable.map(item => [item.patient.patientId, `Cama ${item.bed || patientBed(item.patient)} - ${patientLabel(item.patient)}`])
  ], {
    onchange: event => {
      if (event.target.value) location.hash = roundPatientHref(date, event.target.value);
    }
  }));
}

function renderBedTile(item, date, roundMap) {
  const bed = item.bed || patientBed(item.patient) || "S/C";
  if (!item.patient) {
    return el("button", { type: "button", class: "bed-tile vacant", disabled: true, "aria-label": `${bed}: Cama desocupada` }, [
      el("strong", {}, [bed]),
      el("span", {}, ["Vacia"]),
      el("small", {}, ["Sin paciente"])
    ]);
  }
  const state = item.state || bedTileState(item.patient, roundMap);
  return el("a", { class: `bed-tile ${state.status}`, href: roundPatientHref(date, item.patient.patientId), title: state.title, "aria-label": `${bed}: ${state.title}` }, [
    el("strong", {}, [bed]),
    el("span", {}, [state.label]),
    el("small", {}, [truncate(patientLabel(item.patient), 24)])
  ]);
}

export function bedTileState(patient, roundMap) {
  if (!patient?.patientId) return { status: "vacant", disabled: true, label: "Vacia", title: "Cama desocupada" };
  const round = roundMap.get(patient.patientId);
  if (round && ["reviewed", "revisado", "alerta"].includes(round.status)) return { status: "reviewed", disabled: false, label: "Vista", title: "Ronda preventiva guardada" };
  if (round?.status === "incompleto") return { status: "overdue", disabled: false, label: "Incompleta", title: "Ronda preventiva incompleta" };
  return { status: "overdue", disabled: false, label: "Pendiente", title: "Pendiente de ronda preventiva" };
}

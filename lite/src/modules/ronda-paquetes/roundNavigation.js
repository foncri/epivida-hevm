import { button, el } from "../../components/dom.js";
import { canWrite } from "../../lib/security.js";
import { bedTileState } from "./bedBoard.js";
import { normalizeServiceKey, patientBed, patientLabel, patientService, sortByServiceBed } from "./roundHelpers.js";
import { roundPatientHref, truncate } from "./roundPatientUtils.js";

export function renderRoundSaveBar(app, date, patient, patients, roundMap, draft, onSave) {
  const canEdit = canWrite("ronda-paquetes", app.state.auth.profile?.role);
  return el("div", { class: "round-save-bar" }, [
    renderRoundNavigationBoard(date, patient, patients, roundMap),
    button("Guardar como incompleto", () => canEdit && onSave("incompleto", false), { class: "ghost", disabled: !canEdit }),
    button("Marcar pendiente", () => canEdit && onSave("pendiente", false), { class: "ghost", disabled: !canEdit }),
    button("Guardar y anterior cama", () => canEdit && onSave("revisado", "previous"), { class: "primary", disabled: !canEdit }),
    button("Guardar", () => canEdit && onSave("revisado", false), { class: "primary", disabled: !canEdit }),
    button("Guardar y siguiente cama", () => canEdit && onSave("revisado", "next"), { class: "primary strong", disabled: !canEdit })
  ]);
}

export function renderRoundNavigationBoard(date, patient, patients, roundMap) {
  const service = patientService(patient);
  const serviceKey = normalizeServiceKey(service);
  const rows = patients.filter(row => normalizeServiceKey(patientService(row)) === serviceKey).sort(sortByServiceBed);
  const items = rows.map(row => ({ bed: patientBed(row), patient: row }));
  if (!items.length) return "";
  return el("div", { class: "round-nav-board preventive" }, [
    el("div", { class: "round-nav-head" }, [
      el("strong", {}, [`Camas ${service}`]),
      el("span", {}, ["Seleccionar cama"])
    ]),
    el("div", { class: "round-nav-grid" }, items.map(item => renderRoundNavTile(item, date, roundMap, patient.patientId)))
  ]);
}

function renderRoundNavTile(item, date, roundMap, currentPatientId) {
  const bed = item.bed || patientBed(item.patient) || "S/C";
  if (!item.patient) {
    return el("button", { type: "button", disabled: true, class: "bed-tile round-nav-tile vacant" }, [
      el("strong", {}, [bed]),
      el("span", {}, ["Vacia"]),
      el("small", {}, ["Sin paciente"])
    ]);
  }
  const state = bedTileState(item.patient, roundMap);
  return el("a", { href: roundPatientHref(date, item.patient.patientId), class: `bed-tile round-nav-tile ${state.status} ${item.patient.patientId === currentPatientId ? "current" : ""}` }, [
    el("strong", {}, [bed]),
    el("span", {}, [state.label]),
    el("small", {}, [truncate(patientLabel(item.patient), 22)])
  ]);
}

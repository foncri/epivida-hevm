import { badge, button, dateInput, el, field, notice, selectInput, textInput, textareaInput } from "../../components/dom.js";
import { normalizeDate } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import {
  defaultPreventiveDevice,
  deviceDisplayName,
  FRENCH_OPTIONS,
  ITS_DEVICE_TYPES,
  ITU_DEVICE_STATES,
  ITU_MATERIAL_TYPES,
  NAVM_DEVICE_TYPES,
  NAVM_ORAL_HYGIENE_TYPES,
  packageCreatesDevice,
  packageTone,
  PREVENTIVE_CHECKS,
  PREVENTIVE_PACKAGE_TYPES,
  preventiveCompliance,
  SPECIAL_DEVICE_TYPES,
  YES_NO_NA
} from "../../services/preventivePackageService.js";
import { DISCHARGE_SHIFTS, DISCHARGE_TYPES } from "./roundConstants.js";
import {
  compareBeds,
  knownBedsForService,
  normalizeRoundText,
  normalizeServiceKey,
  patientBed,
  patientService,
  ROUND_SERVICE_FILTERS,
  uniqueValues
} from "./roundHelpers.js";

export function renderActiveDevicesPanel(activeDevices, draft, redraw) {
  const hasAnyInvasive = activeDevices.length > 0 || draft.deviceDrafts.some(packageCreatesDevice);
  return el("section", { class: "iaas-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Dispositivos invasivos actuales"]),
        el("p", {}, ["Vista compacta para revisar tipo, French, instalacion, retiro y dias de invasivo."])
      ]),
      hasAnyInvasive ? badge(`${activeDevices.length} registrado(s)`, "device") : badge("Sin invasivos", "neutral")
    ]),
    activeDevices.length
      ? el("div", { class: "device-list compact-device-grid" }, activeDevices.map(device => renderActiveDevice(device, draft)))
      : el("p", { class: "muted" }, ["No hay invasivos activos capturados."]),
    !hasAnyInvasive ? button(draft.noInvasivesConfirmed ? "Sin invasivos confirmado" : "Confirmar sin invasivos", () => {
      draft.noInvasivesConfirmed = !draft.noInvasivesConfirmed;
      redraw();
    }, { class: draft.noInvasivesConfirmed ? "primary" : "ghost" }) : ""
  ]);
}

function renderActiveDevice(device, draft) {
  const removalDate = draft.removals[device.episodeId] || "";
  return el("article", { class: "active-device-card" }, [
    el("div", {}, [
      el("strong", {}, [deviceDisplayName(device)]),
      el("span", {}, [`Instalacion ${device.installationDate || "NA"} - ${device.french || "Sin French"}`]),
      el("small", {}, [device.preventivePackage || device.careStatus || "Activo"])
    ]),
    field("Fecha de retiro", dateInput({
      value: removalDate,
      onchange: event => {
        draft.removals[device.episodeId] = event.target.value;
      }
    }))
  ]);
}

export function renderAddPackagePanel(date, patientId, draft, redraw) {
  return el("section", { class: "iaas-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Agregar paquete preventivo"]),
        el("p", {}, ["Selecciona el paquete y captura solo los criterios necesarios para enfermeria."])
      ])
    ]),
    el("div", { class: "quick-device-grid package-selector-grid" }, PREVENTIVE_PACKAGE_TYPES.map(type =>
      button(type, () => {
        draft.deviceDrafts.push({ ...defaultPreventiveDevice(type), draftId: `${Date.now()}_${draft.deviceDrafts.length}` });
        redraw();
      }, { class: `quick-device package-selector ${packageTone(type)}` })
    )),
    draft.deviceDrafts.length
      ? el("div", { class: "device-drafts package-drafts" }, draft.deviceDrafts.map((device, index) => renderDeviceDraft(date, patientId, draft, device, index, redraw)))
      : ""
  ]);
}

function renderDeviceDraft(date, patientId, draft, device, index, redraw) {
  const packageType = device.packageType || device.deviceType;
  const checks = PREVENTIVE_CHECKS[packageType] || [];
  return el("article", { class: `device-draft package-draft ${packageTone(packageType)}` }, [
    el("div", { class: "device-draft-head" }, [
      el("div", {}, [
        el("strong", {}, [packageType]),
        el("span", {}, [packageCreatesDevice(device) ? "Registro de invasivo y paquete preventivo" : "Registro de paquete preventivo"])
      ]),
      button("Quitar", () => {
        draft.deviceDrafts.splice(index, 1);
        redraw();
      }, { class: "ghost small" })
    ]),
    renderPackageSpecificFields(device, redraw),
    checks.length ? el("div", { class: "preventive-check-grid" }, checks.map(([key, label]) =>
      renderCheckSelector(label, device.preventiveChecks?.[key], value => {
        device.preventiveChecks = { ...(device.preventiveChecks || {}), [key]: value };
        redraw();
      })
    )) : "",
    packageType === "NAVM" ? renderButtonGroup("Metodo higiene oral", NAVM_ORAL_HYGIENE_TYPES, device.oralHygieneMethod, value => {
      device.oralHygieneMethod = value;
      redraw();
    }) : "",
    checks.length ? el("div", { class: "compliance-box" }, [
      el("span", {}, ["% cumplimiento"]),
      el("strong", {}, [preventiveCompliance(device.preventiveChecks || {}) || "Pendiente"])
    ]) : "",
    field("Observaciones", textareaInput({
      value: device.observations || "",
      oninput: event => {
        device.observations = event.target.value;
      }
    }))
  ]);
}

function renderPackageSpecificFields(device, redraw) {
  const type = device.packageType || "";
  if (type === "ITS - CC") {
    return el("div", { class: "package-fields" }, [
      renderButtonGroup("Tipo de invasivo", ITS_DEVICE_TYPES, device.deviceType, value => {
        device.deviceType = value;
        if (value !== "CATT HD") device.deviceSubtype = "";
        redraw();
      }),
      device.deviceType === "CATT HD" ? renderButtonGroup("Tipo CATT HD", ["PERMACATH", "MAHURKAR"], device.deviceSubtype, value => {
        device.deviceSubtype = value;
        redraw();
      }) : "",
      renderButtonGroup("French", FRENCH_OPTIONS, device.french, value => {
        device.french = value;
        redraw();
      }),
      renderPackageDates(device)
    ]);
  }
  if (type === "ITU - CU") {
    return el("div", { class: "package-fields" }, [
      renderButtonGroup("Tipo de material", ITU_MATERIAL_TYPES, device.material, value => {
        device.material = value;
        redraw();
      }),
      renderButtonGroup("Estado", ITU_DEVICE_STATES, device.deviceState, value => {
        device.deviceState = value;
        redraw();
      }),
      renderButtonGroup("French", FRENCH_OPTIONS, device.french, value => {
        device.french = value;
        redraw();
      }),
      renderPackageDates(device)
    ]);
  }
  if (type === "NAVM") {
    return el("div", { class: "package-fields" }, [
      renderButtonGroup("Tipo de dispositivo", NAVM_DEVICE_TYPES, device.deviceType, value => {
        device.deviceType = value;
        redraw();
      }),
      renderButtonGroup("French", FRENCH_OPTIONS, device.french, value => {
        device.french = value;
        redraw();
      }),
      renderPackageDates(device)
    ]);
  }
  if (type === "ESPECIAL") {
    return el("div", { class: "package-fields" }, [
      renderButtonGroup("Invasivo especial", SPECIAL_DEVICE_TYPES, device.deviceType, value => {
        device.deviceType = value;
        redraw();
      }),
      renderPackageDates(device)
    ]);
  }
  return el("div", { class: "package-fields" }, [renderPackageDates(device, false)]);
}

function renderPackageDates(device, showInstallation = true) {
  return el("div", { class: "form-grid compact package-date-grid" }, [
    showInstallation ? field("Fecha de instalacion", dateInput({
      value: normalizeDate(device.installationDate) || "",
      oninput: event => {
        device.installationDate = event.target.value;
      }
    })) : "",
    showInstallation ? field("Fecha de retiro", dateInput({
      value: normalizeDate(device.removalDate) || "",
      oninput: event => {
        device.removalDate = event.target.value;
      }
    })) : ""
  ]);
}

function renderCheckSelector(label, value, onSelect) {
  return el("div", { class: "check-selector" }, [
    el("span", {}, [label]),
    el("div", { class: "button-segment" }, YES_NO_NA.map(item =>
      button(item, () => onSelect(item), { class: normalizeRoundText(value) === normalizeRoundText(item) ? "active" : "" })
    ))
  ]);
}

export function renderButtonGroup(label, values, value, onSelect, options = {}) {
  const disabled = Boolean(options.disabled);
  return el("div", { class: "button-group-field" }, [
    el("span", {}, [label]),
    el("div", { class: "button-chip-row" }, values.map(item =>
      button(item, () => !disabled && onSelect(item), {
        class: normalizeRoundText(value) === normalizeRoundText(item) ? "selected" : "ghost",
        disabled,
        "aria-pressed": normalizeRoundText(value) === normalizeRoundText(item) ? "true" : "false"
      })
    ))
  ]);
}

export function renderPreventiveActionsPanel(app, date, patient, draft, redraw) {
  ensurePatientActionDraft(draft, patient, date);
  const role = app.state.auth.profile?.role;
  const canEditCensus = canWrite("censo", role);
  const movement = draft.patientMovement;
  const discharge = draft.quickDischarge;
  const selectedService = movement.service || patientService(patient);
  const currentMovement = patientMovementChanged(patient, movement);
  const dischargeEnabled = Boolean(discharge.enabled);
  const bedOptions = patientMovementBedOptions(selectedService, patient, movement);

  return el("section", { class: "iaas-panel preventive-actions-panel" }, [
    el("div", { class: "iaas-panel-head compact" }, [
      el("div", {}, [
        el("h2", {}, ["Pendientes, movimientos y alta"]),
        el("p", {}, ["Control operativo de la cama durante la ronda preventiva."])
      ]),
      currentMovement ? badge("Movimiento preparado", "warn") : dischargeEnabled ? badge("Alta preparada", "warn") : badge("Sin cambios de censo", "neutral")
    ]),
    canEditCensus ? "" : notice("Tu perfil puede guardar la ronda, pero no modificar censo, cama o alta.", "warn"),
    el("div", { class: "preventive-actions-grid" }, [
      el("article", { class: "patient-action-card" }, [
        el("strong", {}, ["Movimiento de cama"]),
        el("div", { class: "form-grid compact" }, [
          field("Servicio", selectInput(patientMovementServiceOptions(patient, movement), {
            value: selectedService,
            disabled: !canEditCensus,
            onchange: event => {
              const nextService = event.target.value;
              const beds = patientMovementBedOptions(nextService, patient, {}, false);
              movement.service = nextService;
              movement.bed = beds[0]?.[0] || patientBed(patient);
              movement._dirty = true;
              redraw();
            }
          })),
          field("Cama", selectInput(bedOptions, {
            value: movement.bed || patientBed(patient),
            disabled: !canEditCensus,
            onchange: event => {
              movement.bed = event.target.value;
              movement._dirty = true;
              redraw();
            }
          }))
        ]),
        currentMovement ? el("small", { class: "muted" }, [`Actual: ${patientService(patient)} / ${patientBed(patient)}`]) : ""
      ]),
      el("article", { class: "patient-action-card" }, [
        el("strong", {}, ["Observaciones generales"]),
        el("div", { class: "form-grid compact" }, [
          field("Fecha", dateInput({
            value: draft.generalObservationDate || date,
            disabled: !canEditCensus,
            onchange: event => {
              draft.generalObservationDate = event.target.value;
            }
          }))
        ]),
        field("Observacion", textareaInput({
          value: draft.generalObservations || "",
          disabled: !canEditCensus,
          placeholder: "Cambios clinicos, vigilancia o contexto de censo",
          oninput: event => {
            draft.generalObservations = event.target.value;
          }
        }))
      ]),
      el("article", { class: "patient-action-card quick-discharge-card" }, [
        el("strong", {}, ["Alta rapida"]),
        renderButtonGroup("Confirmar alta", ["NO", "SI"], dischargeEnabled ? "SI" : "NO", value => {
          discharge.enabled = value === "SI";
          discharge._dirty = true;
          redraw();
        }, { disabled: !canEditCensus }),
        dischargeEnabled ? el("div", { class: "quick-discharge-fields" }, [
          field("Fecha de alta", dateInput({
            value: normalizeDate(discharge.date) || date,
            disabled: !canEditCensus,
            onchange: event => {
              discharge.date = event.target.value;
            }
          })),
          renderButtonGroup("Tipo", DISCHARGE_TYPES, discharge.type || DISCHARGE_TYPES[0], value => {
            discharge.type = value;
            discharge._dirty = true;
            redraw();
          }, { disabled: !canEditCensus }),
          renderButtonGroup("Turno", DISCHARGE_SHIFTS, discharge.shift || DISCHARGE_SHIFTS[DISCHARGE_SHIFTS.length - 1], value => {
            discharge.shift = value;
            discharge._dirty = true;
            redraw();
          }, { disabled: !canEditCensus }),
          normalizeRoundText(discharge.type) === "DEFUNCION" ? field("Folio certificado", textInput({
            value: discharge.deathCertificateFolio || "",
            disabled: !canEditCensus,
            oninput: event => {
              discharge.deathCertificateFolio = event.target.value;
            }
          })) : ""
        ]) : el("small", { class: "muted" }, ["El paciente permanece activo en censo."])
      ])
    ]),
    el("div", { class: "pending-notes-grid" }, [
      field("Agregar pendiente", textInput({
        value: draft.pendingText || "",
        placeholder: "Ej. confirmar retiro de CVC, revisar cultivo...",
        oninput: event => {
          draft.pendingText = event.target.value;
        }
      })),
      field("Notas cortas", textareaInput({
        value: draft.notes || "",
        oninput: event => {
          draft.notes = event.target.value;
        }
      }))
    ])
  ]);
}

export function ensurePatientActionDraft(draft, patient, date) {
  draft.patientMovement ||= {};
  draft.patientMovement.service ||= patientService(patient);
  draft.patientMovement.bed ||= patientBed(patient);
  draft.quickDischarge ||= {};
  if (draft.quickDischarge.enabled === undefined) draft.quickDischarge.enabled = false;
  draft.quickDischarge.date ||= date;
  draft.quickDischarge.type ||= DISCHARGE_TYPES[0];
  draft.quickDischarge.shift ||= DISCHARGE_SHIFTS[DISCHARGE_SHIFTS.length - 1];
  if (draft.generalObservationDate === undefined) draft.generalObservationDate = date;
  if (draft.generalObservations === undefined) draft.generalObservations = "";
  return draft;
}

function patientMovementServiceOptions(patient, movement = {}) {
  const values = uniqueValues([
    patientService(patient),
    movement.service,
    ...ROUND_SERVICE_FILTERS.filter(filter => filter.value !== "Todos").map(filter => filter.value)
  ]);
  return values.map(value => [value, serviceOptionLabel(value)]);
}

function serviceOptionLabel(value = "") {
  const key = normalizeServiceKey(value);
  return ROUND_SERVICE_FILTERS.find(filter => normalizeServiceKey(filter.value) === key)?.label || value || "SIN SERVICIO";
}

function patientMovementBedOptions(service, patient, movement = {}, includeCurrent = true) {
  const serviceKey = normalizeServiceKey(service);
  const values = [
    movement.bed,
    includeCurrent || normalizeServiceKey(patientService(patient)) === serviceKey ? patientBed(patient) : "",
    ...knownBedsForService(serviceKey)
  ];
  return uniqueValues(values).sort(compareBeds).map(value => [value, value]);
}

export function patientMovementChanged(patient, movement = {}) {
  if (!movement?._dirty) return false;
  return normalizeServiceKey(movement.service) !== normalizeServiceKey(patientService(patient))
    || normalizeRoundText(movement.bed) !== normalizeRoundText(patientBed(patient));
}

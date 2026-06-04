import { badge, button, dateInput, el, field, link, notice, selectInput, textInput, textareaInput } from "../../components/dom.js";
import { emptyModule, stats } from "../../components/moduleLayout.js";
import { todayIso, normalizeDate } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { devicesByPatient, listActiveDevices, removeDeviceEpisode, saveDeviceEpisode } from "../../services/deviceService.js";
import { filterPatients, listActivePatients } from "../../services/patientService.js";
import {
  defaultPreventiveDevice,
  deviceDisplayName,
  devicePackageSignal,
  FRENCH_OPTIONS,
  ITS_DEVICE_TYPES,
  ITU_DEVICE_STATES,
  ITU_MATERIAL_TYPES,
  NAVM_DEVICE_TYPES,
  NAVM_ORAL_HYGIENE_TYPES,
  packageCreatesDevice,
  packageReviewSummary,
  packageTone,
  PREVENTIVE_CHECKS,
  PREVENTIVE_PACKAGE_TYPES,
  preventiveCompliance,
  SPECIAL_DEVICE_TYPES,
  YES_NO_NA
} from "../../services/preventivePackageService.js";
import { listPendingWrites } from "../../services/offlineQueueService.js";
import { listTodayRounds, roundSessionForDate, saveRoundReview, saveRoundSession } from "../../services/roundService.js";

export async function render({ app, route }) {
  const parsed = parseRoundRoute(route.parts);
  if (parsed.patientId) return renderPatientRound(app, parsed);
  return renderRoundPage(app, parsed);
}

async function renderRoundPage(app, parsed) {
  const local = roundState(app);
  const date = parsed.date;
  const [patients, devices, rounds, pending, initialSession] = await Promise.all([
    listActivePatients(),
    listActiveDevices(),
    listTodayRounds(date),
    listPendingWrites().catch(() => []),
    roundSessionForDate(date)
  ]);
  const deviceMap = devicesByPatient(devices);
  const roundMap = new Map(rounds.map(row => [row.patientId, row]));
  let roundSession = initialSession || null;
  const page = el("div", { class: "round-page stack" });
  let message = "";

  function redraw() {
    const visible = filterAndSortRoundPatients(patients, local.filters);
    const roundStats = computeRoundStats(patients, visible, devices, roundMap, pending, roundSession);
    page.replaceChildren(
      renderRoundHeader(app, date, roundStats, savedSession => {
        roundSession = savedSession || roundSession;
      }, text => {
        message = text;
        redraw();
      }),
      message ? notice(message, message.includes("pendiente") ? "warn" : "ok") : "",
      renderServiceFilters(patients, local, redraw),
      renderBedBoard(visible, roundMap, date),
      renderPreventivePackagePanel(roundStats),
      stats([
        [String(roundStats.totalPatients), "Pacientes"],
        [String(roundStats.reviewedPatients), "Revisados"],
        [String(roundStats.pendingPatients), "Pendientes"],
        [String(roundStats.incompletePatients), "Incompletos"],
        [String(roundStats.activeAlerts), "Alertas"],
        [String(roundStats.syncPending), "Sync pendiente"]
      ]),
      renderRoundWorklistSummary(patients, visible, roundStats, local.filters.service),
      visible.length
        ? el("section", { class: "round-list" }, visible.map(patient => renderRoundCard(patient, deviceMap.get(patient.patientId) || [], roundMap.get(patient.patientId), date)))
        : renderEmptyBeds()
    );
  }

  redraw();
  return page;
}

function renderRoundHeader(app, date, roundStats, onSessionSaved, onMessage) {
  const canEdit = canWrite("ronda-paquetes", app.state.auth.profile?.role);
  const isClosed = roundStats.sessionStatus === "closed";
  const actionLabel = isClosed ? "Reabrir ronda" : roundStats.started ? "Ronda en curso" : "Iniciar ronda";
  const sessionTone = isClosed ? "neutral" : roundStats.sessionStatus === "in_progress" ? "ok" : "warn";
  return el("section", { class: "iaas-panel round-header" }, [
    el("div", {}, [
      el("h1", {}, ["Paquetes Preventivos"]),
      el("p", {}, ["Ronda movil por cama orientada a paquetes preventivos: CVC, cateter urinario, ventilacion mecanica e infeccion de sitio quirurgico."])
    ]),
    el("div", { class: "round-actions" }, [
      field("Fecha", dateInput({
        value: date,
        onchange: event => {
          const nextDate = normalizeDate(event.target.value) || todayIso();
          location.hash = `#/ronda/${nextDate}`;
        }
      })),
      roundStats.sessionLabel ? badge(roundStats.sessionLabel, sessionTone) : "",
      button(actionLabel, async () => {
        if (!canEdit) return onMessage("Tu perfil no puede iniciar la ronda.");
        const saved = await saveRoundSession(app, { date, status: "in_progress", startedAt: roundStats.startedAt || new Date().toISOString(), reopenedAt: isClosed ? new Date().toISOString() : "" });
        onSessionSaved(saved);
        onMessage(saved.syncStatus === "local_pending" ? "Ronda iniciada localmente; queda pendiente de sincronizar." : "Ronda iniciada.");
      }, { class: "primary" }),
      button("Cerrar ronda", async () => {
        if (!canEdit) return onMessage("Tu perfil no puede cerrar la ronda.");
        const saved = await saveRoundSession(app, { date, status: "closed", closedAt: new Date().toISOString(), reviewedPatients: roundStats.reviewedPatients });
        onSessionSaved(saved);
        onMessage(saved.syncStatus === "local_pending" ? "Cierre guardado localmente; queda pendiente de sincronizar." : "Ronda cerrada.");
      }, { class: "ghost", disabled: isClosed })
    ])
  ]);
}

function renderServiceFilters(patients, local, redraw) {
  const counts = serviceCounts(patients);
  const filters = ["Todos", ...counts.keys()];
  return el("section", { class: "service-filter round-service-filter", "aria-label": "Filtrar camas por servicio" }, [
    ...filters.map(service => {
      const active = local.filters.service === service;
      const count = service === "Todos" ? patients.length : counts.get(service) || 0;
      return button(service === "Todos" ? `Todos ${count}` : `${service} ${count}`, () => {
        local.filters.service = service;
        redraw();
      }, {
        class: `${active ? "active" : ""}${count ? "" : " empty"}`.trim(),
        "aria-pressed": active ? "true" : "false"
      });
    }),
    textInput({
      value: local.filters.query || "",
      placeholder: "Buscar cama, paciente o diagnostico",
      oninput: event => {
        local.filters.query = event.target.value;
        redraw();
      }
    })
  ]);
}

function renderBedBoard(patients, roundMap, date) {
  const items = bedBoardItems(patients);
  const pending = items.filter(item => item.patient && bedTileState(item.patient, roundMap).status === "overdue").length;
  const reviewed = items.filter(item => item.patient && bedTileState(item.patient, roundMap).status === "reviewed").length;
  return el("section", { class: "bed-board preventive" }, [
    el("div", { class: "bed-board-head" }, [
      el("div", {}, [
        el("h2", {}, ["Mapa de camas preventivas"]),
        el("p", {}, ["Toca una cama para abrir el paciente. Las vacias quedan bloqueadas y las pendientes aparecen en rojo."])
      ]),
      el("div", { class: "bed-board-totals" }, [
        el("span", {}, [`${items.length} cama(s)`]),
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
    renderBedBoardPicker(items, date, roundMap),
    el("div", { class: "bed-board-grid" }, items.map(item => renderBedTile(item, date, roundMap)))
  ]);
}

function renderBedBoardPicker(items, date, roundMap) {
  const selectable = items.filter(item => item.patient && !bedTileState(item.patient, roundMap).disabled);
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
  const state = bedTileState(item.patient, roundMap);
  return el("a", { class: `bed-tile ${state.status}`, href: roundPatientHref(date, item.patient.patientId), title: state.title, "aria-label": `${bed}: ${state.title}` }, [
    el("strong", {}, [bed]),
    el("span", {}, [state.label]),
    el("small", {}, [truncate(patientLabel(item.patient), 24)])
  ]);
}

function renderPreventivePackagePanel(roundStats) {
  const packages = [
    ["CVC", roundStats.cvcCount, "Fecha, sitio, curacion y datos locales de infeccion.", "Prioridad si >48 h", "cvc"],
    ["Cateter urinario", roundStats.foleyCount, "Necesidad diaria, fijacion, circuito y bolsa colectora.", "Retirar si no amerita", "foley"],
    ["Ventilacion mecanica", roundStats.navCount, "NAV: higiene oral, cabecera, sedacion, aspiracion y destete.", "Vigilar NAV", "nav"],
    ["ISQ", roundStats.isqCount, "Herida, profilaxis, fiebre, cultivo y datos de infeccion.", "Seguimiento quirurgico", "isq"]
  ];
  return el("section", { class: "preventive-command" }, [
    el("article", { class: "preventive-command-hero" }, [
      el("span", {}, ["Guia de revision"]),
      el("h2", {}, ["Ronda enfocada, menos escritura repetida"]),
      el("p", {}, ["Selecciona un servicio, revisa cama por cama y captura solo eventos clinico-operativos: invasivos activos, reinstalaciones, retiro, curacion, cuidado y signos de infeccion."])
    ]),
    el("div", { class: "preventive-package-grid" }, packages.map(([title, count, detail, action, tone]) =>
      el("article", { class: `preventive-package ${tone}` }, [
        el("div", { class: "package-icon", "aria-hidden": "true" }, [title.slice(0, 3)]),
        el("div", {}, [
          el("strong", {}, [String(count)]),
          el("span", {}, [title]),
          el("small", {}, [detail])
        ]),
        el("em", {}, [action])
      ])
    ))
  ]);
}

function renderRoundWorklistSummary(allPatients, visible, roundStats, selectedService) {
  const progress = roundStats.totalPatients ? Math.max(4, (roundStats.reviewedPatients / roundStats.totalPatients) * 100) : 4;
  return el("section", { class: "round-worklist-summary" }, [
    el("div", {}, [
      el("span", {}, ["Lista de trabajo"]),
      el("strong", {}, [selectedService === "Todos" ? "Todos los servicios" : selectedService]),
      el("small", {}, [`${visible.length} de ${allPatients.length} cama(s) visibles - ${roundStats.reviewedPatients} revisada(s) - ${roundStats.totalDevices} invasivo(s)`])
    ]),
    el("div", { class: "round-worklist-progress" }, [el("i", { style: { width: `${progress}%` } })])
  ]);
}

function renderRoundCard(patient, devices, round, date) {
  const signals = packageSignalsForPatient(patient, devices);
  const status = roundStatus(round);
  return el("article", { class: `round-card status-${status}` }, [
    el("div", { class: "round-card-main" }, [
      el("div", { class: "bed-badge" }, [patientBed(patient)]),
      el("div", {}, [
        el("strong", {}, [patientLabel(patient)]),
        el("span", {}, [patientService(patient)]),
        el("small", {}, [truncate(patientDiagnosis(patient) || "Sin diagnostico registrado", 110)])
      ])
    ]),
    el("div", { class: "round-card-tags" }, [
      roundBadge(round),
      badge(syncLabel(round?.syncStatus), round?.syncStatus === "local_pending" ? "warn" : "ok"),
      devices.length ? badge(`${devices.length} invasivo(s)`, "device") : badge("Sin invasivos activos", "neutral")
    ]),
    el("div", { class: "round-card-packages" }, signals.map(signal =>
      el("span", { class: signal.tone }, [signal.label])
    )),
    el("div", { class: "round-card-actions" }, [
      link(roundPatientHref(date, patient.patientId), "Revisar", { class: "button primary" }),
      link("#/dispositivos", "Dispositivos", { class: "button ghost" })
    ])
  ]);
}

async function renderPatientRound(app, parsed) {
  const local = roundState(app);
  const date = parsed.date;
  const [patients, devices, rounds] = await Promise.all([listActivePatients(), listActiveDevices(), listTodayRounds(date)]);
  const patient = patients.find(row => row.patientId === parsed.patientId);
  if (!patient) {
    return emptyModule("Paciente no encontrado", "El paciente pudo eliminarse del censo. La ronda y el mapa de camas siguen disponibles.");
  }
  const roundMap = new Map(rounds.map(row => [row.patientId, row]));
  const activeDevices = devices.filter(device => device.patientId === patient.patientId);
  const draft = reviewDraft(local, date, patient.patientId);
  const page = el("div", { class: "patient-round stack" });
  let message = "";

  function redraw() {
    page.replaceChildren(
      renderPatientRoundSummary(patient, date),
      message ? notice(message, message.includes("pendiente") || message.includes("falta") ? "warn" : "ok") : "",
      renderActiveDevicesPanel(activeDevices, draft, redraw),
      renderAddPackagePanel(date, patient.patientId, draft, redraw),
      renderPendingPanel(draft),
      renderRoundSaveBar(app, date, patient, patients, roundMap, draft, async (status, direction) => {
        message = await savePatientRound(app, date, patient, activeDevices, draft, status, direction);
        if (!direction) redraw();
      })
    );
  }

  redraw();
  return page;
}

function renderPatientRoundSummary(patient, date) {
  const stay = daysBetween(patient.admissionDate || patient.currentAdmissionDate, date);
  return el("section", { class: "iaas-panel patient-sticky-summary" }, [
    el("div", { class: "patient-summary-main" }, [
      link(`#/ronda/${date}`, "Volver al servicio", { class: "back-link" }),
      el("h1", {}, [`Cama ${patientBed(patient)} - ${patientLabel(patient)}`]),
      el("p", {}, [`${patientService(patient)} - Estancia: ${stay ?? "NA"} dias`]),
      el("small", {}, [patientDiagnosis(patient) || "Sin diagnostico registrado"])
    ]),
    el("div", { class: "patient-summary-side" }, [
      badge(patient.currentRiskLevel || patient.riskLevel || "Sin riesgo", "neutral")
    ])
  ]);
}

function renderActiveDevicesPanel(activeDevices, draft, redraw) {
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

function renderAddPackagePanel(date, patientId, draft, redraw) {
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

function renderButtonGroup(label, values, value, onSelect) {
  return el("div", { class: "button-group-field" }, [
    el("span", {}, [label]),
    el("div", { class: "button-chip-row" }, values.map(item =>
      button(item, () => onSelect(item), { class: normalizeRoundText(value) === normalizeRoundText(item) ? "selected" : "ghost" })
    ))
  ]);
}

function renderPendingPanel(draft) {
  return el("section", { class: "iaas-panel" }, [
    el("h2", {}, ["Pendientes y observaciones"]),
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
  ]);
}

function renderRoundSaveBar(app, date, patient, patients, roundMap, draft, onSave) {
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

function renderRoundNavigationBoard(date, patient, patients, roundMap) {
  const service = patientService(patient);
  const rows = patients.filter(row => patientService(row) === service).sort(sortByServiceBed);
  const items = bedBoardItems(rows);
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

async function savePatientRound(app, date, patient, activeDevices, draft, requestedStatus, direction) {
  const errors = validateDraft(draft, activeDevices, requestedStatus);
  if (errors.length) return errors.join(" ");
  const createdEpisodes = [];
  const packageReviews = [];

  for (const device of draft.deviceDrafts) {
    packageReviews.push(packageReviewSummary(device));
    if (!packageCreatesDevice(device) || !device.installationDate) continue;
    const saved = await saveDeviceEpisode(app, {
      patientId: patient.patientId,
      deviceType: device.deviceType,
      deviceSubtype: device.deviceSubtype || "",
      french: device.french || "",
      material: device.material || "",
      deviceState: device.deviceState || "",
      preventivePackage: device.packageType || "",
      preventiveChecks: device.preventiveChecks || {},
      preventiveCompliance: preventiveCompliance(device.preventiveChecks || {}),
      oralHygieneMethod: device.oralHygieneMethod || "",
      installationDate: device.installationDate,
      removalDate: device.removalDate || "",
      notes: [device.notes, device.observations].filter(Boolean).join(" | "),
      source: "nursing_round"
    });
    createdEpisodes.push(saved);
  }

  for (const [episodeId, removalDate] of Object.entries(draft.removals || {})) {
    if (!removalDate) continue;
    const device = activeDevices.find(item => item.episodeId === episodeId);
    if (device) await removeDeviceEpisode(app, device, removalDate);
  }

  const hasNoCheck = packageReviews.some(review => Object.values(review.preventiveChecks || {}).some(value => normalizeRoundText(value) === "NO"));
  const status = requestedStatus === "incompleto" ? "incompleto" : hasNoCheck ? "alerta" : requestedStatus;
  const saved = await saveRoundReview(app, {
    date,
    patientId: patient.patientId,
    service: patientService(patient),
    bed: patientBed(patient),
    status,
    hasDevices: activeDevices.length > 0 || createdEpisodes.length > 0,
    noInvasivesConfirmed: Boolean(draft.noInvasivesConfirmed) && !activeDevices.length && !createdEpisodes.length,
    reviewedDevices: [...activeDevices.map(device => device.episodeId), ...createdEpisodes.map(device => device.episodeId)].filter(Boolean),
    packageReviews,
    pendingIssuesAdded: draft.pendingText ? [draft.pendingText.trim()] : [],
    alertsGenerated: hasNoCheck ? ["Criterio preventivo marcado como NO."] : [],
    notes: draft.notes || "",
    activeRoundSection: "preventive"
  });
  resetDraft(draft);
  clearReviewDraft(roundState(app), date, patient.patientId);

  if (direction) {
    const target = navigationPatientId(date, patient, direction);
    location.hash = target ? roundPatientHref(date, target) : `#/ronda/${date}`;
    return "Revision guardada.";
  }
  return saved.syncStatus === "local_pending" ? "Revision guardada localmente; queda pendiente de sincronizar." : "Revision sincronizada.";
}

function validateDraft(draft, activeDevices, requestedStatus) {
  const errors = [];
  if (requestedStatus !== "incompleto") {
    draft.deviceDrafts.filter(packageCreatesDevice).forEach(device => {
      if (!device.installationDate) errors.push(`${deviceDisplayName(device)}: falta fecha de instalacion.`);
    });
    Object.entries(draft.removals || {}).forEach(([episodeId, removalDate]) => {
      const device = activeDevices.find(item => item.episodeId === episodeId);
      if (removalDate && device?.installationDate && removalDate < device.installationDate) {
        errors.push(`${deviceDisplayName(device)}: retiro antes de instalacion.`);
      }
    });
  }
  if (draft.noInvasivesConfirmed && activeDevices.length) errors.push("Hay invasivos activos. Registra retiro o guarda como incompleto.");
  return errors;
}

function roundState(app) {
  app.state.moduleState.rondaPaquetes ||= {
    filters: { service: "Todos", query: "" },
    drafts: {}
  };
  app.state.moduleState.rondaPaquetes.filters ||= { service: "Todos", query: "" };
  app.state.moduleState.rondaPaquetes.drafts ||= {};
  return app.state.moduleState.rondaPaquetes;
}

function reviewDraft(local, date, patientId) {
  const key = `${date}:${patientId}`;
  local.drafts[key] ||= {
    deviceDrafts: [],
    removals: {},
    pendingText: "",
    notes: "",
    noInvasivesConfirmed: false
  };
  return local.drafts[key];
}

function clearReviewDraft(local, date, patientId) {
  delete local.drafts[`${date}:${patientId}`];
}

function resetDraft(draft) {
  draft.deviceDrafts = [];
  draft.removals = {};
  draft.pendingText = "";
  draft.notes = "";
  draft.noInvasivesConfirmed = false;
}

function parseRoundRoute(parts = []) {
  const route = parts[0] || "ronda-paquetes";
  const first = normalizeDate(parts[1]);
  if (route === "ronda") {
    return { date: first || todayIso(), patientId: parts[2] === "paciente" ? parts[3] : "" };
  }
  if (parts[1] === "paciente") return { date: todayIso(), patientId: parts[2] || "" };
  return { date: first || todayIso(), patientId: parts[2] === "paciente" ? parts[3] : "" };
}

function filterAndSortRoundPatients(patients, filters) {
  return filterPatients(patients, filters).sort(sortByServiceBed);
}

function computeRoundStats(allPatients, visiblePatients, devices, roundMap, pending, roundSession = null) {
  const reviewedPatients = allPatients.filter(patient => ["reviewed", "revisado", "alerta"].includes(roundMap.get(patient.patientId)?.status)).length;
  const incompletePatients = allPatients.filter(patient => roundMap.get(patient.patientId)?.status === "incompleto").length;
  const activeAlerts = allPatients.filter(patient => roundMap.get(patient.patientId)?.status === "alerta").length;
  const sessionStatus = roundSession?.status || "";
  return {
    started: ["in_progress", "closed"].includes(sessionStatus) || reviewedPatients > 0,
    sessionStatus,
    sessionLabel: sessionStatus === "closed" ? "Ronda cerrada" : sessionStatus === "in_progress" ? "Ronda en curso" : "Ronda no iniciada",
    startedAt: roundSession?.startedAt || "",
    totalPatients: allPatients.length,
    reviewedPatients,
    pendingPatients: Math.max(0, allPatients.length - reviewedPatients - incompletePatients),
    incompletePatients,
    activeAlerts,
    syncPending: pending.filter(item => item.collection === "nursing_rounds" || item.collection === "devices_active" || item.collection === "round_sessions").length,
    totalDevices: devices.length,
    cvcCount: devices.filter(isCvcDevice).length,
    foleyCount: devices.filter(isFoleyDevice).length,
    navCount: devices.filter(isNavDevice).length,
    isqCount: visiblePatients.filter(isSurgicalSignal).length
  };
}

function serviceCounts(patients) {
  const map = new Map();
  patients.forEach(patient => {
    const service = patientService(patient);
    if (!service) return;
    map.set(service, (map.get(service) || 0) + 1);
  });
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "es")));
}

function bedBoardItems(patients) {
  const sorted = dedupeBedRows(patients).sort(sortByServiceBed);
  const services = new Set(sorted.map(patientService).filter(Boolean));
  if (services.size !== 1) return sorted.map(patient => ({ bed: patientBed(patient), patient }));
  const numericRows = sorted
    .map(patient => ({ patient, number: bedNumberToken(patientBed(patient)) }))
    .filter(item => Number.isFinite(item.number));
  if (numericRows.length < Math.max(3, Math.floor(sorted.length * 0.6))) return sorted.map(patient => ({ bed: patientBed(patient), patient }));
  const min = Math.min(...numericRows.map(item => item.number));
  const max = Math.max(...numericRows.map(item => item.number));
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min > 80) return sorted.map(patient => ({ bed: patientBed(patient), patient }));
  const byNumber = new Map(numericRows.map(item => [item.number, item.patient]));
  const inferred = [];
  for (let number = min; number <= max; number += 1) {
    const patient = byNumber.get(number) || null;
    inferred.push({ bed: patient ? patientBed(patient) : String(number), patient });
  }
  return inferred;
}

function dedupeBedRows(patients) {
  const map = new Map();
  patients.filter(patient => patient.active !== false).forEach(patient => {
    const key = `${patientService(patient)}|${normalizeRoundText(patientBed(patient))}`;
    if (!map.has(key)) map.set(key, patient);
  });
  return [...map.values()];
}

function bedTileState(patient, roundMap) {
  if (!patient?.patientId) return { status: "vacant", disabled: true, label: "Vacia", title: "Cama desocupada" };
  const round = roundMap.get(patient.patientId);
  if (round && ["reviewed", "revisado", "alerta"].includes(round.status)) return { status: "reviewed", disabled: false, label: "Vista", title: "Ronda preventiva guardada" };
  if (round?.status === "incompleto") return { status: "overdue", disabled: false, label: "Incompleta", title: "Ronda preventiva incompleta" };
  return { status: "overdue", disabled: false, label: "Pendiente", title: "Pendiente de ronda preventiva" };
}

function roundStatus(round) {
  if (!round?.status) return "pendiente";
  if (round.status === "reviewed") return "revisado";
  return round.status;
}

function roundBadge(round) {
  const status = roundStatus(round);
  if (status === "revisado") return badge("Revisado", "ok");
  if (status === "alerta") return badge("Alerta", "bad");
  if (status === "incompleto") return badge("Incompleto", "warn");
  return badge("Pendiente", "warn");
}

function syncLabel(syncStatus = "") {
  if (syncStatus === "local_pending") return "Pendiente sync";
  if (syncStatus === "error") return "Error sync";
  return "Sincronizado";
}

function packageSignalsForPatient(patient, devices) {
  const signals = devices.map(devicePackageSignal).filter(signal => signal.label && signal.tone !== "neutral");
  if (isSurgicalSignal(patient)) signals.push({ label: "ISQ", tone: "isq" });
  const deduped = new Map(signals.map(signal => [signal.label, signal]));
  if (!deduped.size) deduped.set("Valoracion rapida", { label: "Valoracion rapida", tone: "neutral" });
  return [...deduped.values()];
}

function navigationPatientId(date, patient, direction) {
  const rows = [...document.querySelectorAll(".round-nav-tile[href]")]
    .map(node => node.getAttribute("href") || "")
    .map(href => href.split("/").at(-1))
    .filter(Boolean);
  const index = rows.indexOf(patient.patientId);
  if (index === -1) return "";
  return direction === "previous" ? rows[index - 1] || "" : rows[index + 1] || "";
}

function roundPatientHref(date, patientId) {
  return `#/ronda/${date}/paciente/${patientId}`;
}

function patientLabel(patient = {}) {
  return patient.patientName || patient.name || patient.fullName || patient.patientId || "Paciente";
}

function patientService(patient = {}) {
  return patient.service || patient.currentService || "SIN SERVICIO";
}

function patientBed(patient = {}) {
  return patient.bed || patient.currentBed || "S/C";
}

function patientDiagnosis(patient = {}) {
  return patient.currentDiagnosis || patient.hospitalDiagnosis || patient.epidemiologicalDiagnosis || patient.currentEpidemiologicalDiagnosis || patient.diagnosis || "";
}

function sortByServiceBed(a, b) {
  return patientService(a).localeCompare(patientService(b), "es")
    || compareBeds(patientBed(a), patientBed(b))
    || patientLabel(a).localeCompare(patientLabel(b), "es");
}

function compareBeds(a, b) {
  const an = bedNumberToken(a);
  const bn = bedNumberToken(b);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
  return String(a || "").localeCompare(String(b || ""), "es", { numeric: true });
}

function bedNumberToken(bed) {
  const match = String(bed || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function daysBetween(start, end) {
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (!startDate || !endDate) return null;
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.floor((endMs - startMs) / 86400000));
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}...` : text;
}

function normalizeRoundText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function isCvcDevice(device) {
  return ["CVC", "CVPC", "PICC", "CATT HD", "C. PUERTO", "ONFALOCLISIS", "ITS - CC"].includes(device.deviceType) || device.preventivePackage === "ITS - CC";
}

function isFoleyDevice(device) {
  return device.deviceType === "Sonda Foley" || device.preventivePackage === "ITU - CU";
}

function isNavDevice(device) {
  const text = normalizeRoundText([device.deviceType, device.preventivePackage].join(" "));
  return /NAVM|VENTILACION|ENDOTRAQUEAL|TRAQUEOSTOMIA|CPAP|BPAP|COT|CET/.test(text);
}

function isSurgicalSignal(patient = {}) {
  const text = normalizeRoundText([
    patient.currentService,
    patient.service,
    patient.currentDiagnosis,
    patient.hospitalDiagnosis,
    patient.epidemiologicalDiagnosis,
    patient.currentEpidemiologicalDiagnosis,
    patient.notes
  ].filter(Boolean).join(" "));
  return /QUIRURG|CIRUG|TRAUMATOLOG|HERIDA|ISQ|POST ?OP|POP|LAPE|COLEC|FRACTURA|TUMOR|COLOSTOM/.test(text);
}

function renderEmptyBeds() {
  return el("section", { class: "empty-state compact" }, [
    el("h1", {}, ["Sin camas visibles"]),
    el("p", {}, ["No hay pacientes activos para este filtro. Puedes limpiar pacientes sin perder la tecnologia de ronda, camas y paquetes preventivos."])
  ]);
}

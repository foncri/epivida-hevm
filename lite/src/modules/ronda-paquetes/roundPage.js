import { badge, button, dateInput, el, field, frameScheduler, link, notice, textInput } from "../../components/dom.js";
import { stats } from "../../components/moduleLayout.js";
import { todayIso, normalizeDate } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { loadCatalogs } from "../../services/catalogService.js";
import { devicesByPatient, listActiveDevices } from "../../services/deviceService.js";
import { listActivePatients } from "../../services/patientService.js";
import { devicePackageSignal } from "../../services/preventivePackageService.js";
import { listPendingWrites } from "../../services/offlineQueueService.js";
import { listTodayRounds, roundSessionForDate, saveRoundSession } from "../../services/roundService.js";
import { renderBedBoard } from "./bedBoard.js";
import { renderDischargeReviewPanel } from "./dischargeReviewPanel.js";
import {
  filterAndSortRoundPatients,
  normalizeServiceKey,
  patientBed,
  patientDiagnosis,
  patientLabel,
  patientService,
  ROUND_SERVICE_FILTERS,
  upsertOrRemovePatient
} from "./roundHelpers.js";
import {
  isCvcDevice,
  isFoleyDevice,
  isNavDevice,
  isSurgicalSignal,
  roundStatus,
  roundPatientHref,
  syncLabel,
  truncate
} from "./roundPatientUtils.js";
import { roundState } from "./saveRoundFlow.js";

export async function renderRoundPage(app, parsed) {
  const local = roundState(app);
  const date = parsed.date;
  const [initialPatients, devices, rounds, pending, initialSession, catalogs] = await Promise.all([
    listActivePatients(),
    listActiveDevices(),
    listTodayRounds(date),
    listPendingWrites().catch(() => []),
    roundSessionForDate(date),
    loadCatalogs()
  ]);
  let patients = initialPatients;
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
      renderServiceFilters(patients, local, redraw, scheduleRedraw),
      renderBedBoard(visible, roundMap, date, local.filters.service, catalogs),
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
      renderDischargeReviewPanel(app, local, date, patients, (saved, text) => {
        patients = upsertOrRemovePatient(patients, saved);
        message = text;
        redraw();
      }),
      visible.length
        ? el("section", { class: "round-list" }, visible.map(patient => renderRoundCard(patient, deviceMap.get(patient.patientId) || [], roundMap.get(patient.patientId), date)))
        : renderEmptyBeds()
    );
  }

  const scheduleRedraw = frameScheduler(redraw);
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

function renderServiceFilters(patients, local, redraw, scheduleRedraw = redraw) {
  const { counts, activeCount } = serviceCounts(patients);
  const knownKeys = new Set(ROUND_SERVICE_FILTERS.map(filter => normalizeServiceKey(filter.value)));
  const extraFilters = [...counts.keys()]
    .filter(key => !knownKeys.has(key))
    .map(key => ({ value: counts.get(key).label, label: counts.get(key).label }));
  const filters = [...ROUND_SERVICE_FILTERS, ...extraFilters];
  return el("section", { class: "service-filter round-service-filter", "aria-label": "Filtrar camas por servicio" }, [
    ...filters.map(filter => {
      const key = normalizeServiceKey(filter.value);
      const active = normalizeServiceKey(local.filters.service) === key;
      const count = filter.value === "Todos" ? activeCount : counts.get(key)?.count || 0;
      return button(`${filter.label} ${count}`, () => {
        local.filters.service = filter.value;
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
        scheduleRedraw();
      }
    })
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
      link(`#/pacientes/${patient.patientId}/expediente`, "Expediente", { class: "button ghost" })
    ])
  ]);
}

function computeRoundStats(allPatients, visiblePatients, devices, roundMap, pending, roundSession = null) {
  let reviewedPatients = 0;
  let incompletePatients = 0;
  let activeAlerts = 0;
  let isqCount = 0;
  for (const patient of allPatients) {
    const status = roundMap.get(patient.patientId)?.status;
    if (status === "alerta") activeAlerts += 1;
    if (["reviewed", "revisado", "alerta"].includes(status)) reviewedPatients += 1;
    else if (status === "incompleto") incompletePatients += 1;
  }
  for (const patient of visiblePatients) {
    if (isSurgicalSignal(patient)) isqCount += 1;
  }
  let cvcCount = 0;
  let foleyCount = 0;
  let navCount = 0;
  for (const device of devices) {
    if (isCvcDevice(device)) cvcCount += 1;
    if (isFoleyDevice(device)) foleyCount += 1;
    if (isNavDevice(device)) navCount += 1;
  }
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
    cvcCount,
    foleyCount,
    navCount,
    isqCount
  };
}

function serviceCounts(patients) {
  const counts = new Map();
  let activeCount = 0;
  for (const patient of patients) {
    if (patient.active === false) continue;
    activeCount += 1;
    const service = patientService(patient);
    if (!service) continue;
    const key = normalizeServiceKey(service);
    const current = counts.get(key) || { label: service, count: 0 };
    counts.set(key, { label: current.label, count: current.count + 1 });
  }
  return {
    counts: new Map([...counts.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, "es"))),
    activeCount
  };
}

function roundBadge(round) {
  const status = roundStatus(round);
  if (status === "revisado") return badge("Revisado", "ok");
  if (status === "alerta") return badge("Alerta", "bad");
  if (status === "incompleto") return badge("Incompleto", "warn");
  return badge("Pendiente", "warn");
}

function packageSignalsForPatient(patient, devices) {
  const signals = devices.map(devicePackageSignal).filter(signal => signal.label && signal.tone !== "neutral");
  if (isSurgicalSignal(patient)) signals.push({ label: "ISQ", tone: "isq" });
  const deduped = new Map(signals.map(signal => [signal.label, signal]));
  if (!deduped.size) deduped.set("Valoracion rapida", { label: "Valoracion rapida", tone: "neutral" });
  return [...deduped.values()];
}

function renderEmptyBeds() {
  return el("section", { class: "empty-state compact" }, [
    el("h1", {}, ["Sin camas visibles"]),
    el("p", {}, ["No hay pacientes activos para este filtro. Puedes limpiar pacientes sin perder la tecnologia de ronda, camas y paquetes preventivos."])
  ]);
}

import { badge, button, el, link, notice, pagedTable } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { listAuditForEntity } from "../../services/auditService.js";
import { loadCatalogs } from "../../services/catalogService.js";
import { activeDevice, listActiveDevices, listArchivedDevicesForPatient, listDevicesForPatient, removeDeviceEpisode } from "../../services/deviceService.js";
import { getPatientById, listActivePatients } from "../../services/patientService.js";
import { careLabel, deviceForm, deviceSaveMessage, deviceTypeLabel, patientName, reinstallationDraft, renderDeviceHistoryPanel, renderDeviceTimelinePanel, upsertArchivedDevice, upsertDevice } from "./deviceForms.js";

export async function render({ app, route }) {
  const routePatientId = patientIdFromRoute(route);
  const [initialDevices, patients, catalogs, initialArchivedDevices] = await Promise.all([
    routePatientId ? listDevicesForPatient(routePatientId).then(rows => rows.filter(activeDevice)) : listActiveDevices(),
    routePatientId ? getPatientById(routePatientId).then(patient => patient ? [patient] : []) : listActivePatients(),
    loadCatalogs(),
    routePatientId ? listArchivedDevicesForPatient(routePatientId, { limit: 100 }) : Promise.resolve([])
  ]);
  let devices = initialDevices;
  const role = app.state.auth.profile?.role;
  const writable = canWrite("dispositivos", role);
  let editing = null;
  let editingArchive = null;
  let archivedDevices = initialArchivedDevices;
  let selectedPatientId = routePatientId;
  let timelineDevice = null;
  let timelineRows = [];
  let message = "";
  let historyMessage = routePatientId ? `${archivedDevices.length} episodio(s) retirado(s) cargado(s).` : "";
  let timelineMessage = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    body.replaceChildren(
      message ? notice(message, message.includes("pendiente") ? "warn" : "ok") : "",
      routePatientId ? renderPatientRouteContext(routePatientId, patients[0]) : "",
      stats([
        [String(devices.length), "Activos"],
        [String(new Set(devices.map(row => row.deviceType).filter(Boolean)).size), "Tipos"],
        [String(devices.filter(row => row.infectionSigns).length), "Con signos"],
        [String(devices.filter(row => row.careStatus === "pendiente").length), "Cuidados pendientes"]
      ]),
      editing ? deviceForm(app, editing, patients, saved => {
        devices = upsertDevice(devices, saved);
        editing = null;
        message = deviceSaveMessage(saved);
        redraw();
      }, () => { editing = null; redraw(); }, catalogs) : "",
      renderDeviceHistoryPanel({
        app,
        patients,
        catalogs,
        writable,
        selectedPatientId,
        archivedDevices,
        editingArchive,
        message: historyMessage,
        onLoad: loadHistory,
        onEdit: device => { editingArchive = device; redraw(); },
        onReinstall: device => {
          editing = reinstallationDraft(device);
          selectedPatientId = device.patientId || selectedPatientId;
          message = `Reinstalacion preparada desde episodio ${device.episodeId || device.id || "historico"}. Revisa fecha y guarda.`;
          redraw();
        },
        onTimeline: loadTimeline,
        onCancel: () => { editingArchive = null; redraw(); },
        onSaved: saved => {
          archivedDevices = upsertArchivedDevice(archivedDevices, saved);
          editingArchive = null;
          historyMessage = saved.syncStatus === "local_pending"
            ? "Historico guardado localmente; queda pendiente de sincronizar."
            : "Historico sincronizado.";
          redraw();
        }
      }),
      renderDeviceTimelinePanel({
        device: timelineDevice,
        rows: timelineRows,
        message: timelineMessage,
        onClose: () => {
          timelineDevice = null;
          timelineRows = [];
          timelineMessage = "";
          redraw();
        }
      }),
      pagedTable(["Paciente", "Tipo", "Paquete", "Sitio", "Instalacion", "Estado", ...(writable ? ["Acciones"] : [])], devices, device =>
        el("tr", {}, [
          el("td", {}, [device.patientName || patientName(patients, device.patientId)]),
          el("td", {}, [deviceTypeLabel(device)]),
          el("td", {}, [device.preventivePackage || ""]),
          el("td", {}, [device.anatomicalSite || ""]),
          el("td", {}, [device.installationDate || ""]),
          el("td", {}, [
            device.syncStatus === "local_pending" ? badge("Pendiente", "warn") : careLabel(device.careStatus),
            device.isReinstallation ? badge("Reinstalacion", "warn") : ""
          ]),
          writable ? el("td", { class: "actions-cell" }, [
            button("Editar", () => { editing = device; redraw(); }, { class: "small ghost" }),
            button("Historial", () => loadHistory(device.patientId), { class: "small ghost" }),
            button("Timeline", () => loadTimeline(device), { class: "small ghost" }),
            button("Retirar", async () => {
              const saved = await removeDeviceEpisode(app, device, todayIso());
              devices = devices.filter(row => row.episodeId !== saved.episodeId);
              message = saved.syncStatus === "local_pending"
                ? "Retiro guardado localmente; queda pendiente de sincronizar."
                : "Retiro sincronizado.";
              redraw();
            }, { class: "small ghost" })
          ]) : ""
        ])
      )
    );
  }

  redraw();
  return modulePage("Dispositivos", "Dispositivos activos como modulo propio.", [body], [
    writable ? button("Nuevo dispositivo", () => { editing = selectedPatientId ? { patientId: selectedPatientId } : {}; redraw(); }, { class: "ghost" }) : ""
  ]);
  async function loadHistory(patientId) {
    selectedPatientId = patientId || selectedPatientId;
    if (!selectedPatientId) {
      historyMessage = "Selecciona un paciente para cargar historicos.";
      redraw();
      return;
    }
    archivedDevices = await listArchivedDevicesForPatient(selectedPatientId, { limit: 100 });
    historyMessage = `${archivedDevices.length} episodio(s) retirado(s) cargado(s).`;
    redraw();
  }

  async function loadTimeline(device = {}) {
    const entityId = device.episodeId || device.id || "";
    if (!entityId) {
      timelineDevice = null;
      timelineRows = [];
      timelineMessage = "El episodio no tiene folio para auditoria.";
      redraw();
      return;
    }
    timelineDevice = device;
    timelineRows = await listAuditForEntity(entityId, { limit: 50 });
    timelineMessage = timelineRows.length
      ? `${timelineRows.length} evento(s) auditado(s) cargado(s).`
      : "Sin eventos auditados para este episodio.";
    redraw();
  }
}

function patientIdFromRoute(route = {}) {
  const parts = route.parts || [];
  const patientIndex = parts.indexOf("paciente");
  const raw = patientIndex >= 0 ? parts[patientIndex + 1] : "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function renderPatientRouteContext(patientId, patient = {}) {
  const label = patient?.patientName || patientId;
  const location = [patient?.service || patient?.currentService, patient?.bed || patient?.currentBed].filter(Boolean).join(" / ");
  return el("section", { class: "row-card" }, [
    el("strong", {}, [`Paciente ${label}`]),
    el("span", { class: "muted" }, [
      `Ruta directa desde expediente${location ? ` - ${location}` : ""}. Activos e historicos se cargan solo para este paciente.`
    ]),
    el("div", { class: "toolbar" }, [
      link("#/dispositivos", "Ver todos", { class: "button ghost small" })
    ])
  ]);
}

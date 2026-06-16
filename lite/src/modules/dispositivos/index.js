import { badge, button, el, notice, pagedTable } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { loadCatalogs } from "../../services/catalogService.js";
import { listActiveDevices, listArchivedDevicesForPatient, removeDeviceEpisode } from "../../services/deviceService.js";
import { listActivePatients } from "../../services/patientService.js";
import { careLabel, deviceForm, deviceSaveMessage, deviceTypeLabel, patientName, reinstallationDraft, renderDeviceHistoryPanel, upsertArchivedDevice, upsertDevice } from "./deviceForms.js";

export async function render({ app }) {
  let [devices, patients, catalogs] = await Promise.all([listActiveDevices(), listActivePatients(), loadCatalogs()]);
  const role = app.state.auth.profile?.role;
  const writable = canWrite("dispositivos", role);
  let editing = null;
  let editingArchive = null;
  let archivedDevices = [];
  let selectedPatientId = "";
  let message = "";
  let historyMessage = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    body.replaceChildren(
      message ? notice(message, message.includes("pendiente") ? "warn" : "ok") : "",
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
    writable ? button("Nuevo dispositivo", () => { editing = {}; redraw(); }, { class: "ghost" }) : ""
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
}

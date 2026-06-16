import { badge, button, checkboxInput, dateInput, el, field, notice, pagedTable, selectInput, textareaInput, textInput } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { catalogOptions, loadCatalogs } from "../../services/catalogService.js";
import { listActiveDevices, listArchivedDevicesForPatient, removeDeviceEpisode, saveArchivedDeviceEpisode, saveDeviceEpisode } from "../../services/deviceService.js";
import { listActivePatients } from "../../services/patientService.js";

const DEVICE_TYPES = ["", "CVC", "CVPC", "Sonda Foley", "Ventilacion mecanica", "Tubo endotraqueal", "Traqueostomia", "Drenaje", "Sonda nasogastrica", "Otro"];
const CARE_STATUS = [["no_valorado", "No valorado"], ["pendiente", "Pendiente"], ["completo", "Completo"], ["retirado", "Retirado"]];

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
        message = saved.syncStatus === "local_pending"
          ? "Dispositivo guardado localmente; queda pendiente de sincronizar."
          : "Dispositivo sincronizado.";
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
      pagedTable(["Paciente", "Tipo", "Sitio", "Instalacion", "Estado", ...(writable ? ["Acciones"] : [])], devices, device =>
        el("tr", {}, [
          el("td", {}, [device.patientName || patientName(patients, device.patientId)]),
          el("td", {}, [device.deviceType || ""]),
          el("td", {}, [device.anatomicalSite || ""]),
          el("td", {}, [device.installationDate || ""]),
          el("td", {}, [device.syncStatus === "local_pending" ? badge("Pendiente", "warn") : careLabel(device.careStatus)]),
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

function deviceForm(app, device, patients, onSaved, onCancel, catalogs = []) {
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const patient = patients.find(row => row.patientId === data.patientId) || {};
      const saved = await saveDeviceEpisode(app, {
        ...device,
        patientId: data.patientId,
        patientName: patient.patientName || device.patientName || "",
        service: patient.service || patient.currentService || device.service || "",
        bed: patient.bed || patient.currentBed || device.bed || "",
        deviceType: data.deviceType,
        anatomicalSite: data.anatomicalSite,
        installationDate: data.installationDate,
        careStatus: data.careStatus,
        infectionSigns: data.infectionSigns === "on",
        notes: data.notes
      });
      onSaved(saved);
    }
  }, [
    el("div", { class: "form-grid" }, [
      field("Paciente", selectInput(patientOptions(patients), { name: "patientId", required: true, value: device.patientId || "" })),
      field("Tipo", selectInput(deviceTypeOptions(catalogs, device.deviceType), { name: "deviceType", required: true, value: device.deviceType || "" })),
      field("Sitio anatomico", textInput({ name: "anatomicalSite", value: device.anatomicalSite || "" })),
      field("Instalacion", dateInput({ name: "installationDate", required: true, value: device.installationDate || todayIso() })),
      field("Estado de cuidado", selectInput(CARE_STATUS, { name: "careStatus", value: device.careStatus || "no_valorado" })),
      field("Signos de infeccion", checkboxInput({ name: "infectionSigns", checked: Boolean(device.infectionSigns) }))
    ]),
    field("Notas", textareaInput({ name: "notes", rows: 3, value: device.notes || "" })),
    el("div", { class: "toolbar" }, [
      button("Guardar", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function renderDeviceHistoryPanel({ app, patients, catalogs, writable, selectedPatientId, archivedDevices, editingArchive, message, onLoad, onEdit, onCancel, onSaved }) {
  return el("section", { class: "row-card device-history-panel" }, [
    el("strong", {}, ["Historial de dispositivos retirados"]),
    el("span", { class: "muted" }, ["Consulta y corrige episodios retirados sin reactivar dispositivos."]),
    message ? notice(message, message.includes("pendiente") ? "warn" : "ok") : "",
    el("div", { class: "form-grid compact" }, [
      field("Paciente", selectInput(patientOptions(patients, { patientId: selectedPatientId }), {
        value: selectedPatientId,
        onchange: event => { selectedPatientId = event.target.value; }
      }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Cargar historial", () => onLoad(selectedPatientId), { class: "ghost" })
    ]),
    editingArchive ? archiveDeviceForm(app, editingArchive, patients, catalogs, onSaved, onCancel) : "",
    pagedTable(["Paciente", "Tipo", "Sitio", "Instalacion", "Retiro", "Sync", ...(writable ? ["Acciones"] : [])], archivedDevices, device =>
      el("tr", {}, [
        el("td", {}, [device.patientName || patientName(patients, device.patientId)]),
        el("td", {}, [device.deviceType || ""]),
        el("td", {}, [device.anatomicalSite || ""]),
        el("td", {}, [device.installationDate || ""]),
        el("td", {}, [device.removalDate || ""]),
        el("td", {}, [device.syncStatus === "local_pending" ? badge("Pendiente", "warn") : ""]),
        writable ? el("td", { class: "actions-cell" }, [
          button("Editar historico", () => onEdit(device), { class: "small ghost" })
        ]) : ""
      ])
    )
  ]);
}

function archiveDeviceForm(app, device, patients, catalogs, onSaved, onCancel) {
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const patient = patients.find(row => row.patientId === data.patientId) || {};
      const saved = await saveArchivedDeviceEpisode(app, {
        ...device,
        patientId: data.patientId,
        patientName: patient.patientName || device.patientName || "",
        service: patient.service || patient.currentService || device.service || "",
        bed: patient.bed || patient.currentBed || device.bed || "",
        deviceType: data.deviceType,
        anatomicalSite: data.anatomicalSite,
        installationDate: data.installationDate,
        removalDate: data.removalDate,
        careStatus: data.careStatus,
        infectionSigns: data.infectionSigns === "on",
        notes: data.notes
      });
      onSaved(saved);
    }
  }, [
    el("div", { class: "form-grid" }, [
      field("Paciente", selectInput(patientOptions(patients, device), { name: "patientId", required: true, value: device.patientId || "" })),
      field("Tipo", selectInput(deviceTypeOptions(catalogs, device.deviceType), { name: "deviceType", required: true, value: device.deviceType || "" })),
      field("Sitio anatomico", textInput({ name: "anatomicalSite", value: device.anatomicalSite || "" })),
      field("Instalacion", dateInput({ name: "installationDate", required: true, value: device.installationDate || todayIso() })),
      field("Retiro", dateInput({ name: "removalDate", required: true, value: device.removalDate || todayIso() })),
      field("Estado de cuidado", selectInput(CARE_STATUS, { name: "careStatus", value: device.careStatus || "retirado" })),
      field("Signos de infeccion", checkboxInput({ name: "infectionSigns", checked: Boolean(device.infectionSigns) }))
    ]),
    field("Notas", textareaInput({ name: "notes", rows: 3, value: device.notes || "" })),
    el("div", { class: "toolbar" }, [
      button("Guardar historico", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function patientOptions(patients, current = {}) {
  const options = patients.map(patient => [
    patient.patientId,
    `${patient.bed || patient.currentBed || "S/C"} - ${patient.patientName || patient.patientId}`
  ]);
  if (current.patientId && !options.some(([id]) => id === current.patientId)) {
    options.unshift([current.patientId, `${current.bed || "S/C"} - ${current.patientName || current.patientId}`]);
  }
  return [["", "Seleccionar"], ...options];
}

function deviceTypeOptions(catalogs = [], current = "") {
  const options = catalogOptions(catalogs, "device_types");
  if (current && !options.some(([value]) => value === current)) options.push([current, current]);
  return options.length > 1 ? options : DEVICE_TYPES;
}

function patientName(patients, patientId) {
  const patient = patients.find(row => row.patientId === patientId);
  return patient?.patientName || patientId || "";
}

function careLabel(value = "") {
  return CARE_STATUS.find(([key]) => key === value)?.[1] || value;
}

function upsertDevice(rows, device) {
  const next = rows.filter(row => row.episodeId !== device.episodeId);
  if (!device.removalDate && device.active !== false) next.unshift(device);
  return next;
}

function upsertArchivedDevice(rows, device) {
  const next = rows.filter(row => row.episodeId !== device.episodeId);
  next.unshift(device);
  return next.sort((a, b) => String(b.removalDate || "").localeCompare(String(a.removalDate || "")));
}

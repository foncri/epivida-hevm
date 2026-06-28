import { badge, button, checkboxInput, dateInput, el, field, notice, pagedTable, selectInput, textareaInput, textInput } from "../../components/dom.js";
import { todayIso } from "../../lib/date.js";
import { catalogOptions } from "../../services/catalogService.js";
import { saveArchivedDeviceEpisode, saveDeviceEpisode } from "../../services/deviceService.js";

const DEVICE_TYPES = ["", "CVC", "CVPC", "Sonda Foley", "Ventilacion mecanica", "Tubo endotraqueal", "Traqueostomia", "Drenaje", "Sonda nasogastrica", "Otro"];
const CARE_STATUS = [["no_valorado", "No valorado"], ["pendiente", "Pendiente"], ["completo", "Completo"], ["retirado", "Retirado"]];
const PREVENTIVE_PACKAGES = [["", "Sin paquete"], ["ITS - CC", "ITS - CC"], ["ITU - CU", "ITU - CU"], ["NAVM", "NAVM"], ["ISQ", "ISQ"], ["P.E. Y P.B.M.T.", "P.E. Y P.B.M.T."], ["ESPECIAL", "Especial"]];

export function deviceForm(app, device, patients, onSaved, onCancel, catalogs = []) {
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
        deviceSubtype: data.deviceSubtype,
        french: data.french,
        preventivePackage: data.preventivePackage,
        anatomicalSite: data.anatomicalSite,
        installationDate: data.installationDate,
        careStatus: data.careStatus,
        dressingCurrent: data.dressingCurrent === "on",
        dressingDate: data.dressingDate,
        infectionSigns: data.infectionSigns === "on",
        notes: data.notes
      });
      onSaved(saved);
    }
  }, [
    device.isReinstallation ? notice(`Nuevo episodio por reinstalacion. Episodio previo: ${device.previousEpisodeId || device.reinstallationOf || "sin folio"}.`, "warn") : "",
    el("div", { class: "form-grid" }, [
      field("Paciente", selectInput(patientOptions(patients, device), { name: "patientId", required: true, value: device.patientId || "" })),
      field("Tipo", selectInput(deviceTypeOptions(catalogs, device.deviceType), { name: "deviceType", required: true, value: device.deviceType || "" })),
      field("Subtipo", textInput({ name: "deviceSubtype", value: device.deviceSubtype || "" })),
      field("French/calibre", textInput({ name: "french", value: device.french || "" })),
      field("Paquete preventivo", selectInput(packageOptions(device.preventivePackage), { name: "preventivePackage", value: device.preventivePackage || "" })),
      field("Sitio anatomico", textInput({ name: "anatomicalSite", value: device.anatomicalSite || "" })),
      field("Instalacion", dateInput({ name: "installationDate", required: true, value: device.installationDate || todayIso() })),
      field("Estado de cuidado", selectInput(CARE_STATUS, { name: "careStatus", value: device.careStatus || "no_valorado" })),
      field("Curacion vigente", checkboxInput({ name: "dressingCurrent", checked: Boolean(device.dressingCurrent) })),
      field("Fecha curacion", dateInput({ name: "dressingDate", value: device.dressingDate || "" })),
      field("Signos de infeccion", checkboxInput({ name: "infectionSigns", checked: Boolean(device.infectionSigns) }))
    ]),
    field("Notas", textareaInput({ name: "notes", rows: 3, value: device.notes || "" })),
    el("div", { class: "toolbar" }, [
      button("Guardar", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

export function renderDeviceHistoryPanel({ app, patients, catalogs, writable, selectedPatientId, archivedDevices, editingArchive, message, onLoad, onEdit, onReinstall, onTimeline, onCancel, onSaved }) {
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
    pagedTable(["Paciente", "Tipo", "Paquete", "Sitio", "Instalacion", "Retiro", "Sync", ...(writable ? ["Acciones"] : [])], archivedDevices, device =>
      el("tr", {}, [
        el("td", {}, [device.patientName || patientName(patients, device.patientId)]),
        el("td", {}, [deviceTypeLabel(device)]),
        el("td", {}, [device.preventivePackage || ""]),
        el("td", {}, [device.anatomicalSite || ""]),
        el("td", {}, [device.installationDate || ""]),
        el("td", {}, [device.removalDate || ""]),
        el("td", {}, [device.syncStatus === "local_pending" ? badge("Pendiente", "warn") : ""]),
        writable ? el("td", { class: "actions-cell" }, [
          button("Reinstalar", () => onReinstall(device), { class: "small ghost" }),
          button("Editar historico", () => onEdit(device), { class: "small ghost" }),
          button("Timeline", () => onTimeline(device), { class: "small ghost" })
        ]) : ""
      ])
    )
  ]);
}

export function renderDeviceTimelinePanel({ device, rows, message, onClose }) {
  if (!device) return "";
  return el("section", { class: "row-card device-timeline-panel" }, [
    el("strong", {}, [`Timeline del episodio ${device.episodeId || device.id || ""}`]),
    el("span", { class: "muted" }, [deviceTypeLabel(device) || "Dispositivo"]),
    message ? notice(message, message.includes("Sin eventos") ? "warn" : "ok") : "",
    pagedTable(["Fecha", "Accion", "Modulo", "Usuario"], rows, row =>
      el("tr", {}, [
        el("td", {}, [row.createdAt || ""]),
        el("td", {}, [auditActionLabel(row.actionType)]),
        el("td", {}, [row.module || row.entityType || ""]),
        el("td", {}, [row.userEmail || row.userId || ""])
      ])
    ),
    el("div", { class: "toolbar" }, [
      button("Cerrar timeline", onClose, { class: "ghost" })
    ])
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
        deviceSubtype: data.deviceSubtype,
        french: data.french,
        preventivePackage: data.preventivePackage,
        anatomicalSite: data.anatomicalSite,
        installationDate: data.installationDate,
        removalDate: data.removalDate,
        careStatus: data.careStatus,
        dressingCurrent: data.dressingCurrent === "on",
        dressingDate: data.dressingDate,
        infectionSigns: data.infectionSigns === "on",
        notes: data.notes
      });
      onSaved(saved);
    }
  }, [
    el("div", { class: "form-grid" }, [
      field("Paciente", selectInput(patientOptions(patients, device), { name: "patientId", required: true, value: device.patientId || "" })),
      field("Tipo", selectInput(deviceTypeOptions(catalogs, device.deviceType), { name: "deviceType", required: true, value: device.deviceType || "" })),
      field("Subtipo", textInput({ name: "deviceSubtype", value: device.deviceSubtype || "" })),
      field("French/calibre", textInput({ name: "french", value: device.french || "" })),
      field("Paquete preventivo", selectInput(packageOptions(device.preventivePackage), { name: "preventivePackage", value: device.preventivePackage || "" })),
      field("Sitio anatomico", textInput({ name: "anatomicalSite", value: device.anatomicalSite || "" })),
      field("Instalacion", dateInput({ name: "installationDate", required: true, value: device.installationDate || todayIso() })),
      field("Retiro", dateInput({ name: "removalDate", required: true, value: device.removalDate || todayIso() })),
      field("Estado de cuidado", selectInput(CARE_STATUS, { name: "careStatus", value: device.careStatus || "retirado" })),
      field("Curacion vigente", checkboxInput({ name: "dressingCurrent", checked: Boolean(device.dressingCurrent) })),
      field("Fecha curacion", dateInput({ name: "dressingDate", value: device.dressingDate || "" })),
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

function packageOptions(current = "") {
  const options = [...PREVENTIVE_PACKAGES];
  if (current && !options.some(([value]) => value === current)) options.push([current, current]);
  return options;
}

export function deviceTypeLabel(device = {}) {
  return [device.deviceType, device.deviceSubtype, device.french ? `Fr ${device.french}` : ""].filter(Boolean).join(" / ");
}

export function patientName(patients, patientId) {
  const patient = patients.find(row => row.patientId === patientId);
  return patient?.patientName || patientId || "";
}

export function careLabel(value = "") {
  return CARE_STATUS.find(([key]) => key === value)?.[1] || value;
}

function auditActionLabel(value = "") {
  return String(value || "")
    .replace(/^device_/, "")
    .replaceAll("_", " ")
    || "Evento";
}

export function upsertDevice(rows, device) {
  const next = rows.filter(row => row.episodeId !== device.episodeId);
  if (!device.removalDate && device.active !== false) next.unshift(device);
  return next;
}

export function upsertArchivedDevice(rows, device) {
  const next = rows.filter(row => row.episodeId !== device.episodeId);
  next.unshift(device);
  return next.sort((a, b) => String(b.removalDate || "").localeCompare(String(a.removalDate || "")));
}

export function reinstallationDraft(device = {}) {
  const previousEpisodeId = device.episodeId || device.id || "";
  return {
    patientId: device.patientId || "",
    patientName: device.patientName || "",
    service: device.service || "",
    bed: device.bed || "",
    deviceType: device.deviceType || "",
    deviceSubtype: device.deviceSubtype || "",
    french: device.french || "",
    preventivePackage: device.preventivePackage || "",
    anatomicalSite: device.anatomicalSite || "",
    installationDate: todayIso(),
    careStatus: "no_valorado",
    infectionSigns: false,
    active: true,
    status: "activo",
    previousEpisodeId,
    reinstallationOf: previousEpisodeId,
    isReinstallation: true,
    source: "lite_device_reinstallation",
    notes: `Reinstalacion de episodio ${previousEpisodeId}${device.removalDate ? ` retirado el ${device.removalDate}` : ""}.`
  };
}

export function deviceSaveMessage(saved = {}) {
  const label = saved.isReinstallation ? "Reinstalacion guardada como nuevo episodio" : "Dispositivo guardado";
  return saved.syncStatus === "local_pending"
    ? `${label} localmente; queda pendiente de sincronizar.`
    : `${label} y sincronizado.`;
}

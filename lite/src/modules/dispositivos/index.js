import { badge, button, checkboxInput, dateInput, el, field, notice, pagedTable, selectInput, textareaInput, textInput } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { canWrite } from "../../lib/security.js";
import { listActiveDevices, removeDeviceEpisode, saveDeviceEpisode } from "../../services/deviceService.js";
import { listActivePatients } from "../../services/patientService.js";

const DEVICE_TYPES = ["", "CVC", "CVPC", "Sonda Foley", "Ventilacion mecanica", "Tubo endotraqueal", "Traqueostomia", "Drenaje", "Sonda nasogastrica", "Otro"];
const CARE_STATUS = [["no_valorado", "No valorado"], ["pendiente", "Pendiente"], ["completo", "Completo"]];

export async function render({ app }) {
  let [devices, patients] = await Promise.all([listActiveDevices(), listActivePatients()]);
  const role = app.state.auth.profile?.role;
  const writable = canWrite("dispositivos", role);
  let editing = null;
  let message = "";
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
      }, () => { editing = null; redraw(); }) : "",
      pagedTable(["Paciente", "Tipo", "Sitio", "Instalacion", "Estado", ...(writable ? ["Acciones"] : [])], devices, device =>
        el("tr", {}, [
          el("td", {}, [device.patientName || patientName(patients, device.patientId)]),
          el("td", {}, [device.deviceType || ""]),
          el("td", {}, [device.anatomicalSite || ""]),
          el("td", {}, [device.installationDate || ""]),
          el("td", {}, [device.syncStatus === "local_pending" ? badge("Pendiente", "warn") : careLabel(device.careStatus)]),
          writable ? el("td", { class: "actions-cell" }, [
            button("Editar", () => { editing = device; redraw(); }, { class: "small ghost" }),
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
}

function deviceForm(app, device, patients, onSaved, onCancel) {
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
      field("Tipo", selectInput(DEVICE_TYPES, { name: "deviceType", required: true, value: device.deviceType || "" })),
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

function patientOptions(patients) {
  return [["", "Seleccionar"], ...patients.map(patient => [
    patient.patientId,
    `${patient.bed || patient.currentBed || "S/C"} - ${patient.patientName || patient.patientId}`
  ])];
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

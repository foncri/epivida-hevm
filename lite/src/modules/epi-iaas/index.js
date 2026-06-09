import { badge, button, dateInput, el, field, notice, pagedTable, selectInput, textareaInput, textInput } from "../../components/dom.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { saveAntimicrobial } from "../../services/antimicrobialService.js";
import { saveCulture } from "../../services/cultureService.js";
import { canWrite } from "../../lib/security.js";
import { closeIaasCase, listActiveIaas, normalizeIaasClinicalFollowUp, saveIaasCase } from "../../services/iaasService.js";
import { listActivePatients } from "../../services/patientService.js";

const IAAS_TYPES = ["", "ITS - CC", "ITU - CU", "NAVM", "ISQ", "COVID/Influenza", "Otro"];
const IAAS_STATUS = [["sospecha", "Sospecha"], ["probable", "Probable"], ["confirmada", "Confirmada"], ["descartada", "Descartada"]];

export async function render({ app }) {
  let [rows, patients] = await Promise.all([listActiveIaas(), listActivePatients()]);
  const role = app.state.auth.profile?.role;
  const writable = canWrite("epi-iaas", role);
  let editing = null;
  let message = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    body.replaceChildren(
      message ? notice(message, message.includes("pendiente") ? "warn" : "ok") : "",
      stats([
        [String(rows.length), "IAAS activas"],
        [String(new Set(rows.map(row => row.service).filter(Boolean)).size), "Servicios"],
        [String(rows.filter(row => row.status === "sospecha").length), "Sospechas"],
        [String(rows.filter(row => row.status === "confirmada").length), "Confirmadas"]
      ]),
      editing ? iaasForm(app, editing, patients, saved => {
        rows = upsertIaas(rows, saved);
        editing = null;
        message = saved.syncStatus === "local_pending"
          ? "IAAS guardada localmente; queda pendiente de sincronizar."
          : "IAAS sincronizada.";
        redraw();
      }, () => { editing = null; redraw(); }) : "",
      pagedTable(["Paciente", "Servicio", "Cama", "Tipo", "Estado", "Seguimiento", ...(writable ? ["Acciones"] : [])], rows, row =>
        el("tr", {}, [
          el("td", {}, [row.patientName || patientName(patients, row.patientId)]),
          el("td", {}, [row.service || ""]),
          el("td", {}, [row.bed || ""]),
          el("td", {}, [row.iaasType || ""]),
          el("td", {}, [row.syncStatus === "local_pending" ? badge("Pendiente", "warn") : statusLabel(row.status)]),
          el("td", {}, [followUpSummary(row)]),
          writable ? el("td", { class: "actions-cell" }, [
            button("Editar", () => { editing = row; redraw(); }, { class: "small ghost" }),
            button("Cerrar", async () => {
              const saved = await closeIaasCase(app, row, "cierre_manual_lite");
              rows = rows.filter(item => item.iaasId !== saved.iaasId);
              message = saved.syncStatus === "local_pending"
                ? "Cierre guardado localmente; queda pendiente de sincronizar."
                : "Cierre sincronizado.";
              redraw();
            }, { class: "small ghost" })
          ]) : ""
        ])
      )
    );
  }

  redraw();
  return modulePage("EPI-IAAS", "Seguimiento IAAS independiente. No carga dashboard, ronda ni exportadores.", [body], [
    writable ? button("Nueva IAAS", () => { editing = {}; redraw(); }, { class: "ghost" }) : ""
  ]);
}

function iaasForm(app, iaas, patients, onSaved, onCancel) {
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const patient = patients.find(row => row.patientId === data.patientId) || {};
      const saved = await saveIaasCase(app, {
        ...iaas,
        patientId: data.patientId,
        patientName: patient.patientName || iaas.patientName || "",
        service: patient.service || patient.currentService || iaas.service || "",
        bed: patient.bed || patient.currentBed || iaas.bed || "",
        iaasType: data.iaasType,
        status: data.status,
        onsetDate: data.onsetDate,
        probableOrigin: data.probableOrigin,
        notes: data.notes,
        ...normalizeIaasClinicalFollowUp(data, iaas)
      });
      await saveLinkedCulture(app, saved, data);
      await saveLinkedAntimicrobial(app, saved, data);
      onSaved(saved);
    }
  }, [
    el("div", { class: "form-grid" }, [
      field("Paciente", selectInput(patientOptions(patients), { name: "patientId", required: true, value: iaas.patientId || "" })),
      field("Tipo IAAS", selectInput(IAAS_TYPES, { name: "iaasType", required: true, value: iaas.iaasType || "" })),
      field("Estado", selectInput(IAAS_STATUS, { name: "status", required: true, value: iaas.status || "sospecha" })),
      field("Fecha inicio", dateInput({ name: "onsetDate", value: iaas.onsetDate || todayIso() })),
      field("Origen probable", textInput({ name: "probableOrigin", value: iaas.probableOrigin || "" }))
    ]),
    field("Notas", textareaInput({ name: "notes", rows: 3, value: iaas.notes || "" })),
    el("div", { class: "form-grid compact" }, [
      field("Criterios IAAS", textareaInput({ name: "criteria", rows: 3, value: iaas.criteria || "" })),
      field("Dispositivo relacionado", textInput({ name: "deviceEpisodeId", value: iaas.deviceEpisodeId || "" })),
      field("Fecha seguimiento", dateInput({ name: "followUpDate", value: iaas.followUp?.reviewDate || todayIso() })),
      field("Evolucion", textareaInput({ name: "clinicalEvolution", rows: 3, value: iaas.followUp?.evolution || "" })),
      field("Plan", textareaInput({ name: "carePlan", rows: 3, value: iaas.followUp?.carePlan || "" }))
    ]),
    el("div", { class: "form-grid compact" }, [
      field("Temp", textInput({ name: "vitalTemperature", value: iaas.vitalSigns?.temperature || "" })),
      field("FC", textInput({ name: "vitalHeartRate", value: iaas.vitalSigns?.heartRate || "" })),
      field("FR", textInput({ name: "vitalRespiratoryRate", value: iaas.vitalSigns?.respiratoryRate || "" })),
      field("TA", textInput({ name: "vitalBloodPressure", value: iaas.vitalSigns?.bloodPressure || "" })),
      field("SpO2", textInput({ name: "vitalSpo2", value: iaas.vitalSigns?.spo2 || "" })),
      field("Biometria", textInput({ name: "biometry", value: iaas.labs?.biometry || "" })),
      field("EGO", textInput({ name: "ego", value: iaas.labs?.ego || "" })),
      field("Otros estudios", textInput({ name: "otherStudies", value: iaas.labs?.otherStudies || "" }))
    ]),
    el("div", { class: "form-grid compact" }, [
      field("Cultivo muestra", textInput({ name: "cultureSampleType", value: "" })),
      field("Cultivo fecha", dateInput({ name: "cultureRequestedAt", value: "" })),
      field("Microorganismo", textInput({ name: "cultureOrganism", value: "" })),
      field("Farmaco", textInput({ name: "antimicrobialDrug", value: "" })),
      field("Inicio farmaco", dateInput({ name: "antimicrobialStartDate", value: "" })),
      field("Indicacion", textInput({ name: "antimicrobialIndication", value: "" }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Guardar", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

async function saveLinkedCulture(app, iaas, data) {
  if (!data.cultureSampleType && !data.cultureRequestedAt && !data.cultureOrganism) return null;
  return saveCulture(app, {
    patientId: iaas.patientId,
    iaasId: iaas.iaasId,
    sampleType: data.cultureSampleType || "Sin muestra",
    requestedAt: data.cultureRequestedAt || todayIso(),
    organism: data.cultureOrganism || "",
    status: data.cultureOrganism ? "resultado" : "solicitado"
  });
}

async function saveLinkedAntimicrobial(app, iaas, data) {
  if (!data.antimicrobialDrug && !data.antimicrobialStartDate && !data.antimicrobialIndication) return null;
  return saveAntimicrobial(app, {
    patientId: iaas.patientId,
    iaasId: iaas.iaasId,
    drug: data.antimicrobialDrug || "Sin farmaco",
    startDate: data.antimicrobialStartDate || todayIso(),
    indication: data.antimicrobialIndication || iaas.iaasType || "",
    status: "activo"
  });
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

function statusLabel(value = "") {
  return IAAS_STATUS.find(([key]) => key === value)?.[1] || value;
}

function followUpSummary(row = {}) {
  const parts = [
    row.followUp?.reviewDate,
    row.criteria ? "criterios" : "",
    row.followUp?.carePlan ? "plan" : "",
    row.vitalSigns?.temperature ? `T ${row.vitalSigns.temperature}` : "",
    row.labs?.biometry ? "BH" : ""
  ].filter(Boolean);
  return parts.join(" / ") || "Sin seguimiento";
}

function upsertIaas(rows, iaas) {
  const next = rows.filter(row => row.iaasId !== iaas.iaasId);
  if (!["closed", "cerrada", "archived"].includes(String(iaas.status || "").toLowerCase())) next.unshift(iaas);
  return next;
}

import { badge, button, dateInput, el, field, notice, pagedTable, selectInput, textareaInput, textInput } from "../../components/dom.js";
import { renderClinicalFollowUpPanel } from "../../components/clinicalFollowUp.js";
import { renderMicrobiologyDashboard } from "../../components/microbiologyDashboard.js";
import { renderOpdFields } from "../../components/opdFields.js";
import { modulePage, stats } from "../../components/moduleLayout.js";
import { todayIso } from "../../lib/date.js";
import { listAntimicrobialsForIaas, saveAntimicrobial } from "../../services/antimicrobialService.js";
import { loadCatalogs } from "../../services/catalogService.js";
import { listCulturesForIaas, saveCulture } from "../../services/cultureService.js";
import { canWrite } from "../../lib/security.js";
import { buildCriteriaTemplate, criteriaVersionForType, defaultAntimicrobialIndication, defaultCultureTypeForIaas, getIaasCriteria, iaasTypeOptions, validateIaasClinicalCompleteness } from "../../services/iaasCriteriaService.js";
import { closeIaasCase, listActiveIaas, saveIaasCase } from "../../services/iaasService.js";
import { loadMicrobiologyDashboard } from "../../services/microbiologyDashboardService.js";
import { opdEligibilityForIaasCase, opdHasContent } from "../../services/opdService.js";
import { listActivePatients } from "../../services/patientService.js";
import { clinicalValidationBadge, dateFromRoute, draftIaasForRoutePatient, emptyClinical, followUpSummary, IAAS_STATUS, iaasDraftFromFormData, linkedClinicalEvidence, loadCaseClinical, patientIdFromRoute, patientName, patientOptions, renderClinicalRevisionPanel, renderClinicalValidation, renderDailyIaasTable, renderVitalTrendPanel, statusLabel, syncMessage, upsertById, upsertIaas } from "./helpers.js";

export async function render({ app, route }) {
  let [rows, patients, catalogs, microSummary] = await Promise.all([
    listActiveIaas(),
    listActivePatients(),
    loadCatalogs(),
    loadMicrobiologyDashboard().catch(() => null)
  ]);
  const role = app.state.auth.profile?.role;
  const writable = canWrite("epi-iaas", role);
  const routePatientId = patientIdFromRoute(route);
  const routeDate = dateFromRoute(route);
  const routePatient = routePatientId ? patients.find(row => row.patientId === routePatientId) : null;
  let editing = routePatientId
    ? rows.find(row => row.patientId === routePatientId) || draftIaasForRoutePatient(routePatient, routePatientId, routeDate)
    : null;
  let editingClinical = editing?.iaasId ? await loadCaseClinical(editing) : emptyClinical();
  let clinical = null;
  let microLoading = false;
  let message = routePatientId
    ? rows.some(row => row.patientId === routePatientId) ? "Seguimiento IAAS abierto para el paciente." : "Cedula IAAS nueva para el paciente seleccionado."
    : "";
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
      renderMicrobiologyDashboard({
        summary: microSummary,
        loading: microLoading,
        onRefresh: async () => {
          microLoading = true;
          redraw();
          microSummary = await loadMicrobiologyDashboard().catch(() => null);
          microLoading = false;
          redraw();
        }
      }),
      editing ? iaasForm(app, editing, patients, editingClinical, saved => {
        rows = upsertIaas(rows, saved);
        editing = null;
        editingClinical = emptyClinical();
        message = syncMessage(saved, "IAAS guardada");
        redraw();
      }, () => { editing = null; editingClinical = emptyClinical(); redraw(); }) : "",
      clinical ? renderClinicalFollowUpPanel({
        app,
        context: {
          title: "Cultivos y antimicrobianos del caso",
          patientId: clinical.iaas.patientId,
          patientName: clinical.iaas.patientName || patientName(patients, clinical.iaas.patientId),
          iaasId: clinical.iaas.iaasId,
          iaasType: clinical.iaas.iaasType
        },
        cultures: clinical.cultures,
        antimicrobials: clinical.antimicrobials,
        catalogs,
        writable,
        onClose: () => { clinical = null; redraw(); },
        onChanged: change => {
          if (change?.type === "culture") clinical.cultures = upsertById(clinical.cultures, change.saved, "cultureId");
          if (change?.type === "antimicrobial") clinical.antimicrobials = upsertById(clinical.antimicrobials, change.saved, "antimicrobialId");
          if (editing?.iaasId && editing.iaasId === clinical.iaas.iaasId) {
            editingClinical = { cultures: clinical.cultures, antimicrobials: clinical.antimicrobials };
            redraw();
          }
        }
      }) : "",
      pagedTable(["Paciente", "Servicio", "Cama", "Tipo", "Estado", "Cedula", "Seguimiento", ...(writable ? ["Acciones"] : [])], rows, row =>
        el("tr", {}, [
          el("td", {}, [row.patientName || patientName(patients, row.patientId)]),
          el("td", {}, [row.service || ""]),
          el("td", {}, [row.bed || ""]),
          el("td", {}, [row.iaasType || ""]),
          el("td", {}, [row.syncStatus === "local_pending" ? badge("Pendiente", "warn") : statusLabel(row.status)]),
          el("td", {}, [clinicalValidationBadge(row)]),
          el("td", {}, [followUpSummary(row)]),
          writable ? el("td", { class: "actions-cell" }, [
            button("Editar", () => openEdit(row), { class: "small ghost" }),
            button("Micro", () => openClinical(row), { class: "small ghost" }),
            button("Cerrar", async () => {
              const saved = await closeIaasCase(app, row, "cierre_manual_lite");
              rows = rows.filter(item => item.iaasId !== saved.iaasId);
              message = syncMessage(saved, "Cierre guardado");
              redraw();
            }, { class: "small ghost" })
          ]) : ""
        ])
      )
    );
  }

  redraw();
  return modulePage("EPI-IAAS", "Seguimiento IAAS ligero e independiente.", [body], [
    writable ? button("Nueva IAAS", () => { editing = {}; editingClinical = emptyClinical(); redraw(); }, { class: "ghost" }) : ""
  ]);

  async function openEdit(row) {
    editing = row;
    editingClinical = row.iaasId ? await loadCaseClinical(row) : emptyClinical();
    redraw();
  }

  async function openClinical(row) {
    const [cultures, antimicrobials] = await Promise.all([
      listCulturesForIaas(row.iaasId),
      listAntimicrobialsForIaas(row.iaasId)
    ]);
    clinical = { iaas: row, cultures, antimicrobials };
    redraw();
  }
}

function iaasForm(app, iaas, patients, clinicalData, onSaved, onCancel) {
  const followUp = iaas.followUp || {};
  const vitalSigns = iaas.vitalSigns || {};
  const labs = iaas.labs || {};
  const compactGrid = children => el("div", { class: "form-grid compact" }, children);
  const typeSelect = selectInput(iaasTypeSelectOptions(iaas.iaasType), { name: "iaasType", required: true, value: iaas.iaasType || "" });
  const statusSelect = selectInput(IAAS_STATUS, { name: "status", required: true, value: iaas.status || "sospecha" });
  const criteriaInput = textareaInput({ name: "criteria", rows: 5, value: iaas.criteria || "" });
  const criteriaVersionInput = el("input", { type: "hidden", name: "criteriaVersion", value: iaas.criteriaVersion || criteriaVersionForType(iaas.iaasType || "") });
  const criteriaGuide = el("div", { class: "criteria-guide" }, renderCriteriaGuide(iaas.iaasType || ""));
  const validationPanel = el("div", { class: "criteria-validation" });
  const opdContainer = el("div", {});
  let formNode = null;
  const renderOpd = () => {
    const eligibility = opdEligibilityForIaasCase({ ...iaas, status: statusSelect.value });
    opdContainer.replaceChildren(eligibility.eligible || opdHasContent(iaas.opd)
      ? renderOpdFields(iaas.opd, { eligibility })
      : "");
  };
  const refreshClinicalValidation = () => {
    if (!formNode) return;
    const data = Object.fromEntries(new FormData(formNode));
    const draft = iaasDraftFromFormData(iaas, patients, data);
    const validation = validateIaasClinicalCompleteness(draft, linkedClinicalEvidence(data));
    validationPanel.replaceChildren(...renderClinicalValidation(validation));
  };
  typeSelect.addEventListener("change", () => {
    const selected = typeSelect.value;
    criteriaVersionInput.value = criteriaVersionForType(selected);
    criteriaGuide.replaceChildren(...renderCriteriaGuide(selected));
    if (!criteriaInput.value.trim()) criteriaInput.value = buildCriteriaTemplate(selected);
    refreshClinicalValidation();
  });
  statusSelect.addEventListener("change", () => {
    renderOpd();
    refreshClinicalValidation();
  });
  renderOpd();

  formNode = el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const draft = iaasDraftFromFormData(iaas, patients, data);
      const clinicalValidation = validateIaasClinicalCompleteness(draft, linkedClinicalEvidence(data));
      const saved = await saveIaasCase(app, { ...draft, clinicalValidation });
      await saveLinkedCulture(app, saved, data);
      await saveLinkedAntimicrobial(app, saved, data);
      onSaved(saved);
    }
  }, [
    el("div", { class: "form-grid" }, [
      field("Paciente", selectInput(patientOptions(patients), { name: "patientId", required: true, value: iaas.patientId || "" })),
      field("Tipo IAAS", typeSelect),
      field("Estado", statusSelect),
      field("Fecha inicio", dateInput({ name: "onsetDate", value: iaas.onsetDate || todayIso() })),
      field("Origen probable", textInput({ name: "probableOrigin", value: iaas.probableOrigin || "" }))
    ]),
    field("Notas", textareaInput({ name: "notes", rows: 3, value: iaas.notes || "" })),
    criteriaVersionInput,
    compactGrid([
      field("Criterios IAAS", criteriaInput),
      field("Dispositivo relacionado", textInput({ name: "deviceEpisodeId", value: iaas.deviceEpisodeId || "" })),
      field("Fecha seguimiento", dateInput({ name: "followUpDate", value: followUp.reviewDate || todayIso() })),
      field("Evolucion", textareaInput({ name: "clinicalEvolution", rows: 3, value: followUp.evolution || "" })),
      field("Plan", textareaInput({ name: "carePlan", rows: 3, value: followUp.carePlan || "" }))
    ]),
    criteriaGuide,
    validationPanel,
    renderVitalTrendPanel(iaas),
    renderDailyIaasTable(iaas, clinicalData),
    renderClinicalRevisionPanel(iaas),
    opdContainer,
    compactGrid([
      field("Temp", textInput({ name: "vitalTemperature", value: vitalSigns.temperature || "" })),
      field("FC", textInput({ name: "vitalHeartRate", value: vitalSigns.heartRate || "" })),
      field("FR", textInput({ name: "vitalRespiratoryRate", value: vitalSigns.respiratoryRate || "" })),
      field("TA", textInput({ name: "vitalBloodPressure", value: vitalSigns.bloodPressure || "" })),
      field("SpO2", textInput({ name: "vitalSpo2", value: vitalSigns.spo2 || "" })),
      field("FiO2", textInput({ name: "vitalFio2", value: vitalSigns.fio2 || "" })),
      field("PEEP", textInput({ name: "vitalPeep", value: vitalSigns.peep || "" })),
      field("Biometria", textInput({ name: "biometry", value: labs.biometry || "" })),
      field("EGO", textInput({ name: "ego", value: labs.ego || "" })),
      field("Otros estudios", textareaInput({ name: "otherStudies", rows: 2, value: labs.otherStudies || "" }))
    ]),
    compactGrid([
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
  formNode.addEventListener("input", refreshClinicalValidation);
  formNode.addEventListener("change", refreshClinicalValidation);
  refreshClinicalValidation();
  return formNode;
}

async function saveLinkedCulture(app, iaas, data) {
  if (!data.cultureSampleType && !data.cultureRequestedAt && !data.cultureOrganism) return null;
  return saveCulture(app, {
    patientId: iaas.patientId,
    iaasId: iaas.iaasId,
    sampleType: data.cultureSampleType || defaultCultureTypeForIaas(iaas.iaasType) || "Sin muestra",
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
    indication: data.antimicrobialIndication || defaultAntimicrobialIndication(iaas.iaasType) || iaas.iaasType || "",
    status: "activo"
  });
}

function renderCriteriaGuide(type = "") {
  if (!type) return [el("p", { class: "muted" }, ["Selecciona un tipo IAAS para ver la cedula Lite versionada."])];
  const guide = getIaasCriteria(type);
  return [
    el("div", { class: "criteria-guide-head" }, [
      el("strong", {}, [`Cedula ${guide.label}`]),
      el("span", { class: "muted" }, [criteriaVersionForType(type)])
    ]),
    el("ul", {}, guide.criteria.map(item => el("li", {}, [item]))),
    guide.cultures.length ? el("p", { class: "muted" }, [`Cultivos sugeridos: ${guide.cultures.join(", ")}`]) : "",
    guide.deviceSignals.length ? el("p", { class: "muted" }, [`Senales/dispositivos: ${guide.deviceSignals.join(", ")}`]) : ""
  ];
}

function iaasTypeSelectOptions(current = "") {
  const options = iaasTypeOptions();
  if (current && !options.some(([value]) => value === current)) options.push([current, current]);
  return options;
}

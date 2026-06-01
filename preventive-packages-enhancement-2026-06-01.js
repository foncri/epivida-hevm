(() => {
  "use strict";
  if (window.__epividaPreventivePackagesEnhancement20260601) return;
  window.__epividaPreventivePackagesEnhancement20260601 = true;
  const nativeEval = window.eval;

  function style() {
    if (document.getElementById("epivida-preventive-packages-enhancement-style")) return;
    const el = document.createElement("style");
    el.id = "epivida-preventive-packages-enhancement-style";
    el.textContent = `
      .package-draft.its-cc{background:#fff1f4;border-color:#f7c9d3}.package-draft.itu-cu{background:#fffbe6;border-color:#eadf9a}.package-draft.navm{background:#eef9ff;border-color:#bde8fb}.package-draft.isq{background:#effbf2;border-color:#bde8c7}.package-draft.p-e-y-p-b-m-t{background:#f7f7f8;border-color:#d1d5db}.package-draft.especial{background:#f7f0ff;border-color:#dbc8ff}
      .preventive-bulk-actions{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;padding:.65rem;margin:.65rem 0;border:1px solid rgba(15,23,42,.12);border-radius:8px;background:rgba(255,255,255,.72)}.preventive-bulk-actions span{font-weight:800;color:#334155;margin-right:.35rem}
      .preventive-bottom-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.85rem;align-items:stretch}.preventive-action-card{border:1px solid rgba(100,116,139,.24);border-radius:8px;background:#fff;padding:.9rem;display:flex;flex-direction:column;gap:.65rem}.preventive-action-card h3{margin:0;font-size:1rem}.preventive-action-card .field{margin:0}
      .pe-summary-zone{margin-top:1rem;border-top:1px dashed rgba(100,116,139,.35);padding-top:1rem}.pe-summary-zone h3{margin:0 0 .65rem;color:#334155}.pe-summary-card{background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:.8rem;display:grid;gap:.35rem}.pe-summary-card strong{color:#111827}
      .preventive-history-days{display:grid;gap:.75rem}.preventive-history-day{border:1px solid rgba(100,116,139,.25);border-radius:8px;background:#fff;overflow:hidden}.preventive-history-day summary{cursor:pointer;padding:.85rem;font-weight:800;display:flex;gap:.75rem;flex-wrap:wrap;align-items:center}.preventive-history-day summary small{color:#64748b;font-weight:700}.preventive-history-content{padding:0 .85rem .85rem;display:grid;gap:.65rem}.preventive-history-card{border:1px solid rgba(100,116,139,.2);border-radius:8px;padding:.75rem;background:#f8fafc;display:grid;gap:.35rem}.preventive-history-card ul{margin:.25rem 0 0;padding-left:1.1rem}.preventive-history-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.35rem}
    `;
    document.head.append(el);
  }

  function r(source, pattern, replacement, label) {
    const next = source.replace(pattern, replacement);
    if (next === source) console.warn("No se pudo aplicar mejora preventiva:", label);
    return next;
  }

  function patchConstants(source) {
    return source
      .replace(/const FRENCH_OPTIONS = \[[^\]]+\];/, 'const FRENCH_OPTIONS = ["NA","3 Fr","4 Fr","4.5 Fr","5 Fr","6 Fr","7 Fr","8 Fr","9 Fr","10 Fr","12 Fr","14 Fr","16 Fr","18 Fr","20 Fr","22 Fr","24 Fr"];')
      .replace(/const ITU_MATERIAL_TYPES = \[[^\]]+\];/, 'const ITU_MATERIAL_TYPES = ["NA","SILICON","LATEX"];')
      .replace(/const ITU_DEVICE_STATES = \[[^\]]+\];/, 'const ITU_DEVICE_STATES = ["NA","A DERIVACION","CIRCUITO CERRADO"];')
      .replace(/const NAVM_ORAL_HYGIENE_TYPES = \[[^\]]+\];/, 'const NAVM_ORAL_HYGIENE_TYPES = ["NA","CLORHEXIDINA","SALINA","CEPILLO DENTAL"];');
  }

  function patchDefaults(source) {
    return r(source, /  function defaultPreventiveDevice\(packageType\) \{[\s\S]*?\n  function preventiveCompliance\(checks = \{\}\) \{[\s\S]*?\n  \}\n\n  function deviceDisplayName/, `  function defaultPreventiveChecks(packageType, deviceType = "") {
    const checks = PREVENTIVE_CHECKS[packageType] || [];
    if (packageType === "ITS - CC" && normalizeText(deviceType || "CVPC") === "CVPC") return Object.fromEntries(checks.map(([key]) => [key, "NA"]));
    return {};
  }
  function preventiveDraftId() {
    return "draft_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }
  function defaultPreventiveDevice(packageType) {
    const deviceType = packageType === "ITS - CC" ? "CVPC" : packageType === "ITU - CU" ? "Sonda Foley" : packageType === "NAVM" ? "PUNTAS NASALES" : packageType === "ESPECIAL" ? "SONDA NASOGASTRICA" : packageType;
    return { draftId: preventiveDraftId(), packageType, createsDevice: packageCreatesDevice(packageType), deviceType, deviceSubtype: "", material: packageType === "ITU - CU" ? "NA" : "", deviceState: packageType === "ITU - CU" ? "NA" : "", french: packageCreatesDevice(packageType) ? "NA" : "", installationDate: "", removalDate: "", preventiveChecks: defaultPreventiveChecks(packageType, deviceType), oralHygieneMethod: packageType === "NAVM" ? "NA" : "", observations: "", notes: "" };
  }
  function preventiveCompliance(checks = {}) {
    const normalized = Object.values(checks).map(normalizeText).filter(Boolean);
    const values = normalized.filter(value => value === "SI" || value === "NO");
    if (!values.length) return normalized.some(value => value === "NA") ? "NA" : "";
    return Math.round((values.filter(value => value === "SI").length / values.length) * 100) + "%";
  }

  function deviceDisplayName`, "defaultPreventiveDevice/preventiveCompliance");
  }

  function patchPackageSummary(source) {
    return r(source, /  function packageReviewSummary\(device = \{\}\) \{[\s\S]*?\n  \}\n\n  function renderIaasAssessmentPanel/, `  function packageReviewSummary(device = {}) {
    const checks = PREVENTIVE_CHECKS[device.packageType] || [];
    return {
      packageReviewId: device.packageReviewId || device.savedEpisodeId || device.episodeId || device.draftId || preventiveDraftId(),
      savedEpisodeId: device.savedEpisodeId || device.episodeId || "",
      reviewDate: normalizeDate(device.reviewDate) || normalizeDate(device.savedReviewDate) || "",
      packageType: device.packageType || "",
      deviceType: deviceDisplayName(device),
      material: device.material || "",
      deviceState: device.deviceState || "",
      french: device.french || "",
      installationDate: device.installationDate || "",
      removalDate: device.removalDate || "",
      preventiveChecks: device.preventiveChecks || {},
      compliance: preventiveCompliance(device.preventiveChecks || {}),
      oralHygieneMethod: device.oralHygieneMethod || "",
      observations: device.observations || "",
      reviewedFields: checks.map(([key, label]) => ({ key, label, value: device.preventiveChecks?.[key] || "" }))
    };
  }

  function renderIaasAssessmentPanel`, "packageReviewSummary");
  }

  function patchReviewSections(source) {
    return r(source, /  function renderPreventiveReviewSections\(date, patientId, patient, active, draft\) \{[\s\S]*?\n  function preventiveDeviceCards/, `  function renderPreventiveReviewSections(date, patientId, patient, active, draft) {
    const deviceCards = preventiveDeviceCards(active, draft, date);
    const hasAnyInvasive = active.length > 0 || (draft.deviceDrafts || []).some(packageCreatesDevice);
    return [
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head compact" }, [
          h("div", {}, [h("h2", {}, ["Dispositivos invasivos actuales"]), h("p", {}, ["Vista compacta para revisar tipo, French, instalacion, retiro y dias de invasivo."])]),
          h("div", { class: "iaas-panel-actions" }, [
            h("a", { class: "iaas-button ghost compact", href: "#/seguimiento-iaas/" + date + "/paciente/" + patientId }, ["Ir a seguimiento IAAS"]),
            h("a", { class: "iaas-button ghost compact", href: "#/censo-hospitalario" }, ["Ir a vigilancia hospitalaria"]),
            hasAnyInvasive ? h("span", { class: "badge device" }, [active.length + " registrado(s)"]) : h("span", { class: "badge neutral" }, ["Sin invasivos"])
          ])
        ]),
        deviceCards.length ? h("div", { class: "device-list compact-device-grid" }, deviceCards.map(ep => renderActiveDevice(ep, draft, date))) : h("p", { class: "muted" }, ["No hay invasivos activos capturados."]),
        !hasAnyInvasive ? h("button", { class: draft.noInvasivesConfirmed ? "iaas-button primary" : "iaas-button", onclick: () => toggleNoInvasives(date, patientId) }, [draft.noInvasivesConfirmed ? "Sin invasivos confirmado" : "Confirmar sin invasivos"]) : ""
      ]),
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head compact" }, [h("div", {}, [h("h2", {}, ["Agregar paquete preventivo"]), h("p", {}, ["Selecciona el paquete y captura solo los criterios necesarios para enfermeria."])])]),
        h("div", { class: "quick-device-grid package-selector-grid" }, PREVENTIVE_PACKAGE_TYPES.map(type => h("button", { class: "quick-device package-selector", onclick: () => addDeviceDraft(date, patientId, type) }, [type]))),
        draft.deviceDrafts?.length ? h("div", { class: "device-drafts package-drafts" }, draft.deviceDrafts.map((device, index) => renderDeviceDraft(date, patientId, device, index))) : ""
      ]),
      isSurgeryTraumaService(patient.currentService) ? renderSurgeryRoomPanel(date, patientId, draft) : "",
      renderPreventiveActionsPanel(date, patientId, patient, draft)
    ].filter(Boolean);
  }

  function preventiveDeviceCards`, "renderPreventiveReviewSections");
  }

  function patchDraftRender(source) {
    let next = r(source, /  function renderDeviceDraft\(date, patientId, device, index\) \{[\s\S]*?\n  function renderPackageSpecificFields/, `  function renderDeviceDraft(date, patientId, device, index) {
    const update = (patch, rerender = true) => updateDeviceDraft(date, patientId, index, patch, rerender);
    const packageType = device.packageType || device.deviceType;
    const checks = PREVENTIVE_CHECKS[packageType] || [];
    return h("article", { class: "device-draft package-draft " + riskClass(packageType) }, [
      h("div", { class: "device-draft-head" }, [
        h("div", {}, [h("strong", {}, [packageType]), h("span", {}, [packageCreatesDevice(device) ? "Registro de invasivo y paquete preventivo" : "Registro de paquete preventivo"])]),
        h("button", { class: "icon-text", onclick: () => removeDeviceDraft(date, patientId, index) }, ["Quitar"])
      ]),
      renderPackageSpecificFields(date, patientId, device, index),
      checks.length ? h("div", { class: "preventive-bulk-actions" }, [h("span", {}, ["Aplicar a items"]), ...["SI", "NO", "NA"].map(value => h("button", { class: "iaas-button ghost compact", type: "button", onclick: () => update({ preventiveChecks: setAllPreventiveChecks(checks, value) }) }, ["TODO " + value]))]) : "",
      checks.length ? h("div", { class: "preventive-check-grid" }, checks.map(([key, label]) => renderCheckSelector(label, device.preventiveChecks?.[key], value => update({ preventiveChecks: { ...(device.preventiveChecks || {}), [key]: value } })))) : "",
      packageType === "NAVM" ? renderButtonGroup("Metodo higiene oral", NAVM_ORAL_HYGIENE_TYPES, device.oralHygieneMethod, value => update({ oralHygieneMethod: value })) : "",
      checks.length ? h("div", { class: "compliance-box" }, [h("span", {}, ["% cumplimiento"]), h("strong", {}, [preventiveCompliance(device.preventiveChecks || {}) || "Pendiente"])]) : "",
      h("label", { class: "field full" }, [h("span", {}, ["Observaciones"]), h("textarea", { value: device.observations || "", oninput: event => update({ observations: event.target.value }, false) })])
    ]);
  }

  function renderPackageSpecificFields`, "renderDeviceDraft");
    next = next.replace('device.deviceType === "CATT HD" ? renderButtonGroup("Tipo CATT HD", ["PERMACATH", "MAHURKAR"], device.deviceSubtype, value => update({ deviceSubtype: value })) : ""', 'device.deviceType === "CATT HD" ? renderButtonGroup("Tipo CATT HD", ["NA", "PERMACATH", "MAHURKAR"], device.deviceSubtype, value => update({ deviceSubtype: value })) : ""');
    next = r(next, /    if \(type === "ESPECIAL"\) \{[\s\S]*?    \}\n    return h\("div", \{ class: "package-fields" \}, \[/, `    if (type === "ESPECIAL") {
      return h("div", { class: "package-fields" }, [
        renderButtonGroup("Invasivo especial", SPECIAL_DEVICE_TYPES, device.deviceType, value => update({ deviceType: value })),
        renderButtonGroup("French", FRENCH_OPTIONS, device.french, value => update({ french: value })),
        renderPackageDates(device, update, true)
      ]);
    }
    return h("div", { class: "package-fields" }, [`, "renderPackageSpecificFields especial");
    return next;
  }

  function patchSummary(source) {
    return r(source, /  function renderIaasInvasiveSummary\(episodes = \[\], date = activeDate\(\), patientId = ""\) \{[\s\S]*?\n  function isSummaryDeviceActive/, `  function renderIaasInvasiveSummary(episodes = [], date = activeDate(), patientId = "") {
    const rows = [...episodes].sort((a, b) => String(a.installationDate || "").localeCompare(String(b.installationDate || "")) || String(deviceDisplayName(a)).localeCompare(String(deviceDisplayName(b)), "es"));
    return h("section", { class: "iaas-panel iaas-invasive-summary top-summary" }, [
      h("div", { class: "iaas-panel-head compact" }, [
        h("div", {}, [h("h2", {}, ["Invasivos colocados por enfermeria"]), h("p", {}, ["Resumen de paquetes preventivos: tipo de invasivo, instalacion y retiro."])]),
        h("div", { class: "iaas-panel-actions" }, [patientId ? h("a", { class: "iaas-button ghost compact", href: "#/ronda/" + date + "/paciente/" + patientId }, ["Revisar paquetes preventivos"]) : "", h("span", { class: "badge device" }, [rows.length + " invasivo(s)"])])
      ]),
      rows.length ? h("div", { class: "iaas-invasive-list summary-grid" }, rows.map(ep => {
        const active = isSummaryDeviceActive(ep);
        return h("article", { class: "iaas-invasive-card " + (active ? "active" : "inactive") }, [h("strong", {}, [deviceDisplayName(ep)]), h("span", {}, ["French: " + (ep.french || ep.deviceFrench || "S/D")]), h("span", {}, ["Instalacion: " + (formatDisplayDate(ep.installationDate) || "S/D")]), h("span", {}, ["Retiro: " + (formatDisplayDate(ep.removalDate) || "Activo")])]);
      })) : h("p", { class: "muted" }, ["Sin invasivos capturados por enfermeria."]),
      renderPeSummaryZone(patientId)
    ]);
  }

  function isSummaryDeviceActive`, "renderIaasInvasiveSummary");
  }

  function patchPersistence(source) {
    let next = r(source, /  function clearReviewDraftAfterSave\(date, patientId, section = "preventive"\) \{[\s\S]*?\n  function updateDeviceDraft/, `  function clearReviewDraftAfterSave(date, patientId, section = "preventive") {
    if (section !== "iaas") {
      const key = date + ":" + patientId;
      const draft = ui.reviewDrafts[key] || {};
      ui.reviewDrafts[key] = { ...draft, activeRoundSection: "preventive", removals: {}, pendingText: "", justSavedAt: nowIso() };
      ui.draftsDirty = true;
      flushDraftSave();
      return;
    }
    clearReviewDraft(date, patientId);
    ui.reviewDrafts[date + ":" + patientId] = { activeRoundSection: "iaas", iaasAssessment: defaultIaasAssessment() };
    ui.draftsDirty = true;
    flushDraftSave();
  }
  function addDeviceDraft(date, patientId, type) {
    const draft = getReviewDraft(date, patientId);
    draft.noInvasivesConfirmed = false;
    draft.deviceDrafts = [defaultPreventiveDevice(type), ...(draft.deviceDrafts || [])];
    setReviewDraft(date, patientId, draft);
    renderIaas();
  }

  function updateDeviceDraft`, "clearReviewDraftAfterSave/addDeviceDraft");
    return next;
  }

  function patchSave(source) {
    let next = source;
    next = r(next, "\n\n    const createdEpisodeIds = [];", "\n\n    applyPreventivePatientActions(date, patientId, patient, draft);\n\n    const createdEpisodeIds = [];", "applyPreventivePatientActions");
    next = r(next, "(draft.deviceDrafts || []).forEach(device => {", "(draft.deviceDrafts || []).forEach((device, index) => {\n      device.draftId ||= preventiveDraftId();\n      device.reviewDate = date;\n      device.packageReviewId ||= device.savedEpisodeId || device.episodeId || (patientId + \"|\" + date + \"|\" + device.draftId);", "device draft ids");
    next = r(next, "episodeId: buildDeviceEpisodeId(patientId, deviceDisplayName(device), device.installationDate, device.french || \"\"),", "episodeId: device.savedEpisodeId || device.episodeId || buildDeviceEpisodeId(patientId, deviceDisplayName(device), device.installationDate, (device.french || \"\") + \"|\" + (device.draftId || index)),", "episode id uniqueness");
    next = r(next, "store.deviceEpisodes[episode.episodeId] = episode;", "store.deviceEpisodes[episode.episodeId] = episode;\n      device.savedEpisodeId = episode.episodeId;\n      device.episodeId = episode.episodeId;\n      device.savedReviewDate = date;", "preserve saved episode id");
    next = r(next, "episode.updatedBy = currentUserId();\n      addAudit(\"DEVICE_EPISODE_REMOVED\"", "episode.updatedBy = currentUserId();\n      createdEpisodeIds.push(episodeId);\n      addAudit(\"DEVICE_EPISODE_REMOVED\"", "sync removals");
    next = r(next, "notes: draft.notes || \"\",\n      activeRoundSection:", "notes: draft.notes || \"\",\n      generalObservations: cleanCell(draft.generalObservations),\n      generalObservationDate: normalizeDate(draft.generalObservationDate) || date,\n      surgeryRoom: draft.surgeryRoom || null,\n      quickDischarge: draft.quickDischarge || null,\n      patientMovement: draft.patientMovement || null,\n      activeRoundSection:", "entry preventive fields");
    next = r(next, "packageReviews: [...(previousEntry.packageReviews || []), ...packageReviews],", "packageReviews: mergePackageReviewList(previousEntry.packageReviews || [], packageReviews),", "package review merge");
    next = r(next, "if (store.dailyCensus[date]?.patients?.[patientId]) {\n      store.dailyCensus[date].patients[patientId].reviewedByNursing", "if (store.dailyCensus[date]?.patients?.[patientId]) {\n      store.dailyCensus[date].patients[patientId].service = patient.currentService;\n      store.dailyCensus[date].patients[patientId].bed = patient.currentBed;\n      store.dailyCensus[date].patients[patientId].reviewedByNursing", "daily census movement");
    next = r(next, "episodes: createdEpisodeIds.map(id => store.deviceEpisodes[id])", "episodes: unique(createdEpisodeIds).map(id => store.deviceEpisodes[id]).filter(Boolean)", "enqueue unique episodes");
    return next;
  }

  function helperCode() {
    return `  function setAllPreventiveChecks(checks, value) {
    return Object.fromEntries((checks || []).map(([key]) => [key, value]));
  }
  function isSurgeryTraumaService(service) {
    const key = normalizeText(service);
    return key.includes("CIRUGIA") || key.includes("TRAUMATOLOGIA") || key.includes("CX") || key.includes("TX");
  }
  function renderSurgeryRoomPanel(date, patientId, draft) {
    const surgery = draft.surgeryRoom || {};
    const patch = value => updateDraft(date, patientId, { surgeryRoom: { ...surgery, ...value } });
    return h("section", { class: "iaas-panel preventive-action-card" }, [
      h("h2", {}, ["Quirofano"]),
      h("label", { class: "check-selector" }, [h("span", {}, ["Paciente en quirofano"]), h("div", { class: "button-segment" }, ["SI", "NO"].map(value => h("button", { type: "button", class: normalizeText(surgery.inOperatingRoom) === normalizeText(value) ? "active" : "", onclick: () => patch({ inOperatingRoom: value }) }, [value])))]),
      normalizeText(surgery.inOperatingRoom) === "SI" ? h("div", { class: "form-grid compact" }, [
        h("label", { class: "field" }, [h("span", {}, ["Fecha ingreso"]), h("input", { type: "date", value: normalizeDate(surgery.date) || date, oninput: event => patch({ date: event.target.value }) })]),
        h("label", { class: "field" }, [h("span", {}, ["Hora 24 h"]), h("input", { type: "time", value: surgery.time || "", oninput: event => patch({ time: event.target.value }) })])
      ]) : ""
    ]);
  }
  function renderPreventiveActionsPanel(date, patientId, patient, draft) {
    const movement = draft.patientMovement || {};
    const discharge = draft.quickDischarge || {};
    const generalDate = normalizeDate(draft.generalObservationDate) || date || isoToday();
    const patchMovement = value => updateDraft(date, patientId, { patientMovement: { ...movement, ...value } });
    const patchDischarge = value => updateDraft(date, patientId, { quickDischarge: { ...discharge, ...value } });
    return h("section", { class: "iaas-panel preventive-bottom-panel" }, [
      h("div", { class: "iaas-panel-head compact" }, [h("div", {}, [h("h2", {}, ["Pendientes, movimientos y alta"]), h("p", {}, ["Acciones rapidas de cierre de ronda preventiva."])])]),
      h("div", { class: "preventive-bottom-grid" }, [
        h("article", { class: "preventive-action-card" }, [h("h3", {}, ["Cambio de cama o servicio"]), h("label", { class: "field" }, [h("span", {}, ["Nuevo servicio"]), h("input", { value: movement.service ?? patient.currentService ?? "", oninput: event => patchMovement({ service: event.target.value }) })]), h("label", { class: "field" }, [h("span", {}, ["Nueva cama"]), h("input", { value: movement.bed ?? patient.currentBed ?? "", oninput: event => patchMovement({ bed: event.target.value }) })])]),
        h("article", { class: "preventive-action-card" }, [h("h3", {}, ["Alta rapida"]), h("label", { class: "field" }, [h("span", {}, ["Fecha del alta"]), h("input", { type: "date", value: normalizeDate(discharge.date) || "", oninput: event => patchDischarge({ date: event.target.value }) })]), renderButtonGroup("Turno del alta", ["MATUTINO", "VESPERTINO", "NOCTURNO", "JORNADA"], discharge.shift || "", value => patchDischarge({ shift: value })), renderButtonGroup("Tipo de alta", ["MEJORIA", "TRASLADO", "MAXIMO BENEFICIO", "VOLUNTARIA", "DEFUNCION"], discharge.type || "", value => patchDischarge({ type: value })), normalizeText(discharge.type) === "DEFUNCION" ? h("label", { class: "field" }, [h("span", {}, ["Folio certificado defuncion"]), h("input", { value: discharge.deathCertificateFolio || "", oninput: event => patchDischarge({ deathCertificateFolio: event.target.value }) })]) : ""]),
        h("article", { class: "preventive-action-card" }, [h("h3", {}, ["Pendientes y notas"]), h("label", { class: "field" }, [h("span", {}, ["Agregar pendiente"]), h("input", { value: draft.pendingText || "", placeholder: "Ej. confirmar retiro de CVC, revisar cultivo...", oninput: event => updateDraft(date, patientId, { pendingText: event.target.value }) })]), h("label", { class: "field" }, [h("span", {}, ["Notas cortas"]), h("textarea", { value: draft.notes || "", oninput: event => updateDraft(date, patientId, { notes: event.target.value }) })])]),
        h("article", { class: "preventive-action-card" }, [h("h3", {}, ["Observaciones generales"]), h("small", {}, [formatDisplayDate(generalDate) || generalDate]), h("label", { class: "field" }, [h("span", {}, ["Texto libre"]), h("textarea", { value: draft.generalObservations || "", oninput: event => updateDraft(date, patientId, { generalObservations: event.target.value, generalObservationDate: generalDate }) })])])
      ])
    ]);
  }
  function mergePackageReviewList(previous = [], next = []) {
    const byId = new Map();
    [...previous, ...next].forEach(item => {
      const key = item.packageReviewId || [item.packageType, item.savedEpisodeId, item.reviewDate || item.date, item.deviceType].map(cleanCell).join("|");
      byId.set(key, { ...item, packageReviewId: key });
    });
    return [...byId.values()];
  }
  function normalizeDischargeTypeForPatient(type) {
    const key = normalizeText(type);
    if (key === "DEFUNCION") return "DEFUNCION";
    if (key === "TRASLADO") return "ALTA HOSPITALARIA POR TRASLADO";
    if (key.includes("MAXIMO")) return "ALTA HOSPITALARIA POR MAXIMO BENEFICIO";
    if (key === "VOLUNTARIA") return "ALTA HOSPITALARIA VOLUNTARIA";
    return "ALTA HOSPITALARIA POR MEJORIA";
  }
  function applyPreventivePatientActions(date, patientId, patient, draft) {
    const movement = draft.patientMovement || {};
    const nextService = cleanCell(movement.service);
    const nextBed = cleanCell(movement.bed);
    if (nextService && normalizeText(nextService) !== normalizeText(patient.currentService)) patient.currentService = normalizeService(nextService) || nextService;
    if (nextBed && normalizeText(nextBed) !== normalizeText(patient.currentBed)) patient.currentBed = nextBed.toUpperCase();
    const discharge = draft.quickDischarge || {};
    if (normalizeDate(discharge.date) && cleanCell(discharge.type)) {
      patient.hospitalizationStatus = "egresado";
      patient.dischargeStatus = "confirmada";
      patient.dischargeDate = normalizeDate(discharge.date);
      patient.dischargeShift = cleanCell(discharge.shift);
      patient.dischargeType = normalizeDischargeTypeForPatient(discharge.type);
      patient.deathCertificateFolio = normalizeText(discharge.type) === "DEFUNCION" ? cleanCell(discharge.deathCertificateFolio) : "";
      patient.dischargeReviewRequired = false;
    }
    if (cleanCell(draft.generalObservations)) patient.observations = mergeClinicalText(patient.observations || "", "Observaciones generales " + (formatDisplayDate(draft.generalObservationDate || date) || date) + ": " + cleanCell(draft.generalObservations));
    if (store.dailyCensus[date]?.patients?.[patientId]) {
      const row = store.dailyCensus[date].patients[patientId];
      row.service = patient.currentService;
      row.bed = patient.currentBed;
      row.observations = patient.observations || row.observations || "";
      if (patient.hospitalizationStatus === "egresado") { row.present = false; row.dischargeConfirmed = true; row.dischargeDate = patient.dischargeDate; row.dischargeType = patient.dischargeType; }
    }
  }
  function preventivePackageReviewTimeline(patientId, packageType) {
    const items = [];
    Object.values(store.dailyRounds || {}).forEach(round => {
      const entry = Object.values(round.entries || {}).find(item => item.patientId === patientId);
      (entry?.packageReviews || []).forEach(review => {
        if (normalizeText(review.packageType) === normalizeText(packageType)) items.push({ ...review, roundDate: normalizeDate(entry.roundDate) || entry.roundDate || review.reviewDate || "" });
      });
    });
    return items.sort((a, b) => String(b.roundDate || b.reviewDate || "").localeCompare(String(a.roundDate || a.reviewDate || "")));
  }
  function renderPeSummaryZone(patientId) {
    if (!patientId) return "";
    const items = preventivePackageReviewTimeline(patientId, "P.E. Y P.B.M.T.");
    if (!items.length) return "";
    return h("div", { class: "pe-summary-zone" }, [h("h3", {}, ["P.E."]), h("div", { class: "summary-grid" }, items.map(item => h("article", { class: "pe-summary-card" }, [h("strong", {}, [formatDisplayDate(item.reviewDate || item.roundDate) || item.reviewDate || item.roundDate || "Sin fecha"]), h("span", {}, ["Cumplimiento: " + (item.compliance || preventiveCompliance(item.preventiveChecks || {}) || "Pendiente")]), item.observations ? h("small", {}, [item.observations]) : ""])))])
  }
  function renderDailyPreventiveHistory(patientId, entries = [], episodes = []) {
    const rows = [...entries].filter(entry => entry.roundDate || (entry.packageReviews || []).length).sort((a, b) => String(b.roundDate).localeCompare(String(a.roundDate)));
    if (!rows.length) return h("p", { class: "muted" }, ["Aun no hay rondas preventivas guardadas."]);
    return h("div", { class: "preventive-history-days" }, rows.map(entry => {
      const date = normalizeDate(entry.roundDate) || entry.roundDate || "";
      const dayEpisodes = episodes.filter(ep => isEpisodeActiveOn(ep, date) || normalizeDate(ep.createdDuringRoundDate) === date);
      const reviews = entry.packageReviews || [];
      return h("details", { class: "preventive-history-day", open: date === activeDate() }, [h("summary", {}, [h("span", {}, [formatDisplayDate(date) || date || "Sin fecha"]), h("small", {}, [reviews.length + " paquete(s), " + dayEpisodes.length + " invasivo(s)"])]), h("div", { class: "preventive-history-content" }, [reviews.length ? h("div", {}, reviews.map(review => renderPreventiveHistoryCard(review, date))) : h("p", { class: "muted" }, ["Sin paquetes capturados ese dia."]), dayEpisodes.length ? h("div", {}, dayEpisodes.map(ep => h("article", { class: "preventive-history-card" }, [h("strong", {}, [deviceDisplayName(ep)]), h("span", {}, ["French: " + (ep.french || "S/D")]), h("span", {}, ["Instalacion: " + (formatDisplayDate(ep.installationDate) || "S/D")]), h("span", {}, ["Retiro: " + (formatDisplayDate(ep.removalDate) || "Activo")])])) ) : "", h("div", { class: "preventive-history-actions" }, [h("button", { class: "iaas-button ghost compact", type: "button", onclick: () => editPreventiveHistoryDay(date, patientId) }, ["Editar registro completo"])])])]);
    }));
  }
  function renderPreventiveHistoryCard(review = {}, date = "") {
    const fields = review.reviewedFields || Object.entries(review.preventiveChecks || {}).map(([key, value]) => ({ key, label: key, value }));
    return h("article", { class: "preventive-history-card" }, [h("strong", {}, [review.packageType || "Paquete preventivo"]), h("span", {}, ["Cumplimiento: " + (review.compliance || preventiveCompliance(review.preventiveChecks || {}) || "Pendiente")]), h("span", {}, ["Fecha: " + (formatDisplayDate(review.reviewDate || date) || date || "S/D")]), review.french ? h("span", {}, ["French: " + review.french]) : "", fields.length ? h("ul", {}, fields.map(field => h("li", {}, [(field.label || field.key) + ": " + (field.value || "Sin dato")]))) : "", review.observations ? h("small", {}, [review.observations]) : ""]);
  }
  function editPreventiveHistoryDay(date, patientId) {
    const entry = store.dailyRounds?.[date]?.entries?.[patientId];
    const draft = getReviewDraft(date, patientId, "preventive");
    draft.deviceDrafts = (entry?.packageReviews || []).map(review => ({ ...defaultPreventiveDevice(review.packageType || "ESPECIAL"), ...review, draftId: review.packageReviewId || preventiveDraftId(), savedEpisodeId: review.savedEpisodeId || "", episodeId: review.savedEpisodeId || "", reviewDate: date, preventiveChecks: review.preventiveChecks || {}, observations: review.observations || "" }));
    draft.notes = entry?.notes || draft.notes || "";
    draft.generalObservations = entry?.generalObservations || draft.generalObservations || "";
    draft.generalObservationDate = entry?.generalObservationDate || date;
    draft.activeRoundSection = "preventive";
    setReviewDraft(date, patientId, draft);
    location.hash = "#/ronda/" + date + "/paciente/" + patientId;
    flashIaas("Registro preventivo cargado para edicion completa.");
    renderIaas();
  }

`;
  }

  function patchHistory(source) {
    return source.replace(/h\("h2", \{\}, \["L[^"]*invasivos"\]\),\s*renderDeviceTimeline\(episodes\)/, 'h("h2", {}, ["Historial diario de invasivos"]),\n          renderDailyPreventiveHistory(patientId, entries, episodes)');
  }

  function patchSource(source) {
    if (typeof source !== "string") return source;
    if (!source.includes("PREVENTIVE_PACKAGE_TYPES") || !source.includes("function saveRoundEntry")) return source;
    if (source.includes("epividaPreventivePackagesEnhancementApplied")) return source;
    let next = patchConstants(source);
    next = patchDefaults(next);
    next = patchPackageSummary(next);
    next = patchReviewSections(next);
    next = patchDraftRender(next);
    next = patchSummary(next);
    next = patchPersistence(next);
    next = patchSave(next);
    next = patchHistory(next);
    next = r(next, /  if \(window\.__EPIVIDA_TEST_MODE__\) \{/, helperCode() + "  if (window.__EPIVIDA_TEST_MODE__) {", "helper injection");
    return next + "\n;window.epividaPreventivePackagesEnhancementApplied = true;\n";
  }

  style();
  window.eval = function epividaPreventivePackagesEnhancementEval(source) {
    return nativeEval.call(this, patchSource(source));
  };
})();
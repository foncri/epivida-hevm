(() => {
  "use strict";

  if (window.__epividaPreventiveRoundWorkflowHotfix20260602) return;
  window.__epividaPreventiveRoundWorkflowHotfix20260602 = true;

  const nativeEval = window.eval;

  function injectStyle() {
    if (document.getElementById("epivida-preventive-round-workflow-hotfix-style")) return;
    const style = document.createElement("style");
    style.id = "epivida-preventive-round-workflow-hotfix-style";
    style.textContent = `
      .patient-round .round-save-bar .preventive-final-actions { display: flex; flex-wrap: wrap; gap: .6rem; justify-content: flex-end; width: 100%; }
      .patient-round .round-save-bar .preventive-final-actions .iaas-button { min-width: 132px; }
      .patient-round .round-save-bar .preventive-pending-button { background: #f59e0b; border-color: #d97706; color: #111827; font-weight: 900; }
      .bed-board.preventive .bed-tile.reviewed,
      .round-nav-board.preventive .bed-tile.reviewed { background: #dcfce7; border-color: #22c55e; color: #064e3b; }
      .bed-board.preventive .bed-tile.overdue,
      .round-nav-board.preventive .bed-tile.overdue { background: #ffedd5; border-color: #f97316; color: #7c2d12; }
      .bed-board.preventive .bed-tile.overdue span,
      .round-nav-board.preventive .bed-tile.overdue span { color: #9a3412; }
    `;
    document.head.append(style);
  }

  function replaceOnce(source, pattern, replacement, label) {
    const next = source.replace(pattern, replacement);
    if (next === source) console.warn("No se pudo aplicar ajuste de flujo preventivo:", label);
    return next;
  }

  function renderPatientRoundSource() {
    return `  function renderPatientRound(date, patientId, requestedSection = null) {
    const patient = store.patients[patientId];
    if (!patient) return renderNotFound("Paciente no encontrado.");
    ensureDailyRound(date);
    const section = requestedSection === "iaas" ? "iaas" : "preventive";
    const draft = getReviewDraft(date, patientId, section);
    const active = activeEpisodes(patientId, date);
    const patientDevices = episodesForPatient(patientId);
    const stay = isAmbulatoryStayService(patient.currentService) ? "Ambulatorio" : (daysBetween(patient.admissionDate, date) ?? "NA") + " dias";
    const backHref = section === "iaas" ? "#/seguimiento-iaas" : "#/ronda/" + date;
    const saveButtons = section === "iaas"
      ? [
        h("button", { class: "iaas-button ghost", onclick: () => saveRoundEntry(date, patientId, "incompleto", false) }, ["Guardar como incompleto"]),
        h("button", { class: "iaas-button", onclick: () => saveRoundEntry(date, patientId, "pendiente", false) }, ["Marcar pendiente"]),
        h("button", { class: "iaas-button primary", onclick: () => saveRoundEntry(date, patientId, "revisado", "previous") }, ["Guardar y anterior cama"]),
        h("button", { class: "iaas-button primary", onclick: () => saveRoundEntry(date, patientId, "revisado", false) }, ["Guardar"]),
        h("button", { class: "iaas-button primary strong", onclick: () => saveRoundEntry(date, patientId, "revisado", "next") }, ["Guardar y siguiente cama"])
      ]
      : [
        h("div", { class: "preventive-final-actions" }, [
          h("button", { class: "iaas-button preventive-pending-button", onclick: () => saveRoundEntry(date, patientId, "pendiente", false) }, ["Pendiente"]),
          h("button", { class: "iaas-button primary strong", onclick: () => saveRoundEntry(date, patientId, "revisado", false) }, ["Guardar"])
        ])
      ];
    return h("div", { class: "iaas-page patient-round" }, [
      renderPatientRoundSummary(date, patientId, patient, stay, backHref, section),
      ...(section === "iaas"
        ? [renderIaasInvasiveSummary(patientDevices, date, patientId), renderIaasAssessmentPanel(date, patientId, patient, active, draft)]
        : renderPreventiveReviewSections(date, patientId, patient, active, draft)),
      h("div", { class: "round-save-bar" }, [
        renderRoundNavigationBoard(date, patientId, section, patient),
        ...saveButtons
      ])
    ]);
  }

`;
  }

  function preventiveActionHelpersSource() {
    return `  function sanitizePreventiveRoundText(value) {
    const text = cleanCell(value)
      .replace(/\\s*(?:\\/|\\||;)+\\s*/g, " / ")
      .replace(/(?:^|\\s)\\/+(?=\\s|$)/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
    return /^(?:\\/|\\||;|\\s)*$/.test(text) ? "" : text.replace(/^\\s*(?:\\/|\\||;)+\\s*/, "").replace(/\\s*(?:\\/|\\||;)+\\s*$/, "");
  }

  function renderSurgeryRoomPanel(date, patientId, draft) {
    const surgery = draft.surgeryRoom || {};
    const patch = (value, shouldRender = true) => {
      const currentDraft = getReviewDraft(date, patientId);
      updateDraft(date, patientId, { surgeryRoom: { ...(currentDraft.surgeryRoom || {}), ...value } });
      if (shouldRender) renderIaas();
    };
    return h("section", { class: "iaas-panel preventive-action-card" }, [
      h("h2", {}, ["Quirofano"]),
      h("label", { class: "check-selector" }, [
        h("span", {}, ["Paciente en quirofano"]),
        h("div", { class: "button-segment" }, ["SI", "NO"].map(value =>
          h("button", { type: "button", class: normalizeText(surgery.inOperatingRoom) === normalizeText(value) ? "active" : "", onclick: () => patch({ inOperatingRoom: value }) }, [value])
        ))
      ]),
      normalizeText(surgery.inOperatingRoom) === "SI" ? h("div", { class: "form-grid compact" }, [
        h("label", { class: "field" }, [h("span", {}, ["Fecha ingreso"]), h("input", { type: "date", value: normalizeDate(surgery.date) || date, oninput: event => patch({ date: event.target.value }, false) })]),
        h("label", { class: "field" }, [h("span", {}, ["Hora 24 h"]), h("input", { type: "time", value: surgery.time || "", oninput: event => patch({ time: event.target.value }, false) })])
      ]) : ""
    ]);
  }

  function preventiveMovementServiceOptions(patient = {}, movement = {}) {
    return unique([movement.service, patient.currentService, ...(Array.isArray(SERVICES) ? SERVICES : [])].map(normalizeService).filter(Boolean));
  }

  function renderPreventiveActionsPanel(date, patientId, patient, draft) {
    const movement = draft.patientMovement || {};
    const discharge = draft.quickDischarge || {};
    const generalDate = normalizeDate(draft.generalObservationDate) || date || isoToday();
    const pendingNotes = sanitizePreventiveRoundText(draft.pendingText || draft.notes || "");
    const patchMovement = value => {
      const currentDraft = getReviewDraft(date, patientId);
      updateDraft(date, patientId, { patientMovement: { ...(currentDraft.patientMovement || {}), ...value } });
    };
    const patchDischarge = (value, shouldRender = true) => {
      const currentDraft = getReviewDraft(date, patientId);
      updateDraft(date, patientId, { quickDischarge: { ...(currentDraft.quickDischarge || {}), ...value } });
      if (shouldRender) renderIaas();
    };
    return h("section", { class: "iaas-panel preventive-bottom-panel" }, [
      h("div", { class: "iaas-panel-head compact" }, [
        h("div", {}, [
          h("h2", {}, ["Pendientes, movimientos y alta"]),
          h("p", {}, ["Acciones rapidas de cierre de ronda preventiva."])
        ])
      ]),
      h("div", { class: "preventive-bottom-grid" }, [
        h("article", { class: "preventive-action-card" }, [
          h("h3", {}, ["Cambio de cama o servicio"]),
          h("label", { class: "field" }, [
            h("span", {}, ["Nuevo servicio"]),
            h("select", {
              value: normalizeService(movement.service || patient.currentService || ""),
              onchange: event => patchMovement({ service: event.target.value })
            }, preventiveMovementServiceOptions(patient, movement).map(service => h("option", { value: service }, [service])))
          ]),
          h("label", { class: "field" }, [h("span", {}, ["Nueva cama"]), h("input", { value: movement.bed ?? patient.currentBed ?? "", oninput: event => patchMovement({ bed: event.target.value }) })])
        ]),
        h("article", { class: "preventive-action-card" }, [
          h("h3", {}, ["Alta rapida"]),
          h("label", { class: "field" }, [h("span", {}, ["Fecha del alta"]), h("input", { type: "date", value: normalizeDate(discharge.date) || "", oninput: event => patchDischarge({ date: event.target.value }, false) })]),
          renderButtonGroup("Turno del alta", ["MATUTINO", "VESPERTINO", "NOCTURNO", "JORNADA"], discharge.shift || "", value => patchDischarge({ shift: value })),
          renderButtonGroup("Tipo de alta", ["MEJORIA", "TRASLADO", "MAXIMO BENEFICIO", "VOLUNTARIA", "DEFUNCION"], discharge.type || "", value => patchDischarge({ type: value })),
          normalizeText(discharge.type) === "DEFUNCION" ? h("label", { class: "field" }, [h("span", {}, ["Folio certificado defuncion"]), h("input", { value: discharge.deathCertificateFolio || "", oninput: event => patchDischarge({ deathCertificateFolio: event.target.value }, false) })]) : ""
        ]),
        h("article", { class: "preventive-action-card" }, [
          h("h3", {}, ["Pendientes y notas"]),
          h("label", { class: "field" }, [h("span", {}, ["Pendientes y notas"]), h("textarea", {
            value: pendingNotes,
            placeholder: "Ej. confirmar retiro de CVC, revisar cultivo...",
            oninput: event => {
              const text = sanitizePreventiveRoundText(event.target.value);
              if (event.target.value !== text) event.target.value = text;
              updateDraft(date, patientId, { pendingText: text, notes: text });
            }
          })])
        ]),
        h("article", { class: "preventive-action-card" }, [
          h("h3", {}, ["Observaciones generales"]),
          h("small", {}, [formatDisplayDate(generalDate) || generalDate]),
          h("label", { class: "field" }, [h("span", {}, ["Texto libre"]), h("textarea", { value: draft.generalObservations || "", oninput: event => updateDraft(date, patientId, { generalObservations: event.target.value, generalObservationDate: generalDate }) })])
        ])
      ])
    ]);
  }

  function mergePackageReviewList`;
  }

  function patchSource(source) {
    if (typeof source !== "string") return source;
    if (!source.includes("function renderPatientRound(date, patientId") || !source.includes("function saveRoundEntry(date, patientId")) return source;
    if (source.includes("epividaPreventiveRoundWorkflowHotfixApplied")) return source;
    if (!source.includes("epividaPreventivePackagesEnhancementApplied")) return source;

    let next = source;
    if (!next.includes("preventive-final-actions")) {
      next = replaceOnce(
        next,
        /  function renderPatientRound\(date, patientId, requestedSection = null\) \{[\s\S]*?\n  function renderPatientRoundSummary/,
        renderPatientRoundSource() + "  function renderPatientRoundSummary",
        "barra inferior preventiva"
      );
    }
    if (!next.includes("sanitizePreventiveRoundText")) {
      next = replaceOnce(
        next,
        /  function renderSurgeryRoomPanel\(date, patientId, draft\) \{[\s\S]*?\n  function mergePackageReviewList/,
        preventiveActionHelpersSource(),
        "acciones preventivas y alta rapida"
      );
    }
    if (!next.includes("draft.noInvasivesConfirmed = true")) {
      next = replaceOnce(
        next,
        "    const patient = store.patients[patientId];\n    const draft = getReviewDraft(date, patientId);\n    const errors = validateReviewDraft(date, patientId, draft, requestedStatus);\n",
        "    const patient = store.patients[patientId];\n    const draft = getReviewDraft(date, patientId);\n    if (requestedStatus === \"revisado\" && draft.activeRoundSection !== \"iaas\" && !draft.noInvasivesConfirmed && !(draft.deviceDrafts || []).some(packageCreatesDevice) && !activeEpisodes(patientId, date).length) {\n      draft.noInvasivesConfirmed = true;\n      setReviewDraft(date, patientId, draft);\n    }\n    const errors = validateReviewDraft(date, patientId, draft, requestedStatus);\n",
        "autoconfirmar sin invasivos al guardar"
      );
    }
    if (!next.includes("const cleanPendingText = sanitizePreventiveRoundText")) {
      next = replaceOnce(
        next,
        /    const pendingAdded = draft\.pendingText \? \[draft\.pendingText\.trim\(\)\] : \[\];\n    if \(pendingAdded\.length\) \{?\n      patient\.activePendingIssues = mergeUnique\(patient\.activePendingIssues \|\| \[\], pendingAdded\);\n    \}?\n/,
        "    const cleanPendingText = sanitizePreventiveRoundText(draft.pendingText || draft.notes || \"\");\n    const pendingAdded = cleanPendingText ? [cleanPendingText] : [];\n    if (pendingAdded.length) patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], pendingAdded);\n",
        "pendientes limpios"
      );
    }
    if (!next.includes("requestedStatus === \"pendiente\" ? \"pendiente\"")) {
      next = replaceOnce(
        next,
        "    const status = forcedIncomplete ? \"incompleto\" : alerts.length ? \"alerta\" : requestedStatus;\n",
        "    const status = requestedStatus === \"pendiente\" ? \"pendiente\" : forcedIncomplete ? \"incompleto\" : alerts.length ? \"alerta\" : requestedStatus;\n",
        "estado pendiente explicito"
      );
    }
    if (!next.includes("notes: cleanPendingText || sanitizePreventiveRoundText")) {
      next = replaceOnce(
        next,
        "      notes: draft.notes || \"\",\n",
        "      notes: cleanPendingText || sanitizePreventiveRoundText(draft.notes || \"\"),\n",
        "notas limpias"
      );
    }

    return next + "\n;window.epividaPreventiveRoundWorkflowHotfixApplied = true;\n";
  }

  injectStyle();
  window.eval = function epividaPreventiveRoundWorkflowHotfixEval(source) {
    return nativeEval.call(this, patchSource(source));
  };
})();

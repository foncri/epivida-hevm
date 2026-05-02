(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const FIREBASE_VERSION = "10.12.4";

  const SERVICES = [
    "MEDICINA INTERNA",
    "CIRUGÍA Y TRAUMATOLOGÍA",
    "PEDIATRÍA",
    "CUNEROS",
    "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES",
    "HEMODIÁLISIS",
    "URGENCIAS",
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS",
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS",
    "GINECOLOGÍA Y OBSTETRICIA",
    "AMBULATORIO"
  ];

  const DEVICE_TYPES = [
    "CVC",
    "Catéter periférico",
    "Sonda Foley",
    "Ventilación mecánica",
    "Tubo endotraqueal",
    "Traqueostomía",
    "Drenaje",
    "Sonda nasogástrica",
    "Nutrición parenteral",
    "Otro"
  ];

  const REQUIRED_COLUMNS = [
    "patient_id",
    "fecha_censo",
    "servicio",
    "cama",
    "edad",
    "sexo",
    "fecha_ingreso",
    "diagnostico_actual",
    "pendientes"
  ];

  const COLUMN_ALIASES = {
    patient_id: ["patient_id", "paciente_id", "id_paciente", "expediente", "id", "folio"],
    fecha_censo: ["fecha_censo", "fecha", "censo_fecha"],
    servicio: ["servicio", "area", "área", "departamento"],
    cama: ["cama", "cama_actual", "numero_cama", "número_cama"],
    edad: ["edad"],
    sexo: ["sexo", "genero", "género"],
    fecha_ingreso: ["fecha_ingreso", "ingreso"],
    diagnostico_actual: ["diagnostico_actual", "diagnóstico_actual", "diagnostico", "diagnóstico", "dx"],
    pendientes: ["pendientes", "pendiente", "observaciones_pendientes"],
    hospital_internal_id: ["hospital_internal_id", "id_hospitalario", "registro", "n_expediente"],
    riesgo_iaas: ["riesgo_iaas", "riesgo", "clasificacion_iaas", "clasificación_iaas"],
    observaciones: ["observaciones", "obs"],
    medico_tratante: ["medico_tratante", "médico_tratante", "medico", "médico"],
    piso: ["piso"],
    aislamiento: ["aislamiento"],
    antibioticos: ["antibioticos", "antibióticos"],
    cultivos_pendientes: ["cultivos_pendientes", "cultivos"]
  };

  const ui = {
    route: parseRoute(),
    importText: "",
    importDraft: null,
    importProgress: "",
    importSaving: false,
    selectedService: "Todos",
    reviewDrafts: loadJson(DRAFT_KEY, {}),
    activeDeviceType: "",
    firebase: {
      enabled: false,
      ready: false,
      denied: false,
      user: null,
      error: "",
      authProvider: window.EPIVIDA_AUTH_PROVIDER || "email",
      offlinePersistence: "No configurada",
      remoteHydrated: false,
      realtimeStatus: "Sin escucha colaborativa"
    },
    requireAuth: window.EPIVIDA_REQUIRE_AUTH !== false,
    allowedEmails: (window.EPIVIDA_ALLOWED_EMAILS || []).map(email => String(email).toLowerCase())
  };

  let store = loadStore();
  let firebaseRuntime = null;
  let remoteUnsubscribers = [];

  window.addEventListener("hashchange", () => {
    ui.route = parseRoute();
    renderIaas();
  });
  window.addEventListener("online", () => {
    flashIaas("Conexión recuperada. Intentando sincronizar pendientes.");
    flushSyncQueue();
    renderIaas();
  });
  window.addEventListener("offline", () => {
    flashIaas("Sin conexión. Los cambios se guardarán localmente.");
    renderIaas();
  });

  boot();

  async function boot() {
    await initFirebaseIfConfigured();
    if (!location.hash) location.hash = "#/dashboard";
    renderIaas();
    flushSyncQueue();
  }

  function loadStore() {
    const current = loadJson(STORE_KEY, null);
    if (current?.version === 1) return current;
    const seeded = seedFromCurrentCensus();
    saveStore(seeded);
    return seeded;
  }

  function seedFromCurrentCensus() {
    const date = isoToday();
    const rows = (window.CENSO_SEED?.rows || []).filter(row => row.type === "patient");
    const patients = {};
    const censusPatients = {};
    const roundEntries = {};
    const deviceEpisodes = {};

    rows.forEach(row => {
      const patientId = createPatientId({
        patient_id: row.id,
        hospital_internal_id: row.id,
        servicio: row.servicio,
        cama: row.cama,
        diagnostico_actual: row.dxHospitalarios
      });
      const service = normalizeService(row.servicio);
      const pending = splitPending(row.observaciones);
      patients[patientId] = {
        patientId,
        displayCode: makeDisplayCode(patientId),
        hospitalInternalId: row.id || null,
        pseudonymizedId: patientId,
        currentService: service,
        currentBed: normalizeBed(row.cama),
        sex: normalizeSex(row.sexo),
        age: parseAge(row.edad),
        admissionDate: normalizeDate(row.ingreso) || null,
        currentDiagnosis: row.dxHospitalarios || null,
        diagnosisHistory: [{ date, value: row.dxHospitalarios || "", source: "seed" }],
        activePendingIssues: pending,
        currentRiskLevel: riskFromRow(row),
        hospitalizationStatus: row.ingreso === "AMB" ? "alta_probable" : "hospitalizado",
        presentInLatestCensus: true,
        latestCensusDate: date,
        latestRoundDate: null,
        latestRoundStatus: "pendiente",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdBy: "seed",
        updatedBy: "seed"
      };
      censusPatients[patientId] = {
        patientId,
        service,
        bed: normalizeBed(row.cama),
        present: true,
        importedFromFile: true,
        importBatchId: `seed-${date}`,
        rowHash: hashNormalizedRow({
          patient_id: patientId,
          fecha_censo: date,
          servicio: service,
          cama: normalizeBed(row.cama),
          diagnostico_actual: row.dxHospitalarios || "",
          pendientes: pending.join(" | ")
        }),
        reviewedByNursing: false,
        reviewStatus: "pendiente",
        reviewedAt: null,
        syncStatus: "server_synced",
        notes: ""
      };
      roundEntries[patientId] = {
        entryId: patientId,
        patientId,
        service,
        bed: normalizeBed(row.cama),
        reviewedBy: null,
        reviewedAt: null,
        roundDate: date,
        hasInvasives: false,
        noInvasivesConfirmed: false,
        reviewedDevices: [],
        pendingIssuesAdded: [],
        alertsGenerated: [],
        status: "pendiente",
        syncStatus: "server_synced",
        localSavedAt: null,
        serverConfirmedAt: null,
        notes: ""
      };
      inferSeedDevices(row, patientId, date).forEach(episode => {
        deviceEpisodes[episode.episodeId] = episode;
      });
    });

    return {
      version: 1,
      patients,
      dailyCensus: {
        [date]: {
          date,
          importBatchId: `seed-${date}`,
          importedAt: nowIso(),
          importedBy: "seed",
          totalRows: rows.length,
          totalPatientsDetected: rows.length,
          totalNewPatients: rows.length,
          totalUpdatedPatients: 0,
          totalDuplicatesSkipped: 0,
          totalErrors: 0,
          status: "imported",
          closedAt: null,
          closedBy: null,
          patients: censusPatients,
          conflicts: []
        }
      },
      dailyRounds: {
        [date]: {
          date,
          status: "not_started",
          startedAt: null,
          startedBy: null,
          closedAt: null,
          closedBy: null,
          entries: roundEntries,
          totalPatients: rows.length,
          reviewedPatients: 0,
          pendingPatients: rows.length,
          incompletePatients: 0,
          reconciliationPatients: 0,
          activeAlerts: 0,
          localPendingWritesCount: 0,
          serverSyncedWritesCount: 0,
          errorWritesCount: 0
        }
      },
      deviceEpisodes,
      auditLogs: [],
      writeQueue: [],
      users: {},
      lastSavedAt: nowIso()
    };
  }

  function inferSeedDevices(row, patientId, date) {
    const text = normalizeText(`${row.dxHospitalarios || ""} ${row.observaciones || ""}`);
    const candidates = [];
    if (text.includes("CVC") || text.includes("CAT HD") || text.includes("CATETER HD")) candidates.push(["CVC", "Hemodiálisis"]);
    if (text.includes("CU ") || text.includes(" C.U") || text.includes("SONDA FOLEY")) candidates.push(["Sonda Foley", null]);
    if (text.includes("VM") || text.includes("VENTILACION") || text.includes("NAVM")) candidates.push(["Ventilación mecánica", null]);
    if (text.includes("DRENAJE")) candidates.push(["Drenaje", null]);
    return candidates.slice(0, 2).map(([deviceType, subtype]) => {
      const installationDate = normalizeDate(row.ingreso) || date;
      const episodeId = buildDeviceEpisodeId(patientId, deviceType, installationDate, subtype || "");
      return {
        episodeId,
        patientId,
        deviceType,
        deviceSubtype: subtype,
        anatomicalSite: null,
        installationDate,
        removalDate: null,
        status: "activo",
        isReinstallation: false,
        previousEpisodeId: null,
        dressingCurrent: null,
        dressingDate: null,
        careStatus: "no_valorado",
        infectionSigns: null,
        infectionSignsDescription: null,
        notes: "Inferido desde censo inicial; confirmar en ronda.",
        createdDuringRoundDate: date,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdBy: "seed",
        updatedBy: "seed",
        source: "import"
      };
    });
  }

  function renderIaas() {
    const app = document.querySelector("#app");
    if (!app) return;
    recalculateRound(isoToday());
    app.replaceChildren(renderShell());
  }

  function renderShell() {
    const route = ui.route.page;
    const authOnly = ui.firebase.denied || (ui.requireAuth && ui.firebase.enabled && !ui.firebase.user);
    const content = ui.firebase.denied
      ? renderAccessDenied()
      : ui.requireAuth && ui.firebase.enabled && !ui.firebase.user
        ? renderLogin()
        : renderRoute();
    if (authOnly) {
      return h("div", { class: "iaas-auth-shell ev-page-bg" }, [content]);
    }
    return h("div", { class: "iaas-shell ev-page-bg" }, [
      renderSidebar(route),
      h("main", { class: "iaas-main" }, [
        renderTopbar(),
        content
      ])
    ]);
  }

  function renderSidebar(active) {
    const nav = [
      ["dashboard", "Panel IAAS", "Invasivos, alertas y estadísticas"],
      ["importar-censo", "Importar censo", "Carga matutina Excel/CSV"],
      ["ronda", "Ronda IAAS", "Revisión móvil por cama"],
      ["reporte-diario", "Reportes", "Diario, semanal y mensual"]
    ];
    return h("aside", { class: "iaas-sidebar ev-sidebar-bg" }, [
      h("div", { class: "iaas-brand" }, [
        h("img", { class: "ev-logo sidebar-logo", src: "./assets/epivida/logos/epivida-logo-gradient.svg", alt: "EpiVida HEVM" }),
        h("div", {}, [
          h("strong", {}, ["EpiVida IAAS"]),
          h("span", {}, ["Sistema diario de rondas"])
        ])
      ]),
      h("nav", { class: "iaas-nav" }, nav.map(([page, label, caption]) =>
        h("a", { href: `#/${page}`, class: active === page ? "active" : "" }, [
          h("strong", {}, [label]),
          h("small", {}, [caption])
        ])
      )),
      h("section", { class: "iaas-sidebar-card" }, [
        h("strong", {}, ["Arquitectura $0"]),
        h("p", {}, ["Firebase Auth + Firestore opcional. Sin Cloud Functions, sin BigQuery, sin APIs pagadas."]),
        h("small", {}, [ui.firebase.ready ? "Firebase sincronizado" : "Modo local con respaldo/exportación"])
      ])
    ]);
  }

  function renderTopbar() {
    return h("header", { class: "iaas-topbar" }, [
      h("div", {}, [
        h("strong", {}, [routeTitle(ui.route.page)]),
        h("span", {}, [`${dayLabel(new Date())} · ${Object.keys(store.patients).length} pacientes en sistema`])
      ]),
      h("div", { class: "iaas-topbar-actions" }, [
        renderSyncState(),
        ui.firebase.user ? h("button", { class: "iaas-button ghost", onclick: signOutFirebase }, ["Cerrar sesion"]) : "",
        h("button", { class: "iaas-button ghost", onclick: () => exportDailyJson(isoToday()) }, ["Exportar respaldo JSON"]),
        h("button", { class: "iaas-button ghost", onclick: () => window.print() }, ["Imprimir reporte"])
      ])
    ]);
  }

  function renderSyncState() {
    const pending = pendingQueue().length;
    const className = !navigator.onLine ? "sync offline" : pending ? "sync pending" : ui.firebase.ready ? "sync ok" : "sync local";
    const text = !navigator.onLine
      ? "Pendiente de sincronizar"
      : pending
        ? `${pending} pendiente(s)`
        : ui.firebase.ready
          ? "Sincronizado"
          : "Guardado localmente";
    return h("span", { class: className, title: ui.firebase.offlinePersistence }, [text]);
  }

  function renderRoute() {
    const { page, parts } = ui.route;
    if (page === "importar-censo") return renderImportPage();
    if (page === "ronda" && parts[2] === "paciente" && parts[3]) return renderPatientRound(parts[1] || isoToday(), parts[3]);
    if (page === "ronda") return renderRoundPage(parts[1] || isoToday());
    if (page === "pacientes" && parts[2] === "seguimiento") return renderPatientFollowUp(parts[1]);
    if (page === "reporte-diario") return renderReportsPage();
    return renderDashboard();
  }

  function renderDashboard() {
    const date = isoToday();
    const stats = computeStats(date);
    return h("div", { class: "iaas-page" }, [
      h("section", { class: "iaas-hero" }, [
        h("div", { class: "iaas-hero-art ev-hero-asset" }),
        h("div", {}, [
          h("h1", {}, ["Centro de mando IAAS"]),
          h("p", {}, ["Importa el censo matutino, ejecuta la ronda por cama, captura invasivos como episodios y deja que el sistema calcule indicadores automáticamente."]),
          h("div", { class: "iaas-hero-actions" }, [
            h("a", { class: "iaas-button primary", href: "#/importar-censo" }, ["Importar censo"]),
            h("a", { class: "iaas-button", href: `#/ronda/${date}` }, ["Iniciar ronda"])
          ])
        ])
      ]),
      renderMetricGrid([
        ["Censo de hoy", stats.totalPatients, "Pacientes importados"],
        ["Revisados", stats.reviewedPatients, "Ronda IAAS"],
        ["Pendientes", stats.pendingPatients, "Pacientes pendientes"],
        ["Requiere conciliación", stats.reconciliationPatients, "No encontrado en censo de hoy"],
        ["Invasivos activos", stats.activeDevices, "Dispositivos"],
        ["Reinstalaciones", stats.reinstallationsToday, "Hoy"],
        ["Paciente-día", stats.patientDays, "Cálculo automático"],
        ["Dispositivo-día", stats.totalDeviceDays, "Cálculo automático"]
      ]),
      h("section", { class: "iaas-grid two" }, [
        h("article", { class: "iaas-panel" }, [
          h("div", { class: "iaas-panel-head" }, [
            h("h2", {}, ["Invasivos activos por tipo"]),
            h("a", { href: "#/reporte-diario" }, ["Ver reporte"])
          ]),
          renderBars(stats.activeByType)
        ]),
        h("article", { class: "iaas-panel" }, [
          h("div", { class: "iaas-panel-head" }, [
            h("h2", {}, ["Avance de ronda"]),
            h("button", { class: "iaas-button compact", onclick: () => closeRound(date) }, ["Cerrar ronda"])
          ]),
          renderRoundCloseChecklist(date)
        ])
      ]),
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("h2", {}, ["Pacientes con alerta IAAS"]),
          h("span", { class: "badge alert" }, [`${stats.alertPatients.length} alerta(s)`])
        ]),
        renderPatientMiniTable(stats.alertPatients.slice(0, 8), "Sin alertas IAAS activas.")
      ]),
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("h2", {}, ["Conciliación de censo"]),
          h("span", { class: "badge pendiente" }, [`${stats.reconciliationPatients} pendiente(s)`])
        ]),
        renderReconciliationPanel()
      ])
    ]);
  }

  function renderImportPage() {
    const draft = ui.importDraft;
    return h("div", { class: "iaas-page import-page" }, [
      h("section", { class: "iaas-panel import-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("div", {}, [
            h("h1", {}, ["Importar censo"]),
            h("p", {}, ["Pega desde Excel/Google Sheets o carga CSV/XLSX. La importación es determinística: valida, deduplica, concilia y luego guarda."])
          ]),
          h("span", { class: "badge" }, ["Sin IA pagada"])
        ]),
        h("div", { class: "import-controls" }, [
          h("label", { class: "field" }, [
            h("span", {}, ["Fecha del censo"]),
            h("input", { type: "date", value: isoToday(), id: "import-date" })
          ]),
          h("label", { class: "field full" }, [
            h("span", {}, ["Pegar tabla del censo"]),
            h("textarea", {
              id: "import-text",
              placeholder: "patient_id\tfecha_censo\tservicio\tcama\tedad\tsexo\tfecha_ingreso\tdiagnostico_actual\tpendientes",
              oninput: event => { ui.importText = event.target.value; }
            }, [ui.importText])
          ]),
          h("div", { class: "import-actions" }, [
            h("input", { type: "file", id: "census-file", accept: ".csv,.txt,.tsv,.xlsx", onchange: handleImportFile }),
            h("button", { class: "iaas-button", onclick: loadSampleImport }, ["Cargar ejemplo"]),
            h("button", { class: "iaas-button primary", onclick: parseImportInput }, ["Validar censo"]),
            draft ? h("button", { class: "iaas-button danger ghost", onclick: cancelImport }, ["Cancelar"]) : ""
          ])
        ]),
        ui.importProgress ? h("div", { class: "import-progress" }, [ui.importProgress]) : "",
        draft ? renderImportPreview(draft) : renderImportHelp()
      ])
    ]);
  }

  function renderImportHelp() {
    return h("section", { class: "import-help" }, [
      h("h3", {}, ["Columnas requeridas"]),
      h("div", { class: "chip-row" }, REQUIRED_COLUMNS.map(col => h("span", { class: "chip" }, [col]))),
      h("p", {}, ["También acepta variantes como expediente, folio, dx, ingreso, área, departamento, observaciones_pendientes. Los pacientes ausentes no se eliminan: se marcan para conciliación."])
    ]);
  }

  function renderImportPreview(draft) {
    const s = draft.summary;
    return h("section", { class: "import-preview" }, [
      renderMetricGrid([
        ["Total filas", s.totalRows, "Leídas"],
        ["Válidas", s.validRows, "Listas para guardar"],
        ["Errores", s.errorRows, "No se guardan"],
        ["Advertencias", s.warningRows, "Revisar"],
        ["Nuevos", s.newPatients, "Crear pacientes"],
        ["Actualizados", s.updatedPatients, "Sin duplicar"],
        ["Duplicados", s.duplicates, "Omitidos"],
        ["Conflictos", s.conflicts, "Requiere resolución"]
      ], "compact"),
      h("div", { class: "import-preview-actions" }, [
        h("button", { class: "iaas-button ghost", onclick: downloadImportErrors }, ["Descargar errores de importación"]),
        h("button", { class: "iaas-button primary", disabled: s.validRows === 0 || ui.importSaving ? "disabled" : null, onclick: confirmImport }, [ui.importSaving ? "Guardando..." : "Confirmar importación"])
      ]),
      renderImportIssues(draft),
      h("div", { class: "table-wrap" }, [
        h("table", { class: "iaas-table" }, [
          h("thead", {}, [h("tr", {}, ["Estado", "ID", "Servicio", "Cama", "Ingreso", "Dx", "Errores/avisos"].map(label => h("th", {}, [label])))]),
          h("tbody", {}, draft.rows.slice(0, 30).map(row => h("tr", { class: row.errors.length ? "has-error" : row.warnings.length ? "has-warning" : "" }, [
            h("td", {}, [row.errors.length ? "Error" : row.warnings.length ? "Advertencia" : "Válida"]),
            h("td", {}, [row.normalized.patient_id || ""]),
            h("td", {}, [row.normalized.servicio || ""]),
            h("td", {}, [row.normalized.cama || ""]),
            h("td", {}, [row.normalized.fecha_ingreso || ""]),
            h("td", {}, [truncateText(row.normalized.diagnostico_actual || "", 90)]),
            h("td", {}, [[...row.errors, ...row.warnings].join(" | ")])
          ])))
        ])
      ])
    ]);
  }

  function renderImportIssues(draft) {
    const missing = draft.reconciliationMissing || [];
    if (!draft.conflicts.length && !missing.length) {
      return h("div", { class: "notice ok" }, ["Sin conflictos críticos."]);
    }
    return h("div", { class: "notice warn" }, [
      h("strong", {}, ["Revisión necesaria"]),
      h("p", {}, [`Conflictos servicio/cama: ${draft.conflicts.length}. Pacientes activos ausentes del censo de hoy: ${missing.length}.`])
    ]);
  }

  function renderRoundPage(date) {
    ensureDailyRound(date);
    const round = store.dailyRounds[date];
    const rows = getCensusRows(date);
    const services = ["Todos", ...SERVICES.filter(service => rows.some(row => row.service === service))];
    const filtered = rows
      .filter(row => ui.selectedService === "Todos" || row.service === ui.selectedService)
      .sort(sortByServiceBed);
    const stats = computeStats(date);
    return h("div", { class: "iaas-page round-page" }, [
      h("section", { class: "iaas-panel round-header" }, [
        h("div", {}, [
          h("h1", {}, ["Ronda IAAS"]),
          h("p", {}, ["Lista móvil por servicio y cama. Cada paciente se guarda inmediatamente; no existe un guardado final gigante."])
        ]),
        h("div", { class: "round-actions" }, [
          h("button", { class: "iaas-button primary", onclick: () => startRound(date) }, [round.status === "not_started" ? "Iniciar ronda" : "Ronda en curso"]),
          h("button", { class: "iaas-button", onclick: () => closeRound(date) }, ["Cerrar ronda"])
        ])
      ]),
      renderMetricGrid([
        ["Total", stats.totalPatients, "Pacientes"],
        ["Revisados", stats.reviewedPatients, "Sincronizados/locales"],
        ["Pendientes", stats.pendingPatients, "Por revisar"],
        ["Incompletos", stats.incompletePatients, "Datos incompletos"],
        ["Alertas", stats.activeAlerts, "Alerta IAAS"],
        ["Sync pendiente", pendingQueue().length, "Pendiente de sincronizar"]
      ], "compact"),
      h("section", { class: "service-filter" }, services.map(service =>
        h("button", { class: ui.selectedService === service ? "active" : "", onclick: () => { ui.selectedService = service; renderIaas(); } }, [service])
      )),
      h("section", { class: "round-list" }, filtered.map(row => renderRoundCard(row, date)))
    ]);
  }

  function renderRoundCard(row, date) {
    const patient = store.patients[row.patientId];
    const entry = store.dailyRounds[date]?.entries[row.patientId] || {};
    const devices = activeEpisodes(row.patientId, date);
    return h("article", { class: `round-card status-${entry.status || "pendiente"}` }, [
      h("div", { class: "round-card-main" }, [
        h("div", { class: "bed-badge" }, [row.bed || "S/C"]),
        h("div", {}, [
          h("strong", {}, [patient?.displayCode || row.patientId]),
          h("span", {}, [row.service]),
          h("small", {}, [truncateText(patient?.currentDiagnosis || "Sin diagnóstico registrado", 110)])
        ])
      ]),
      h("div", { class: "round-card-tags" }, [
        h("span", { class: `badge ${entry.status || "pendiente"}` }, [statusLabel(entry.status || "pendiente")]),
        h("span", { class: `badge sync-${entry.syncStatus || "local"}` }, [syncLabel(entry.syncStatus)]),
        devices.length ? h("span", { class: "badge device" }, [`${devices.length} invasivo(s)`]) : h("span", { class: "badge neutral" }, ["Sin invasivos activos"])
      ]),
      h("div", { class: "round-card-actions" }, [
        h("a", { class: "iaas-button primary", href: `#/ronda/${date}/paciente/${row.patientId}` }, ["Revisar"]),
        h("a", { class: "iaas-button ghost", href: `#/pacientes/${row.patientId}/seguimiento` }, ["Seguimiento"])
      ])
    ]);
  }

  function renderPatientRound(date, patientId) {
    const patient = store.patients[patientId];
    if (!patient) return renderNotFound("Paciente no encontrado.");
    ensureDailyRound(date);
    const draft = getReviewDraft(date, patientId);
    const active = activeEpisodes(patientId, date);
    return h("div", { class: "iaas-page patient-round" }, [
      h("section", { class: "iaas-panel patient-sticky-summary" }, [
        h("div", {}, [
          h("a", { href: `#/ronda/${date}`, class: "back-link" }, ["Volver al servicio"]),
          h("h1", {}, [`Cama ${patient.currentBed} · ${patient.displayCode}`]),
          h("p", {}, [`${patient.currentService} · Estancia: ${daysBetween(patient.admissionDate, date) ?? "NA"} días`])
        ]),
        h("span", { class: `risk ${riskClass(patient.currentRiskLevel)}` }, [patient.currentRiskLevel || "Sin riesgo"])
      ]),
      h("section", { class: "iaas-panel" }, [
        h("h2", {}, ["Resumen del paciente"]),
        h("p", {}, [patient.currentDiagnosis || "Sin diagnóstico registrado."]),
        patient.activePendingIssues?.length ? h("div", { class: "pending-list" }, patient.activePendingIssues.map(issue => h("span", {}, [issue]))) : h("p", { class: "muted" }, ["Sin pendientes activos registrados."])
      ]),
      h("section", { class: "iaas-panel" }, [
        h("h2", {}, ["Dispositivos invasivos actuales"]),
        active.length ? h("div", { class: "device-list" }, active.map(ep => renderActiveDevice(ep, draft))) : h("p", { class: "muted" }, ["No hay invasivos activos capturados."]),
        h("button", { class: draft.noInvasivesConfirmed ? "iaas-button primary" : "iaas-button", onclick: () => toggleNoInvasives(date, patientId) }, ["Sin invasivos"])
      ]),
      h("section", { class: "iaas-panel" }, [
        h("h2", {}, ["Agregar dispositivo"]),
        h("div", { class: "quick-device-grid" }, DEVICE_TYPES.map(type =>
          h("button", { class: "quick-device", onclick: () => addDeviceDraft(date, patientId, type) }, [`+ ${type}`])
        )),
        draft.deviceDrafts?.length ? h("div", { class: "device-drafts" }, draft.deviceDrafts.map((device, index) => renderDeviceDraft(date, patientId, device, index))) : ""
      ]),
      h("section", { class: "iaas-panel" }, [
        h("h2", {}, ["Pendientes y observaciones"]),
        h("label", { class: "field" }, [
          h("span", {}, ["Agregar pendiente"]),
          h("input", { value: draft.pendingText || "", placeholder: "Ej. confirmar retiro de CVC, revisar cultivo...", oninput: event => updateDraft(date, patientId, { pendingText: event.target.value }) })
        ]),
        h("label", { class: "field" }, [
          h("span", {}, ["Notas cortas"]),
          h("textarea", { value: draft.notes || "", oninput: event => updateDraft(date, patientId, { notes: event.target.value }) })
        ])
      ]),
      h("div", { class: "round-save-bar" }, [
        h("button", { class: "iaas-button ghost", onclick: () => saveRoundEntry(date, patientId, "incompleto", false) }, ["Guardar como incompleto"]),
        h("button", { class: "iaas-button", onclick: () => saveRoundEntry(date, patientId, "pendiente", false) }, ["Marcar pendiente"]),
        h("button", { class: "iaas-button primary", onclick: () => saveRoundEntry(date, patientId, "revisado", false) }, ["Guardar"]),
        h("button", { class: "iaas-button primary strong", onclick: () => saveRoundEntry(date, patientId, "revisado", true) }, ["Guardar y siguiente cama"])
      ])
    ]);
  }

  function renderActiveDevice(ep, draft) {
    return h("article", { class: "device-card" }, [
      h("div", {}, [
        h("strong", {}, [ep.deviceType]),
        h("span", {}, [`Instalación: ${ep.installationDate || "Datos incompletos"}`]),
        ep.dressingCurrent === false ? h("span", { class: "badge alert" }, ["Curación pendiente"]) : ""
      ]),
      h("label", { class: "field inline" }, [
        h("span", {}, ["Fecha de retiro"]),
        h("input", {
          type: "date",
          value: draft.removals?.[ep.episodeId] || "",
          oninput: event => updateRemovalDraft(draft, ep.episodeId, event.target.value)
        })
      ])
    ]);
  }

  function renderDeviceDraft(date, patientId, device, index) {
    const update = patch => {
      const draft = getReviewDraft(date, patientId);
      draft.deviceDrafts[index] = { ...draft.deviceDrafts[index], ...patch };
      setReviewDraft(date, patientId, draft);
      renderIaas();
    };
    return h("article", { class: "device-draft" }, [
      h("div", { class: "device-draft-head" }, [
        h("strong", {}, [device.deviceType]),
        h("button", { class: "icon-text", onclick: () => removeDeviceDraft(date, patientId, index) }, ["Quitar"])
      ]),
      h("div", { class: "form-grid compact" }, [
        h("label", { class: "field" }, [h("span", {}, ["Fecha instalación"]), h("input", { type: "date", value: device.installationDate || "", oninput: event => update({ installationDate: event.target.value }) })]),
        h("label", { class: "field" }, [h("span", {}, ["Sitio anatómico"]), h("input", { value: device.anatomicalSite || "", oninput: event => update({ anatomicalSite: event.target.value }) })]),
        h("label", { class: "field" }, [h("span", {}, ["Curación vigente"]), h("select", { onchange: event => update({ dressingCurrent: parseNullableBoolean(event.target.value) }) }, [
          option("", "No valorado", device.dressingCurrent === null || device.dressingCurrent === undefined),
          option("true", "Sí", device.dressingCurrent === true),
          option("false", "No", device.dressingCurrent === false)
        ])]),
        h("label", { class: "field" }, [h("span", {}, ["Fecha curación"]), h("input", { type: "date", value: device.dressingDate || "", oninput: event => update({ dressingDate: event.target.value }) })]),
        h("label", { class: "field" }, [h("span", {}, ["Cuidado"]), h("select", { onchange: event => update({ careStatus: event.target.value || null }) }, [
          option("", "No valorado", !device.careStatus),
          option("adecuado", "Adecuado", device.careStatus === "adecuado"),
          option("inadecuado", "Inadecuado", device.careStatus === "inadecuado")
        ])]),
        h("label", { class: "field" }, [h("span", {}, ["Signos de infección"]), h("select", { onchange: event => update({ infectionSigns: parseNullableBoolean(event.target.value) }) }, [
          option("", "No valorado", device.infectionSigns === null || device.infectionSigns === undefined),
          option("true", "Sí", device.infectionSigns === true),
          option("false", "No", device.infectionSigns === false)
        ])])
      ]),
      device.infectionSigns ? h("label", { class: "field" }, [
        h("span", {}, ["Descripción de signos"]),
        h("input", { value: device.infectionSignsDescription || "", oninput: event => update({ infectionSignsDescription: event.target.value }) })
      ]) : ""
    ]);
  }

  function renderPatientFollowUp(patientId) {
    const patient = store.patients[patientId];
    if (!patient) return renderNotFound("Paciente no encontrado.");
    const episodes = episodesForPatient(patientId).sort((a, b) => String(a.installationDate).localeCompare(String(b.installationDate)));
    const entries = Object.values(store.dailyRounds).flatMap(round => Object.values(round.entries || {})).filter(entry => entry.patientId === patientId);
    return h("div", { class: "iaas-page follow-page" }, [
      h("section", { class: "iaas-panel follow-hero" }, [
        h("div", {}, [
          h("h1", {}, [`Seguimiento · ${patient.displayCode}`]),
          h("p", {}, [`${patient.currentService} · Cama ${patient.currentBed} · Ingreso ${patient.admissionDate || "NA"}`])
        ]),
        h("button", { class: "iaas-button ghost", onclick: () => printPatientFollowUp(patientId) }, ["Imprimir seguimiento"])
      ]),
      renderMetricGrid([
        ["Estancia", daysBetween(patient.admissionDate, isoToday()) ?? "NA", "días"],
        ["Invasivos activos", activeEpisodes(patientId, isoToday()).length, "actual"],
        ["Episodios", episodes.length, "histórico"],
        ["Rondas", entries.length, "registradas"]
      ], "compact"),
      h("section", { class: "iaas-grid two" }, [
        h("article", { class: "iaas-panel" }, [
          h("h2", {}, ["Línea de tiempo de invasivos"]),
          renderDeviceTimeline(episodes)
        ]),
        h("article", { class: "iaas-panel" }, [
          h("h2", {}, ["Estado por ronda"]),
          renderRoundTimeline(entries)
        ])
      ]),
      h("section", { class: "iaas-grid two" }, [
        emptyClinicalChart("Aún no hay registros de temperatura."),
        emptyClinicalChart("Aún no hay laboratorios registrados.")
      ]),
      h("section", { class: "iaas-panel" }, [
        h("h2", {}, ["Episodios de dispositivos"]),
        episodes.length ? h("div", { class: "table-wrap" }, [
          h("table", { class: "iaas-table" }, [
            h("thead", {}, [h("tr", {}, ["Tipo", "Instalación", "Retiro", "Estado", "Reinstalación", "Cuidado"].map(label => h("th", {}, [label])))]),
            h("tbody", {}, episodes.map(ep => h("tr", {}, [
              h("td", {}, [ep.deviceType]),
              h("td", {}, [ep.installationDate || "Datos incompletos"]),
              h("td", {}, [ep.removalDate || "Activo"]),
              h("td", {}, [ep.status]),
              h("td", {}, [ep.isReinstallation ? "Sí" : "No"]),
              h("td", {}, [careLabel(ep.careStatus)])
            ])))
          ])
        ]) : h("p", { class: "muted" }, ["No hay episodios capturados."])
      ])
    ]);
  }

  function renderReportsPage() {
    const date = isoToday();
    const stats = computeStats(date);
    const range = computeRangeStats(30);
    return h("div", { class: "iaas-page reports-page" }, [
      h("section", { class: "iaas-panel report-hero" }, [
        h("div", {}, [
          h("h1", {}, ["Reporte diario"]),
          h("p", {}, ["Indicadores calculados desde censo, rondas y episodios invasivos. Sin captura manual de totales."])
        ]),
        h("div", { class: "report-actions" }, [
          h("button", { class: "iaas-button", onclick: () => exportDailyCsv(date, "census") }, ["Exportar censo CSV"]),
          h("button", { class: "iaas-button", onclick: () => exportDailyCsv(date, "round") }, ["Exportar ronda CSV"]),
          h("button", { class: "iaas-button", onclick: () => exportDeviceCsv(date) }, ["Exportar invasivos CSV"]),
          h("button", { class: "iaas-button primary", onclick: () => exportDailyJson(date) }, ["Exportar respaldo JSON"])
        ])
      ]),
      renderMetricGrid([
        ["Paciente-día", stats.patientDays, "diario"],
        ["CVC-día", stats.deviceDaysByType.CVC || 0, "diario"],
        ["Foley-día", stats.deviceDaysByType["Sonda Foley"] || 0, "diario"],
        ["VM-día", stats.deviceDaysByType["Ventilación mecánica"] || 0, "diario"],
        ["Instalados hoy", stats.installedToday, "eventos"],
        ["Retirados hoy", stats.removedToday, "eventos"],
        ["Reinstalados hoy", stats.reinstallationsToday, "eventos"],
        ["Datos incompletos", stats.incompletePatients, "pacientes"]
      ], "compact"),
      h("section", { class: "iaas-grid two" }, [
        h("article", { class: "iaas-panel" }, [
          h("h2", {}, ["Tendencia 30 días"]),
          renderTrend(range)
        ]),
        h("article", { class: "iaas-panel" }, [
          h("h2", {}, ["Resumen por servicio"]),
          renderServiceStats(stats.byService)
        ])
      ]),
      h("section", { class: "print-report iaas-panel" }, [
        h("h2", {}, ["Reporte imprimible IAAS"]),
        h("p", {}, [`Fecha: ${date}. Pacientes importados: ${stats.totalPatients}. Revisados: ${stats.reviewedPatients}. Pendientes: ${stats.pendingPatients}. Invasivos activos: ${stats.activeDevices}.`]),
        renderRoundCloseChecklist(date)
      ])
    ]);
  }

  function renderLogin() {
    const isGoogle = ui.firebase.authProvider === "google";
    if (isGoogle) {
      return h("section", { class: "iaas-page" }, [
        h("article", { class: "iaas-panel login-panel" }, [
          h("h1", {}, ["Acceso requerido"]),
          h("p", {}, ["Firebase esta configurado. Inicia sesion con una cuenta de Google autorizada para ver datos clinicos."]),
          ui.firebase.error ? h("div", { class: "notice error" }, [ui.firebase.error]) : "",
          h("button", { class: "iaas-button primary", onclick: signInFirebase }, ["Iniciar sesion con Google"])
        ])
      ]);
    }
    return h("section", { class: "iaas-page" }, [
      h("article", { class: "iaas-panel login-panel" }, [
        h("h1", {}, ["Acceso requerido"]),
        h("p", {}, ["Firebase está configurado. Inicia sesión con correo y contraseña para ver datos clínicos."]),
        ui.firebase.error ? h("div", { class: "notice error" }, [ui.firebase.error]) : "",
        h("label", { class: "field" }, [h("span", {}, ["Correo"]), h("input", { id: "login-email", type: "email" })]),
        h("label", { class: "field" }, [h("span", {}, ["Contraseña"]), h("input", { id: "login-password", type: "password" })]),
        h("button", { class: "iaas-button primary", onclick: signInFirebase }, ["Iniciar sesión"])
      ])
    ]);
  }

  function renderAccessDenied() {
    return h("section", { class: "iaas-page" }, [
      h("article", { class: "iaas-panel login-panel blocked-panel" }, [
        h("h1", {}, ["Acceso denegado"]),
        h("p", {}, ["La cuenta detectada no esta autorizada para operar EpiVida HEVM. El acceso clinico requiere un usuario activo del servicio."]),
        ui.firebase.user?.email ? h("div", { class: "notice error" }, [`Correo detectado: ${ui.firebase.user.email}`]) : "",
        h("button", { class: "iaas-button danger", onclick: signOutFirebase }, ["Cerrar sesion"])
      ])
    ]);
  }

  function renderMetricGrid(items, tone = "") {
    return h("section", { class: `iaas-metrics ${tone}` }, items.map(([label, value, caption]) =>
      h("article", { class: "iaas-metric" }, [
        h("span", {}, [label]),
        h("strong", {}, [String(value)]),
        h("small", {}, [caption])
      ])
    ));
  }

  function renderBars(data) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(([, value]) => value));
    if (!entries.length) return h("p", { class: "muted" }, ["Sin invasivos activos."]);
    return h("div", { class: "bars" }, entries.map(([label, value]) =>
      h("div", { class: "bar-row" }, [
        h("span", {}, [label]),
        h("div", { class: "bar-track" }, [h("i", { style: `width:${Math.max(6, (value / max) * 100)}%` })]),
        h("strong", {}, [String(value)])
      ])
    ));
  }

  function renderTrend(range) {
    if (!range.length) return h("p", { class: "muted" }, ["No hay datos suficientes."]);
    const max = Math.max(1, ...range.map(day => day.activeDevices));
    const points = range.map((day, index) => {
      const x = 20 + index * (260 / Math.max(1, range.length - 1));
      const y = 120 - (day.activeDevices / max) * 90;
      return `${x},${y}`;
    }).join(" ");
    return h("svg", { class: "trend-chart", viewBox: "0 0 310 150", role: "img", "aria-label": "Tendencia de invasivos activos" }, [
      h("polyline", { points, fill: "none", stroke: "#5b5cf6", "stroke-width": "5", "stroke-linecap": "round", "stroke-linejoin": "round" }),
      h("text", { x: "20", y: "142" }, ["30 días"]),
      h("text", { x: "230", y: "22" }, ["Invasivos"])
    ]);
  }

  function renderRoundCloseChecklist(date) {
    const issues = validateRoundBeforeClose(date);
    const stats = computeStats(date);
    return h("div", { class: "close-checklist" }, [
      h("div", { class: "check-row" }, [h("span", {}, ["Pacientes importados"]), h("strong", {}, [String(stats.totalPatients)])]),
      h("div", { class: "check-row" }, [h("span", {}, ["Pacientes revisados"]), h("strong", {}, [String(stats.reviewedPatients)])]),
      h("div", { class: "check-row" }, [h("span", {}, ["Pendientes"]), h("strong", {}, [String(stats.pendingPatients)])]),
      h("div", { class: "check-row" }, [h("span", {}, ["Registros sincronizados"]), h("strong", {}, [String(stats.serverSyncedWritesCount)])]),
      h("div", { class: "check-row" }, [h("span", {}, ["Pendiente de sincronizar"]), h("strong", {}, [String(pendingQueue().length)])]),
      issues.length
        ? h("div", { class: "notice warn" }, [
          h("strong", {}, ["No se puede cerrar todavía"]),
          h("ul", {}, issues.slice(0, 8).map(issue => h("li", {}, [issue])))
        ])
        : h("div", { class: "notice ok" }, ["Listo para cerrar ronda."])
    ]);
  }

  function renderPatientMiniTable(rows, empty) {
    if (!rows.length) return h("p", { class: "muted" }, [empty]);
    return h("div", { class: "table-wrap" }, [
      h("table", { class: "iaas-table" }, [
        h("thead", {}, [h("tr", {}, ["Paciente", "Servicio", "Cama", "Motivo"].map(label => h("th", {}, [label])))]),
        h("tbody", {}, rows.map(row => h("tr", {}, [
          h("td", {}, [row.displayCode]),
          h("td", {}, [row.currentService]),
          h("td", {}, [row.currentBed]),
          h("td", {}, [row.reason || row.latestRoundStatus || "Alerta IAAS"])
        ])))
      ])
    ]);
  }

  function renderReconciliationPanel() {
    const rows = Object.values(store.patients)
      .filter(patient => patient.hospitalizationStatus === "requiere_conciliación")
      .slice(0, 12);
    if (!rows.length) return h("p", { class: "muted" }, ["No hay pacientes pendientes de conciliación."]);
    return h("div", { class: "reconciliation-list" }, rows.map(patient =>
      h("article", { class: "reconciliation-card" }, [
        h("div", {}, [
          h("strong", {}, [patient.displayCode]),
          h("span", {}, [`${patient.currentService} · Cama ${patient.currentBed}`]),
          h("small", {}, ["No encontrado en censo de hoy"])
        ]),
        h("div", { class: "reconciliation-actions" }, [
          h("button", { onclick: () => resolveReconciliation(patient.patientId, "egresado", "Alta") }, ["Alta"]),
          h("button", { onclick: () => resolveReconciliation(patient.patientId, "traslado_probable", "Traslado") }, ["Traslado"]),
          h("button", { onclick: () => resolveReconciliation(patient.patientId, "defunción_probable", "Defunción") }, ["Defunción"]),
          h("button", { onclick: () => resolveReconciliation(patient.patientId, "hospitalizado", "Sigue hospitalizado") }, ["Sigue hospitalizado"]),
          h("button", { onclick: () => resolveReconciliation(patient.patientId, "requiere_conciliación", "Error de importación") }, ["Error de importación"])
        ])
      ])
    ));
  }

  function renderServiceStats(byService) {
    const rows = Object.entries(byService).sort((a, b) => SERVICES.indexOf(a[0]) - SERVICES.indexOf(b[0]));
    return h("div", { class: "table-wrap" }, [
      h("table", { class: "iaas-table compact" }, [
        h("thead", {}, [h("tr", {}, ["Servicio", "Pacientes", "Revisados", "Invasivos"].map(label => h("th", {}, [label])))]),
        h("tbody", {}, rows.map(([service, item]) => h("tr", {}, [
          h("td", {}, [service]),
          h("td", {}, [String(item.total)]),
          h("td", {}, [String(item.reviewed)]),
          h("td", {}, [String(item.devices)])
        ])))
      ])
    ]);
  }

  function renderDeviceTimeline(episodes) {
    if (!episodes.length) return h("p", { class: "muted" }, ["Sin episodios de invasivos."]);
    const startDates = episodes.map(ep => ep.installationDate).filter(Boolean).sort();
    const start = startDates[0] || isoToday();
    const end = isoToday();
    const totalDays = Math.max(1, daysBetween(start, end) || 1);
    return h("div", { class: "timeline-wrap" }, episodes.map(ep => {
      const x = Math.max(0, ((daysBetween(start, ep.installationDate) || 0) / totalDays) * 100);
      const endDate = ep.removalDate || end;
      const width = Math.max(7, (((daysBetween(ep.installationDate, endDate) || 1) + 1) / totalDays) * 100);
      return h("div", { class: "timeline-row" }, [
        h("span", {}, [ep.deviceType]),
        h("div", { class: "timeline-track" }, [h("i", { style: `left:${x}%;width:${Math.min(100 - x, width)}%` })]),
        h("small", {}, [`${ep.installationDate || "NA"} → ${ep.removalDate || "Activo"}`])
      ]);
    }));
  }

  function renderRoundTimeline(entries) {
    if (!entries.length) return h("p", { class: "muted" }, ["Aún no hay rondas registradas."]);
    return h("div", { class: "round-timeline" }, entries.sort((a, b) => String(a.roundDate).localeCompare(String(b.roundDate))).map(entry =>
      h("div", { class: `round-dot ${entry.status}` }, [
        h("strong", {}, [entry.roundDate]),
        h("span", {}, [statusLabel(entry.status)])
      ])
    ));
  }

  function emptyClinicalChart(text) {
    return h("article", { class: "iaas-panel empty-chart" }, [
      h("div", { class: "empty-chart-graphic" }),
      h("p", {}, [text]),
      h("button", { class: "iaas-button ghost", onclick: () => flashIaas("Módulo preparado para extensión futura.") }, ["Agregar registro"])
    ]);
  }

  function renderNotFound(message) {
    return h("section", { class: "iaas-page" }, [h("article", { class: "iaas-panel" }, [h("h1", {}, ["No encontrado"]), h("p", {}, [message])])]);
  }

  async function parseImportInput() {
    const text = (document.querySelector("#import-text")?.value || ui.importText || "").trim();
    const date = document.querySelector("#import-date")?.value || isoToday();
    if (!text) {
      flashIaas("Archivo o tabla vacía.");
      return;
    }
    ui.importProgress = "Validando...";
    renderIaas();
    await waitFrame();
    const parsedRows = parseDelimitedText(text);
    ui.importDraft = buildImportDraft(parsedRows, date);
    ui.importProgress = "";
    renderIaas();
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    ui.importProgress = "Leyendo archivo...";
    renderIaas();
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const rows = await parseXlsx(file);
        ui.importDraft = buildImportDraft(rows, isoToday());
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        const text = await file.text();
        ui.importText = text;
        ui.importDraft = buildImportDraft(parseDelimitedText(text), isoToday());
      } else {
        flashIaas("Tipo de archivo no soportado.");
      }
    } catch (error) {
      flashIaas(`Error al leer archivo: ${friendlyError(error)}`);
    } finally {
      ui.importProgress = "";
      renderIaas();
    }
  }

  async function parseXlsx(file) {
    await loadSheetJs();
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  }

  function loadSheetJs() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("No se pudo cargar el lector XLSX. Use CSV o pegar desde Excel."));
      document.head.append(script);
    });
  }

  function buildImportDraft(rawRows, fallbackDate) {
    const rows = rawRows.map((raw, index) => normalizeImportRow(raw, index, fallbackDate));
    const validRows = rows.filter(row => !row.errors.length);
    const plan = buildImportPlan(validRows.map(row => row.normalized), fallbackDate);
    const summary = {
      totalRows: rows.length,
      validRows: validRows.length,
      errorRows: rows.filter(row => row.errors.length).length,
      warningRows: rows.filter(row => row.warnings.length).length,
      newPatients: plan.newPatients.length,
      updatedPatients: plan.updatedPatients.length,
      duplicates: plan.duplicates.length,
      conflicts: plan.conflicts.length
    };
    return { rows, plan, summary, conflicts: plan.conflicts, reconciliationMissing: plan.reconciliationMissing };
  }

  function normalizeImportRow(raw, index, fallbackDate) {
    const mapped = {};
    Object.entries(raw).forEach(([key, value]) => {
      const canonical = canonicalColumn(key);
      if (canonical) mapped[canonical] = cleanCell(value);
    });
    const row = {
      patient_id: cleanCell(mapped.patient_id || mapped.hospital_internal_id || ""),
      fecha_censo: normalizeDate(mapped.fecha_censo) || fallbackDate,
      servicio: normalizeService(mapped.servicio),
      cama: normalizeBed(mapped.cama),
      edad: parseAge(mapped.edad),
      sexo: normalizeSex(mapped.sexo),
      fecha_ingreso: normalizeDate(mapped.fecha_ingreso),
      diagnostico_actual: cleanCell(mapped.diagnostico_actual),
      pendientes: cleanCell(mapped.pendientes),
      hospital_internal_id: cleanCell(mapped.hospital_internal_id),
      riesgo_iaas: cleanCell(mapped.riesgo_iaas),
      observaciones: cleanCell(mapped.observaciones),
      medico_tratante: cleanCell(mapped.medico_tratante),
      piso: cleanCell(mapped.piso),
      aislamiento: cleanCell(mapped.aislamiento),
      antibioticos: cleanCell(mapped.antibioticos),
      cultivos_pendientes: cleanCell(mapped.cultivos_pendientes)
    };
    const errors = [];
    const warnings = [];
    if (!row.patient_id) errors.push("Falta patient_id o expediente estable.");
    if (!row.fecha_censo) errors.push("Fecha de censo inválida.");
    if (!row.servicio) errors.push("Falta servicio.");
    if (!row.cama) errors.push("Falta cama.");
    if (mapped.edad && row.edad === null) warnings.push("Edad no numérica.");
    if (mapped.fecha_ingreso && !row.fecha_ingreso) warnings.push("Fecha de ingreso inválida.");
    if (row.fecha_ingreso && row.fecha_censo && row.fecha_ingreso > row.fecha_censo) warnings.push("Ingreso posterior al censo.");
    if (!row.diagnostico_actual) warnings.push("Diagnóstico vacío.");
    return { index: index + 1, raw, normalized: row, errors, warnings };
  }

  function buildImportPlan(rows, date) {
    const seen = new Map();
    const newPatients = [];
    const updatedPatients = [];
    const duplicates = [];
    const conflicts = [];
    const existingPresent = new Set(Object.values(store.patients)
      .filter(patient => patient.hospitalizationStatus !== "egresado")
      .map(patient => patient.patientId));
    const incomingIds = new Set();

    rows.forEach(row => {
      const patientId = createPatientId(row);
      const rowHash = hashNormalizedRow(row);
      row.patientId = patientId;
      row.rowHash = rowHash;
      incomingIds.add(patientId);
      if (seen.has(patientId)) {
        const previous = seen.get(patientId);
        if (previous.servicio !== row.servicio || previous.cama !== row.cama) {
          conflicts.push({ patientId, previous, current: row, reason: "Conflicto de cama/servicio en el mismo archivo." });
        } else {
          duplicates.push(row);
        }
        return;
      }
      seen.set(patientId, row);
      if (store.patients[patientId]) updatedPatients.push(row);
      else newPatients.push(row);
    });

    const reconciliationMissing = [...existingPresent]
      .filter(patientId => !incomingIds.has(patientId))
      .map(patientId => store.patients[patientId])
      .filter(Boolean);

    return { date, importBatchId: createImportBatchId(date), rows, newPatients, updatedPatients, duplicates, conflicts, reconciliationMissing };
  }

  async function confirmImport() {
    const draft = ui.importDraft;
    if (!draft) return;
    ui.importSaving = true;
    ui.importProgress = "Preparando importación...";
    renderIaas();
    await waitFrame();
    try {
      executeImportPlanLocal(draft.plan);
      const ops = buildImportWriteOps(draft.plan);
      for (let i = 0; i < ops.length; i += 450) {
        ui.importProgress = `Guardando lote ${Math.floor(i / 450) + 1}/${Math.ceil(ops.length / 450)}...`;
        renderIaas();
        await waitFrame();
        await enqueueWrite({
          type: "batch",
          collection: "import",
          date: draft.plan.date,
          operations: ops.slice(i, i + 450)
        });
      }
      addAudit("CENSUS_IMPORT_CONFIRMED", { importBatchId: draft.plan.importBatchId, metadata: draft.summary });
      ui.importProgress = "Importación completada";
      ui.importDraft = null;
      saveStore();
      flashIaas("Importación completada. Ronda diaria generada.");
      location.hash = `#/ronda/${draft.plan.date}`;
    } catch (error) {
      flashIaas(`Error de guardado: ${friendlyError(error)}`);
    } finally {
      ui.importSaving = false;
      renderIaas();
    }
  }

  function executeImportPlanLocal(plan) {
    const now = nowIso();
    const censusPatients = {};
    plan.rows.forEach(row => {
      const previous = store.patients[row.patientId];
      const pending = splitPending(row.pendientes || row.observaciones);
      if (!previous) {
        store.patients[row.patientId] = {
          patientId: row.patientId,
          displayCode: makeDisplayCode(row.patientId),
          hospitalInternalId: row.hospital_internal_id || row.patient_id || null,
          pseudonymizedId: row.patientId,
          currentService: row.servicio,
          currentBed: row.cama,
          sex: row.sexo,
          age: row.edad,
          admissionDate: row.fecha_ingreso || null,
          currentDiagnosis: row.diagnostico_actual || null,
          diagnosisHistory: [{ date: plan.date, value: row.diagnostico_actual || "", source: "import" }],
          activePendingIssues: pending,
          currentRiskLevel: riskFromImport(row),
          hospitalizationStatus: "hospitalizado",
          presentInLatestCensus: true,
          latestCensusDate: plan.date,
          latestRoundDate: null,
          latestRoundStatus: "pendiente",
          createdAt: now,
          updatedAt: now,
          createdBy: currentUserId(),
          updatedBy: currentUserId()
        };
        addAudit("PATIENT_CREATED", { patientId: row.patientId, after: store.patients[row.patientId], importBatchId: plan.importBatchId });
      } else {
        const before = clone(previous);
        const diagnosisChanged = cleanCell(previous.currentDiagnosis) !== cleanCell(row.diagnostico_actual);
        previous.currentService = row.servicio;
        previous.currentBed = row.cama;
        previous.sex = row.sexo || previous.sex;
        previous.age = row.edad ?? previous.age;
        previous.admissionDate = row.fecha_ingreso || previous.admissionDate;
        previous.currentDiagnosis = row.diagnostico_actual || previous.currentDiagnosis;
        previous.activePendingIssues = mergeUnique(previous.activePendingIssues || [], pending);
        previous.currentRiskLevel = riskFromImport(row) || previous.currentRiskLevel;
        previous.hospitalizationStatus = "hospitalizado";
        previous.presentInLatestCensus = true;
        previous.latestCensusDate = plan.date;
        previous.latestRoundStatus = previous.latestRoundDate === plan.date ? previous.latestRoundStatus : "pendiente";
        previous.updatedAt = now;
        previous.updatedBy = currentUserId();
        if (diagnosisChanged) {
          previous.diagnosisHistory = [...(previous.diagnosisHistory || []), { date: plan.date, value: row.diagnostico_actual || "", source: "import" }];
        }
        addAudit("PATIENT_UPDATED", { patientId: row.patientId, before, after: previous, importBatchId: plan.importBatchId });
      }
      censusPatients[row.patientId] = {
        patientId: row.patientId,
        service: row.servicio,
        bed: row.cama,
        present: true,
        importedFromFile: true,
        importBatchId: plan.importBatchId,
        rowHash: row.rowHash,
        reviewedByNursing: false,
        reviewStatus: "pendiente",
        reviewedAt: null,
        syncStatus: syncStatusForNewWrite(),
        notes: row.observaciones || ""
      };
    });

    plan.reconciliationMissing.forEach(patient => {
      const before = clone(patient);
      patient.presentInLatestCensus = false;
      patient.latestCensusDate = plan.date;
      patient.hospitalizationStatus = "requiere_conciliación";
      patient.latestRoundStatus = "requiere_conciliación";
      patient.updatedAt = now;
      patient.updatedBy = currentUserId();
      addAudit("PATIENT_RECONCILIATION_REQUIRED", { patientId: patient.patientId, before, after: patient, importBatchId: plan.importBatchId });
    });

    store.dailyCensus[plan.date] = {
      date: plan.date,
      importBatchId: plan.importBatchId,
      importedAt: now,
      importedBy: currentUserId(),
      totalRows: plan.rows.length + plan.duplicates.length + plan.conflicts.length,
      totalPatientsDetected: plan.rows.length,
      totalNewPatients: plan.newPatients.length,
      totalUpdatedPatients: plan.updatedPatients.length,
      totalDuplicatesSkipped: plan.duplicates.length,
      totalErrors: plan.conflicts.length,
      status: "imported",
      closedAt: null,
      closedBy: null,
      patients: censusPatients,
      conflicts: plan.conflicts
    };
    ensureDailyRound(plan.date);
    const entries = {};
    Object.values(censusPatients).forEach(row => {
      entries[row.patientId] = store.dailyRounds[plan.date].entries[row.patientId] || {
        entryId: row.patientId,
        patientId: row.patientId,
        service: row.service,
        bed: row.bed,
        reviewedBy: null,
        reviewedAt: null,
        roundDate: plan.date,
        hasInvasives: activeEpisodes(row.patientId, plan.date).length > 0,
        noInvasivesConfirmed: false,
        reviewedDevices: [],
        pendingIssuesAdded: [],
        alertsGenerated: [],
        status: "pendiente",
        syncStatus: syncStatusForNewWrite(),
        localSavedAt: null,
        serverConfirmedAt: null,
        notes: ""
      };
    });
    store.dailyRounds[plan.date].entries = entries;
    store.dailyRounds[plan.date].status = "not_started";
    recalculateRound(plan.date);
  }

  function buildImportWriteOps(plan) {
    const ops = [];
    ops.push({ path: `dailyCensus/${plan.date}`, action: "set", data: omitPatients(store.dailyCensus[plan.date]) });
    Object.values(store.dailyCensus[plan.date].patients || {}).forEach(row => {
      ops.push({ path: `dailyCensus/${plan.date}/patients/${row.patientId}`, action: "set", data: row });
    });
    plan.rows.forEach(row => {
      ops.push({ path: `patients/${row.patientId}`, action: "set", data: store.patients[row.patientId], merge: true });
    });
    ops.push({ path: `dailyRounds/${plan.date}`, action: "set", data: omitEntries(store.dailyRounds[plan.date]), merge: true });
    Object.values(store.dailyRounds[plan.date].entries || {}).forEach(entry => {
      ops.push({ path: `dailyRounds/${plan.date}/entries/${entry.entryId}`, action: "set", data: entry, merge: true });
    });
    return ops;
  }

  function startRound(date) {
    ensureDailyRound(date);
    const round = store.dailyRounds[date];
    if (round.status === "not_started") {
      round.status = "in_progress";
      round.startedAt = nowIso();
      round.startedBy = currentUserId();
      store.dailyCensus[date].status = "round_in_progress";
      addAudit("ROUND_ENTRY_SAVED", { roundDate: date, metadata: { action: "ROUND_STARTED" } });
      saveStore();
      enqueueWrite({ type: "roundUpdate", date, round: omitEntries(round), census: omitPatients(store.dailyCensus[date]) });
    }
    flashIaas("Ronda IAAS iniciada.");
    renderIaas();
  }

  function saveRoundEntry(date, patientId, requestedStatus, goNext) {
    const patient = store.patients[patientId];
    const draft = getReviewDraft(date, patientId);
    const errors = validateReviewDraft(date, patientId, draft, requestedStatus);
    if (errors.length && requestedStatus === "revisado") {
      flashIaas(`Datos incompletos: ${errors[0]}`);
      requestedStatus = "incompleto";
    }

    const createdEpisodeIds = [];
    (draft.deviceDrafts || []).forEach(device => {
      if (!device.installationDate) return;
      const previous = detectReinstallation(patientId, device);
      const episode = {
        episodeId: buildDeviceEpisodeId(patientId, device.deviceType, device.installationDate, device.anatomicalSite || ""),
        patientId,
        deviceType: device.deviceType,
        deviceSubtype: device.deviceSubtype || null,
        anatomicalSite: device.anatomicalSite || null,
        installationDate: device.installationDate,
        removalDate: null,
        status: previous ? "reinstalado" : "activo",
        isReinstallation: Boolean(previous),
        previousEpisodeId: previous?.episodeId || null,
        dressingCurrent: nullable(device.dressingCurrent),
        dressingDate: device.dressingDate || null,
        careStatus: device.careStatus || "no_valorado",
        infectionSigns: nullable(device.infectionSigns),
        infectionSignsDescription: device.infectionSignsDescription || null,
        notes: device.notes || null,
        createdDuringRoundDate: date,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdBy: currentUserId(),
        updatedBy: currentUserId(),
        source: "nursing_round"
      };
      store.deviceEpisodes[episode.episodeId] = episode;
      createdEpisodeIds.push(episode.episodeId);
      addAudit(episode.isReinstallation ? "DEVICE_REINSTALLATION_CREATED" : "DEVICE_EPISODE_CREATED", {
        patientId,
        deviceEpisodeId: episode.episodeId,
        roundDate: date,
        after: episode
      });
    });

    Object.entries(draft.removals || {}).forEach(([episodeId, removalDate]) => {
      if (!removalDate || !store.deviceEpisodes[episodeId]) return;
      const episode = store.deviceEpisodes[episodeId];
      const before = clone(episode);
      episode.removalDate = removalDate;
      episode.status = "retirado";
      episode.updatedAt = nowIso();
      episode.updatedBy = currentUserId();
      addAudit("DEVICE_EPISODE_REMOVED", { patientId, deviceEpisodeId: episodeId, roundDate: date, before, after: episode });
    });

    const pendingAdded = draft.pendingText ? [draft.pendingText.trim()] : [];
    if (pendingAdded.length) {
      patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], pendingAdded);
    }
    const activeNow = activeEpisodes(patientId, date);
    const alerts = buildAlertsForPatient(patient, activeNow, draft);
    const status = alerts.length ? "alerta" : requestedStatus;
    ensureDailyRound(date);
    const entry = {
      entryId: patientId,
      patientId,
      service: patient.currentService,
      bed: patient.currentBed,
      reviewedBy: currentUserId(),
      reviewedAt: nowIso(),
      roundDate: date,
      hasInvasives: activeNow.length > 0 || createdEpisodeIds.length > 0,
      noInvasivesConfirmed: Boolean(draft.noInvasivesConfirmed),
      reviewedDevices: mergeUnique(activeNow.map(ep => ep.episodeId), createdEpisodeIds),
      pendingIssuesAdded: pendingAdded,
      alertsGenerated: alerts,
      status,
      syncStatus: syncStatusForNewWrite(),
      localSavedAt: nowIso(),
      serverConfirmedAt: ui.firebase.ready && navigator.onLine ? nowIso() : null,
      notes: draft.notes || ""
    };
    store.dailyRounds[date].entries[patientId] = entry;
    if (store.dailyCensus[date]?.patients?.[patientId]) {
      store.dailyCensus[date].patients[patientId].reviewedByNursing = status === "revisado" || status === "alerta";
      store.dailyCensus[date].patients[patientId].reviewStatus = status;
      store.dailyCensus[date].patients[patientId].reviewedAt = entry.reviewedAt;
      store.dailyCensus[date].patients[patientId].syncStatus = entry.syncStatus;
    }
    patient.latestRoundDate = date;
    patient.latestRoundStatus = status;
    patient.updatedAt = nowIso();
    patient.updatedBy = currentUserId();
    addAudit("ROUND_ENTRY_SAVED", { patientId, roundDate: date, after: entry });
    recalculateRound(date);
    clearReviewDraft(date, patientId);
    saveStore();
    enqueueWrite({ type: "roundEntry", date, patientId, entry, patient, episodes: createdEpisodeIds.map(id => store.deviceEpisodes[id]) });
    flashIaas(entry.syncStatus === "local_pending" ? "Guardado localmente. Pendiente de sincronizar." : "Sincronizado.");
    if (goNext) {
      const next = nextPatientId(date, patientId);
      location.hash = next ? `#/ronda/${date}/paciente/${next}` : `#/ronda/${date}`;
    } else {
      renderIaas();
    }
  }

  function validateReviewDraft(date, patientId, draft, requestedStatus) {
    const errors = [];
    (draft.deviceDrafts || []).forEach(device => {
      if (!device.installationDate) errors.push(`${device.deviceType}: falta fecha de instalación.`);
      if (device.installationDate && !normalizeDate(device.installationDate)) errors.push(`${device.deviceType}: fecha de instalación inválida.`);
    });
    Object.entries(draft.removals || {}).forEach(([episodeId, removalDate]) => {
      const episode = store.deviceEpisodes[episodeId];
      if (!removalDate) errors.push(`${episode?.deviceType || "Dispositivo"}: falta fecha de retiro.`);
      if (episode?.installationDate && removalDate < episode.installationDate) errors.push(`${episode.deviceType}: retiro antes de instalación.`);
    });
    if (draft.noInvasivesConfirmed && activeEpisodes(patientId, date).some(ep => !draft.removals?.[ep.episodeId])) {
      errors.push("Había invasivos activos. Confirme fecha de retiro o marque como incompleto.");
    }
    if (requestedStatus === "revisado" && !draft.noInvasivesConfirmed && !(draft.deviceDrafts || []).length && !activeEpisodes(patientId, date).length) {
      errors.push("Confirme Sin invasivos o agregue dispositivos.");
    }
    return errors;
  }

  function closeRound(date) {
    ensureDailyRound(date);
    const issues = validateRoundBeforeClose(date);
    if (issues.length) {
      flashIaas(`No se puede cerrar ronda: ${issues[0]}`);
      renderIaas();
      return;
    }
    const round = store.dailyRounds[date];
    round.status = "closed";
    round.closedAt = nowIso();
    round.closedBy = currentUserId();
    if (store.dailyCensus[date]) {
      store.dailyCensus[date].status = "closed";
      store.dailyCensus[date].closedAt = round.closedAt;
      store.dailyCensus[date].closedBy = round.closedBy;
    }
    addAudit("ROUND_CLOSED", { roundDate: date, after: omitEntries(round) });
    saveStore();
    enqueueWrite({ type: "roundClosed", date, round: omitEntries(round), census: store.dailyCensus[date] ? omitPatients(store.dailyCensus[date]) : null });
    flashIaas("Ronda cerrada. Reporte listo.");
    renderIaas();
  }

  function resolveReconciliation(patientId, status, reason) {
    const patient = store.patients[patientId];
    if (!patient) return;
    const before = clone(patient);
    patient.hospitalizationStatus = status;
    patient.presentInLatestCensus = status === "hospitalizado";
    patient.latestRoundStatus = status === "hospitalizado" ? "pendiente" : "revisado";
    patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], [`Conciliado: ${reason}`]);
    patient.updatedAt = nowIso();
    patient.updatedBy = currentUserId();
    addAudit("PATIENT_UPDATED", { patientId, before, after: patient, metadata: { reconciliationResolution: reason } });
    saveStore();
    enqueueWrite({ type: "patientUpdate", patientId, patient });
    flashIaas(`Conciliación registrada: ${reason}.`);
    renderIaas();
  }

  function validateRoundBeforeClose(date) {
    const issues = [];
    const round = store.dailyRounds[date];
    const entries = Object.values(round?.entries || {});
    entries.forEach(entry => {
      if (entry.status === "pendiente") issues.push(`Paciente ${store.patients[entry.patientId]?.displayCode || entry.patientId} sigue pendiente.`);
      if (entry.syncStatus === "local_pending") issues.push(`Paciente ${store.patients[entry.patientId]?.displayCode || entry.patientId} pendiente de sincronizar.`);
      if (entry.syncStatus === "error") issues.push(`Paciente ${store.patients[entry.patientId]?.displayCode || entry.patientId} con error de guardado.`);
    });
    pendingQueue().forEach(() => issues.push("Existen escrituras pendientes de sincronizar."));
    Object.values(store.deviceEpisodes).forEach(ep => {
      if (ep.status === "activo" && !ep.installationDate) issues.push(`${ep.deviceType} activo sin fecha de instalación.`);
      if (ep.status === "retirado" && !ep.removalDate) issues.push(`${ep.deviceType} retirado sin fecha de retiro.`);
      if (ep.installationDate && ep.removalDate && ep.removalDate < ep.installationDate) issues.push(`${ep.deviceType} con retiro antes de instalación.`);
    });
    (store.dailyCensus[date]?.conflicts || []).forEach(conflict => issues.push(`Conflicto de importación: ${conflict.patientId}.`));
    return unique(issues);
  }

  function computeStats(date) {
    ensureDailyRound(date);
    const round = store.dailyRounds[date];
    const censusRows = getCensusRows(date);
    const entries = Object.values(round.entries || {});
    const episodes = Object.values(store.deviceEpisodes);
    const active = episodes.filter(ep => isEpisodeActiveOn(ep, date));
    const installedToday = episodes.filter(ep => ep.installationDate === date).length;
    const removedToday = episodes.filter(ep => ep.removalDate === date).length;
    const reinstallationsToday = episodes.filter(ep => ep.isReinstallation && ep.createdDuringRoundDate === date).length;
    const deviceDaysByType = {};
    active.forEach(ep => {
      deviceDaysByType[ep.deviceType] = (deviceDaysByType[ep.deviceType] || 0) + 1;
    });
    const byService = {};
    censusRows.forEach(row => {
      byService[row.service] ||= { total: 0, reviewed: 0, devices: 0 };
      byService[row.service].total += 1;
      const entry = round.entries[row.patientId];
      if (entry && ["revisado", "alerta"].includes(entry.status)) byService[row.service].reviewed += 1;
      byService[row.service].devices += activeEpisodes(row.patientId, date).length;
    });
    const alertPatients = Object.values(store.patients).filter(patient =>
      patient.latestRoundStatus === "alerta" || activeEpisodes(patient.patientId, date).some(ep => ep.infectionSigns || deviceOver48h(ep, date))
    ).map(patient => ({ ...patient, reason: activeEpisodes(patient.patientId, date).some(ep => ep.infectionSigns) ? "Signos de infección" : "Invasivo > 48 h" }));
    const pending = entries.filter(entry => entry.status === "pendiente").length;
    const incomplete = entries.filter(entry => entry.status === "incompleto").length;
    const reconciliation = Object.values(store.patients).filter(patient => patient.hospitalizationStatus === "requiere_conciliación").length;
    return {
      totalPatients: censusRows.length,
      reviewedPatients: entries.filter(entry => ["revisado", "alerta"].includes(entry.status)).length,
      pendingPatients: pending,
      incompletePatients: incomplete,
      reconciliationPatients: reconciliation,
      activeAlerts: alertPatients.length,
      activeDevices: active.length,
      activeByType: deviceDaysByType,
      installedToday,
      removedToday,
      reinstallationsToday,
      patientDays: censusRows.length,
      deviceDaysByType,
      totalDeviceDays: Object.values(deviceDaysByType).reduce((sum, value) => sum + value, 0),
      alertPatients,
      byService,
      localPendingWritesCount: pendingQueue().length,
      serverSyncedWritesCount: entries.filter(entry => entry.syncStatus === "server_synced").length,
      errorWritesCount: entries.filter(entry => entry.syncStatus === "error").length
    };
  }

  function computeRangeStats(days) {
    const out = [];
    const today = new Date(`${isoToday()}T00:00:00`);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const date = toIsoDate(d);
      const activeDevices = Object.values(store.deviceEpisodes).filter(ep => isEpisodeActiveOn(ep, date)).length;
      out.push({ date, activeDevices, patientDays: getCensusRows(date).length });
    }
    return out;
  }

  async function enqueueWrite(operation) {
    const item = { id: `write-${Date.now()}-${Math.random().toString(16).slice(2)}`, status: "local_pending", createdAt: nowIso(), operation };
    if (!ui.firebase.ready || !navigator.onLine) {
      store.writeQueue.push(item);
      saveStore();
      return;
    }
    try {
      await writeOperationToFirestore(operation);
      item.status = "server_synced";
    } catch (error) {
      item.status = "error";
      item.error = friendlyError(error);
      store.writeQueue.push(item);
      addAudit("SYNC_ERROR", { metadata: { error: item.error, operationType: operation.type } });
    }
    saveStore();
  }

  async function flushSyncQueue() {
    if (!ui.firebase.ready || !navigator.onLine) return;
    const queue = [...store.writeQueue];
    for (const item of queue) {
      if (item.status === "server_synced") continue;
      try {
        await writeOperationToFirestore(item.operation);
        item.status = "server_synced";
        item.serverConfirmedAt = nowIso();
      } catch (error) {
        item.status = "error";
        item.error = friendlyError(error);
      }
    }
    store.writeQueue = queue.filter(item => item.status !== "server_synced");
    saveStore();
    renderIaas();
  }

  async function initFirebaseIfConfigured() {
    const config = window.EPIVIDA_FIREBASE_CONFIG;
    if (!config) return;
    ui.firebase.enabled = true;
    try {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
      ]);
      const app = appMod.initializeApp(config);
      const auth = authMod.getAuth(app);
      let db;
      try {
        db = fsMod.initializeFirestore(app, {
          localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() })
        });
        ui.firebase.offlinePersistence = "Persistencia offline Firestore activa";
      } catch {
        db = fsMod.getFirestore(app);
        ui.firebase.offlinePersistence = "Persistencia offline no disponible en este navegador";
      }
      firebaseRuntime = { appMod, authMod, fsMod, app, auth, db };
      authMod.onAuthStateChanged(auth, async user => {
        ui.firebase.user = user;
        ui.firebase.denied = Boolean(user && !isEmailAllowed(user.email));
        ui.firebase.ready = Boolean(user && !ui.firebase.denied);
        renderIaas();
        if (ui.firebase.ready) {
          await hydrateCurrentFirestore();
          startRealtimeSync(isoToday());
          flushSyncQueue();
        } else {
          stopRealtimeSync();
        }
      });
    } catch (error) {
      ui.firebase.error = friendlyError(error);
      ui.firebase.ready = false;
    }
  }

  async function signInFirebase() {
    if (!firebaseRuntime) return;
    try {
      if (ui.firebase.authProvider === "google") {
        const provider = new firebaseRuntime.authMod.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await firebaseRuntime.authMod.signInWithPopup(firebaseRuntime.auth, provider);
      } else {
        const email = document.querySelector("#login-email")?.value || "";
        const password = document.querySelector("#login-password")?.value || "";
        await firebaseRuntime.authMod.signInWithEmailAndPassword(firebaseRuntime.auth, email, password);
      }
    } catch (error) {
      ui.firebase.error = friendlyError(error);
      renderIaas();
    }
  }

  async function signOutFirebase() {
    if (!firebaseRuntime) return;
    stopRealtimeSync();
    ui.firebase.denied = false;
    await firebaseRuntime.authMod.signOut(firebaseRuntime.auth);
  }

  function isEmailAllowed(email) {
    if (!ui.allowedEmails.length) return true;
    return ui.allowedEmails.includes(String(email || "").toLowerCase());
  }

  async function hydrateCurrentFirestore(date = isoToday()) {
    if (!firebaseRuntime || !ui.firebase.ready) return;
    const { fsMod, db } = firebaseRuntime;
    ui.firebase.realtimeStatus = "Cargando datos compartidos";
    try {
      const [censusDoc, censusRows, roundDoc, roundEntries] = await Promise.all([
        fsMod.getDoc(fsMod.doc(db, `dailyCensus/${date}`)),
        fsMod.getDocs(fsMod.collection(db, `dailyCensus/${date}/patients`)),
        fsMod.getDoc(fsMod.doc(db, `dailyRounds/${date}`)),
        fsMod.getDocs(fsMod.collection(db, `dailyRounds/${date}/entries`))
      ]);

      if (censusDoc.exists()) {
        const remote = censusDoc.data();
        store.dailyCensus[date] = {
          ...(store.dailyCensus[date] || {}),
          ...remote,
          patients: store.dailyCensus[date]?.patients || {}
        };
      }
      if (!store.dailyCensus[date]) {
        store.dailyCensus[date] = {
          date,
          importBatchId: "",
          importedAt: null,
          importedBy: null,
          totalRows: 0,
          totalPatientsDetected: 0,
          totalNewPatients: 0,
          totalUpdatedPatients: 0,
          totalDuplicatesSkipped: 0,
          totalErrors: 0,
          status: "draft",
          closedAt: null,
          closedBy: null,
          patients: {},
          conflicts: []
        };
      }
      censusRows.forEach(docSnap => {
        store.dailyCensus[date].patients[docSnap.id] = docSnap.data();
      });

      const patientIds = Object.keys(store.dailyCensus[date].patients || {});
      const patientDocs = await Promise.all(patientIds.map(patientId =>
        fsMod.getDoc(fsMod.doc(db, `patients/${patientId}`)).catch(() => null)
      ));
      patientDocs.forEach(docSnap => {
        if (docSnap?.exists()) store.patients[docSnap.id] = docSnap.data();
      });

      const episodeCollections = await Promise.all(patientIds.map(patientId =>
        fsMod.getDocs(fsMod.collection(db, `patients/${patientId}/deviceEpisodes`)).catch(() => null)
      ));
      episodeCollections.forEach(snapshot => {
        snapshot?.forEach(docSnap => {
          store.deviceEpisodes[docSnap.id] = docSnap.data();
        });
      });

      if (roundDoc.exists()) {
        const remoteRound = roundDoc.data();
        store.dailyRounds[date] = {
          ...(store.dailyRounds[date] || {}),
          ...remoteRound,
          entries: store.dailyRounds[date]?.entries || {}
        };
      }
      ensureDailyRound(date);
      roundEntries.forEach(docSnap => {
        store.dailyRounds[date].entries[docSnap.id] = docSnap.data();
      });

      ui.firebase.remoteHydrated = true;
      ui.firebase.realtimeStatus = "Datos compartidos cargados";
      saveStore();
      renderIaas();
    } catch (error) {
      ui.firebase.error = `No se pudieron cargar datos compartidos: ${friendlyError(error)}`;
      ui.firebase.realtimeStatus = "Error de carga remota";
      renderIaas();
    }
  }

  function startRealtimeSync(date = isoToday()) {
    if (!firebaseRuntime || !ui.firebase.ready || remoteUnsubscribers.length) return;
    const { fsMod, db } = firebaseRuntime;
    try {
      remoteUnsubscribers = [
        fsMod.onSnapshot(fsMod.collection(db, `dailyCensus/${date}/patients`), snapshot => {
          if (!store.dailyCensus[date]) return;
          snapshot.docChanges().forEach(change => {
            if (change.type !== "removed") {
              store.dailyCensus[date].patients[change.doc.id] = change.doc.data();
            }
          });
          saveStore();
          renderIaas();
        }),
        fsMod.onSnapshot(fsMod.collection(db, `dailyRounds/${date}/entries`), snapshot => {
          ensureDailyRound(date);
          snapshot.docChanges().forEach(change => {
            if (change.type !== "removed") {
              store.dailyRounds[date].entries[change.doc.id] = change.doc.data();
            }
          });
          saveStore();
          renderIaas();
        })
      ];
      ui.firebase.realtimeStatus = "Escucha colaborativa activa";
    } catch (error) {
      ui.firebase.realtimeStatus = `Escucha colaborativa no disponible: ${friendlyError(error)}`;
    }
  }

  function stopRealtimeSync() {
    remoteUnsubscribers.forEach(unsubscribe => {
      try { unsubscribe(); } catch {}
    });
    remoteUnsubscribers = [];
    ui.firebase.realtimeStatus = "Sin escucha colaborativa";
  }

  async function writeOperationToFirestore(operation) {
    if (!firebaseRuntime) throw new Error("Firebase no configurado.");
    const { fsMod, db } = firebaseRuntime;
    if (operation.type === "batch") {
      const batch = fsMod.writeBatch(db);
      operation.operations.forEach(op => {
        const ref = fsMod.doc(db, op.path);
        if (op.action === "set") batch.set(ref, withServerAudit(op.data), { merge: op.merge !== false });
      });
      await batch.commit();
      await writePendingAuditLogsToFirestore();
      return;
    }
    if (operation.type === "roundEntry") {
      const batch = fsMod.writeBatch(db);
      batch.set(fsMod.doc(db, `patients/${operation.patientId}`), withServerAudit(operation.patient), { merge: true });
      batch.set(fsMod.doc(db, `dailyRounds/${operation.date}/entries/${operation.patientId}`), withServerAudit(operation.entry), { merge: true });
      operation.episodes.forEach(ep => {
        batch.set(fsMod.doc(db, `patients/${operation.patientId}/deviceEpisodes/${ep.episodeId}`), withServerAudit(ep), { merge: true });
      });
      await batch.commit();
      await writePendingAuditLogsToFirestore();
      return;
    }
    if (operation.type === "roundClosed") {
      const batch = fsMod.writeBatch(db);
      batch.set(fsMod.doc(db, `dailyRounds/${operation.date}`), withServerAudit(operation.round), { merge: true });
      if (operation.census) {
        batch.set(fsMod.doc(db, `dailyCensus/${operation.date}`), withServerAudit(operation.census), { merge: true });
      }
      await batch.commit();
      await writePendingAuditLogsToFirestore();
      return;
    }
    if (operation.type === "roundUpdate") {
      const batch = fsMod.writeBatch(db);
      batch.set(fsMod.doc(db, `dailyRounds/${operation.date}`), withServerAudit(operation.round), { merge: true });
      if (operation.census) {
        batch.set(fsMod.doc(db, `dailyCensus/${operation.date}`), withServerAudit(operation.census), { merge: true });
      }
      await batch.commit();
      await writePendingAuditLogsToFirestore();
      return;
    }
    if (operation.type === "patientUpdate") {
      await fsMod.setDoc(fsMod.doc(db, `patients/${operation.patientId}`), withServerAudit(operation.patient), { merge: true });
      await writePendingAuditLogsToFirestore();
    }
  }

  async function writePendingAuditLogsToFirestore() {
    if (!firebaseRuntime || !ui.firebase.ready) return;
    const pendingLogs = store.auditLogs.filter(log => !log.serverConfirmedAt).slice(-80);
    if (!pendingLogs.length) return;
    const { fsMod, db } = firebaseRuntime;
    const batch = fsMod.writeBatch(db);
    pendingLogs.forEach(log => {
      batch.set(fsMod.doc(db, `auditLogs/${log.logId}`), { ...log, serverConfirmedAt: nowIso() }, { merge: true });
    });
    await batch.commit();
    pendingLogs.forEach(log => { log.serverConfirmedAt = nowIso(); });
    saveStore();
  }

  function withServerAudit(data) {
    return { ...data, updatedAt: nowIso(), updatedBy: currentUserId() };
  }

  function getReviewDraft(date, patientId) {
    const key = `${date}:${patientId}`;
    ui.reviewDrafts[key] ||= { deviceDrafts: [], removals: {}, pendingText: "", notes: "", noInvasivesConfirmed: false };
    return ui.reviewDrafts[key];
  }

  function setReviewDraft(date, patientId, draft) {
    ui.reviewDrafts[`${date}:${patientId}`] = draft;
    saveJson(DRAFT_KEY, ui.reviewDrafts);
  }

  function updateDraft(date, patientId, patch) {
    const draft = { ...getReviewDraft(date, patientId), ...patch };
    setReviewDraft(date, patientId, draft);
  }

  function clearReviewDraft(date, patientId) {
    delete ui.reviewDrafts[`${date}:${patientId}`];
    saveJson(DRAFT_KEY, ui.reviewDrafts);
  }

  function addDeviceDraft(date, patientId, type) {
    const draft = getReviewDraft(date, patientId);
    draft.noInvasivesConfirmed = false;
    draft.deviceDrafts = [...(draft.deviceDrafts || []), {
      deviceType: type,
      installationDate: isoToday(),
      anatomicalSite: "",
      dressingCurrent: null,
      dressingDate: "",
      careStatus: "no_valorado",
      infectionSigns: null,
      infectionSignsDescription: "",
      notes: ""
    }];
    setReviewDraft(date, patientId, draft);
    renderIaas();
  }

  function removeDeviceDraft(date, patientId, index) {
    const draft = getReviewDraft(date, patientId);
    draft.deviceDrafts.splice(index, 1);
    setReviewDraft(date, patientId, draft);
    renderIaas();
  }

  function toggleNoInvasives(date, patientId) {
    const draft = getReviewDraft(date, patientId);
    draft.noInvasivesConfirmed = !draft.noInvasivesConfirmed;
    if (draft.noInvasivesConfirmed) draft.deviceDrafts = [];
    setReviewDraft(date, patientId, draft);
    renderIaas();
  }

  function updateRemovalDraft(draft, episodeId, value) {
    draft.removals ||= {};
    draft.removals[episodeId] = value;
    saveJson(DRAFT_KEY, ui.reviewDrafts);
  }

  function parseDelimitedText(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(line => line.trim());
    if (!lines.length) return [];
    const delimiter = detectDelimiter(lines[0]);
    const headers = splitCsvLine(lines[0], delimiter).map(header => header.trim());
    return lines.slice(1).map(line => {
      const cells = splitCsvLine(line, delimiter);
      const row = {};
      headers.forEach((header, index) => row[header] = cells[index] ?? "");
      return row;
    });
  }

  function splitCsvLine(line, delimiter) {
    const out = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        out.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    out.push(current);
    return out.map(value => value.trim());
  }

  function detectDelimiter(header) {
    const options = ["\t", ",", ";", "|"];
    return options.map(delimiter => [delimiter, header.split(delimiter).length]).sort((a, b) => b[1] - a[1])[0][0];
  }

  function canonicalColumn(input) {
    const key = normalizeText(input).replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
    return Object.entries(COLUMN_ALIASES).find(([, aliases]) => aliases.some(alias => normalizeText(alias).replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() === key))?.[0] || null;
  }

  function loadSampleImport() {
    const date = isoToday();
    ui.importText = [
      "patient_id\tfecha_censo\tservicio\tcama\tedad\tsexo\tfecha_ingreso\tdiagnostico_actual\tpendientes",
      `EXP-001\t${date}\tMEDICINA INTERNA\t23\t71\tM\t2026-04-16\tERC en hemodiálisis / vigilancia IAAS\tConfirmar curación de CVC`,
      `EXP-002\t${date}\tCIRUGÍA Y TRAUMATOLOGÍA\t45\t77\tF\t2026-04-20\tFístula enterocutánea\tRevisar paquete preventivo`,
      `EXP-003\t${date}\tURGENCIAS\tA1\t60\tM\t2026-04-27\tNAC descartar influenza y COVID\tResultados PCR`
    ].join("\n");
    ui.importDraft = null;
    renderIaas();
    const input = document.querySelector("#import-text");
    if (input) input.value = ui.importText;
  }

  function cancelImport() {
    ui.importDraft = null;
    ui.importProgress = "";
    renderIaas();
  }

  function downloadImportErrors() {
    const draft = ui.importDraft;
    if (!draft) return;
    const rows = draft.rows.filter(row => row.errors.length || row.warnings.length).map(row => ({
      fila: row.index,
      errores: row.errors.join(" | "),
      advertencias: row.warnings.join(" | "),
      datos: JSON.stringify(row.raw)
    }));
    downloadBlob("errores-importacion.csv", toCsv(rows), "text/csv;charset=utf-8");
  }

  function exportDailyCsv(date, type) {
    if (type === "census") {
      const rows = getCensusRows(date).map(row => ({ ...row, displayCode: store.patients[row.patientId]?.displayCode || "" }));
      downloadBlob(`censo-${date}.csv`, toCsv(rows), "text/csv;charset=utf-8");
      addAudit("EXPORT_GENERATED", { roundDate: date, metadata: { type } });
      return;
    }
    const rows = Object.values(store.dailyRounds[date]?.entries || {});
    downloadBlob(`ronda-iaas-${date}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    addAudit("EXPORT_GENERATED", { roundDate: date, metadata: { type } });
  }

  function exportDeviceCsv(date) {
    const rows = Object.values(store.deviceEpisodes).filter(ep => ep.createdDuringRoundDate === date || isEpisodeActiveOn(ep, date));
    downloadBlob(`invasivos-${date}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    addAudit("EXPORT_GENERATED", { roundDate: date, metadata: { type: "devices" } });
  }

  function exportDailyJson(date) {
    const backup = {
      generatedAt: nowIso(),
      dailyCensus: store.dailyCensus[date] || null,
      dailyRound: store.dailyRounds[date] || null,
      patients: getCensusRows(date).map(row => store.patients[row.patientId]).filter(Boolean),
      deviceEpisodes: Object.values(store.deviceEpisodes).filter(ep => ep.createdDuringRoundDate === date || isEpisodeActiveOn(ep, date)),
      auditLogReferences: store.auditLogs.filter(log => log.roundDate === date || log.importBatchId === store.dailyCensus[date]?.importBatchId).map(log => log.logId)
    };
    downloadBlob(`respaldo-epivida-${date}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    addAudit("EXPORT_GENERATED", { roundDate: date, metadata: { type: "json_backup" } });
  }

  function printPatientFollowUp(patientId) {
    location.hash = `#/pacientes/${patientId}/seguimiento`;
    setTimeout(() => window.print(), 80);
  }

  function toCsv(rows) {
    if (!rows.length) return "";
    const headers = unique(rows.flatMap(row => Object.keys(row)));
    const escape = value => {
      const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
      return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.join(","), ...rows.map(row => headers.map(header => escape(row[header])).join(","))].join("\n");
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function ensureDailyRound(date) {
    store.dailyRounds[date] ||= {
      date,
      status: "not_started",
      startedAt: null,
      startedBy: null,
      closedAt: null,
      closedBy: null,
      entries: {},
      totalPatients: 0,
      reviewedPatients: 0,
      pendingPatients: 0,
      incompletePatients: 0,
      reconciliationPatients: 0,
      activeAlerts: 0,
      localPendingWritesCount: 0,
      serverSyncedWritesCount: 0,
      errorWritesCount: 0
    };
    getCensusRows(date).forEach(row => {
      store.dailyRounds[date].entries[row.patientId] ||= {
        entryId: row.patientId,
        patientId: row.patientId,
        service: row.service,
        bed: row.bed,
        reviewedBy: null,
        reviewedAt: null,
        roundDate: date,
        hasInvasives: activeEpisodes(row.patientId, date).length > 0,
        noInvasivesConfirmed: false,
        reviewedDevices: [],
        pendingIssuesAdded: [],
        alertsGenerated: [],
        status: "pendiente",
        syncStatus: "server_synced",
        localSavedAt: null,
        serverConfirmedAt: null,
        notes: ""
      };
    });
  }

  function recalculateRound(date) {
    const round = store.dailyRounds[date];
    if (!round) return;
    const entries = Object.values(round.entries || {});
    round.totalPatients = entries.length;
    round.reviewedPatients = entries.filter(entry => ["revisado", "alerta"].includes(entry.status)).length;
    round.pendingPatients = entries.filter(entry => entry.status === "pendiente").length;
    round.incompletePatients = entries.filter(entry => entry.status === "incompleto").length;
    round.reconciliationPatients = Object.values(store.patients).filter(patient => patient.hospitalizationStatus === "requiere_conciliación").length;
    round.activeAlerts = entries.filter(entry => entry.status === "alerta").length;
    round.localPendingWritesCount = entries.filter(entry => entry.syncStatus === "local_pending").length;
    round.serverSyncedWritesCount = entries.filter(entry => entry.syncStatus === "server_synced").length;
    round.errorWritesCount = entries.filter(entry => entry.syncStatus === "error").length;
    if (round.status === "in_progress" && round.pendingPatients === 0 && round.localPendingWritesCount === 0 && round.errorWritesCount === 0) {
      round.status = "ready_to_close";
    }
  }

  function getCensusRows(date) {
    return Object.values(store.dailyCensus[date]?.patients || {});
  }

  function activeEpisodes(patientId, date) {
    return Object.values(store.deviceEpisodes).filter(ep => ep.patientId === patientId && isEpisodeActiveOn(ep, date));
  }

  function episodesForPatient(patientId) {
    return Object.values(store.deviceEpisodes).filter(ep => ep.patientId === patientId);
  }

  function isEpisodeActiveOn(ep, date) {
    if (!ep.installationDate || ep.installationDate > date) return false;
    return !ep.removalDate || ep.removalDate >= date;
  }

  function detectReinstallation(patientId, device) {
    return episodesForPatient(patientId)
      .filter(ep => ep.deviceType === device.deviceType && ep.removalDate && ep.removalDate <= device.installationDate)
      .sort((a, b) => String(b.removalDate).localeCompare(String(a.removalDate)))[0] || null;
  }

  function buildAlertsForPatient(patient, episodes, draft) {
    const alerts = [];
    episodes.forEach(ep => {
      if (deviceOver48h(ep, isoToday())) alerts.push(`${ep.deviceType} > 48 h`);
      if (ep.infectionSigns || draft.deviceDrafts?.some(device => device.deviceType === ep.deviceType && device.infectionSigns)) alerts.push(`Alerta IAAS: signos de infección en ${ep.deviceType}`);
      if (ep.dressingCurrent === false) alerts.push(`Curación pendiente: ${ep.deviceType}`);
    });
    if (patient.hospitalizationStatus === "requiere_conciliación") alerts.push("Requiere conciliación");
    return unique(alerts);
  }

  function deviceOver48h(ep, date) {
    const days = daysBetween(ep.installationDate, date);
    return Number.isFinite(days) && days >= 2;
  }

  function nextPatientId(date, patientId) {
    const rows = getCensusRows(date).sort(sortByServiceBed);
    const index = rows.findIndex(row => row.patientId === patientId);
    return rows[index + 1]?.patientId || null;
  }

  function sortByServiceBed(a, b) {
    return SERVICES.indexOf(a.service) - SERVICES.indexOf(b.service)
      || String(a.bed || "").localeCompare(String(b.bed || ""), "es", { numeric: true });
  }

  function addAudit(actionType, payload = {}) {
    const log = {
      logId: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: nowIso(),
      userId: currentUserId(),
      userDisplayName: currentUserName(),
      actionType,
      patientId: payload.patientId || null,
      deviceEpisodeId: payload.deviceEpisodeId || null,
      roundDate: payload.roundDate || null,
      importBatchId: payload.importBatchId || null,
      before: payload.before || null,
      after: payload.after || null,
      metadata: payload.metadata || null
    };
    store.auditLogs.push(log);
  }

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    return { page: parts[0] || "dashboard", parts };
  }

  function routeTitle(page) {
    return {
      dashboard: "Panel IAAS",
      "importar-censo": "Importar censo",
      ronda: "Ronda IAAS",
      pacientes: "Seguimiento de paciente",
      "reporte-diario": "Reportes"
    }[page] || "Panel IAAS";
  }

  function h(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "style") node.setAttribute("style", value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (key === "value") node.value = value;
      else if (key === "disabled") node.disabled = Boolean(value);
      else if (key === "selected") node.selected = Boolean(value);
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child === null || child === undefined || child === false) return;
      node.append(child?.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function option(value, label, selected) {
    return h("option", { value, selected }, [label]);
  }

  function flashIaas(message) {
    const toast = h("div", { class: "toast iaas-toast" }, [message]);
    document.body.append(toast);
    setTimeout(() => toast.remove(), 2400);
  }

  function saveStore(next = store) {
    next.lastSavedAt = nowIso();
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function cleanCell(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  }

  function normalizeService(value) {
    const key = normalizeText(value).replace(/\s+/g, " ");
    const mapped = {
      "CIRUGIA Y TRAUMATOLOGIA": "CIRUGÍA Y TRAUMATOLOGÍA",
      "HEMODIALISIS": "HEMODIÁLISIS",
      "UCIA": "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS",
      "UCIN": "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES",
      "UCIP": "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS",
      "GINECOLOGIA Y OBSTETRICIA": "GINECOLOGÍA Y OBSTETRICIA"
    };
    return SERVICES.find(service => normalizeText(service) === key) || mapped[key] || cleanCell(value).toUpperCase();
  }

  function normalizeBed(value) {
    return cleanCell(value).toUpperCase();
  }

  function normalizeSex(value) {
    const key = normalizeText(value);
    if (["M", "MASCULINO", "HOMBRE"].includes(key)) return "M";
    if (["F", "FEMENINO", "MUJER"].includes(key)) return "F";
    return key ? cleanCell(value).toUpperCase() : null;
  }

  function parseAge(value) {
    const n = Number(String(value ?? "").match(/\d+/)?.[0]);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeDate(value) {
    const text = cleanCell(value);
    if (!text || normalizeText(text) === "AMB" || normalizeText(text) === "NA") return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validIsoDate(text) ? text : "";
    const m = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      return validIsoDate(iso) ? iso : "";
    }
    const d = new Date(text);
    return Number.isFinite(d.getTime()) ? toIsoDate(d) : "";
  }

  function validIsoDate(iso) {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isFinite(d.getTime()) && toIsoDate(d) === iso;
  }

  function toIsoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function isoToday() {
    return toIsoDate(new Date());
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function dayLabel(date) {
    return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date).replace(/^\w/, c => c.toUpperCase());
  }

  function daysBetween(start, end) {
    if (!start || !end) return null;
    const a = new Date(`${start}T00:00:00`);
    const b = new Date(`${end}T00:00:00`);
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return null;
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  function createPatientId(row) {
    const stable = cleanCell(row.patient_id || row.hospital_internal_id);
    return `px_${hashText(stable || `${row.servicio}|${row.cama}|${row.fecha_ingreso}`)}`;
  }

  function makeDisplayCode(patientId) {
    return `PX-${String(hashText(patientId)).slice(0, 6).toUpperCase()}`;
  }

  function createImportBatchId(date) {
    return `import-${date}-${Date.now().toString(36)}`;
  }

  function hashNormalizedRow(row) {
    return hashText([row.patient_id, row.fecha_censo, row.servicio, row.cama, row.diagnostico_actual, row.pendientes].map(cleanCell).join("|"));
  }

  function buildDeviceEpisodeId(patientId, deviceType, installationDate, site) {
    return `dev_${hashText(`${patientId}|${deviceType}|${installationDate}|${site || ""}|${Date.now()}`)}`;
  }

  function hashText(input) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    const text = String(input || "");
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function riskFromRow(row) {
    const status = normalizeText(row.estado);
    const dx = normalizeText(row.dxEpidemiologicos);
    if (status.includes("CRITICO") || status.includes("MUY GRAVE")) return "Crítico";
    if (dx.includes("IAAS") && !dx.includes("NO IAAS")) return "Alto";
    if (dx.includes("RIESGO")) return "Moderado";
    return "Bajo";
  }

  function riskFromImport(row) {
    const text = normalizeText(`${row.riesgo_iaas} ${row.pendientes} ${row.diagnostico_actual}`);
    if (text.includes("CRITICO")) return "Crítico";
    if (text.includes("ALTO") || text.includes("IAAS")) return "Alto";
    if (text.includes("MODERADO") || text.includes("RIESGO")) return "Moderado";
    if (text) return "Bajo";
    return null;
  }

  function splitPending(text) {
    return cleanCell(text).split(/\/|\||;/).map(item => item.trim()).filter(Boolean).slice(0, 8);
  }

  function syncStatusForNewWrite() {
    if (!navigator.onLine) return "local_pending";
    if (!ui.firebase.enabled) return "server_synced";
    return ui.firebase.ready ? "server_synced" : "local_pending";
  }

  function syncLabel(status) {
    if (status === "local_pending") return "Pendiente de sincronizar";
    if (status === "error") return "Error de guardado";
    if (status === "server_synced") return ui.firebase.enabled ? "Sincronizado" : "Guardado localmente";
    return "Guardado localmente";
  }

  function statusLabel(status) {
    return {
      pendiente: "Pendiente",
      revisado: "Revisado",
      incompleto: "Incompleto",
      alerta: "Alerta IAAS",
      "requiere_conciliación": "Requiere conciliación"
    }[status] || "Pendiente";
  }

  function careLabel(status) {
    return { adecuado: "Adecuado", inadecuado: "Inadecuado", no_valorado: "No valorado" }[status] || "No valorado";
  }

  function riskClass(risk) {
    return normalizeText(risk).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function pendingQueue() {
    return (store.writeQueue || []).filter(item => item.status !== "server_synced");
  }

  function currentUserId() {
    return ui.firebase.user?.uid || "local-user";
  }

  function currentUserName() {
    return ui.firebase.user?.displayName || ui.firebase.user?.email || "Usuario local";
  }

  function omitPatients(census) {
    const copy = { ...census };
    delete copy.patients;
    return copy;
  }

  function omitEntries(round) {
    const copy = { ...round };
    delete copy.entries;
    return copy;
  }

  function friendlyError(error) {
    const text = error?.message || String(error);
    if (/permission/i.test(text)) return "Permiso denegado por reglas de seguridad.";
    if (/network|offline/i.test(text)) return "Sin conexión.";
    return text;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function mergeUnique(a, b) {
    return unique([...(a || []), ...(b || [])]);
  }

  function nullable(value) {
    return value === undefined ? null : value;
  }

  function parseNullableBoolean(value) {
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }

  function truncateText(text, length) {
    const value = String(text || "");
    return value.length > length ? `${value.slice(0, length).trim()}...` : value;
  }

  function waitFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }
})();

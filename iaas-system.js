(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const AUTH_FLOW_KEY = "epivida-auth-redirect-flow";
  const FIREBASE_VERSION = "10.12.4";
  const PRO_ASSET = "./assets/epivida-pro";
  const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
  const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
  const SHEETS_CONFIG = {
    enabled: false,
    spreadsheetId: "",
    spreadsheetUrl: "",
    appAuthoritative: true,
    schemaVersion: "1",
    maxRows: 1000,
    tabs: {
      appConfig: "APP_CONFIG",
      baseDatos: "BASE_DATOS",
      rondas: "RONDAS_IAAS",
      dispositivos: "DISPOSITIVOS",
      auditoria: "AUDITORIA",
      catalogos: "CATALOGOS"
    },
    ...(window.EPIVIDA_SHEETS_CONFIG || {})
  };
  SHEETS_CONFIG.tabs = {
    appConfig: "APP_CONFIG",
    baseDatos: "BASE_DATOS",
    rondas: "RONDAS_IAAS",
    dispositivos: "DISPOSITIVOS",
    auditoria: "AUDITORIA",
    catalogos: "CATALOGOS",
    ...((window.EPIVIDA_SHEETS_CONFIG || {}).tabs || {})
  };
  const BASE_SHEET_HEADERS = [
    "ID",
    "Fecha_censo",
    "Servicio",
    "Cama",
    "Paciente",
    "Edad",
    "Sexo",
    "Fecha_ingreso",
    "Días_estancia",
    "Dx_epidemiológico",
    "Tipo_IAAS",
    "Cultivo",
    "Aislamiento",
    "Estado",
    "Dx_hospitalario",
    "Observaciones",
    "Updated_at",
    "Updated_by"
  ];
  const ROUND_SHEET_HEADERS = [
    "entry_id",
    "round_date",
    "patient_id",
    "service",
    "bed",
    "status",
    "reviewed_by",
    "reviewed_at",
    "has_invasives",
    "no_invasives_confirmed",
    "reviewed_devices",
    "pending_issues_added",
    "alerts_generated",
    "notes",
    "sync_status",
    "local_saved_at",
    "server_confirmed_at",
    "created_at",
    "updated_at",
    "updated_by",
    "payload_json"
  ];
  const DEVICE_SHEET_HEADERS = [
    "episode_id",
    "patient_id",
    "device_type",
    "device_subtype",
    "anatomical_site",
    "installation_date",
    "removal_date",
    "is_reinstallation",
    "dressing_current",
    "dressing_date",
    "care_status",
    "infection_signs",
    "notes",
    "created_during_round_date",
    "source",
    "sync_status",
    "created_at",
    "updated_at",
    "updated_by",
    "removed_by",
    "payload_json"
  ];
  const AUDIT_SHEET_HEADERS = [
    "log_id",
    "created_at",
    "user_id",
    "action_type",
    "patient_id",
    "round_date",
    "metadata_json",
    "server_confirmed_at"
  ];
  const NAV_ICONS = {
    dashboard: "icon-dashboard",
    "seguimiento-iaas": "icon-iaas",
    "censo-hospitalario": "icon-censo-operativo",
    "importar-censo": "icon-cloud-sync",
    ronda: "icon-seguridad",
    "reporte-diario": "icon-reporte"
  };
  const SERVICE_ICONS = {
    "MEDICINA INTERNA": "servicio-medicina-interna",
    "CIRUGÍA Y TRAUMATOLOGÍA": "servicio-cirugia-traumatologia",
    "PEDIATRÍA": "servicio-pediatria",
    CUNEROS: "servicio-cuneros",
    "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES": "servicio-ucin-neonatales",
    "HEMODIÁLISIS": "servicio-hemodialisis",
    URGENCIAS: "servicio-urgencias",
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS": "servicio-uci-adultos",
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS": "servicio-uci-pediatricos",
    "GINECOLOGÍA Y OBSTETRICIA": "servicio-ginecologia-obstetricia",
    AMBULATORIO: "icon-pacientes"
  };
  const SECTOR_LABELS = {
    MAG: "Magisterio",
    BUR: "Burocracia",
    ISSTECH: "ISSTECH",
    PIM: "Pensionado ISSTECH Magisterio",
    PIB: "Pensionado ISSTECH Burocracia",
    PRIV: "Privado",
    PRIVADO: "Privado"
  };

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
    patient_name: ["patient_name", "paciente", "nombre_paciente", "nombre", "nombre_completo"],
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
    censusService: "Todos",
    censusQuery: "",
    dashboardSlide: 0,
    dashboardSlidePausedUntil: 0,
    focusTarget: "",
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
    sheets: {
      enabled: Boolean(SHEETS_CONFIG.enabled && SHEETS_CONFIG.spreadsheetId),
      status: "disconnected",
      connected: false,
      accessToken: "",
      error: "",
      lastWriteId: "",
      lastSyncAt: null,
      activeDate: "",
      lastSyncedAuditCount: 0,
      spreadsheetUrl: SHEETS_CONFIG.spreadsheetUrl || (SHEETS_CONFIG.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.spreadsheetId}/edit` : ""),
      isSyncing: false
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
    if (current?.version === 1) {
      const seedRows = (window.CENSO_SEED?.rows || []).filter(row => row.type === "patient");
      const currentCount = Object.keys(current.patients || {}).length;
      if (seedRows.length && currentCount === 0 && location.hostname === "localhost") {
        const restored = seedFromCurrentCensus();
        restored.writeQueue = current.writeQueue || [];
        restored.auditLogs = current.auditLogs || [];
        restored.lastSavedAt = nowIso();
        saveStore(restored);
        return restored;
      }
      return current;
    }
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
        patientName: row.paciente || null,
        hospitalInternalId: row.id || null,
        pseudonymizedId: patientId,
        currentService: service,
        currentBed: normalizeBed(row.cama),
        sector: row.sector || null,
        sex: normalizeSex(row.sexo),
        age: parseAge(row.edad),
        admissionDate: normalizeDate(row.ingreso) || null,
        currentState: row.estado || null,
        currentDiagnosis: row.dxHospitalarios || null,
        epidemiologicalDiagnosis: row.dxEpidemiologicos || null,
        observations: row.observaciones || null,
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
        patientName: row.paciente || null,
        sector: row.sector || null,
        age: row.edad || null,
        sex: row.sexo || null,
        admissionDate: normalizeDate(row.ingreso) || null,
        state: row.estado || null,
        diagnosis: row.dxHospitalarios || null,
        epidemiologicalDiagnosis: row.dxEpidemiologicos || null,
        observations: row.observaciones || null,
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
    recalculateRound(activeDate());
    app.replaceChildren(renderShell());
    restoreFocusedControl();
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
    return h("div", { class: "iaas-shell ev-page-bg command-shell" }, [
      renderSidebar(route),
      h("main", { class: "iaas-main" }, [
        renderTopbar(),
        content
      ])
    ]);
  }

  function renderSidebar(active) {
    const nav = [
      ["dashboard", "Centro de Vigilancia"],
      ["ronda", "Paquetes Preventivos"],
      ["seguimiento-iaas", "Seguimiento IAAS"],
      ["censo-hospitalario", "Vigilancia Hospitalaria"],
      ["reporte-diario", "Analítica Epidemiológica"],
      ["importar-censo", "Base de Datos"]
    ];
    return h("aside", { class: "iaas-sidebar ev-sidebar-bg" }, [
      h("div", { class: "iaas-brand" }, [
        h("img", { class: "ev-logo sidebar-logo", src: `${PRO_ASSET}/logos/epivida-icon-square.webp`, alt: "EpiVida HEVM" }),
        h("div", {}, [
          h("strong", {}, ["EpiVida IAAS"])
        ])
      ]),
      h("nav", { class: "iaas-nav" }, nav.map(([page, label]) =>
        h("a", { href: `#/${page}`, class: active === page ? "active" : "" }, [
          h("img", { src: `${PRO_ASSET}/icons/${NAV_ICONS[page] || "icon-dashboard"}.webp`, alt: "", loading: "lazy" }),
          h("span", {}, [
            h("strong", {}, [label])
          ])
        ])
      )),
      renderSidebarSyncCard()
    ]);
  }

  function renderTopbar() {
    if (ui.route.page === "dashboard") return renderCommandTopbar();
    return h("header", { class: "iaas-topbar" }, [
      h("div", {}, [
        h("strong", {}, [routeTitle(ui.route.page)]),
        h("span", {}, [`${dayLabel(new Date())} · ${Object.keys(store.patients).length} pacientes en sistema`])
      ]),
      h("div", { class: "iaas-topbar-actions" }, [
        renderSyncState(),
        renderSheetsControl(),
        h("button", { class: "iaas-button ghost", onclick: () => exportDailyJson(activeDate()) }, [commandIcon("cloud"), "Respaldar"]),
        h("button", { class: "iaas-button ghost", onclick: () => window.print() }, [commandIcon("print"), "Imprimir"]),
        ui.firebase.user ? h("button", { class: "iaas-button ghost", onclick: signOutFirebase }, [commandIcon("logout"), "Cerrar sesión"]) : ""
      ])
    ]);
  }

  function renderSidebarSyncCard() {
    const pending = pendingQueue().length;
    const online = navigator.onLine;
    const label = ui.sheets.enabled
      ? sheetsSyncLabel(pending)
      : !online
      ? "Pendiente de sincronizar"
      : pending
        ? `${pending} pendiente(s)`
        : ui.firebase.ready
          ? "Sistema sincronizado"
          : "Guardado localmente";
    return h("section", { class: `command-sidebar-sync ${online && !pending ? "ok" : "warn"}` }, [
      h("span", { class: "sync-shield" }, [commandIcon("shield")]),
      h("strong", {}, [label]),
      h("i", {}, [])
    ]);
  }

  function renderCommandTopbar() {
    return h("header", { class: "iaas-topbar command-topbar" }, [
      h("div", { class: "command-date-cluster" }, [
        h("span", { class: "command-today" }, [commandIcon("calendar"), "Hoy"]),
        h("strong", {}, [dayLabel(new Date())])
      ]),
      h("div", { class: "iaas-topbar-actions command-actions" }, [
        renderSyncState(),
        renderSheetsControl(),
        h("button", { class: "iaas-button ghost", onclick: () => exportDailyJson(activeDate()) }, [commandIcon("cloud"), "Respaldar"]),
        h("button", { class: "iaas-button ghost", onclick: () => window.print() }, [commandIcon("print"), "Imprimir"]),
        ui.firebase.user ? h("button", { class: "iaas-button ghost", onclick: signOutFirebase }, [commandIcon("logout"), "Cerrar sesión"]) : ""
      ])
    ]);
  }

  function renderSyncState() {
    const pending = pendingQueue().length;
    if (ui.sheets.enabled) {
      const status = ui.sheets.status;
      const className = !navigator.onLine
        ? "sync offline"
        : status === "sync_conflict" || status === "error"
          ? "sync error"
          : pending || status === "sync_pending" || status === "connecting"
            ? "sync pending"
            : ui.sheets.connected
              ? "sync ok"
              : "sync local";
      return h("span", { class: className, title: sheetsSyncTitle() }, [sheetsSyncLabel(pending)]);
    }
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

  function renderSheetsControl() {
    if (!ui.sheets.enabled || !ui.firebase.user || ui.firebase.denied) return "";
    if (ui.sheets.status === "connecting" || (ui.sheets.status === "sync_pending" && ui.sheets.connected)) {
      return h("button", { class: "iaas-button ghost", disabled: true }, [commandIcon("cloud"), "Sheets..."]);
    }
    if (ui.sheets.connected) {
      const label = pendingQueue().length ? "Sincronizar Sheets" : "Recargar Sheets";
      return h("button", { class: "iaas-button ghost", onclick: () => syncOrReloadSheets() }, [commandIcon("cloud"), label]);
    }
    return h("button", { class: "iaas-button primary", onclick: connectSheets }, [commandIcon("cloud"), "Conectar Sheets"]);
  }

  function sheetsSyncLabel(pending = pendingQueue().length) {
    if (!navigator.onLine) return "Sheets sin conexion";
    if (ui.sheets.status === "sync_conflict") return "Conflicto Sheets";
    if (ui.sheets.status === "error") return "Error Sheets";
    if (ui.sheets.status === "connecting") return "Conectando Sheets";
    if (ui.sheets.status === "sync_pending") return pending ? `${pending} pendiente(s)` : "Sincronizando Sheets";
    if (pending) return `${pending} pendiente(s)`;
    if (ui.sheets.connected) return "Sheets conectado";
    return "Sheets desconectado";
  }

  function sheetsSyncTitle() {
    const details = [ui.sheets.spreadsheetUrl || "Google Sheets"];
    if (ui.sheets.lastSyncAt) details.push(`Ultima sincronizacion: ${ui.sheets.lastSyncAt}`);
    if (ui.sheets.error) details.push(ui.sheets.error);
    return details.join(" | ");
  }

  async function syncOrReloadSheets() {
    if (!ui.sheets.connected) return connectSheets();
    if (pendingQueue().length) return flushSyncQueue();
    return hydrateFromSheets();
  }

  function renderRoute() {
    const { page, parts } = ui.route;
    if (page === "censo-hospitalario") return renderHospitalCensusPage();
    if (page === "importar-censo") return renderImportPage();
    if (page === "ronda" && parts[2] === "paciente" && parts[3]) return renderPatientRound(parts[1] || activeDate(), parts[3]);
    if (page === "ronda") return renderRoundPage(parts[1] || activeDate());
    if (page === "seguimiento-iaas") return renderIaasFollowUpHub();
    if (page === "pacientes" && parts[2] === "seguimiento") return renderPatientFollowUp(parts[1]);
    if (page === "reporte-diario") return renderReportsPage();
    return renderDashboard();
  }

  function renderDashboard() {
    const date = activeDate();
    const stats = computeStats(date);
    return h("div", { class: "command-dashboard" }, [
      h("section", { class: "command-heading" }, [
        h("div", {}, [
          h("h1", {}, ["Centro de Vigilancia"]),
          h("p", {}, ["Calendario, notificaciones y eventos epidemiológicos"])
        ])
      ]),
      renderCommandFeatureRail(stats, date),
      renderCommandMetrics(stats, date),
      h("section", { class: "command-bottom-grid" }, [
        renderCommandCalendar(date),
        renderCommandNotifications(stats, date),
        renderCommandQuickActions(date)
      ])
    ]);
  }

  function renderCommandFeatureRail(stats, date) {
    const modules = dashboardModules(stats, date);
    const activeIndex = ((ui.dashboardSlide % modules.length) + modules.length) % modules.length;
    return h("section", {
      class: "command-module-carousel",
      "aria-label": "Módulos principales del sistema",
      onmouseenter: () => { ui.dashboardSlidePausedUntil = Date.now() + 10000; },
      ontouchstart: () => { ui.dashboardSlidePausedUntil = Date.now() + 10000; }
    }, [
      h("button", { class: "command-arrow module-prev", type: "button", onclick: () => setDashboardSlide(ui.dashboardSlide - 1), "aria-label": "Panel anterior" }, [commandIcon("chevron-left")]),
      h("div", { class: "command-module-viewport" }, [
        h("div", { class: "command-module-track", style: `--feature-index:${activeIndex}` }, modules.map(module =>
          h("a", { class: `command-module-card ${module.tone}`, href: module.href, style: `--module-bg:url('${module.backdrop}')` }, [
            h("div", { class: "command-module-copy" }, [
              h("div", { class: "command-module-meta" }, module.meta.map(item => h("span", {}, [item]))),
              h("strong", {}, [module.title]),
              h("p", {}, [module.text]),
              h("em", {}, [module.action, commandIcon("chevron-right")])
            ]),
            h("div", { class: "command-module-art" }, [
              h("img", { src: module.image, alt: "", loading: "lazy" })
            ])
          ])
        ))
      ]),
      h("button", { class: "command-arrow module-next", type: "button", onclick: () => setDashboardSlide(ui.dashboardSlide + 1), "aria-label": "Panel siguiente" }, [commandIcon("chevron-right")]),
      h("div", { class: "command-dots module-dots" }, modules.map((_, index) =>
        h("button", { class: index === activeIndex ? "active" : "", type: "button", "aria-label": `Ver módulo ${index + 1}`, onclick: () => setDashboardSlide(index) }, [])
      ))
    ]);
  }

  function commandFeatureCards(stats, date) {
    const briefing = salaBriefingData(stats, date);
    const pendingServices = Object.values(stats.byService).filter(service => service.reviewed < service.total).length;
    return [
      {
        title: "Agenda del día",
        detail: `${commandCalendarEvents(date).length + 2} actividades programadas`,
        href: "#/dashboard",
        tone: "agenda",
        image: `${PRO_ASSET}/icons/extras/futuristic_medical_dashboard_icon.webp`
      },
      {
        title: "Alertas críticas",
        detail: `${stats.activeAlerts} alerta(s) activa(s) requieren atención`,
        href: "#/seguimiento-iaas",
        tone: "critical",
        image: `${PRO_ASSET}/icons/extras/futuristic_security_notification_interface_design.webp`
      },
      {
        title: "Cultivos pendientes",
        detail: `${briefing.cultureEvents.length} evento(s) sin cerrar`,
        href: "#/seguimiento-iaas",
        tone: "cultures",
        image: `${PRO_ASSET}/icons/extras/futuristic_microscope_with_virus_and_heartbeat.webp`
      },
      {
        title: "Rondas por completar",
        detail: `${pendingServices} servicio(s) con revisión pendiente`,
        href: `#/ronda/${date}`,
        tone: "rounds",
        image: `${PRO_ASSET}/icons/extras/futuristic_medical_dashboard_with_hospital_bed.webp`
      },
      {
        title: "CODECIN / RHOVE",
        detail: "Notificación y vigilancia nacional",
        href: "#/reporte-diario",
        tone: "rhove",
        image: `${PRO_ASSET}/icons/extras/futuristic_healthcare_network_hub_icon.webp`
      }
    ];
  }

  function renderCommandMetrics(stats, date) {
    const epi = commandEpiCounts(date);
    const compliance = stats.totalPatients ? Math.round((stats.reviewedPatients / stats.totalPatients) * 100) : 0;
    const metrics = [
      { label: "Pacientes en vigilancia", value: stats.totalPatients, note: `${stats.installedToday} alta(s) operativas hoy`, tone: "blue" },
      { label: "IAAS activas", value: epi.iaas, note: `${epi.riesgo} en riesgo`, tone: "pink" },
      { label: "Pendientes críticos", value: stats.activeAlerts + stats.incompletePatients, note: "Requieren atención", tone: "rose" },
      { label: "Días dispositivo hoy", value: stats.totalDeviceDays, note: "Total", tone: "cyan" },
      { label: "Cumplimiento paquetes", value: `${compliance}%`, note: "Global", tone: "violet", ring: compliance }
    ];
    return h("section", { class: "command-metric-row" }, metrics.map(metric =>
      h("article", { class: `command-metric-card ${metric.tone}` }, [
        metric.ring !== undefined ? h("span", { class: "command-ring", style: `--score:${metric.ring}%` }, [h("b", {}, [String(metric.value)])]) : h("i", {}, []),
        h("div", {}, [
          h("span", {}, [metric.label]),
          metric.ring === undefined ? h("strong", {}, [String(metric.value)]) : "",
          h("small", {}, [metric.note])
        ])
      ])
    ));
  }

  function renderCommandCalendar(date) {
    const days = commandCalendarDays(date);
    const events = commandCalendarEvents(date);
    return h("article", { class: "command-panel command-calendar" }, [
      h("div", { class: "command-panel-head" }, [
        h("h2", {}, ["Calendario epidemiológico"]),
        h("div", { class: "command-calendar-controls" }, [
          h("button", {}, [commandIcon("chevron-left")]),
          h("button", {}, [commandIcon("chevron-right")]),
          h("button", {}, ["Hoy"]),
          h("span", {}, [new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00`))]),
          h("button", { class: "active" }, ["Semana"])
        ])
      ]),
      h("div", { class: "command-calendar-grid" }, [
        h("span", { class: "time-col" }, [""]),
        ...days.map(day => h("strong", { class: day.today ? "today" : "" }, [day.label])),
        ...["08:00", "10:00", "12:00"].flatMap(time => [
          h("span", { class: "time-col" }, [time]),
          ...days.map((day, index) => {
            const event = events.find(item => item.day === index && item.time === time);
            return h("div", { class: "calendar-slot" }, event ? [
              h("span", { class: `calendar-event ${event.tone}` }, [event.label, h("small", {}, [event.time])])
            ] : []);
          })
        ])
      ])
    ]);
  }

  function renderCommandNotifications(stats, date) {
    const items = commandNotifications(stats, date);
    return h("article", { class: "command-panel command-notifications" }, [
      h("div", { class: "command-panel-head" }, [
        h("h2", {}, ["Notificaciones recientes"]),
        h("a", { href: "#/seguimiento-iaas" }, ["Ver todas"])
      ]),
      h("div", { class: "notification-list" }, items.map(item =>
        h("a", { class: `notification-row ${item.tone}`, href: item.href }, [
          h("i", {}, [commandIcon(item.icon)]),
          h("div", {}, [
            h("strong", {}, [item.title]),
            h("span", {}, [item.detail])
          ]),
          h("time", {}, [item.time])
        ])
      ))
    ]);
  }

  function renderCommandQuickActions(date) {
    const actions = [
      ["Iniciar ronda", `#/ronda/${date}`],
      ["Registrar IAAS", "#/seguimiento-iaas"],
      ["Registrar cultivo", "#/seguimiento-iaas"],
      ["Buscar paciente", "#/censo-hospitalario"],
      ["Generar reporte", "#/reporte-diario"]
    ];
    return h("article", { class: "command-panel command-quick" }, [
      h("div", { class: "command-panel-head" }, [h("h2", {}, ["Acciones rápidas"])]),
      h("div", { class: "quick-action-list" }, actions.map(([label, href]) =>
        h("a", { href }, [h("span", {}, [label]), h("b", {}, [commandIcon("chevron-right")])])
      ))
    ]);
  }

  function commandEpiCounts(date) {
    return getCensusRows(date).reduce((out, row) => {
      const patient = store.patients[row.patientId] || {};
      const cls = epiClass([patient.epidemiologicalDiagnosis, patient.currentEpidemiologicalDiagnosis, row.epidemiologicalDiagnosis].filter(Boolean).join(" "));
      if (cls === "epi-iaas") out.iaas += 1;
      if (cls === "epi-riesgo-iaas") out.riesgo += 1;
      if (cls === "epi-vig") out.vig += 1;
      return out;
    }, { iaas: 0, riesgo: 0, vig: 0 });
  }

  function commandNotifications(stats, date) {
    const briefing = salaBriefingData(stats, date);
    return [
      {
        title: stats.alertPatients[0] ? `${stats.alertPatients[0].reason} en ${stats.alertPatients[0].currentService || "servicio"}` : "Sin alertas críticas nuevas",
        detail: stats.alertPatients[0] ? patientLabel(stats.alertPatients[0]) : "Vigilancia sin casos críticos activos",
        time: "08:24",
        icon: "alert",
        tone: "critical",
        href: "#/seguimiento-iaas"
      },
      {
        title: briefing.cultureEvents[0] ? "Cultivo o PCR pendiente" : "Cultivos sin pendientes visibles",
        detail: briefing.cultureEvents[0]?.meta || "Sin eventos microbiológicos detectados",
        time: "07:58",
        icon: "flask",
        tone: "culture",
        href: "#/seguimiento-iaas"
      },
      {
        title: "Ronda por completar",
        detail: `${stats.pendingPatients} paciente(s) pendientes`,
        time: "07:12",
        icon: "check",
        tone: "round",
        href: `#/ronda/${date}`
      },
      {
        title: "Reporte RHOVE pendiente",
        detail: "Semana epidemiológica en revisión",
        time: "06:45",
        icon: "info",
        tone: "rhove",
        href: "#/reporte-diario"
      }
    ];
  }

  function commandCalendarDays(date) {
    const selected = new Date(`${date}T00:00:00`);
    const day = selected.getDay() || 7;
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - day + 1);
    const fmt = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric" });
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      return {
        label: fmt.format(d).replace(".", ""),
        today: toIsoDate(d) === date
      };
    });
  }

  function commandCalendarEvents(date) {
    return [
      { day: 0, time: "08:00", label: "Ronda UCI A", tone: "blue" },
      { day: 1, time: "10:00", label: "Vigilancia", tone: "violet" },
      { day: 2, time: "11:00", label: "Comité IAAS", tone: "pink" },
      { day: 4, time: "12:00", label: "Reporte RHOVE", tone: "pink" },
      { day: 5, time: "09:00", label: "Ronda UCI C", tone: "violet" },
      { day: 5, time: "11:00", label: "Revisión cultivos", tone: "cyan" }
    ];
  }

  function commandIcon(name) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "command-svg");
    const paths = {
      calendar: ['<path d="M8 2v4M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/>'],
      cloud: ['<path d="M17 18a4 4 0 0 0 .4-8A6 6 0 0 0 6.2 8.5 4.5 4.5 0 0 0 7 18h10Z"/><path d="M12 12v7M8.5 15.5 12 12l3.5 3.5"/>'],
      print: ['<path d="M7 8V3h10v5"/><path d="M7 17H5a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-2"/><path d="M7 14h10v7H7z"/>'],
      logout: ['<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18h-7"/>'],
      "chevron-left": ['<path d="m15 18-6-6 6-6"/>'],
      "chevron-right": ['<path d="m9 18 6-6-6-6"/>'],
      shield: ['<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>'],
      alert: ['<path d="m10.3 3.4-8.2 14A2 2 0 0 0 3.8 20h16.4a2 2 0 0 0 1.7-2.6l-8.2-14a2 2 0 0 0-3.4 0Z"/><path d="M12 8v5M12 17h.01"/>'],
      flask: ['<path d="M9 2h6"/><path d="M10 2v6L5 19a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 19L14 8V2"/><path d="M7 16h10"/>'],
      check: ['<path d="M20 6 9 17l-5-5"/>'],
      info: ['<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>']
    };
    svg.innerHTML = paths[name]?.join("") || paths.info[0];
    return svg;
  }

  function dashboardModules(stats, date) {
    const pendingSync = pendingQueue().length;
    return [
      {
        title: "Centro de Vigilancia",
        text: `${dayLabel(new Date())}. ${stats.pendingPatients} pendientes, ${stats.activeAlerts} alertas y ${pendingSync} escritura(s) por sincronizar.`,
        href: "#/dashboard",
        action: "Ver sala",
        image: `${PRO_ASSET}/icons/extras/neon_glassy_ui_notification_panel.webp`,
        backdrop: `${PRO_ASSET}/backgrounds/hero-holographic-epidemiology-dashboard.webp`,
        tone: "vigilancia",
        meta: ["Calendario", "Notificaciones", "Eventos"]
      },
      {
        title: "Paquetes Preventivos",
        text: "Vigilancia activa cotidiana para CVC, catéter urinario, ventilación mecánica e ISQ.",
        href: `#/ronda/${date}`,
        action: "Iniciar revisión",
        image: `${PRO_ASSET}/icons/icon-seguridad.webp`,
        backdrop: `${PRO_ASSET}/backgrounds/extra-biomedical-holographic-interface.webp`,
        tone: "paquetes",
        meta: ["CVC", "CU", "NAV", "ISQ"]
      },
      {
        title: "Seguimiento IAAS",
        text: `${stats.activeAlerts} paciente(s) con alerta o invasivo relevante para seguimiento dirigido.`,
        href: "#/seguimiento-iaas",
        action: "Abrir seguimiento",
        image: `${PRO_ASSET}/icons/icon-iaas.webp`,
        backdrop: `${PRO_ASSET}/backgrounds/extra-network-interface-concept.webp`,
        tone: "seguimiento",
        meta: ["Casos", "Cultivos", "Cierre"]
      },
      {
        title: "Vigilancia Hospitalaria",
        text: `${stats.totalPatients} paciente(s) en censo de hoy y ${Object.keys(stats.byService).length} servicio(s) activos.`,
        href: "#/censo-hospitalario",
        action: "Ver censo",
        image: `${PRO_ASSET}/icons/icon-censo-operativo.webp`,
        backdrop: `${PRO_ASSET}/backgrounds/extra-medical-hud-dashboard.webp`,
        tone: "hospitalaria",
        meta: ["Servicios", "Camas", "Estados"]
      },
      {
        title: "Analítica Epidemiológica",
        text: `${stats.patientDays} paciente-día y ${stats.totalDeviceDays} dispositivo-día listos para análisis.`,
        href: "#/reporte-diario",
        action: "Ver indicadores",
        image: `${PRO_ASSET}/icons/icon-reporte.webp`,
        backdrop: `${PRO_ASSET}/backgrounds/extra-holographic-dashboard-light.webp`,
        tone: "analitica",
        meta: ["Gráficos", "Tasas", "Tendencias"]
      },
      {
        title: "Base de Datos",
        text: "Importación masiva de censo matutino, respaldo JSON y conciliación sin duplicados.",
        href: "#/importar-censo",
        action: "Importar censo",
        image: `${PRO_ASSET}/icons/icon-cloud-sync.webp`,
        backdrop: `${PRO_ASSET}/backgrounds/extras-futuristic_tech_interface_with_glow_elements.webp`,
        tone: "base",
        meta: ["Excel", "CSV", "Firestore"]
      }
    ];
  }

  function renderDashboardCarousel(slides, activeSlide) {
    const slide = slides[activeSlide];
    return h("section", {
      class: "sala-carousel",
      "aria-label": "Módulos principales de EpiVida IAAS",
      onmouseenter: () => { ui.dashboardSlidePausedUntil = Date.now() + 10000; },
      ontouchstart: () => { ui.dashboardSlidePausedUntil = Date.now() + 10000; }
    }, [
      h("button", { class: "carousel-arrow prev", type: "button", onclick: () => setDashboardSlide(activeSlide - 1) }, ["‹"]),
      h("article", { class: "sala-slide" }, [
        h("div", { class: "sala-slide-media" }, [
          h("img", { src: slide.image, alt: "", loading: "lazy" })
        ]),
        h("div", { class: "sala-slide-copy" }, [
          h("div", { class: "sala-slide-meta" }, slide.meta.map(item => h("span", {}, [item]))),
          h("h2", {}, [slide.title]),
          h("p", {}, [slide.text]),
          h("a", { class: "iaas-button primary", href: slide.href }, [slide.action])
        ])
      ]),
      h("button", { class: "carousel-arrow next", type: "button", onclick: () => setDashboardSlide(activeSlide + 1) }, ["›"]),
      h("div", { class: "carousel-dots" }, slides.map((_, index) =>
        h("button", {
          class: index === activeSlide ? "active" : "",
          type: "button",
          "aria-label": `Ver módulo ${index + 1}`,
          onclick: () => setDashboardSlide(index)
        }, [])
      ))
    ]);
  }

  function setDashboardSlide(index) {
    ui.dashboardSlide = index;
    ui.dashboardSlidePausedUntil = Date.now() + 10000;
    renderIaas();
  }

  function renderSalaBriefing(stats, date) {
    const briefing = salaBriefingData(stats, date);
    return h("section", { class: "sala-briefing-grid" }, [
      h("article", { class: "iaas-panel sala-info-card" }, [
        h("span", { class: "sala-kicker" }, ["Información relevante"]),
        h("h2", {}, ["Pulso epidemiológico del día"]),
        h("p", {}, [`${briefing.day}. Censo con ${stats.totalPatients} pacientes, ${stats.activeDevices} invasivos activos y ${stats.activeAlerts} alerta(s) para seguimiento dirigido.`]),
        h("div", { class: "sala-info-strip" }, [
          h("span", {}, ["Sincronización"]),
          renderSyncState(),
          h("span", {}, [`${pendingQueue().length} pendiente(s)`])
        ]),
        h("div", { class: "sala-action-row" }, [
          h("a", { class: "iaas-button primary", href: `#/ronda/${date}` }, ["Iniciar paquetes preventivos"]),
          h("a", { class: "iaas-button", href: "#/seguimiento-iaas" }, ["Abrir seguimiento"])
        ])
      ]),
      h("article", { class: "iaas-panel sala-priority-card" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("h2", {}, ["Pendientes prioritarios"]),
          h("span", { class: "badge pendiente" }, [`${stats.pendingPatients} pendiente(s)`])
        ]),
        renderSalaSignalList(briefing.pendingPatients, "Sin pacientes pendientes en la ronda.")
      ]),
      h("article", { class: "iaas-panel sala-events-card" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("h2", {}, ["Cultivos, PCR y eventos"]),
          h("span", { class: "badge neutral" }, [`${briefing.cultureEvents.length} evento(s)`])
        ]),
        renderSalaSignalList(briefing.cultureEvents, "Sin cultivos, PCR o eventos detectados en el censo visible.")
      ]),
      h("article", { class: "iaas-panel sala-prevention-card" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("h2", {}, ["Paquetes preventivos"]),
          h("a", { href: `#/ronda/${date}` }, ["Revisar por cama"])
        ]),
        h("div", { class: "sala-package-grid" }, [
          salaPackage("CVC", stats.deviceDaysByType.CVC || 0, "Curación, antisepsia y fecha"),
          salaPackage("Catéter urinario", stats.deviceDaysByType["Sonda Foley"] || 0, "Necesidad diaria y bolsa"),
          salaPackage("Ventilación mecánica", stats.deviceDaysByType["Ventilación mecánica"] || 0, "NAV, higiene y destete"),
          salaPackage("ISQ", briefing.surgicalSignals, "Herida, profilaxis y datos clínicos")
        ])
      ]),
      h("article", { class: "iaas-panel sala-map-card" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("h2", {}, ["Mapa operativo"]),
          h("a", { href: "#/censo-hospitalario" }, ["Ver servicios"])
        ]),
        renderServicePulse(briefing.servicePulse)
      ]),
      h("article", { class: "iaas-panel sala-device-card" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("h2", {}, ["Invasivos activos"]),
          h("a", { href: "#/reporte-diario" }, ["Ver indicadores"])
        ]),
        renderBars(stats.activeByType)
      ]),
      h("article", { class: "iaas-panel sala-close-card" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("h2", {}, ["Cierre de ronda"]),
          h("button", { class: "iaas-button compact", onclick: () => closeRound(date) }, ["Cerrar ronda"])
        ]),
        renderRoundCloseChecklist(date)
      ])
    ]);
  }

  function salaBriefingData(stats, date) {
    const round = store.dailyRounds[date] || {};
    const rows = getCensusRows(date);
    const joinedRows = rows.map(row => ({ row, patient: store.patients[row.patientId] || {}, entry: round.entries?.[row.patientId] || {} }));
    const pendingPatients = joinedRows
      .filter(item => (item.entry.status || "pendiente") === "pendiente")
      .slice(0, 5)
      .map(item => ({
        title: patientLabel(item.patient, item.row),
        meta: `${item.row.service || item.patient.currentService || "Sin servicio"} · Cama ${item.row.bed || item.patient.currentBed || "S/C"}`,
        detail: truncateText(item.patient.currentDiagnosis || item.row.currentDiagnosis || "Pendiente de valoración", 96),
        href: `#/ronda/${date}/paciente/${item.row.patientId}`,
        tone: "pending"
      }));
    const culturePattern = /cultivo|hemocultivo|pcr|secreci[oó]n|bacter|bacillus|pseudomona|staph|candida|resultado|laboratorio/i;
    const cultureEvents = joinedRows
      .filter(item => culturePattern.test([
        item.patient.currentDiagnosis,
        item.patient.currentEpidemiologicalDiagnosis,
        item.patient.activePendingIssues?.join(" "),
        item.row.notes,
        item.row.pendingIssues
      ].filter(Boolean).join(" ")))
      .slice(0, 5)
      .map(item => ({
        title: patientLabel(item.patient, item.row),
        meta: `${item.row.service || "Sin servicio"} · Cama ${item.row.bed || "S/C"}`,
        detail: truncateText([item.patient.currentDiagnosis, item.patient.activePendingIssues?.join(" / "), item.row.notes].filter(Boolean).join(" / "), 110),
        href: `#/pacientes/${item.row.patientId}/seguimiento`,
        tone: "event"
      }));
    const surgicalSignals = joinedRows.filter(item => /quir[uú]rg|cirug|herida|isq|post ?op|lape|colec|fractura|tumor/i.test([
      item.patient.currentService,
      item.patient.currentDiagnosis,
      item.patient.activePendingIssues?.join(" ")
    ].filter(Boolean).join(" "))).length;
    const servicePulse = Object.entries(stats.byService)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 7)
      .map(([service, value]) => ({
        service,
        total: value.total,
        reviewed: value.reviewed,
        devices: value.devices,
        progress: value.total ? Math.round((value.reviewed / value.total) * 100) : 0
      }));
    return {
      day: dayLabel(new Date()),
      pendingPatients,
      cultureEvents,
      surgicalSignals,
      servicePulse
    };
  }

  function renderSalaSignalList(items, empty) {
    if (!items.length) return h("p", { class: "muted" }, [empty]);
    return h("div", { class: "sala-signal-list" }, items.map(item =>
      h("a", { class: `sala-signal ${item.tone || ""}`, href: item.href || "#/dashboard" }, [
        h("strong", {}, [item.title]),
        h("span", {}, [item.meta]),
        h("small", {}, [item.detail])
      ])
    ));
  }

  function salaPackage(label, value, detail) {
    return h("div", { class: "sala-package" }, [
      h("strong", {}, [String(value)]),
      h("span", {}, [label]),
      h("small", {}, [detail])
    ]);
  }

  function renderServicePulse(rows) {
    if (!rows.length) return h("p", { class: "muted" }, ["Sin servicios activos."]);
    return h("div", { class: "service-pulse-list" }, rows.map(item =>
      h("div", { class: "service-pulse" }, [
        h("div", {}, [
          h("strong", {}, [item.service]),
          h("span", {}, [`${item.total} paciente(s) · ${item.devices} invasivo(s)`])
        ]),
        h("div", { class: "service-pulse-track" }, [
          h("i", { style: `width:${Math.max(4, item.progress)}%` })
        ]),
        h("small", {}, [`${item.progress}% revisado`])
      ])
    ));
  }

  function renderIaasFollowUpHub() {
    const date = activeDate();
    const stats = computeStats(date);
    const patients = Object.values(store.patients)
      .filter(patient =>
        patient.latestRoundStatus === "alerta" ||
        patient.hospitalizationStatus === "requiere_conciliación" ||
        activeEpisodes(patient.patientId, date).length
      )
      .slice(0, 12);
    return h("div", { class: "iaas-page follow-up-hub" }, [
      h("section", { class: "iaas-panel follow-hero" }, [
        h("div", {}, [
          h("h1", {}, ["Seguimiento IAAS"]),
          h("p", {}, ["Vista puente para pacientes con invasivos, alertas, cultivos o conciliación pendiente. En esta fase conserva la lógica actual y prepara el terreno para vigilancia activa diaria."])
        ]),
        h("img", { src: `${PRO_ASSET}/icons/extras/futuristic_microscope_with_virus_and_heartbeat.webp`, alt: "", loading: "lazy" })
      ]),
      renderMetricGrid([
        ["Alertas IAAS", stats.activeAlerts, "Seguimiento dirigido"],
        ["Invasivos activos", stats.activeDevices, "Episodios vigentes"],
        ["Pendientes", stats.pendingPatients, "Ronda del día"],
        ["Conciliación", stats.reconciliationPatients, "Censo hospitalario"]
      ], "compact"),
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("div", {}, [
            h("h2", {}, ["Pacientes para seguimiento"]),
            h("p", {}, ["Prioriza invasivos activos, alertas y registros que requieren conciliación."])
          ]),
          h("a", { href: "#/censo-hospitalario" }, ["Ver vigilancia hospitalaria"])
        ]),
        patients.length
          ? renderPatientMiniTable(patients, "Sin pacientes priorizados.")
          : h("p", { class: "muted" }, ["Sin pacientes priorizados para seguimiento IAAS en este momento."])
      ])
    ]);
  }

  function renderHospitalCensusPage() {
    const date = activeDate();
    const rows = hospitalCensusRows(date).sort((a, b) => sortByServiceBed(a.row, b.row));
    const visibleRows = rows.filter(censusServiceMatch).filter(censusSearchMatch);
    const stats = computeStats(date);
    const epiTotals = censusEpiCounts(rows);
    return h("div", { class: "iaas-page hospital-census-page" }, [
      h("section", { class: "iaas-panel census-hero-panel" }, [
        h("div", { class: "census-hero-copy" }, [
          h("img", { src: `${PRO_ASSET}/icons/icon-censo-operativo.webp`, alt: "", loading: "lazy" }),
          h("div", {}, [
            h("h1", {}, ["Vigilancia Hospitalaria"]),
            h("p", {}, ["Mesa visual de vigilancia epidemiológica: servicios, camas, estado clínico, diagnóstico hospitalario y clasificación epidemiológica en una sola lectura operativa."])
          ])
        ]),
        h("div", { class: "census-hero-meta" }, [
          h("strong", {}, [dayLabel(new Date())]),
          h("span", {}, [`${rows.length} pacientes en censo · ${activeServiceCount(rows)} servicios activos`]),
          h("div", { class: "report-actions" }, [
            hasPrivateCensusSeed() ? h("button", { class: "iaas-button", onclick: restorePrivateCensus }, ["Restaurar censo local"]) : "",
            h("a", { class: "iaas-button", href: "#/importar-censo" }, ["Importar censo"]),
            h("button", { class: "iaas-button primary", onclick: () => window.print() }, ["Imprimir censo"])
          ])
        ])
      ]),
      renderMetricGrid([
        ["Pacientes", rows.length, "censo visible"],
        ["IAAS", epiTotals.iaas, "activos/importados"],
        ["Riesgo IAAS", epiTotals.riesgo, "vigilancia"],
        ["VIG", epiTotals.vig, "seguimiento"],
        ["No IAAS", epiTotals.noIaas, "sin IAAS"],
        ["Invasivos", stats.activeDevices, "activos"]
      ], "compact"),
      rows.length ? renderCensusCommandPanel(rows, visibleRows, stats) : "",
      rows.length ? renderCensusServiceAtlas(rows) : "",
      rows.length ? h("section", { class: "iaas-panel census-table-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("div", {}, [
            h("h2", {}, ["Listado operativo"]),
            h("p", {}, ["Seguimiento integral ordenado por servicio y cama, con busqueda directa para entrega de turno."])
          ]),
          h("div", { class: "census-tools" }, [
            h("label", { class: "census-search" }, [
              h("span", {}, ["Buscar"]),
              h("input", {
                id: "census-search",
                type: "search",
                value: ui.censusQuery,
                placeholder: "Paciente, cama, servicio, diagnostico...",
                oninput: event => {
                  ui.censusQuery = event.target.value;
                  ui.focusTarget = "census-search";
                  renderIaas();
                }
              })
            ]),
            h("span", { class: "badge neutral" }, [`${visibleRows.length} de ${rows.length}`])
          ])
        ]),
        visibleRows.length ? h("div", { class: "table-wrap census-scroll" }, [
          h("table", { class: "iaas-table hospital-census-table" }, [
            h("thead", {}, [h("tr", {}, ["Servicio / cama", "Paciente", "Edad / sexo", "Ingreso / estancia", "Estado", "Dx hospitalarios", "Dx epidemiologico", "Observaciones"].map(label => h("th", {}, [label])))]),
            h("tbody", {}, visibleRows.map(renderHospitalCensusRow))
          ])
        ]) : h("div", { class: "empty-inline" }, [
          h("strong", {}, ["Sin coincidencias"]),
          h("span", {}, ["Ajusta la busqueda o cambia de servicio."])
        ])
      ]) : h("section", { class: "iaas-panel empty-census-panel" }, [
        h("h2", {}, ["Aun no hay censo cargado"]),
        h("p", {}, ["Importa el censo de la manana o carga el respaldo privado local para restaurar el trabajo anterior sin publicar datos clinicos en GitHub."]),
        hasPrivateCensusSeed() ? h("button", { class: "iaas-button", onclick: restorePrivateCensus }, ["Restaurar censo local"]) : "",
        h("a", { class: "iaas-button primary", href: "#/importar-censo" }, ["Importar censo"])
      ])
    ]);
  }

  function hospitalCensusRows(date) {
    return getCensusRows(date).map(row => ({ row, patient: store.patients[row.patientId] || {} }));
  }

  function renderCensusCommandPanel(rows, visibleRows, stats) {
    const serviceRows = ui.censusService === "Todos" ? rows : rows.filter(censusServiceMatch);
    const focusService = ui.censusService === "Todos" ? "Hospital completo" : ui.censusService;
    const focusImage = ui.censusService === "Todos"
      ? `${PRO_ASSET}/icons/extras/futuristic_microscope_with_virus_and_heartbeat.webp`
      : serviceArtAsset(ui.censusService);
    const epi = censusEpiCounts(serviceRows);
    return h("section", { class: "census-command" }, [
      h("article", { class: "command-visual" }, [
        h("div", { class: "command-copy" }, [
          h("span", {}, ["Vista activa"]),
          h("h2", {}, [focusService]),
          h("p", {}, [`${serviceRows.length} paciente${serviceRows.length === 1 ? "" : "s"} en seguimiento. ${visibleRows.length} registro${visibleRows.length === 1 ? "" : "s"} coincide${visibleRows.length === 1 ? "" : "n"} con los filtros actuales.`]),
          h("div", { class: "command-mini-stats" }, [
            h("strong", {}, [`${epi.iaas} IAAS`]),
            h("strong", {}, [`${epi.riesgo} riesgo`]),
            h("strong", {}, [`${epi.vig} VIG`])
          ])
        ]),
        h("img", { src: focusImage, alt: "", loading: "lazy" })
      ]),
      h("article", { class: "epi-board" }, [
        renderEpiVisual("IAAS", epi.iaas, "Infecciones asociadas", `${PRO_ASSET}/badges/badge-iaas.webp`),
        renderEpiVisual("Riesgo IAAS", epi.riesgo, "Vigilancia prioritaria", `${PRO_ASSET}/badges/badge-riesgo.webp`),
        renderEpiVisual("VIG", epi.vig, "Transmisible / no transmisible", `${PRO_ASSET}/badges/badge-vig.webp`),
        renderEpiVisual("No IAAS", epi.noIaas, "Sin IAAS activa", `${PRO_ASSET}/badges/badge-estable.webp`)
      ])
    ]);
  }

  function renderEpiVisual(label, value, caption, src) {
    return h("div", { class: "epi-visual" }, [
      h("img", { src, alt: "", loading: "lazy" }),
      h("div", {}, [
        h("strong", {}, [String(value)]),
        h("span", {}, [label]),
        h("small", {}, [caption])
      ])
    ]);
  }

  function renderHospitalCensusRow(item) {
    const { row, patient } = item;
    const admission = patient.admissionDate || row.admissionDate || null;
    const stay = daysBetween(admission, row.roundDate || isoToday());
    const state = displayState(patient.currentState || row.state || patient.currentRiskLevel || "Sin estado");
    const service = row.service || patient.currentService || "Sin servicio";
    const epi = patient.epidemiologicalDiagnosis || row.epidemiologicalDiagnosis || "Sin clasificar";
    return h("tr", { class: `census-row ${stateClass(state)} ${epiClass(epi)}` }, [
      h("td", { class: "service-census-cell", "data-label": "Servicio / cama" }, [
        h("div", { class: "service-census-layout" }, [
          h("img", { src: serviceIconAsset(service), alt: "", loading: "lazy" }),
          h("div", {}, [
            h("strong", {}, [service]),
            h("small", {}, [`Cama ${row.bed || patient.currentBed || "S/C"}`])
          ])
        ])
      ]),
      h("td", { class: "patient-census-cell", "data-label": "Paciente" }, [h("strong", {}, [patientLabel(patient, row)]), h("small", {}, [patientCensusMeta(patient, row)])]),
      h("td", { "data-label": "Edad / sexo" }, [`${patient.age ?? row.age ?? "S/E"} / ${patient.sex || row.sex || "S/S"}`]),
      h("td", { "data-label": "Ingreso / estancia" }, [h("strong", {}, [admission || "AMB"]), h("small", {}, [stay === null || stay === undefined ? "Ambulatorio" : `${stay} ${stay === 1 ? "dia" : "dias"}`])]),
      h("td", { "data-label": "Estado" }, [h("span", { class: `badge ${stateClass(state)}` }, [state])]),
      h("td", { "data-label": "Dx hospitalarios" }, [truncateText(patient.currentDiagnosis || row.diagnosis || "Sin diagnostico", 170)]),
      h("td", { "data-label": "Dx epidemiologico" }, [h("span", { class: `badge ${epiClass(epi)}` }, [truncateText(epi, 70)])]),
      h("td", { "data-label": "Observaciones" }, [truncateText(patient.observations || row.observations || row.notes || "", 130)])
    ]);
  }

  function renderCensusServiceAtlas(rows) {
    const totals = new Map();
    rows.forEach(({ row, patient }) => {
      const service = normalizeService(row.service || patient.currentService || "");
      totals.set(service, (totals.get(service) || 0) + 1);
    });
    const activeRows = ui.censusService === "Todos" ? rows : rows.filter(censusServiceMatch);
    return h("section", { class: "service-atlas" }, [
      h("button", { class: ui.censusService === "Todos" ? "active service-all" : "service-all", onclick: () => { ui.censusService = "Todos"; renderIaas(); } }, [
        h("img", { src: `${PRO_ASSET}/icons/extras/futuristic_medical_dashboard_with_hospital_bed.webp`, alt: "", loading: "lazy" }),
        h("strong", {}, ["Vista general"]),
        h("span", {}, [`${rows.length} pacientes`])
      ]),
      ...SERVICES.map(service => {
        const total = totals.get(service) || 0;
        return h("button", {
          class: `${ui.censusService === service ? "active" : ""} ${total ? "" : "empty"}`,
          onclick: () => { ui.censusService = service; renderIaas(); }
        }, [
          h("img", { src: serviceArtAsset(service), alt: "", loading: "lazy" }),
          h("strong", {}, [service]),
          h("span", {}, [`${total} paciente${total === 1 ? "" : "s"}`])
        ]);
      }),
      h("div", { class: "service-atlas-summary" }, [
        h("strong", {}, [`${activeRows.length}`]),
        h("span", {}, [ui.censusService === "Todos" ? "registros visibles" : ui.censusService])
      ])
    ]);
  }

  function censusServiceMatch(item) {
    if (ui.censusService === "Todos") return true;
    return normalizeText(item.row.service || item.patient.currentService) === normalizeText(ui.censusService);
  }

  function censusSearchMatch(item) {
    const query = normalizeText(ui.censusQuery);
    if (!query) return true;
    const { row, patient } = item;
    return [
      row.service,
      row.bed,
      row.patientName,
      row.patientId,
      row.diagnosis,
      row.epidemiologicalDiagnosis,
      row.observations,
      patient.patientName,
      patient.displayCode,
      patient.currentService,
      patient.currentBed,
      patient.currentDiagnosis,
      patient.epidemiologicalDiagnosis,
      patient.observations
    ].some(value => normalizeText(value).includes(query));
  }

  function activeServiceCount(rows) {
    return new Set(rows.map(({ row, patient }) => normalizeService(row.service || patient.currentService || "")).filter(Boolean)).size;
  }

  function censusEpiCounts(rows) {
    return rows.reduce((out, { row, patient }) => {
      const value = patient.epidemiologicalDiagnosis || row.epidemiologicalDiagnosis || "";
      const cls = epiClass(value);
      if (cls === "epi-iaas") out.iaas += 1;
      if (cls === "epi-riesgo-iaas") out.riesgo += 1;
      if (cls === "epi-vig") out.vig += 1;
      if (cls === "epi-no-iaas") out.noIaas += 1;
      if (cls === "epi-covid") out.covid += 1;
      return out;
    }, { iaas: 0, riesgo: 0, vig: 0, noIaas: 0, covid: 0 });
  }

  function renderImportPage() {
    const draft = ui.importDraft;
    return h("div", { class: "iaas-page import-page" }, [
      h("section", { class: "iaas-panel import-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("div", {}, [
            h("h1", {}, ["Base de Datos"]),
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
          h("h1", {}, ["Paquetes Preventivos"]),
          h("p", {}, ["Ronda móvil por cama orientada a paquetes preventivos: CVC, catéter urinario, ventilación mecánica e infección de sitio quirúrgico."])
        ]),
        h("div", { class: "round-actions" }, [
          h("button", { class: "iaas-button primary", onclick: () => startRound(date) }, [round.status === "not_started" ? "Iniciar ronda" : "Ronda en curso"]),
          h("button", { class: "iaas-button", onclick: () => closeRound(date) }, ["Cerrar ronda"])
        ])
      ]),
      renderPreventivePackagePanel(stats, rows, date),
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
      renderRoundWorklistSummary(rows, filtered, stats, date),
      h("section", { class: "round-list" }, filtered.map(row => renderRoundCard(row, date)))
    ]);
  }

  function renderPreventivePackagePanel(stats, rows, date) {
    const packages = preventivePackageData(stats, rows, date);
    return h("section", { class: "preventive-command" }, [
      h("article", { class: "preventive-command-hero" }, [
        h("span", {}, ["Guía de revisión"]),
        h("h2", {}, ["Ronda enfocada, menos escritura repetida"]),
        h("p", {}, ["Selecciona un servicio, revisa cama por cama y captura solo eventos clínico-operativos: invasivos activos, reinstalaciones, retiro, curación, cuidado y signos de infección."])
      ]),
      h("div", { class: "preventive-package-grid" }, packages.map(item =>
        h("article", { class: `preventive-package ${item.tone}` }, [
          h("img", { src: item.icon, alt: "", loading: "lazy" }),
          h("div", {}, [
            h("strong", {}, [String(item.count)]),
            h("span", {}, [item.title]),
            h("small", {}, [item.detail])
          ]),
          h("em", {}, [item.action])
        ])
      ))
    ]);
  }

  function preventivePackageData(stats, rows, date) {
    const vmCount = (stats.deviceDaysByType["Ventilación mecánica"] || 0) + (stats.deviceDaysByType["Tubo endotraqueal"] || 0) + (stats.deviceDaysByType.Traqueostomía || 0);
    const surgicalCount = rows.filter(row => isSurgicalSignal(store.patients[row.patientId] || {}, row)).length;
    return [
      {
        title: "CVC",
        count: stats.deviceDaysByType.CVC || 0,
        detail: "Fecha, sitio, curación y datos locales de infección.",
        action: "Prioridad si >48 h",
        tone: "cvc",
        icon: `${PRO_ASSET}/icons/extras/futuristic_security_and_medical_protection_icon.webp`
      },
      {
        title: "Catéter urinario",
        count: stats.deviceDaysByType["Sonda Foley"] || 0,
        detail: "Necesidad diaria, fijación, circuito y bolsa colectora.",
        action: "Retirar si no amerita",
        tone: "foley",
        icon: `${PRO_ASSET}/icons/extras/futuristic_healthcare_security_concept_design.webp`
      },
      {
        title: "Ventilación mecánica",
        count: vmCount,
        detail: "NAV: higiene oral, cabecera, sedación, aspiración y destete.",
        action: "Vigilar NAV",
        tone: "nav",
        icon: `${PRO_ASSET}/icons/extras/neon_lungs_with_virus_and_heartbeat.webp`
      },
      {
        title: "ISQ",
        count: surgicalCount,
        detail: "Herida, profilaxis, fiebre, cultivo y datos de infección.",
        action: "Seguimiento quirúrgico",
        tone: "isq",
        icon: `${PRO_ASSET}/icons/extras/futuristic_microscope_with_virus_and_heartbeat.webp`
      }
    ];
  }

  function renderRoundWorklistSummary(rows, filtered, stats, date) {
    const selected = ui.selectedService;
    const reviewed = filtered.filter(row => ["revisado", "alerta"].includes(store.dailyRounds[date]?.entries[row.patientId]?.status)).length;
    const devices = filtered.reduce((sum, row) => sum + activeEpisodes(row.patientId, date).length, 0);
    return h("section", { class: "round-worklist-summary" }, [
      h("div", {}, [
        h("span", {}, ["Lista de trabajo"]),
        h("strong", {}, [selected === "Todos" ? "Todos los servicios" : selected]),
        h("small", {}, [`${filtered.length} de ${rows.length} cama(s) visibles · ${reviewed} revisada(s) · ${devices} invasivo(s)`])
      ]),
      h("div", { class: "round-worklist-progress" }, [
        h("i", { style: `width:${Math.max(4, stats.totalPatients ? (stats.reviewedPatients / stats.totalPatients) * 100 : 4)}%` })
      ])
    ]);
  }

  function renderRoundCard(row, date) {
    const patient = store.patients[row.patientId];
    const entry = store.dailyRounds[date]?.entries[row.patientId] || {};
    const devices = activeEpisodes(row.patientId, date);
    const packageSignals = packageSignalsForPatient(patient || {}, row, devices);
    return h("article", { class: `round-card status-${entry.status || "pendiente"}` }, [
      h("div", { class: "round-card-main" }, [
        h("div", { class: "bed-badge" }, [row.bed || "S/C"]),
        h("div", {}, [
          h("strong", {}, [patientLabel(patient, row)]),
          h("span", {}, [row.service]),
          h("small", {}, [truncateText(patient?.currentDiagnosis || "Sin diagnóstico registrado", 110)])
        ])
      ]),
      h("div", { class: "round-card-tags" }, [
        h("span", { class: `badge ${entry.status || "pendiente"}` }, [statusLabel(entry.status || "pendiente")]),
        h("span", { class: `badge sync-${entry.syncStatus || "local"}` }, [syncLabel(entry.syncStatus)]),
        devices.length ? h("span", { class: "badge device" }, [`${devices.length} invasivo(s)`]) : h("span", { class: "badge neutral" }, ["Sin invasivos activos"])
      ]),
      h("div", { class: "round-card-packages" }, packageSignals.map(signal =>
        h("span", { class: signal.tone }, [signal.label])
      )),
      h("div", { class: "round-card-actions" }, [
        h("a", { class: "iaas-button primary", href: `#/ronda/${date}/paciente/${row.patientId}` }, ["Revisar"]),
        h("a", { class: "iaas-button ghost", href: `#/pacientes/${row.patientId}/seguimiento` }, ["Seguimiento"])
      ])
    ]);
  }

  function packageSignalsForPatient(patient, row, devices) {
    const signals = [];
    if (devices.some(device => device.deviceType === "CVC")) signals.push({ label: "CVC", tone: "cvc" });
    if (devices.some(device => device.deviceType === "Sonda Foley")) signals.push({ label: "Catéter urinario", tone: "foley" });
    if (devices.some(device => ["Ventilación mecánica", "Tubo endotraqueal", "Traqueostomía"].includes(device.deviceType))) signals.push({ label: "NAV", tone: "nav" });
    if (isSurgicalSignal(patient, row)) signals.push({ label: "ISQ", tone: "isq" });
    if (!signals.length) signals.push({ label: "Valoración rápida", tone: "neutral" });
    return signals;
  }

  function isSurgicalSignal(patient, row = {}) {
    return /quir[uú]rg|cirug|traumatolog|herida|isq|post ?op|pop|lape|colec|fractura|tumor|colostom/i.test([
      patient.currentService,
      row.service,
      patient.currentDiagnosis,
      row.diagnosis,
      patient.activePendingIssues?.join(" "),
      row.pendingIssues,
      row.notes
    ].filter(Boolean).join(" "));
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
          h("h1", {}, [`Cama ${patient.currentBed} · ${patientLabel(patient)}`]),
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
          h("h1", {}, [`Seguimiento · ${patientLabel(patient)}`]),
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
    const date = activeDate();
    const stats = computeStats(date);
    const range = computeRangeStats(30);
    return h("div", { class: "iaas-page reports-page" }, [
      h("section", { class: "iaas-panel report-hero" }, [
        h("div", {}, [
          h("h1", {}, ["Analítica Epidemiológica"]),
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
        h("h2", {}, ["Reporte imprimible epidemiológico"]),
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
          h("img", { class: "login-logo", src: "./assets/epivida/logos/epivida-logo-gradient.svg", alt: "EpiVida Vigilancia Epidemiologica" }),
          h("h1", {}, ["Acceso requerido"]),
          h("p", {}, ["Firebase esta configurado. Inicia sesion con una cuenta de Google autorizada para ver datos clinicos."]),
          ui.firebase.error ? h("div", { class: "notice error" }, [ui.firebase.error]) : "",
          h("button", { class: "iaas-button primary", onclick: signInFirebase }, ["Iniciar sesion con Google"])
        ])
      ]);
    }
    return h("section", { class: "iaas-page" }, [
      h("article", { class: "iaas-panel login-panel" }, [
        h("img", { class: "login-logo", src: "./assets/epivida/logos/epivida-logo-gradient.svg", alt: "EpiVida Vigilancia Epidemiologica" }),
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
        h("img", { class: "login-logo", src: "./assets/epivida/logos/epivida-logo-gradient.svg", alt: "EpiVida Vigilancia Epidemiologica" }),
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
          h("td", {}, [patientLabel(row)]),
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
          h("strong", {}, [patientLabel(patient)]),
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
      patient_name: cleanCell(mapped.patient_name),
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
          patientName: row.patient_name || null,
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
        previous.patientName = row.patient_name || previous.patientName || null;
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
        patientName: row.patient_name || store.patients[row.patientId]?.patientName || null,
        age: row.edad ?? null,
        sex: row.sexo || null,
        admissionDate: row.fecha_ingreso || null,
        diagnosis: row.diagnostico_actual || null,
        observations: row.observaciones || row.pendientes || null,
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
    flashIaas("Paquetes preventivos iniciados.");
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
      const patientName = patientLabel(store.patients[entry.patientId], { patientId: entry.patientId });
      if (entry.status === "pendiente") issues.push(`${patientName} sigue pendiente.`);
      if (entry.syncStatus === "local_pending") issues.push(`${patientName} pendiente de sincronizar.`);
      if (entry.syncStatus === "error") issues.push(`${patientName} con error de guardado.`);
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
    const today = new Date(`${activeDate()}T00:00:00`);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const date = toIsoDate(d);
      const activeDevices = Object.values(store.deviceEpisodes).filter(ep => isEpisodeActiveOn(ep, date)).length;
      out.push({ date, activeDevices, patientDays: getCensusRows(date).length });
    }
    return out;
  }

  async function hydrateFromSheets() {
    if (!ui.sheets.enabled || !ui.sheets.accessToken) return;
    ui.sheets.status = "sync_pending";
    ui.sheets.error = "";
    renderIaas();
    try {
      const ranges = [
        sheetRange(SHEETS_CONFIG.tabs.appConfig, "A1:B100"),
        sheetRange(SHEETS_CONFIG.tabs.baseDatos, "A1:R1000"),
        sheetRange(SHEETS_CONFIG.tabs.rondas, "A1:U1000"),
        sheetRange(SHEETS_CONFIG.tabs.dispositivos, "A1:U1000"),
        sheetRange(SHEETS_CONFIG.tabs.auditoria, "A1:H1000")
      ];
      const params = new URLSearchParams({
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER"
      });
      ranges.forEach(range => params.append("ranges", range));
      const response = await sheetsRequest(`/values:batchGet?${params.toString()}`);
      const [configValues = {}, baseValues = {}, roundValues = {}, deviceValues = {}, auditValues = {}] = response.valueRanges || [];
      const config = keyValueRows(configValues.values || []);
      const derivedDate = sheetDateToIso(config.active_date) || deriveActiveDate(baseValues.values || []) || isoToday();
      const nextStore = buildStoreFromSheets({
        baseValues: baseValues.values || [],
        roundValues: roundValues.values || [],
        deviceValues: deviceValues.values || [],
        auditValues: auditValues.values || [],
        activeDate: derivedDate
      });
      nextStore.writeQueue = store.writeQueue || [];
      nextStore.users = store.users || {};
      store = nextStore;
      ui.sheets.lastWriteId = cleanCell(config.last_write_id);
      ui.sheets.activeDate = derivedDate;
      ui.sheets.lastSyncAt = nowIso();
      ui.sheets.connected = true;
      ui.sheets.status = "connected";
      saveStore();
      recalculateRound(derivedDate);
      flashIaas("Base Google Sheets cargada.");
      renderIaas();
    } catch (error) {
      ui.sheets.status = "error";
      ui.sheets.error = friendlyError(error);
      flashIaas(`Error al leer Sheets: ${ui.sheets.error}`);
      renderIaas();
    }
  }

  async function writeOperationToSheets() {
    if (!ui.sheets.enabled || !ui.sheets.connected || !ui.sheets.accessToken) {
      throw new Error("Google Sheets no conectado.");
    }
    ui.sheets.status = "sync_pending";
    ui.sheets.error = "";
    const remoteConfig = await fetchSheetsConfig();
    const remoteWriteId = cleanCell(remoteConfig.last_write_id);
    if (remoteWriteId && ui.sheets.lastWriteId && remoteWriteId !== ui.sheets.lastWriteId) {
      ui.sheets.status = "sync_conflict";
      ui.sheets.error = "La hoja tiene cambios posteriores. Recarga Sheets antes de sincronizar.";
      throw new Error(ui.sheets.error);
    }

    const writeId = `sheets-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const confirmedAt = nowIso();
    const pendingAuditLogs = store.auditLogs.filter(log => !log.serverConfirmedAt);
    const clearRanges = [
      sheetRange(SHEETS_CONFIG.tabs.baseDatos, `A1:R${SHEETS_CONFIG.maxRows}`),
      sheetRange(SHEETS_CONFIG.tabs.rondas, `A1:U${SHEETS_CONFIG.maxRows}`),
      sheetRange(SHEETS_CONFIG.tabs.dispositivos, `A1:U${SHEETS_CONFIG.maxRows}`),
      sheetRange(SHEETS_CONFIG.tabs.appConfig, "A1:B100")
    ];
    await sheetsRequest("/values:batchClear", {
      method: "POST",
      body: JSON.stringify({ ranges: clearRanges })
    });
    await sheetsRequest("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          { range: sheetRange(SHEETS_CONFIG.tabs.appConfig, "A1:B9"), values: appConfigRows(writeId, confirmedAt) },
          { range: sheetRange(SHEETS_CONFIG.tabs.baseDatos, `A1:R${baseRowsForSheets().length}`), values: baseRowsForSheets() },
          { range: sheetRange(SHEETS_CONFIG.tabs.rondas, `A1:U${roundRowsForSheets().length}`), values: roundRowsForSheets() },
          { range: sheetRange(SHEETS_CONFIG.tabs.dispositivos, `A1:U${deviceRowsForSheets().length}`), values: deviceRowsForSheets() }
        ]
      })
    });
    if (pendingAuditLogs.length) {
      await sheetsRequest(`/values/${encodeURIComponent(sheetRange(SHEETS_CONFIG.tabs.auditoria, "A:H"))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ values: pendingAuditLogs.map(log => auditRowForSheets(log, confirmedAt)) })
      });
      pendingAuditLogs.forEach(log => { log.serverConfirmedAt = confirmedAt; });
    }
    ui.sheets.lastWriteId = writeId;
    ui.sheets.lastSyncAt = confirmedAt;
    ui.sheets.status = "connected";
    saveStore();
  }

  async function fetchSheetsConfig() {
    const range = encodeURIComponent(sheetRange(SHEETS_CONFIG.tabs.appConfig, "A1:B100"));
    const response = await sheetsRequest(`/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
    return keyValueRows(response.values || []);
  }

  async function sheetsRequest(path, options = {}) {
    const response = await fetch(`${SHEETS_API_BASE}/${encodeURIComponent(SHEETS_CONFIG.spreadsheetId)}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${ui.sheets.accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    if (response.status === 401 || response.status === 403) {
      ui.sheets.connected = false;
      ui.sheets.accessToken = "";
      ui.sheets.status = "disconnected";
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Sheets API ${response.status}`);
    }
    if (response.status === 204) return {};
    return response.json();
  }

  function sheetRange(sheetName, range) {
    return `'${String(sheetName).replace(/'/g, "''")}'!${range}`;
  }

  function keyValueRows(values) {
    return values.slice(1).reduce((out, row) => {
      const key = cleanCell(row[0]).toLowerCase();
      if (key) out[key] = row[1] ?? "";
      return out;
    }, {});
  }

  function buildStoreFromSheets({ baseValues, roundValues, deviceValues, auditValues, activeDate: sheetActiveDate }) {
    const patients = {};
    const censusPatients = {};
    rowsToObjects(baseValues).forEach(row => {
      const patientId = cleanCell(row.ID);
      if (!patientId) return;
      const date = sheetDateToIso(row.FECHA_CENSO) || sheetActiveDate;
      const admissionDate = sheetDateToIso(row.FECHA_INGRESO);
      const service = normalizeService(row.SERVICIO);
      const bed = normalizeSheetBed(row.CAMA);
      const patient = {
        patientId,
        displayCode: patientId,
        patientName: cleanCell(row.PACIENTE) || null,
        hospitalInternalId: patientId,
        pseudonymizedId: patientId,
        currentService: service,
        currentBed: bed,
        sex: normalizeSex(row.SEXO),
        age: parseAge(row.EDAD),
        admissionDate: admissionDate || null,
        currentDiagnosis: cleanCell(row.DX_HOSPITALARIO) || null,
        epidemiologicalDiagnosis: cleanCell(row.DX_EPIDEMIOLOGICO) || null,
        currentEpidemiologicalDiagnosis: cleanCell(row.DX_EPIDEMIOLOGICO) || null,
        currentState: cleanCell(row.ESTADO) || null,
        observations: cleanCell(row.OBSERVACIONES) || null,
        isolation: cleanCell(row.AISLAMIENTO) || null,
        cultureStatus: cleanCell(row.CULTIVO) || null,
        diagnosisHistory: [{ date, value: cleanCell(row.DX_HOSPITALARIO), source: "sheets" }],
        activePendingIssues: splitPending(row.OBSERVACIONES),
        currentRiskLevel: riskFromRow({ estado: row.ESTADO, dxEpidemiologicos: row.DX_EPIDEMIOLOGICO }),
        hospitalizationStatus: "hospitalizado",
        presentInLatestCensus: true,
        latestCensusDate: date,
        latestRoundDate: null,
        latestRoundStatus: "pendiente",
        createdAt: nowIso(),
        updatedAt: sheetDateToIso(row.UPDATED_AT) || nowIso(),
        createdBy: "sheets",
        updatedBy: cleanCell(row.UPDATED_BY) || "sheets"
      };
      patients[patientId] = patient;
      censusPatients[patientId] = {
        patientId,
        service,
        bed,
        patientName: patient.patientName,
        age: patient.age,
        sex: patient.sex,
        admissionDate,
        diagnosis: patient.currentDiagnosis,
        epidemiologicalDiagnosis: patient.epidemiologicalDiagnosis,
        state: patient.currentState,
        observations: patient.observations,
        cultureStatus: patient.cultureStatus,
        isolation: patient.isolation,
        present: true,
        importedFromFile: false,
        importBatchId: `sheets-${date}`,
        rowHash: hashText(JSON.stringify(row)),
        reviewedByNursing: false,
        reviewStatus: "pendiente",
        reviewedAt: null,
        syncStatus: "server_synced",
        notes: patient.observations || "",
        roundDate: date
      };
    });

    const deviceEpisodes = {};
    rowsToObjects(deviceValues).forEach(row => {
      const episodeId = cleanCell(row.EPISODE_ID);
      const patientId = cleanCell(row.PATIENT_ID);
      if (!episodeId || !patientId) return;
      const payload = parseJsonCell(row.PAYLOAD_JSON);
      deviceEpisodes[episodeId] = {
        ...payload,
        episodeId,
        patientId,
        deviceType: cleanCell(row.DEVICE_TYPE) || payload.deviceType || "Otro",
        deviceSubtype: cleanCell(row.DEVICE_SUBTYPE) || payload.deviceSubtype || null,
        anatomicalSite: cleanCell(row.ANATOMICAL_SITE) || payload.anatomicalSite || null,
        installationDate: sheetDateToIso(row.INSTALLATION_DATE) || payload.installationDate || null,
        removalDate: sheetDateToIso(row.REMOVAL_DATE) || payload.removalDate || null,
        isReinstallation: parseBool(row.IS_REINSTALLATION),
        dressingCurrent: nullable(row.DRESSING_CURRENT),
        dressingDate: sheetDateToIso(row.DRESSING_DATE) || payload.dressingDate || null,
        careStatus: cleanCell(row.CARE_STATUS) || payload.careStatus || "no_valorado",
        infectionSigns: parseBool(row.INFECTION_SIGNS),
        notes: cleanCell(row.NOTES) || payload.notes || null,
        createdDuringRoundDate: sheetDateToIso(row.CREATED_DURING_ROUND_DATE) || payload.createdDuringRoundDate || null,
        source: cleanCell(row.SOURCE) || payload.source || "sheets",
        syncStatus: cleanCell(row.SYNC_STATUS) || "server_synced",
        createdAt: sheetDateToIso(row.CREATED_AT) || payload.createdAt || nowIso(),
        updatedAt: sheetDateToIso(row.UPDATED_AT) || payload.updatedAt || nowIso(),
        updatedBy: cleanCell(row.UPDATED_BY) || payload.updatedBy || "sheets"
      };
    });

    const entries = {};
    Object.values(censusPatients).forEach(row => {
      entries[row.patientId] = defaultRoundEntry(row, sheetActiveDate, deviceEpisodes);
    });
    rowsToObjects(roundValues).forEach(row => {
      const patientId = cleanCell(row.PATIENT_ID);
      if (!patientId) return;
      const payload = parseJsonCell(row.PAYLOAD_JSON);
      entries[patientId] = {
        ...defaultRoundEntry(censusPatients[patientId] || { patientId }, sheetActiveDate, deviceEpisodes),
        ...payload,
        entryId: cleanCell(row.ENTRY_ID) || patientId,
        patientId,
        service: cleanCell(row.SERVICE) || payload.service || censusPatients[patientId]?.service || "",
        bed: cleanCell(row.BED) || payload.bed || censusPatients[patientId]?.bed || "",
        status: cleanCell(row.STATUS) || payload.status || "pendiente",
        reviewedBy: cleanCell(row.REVIEWED_BY) || payload.reviewedBy || null,
        reviewedAt: cleanCell(row.REVIEWED_AT) || payload.reviewedAt || null,
        roundDate: sheetDateToIso(row.ROUND_DATE) || payload.roundDate || sheetActiveDate,
        hasInvasives: parseBool(row.HAS_INVASIVES),
        noInvasivesConfirmed: parseBool(row.NO_INVASIVES_CONFIRMED),
        reviewedDevices: splitListCell(row.REVIEWED_DEVICES),
        pendingIssuesAdded: splitListCell(row.PENDING_ISSUES_ADDED),
        alertsGenerated: splitListCell(row.ALERTS_GENERATED),
        notes: cleanCell(row.NOTES) || payload.notes || "",
        syncStatus: cleanCell(row.SYNC_STATUS) || "server_synced",
        localSavedAt: cleanCell(row.LOCAL_SAVED_AT) || payload.localSavedAt || null,
        serverConfirmedAt: cleanCell(row.SERVER_CONFIRMED_AT) || payload.serverConfirmedAt || null
      };
    });

    const auditLogs = rowsToObjects(auditValues).map(row => ({
      logId: cleanCell(row.LOG_ID),
      createdAt: cleanCell(row.CREATED_AT),
      userId: cleanCell(row.USER_ID),
      actionType: cleanCell(row.ACTION_TYPE),
      patientId: cleanCell(row.PATIENT_ID) || null,
      roundDate: sheetDateToIso(row.ROUND_DATE) || cleanCell(row.ROUND_DATE) || null,
      metadata: parseJsonCell(row.METADATA_JSON),
      serverConfirmedAt: cleanCell(row.SERVER_CONFIRMED_AT) || null
    })).filter(log => log.logId);

    const date = sheetActiveDate;
    const dailyRounds = {
      [date]: {
        date,
        status: Object.values(entries).some(entry => entry.status !== "pendiente") ? "in_progress" : "not_started",
        startedAt: null,
        startedBy: null,
        closedAt: null,
        closedBy: null,
        entries,
        totalPatients: Object.keys(entries).length,
        reviewedPatients: 0,
        pendingPatients: 0,
        incompletePatients: 0,
        reconciliationPatients: 0,
        activeAlerts: 0,
        localPendingWritesCount: 0,
        serverSyncedWritesCount: 0,
        errorWritesCount: 0
      }
    };

    return {
      version: 1,
      activeDate: date,
      patients,
      dailyCensus: {
        [date]: {
          date,
          importBatchId: `sheets-${date}`,
          importedAt: nowIso(),
          importedBy: "google-sheets",
          totalRows: Object.keys(censusPatients).length,
          totalPatientsDetected: Object.keys(censusPatients).length,
          totalNewPatients: Object.keys(censusPatients).length,
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
      dailyRounds,
      deviceEpisodes,
      auditLogs,
      writeQueue: [],
      users: {},
      lastSavedAt: nowIso()
    };
  }

  function rowsToObjects(values) {
    if (!values.length) return [];
    const headers = values[0].map(normalizeSheetHeader);
    return values.slice(1).filter(row => row.some(value => cleanCell(value))).map(row => {
      const out = {};
      headers.forEach((header, index) => { if (header) out[header] = row[index] ?? ""; });
      return out;
    });
  }

  function normalizeSheetHeader(value) {
    return normalizeText(value).replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function defaultRoundEntry(row, date, episodes = store.deviceEpisodes) {
    return {
      entryId: row.patientId,
      patientId: row.patientId,
      service: row.service || "",
      bed: row.bed || "",
      reviewedBy: null,
      reviewedAt: null,
      roundDate: date,
      hasInvasives: Object.values(episodes).some(ep => ep.patientId === row.patientId && isEpisodeActiveOn(ep, date)),
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
  }

  function baseRowsForSheets() {
    const rows = getCensusRows(activeDate()).map(row => {
      const patient = store.patients[row.patientId] || {};
      const admission = patient.admissionDate || row.admissionDate || "";
      return [
        row.patientId,
        row.roundDate || activeDate(),
        row.service || patient.currentService || "",
        row.bed || patient.currentBed || "",
        patient.patientName || row.patientName || "",
        patient.age ?? row.age ?? "",
        patient.sex || row.sex || "",
        admission,
        daysBetween(admission, row.roundDate || activeDate()) ?? "",
        patient.epidemiologicalDiagnosis || row.epidemiologicalDiagnosis || "",
        patient.iaasType || "",
        row.cultureStatus || patient.cultureStatus || "",
        row.isolation || patient.isolation || "",
        patient.currentState || row.state || "",
        patient.currentDiagnosis || row.diagnosis || "",
        patient.observations || row.observations || row.notes || "",
        nowIso(),
        currentUserName()
      ];
    });
    return [BASE_SHEET_HEADERS, ...rows];
  }

  function roundRowsForSheets() {
    const rows = Object.values(store.dailyRounds).flatMap(round => Object.values(round.entries || {})).map(entry => [
      entry.entryId || entry.patientId,
      entry.roundDate || "",
      entry.patientId || "",
      entry.service || "",
      entry.bed || "",
      entry.status || "",
      entry.reviewedBy || "",
      entry.reviewedAt || "",
      boolCell(entry.hasInvasives),
      boolCell(entry.noInvasivesConfirmed),
      listCell(entry.reviewedDevices),
      listCell(entry.pendingIssuesAdded),
      listCell(entry.alertsGenerated),
      entry.notes || "",
      entry.syncStatus || "",
      entry.localSavedAt || "",
      entry.serverConfirmedAt || "",
      entry.createdAt || "",
      entry.updatedAt || "",
      entry.updatedBy || "",
      jsonCell(entry)
    ]);
    return [ROUND_SHEET_HEADERS, ...rows];
  }

  function deviceRowsForSheets() {
    const rows = Object.values(store.deviceEpisodes).map(ep => [
      ep.episodeId || "",
      ep.patientId || "",
      ep.deviceType || "",
      ep.deviceSubtype || "",
      ep.anatomicalSite || "",
      ep.installationDate || "",
      ep.removalDate || "",
      boolCell(ep.isReinstallation),
      boolCell(ep.dressingCurrent),
      ep.dressingDate || "",
      ep.careStatus || "",
      boolCell(ep.infectionSigns),
      ep.notes || "",
      ep.createdDuringRoundDate || "",
      ep.source || "",
      ep.syncStatus || "",
      ep.createdAt || "",
      ep.updatedAt || "",
      ep.updatedBy || "",
      ep.removedBy || "",
      jsonCell(ep)
    ]);
    return [DEVICE_SHEET_HEADERS, ...rows];
  }

  function appConfigRows(writeId, updatedAt) {
    return [
      ["key", "value"],
      ["schema_version", SHEETS_CONFIG.schemaVersion],
      ["active_date", activeDate()],
      ["last_write_id", writeId],
      ["last_updated_at", updatedAt],
      ["last_updated_by", currentUserName()],
      ["source_mode", SHEETS_CONFIG.appAuthoritative ? "app_authoritative" : "sheets_read"],
      ["base_sheet", SHEETS_CONFIG.tabs.baseDatos],
      ["notes", "EpiVida app is the authoritative editor. Manual sheet edits can be overwritten."]
    ];
  }

  function auditRowForSheets(log, confirmedAt) {
    return [
      log.logId,
      log.createdAt,
      log.userId,
      log.actionType,
      log.patientId || "",
      log.roundDate || "",
      jsonCell({
        deviceEpisodeId: log.deviceEpisodeId || null,
        importBatchId: log.importBatchId || null,
        before: log.before || null,
        after: log.after || null,
        metadata: log.metadata || null
      }),
      confirmedAt
    ];
  }

  function deriveActiveDate(baseValues) {
    const rows = rowsToObjects(baseValues);
    const dates = rows.map(row => sheetDateToIso(row.FECHA_CENSO)).filter(Boolean).sort();
    return dates[dates.length - 1] || "";
  }

  function sheetDateToIso(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value).trim())) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 20000) {
        const d = new Date(Math.round((n - 25569) * 86400000));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      }
    }
    return normalizeDate(value);
  }

  function normalizeSheetBed(value) {
    return cleanCell(value).replace(/^cama\s+/i, "");
  }

  function parseJsonCell(value) {
    const text = cleanCell(value);
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function jsonCell(value) {
    return JSON.stringify(value ?? {});
  }

  function parseBool(value) {
    const text = normalizeText(value);
    return ["TRUE", "VERDADERO", "SI", "S", "1", "YES"].includes(text);
  }

  function boolCell(value) {
    return value ? "TRUE" : "FALSE";
  }

  function listCell(value) {
    return Array.isArray(value) ? value.join(" | ") : cleanCell(value);
  }

  function splitListCell(value) {
    return cleanCell(value).split("|").map(item => item.trim()).filter(Boolean);
  }

  async function enqueueWrite(operation) {
    const item = { id: `write-${Date.now()}-${Math.random().toString(16).slice(2)}`, status: "local_pending", createdAt: nowIso(), operation };
    if (ui.sheets.enabled) {
      if (!ui.sheets.connected || !navigator.onLine) {
        store.writeQueue.push(item);
        ui.sheets.status = "sync_pending";
        saveStore();
        return;
      }
      try {
        await writeOperationToSheets(operation);
        item.status = "server_synced";
      } catch (error) {
        item.status = "error";
        item.error = friendlyError(error);
        store.writeQueue.push(item);
        addAudit("SYNC_ERROR", { metadata: { error: item.error, operationType: operation.type, provider: "google_sheets" } });
      }
      saveStore();
      renderIaas();
      return;
    }
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
    if (ui.sheets.enabled) {
      if (!ui.sheets.connected || !navigator.onLine) return;
      const queue = [...store.writeQueue];
      if (!queue.length) return;
      try {
        await writeOperationToSheets({ type: "queuedSnapshot" });
        queue.forEach(item => {
          item.status = "server_synced";
          item.serverConfirmedAt = nowIso();
        });
      } catch (error) {
        queue.forEach(item => {
          if (item.status !== "server_synced") {
            item.status = "error";
            item.error = friendlyError(error);
          }
        });
      }
      store.writeQueue = queue.filter(item => item.status !== "server_synced");
      saveStore();
      renderIaas();
      return;
    }
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
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
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
      await consumeAuthRedirectResult();
      authMod.onAuthStateChanged(auth, async user => {
        ui.firebase.user = user;
        ui.firebase.denied = Boolean(user && !isEmailAllowed(user.email));
        ui.firebase.ready = Boolean(user && !ui.firebase.denied);
        renderIaas();
        if (ui.firebase.ready) {
          if (ui.sheets.enabled) {
            stopRealtimeSync();
            ui.firebase.realtimeStatus = "Firebase Auth activo. Base de datos en Google Sheets.";
            ui.sheets.status = ui.sheets.connected ? "connected" : "disconnected";
          } else {
            await hydrateCurrentFirestore();
            startRealtimeSync(activeDate());
            flushSyncQueue();
          }
        } else {
          stopRealtimeSync();
          ui.sheets.connected = false;
          ui.sheets.accessToken = "";
          ui.sheets.status = ui.sheets.enabled ? "disconnected" : ui.sheets.status;
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
        try {
          await firebaseRuntime.authMod.signInWithPopup(firebaseRuntime.auth, provider);
        } catch (error) {
          if (isPopupBlockedError(error) && shouldUseRedirectFallback()) {
            setAuthRedirectFlow("firebase");
            await firebaseRuntime.authMod.signInWithRedirect(firebaseRuntime.auth, provider);
            return;
          }
          if (isPopupBlockedError(error)) throw new Error(oauthPopupHelpText());
          throw error;
        }
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

  async function connectSheets() {
    if (!firebaseRuntime || !ui.firebase.user || !ui.sheets.enabled) return;
    ui.sheets.status = "connecting";
    ui.sheets.error = "";
    renderIaas();
    try {
      const provider = new firebaseRuntime.authMod.GoogleAuthProvider();
      provider.addScope(SHEETS_SCOPE);
      provider.setCustomParameters({ prompt: "consent select_account" });
      let result;
      try {
        result = await firebaseRuntime.authMod.signInWithPopup(firebaseRuntime.auth, provider);
      } catch (error) {
        if (isPopupBlockedError(error) && shouldUseRedirectFallback()) {
          setAuthRedirectFlow("sheets");
          await firebaseRuntime.authMod.signInWithRedirect(firebaseRuntime.auth, provider);
          return;
        }
        if (isPopupBlockedError(error)) throw new Error(oauthPopupHelpText());
        throw error;
      }
      const credential = firebaseRuntime.authMod.GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) throw new Error("Google no devolvio token de Sheets.");
      await finishSheetsConnection(credential.accessToken);
    } catch (error) {
      ui.sheets.connected = false;
      ui.sheets.accessToken = "";
      ui.sheets.status = "error";
      ui.sheets.error = friendlyError(error);
      flashIaas(`No se pudo conectar Sheets: ${ui.sheets.error}`);
      renderIaas();
    }
  }

  async function consumeAuthRedirectResult() {
    const flow = getAuthRedirectFlow();
    if (!flow || !firebaseRuntime) return;
    try {
      const result = await firebaseRuntime.authMod.getRedirectResult(firebaseRuntime.auth);
      clearAuthRedirectFlow();
      if (!result?.user) {
        ui.firebase.error = "Google regreso sin una sesion activa. Intenta de nuevo y confirma que usas una cuenta autorizada.";
        return;
      }
      ui.firebase.user = result.user;
      ui.firebase.denied = Boolean(result.user && !isEmailAllowed(result.user.email));
      ui.firebase.ready = Boolean(result.user && !ui.firebase.denied);
      if (flow === "sheets" && ui.firebase.ready && ui.sheets.enabled) {
        const credential = firebaseRuntime.authMod.GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) throw new Error("Google no devolvio token de Sheets.");
        await finishSheetsConnection(credential.accessToken);
      }
    } catch (error) {
      clearAuthRedirectFlow();
      if (flow === "sheets") {
        ui.sheets.connected = false;
        ui.sheets.accessToken = "";
        ui.sheets.status = "error";
        ui.sheets.error = friendlyError(error);
      } else {
        ui.firebase.error = friendlyError(error);
      }
    }
  }

  async function finishSheetsConnection(accessToken) {
    ui.sheets.accessToken = accessToken;
    ui.sheets.connected = true;
    ui.sheets.status = "connected";
    const hadPendingWrites = pendingQueue().length > 0;
    await hydrateFromSheets();
    if (hadPendingWrites) {
      ui.sheets.status = "sync_conflict";
      ui.sheets.error = "Se detectaron cambios locales previos. Recarga Sheets y repite la accion ya conectado antes de escribir en la base clinica.";
      store.writeQueue = store.writeQueue.map(item => ({ ...item, status: "error", error: ui.sheets.error }));
      saveStore();
      flashIaas(ui.sheets.error);
      renderIaas();
      return;
    }
    await flushSyncQueue();
  }

  function isPopupBlockedError(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    return code.includes("popup-blocked") || /popup.*block/i.test(message);
  }

  function shouldUseRedirectFallback() {
    return window.EPIVIDA_AUTH_REDIRECT_FALLBACK === true;
  }

  function oauthPopupHelpText() {
    return "Este navegador bloqueo la ventana de Google. Abre la app en Google Chrome o permite ventanas emergentes para localhost:5188; Chrome ya es el navegador recomendado para autorizar Firebase y Sheets.";
  }

  function setAuthRedirectFlow(flow) {
    try {
      localStorage.setItem(AUTH_FLOW_KEY, flow);
    } catch {}
  }

  function getAuthRedirectFlow() {
    try {
      return localStorage.getItem(AUTH_FLOW_KEY) || "";
    } catch {
      return "";
    }
  }

  function clearAuthRedirectFlow() {
    try {
      localStorage.removeItem(AUTH_FLOW_KEY);
    } catch {}
  }

  async function signOutFirebase() {
    if (!firebaseRuntime) return;
    stopRealtimeSync();
    ui.sheets.connected = false;
    ui.sheets.accessToken = "";
    ui.sheets.status = ui.sheets.enabled ? "disconnected" : ui.sheets.status;
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

  function hasPrivateCensusSeed() {
    return location.hostname === "localhost" && (window.CENSO_SEED?.rows || []).some(row => row.type === "patient");
  }

  function restorePrivateCensus() {
    if (!hasPrivateCensusSeed()) {
      flashIaas("No hay respaldo privado local cargado.");
      return;
    }
    if (Object.keys(store.patients || {}).length && !confirm("Esto reemplazara el censo local actual con el respaldo privado. Firestore no se borra. Continuar?")) {
      return;
    }
    store = seedFromCurrentCensus();
    saveStore();
    ui.selectedService = "Todos";
    location.hash = "#/censo-hospitalario";
    flashIaas("Censo local restaurado desde el respaldo privado.");
    renderIaas();
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
      dashboard: "Centro de Vigilancia",
      "censo-hospitalario": "Vigilancia Hospitalaria",
      "importar-censo": "Base de Datos",
      ronda: "Paquetes Preventivos",
      "seguimiento-iaas": "Seguimiento IAAS",
      pacientes: "Seguimiento de paciente",
      "reporte-diario": "Analítica Epidemiológica"
    }[page] || "Centro de Vigilancia";
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

  function activeDate() {
    return ui.sheets.activeDate || store.activeDate || isoToday();
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
    if (ui.sheets.enabled) return ui.sheets.connected ? "server_synced" : "local_pending";
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

  function patientLabel(patient, row = {}) {
    const bed = patient?.currentBed || row.bed || row.currentBed;
    return patient?.patientName || row.patientName || (bed ? `Paciente cama ${bed}` : "Paciente en seguimiento");
  }

  function serviceIconAsset(service) {
    const normalized = normalizeService(service);
    const file = SERVICE_ICONS[normalized] || "icon-pacientes";
    const folder = file.startsWith("servicio-") ? "icons" : "icons";
    return `${PRO_ASSET}/${folder}/${file}.webp`;
  }

  function serviceArtAsset(service) {
    const normalized = normalizeService(service);
    const file = SERVICE_ICONS[normalized];
    if (!file || !file.startsWith("servicio-")) return `${PRO_ASSET}/icons/extras/futuristic_healthcare_network_hub_icon.webp`;
    return `${PRO_ASSET}/services/${file}-hero.webp`;
  }

  function patientCensusMeta(patient = {}, row = {}) {
    const sector = sectorLabel(patient.sector || row.sector);
    const bed = patient.currentBed || row.bed || "S/C";
    return sector ? `Ficha epidemiológica · ${sector}` : `Ficha epidemiológica · Cama ${bed}`;
  }

  function sectorLabel(value) {
    const key = normalizeText(value).replace(/\s+/g, "");
    return SECTOR_LABELS[key] || "";
  }

  function displayState(value) {
    const key = normalizeText(value);
    if (key === "GRAVE INTUBADO") return "MUY GRAVE INTUBADO";
    if (key === "CRITICO") return "CRÍTICO";
    if (key === "CRITICO INTUBADO") return "CRÍTICO INTUBADO";
    return cleanCell(value || "Sin estado").toUpperCase();
  }

  function stateClass(value) {
    const key = normalizeText(displayState(value));
    const map = {
      ESTABLE: "status-estable",
      DELICADO: "status-delicado",
      GRAVE: "status-grave",
      "MUY GRAVE": "status-muy-grave",
      "MUY GRAVE INTUBADO": "status-muy-grave-intubado",
      CRITICO: "status-critico",
      "CRITICO INTUBADO": "status-critico-intubado"
    };
    return map[key] || "status-neutral";
  }

  function epiClass(value) {
    const key = normalizeText(value);
    if (key.includes("COVID") || key.includes("INFLUENZA")) return "epi-covid";
    if (key.includes("ESAVI")) return "epi-esavis";
    if (key.includes("MORBIMORTALIDAD") || key.includes("MATERNA") || key.includes("PERINATAL")) return "epi-materna";
    if (key.includes("VIG") || key.includes("TRANSMISIBLE")) return "epi-vig";
    if (key.includes("RIESGO") && key.includes("IAAS")) return "epi-riesgo-iaas";
    if (key.includes("NO IAAS")) return "epi-no-iaas";
    if (key.includes("IAAS")) return "epi-iaas";
    return "epi-neutral";
  }

  function restoreFocusedControl() {
    if (!ui.focusTarget) return;
    const target = document.getElementById(ui.focusTarget);
    ui.focusTarget = "";
    if (!target) return;
    target.focus();
    if (typeof target.setSelectionRange === "function") {
      const length = String(target.value || "").length;
      target.setSelectionRange(length, length);
    }
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
    if (/unauthorized-domain/i.test(text)) {
      return `Dominio no autorizado en Firebase Auth. Usa http://localhost:${location.port || "5188"} o agrega ${location.hostname} en Firebase Console > Authentication > Settings > Authorized domains.`;
    }
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

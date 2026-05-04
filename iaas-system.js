(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const AUTH_FLOW_KEY = "epivida-auth-redirect-flow";
  const SHEETS_SESSION_KEY = "epivida-sheets-session-v1";
  const FIREBASE_VERSION = "10.12.4";
  const PRO_ASSET = "./assets/epivida-pro";
  const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
  const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
  const OAUTH_POPUP_TIMEOUT_MS = Number(window.EPIVIDA_OAUTH_POPUP_TIMEOUT_MS || 90000);
  const SHEETS_CONFIG = {
    enabled: false,
    spreadsheetId: "",
    spreadsheetUrl: "",
    googleClientId: "",
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
  const GOOGLE_OAUTH_CLIENT_ID = window.EPIVIDA_GOOGLE_CLIENT_ID || SHEETS_CONFIG.googleClientId || "";
  const BASE_SHEET_HEADERS = [
    "ID",
    "Fecha_censo",
    "Servicio",
    "Cama",
    "Paciente",
    "RFC",
    "Fecha_nacimiento",
    "Sector",
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
    "monitoreo-epidemiologico": "icon-vigilancia",
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
    "ONCOLOGÍA": "icon-pacientes",
    "GINECOLOGÍA Y OBSTETRICIA": "servicio-ginecologia-obstetricia",
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS": "servicio-uci-pediatricos",
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS": "servicio-uci-adultos",
    URGENCIAS: "servicio-urgencias",
    AMBULATORIO: "icon-pacientes"
  };
  const SERVICE_COLORS = {
    "MEDICINA INTERNA": "#c9e7ff",
    "CIRUGÍA Y TRAUMATOLOGÍA": "#ffd7de",
    "PEDIATRÍA": "#d7f7df",
    CUNEROS: "#fff1b8",
    "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES": "#dce2ff",
    "HEMODIÁLISIS": "#d5f3f2",
    "ONCOLOGÍA": "#ead7ff",
    "GINECOLOGÍA Y OBSTETRICIA": "#ffdce9",
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS": "#d8f0ff",
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS": "#e8e2d2",
    URGENCIAS: "#ffe0c2",
    AMBULATORIO: "#e2eed8"
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

  const EPIDEMIOLOGICAL_TAGS = [
    { key: "iaas", label: "IAAS", tone: "epi-iaas" },
    { key: "noIaas", label: "NO IAAS", tone: "epi-no-iaas" },
    { key: "riesgoIaas", label: "RIESGO IAAS", tone: "epi-riesgo-iaas" },
    { key: "vigTransmisible", label: "VIG TRANSMISIBLE", tone: "epi-vig" },
    { key: "vigNoTransmisible", label: "VIG NO TRANSMISIBLE", tone: "epi-vig-no" },
    { key: "esavi", label: "ESAVI", tone: "epi-esavis" },
    { key: "covidInfluenza", label: "COVID/INFLUENZA", tone: "epi-covid" },
    { key: "morbimortalidad", label: "MORBIMORTALIDAD MATERNA/PERINATAL", tone: "epi-materna" }
  ];

  const SERVICES = [
    "MEDICINA INTERNA",
    "CIRUGÍA Y TRAUMATOLOGÍA",
    "PEDIATRÍA",
    "CUNEROS",
    "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES",
    "HEMODIÁLISIS",
    "ONCOLOGÍA",
    "GINECOLOGÍA Y OBSTETRICIA",
    "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS",
    "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS",
    "URGENCIAS",
    "AMBULATORIO"
  ];
  const SECTOR_OPTIONS = [
    { value: "MAG", label: "MAGISTERIO", short: "MAG" },
    { value: "BUR", label: "BUROCRACIA", short: "BUR" },
    { value: "PIM", label: "PENSIONADO ISSTECH MAGISTERIO", short: "PIM" },
    { value: "PIB", label: "PENSIONADO ISSTECH BUROCRACIA", short: "PIB" },
    { value: "ISSTECH", label: "ISSTECH", short: "ISSTECH" },
    { value: "PRIVADO", label: "PRIVADO", short: "PRIVADO" }
  ];
  const SEX_OPTIONS = ["MASCULINO", "FEMENINO"];
  const STATE_OPTIONS = [
    "ESTABLE",
    "DELICADO",
    "GRAVE",
    "GRAVE INTUBADO",
    "MUY GRAVE",
    "MUY GRAVE INTUBADO",
    "CRÍTICO",
    "CRÍTICO INTUBADO"
  ];
  const AGE_RANGES = [
    { value: "0-9", label: "0 a 9 años", min: 0, max: 9 },
    { value: "10-19", label: "10 a 19 años", min: 10, max: 19 },
    { value: "20-29", label: "20 a 29 años", min: 20, max: 29 },
    { value: "30-39", label: "30 a 39 años", min: 30, max: 39 },
    { value: "40-49", label: "40 a 49 años", min: 40, max: 49 },
    { value: "50-59", label: "50 a 59 años", min: 50, max: 59 },
    { value: "60-69", label: "60 a 69 años", min: 60, max: 69 },
    { value: "70-79", label: "70 a 79 años", min: 70, max: 79 },
    { value: "80-89", label: "80 a 89 años", min: 80, max: 89 },
    { value: "90+", label: "90 años o más", min: 90, max: Infinity }
  ];
  const MONITOR_SORTS = [
    { value: "service", label: "Orden por servicio" },
    { value: "deih-desc", label: "DEIH mayor a menor" },
    { value: "deih-asc", label: "DEIH menor a mayor" },
    { value: "state-asc", label: "Estado estable a crítico" },
    { value: "state-desc", label: "Estado crítico a estable" }
  ];
  const EPIDEMIOLOGICAL_COMBOS = [
    "1 IAAS",
    "VIG TRANSMISIBLE / 1 IAAS",
    "VIG NO TRANSMISIBLE / 1 IAAS",
    "1 IAAS IMPORTADA",
    "VIG TRANSMISIBLE",
    "VIG NO TRANSMISIBLE",
    "COVID/INFLUENZA",
    "NO IAAS",
    "RIESGO IAAS",
    "2 IAAS",
    "3 IAAS",
    "VIG TRANSMISIBLE / RIESGO IAAS",
    "VIG NO TRANSMISIBLE / RIESGO IAAS",
    "ESAVI",
    "MORBIMORTALIDAD MATERNA/PERINATAL",
    "VIG TRANSMISIBLE / 2 IAAS",
    "VIG NO TRANSMISIBLE / 2 IAAS",
    "VIG TRANSMISIBLE / 3 IAAS",
    "VIG NO TRANSMISIBLE / 3 IAAS",
    "VIG TRANSMISIBLE / NO IAAS",
    "VIG NO TRANSMISIBLE / NO IAAS",
    "2 IAAS IMPORTADAS",
    "3 IAAS IMPORTADAS",
    "4 IAAS IMPORTADAS",
    "4 IAAS"
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

  const IAAS_VITAL_FIELDS = [
    ["temperature", "Temperatura"],
    ["bloodPressure", "Presión arterial"],
    ["heartRate", "Frecuencia cardiaca"],
    ["respiratoryRate", "Frecuencia respiratoria"],
    ["oxygenSaturation", "Saturación de oxígeno"]
  ];
  const IAAS_VENTILATION_FIELDS = [
    ["fio2", "FiO2"],
    ["peep", "PEEP"]
  ];
  const IAAS_CBC_FIELDS = [
    ["hemoglobin", "Hemoglobina"],
    ["hematocrit", "Hematocrito"],
    ["platelets", "Plaquetas"],
    ["leukocytes", "Leucocitos"],
    ["neutrophils", "Neutrófilos"],
    ["bands", "Bandas"],
    ["eosinophils", "Eosinófilos"],
    ["monocytes", "Monocitos"],
    ["lymphocytes", "Linfocitos"]
  ];
  const IAAS_URINALYSIS_SELECTS = [
    ["appearance", "Aspecto", ["", "Transparente", "Ligeramente turbio", "Turbio"]],
    ["nitrites", "Nitritos", ["", "Positivo", "Negativo"]],
    ["leukocyteEsterase", "Esterasa leucocitaria", ["", "Positivo", "Negativo"]],
    ["epithelialCells", "Células epiteliales", ["", "No se encontraron", "Escasas", "Moderadas", "Abundantes"]],
    ["bacteria", "Bacterias", ["", "Sin desarrollo", "Escasas", "Moderadas", "Abundantes"]],
    ["yeast", "Levaduras", ["", "Sin desarrollo", "Escasas", "Moderadas", "Abundantes"]]
  ];
  const IAAS_OTHER_STUDY_FIELDS = [
    ["procalcitonin", "Procalcitonina"],
    ["pcr", "PCR"],
    ["vsg", "VSG"],
    ["glucose", "Glucosa"]
  ];
  const IAAS_INFECTION_TRACKING_FIELDS = [
    ["assessmentDate", "Fecha de revisión"],
    ["patchIntegrity", "Parche"],
    ["patchMoisture", "Humedad del parche"],
    ["externalGauze", "Gasas externas"],
    ["internalGauze", "Gasas internas"],
    ["secretionPresence", "Secreción"],
    ["secretionType", "Tipo de secreción"],
    ["secretionAmount", "Cantidad"],
    ["insertionSite", "Sitio de inserción"],
    ["probableOrigin", "Origen probable"],
    ["carePlan", "Plan de cuidado"]
  ];
  const IAAS_PATCH_STATUS_OPTIONS = ["", "Íntegro", "No íntegro", "Despegado", "Semidespegado", "Bien fijado"];
  const IAAS_MOISTURE_OPTIONS = ["", "Seco", "Mojado", "Húmedo"];
  const IAAS_GAUZE_OPTIONS = ["", "Secas", "Mojadas", "Húmedas", "No aplica"];
  const IAAS_SECRETION_PRESENCE_OPTIONS = ["", "Sin secreción", "Con secreción", "No valorado"];
  const IAAS_SECRETION_TYPE_OPTIONS = ["", "Serosa", "Serohemática", "Purulenta", "Verdosa", "Amarillenta", "Hemática", "Otra"];
  const IAAS_ORIGIN_OPTIONS = ["", "Probable casa", "Probable hemodiálisis", "Indeterminado", "Requiere cultivo"];
  const IAAS_VIRAL_PANEL_TESTS = ["VIH", "Hepatitis B", "Hepatitis C", "VDRL"];
  const IAAS_LIMITED_VIRAL_PANEL_TESTS = ["VIH", "Hepatitis B", "Hepatitis C"];
  const IAAS_CULTURE_TYPES = [
    "Hemocultivo central y periférico",
    "Hemocultivo central",
    "Hemocultivo periférico",
    "Hemocultivo periférico ambos brazos",
    "Hemocultivo central y periférico de ambos brazos",
    "Cultivo de punta de CVC",
    "Cultivo de secreción orificio de salida CVC",
    "Cultivo de secreción de inserción CVC",
    "Urocultivo",
    "Cultivo de secreción bronquial",
    "Cultivo de expectoración",
    "Cultivo de esputo",
    "Cultivo de herida"
  ];
  const IAAS_ANTIMICROBIALS = [
    "Amikacina",
    "Ampicilina",
    "Ampicilina-sulbactam",
    "Anfotericina B",
    "Anidulafungina",
    "Aztreonam",
    "Caspofungina",
    "Cefazolina",
    "Cefepime",
    "Cefotaxima",
    "Cefotetan",
    "Cefotixina",
    "Ceftarolina",
    "Ceftazidima",
    "Ceftazidima-avibactam",
    "Ceftolozane-tazobactam",
    "Ceftriaxona",
    "Ciprofloxacino",
    "Clindamicina",
    "Colistina",
    "Daptomicina",
    "Eritromicina",
    "Ertapenem",
    "Fluconazol",
    "Fosfomicina",
    "Gentamicina",
    "Imipenem",
    "Itraconazol",
    "Levofloxacino",
    "Linezolid",
    "Meropenem",
    "Metronidazol",
    "Micafungina",
    "Miconazol",
    "Nitrofurantoína",
    "Oxacilina",
    "Penicilina",
    "Piperacilina-tazobactam",
    "Posaconazol",
    "Rifampicina",
    "Tetraciclina",
    "Tigeciclina",
    "Trimetoprim-sulfametoxazol",
    "Voriconazol",
    "Vancomicina",
    "Cefalotina",
    "Norfloxacino",
    "Otro"
  ];

  const REQUIRED_COLUMNS = [
    "patient_id o paciente",
    "fecha_censo",
    "servicio/cama o servicio + cama",
    "edad",
    "sexo",
    "fecha_ingreso",
    "estado",
    "diagnostico_actual",
    "dx_epidemiologico",
    "observaciones"
  ];

  const COLUMN_ALIASES = {
    patient_id: ["patient_id", "paciente_id", "id_paciente", "expediente", "id", "folio"],
    patient_name: ["patient_name", "paciente", "nombre_paciente", "nombre", "nombre_completo"],
    rfc: ["rfc"],
    fecha_nacimiento: ["fecha_nacimiento", "nacimiento", "fecha_de_nacimiento"],
    fecha_censo: ["fecha_censo", "fecha", "censo_fecha"],
    servicio: ["servicio", "area", "área", "departamento"],
    servicio_cama: ["servicio_cama", "servicio/cama", "servicio cama", "servicio_y_cama", "servicio-cama"],
    cama: ["cama", "cama_actual", "numero_cama", "número_cama"],
    sector: ["sector", "derechohabiencia", "derecho_habiencia", "tipo_derechohabiente"],
    edad: ["edad"],
    sexo: ["sexo", "genero", "género"],
    fecha_ingreso: ["fecha_ingreso", "ingreso"],
    dx_epidemiologico: ["dx_epidemiologico", "dx_epidemiológico", "dx epidemiologico", "dx epidemiológico", "diagnostico_epidemiologico", "diagnóstico_epidemiológico", "clasificacion_epidemiologica", "clasificación_epidemiológica"],
    estado: ["estado", "estado_salud", "estado de salud", "estado_clinico", "estado clínico"],
    diagnostico_actual: ["diagnostico_actual", "diagnóstico_actual", "diagnostico", "diagnóstico", "dx", "dx_hospitalario", "dx hospitalario", "diagnosticos_hospitalarios", "diagnósticos hospitalarios"],
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
    importDate: isoToday(),
    importDraft: null,
    importProgress: "",
    importSaving: false,
    selectedService: "Todos",
    censusService: "Todos",
    censusQuery: "",
    monitorEpiService: "Todos",
    monitorEpiSector: "Todos",
    monitorEpiAgeRange: "Todos",
    monitorEpiSex: "Todos",
    monitorEpiSort: "service",
    monitorEpiDiagnosis: "Todos",
    monitorEpiQuery: "",
    monitorHospitalService: "Todos",
    monitorHospitalSector: "Todos",
    monitorHospitalAgeRange: "Todos",
    monitorHospitalSex: "Todos",
    monitorHospitalSort: "service",
    monitorHospitalDiagnosis: "Todos",
    monitorHospitalQuery: "",
    monitorEditDraft: null,
    monitorEditMode: "",
    dashboardSlide: 0,
    dashboardSlidePausedUntil: 0,
    dashboardSlideTimer: null,
    calendarView: "week",
    calendarDate: "",
    calendarDraftDate: "",
    calendarDraftStartTime: "08:00",
    calendarDraftEndTime: "09:00",
    calendarDraftTitle: "",
    calendarDraftCategory: "preventiva",
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
      errorDetail: "",
      lastWriteId: "",
      lastSyncAt: null,
      activeDate: "",
      lastSyncedAuditCount: 0,
      spreadsheetUrl: SHEETS_CONFIG.spreadsheetUrl || (SHEETS_CONFIG.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.spreadsheetId}/edit` : ""),
      isSyncing: false,
      connectAttemptId: 0,
      autoReconnectAttempted: false
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
    startDashboardSlideLoop();
    flushSyncQueue();
  }

  function startDashboardSlideLoop() {
    if (ui.dashboardSlideTimer) return;
    ui.dashboardSlideTimer = window.setInterval(() => {
      if (ui.route.page !== "dashboard") return;
      if (Date.now() < ui.dashboardSlidePausedUntil) return;
      advanceDashboardSlide();
    }, 7000);
  }

  function dashboardModuleCount() {
    const date = activeDate();
    return dashboardModules(computeStats(date), date).length;
  }

  function normalizeDashboardSlide(index) {
    const count = dashboardModuleCount();
    if (!count) return 0;
    return ((index % count) + count) % count;
  }

  function advanceDashboardSlide() {
    const count = dashboardModuleCount();
    if (count < 2) return;
    ui.dashboardSlide = normalizeDashboardSlide(ui.dashboardSlide + 1);
    syncDashboardSlideDom();
  }

  function syncDashboardSlideDom() {
    const track = document.querySelector(".command-module-track");
    if (!track) return false;
    const index = normalizeDashboardSlide(ui.dashboardSlide);
    track.style.setProperty("--feature-index", String(index));
    document.querySelectorAll(".module-dots button").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
      dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
    });
    return true;
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
      const repaired = mergePrivateSeedIntoStore(current);
      if (repaired !== current) {
        saveStore(repaired);
        return repaired;
      }
      return current;
    }
    const seeded = seedFromCurrentCensus();
    saveStore(seeded);
    return seeded;
  }

  function mergePrivateSeedIntoStore(current) {
    if (!hasPrivateCensusSeed()) return current;
    const seeded = seedFromCurrentCensus();
    const seedDate = Object.keys(seeded.dailyCensus || {})[0];
    if (!seedDate) return current;
    if (shouldReplaceWithPrivateSeed(current, seeded, seedDate)) {
      seeded.auditLogs = current.auditLogs || [];
      seeded.writeQueue = [];
      seeded.lastSavedAt = nowIso();
      return seeded;
    }
    let changed = false;
    const next = clone(current);
    next.patients ||= {};
    next.dailyCensus ||= {};
    next.dailyRounds ||= {};
    next.deviceEpisodes ||= {};
    next.auditLogs ||= [];
    next.writeQueue ||= [];
    Object.entries(seeded.patients || {}).forEach(([patientId, seedPatient]) => {
      if (!next.patients[patientId]) {
        next.patients[patientId] = seedPatient;
        changed = true;
        return;
      }
      if (fillMissingPatientFields(next.patients[patientId], seedPatient)) changed = true;
    });
    const seedCensus = seeded.dailyCensus[seedDate];
    if (!next.dailyCensus[seedDate]) {
      next.dailyCensus[seedDate] = seedCensus;
      changed = true;
    } else {
      next.dailyCensus[seedDate].patients ||= {};
      Object.entries(seedCensus.patients || {}).forEach(([patientId, seedRow]) => {
        if (!next.dailyCensus[seedDate].patients[patientId]) {
          next.dailyCensus[seedDate].patients[patientId] = seedRow;
          changed = true;
          return;
        }
        if (fillMissingCensusFields(next.dailyCensus[seedDate].patients[patientId], seedRow)) changed = true;
      });
      const total = Object.keys(next.dailyCensus[seedDate].patients || {}).length;
      if (next.dailyCensus[seedDate].totalRows !== total) {
        next.dailyCensus[seedDate].totalRows = total;
        next.dailyCensus[seedDate].totalPatientsDetected = total;
        changed = true;
      }
    }
    const seedRound = seeded.dailyRounds[seedDate];
    if (!next.dailyRounds[seedDate]) {
      next.dailyRounds[seedDate] = seedRound;
      changed = true;
    } else {
      next.dailyRounds[seedDate].entries ||= {};
      Object.entries(seedRound.entries || {}).forEach(([patientId, seedEntry]) => {
        if (!next.dailyRounds[seedDate].entries[patientId]) {
          next.dailyRounds[seedDate].entries[patientId] = seedEntry;
          changed = true;
        }
      });
      if (changed) recalculateSeededRound(next.dailyRounds[seedDate]);
    }
    Object.entries(seeded.deviceEpisodes || {}).forEach(([episodeId, episode]) => {
      if (!next.deviceEpisodes[episodeId]) {
        next.deviceEpisodes[episodeId] = episode;
        changed = true;
      }
    });
    if (!next.activeDate && !next.dailyCensus[isoToday()] && next.dailyCensus[seedDate]) {
      next.activeDate = seedDate;
      changed = true;
    }
    if (!changed) return current;
    next.lastSavedAt = nowIso();
    return next;
  }

  function shouldReplaceWithPrivateSeed(current, seeded, seedDate) {
    const seedIds = new Set(Object.keys(seeded.dailyCensus?.[seedDate]?.patients || {}));
    const currentIds = Object.keys(current.dailyCensus?.[seedDate]?.patients || {});
    if (!seedIds.size) return false;
    if (currentIds.length !== seedIds.size) return true;
    if (currentIds.some(patientId => !seedIds.has(patientId))) return true;
    return currentIds.some(patientId => {
      const currentRow = current.dailyCensus?.[seedDate]?.patients?.[patientId] || {};
      const seedRow = seeded.dailyCensus?.[seedDate]?.patients?.[patientId] || {};
      return cleanCell(currentRow.patientName) !== cleanCell(seedRow.patientName)
        || cleanCell(currentRow.service) !== cleanCell(seedRow.service)
        || cleanCell(currentRow.bed) !== cleanCell(seedRow.bed)
        || cleanCell(currentRow.diagnosis) !== cleanCell(seedRow.diagnosis)
        || cleanCell(currentRow.epidemiologicalDiagnosis) !== cleanCell(seedRow.epidemiologicalDiagnosis)
        || cleanCell(currentRow.observations) !== cleanCell(seedRow.observations);
    });
  }

  function fillMissingPatientFields(target, source) {
    return fillMissingFields(target, source, [
      "patientName",
      "hospitalInternalId",
      "currentService",
      "currentBed",
      "sector",
      "sex",
      "age",
      "admissionDate",
      "currentState",
      "currentDiagnosis",
      "epidemiologicalDiagnosis",
      "observations",
      "currentRiskLevel",
      "hospitalizationStatus",
      "latestCensusDate"
    ]);
  }

  function fillMissingCensusFields(target, source) {
    return fillMissingFields(target, source, [
      "patientName",
      "service",
      "bed",
      "sector",
      "age",
      "sex",
      "admissionDate",
      "state",
      "diagnosis",
      "epidemiologicalDiagnosis",
      "observations"
    ]);
  }

  function fillMissingFields(target, source, fields) {
    let changed = false;
    fields.forEach(field => {
      if (isBlankValue(target[field]) && !isBlankValue(source[field])) {
        target[field] = source[field];
        changed = true;
      }
    });
    return changed;
  }

  function isBlankValue(value) {
    return value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);
  }

  function recalculateSeededRound(round) {
    const entries = Object.values(round.entries || {});
    round.totalPatients = entries.length;
    round.reviewedPatients = entries.filter(entry => ["revisado", "alerta"].includes(entry.status)).length;
    round.pendingPatients = entries.filter(entry => entry.status === "pendiente").length;
    round.incompletePatients = entries.filter(entry => entry.status === "incompleto").length;
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
        renderSheetsNotice(),
        content
      ])
    ]);
  }

  function renderSidebar(active) {
    const nav = [
      ["dashboard", "Centro de Vigilancia"],
      ["monitoreo-epidemiologico", "Monitoreo Epidemiológico"],
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
        h("button", { class: "iaas-button ghost", onclick: printEpidemiologicalCensusFromSheets }, [commandIcon("print"), "Imprimir"]),
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
        h("button", { class: "iaas-button ghost", onclick: printEpidemiologicalCensusFromSheets }, [commandIcon("print"), "Imprimir"]),
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
      return h("button", { class: "iaas-button ghost", onclick: cancelSheetsConnection, title: "Cancelar autorizacion de Google Sheets" }, [commandIcon("alert"), "Cancelar Sheets"]);
    }
    if (ui.sheets.connected) {
      const label = pendingQueue().length ? "Sincronizar Sheets" : "Recargar Sheets";
      return h("button", { class: "iaas-button ghost", onclick: () => syncOrReloadSheets() }, [commandIcon("cloud"), label]);
    }
    return h("button", { class: "iaas-button primary", onclick: connectSheets }, [commandIcon("cloud"), "Conectar Sheets"]);
  }

  function renderSheetsNotice() {
    if (!ui.sheets.enabled || !ui.firebase.user || ui.firebase.denied) return "";
    if (!["connecting", "error", "sync_conflict"].includes(ui.sheets.status)) return "";
    const isError = ui.sheets.status === "error" || ui.sheets.status === "sync_conflict";
    const title = ui.sheets.status === "sync_conflict"
      ? "Conflicto de Google Sheets"
      : isError
        ? "No se pudo conectar Google Sheets"
        : "Autorizando Google Sheets";
    const message = ui.sheets.errorDetail || ui.sheets.error || (isError
      ? "Reintenta la autorizacion y copia el detalle si vuelve a fallar."
      : "Completa la ventana de Google. Si no aparece, cancela y reintenta en Chrome.");
    const actions = ui.sheets.status === "connecting"
      ? [h("button", { class: "iaas-button ghost compact", type: "button", onclick: cancelSheetsConnection }, ["Cancelar"])]
      : [
          h("button", { class: "iaas-button primary compact", type: "button", onclick: connectSheets }, ["Reintentar"]),
          h("button", { class: "iaas-button ghost compact", type: "button", onclick: copySheetsError }, ["Copiar error"]),
          h("a", { class: "iaas-button ghost compact", href: ui.sheets.spreadsheetUrl, target: "_blank", rel: "noopener" }, ["Abrir hoja"])
        ];
    return h("section", { class: `sheets-notice ${isError ? "error" : "warn"}` }, [
      h("div", {}, [
        h("strong", {}, [title]),
        h("span", {}, [message])
      ]),
      h("div", { class: "sheets-notice-actions" }, actions)
    ]);
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
    if (page === "monitoreo-epidemiologico") return renderEpidemiologicalMonitoringPage();
    if (page === "importar-censo") return renderImportPage();
    if (page === "ronda" && parts[2] === "paciente" && parts[3]) return renderPatientRound(parts[1] || activeDate(), parts[3], parts[4] || null);
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
          h("h1", {}, ["Centro de Vigilancia"])
        ])
      ]),
      renderCommandFeatureRail(stats, date),
      renderCommandMetrics(stats, date),
      renderCommandNotificationPanels(stats, date),
      renderCommandCalendar(date)
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
    const surveillancePatients = epi.iaas + epi.riesgo + epi.vig;
    const metrics = [
      { label: "Pacientes en vigilancia", value: surveillancePatients, note: "IAAS, riesgo y VIG", tone: "blue", icon: "shield" },
      { label: "IAAS activas", value: epi.iaas, note: `${epi.riesgo} en riesgo`, tone: "pink", icon: "alert" },
      { label: "VIG activas", value: epi.vig, note: "Transmisibles y no transmisibles", tone: "green", icon: "info" },
      { label: "Total pacientes", value: stats.totalPatients, note: "Censo hospitalario", tone: "cyan", icon: "check" }
    ];
    return h("section", { class: "command-metric-row" }, metrics.map(metric =>
      h("article", { class: `command-metric-card ${metric.tone}` }, [
        h("i", {}, [commandIcon(metric.icon)]),
        h("div", {}, [
          h("span", {}, [metric.label]),
          h("strong", {}, [String(metric.value)]),
          h("small", {}, [metric.note])
        ])
      ])
    ));
  }

  function renderEpidemiologicalMonitoringPage() {
    return h("div", { class: "iaas-page epidemiological-monitor-page" }, [
      renderEpidemiologicalMonitoringPanel(activeDate())
    ]);
  }

  function renderEpidemiologicalMonitoringPanel(date) {
    const rows = monitoringRows(date);
    const taggedRows = rows.filter(item => item.hasEpidemiologicalTag);
    const selectedEpiRows = applyMonitoringFilters(taggedRows, "epi");
    const selectedHospitalRows = applyMonitoringFilters(rows, "hospital");
    const visibleEpiRows = applyMonitoringSearch(selectedEpiRows, "epi");
    const visibleHospitalRows = applyMonitoringSearch(selectedHospitalRows, "hospital");
    const tagTotals = EPIDEMIOLOGICAL_TAGS.map(tag => ({
      ...tag,
      total: monitoringTagTotal(tag.key, taggedRows)
    }));
    return h("section", { class: "command-panel epidemiological-monitor" }, [
      h("div", { class: "command-panel-head epidemiological-monitor-head" }, [
        h("div", {}, [
          h("h2", {}, ["Monitoreo Epidemiológico"]),
          h("p", {}, [`${taggedRows.length} paciente(s) en censo epidemiológico · ${rows.length} paciente(s) en censo hospitalario`])
        ]),
        hasPrivateCensusSeed() ? h("button", { class: "iaas-button ghost compact", type: "button", onclick: restorePrivateCensus }, ["Restaurar censo local"]) : ""
      ]),
      h("div", { class: "epi-tag-summary" }, tagTotals.map(tag =>
        h("span", { class: `epi-tag-chip ${tag.tone}` }, [
          h("strong", {}, [String(tag.total)]),
          tag.label
        ])
      )),
      renderPatientEditorPanel(date),
      h("div", { class: "monitor-census-stack" }, [
        h("article", { class: "monitor-census-block epidemiological-census" }, [
          h("div", { class: "monitor-census-title" }, [
            h("div", {}, [
              h("h3", {}, ["Censo Epidemiológico"]),
              h("span", {}, [`${visibleEpiRows.length} de ${taggedRows.length} registro(s)`])
            ]),
            h("button", { class: "iaas-button primary compact", type: "button", onclick: () => openNewMonitoringPatientDraft("epi") }, [commandIcon("plus"), "Agregar paciente"])
          ]),
          renderMonitorFilters("epi", taggedRows.length, visibleEpiRows.length, true),
          selectedEpiRows.length ? renderMonitoringTable(selectedEpiRows, true, "epi") : renderMonitorEmpty("Sin pacientes con etiquetas epidemiológicas en los filtros actuales.")
        ]),
        h("article", { class: "monitor-census-block hospital-census" }, [
          h("div", { class: "monitor-census-title" }, [
            h("div", {}, [
              h("h3", {}, ["Censo Hospitalario"]),
              h("span", {}, [`${visibleHospitalRows.length} de ${rows.length} registro(s)`])
            ]),
            h("button", { class: "iaas-button ghost compact", type: "button", onclick: () => openNewMonitoringPatientDraft("hospital") }, [commandIcon("plus"), "Agregar paciente"])
          ]),
          renderMonitorFilters("hospital", rows.length, visibleHospitalRows.length, true),
          selectedHospitalRows.length ? renderMonitoringTable(selectedHospitalRows, false, "hospital") : renderMonitorEmpty("Sin censo hospitalario cargado en los filtros actuales.")
        ])
      ])
    ]);
  }

  function renderMonitoringTable(items, epidemiologicalOnly, scope) {
    const headers = epidemiologicalOnly
      ? ["Servicio", "Datos del paciente", "Edad / sexo", "Estado", "Ingreso", "Diagnósticos hospitalarios", "Diagnósticos epidemiológicos", "Observaciones"]
      : ["Servicio", "Datos del paciente", "Edad / sexo", "Estado", "Ingreso", "Diagnósticos hospitalarios", "Observaciones"];
    return h("div", { class: "monitor-census-scroll" }, [
      h("table", { class: `iaas-table monitoring-census-table ${epidemiologicalOnly ? "epi" : "hospital"}` }, [
        h("thead", {}, [h("tr", {}, headers.map(label => h("th", {}, [label])))]),
        h("tbody", {}, items.map((item, index) =>
          epidemiologicalOnly
            ? renderEpidemiologicalMonitorRow(item, items[index - 1], scope)
            : renderHospitalMonitorRow(item, items[index - 1], scope)
        ))
      ])
    ]);
  }

  function renderEpidemiologicalMonitorRow(item, previousItem, scope) {
    const serviceBreak = previousItem && previousItem.service !== item.service ? "service-break" : "";
    const searchMatch = monitoringSearchMatches(item, scope);
    return h("tr", {
      class: `monitor-row ${serviceBreak} ${searchMatch ? "" : "search-hidden"} ${item.tags.map(tag => tag.tone).join(" ")}`,
      hidden: !searchMatch,
      "data-monitor-scope": scope,
      "data-monitor-search": normalizeText(monitoringSearchText(item))
    }, [
      h("td", { class: "monitor-service-cell", "data-label": "Servicio" }, [renderServicePill(item.service)]),
      h("td", { class: "monitor-patient-cell", "data-label": "Datos del paciente" }, [renderPatientInfoCell(item, {
        includeMissingWarning: true,
        showEpiFlag: false,
        showRfc: false
      })]),
      h("td", { class: "monitor-age-sex-cell", "data-label": "Edad / sexo" }, [renderAgeSexCell(item)]),
      h("td", { class: "monitor-state-cell", "data-label": "Estado" }, [renderStateCell(item)]),
      h("td", { class: "monitor-admission-cell", "data-label": "Ingreso" }, [renderAdmissionCell(item)]),
      h("td", { "data-label": "Diagnósticos hospitalarios" }, [renderHospitalDiagnosisCell(item)]),
      h("td", { class: "monitor-epi-diagnosis-cell", "data-label": "Diagnósticos epidemiológicos" }, [renderEpiDiagnosisChips(item)]),
      h("td", { "data-label": "Observaciones" }, [
        h("div", { class: "monitor-observation-cell" }, [
          renderDotList(item.observations || "Sin observaciones", "monitor-dot-list observation-dot-list", Infinity),
          renderMonitorEditButton(item, "epi")
        ])
      ])
    ]);
  }

  function renderHospitalMonitorRow(item, previousItem, scope) {
    const serviceBreak = previousItem && previousItem.service !== item.service ? "service-break" : "";
    const searchMatch = monitoringSearchMatches(item, scope);
    return h("tr", {
      class: `monitor-row ${serviceBreak} ${searchMatch ? "" : "search-hidden"} ${item.hasEpidemiologicalTag ? "epidemiological-highlight" : ""}`,
      hidden: !searchMatch,
      "data-monitor-scope": scope,
      "data-monitor-search": normalizeText(monitoringSearchText(item))
    }, [
      h("td", { class: "monitor-service-cell", "data-label": "Servicio" }, [renderServicePill(item.service)]),
      h("td", { class: "monitor-patient-cell", "data-label": "Datos del paciente" }, [renderPatientInfoCell(item, {
        includeMissingWarning: false,
        showEpiFlag: true,
        showRfc: true,
        showBirthDate: true
      })]),
      h("td", { class: "monitor-age-sex-cell", "data-label": "Edad / sexo" }, [renderAgeSexCell(item)]),
      h("td", { class: "monitor-state-cell", "data-label": "Estado" }, [renderStateCell(item)]),
      h("td", { class: "monitor-admission-cell", "data-label": "Ingreso" }, [renderAdmissionCell(item)]),
      h("td", { "data-label": "Diagnósticos hospitalarios" }, [renderHospitalDiagnosisCell(item)]),
      h("td", { "data-label": "Observaciones" }, [
        h("div", { class: "monitor-observation-cell" }, [
          h("div", {}, [
            item.hasEpidemiologicalTag ? h("div", { class: "row-epi-marker" }, [renderEpiDiagnosisChips(item)]) : "",
            renderDotList(item.observations || "Sin observaciones", "monitor-dot-list observation-dot-list", Infinity)
          ]),
          renderMonitorEditButton(item, "hospital")
        ])
      ])
    ]);
  }

  function renderEpidemiologicalTagList(tags) {
    return tags.length
      ? h("div", { class: "epi-tag-list" }, tags.map(tag => h("span", { class: `epi-tag-chip ${tag.tone}` }, [tag.label])))
      : h("span", { class: "epi-tag-chip epi-neutral" }, ["Sin etiqueta"]);
  }

  function monitoringRows(date) {
    return hospitalCensusRows(date)
      .map(item => enrichMonitoringItem(item, date))
      .sort(monitoringSortCompare("service"));
  }

  function enrichMonitoringItem(item, date) {
    const { row, patient } = item;
    const service = normalizeService(row.service || patient.currentService || "");
    const sector = patient.sector || row.sector || "";
    const admissionDate = patient.admissionDate || row.admissionDate || "";
    const epiText = epidemiologicalText(item);
    const tags = epidemiologicalTagsForItem(item);
    const bases = epidemiologicalBasesForText(epiText);
    const dxHospital = patient.currentDiagnosis || row.diagnosis || "";
    const observations = patient.observations || row.observations || row.notes || "";
    return {
      ...item,
      service: service || "SIN SERVICIO",
      bed: row.bed || patient.currentBed || "S/C",
      patientName: cleanCell(patient.patientName || row.patientName).toUpperCase(),
      sector,
      sectorLabel: sectorLabel(sector),
      age: patient.age ?? row.age ?? "",
      sex: patient.sex || row.sex || "",
      admissionDate,
      deih: isAmbulatoryStayService(service) ? null : daysBetween(admissionDate, date),
      state: displayState(patient.currentState || row.state || patient.currentRiskLevel || "Sin estado"),
      dxHospital,
      observations,
      epiText,
      tags,
      epiBases: bases,
      hasEpidemiologicalTag: tags.length > 0 || bases.length > 0,
      rfc: patient.rfc || patient.hospitalInternalId || row.rfc || "",
      birthDate: patient.birthDate || patient.fechaNacimiento || row.birthDate || ""
    };
  }

  function renderMonitorFilters(scope, total, visible, includeEpiFilter) {
    const prefix = monitorPrefix(scope);
    return h("div", { class: "monitor-filter-row" }, [
      h("label", { class: "monitor-search" }, [
        h("span", {}, ["Buscar paciente"]),
        h("input", {
          id: `${scope}-monitor-search`,
          value: ui[`${prefix}Query`],
          placeholder: "Nombre, cama, diagnóstico u observación",
          oninput: event => {
            ui[`${prefix}Query`] = event.target.value;
            applyMonitorSearchDom(scope);
          }
        })
      ]),
      renderMonitorSelect(scope, "Service", "Servicio", ["Todos", ...SERVICES]),
      renderMonitorSelect(scope, "Sector", "Sector", ["Todos", ...SECTOR_OPTIONS.map(item => item.value)], value => value === "Todos" ? "Todos los sectores" : `${value} · ${sectorLabel(value)}`),
      renderMonitorSelect(scope, "AgeRange", "Edad", ["Todos", ...AGE_RANGES.map(item => item.value)], value => value === "Todos" ? "Todas las edades" : AGE_RANGES.find(item => item.value === value)?.label || value),
      renderMonitorSelect(scope, "Sex", "Sexo", ["Todos", ...SEX_OPTIONS], value => value === "Todos" ? "Todos" : value),
      renderMonitorSelect(scope, "Sort", "Orden", MONITOR_SORTS.map(item => item.value), value => MONITOR_SORTS.find(item => item.value === value)?.label || value),
      includeEpiFilter ? renderMonitorSelect(scope, "Diagnosis", "Dx epidemiológico", ["Todos", ...EPIDEMIOLOGICAL_TAGS.map(item => item.label)], value => value === "Todos" ? "Todas las etiquetas" : value) : "",
      h("span", { class: "monitor-filter-count", "data-monitor-count": scope, "data-monitor-total": String(total) }, [`${visible} / ${total}`])
    ]);
  }

  function renderMonitorSelect(scope, key, label, values, labelFor = value => value) {
    const prefix = monitorPrefix(scope);
    const stateKey = `${prefix}${key}`;
    return h("label", { class: "monitor-select" }, [
      h("span", {}, [label]),
      h("select", { onchange: event => { ui[stateKey] = event.target.value; renderIaas(); } }, values.map(value => option(value, labelFor(value), ui[stateKey] === value)))
    ]);
  }

  function monitorPrefix(scope) {
    return scope === "epi" ? "monitorEpi" : "monitorHospital";
  }

  function applyMonitoringFilters(items, scope) {
    const prefix = monitorPrefix(scope);
    const service = ui[`${prefix}Service`];
    const sector = ui[`${prefix}Sector`];
    const ageRange = ui[`${prefix}AgeRange`];
    const sex = ui[`${prefix}Sex`];
    const diagnosis = ui[`${prefix}Diagnosis`];
    return items
      .filter(item => service === "Todos" || normalizeText(item.service) === normalizeText(service))
      .filter(item => sector === "Todos" || normalizeText(item.sector) === normalizeText(sector))
      .filter(item => ageRange === "Todos" || ageRangeMatches(item.age, ageRange))
      .filter(item => sex === "Todos" || normalizeText(formatSex(item.sex)) === normalizeText(sex))
      .filter(item => diagnosis === "Todos" || item.epiBases.some(base => normalizeText(base) === normalizeText(diagnosis)))
      .sort(monitoringSortCompare(ui[`${prefix}Sort`]));
  }

  function applyMonitoringSearch(items, scope) {
    return items.filter(item => monitoringSearchMatches(item, scope));
  }

  function monitoringSearchMatches(item, scope) {
    const query = normalizeText(ui[`${monitorPrefix(scope)}Query`]);
    return !query || normalizeText(monitoringSearchText(item)).includes(query);
  }

  function monitoringSearchText(item) {
    return [
      item.service,
      item.bed,
      item.patientName,
      item.sector,
      item.sectorLabel,
      item.age,
      item.sex,
      item.state,
      item.dxHospital,
      item.epiText,
      item.observations,
      item.rfc
    ].filter(Boolean).join(" ");
  }

  function applyMonitorSearchDom(scope) {
    const query = normalizeText(ui[`${monitorPrefix(scope)}Query`]);
    const rows = [...document.querySelectorAll(`tr[data-monitor-scope="${scope}"]`)];
    let visible = 0;
    rows.forEach(row => {
      const match = !query || String(row.dataset.monitorSearch || "").includes(query);
      row.hidden = !match;
      row.classList.toggle("search-hidden", !match);
      if (match) visible += 1;
    });
    const count = document.querySelector(`[data-monitor-count="${scope}"]`);
    if (count) count.textContent = `${visible} / ${count.dataset.monitorTotal || rows.length}`;
  }

  function ageRangeMatches(value, rangeValue) {
    const age = parseAge(value);
    const range = AGE_RANGES.find(item => item.value === rangeValue);
    if (!range || age === null) return false;
    return age >= range.min && age <= range.max;
  }

  function monitoringSortCompare(sort) {
    return (a, b) => {
      if (sort === "deih-desc") return (b.deih ?? -1) - (a.deih ?? -1) || sortByServiceBed(a.row, b.row);
      if (sort === "deih-asc") return (a.deih ?? 9999) - (b.deih ?? 9999) || sortByServiceBed(a.row, b.row);
      if (sort === "state-asc") return stateRank(a.state) - stateRank(b.state) || sortByServiceBed(a.row, b.row);
      if (sort === "state-desc") return stateRank(b.state) - stateRank(a.state) || sortByServiceBed(a.row, b.row);
      return sortByServiceBed(a.row, b.row);
    };
  }

  function stateRank(state) {
    const key = normalizeText(state);
    const index = STATE_OPTIONS.findIndex(item => normalizeText(item) === key);
    return index >= 0 ? index : STATE_OPTIONS.length;
  }

  function monitoringTagTotal(key, items) {
    const base = {
      iaas: "IAAS",
      noIaas: "NO IAAS",
      riesgoIaas: "RIESGO IAAS",
      vigTransmisible: "VIG TRANSMISIBLE",
      vigNoTransmisible: "VIG NO TRANSMISIBLE",
      esavi: "ESAVI",
      covidInfluenza: "COVID/INFLUENZA",
      morbimortalidad: "MORBIMORTALIDAD MATERNA/PERINATAL"
    }[key];
    if (!base) return 0;
    if (key === "iaas") return items.reduce((sum, item) => sum + iaasCountForText(item.epiText), 0);
    return items.filter(item => item.epiBases.some(active => normalizeText(active) === normalizeText(base))).length;
  }

  function epidemiologicalBasesForText(value) {
    const text = normalizeText(value);
    const bases = [];
    if (text.includes("COVID") || text.includes("INFLUENZA")) bases.push("COVID/INFLUENZA");
    if (text.includes("ESAVI")) bases.push("ESAVI");
    if (text.includes("VIG TRANSMISIBLE")) bases.push("VIG TRANSMISIBLE");
    if (text.includes("VIG NO TRANSMISIBLE")) bases.push("VIG NO TRANSMISIBLE");
    if (text.includes("NO IAAS")) bases.push("NO IAAS");
    if (text.includes("RIESGO IAAS")) bases.push("RIESGO IAAS");
    if (iaasCountForText(value) > 0) bases.push("IAAS");
    if (text.includes("MORBIMORTALIDAD") || text.includes("MATERNA") || text.includes("PERINATAL")) bases.push("MORBIMORTALIDAD MATERNA/PERINATAL");
    return unique(bases);
  }

  function iaasCountForText(value) {
    const text = normalizeText(value);
    if (!text || text.includes("NO IAAS") || text.includes("RIESGO IAAS")) return 0;
    const match = text.match(/\b([1-4])\s+IAAS\b/);
    if (match) return Number(match[1]);
    return text.includes("IAAS") ? 1 : 0;
  }

  function renderServicePill(service) {
    const normalized = normalizeService(service);
    const color = SERVICE_COLORS[normalized] || "#e8f0ff";
    const labelLines = serviceDisplayLines(normalized);
    return h("span", { class: "service-pill", title: normalized || "Sin servicio", style: `--service-bg:${color}` }, [
      h("span", { class: "service-pill-dot" }, []),
      h("span", { class: "service-pill-label" }, labelLines.map(line => h("span", {}, [line])))
    ]);
  }

  function serviceDisplayLabel(service) {
    const normalized = normalizeService(service);
    if (normalizeText(normalized) === "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES") return "UCIN";
    if (normalizeText(normalized) === "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS") return "UCIP";
    if (normalizeText(normalized) === "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS") return "UCIP";
    if (normalizeText(normalized) === "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS") return "UCIA";
    return normalized || "SIN SERVICIO";
  }

  function serviceDisplayLines(service) {
    const label = serviceDisplayLabel(service);
    const key = normalizeText(label);
    if (key === "MEDICINA INTERNA") return ["MEDICINA", "INTERNA"];
    if (key === "CIRUGIA Y TRAUMATOLOGIA") return ["CIRUGÍA Y", "TRAUMATOLOGÍA"];
    if (key === "GINECOLOGIA Y OBSTETRICIA") return ["GINECOLOGÍA Y", "OBSTETRICIA"];
    return [label];
  }

  function renderPatientInfoCell(item, options = {}) {
    const { includeMissingWarning = false, showEpiFlag = false, showRfc = false, showBirthDate = false } = options;
    return h("div", { class: "monitor-patient-stack" }, [
      h("strong", { class: "monitor-patient-name" }, [item.patientName]),
      h("small", {}, [`Cama ${item.bed} · ${item.sectorLabel || "Sector no capturado"}`]),
      showBirthDate && item.birthDate ? h("small", {}, [`Nac. ${formatDisplayDate(item.birthDate)}`]) : "",
      showRfc && item.rfc ? h("small", {}, [`RFC ${item.rfc}`]) : "",
      showEpiFlag && item.hasEpidemiologicalTag ? h("small", { class: "epi-row-flag" }, ["Con diagnóstico epidemiológico"]) : "",
      includeMissingWarning ? renderMissingDataWarning(item) : ""
    ]);
  }

  function renderAgeSexCell(item, includeBirthDate = false) {
    return h("div", { class: "monitor-age-sex" }, [
      h("strong", {}, [
        h("span", { class: "monitor-age-value" }, [item.age || "S/E"]),
        renderSexBadge(item.sex)
      ]),
      includeBirthDate && item.birthDate ? h("small", {}, [`Nac. ${formatDisplayDate(item.birthDate)}`]) : ""
    ]);
  }

  function renderSexBadge(value) {
    const sex = sexAbbreviation(value);
    return h("span", { class: `sex-square sex-${sex === "F" ? "f" : sex === "M" ? "m" : "unknown"}` }, [sex]);
  }

  function renderStateCell(item) {
    return h("span", { class: `monitor-state-badge ${stateClass(item.state)}` }, [item.state || "SIN ESTADO"]);
  }

  function renderAdmissionCell(item) {
    const ambulatory = isAmbulatoryStayService(item.service);
    return h("div", { class: "monitor-admission" }, [
      h("strong", {}, [formatDisplayDate(item.admissionDate) || "NA"]),
      !ambulatory && item.deih !== null && item.deih !== undefined
        ? h("small", {}, [stayDaysLabel(item.deih)])
        : ""
    ]);
  }

  function renderHospitalDiagnosisCell(item) {
    const tags = clinicalTagsForText(`${item.dxHospital} ${item.observations}`);
    return h("div", { class: "diagnosis-stack" }, [
      tags.length ? h("div", { class: "clinical-tag-list" }, tags.map(tag => h("span", { class: `clinical-tag ${tag.tone}` }, [tag.label, tag.cross ? h("b", {}, ["✝"]) : ""]))) : "",
      renderDotList(item.dxHospital || "Sin diagnóstico hospitalario", "monitor-dot-list diagnosis-dot-list", Infinity)
    ]);
  }

  function renderDotList(value, className = "monitor-dot-list", limit = 220) {
    const text = Number.isFinite(limit) ? truncateText(value, limit) : cleanCell(value);
    const segments = splitDotSegments(text);
    return h("ul", { class: className }, segments.map(segment => h("li", {}, [segment])));
  }

  function splitDotSegments(value) {
    const cleaned = cleanCell(value);
    if (!cleaned) return ["Sin datos"];
    const segments = cleaned
      .split(/\s*(?:\/|;|\n|\. (?=[A-ZÁÉÍÓÚÑ0-9]))\s*/i)
      .map(item => item.trim())
      .filter(Boolean);
    return segments.length ? segments : [cleaned];
  }

  function clinicalTagsForText(value) {
    const text = normalizeText(value);
    const tags = [];
    if (/\b(HAS|HTA)\b/.test(text) || text.includes("HIPERTENSION")) tags.push({ label: "Hipertensión arterial sistémica", tone: "has" });
    if (/\b(DM|DMT|DM1|DM2)\b/.test(text) || text.includes("DIABETES")) tags.push({ label: "Diabetes mellitus", tone: "dm" });
    if (/\bERC\b/.test(text) || text.includes("RENAL CRONICA")) tags.push({ label: "Enfermedad renal crónica", tone: "erc" });
    if (text.includes("HIPOTIROID")) tags.push({ label: "Hipotiroidismo", tone: "hipo" });
    if (text.includes("CANCER") || text.includes("ONCO") || text.includes("TUMOR")) tags.push({ label: "Cáncer", tone: "cancer" });
    if (text.includes("DEFUNCION") || text.includes("DEFUNCIÓN")) tags.push({ label: "Defunción", tone: "defuncion", cross: true });
    return unique(tags.map(tag => JSON.stringify(tag))).map(item => JSON.parse(item));
  }

  function renderEpiDiagnosisChips(item) {
    const labels = splitEpiDiagnosisLabels(item.epiText);
    return labels.length
      ? h("div", { class: "epi-tag-list diagnosis-tags" }, labels.map(label => h("span", { class: `epi-tag-chip ${epidemiologicalComboClass(label)}` }, [label])))
      : renderEpidemiologicalTagList(item.tags);
  }

  function splitEpiDiagnosisLabels(value) {
    return cleanCell(value).split(/\n|;/).map(item => item.trim()).filter(Boolean).slice(0, 4);
  }

  function epidemiologicalComboClass(value) {
    const text = normalizeText(value);
    if (text.includes("/") && text.includes("VIG") && text.includes("IAAS")) return "epi-gradient-vig-iaas";
    if (text.includes("/") && text.includes("VIG") && text.includes("RIESGO")) return "epi-gradient-vig-riesgo";
    if (text.includes("/") && text.includes("VIG") && text.includes("NO IAAS")) return "epi-gradient-vig-no-iaas";
    return epiClass(value);
  }

  function renderMissingDataWarning(item) {
    const missing = missingPatientFields(item);
    if (!missing.length) return "";
    const service = item.epiBases.includes("IAAS") ? "IAAS" : item.epiBases.some(base => base.startsWith("VIG")) ? "VIG" : "Epidemiología";
    return h("small", { class: "missing-data-alert" }, [`${service}: faltan datos (${missing.join(", ")})`]);
  }

  function missingPatientFields(item) {
    const missing = [];
    if (!cleanCell(item.service) || item.service === "SIN SERVICIO") missing.push("servicio");
    if (!cleanCell(item.bed) || item.bed === "S/C") missing.push("cama");
    if (!cleanCell(item.sector)) missing.push("sector");
    if (!cleanCell(item.age)) missing.push("edad");
    if (!cleanCell(item.sex)) missing.push("sexo");
    if (!isAmbulatoryStayService(item.service) && !cleanCell(item.admissionDate)) missing.push("ingreso");
    if (!cleanCell(item.state) || normalizeText(item.state) === "SIN ESTADO") missing.push("estado");
    if (!cleanCell(item.dxHospital)) missing.push("dx hospitalario");
    return missing;
  }

  function formatSex(value) {
    const key = normalizeText(value);
    if (["M", "MASCULINO", "HOMBRE"].includes(key)) return "MASCULINO";
    if (["F", "FEMENINO", "MUJER"].includes(key)) return "FEMENINO";
    return "S/S";
  }

  function sexAbbreviation(value) {
    const key = normalizeText(formatSex(value));
    if (key === "MASCULINO") return "M";
    if (key === "FEMENINO") return "F";
    return "S/S";
  }

  function stayDaysLabel(value) {
    const days = Number(value);
    if (!Number.isFinite(days)) return "";
    return `${days} ${days === 1 ? "día" : "días"}`;
  }

  function isAmbulatoryStayService(service) {
    return ["AMBULATORIO", "HEMODIALISIS", "HEMODIÁLISIS", "ONCOLOGIA", "ONCOLOGÍA"].includes(normalizeText(service));
  }

  function formatDisplayDate(value) {
    const iso = normalizeDate(value);
    if (!iso) return "";
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }

  function renderMonitorEditButton(item, mode) {
    return h("button", {
      class: "monitor-edit-button",
      type: "button",
      title: "Editar paciente",
      onclick: () => openMonitoringPatientDraft(item.row.patientId, mode)
    }, [commandIcon("pen")]);
  }

  function renderPatientEditorPanel(date) {
    const draft = ui.monitorEditDraft;
    if (!draft) return "";
    const title = draft.patientId ? "Editar paciente" : "Agregar paciente";
    return h("article", { class: "monitor-editor-panel" }, [
      h("div", { class: "monitor-editor-head" }, [
        h("div", {}, [
          h("h3", {}, [title]),
          h("p", {}, [draft.censusType === "epi" ? "Censo epidemiológico" : "Censo hospitalario"])
        ]),
        h("button", { class: "iaas-button ghost compact", type: "button", onclick: closeMonitoringEditor }, ["Cerrar"])
      ]),
      requiresOpdNotification(draft) ? h("div", { class: "opd-alert" }, [
        h("strong", {}, ["OPD"]),
        h("span", {}, [`SUBIR A ${fullNameFromDraft(draft) || "X PACIENTE"} A LA PLATAFORMA OPD`])
      ]) : "",
      h("div", { class: "monitor-form-grid" }, [
        h("label", { class: "field" }, [h("span", {}, ["Censo"]), h("select", { onchange: event => { patchMonitoringDraft({ censusType: event.target.value }, true); } }, [
          option("hospital", "Hospitalario", draft.censusType === "hospital"),
          option("epi", "Epidemiológico", draft.censusType === "epi")
        ])]),
        h("label", { class: "field" }, [h("span", {}, ["Servicio"]), h("select", { onchange: event => { patchMonitoringDraft({ service: event.target.value }, true); } }, [
          option("", "Sin servicio", !draft.service),
          ...SERVICES.map(service => option(service, service, draft.service === service))
        ])]),
        h("label", { class: "field" }, [h("span", {}, ["Cama"]), h("input", { value: draft.bed || "", oninput: event => patchMonitoringDraft({ bed: event.target.value }) })]),
        h("label", { class: "field" }, [h("span", {}, ["Sector"]), h("select", { onchange: event => patchMonitoringDraft({ sector: event.target.value }, true) }, [
          option("", "Sin sector", !draft.sector),
          ...SECTOR_OPTIONS.map(item => option(item.value, `${item.short} · ${item.label}`, draft.sector === item.value))
        ])]),
        h("label", { class: "field" }, [h("span", {}, ["Apellido paterno"]), h("input", { value: draft.apellidoPaterno || "", oninput: event => patchMonitoringDraftName(event, "apellidoPaterno") })]),
        h("label", { class: "field" }, [h("span", {}, ["Apellido materno"]), h("input", { value: draft.apellidoMaterno || "", oninput: event => patchMonitoringDraftName(event, "apellidoMaterno") })]),
        h("label", { class: "field" }, [h("span", {}, ["Nombre(s)"]), h("input", { value: draft.nombres || "", oninput: event => patchMonitoringDraftName(event, "nombres") })]),
        h("label", { class: "field" }, [h("span", {}, ["Edad"]), h("input", { value: draft.age || "", oninput: event => patchMonitoringDraft({ age: event.target.value }) })]),
        h("label", { class: "field" }, [h("span", {}, ["Sexo"]), h("select", { onchange: event => patchMonitoringDraft({ sex: event.target.value }, true) }, [
          option("", "Sin sexo", !draft.sex),
          ...SEX_OPTIONS.map(item => option(item, item, formatSex(draft.sex) === item))
        ])]),
        h("label", { class: "field" }, [h("span", {}, ["Ingreso"]), h("input", { type: "date", value: draft.admissionDate || "", oninput: event => patchMonitoringDraft({ admissionDate: event.target.value }, true) })]),
        h("label", { class: "field" }, [h("span", {}, ["Estado"]), h("select", { onchange: event => patchMonitoringDraft({ state: event.target.value }, true) }, [
          option("", "Sin estado", !draft.state),
          ...STATE_OPTIONS.map(item => option(item, item, normalizeText(draft.state) === normalizeText(item)))
        ])]),
        h("label", { class: "field" }, [h("span", {}, ["RFC"]), h("input", { value: draft.rfc || "", oninput: event => patchMonitoringDraft({ rfc: event.target.value }) })]),
        h("label", { class: "field" }, [h("span", {}, ["Fecha nacimiento"]), h("input", { type: "date", value: draft.birthDate || "", oninput: event => patchMonitoringDraft({ birthDate: event.target.value }) })]),
        h("label", { class: "field full" }, [h("span", {}, ["Diagnósticos hospitalarios"]), h("textarea", { value: draft.dxHospital || "", oninput: event => patchMonitoringDraft({ dxHospital: event.target.value }) })]),
        h("label", { class: "field full" }, [h("span", {}, ["Diagnósticos epidemiológicos"]), h("select", { onchange: event => patchMonitoringDraft({ epiDiagnosis: event.target.value, censusType: event.target.value ? "epi" : draft.censusType }, true) }, [
          option("", "Sin diagnóstico epidemiológico", !draft.epiDiagnosis),
          ...EPIDEMIOLOGICAL_COMBOS.map(item => option(item, item, draft.epiDiagnosis === item))
        ])]),
        h("label", { class: "field full" }, [h("span", {}, ["Observaciones"]), h("textarea", { value: draft.observations || "", oninput: event => patchMonitoringDraft({ observations: event.target.value }) })])
      ]),
      h("div", { class: "monitor-editor-actions" }, [
        h("button", { class: "iaas-button ghost", type: "button", onclick: closeMonitoringEditor }, ["Cancelar"]),
        h("button", { class: "iaas-button primary", type: "button", onclick: () => saveMonitoringPatient(date) }, ["Guardar paciente"])
      ])
    ]);
  }

  function openNewMonitoringPatientDraft(mode) {
    ui.monitorEditMode = mode;
    ui.monitorEditDraft = {
      patientId: "",
      censusType: mode === "epi" ? "epi" : "hospital",
      service: "",
      bed: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      nombres: "",
      sector: "",
      age: "",
      sex: "",
      admissionDate: "",
      state: "",
      rfc: "",
      birthDate: "",
      dxHospital: "",
      epiDiagnosis: "",
      observations: ""
    };
    renderIaas();
  }

  function openMonitoringPatientDraft(patientId, mode) {
    const row = getCensusRows(activeDate()).find(item => item.patientId === patientId) || {};
    const patient = store.patients[patientId] || {};
    const item = enrichMonitoringItem({ row, patient }, activeDate());
    const parts = splitPatientName(item.patientName);
    ui.monitorEditMode = mode;
    ui.monitorEditDraft = {
      patientId,
      censusType: mode === "epi" || item.hasEpidemiologicalTag ? "epi" : "hospital",
      service: item.service === "SIN SERVICIO" ? "" : item.service,
      bed: item.bed === "S/C" ? "" : item.bed,
      apellidoPaterno: parts.apellidoPaterno,
      apellidoMaterno: parts.apellidoMaterno,
      nombres: parts.nombres,
      sector: item.sector || "",
      age: item.age || "",
      sex: formatSex(item.sex) === "S/S" ? "" : formatSex(item.sex),
      admissionDate: item.admissionDate || "",
      state: item.state === "SIN ESTADO" ? "" : item.state,
      rfc: patient.rfc || "",
      birthDate: patient.birthDate || patient.fechaNacimiento || "",
      dxHospital: item.dxHospital || "",
      epiDiagnosis: item.epiText || "",
      observations: item.observations || ""
    };
    renderIaas();
  }

  function patchMonitoringDraft(patch, rerender = false) {
    if (!ui.monitorEditDraft) return;
    ui.monitorEditDraft = { ...ui.monitorEditDraft, ...patch };
    if (rerender) renderIaas();
  }

  function patchMonitoringDraftName(event, key) {
    const value = cleanCell(event.target.value).toUpperCase();
    event.target.value = value;
    patchMonitoringDraft({ [key]: value });
  }

  function closeMonitoringEditor() {
    ui.monitorEditDraft = null;
    ui.monitorEditMode = "";
    renderIaas();
  }

  function splitPatientName(value) {
    const parts = cleanCell(value).split(/\s+/).filter(Boolean);
    return {
      apellidoPaterno: parts[0] || "",
      apellidoMaterno: parts[1] || "",
      nombres: parts.slice(2).join(" ")
    };
  }

  function fullNameFromDraft(draft) {
    return cleanCell([draft.apellidoPaterno, draft.apellidoMaterno, draft.nombres].filter(Boolean).join(" ")).toUpperCase();
  }

  function saveMonitoringPatient(date) {
    const draft = ui.monitorEditDraft;
    if (!draft) return;
    const patientId = draft.patientId || `manual_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 7)}`;
    const before = clone(store.patients[patientId] || {});
    const patientName = fullNameFromDraft(draft) || "PACIENTE SIN NOMBRE";
    const service = draft.service ? normalizeService(draft.service) : "";
    const bed = normalizeBed(draft.bed || "");
    const admissionDate = normalizeDate(draft.admissionDate || "");
    const state = displayState(draft.state || "Sin estado");
    const patient = {
      ...(store.patients[patientId] || {}),
      patientId,
      displayCode: store.patients[patientId]?.displayCode || makeDisplayCode(patientId),
      patientName,
      currentService: service,
      currentBed: bed,
      sector: draft.sector || null,
      age: parseAge(draft.age) ?? cleanCell(draft.age),
      sex: draft.sex || null,
      admissionDate: admissionDate || null,
      currentState: state,
      currentDiagnosis: cleanCell(draft.dxHospital) || null,
      epidemiologicalDiagnosis: cleanCell(draft.epiDiagnosis) || null,
      currentEpidemiologicalDiagnosis: cleanCell(draft.epiDiagnosis) || null,
      observations: cleanCell(draft.observations) || null,
      rfc: cleanCell(draft.rfc) || null,
      birthDate: normalizeDate(draft.birthDate) || null,
      hospitalizationStatus: normalizeText(service) === "AMBULATORIO" ? "ambulatorio" : "hospitalizado",
      presentInLatestCensus: true,
      latestCensusDate: date,
      updatedAt: nowIso(),
      updatedBy: currentUserId(),
      createdAt: store.patients[patientId]?.createdAt || nowIso(),
      createdBy: store.patients[patientId]?.createdBy || currentUserId()
    };
    store.patients[patientId] = patient;
    store.dailyCensus[date] = {
      ...(store.dailyCensus[date] || {}),
      censusDate: date,
      patients: store.dailyCensus[date]?.patients || {}
    };
    store.dailyCensus[date].patients[patientId] = {
      ...(store.dailyCensus[date].patients[patientId] || {}),
      patientId,
      roundDate: date,
      service,
      bed,
      patientName,
      sector: patient.sector,
      age: patient.age,
      sex: patient.sex,
      admissionDate,
      diagnosis: patient.currentDiagnosis,
      epidemiologicalDiagnosis: patient.epidemiologicalDiagnosis,
      state,
      observations: patient.observations,
      present: true,
      importedFromFile: false,
      manualEntry: true,
      reviewStatus: store.dailyCensus[date].patients[patientId]?.reviewStatus || "pendiente",
      syncStatus: syncStatusForNewWrite(),
      rowHash: hashText(`${patientId}|${date}|${service}|${bed}|${patientName}|${patient.currentDiagnosis}|${patient.epidemiologicalDiagnosis}`),
      notes: patient.observations || ""
    };
    ensureDailyRound(date);
    store.dailyRounds[date].entries[patientId] = {
      ...(store.dailyRounds[date].entries[patientId] || defaultRoundEntry(store.dailyCensus[date].patients[patientId], date)),
      patientId,
      entryId: patientId,
      service,
      bed,
      roundDate: date,
      syncStatus: syncStatusForNewWrite()
    };
    addAudit(draft.patientId ? "PATIENT_UPDATED" : "PATIENT_CREATED", { patientId, roundDate: date, before, after: patient, metadata: { source: "monitoring-editor", censusType: draft.censusType } });
    recalculateRound(date);
    saveStore();
    enqueueWrite({ type: "patientUpdate", date, patientId, patient, censusRow: store.dailyCensus[date].patients[patientId] });
    ui.monitorEditDraft = null;
    ui.monitorEditMode = "";
    flashIaas("Paciente guardado en monitoreo.");
    renderIaas();
  }

  function requiresOpdNotification(draft) {
    const service = normalizeText(draft.service);
    const dx = normalizeText(draft.epiDiagnosis);
    const hospitalized = service !== "AMBULATORIO";
    const excludedIaas = ["AMBULATORIO", "HEMODIALISIS", "HEMODIÁLISIS", "ONCOLOGIA", "ONCOLOGÍA"].includes(service);
    if (!dx) return false;
    if (dx.includes("VIG TRANSMISIBLE") || dx.includes("VIG NO TRANSMISIBLE")) return true;
    if (dx.includes("MORBIMORTALIDAD") || dx.includes("MATERNA") || dx.includes("PERINATAL")) return true;
    if (hospitalized && (dx.includes("ESAVI") || dx.includes("COVID") || dx.includes("INFLUENZA"))) return true;
    if (iaasCountForText(dx) > 0 && !excludedIaas) return true;
    return false;
  }

  function renderMonitorEmpty(message) {
    return h("div", { class: "monitor-empty" }, [
      h("strong", {}, [message])
    ]);
  }

  function renderCommandCalendar(date) {
    ensureCommandCalendarState(date);
    const calendarDate = ui.calendarDate || date;
    const view = ui.calendarView || "week";
    const range = commandCalendarRange(calendarDate, view);
    const events = commandCalendarEvents(calendarDate, view, range);
    return h("article", { class: `command-panel command-calendar calendar-${view}` }, [
      h("div", { class: "command-panel-head" }, [
        h("h2", {}, ["Calendario epidemiológico"]),
        h("div", { class: "command-calendar-controls" }, [
          h("button", { type: "button", onpointerdown: event => event.preventDefault(), onclick: event => { event.preventDefault(); shiftCommandCalendar(-1); }, "aria-label": "Periodo anterior" }, [commandIcon("chevron-left")]),
          h("button", { type: "button", onpointerdown: event => event.preventDefault(), onclick: event => { event.preventDefault(); shiftCommandCalendar(1); }, "aria-label": "Periodo siguiente" }, [commandIcon("chevron-right")]),
          h("button", { type: "button", onpointerdown: event => event.preventDefault(), onclick: event => { event.preventDefault(); resetCommandCalendarToday(); } }, ["Hoy"]),
          h("span", { class: "command-calendar-period" }, [commandCalendarPeriodLabel(range, view)]),
          h("select", { class: "command-calendar-view", onchange: event => setCommandCalendarView(event.target.value) }, [
            option("day", "Día", view === "day"),
            option("week", "Semana", view === "week"),
            option("month", "Mes", view === "month"),
            option("year", "Año", view === "year")
          ])
        ])
      ]),
      renderCommandCalendarRangeBar(range, view),
      h("div", { class: "command-calendar-body" }, [
        renderCommandCalendarCanvas(range, events, view),
        renderCommandCalendarEditor(calendarDate)
      ])
    ]);
  }

  function renderCommandNotificationPanels(stats, date) {
    const panels = [
      { title: "Notificaciones Preventivas", href: `#/ronda/${date}`, items: commandPreventiveNotifications(stats, date), tone: "preventive" },
      { title: "Notificaciones IAAS", href: "#/seguimiento-iaas", items: commandIaasNotifications(stats, date), tone: "iaas" },
      { title: "Notificaciones VIG", href: "#/censo-hospitalario", items: commandVigNotifications(stats, date), tone: "vig" }
    ];
    return h("section", { class: "command-notification-grid" }, panels.map(panel =>
      h("article", { class: `command-panel command-notification-panel ${panel.tone}` }, [
        h("div", { class: "command-panel-head" }, [
          h("h2", {}, [panel.title]),
          h("a", { href: panel.href }, ["Ver módulo"])
        ]),
        h("div", { class: "notification-list" }, panel.items.map(item =>
          h("a", { class: `notification-row ${item.tone}`, href: item.href }, [
            h("i", {}, [commandIcon(item.icon)]),
            h("div", {}, [
              h("strong", {}, [item.title]),
              h("span", {}, [item.detail])
            ]),
            h("time", {}, [item.time])
          ])
        ))
      ])
    ));
  }

  function commandPreventiveNotifications(stats, date) {
    const briefing = salaBriefingData(stats, date);
    return [
      {
        title: "Paquetes preventivos por completar",
        detail: `${stats.pendingPatients} paciente(s) pendientes de ronda preventiva`,
        time: "Hoy",
        icon: "check",
        tone: "round",
        href: `#/ronda/${date}`
      },
      {
        title: "Dispositivos activos para vigilancia",
        detail: `${stats.activeDevices} invasivo(s), ${stats.totalDeviceDays} día(s) dispositivo acumulados`,
        time: "Turno",
        icon: "shield",
        tone: "culture",
        href: "#/reporte-diario"
      },
      {
        title: briefing.surgicalSignals ? "Señales quirúrgicas visibles" : "Sin señales ISQ visibles",
        detail: briefing.surgicalSignals ? `${briefing.surgicalSignals} paciente(s) con seguimiento ISQ potencial` : "Paquete quirúrgico sin eventos detectados",
        time: "ISQ",
        icon: "info",
        tone: "rhove",
        href: `#/ronda/${date}`
      }
    ];
  }

  function commandIaasNotifications(stats, date) {
    const briefing = salaBriefingData(stats, date);
    return [
      {
        title: stats.alertPatients[0] ? `${stats.alertPatients[0].reason} en ${stats.alertPatients[0].currentService || "servicio"}` : "Sin alertas IAAS críticas nuevas",
        detail: stats.alertPatients[0] ? patientLabel(stats.alertPatients[0]) : "Seguimiento IAAS sin casos críticos activos",
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
        title: `${stats.incompletePatients} expediente(s) IAAS incompletos`,
        detail: stats.incompletePatients ? "Requieren completar seguimiento clínico" : "Sin expedientes incompletos en seguimiento",
        time: "IAAS",
        icon: "info",
        tone: "round",
        href: "#/seguimiento-iaas"
      }
    ];
  }

  function commandVigNotifications(stats, date) {
    const vigPatients = getCensusRows(date)
      .map(row => ({ row, patient: store.patients[row.patientId] || {} }))
      .filter(item => epiClass([
        item.patient.epidemiologicalDiagnosis,
        item.patient.currentEpidemiologicalDiagnosis,
        item.row.epidemiologicalDiagnosis
      ].filter(Boolean).join(" ")) === "epi-vig")
      .slice(0, 2);
    const epi = commandEpiCounts(date);
    const items = vigPatients.map(item => ({
      title: patientLabel(item.patient, item.row),
      detail: `${item.row.service || item.patient.currentService || "Sin servicio"} · VIG transmisible / no transmisible`,
      time: "VIG",
      icon: "shield",
      tone: "rhove",
      href: "#/censo-hospitalario"
    }));
    items.push({
      title: epi.vig ? `${epi.vig} caso(s) VIG activos` : "Sin VIG activos visibles",
      detail: epi.vig ? "Incluye VIG transmisible y VIG no transmisible" : "Vigilancia hospitalaria sin VIG catalogados",
      time: "Hoy",
      icon: "info",
      tone: "round",
      href: "#/censo-hospitalario"
    });
    return items.slice(0, 3);
  }

  function ensureCommandCalendarState(date) {
    if (!ui.calendarDate || !validIsoDate(ui.calendarDate)) ui.calendarDate = date;
    if (!ui.calendarDraftDate || !validIsoDate(ui.calendarDraftDate)) ui.calendarDraftDate = ui.calendarDate;
    if (!ui.calendarDraftStartTime) ui.calendarDraftStartTime = "08:00";
    if (!ui.calendarDraftEndTime) ui.calendarDraftEndTime = "09:00";
    if (!["day", "week", "month", "year"].includes(ui.calendarView)) ui.calendarView = "week";
    if (!["preventiva", "iaas", "vig", "rhove"].includes(ui.calendarDraftCategory)) ui.calendarDraftCategory = "preventiva";
    if (!Array.isArray(store.commandCalendarEvents)) store.commandCalendarEvents = [];
  }

  function renderCommandCalendarRangeBar(range, view) {
    return h("div", { class: "command-calendar-rangebar" }, [
      h("span", {}, [commandCalendarMonthLabel(range, view)]),
      h("strong", {}, [commandCalendarPeriodLabel(range, view)])
    ]);
  }

  function renderCommandCalendarCanvas(range, events, view) {
    if (view === "year") return renderCommandYearView(range, events);
    if (view === "month") return renderCommandMonthView(range, events);
    return renderCommandTimeGrid(range, events);
  }

  function renderCommandTimeGrid(range, events) {
    const times = commandCalendarTimes(events);
    return h("div", { class: "command-calendar-grid", style: `--calendar-days:${range.days.length}` }, [
      h("span", { class: "time-col" }, [""]),
      ...range.days.map(day => h("strong", { class: day.today ? "today" : "" }, [day.label])),
      ...times.flatMap(time => [
        h("span", { class: "time-col" }, [commandTimeLabel(time)]),
        ...range.days.map(day => {
          const slotEvents = events.filter(item => item.date === day.date && commandEventStartTime(item) === time);
          return h("div", { class: "calendar-slot" }, slotEvents.map(renderCalendarEvent));
        })
      ])
    ]);
  }

  function renderCommandMonthView(range, events) {
    const firstDate = new Date(`${range.start}T00:00:00`);
    const leading = (firstDate.getDay() + 6) % 7;
    const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const blanks = Array.from({ length: leading }, (_, index) => h("div", { class: "calendar-month-cell empty", "aria-hidden": "true" }, []));
    return h("div", { class: "command-month-grid" }, [
      ...weekdays.map(day => h("span", { class: "month-weekday" }, [day])),
      ...blanks,
      ...range.days.map(day => {
        const dayEvents = events.filter(item => item.date === day.date);
        return h("div", { class: `calendar-month-cell ${day.today ? "today" : ""}` }, [
          h("strong", {}, [String(new Date(`${day.date}T00:00:00`).getDate())]),
          ...dayEvents.slice(0, 3).map(renderCalendarEvent),
          dayEvents.length > 3 ? h("small", { class: "calendar-more" }, [`+${dayEvents.length - 3} más`]) : ""
        ]);
      })
    ]);
  }

  function renderCommandYearView(range, events) {
    const year = new Date(`${range.start}T00:00:00`).getFullYear();
    const formatter = new Intl.DateTimeFormat("es-MX", { month: "long" });
    return h("div", { class: "command-year-grid" }, Array.from({ length: 12 }, (_, month) => {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const monthEvents = events.filter(item => item.date >= toIsoDate(monthStart) && item.date <= toIsoDate(monthEnd));
      return h("button", {
        type: "button",
        class: "calendar-year-card",
        onclick: () => {
          ui.calendarDate = toIsoDate(monthStart);
          ui.calendarDraftDate = ui.calendarDate;
          ui.calendarView = "month";
          updateCommandCalendarDom();
        }
      }, [
        h("strong", {}, [formatter.format(monthStart)]),
        h("span", {}, [`${monthEvents.length} evento(s)`]),
        monthEvents[0] ? h("small", {}, [monthEvents[0].label]) : h("small", {}, ["Sin eventos programados"])
      ]);
    }));
  }

  function renderCalendarEvent(event) {
    return h("span", { class: `calendar-event ${event.tone || "blue"}` }, [
      h("b", {}, [event.label]),
      h("small", {}, [`${commandEventTimeRange(event)} · ${commandCalendarCategoryLabel(event.category)}`])
    ]);
  }

  function renderCommandCalendarEditor(calendarDate) {
    const saved = commandStoredCalendarEvents()
      .slice()
      .sort((a, b) => `${a.date} ${commandEventStartTime(a)}`.localeCompare(`${b.date} ${commandEventStartTime(b)}`))
      .slice(0, 6);
    return h("aside", { class: "command-calendar-editor" }, [
      h("h3", {}, ["Agregar evento"]),
      h("form", { class: "command-calendar-form", onsubmit: addCommandCalendarEvent }, [
        h("label", { class: "field full" }, [
          h("span", {}, ["Evento"]),
          h("input", {
            id: "calendar-event-title",
            value: ui.calendarDraftTitle,
            placeholder: "Ej. Comité IAAS, ronda VIG, revisión de paquetes",
            oninput: event => { ui.calendarDraftTitle = event.target.value; }
          })
        ]),
        h("div", { class: "command-calendar-date-row" }, [
          h("label", { class: "field" }, [
            h("span", {}, ["Fecha"]),
            h("input", { type: "date", value: ui.calendarDraftDate || calendarDate, onchange: event => { ui.calendarDraftDate = event.target.value; } })
          ])
        ]),
        h("div", { class: "command-calendar-time-row" }, [
          h("label", { class: "field" }, [
            h("span", {}, ["Inicio"]),
            renderCommandTimeSelect(ui.calendarDraftStartTime || "08:00", value => { ui.calendarDraftStartTime = value; })
          ]),
          h("label", { class: "field" }, [
            h("span", {}, ["Término"]),
            renderCommandTimeSelect(ui.calendarDraftEndTime || "09:00", value => { ui.calendarDraftEndTime = value; })
          ])
        ]),
        h("label", { class: "field full" }, [
          h("span", {}, ["Tipo"]),
          h("select", { onchange: event => { ui.calendarDraftCategory = event.target.value; } }, [
            option("preventiva", "Preventiva", ui.calendarDraftCategory === "preventiva"),
            option("iaas", "IAAS", ui.calendarDraftCategory === "iaas"),
            option("vig", "VIG", ui.calendarDraftCategory === "vig"),
            option("rhove", "RHOVE / comité", ui.calendarDraftCategory === "rhove")
          ])
        ]),
        h("button", { class: "iaas-button primary", type: "submit" }, ["Agregar evento"])
      ]),
      h("div", { class: "command-calendar-saved" }, [
        h("h3", {}, ["Eventos agregados"]),
        saved.length ? h("div", { class: "command-calendar-event-list" }, saved.map(event =>
          h("div", { class: `calendar-saved-event ${event.tone || "blue"}` }, [
            h("div", {}, [
              h("strong", {}, [event.label]),
              h("span", {}, [`${event.date} · ${commandEventTimeRange(event)} · ${commandCalendarCategoryLabel(event.category)}`])
            ]),
            h("button", { type: "button", onclick: () => removeCommandCalendarEvent(event.id) }, ["Quitar"])
          ])
        )) : h("p", {}, ["Aún no hay eventos agregados."])
      ])
    ]);
  }

  function shiftCommandCalendar(offset) {
    dismissCalendarPopups();
    const view = ui.calendarView || "week";
    const base = new Date(`${ui.calendarDate || activeDate()}T00:00:00`);
    if (view === "day") base.setDate(base.getDate() + offset);
    if (view === "week") base.setDate(base.getDate() + offset * 7);
    if (view === "month") base.setMonth(base.getMonth() + offset);
    if (view === "year") base.setFullYear(base.getFullYear() + offset);
    ui.calendarDate = toIsoDate(base);
    ui.calendarDraftDate = ui.calendarDate;
    updateCommandCalendarDom();
  }

  function resetCommandCalendarToday() {
    dismissCalendarPopups();
    ui.calendarDate = activeDate();
    ui.calendarDraftDate = ui.calendarDate;
    updateCommandCalendarDom();
  }

  function setCommandCalendarView(view) {
    dismissCalendarPopups();
    ui.calendarView = ["day", "week", "month", "year"].includes(view) ? view : "week";
    updateCommandCalendarDom();
  }

  function addCommandCalendarEvent(event) {
    event?.preventDefault?.();
    dismissCalendarPopups();
    const label = cleanCell(ui.calendarDraftTitle || document.querySelector("#calendar-event-title")?.value);
    const date = normalizeDate(ui.calendarDraftDate || ui.calendarDate || activeDate());
    const startTime = cleanCell(ui.calendarDraftStartTime || "08:00");
    const endTime = cleanCell(ui.calendarDraftEndTime || "");
    const category = ["preventiva", "iaas", "vig", "rhove"].includes(ui.calendarDraftCategory) ? ui.calendarDraftCategory : "preventiva";
    if (!label) {
      setCalendarFormMessage("Escribe el nombre del evento epidemiológico.");
      return;
    }
    if (!date || !isValidCalendarTime(startTime) || !isValidCalendarTime(endTime) || endTime <= startTime) {
      setCalendarFormMessage("Revisa fecha, hora de inicio y hora de término.");
      return;
    }
    store.commandCalendarEvents = commandStoredCalendarEvents();
    store.commandCalendarEvents.push({
      id: `calendar-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date,
      startTime,
      endTime,
      label,
      category,
      tone: commandCalendarTone(category),
      createdAt: nowIso(),
      createdBy: currentUserId()
    });
    saveStore();
    ui.calendarDate = date;
    ui.calendarDraftDate = date;
    ui.calendarDraftTitle = "";
    updateCommandCalendarDom();
  }

  function removeCommandCalendarEvent(id) {
    dismissCalendarPopups();
    store.commandCalendarEvents = commandStoredCalendarEvents().filter(event => event.id !== id);
    saveStore();
    updateCommandCalendarDom();
  }

  function commandStoredCalendarEvents() {
    if (!Array.isArray(store.commandCalendarEvents)) store.commandCalendarEvents = [];
    return store.commandCalendarEvents;
  }

  function updateCommandCalendarDom() {
    const current = document.querySelector(".command-calendar");
    if (!current || ui.route.page !== "dashboard") {
      renderIaas();
      return false;
    }
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const next = renderCommandCalendar(activeDate());
    current.replaceWith(next);
    window.scrollTo(scrollX, scrollY);
    return true;
  }

  function dismissCalendarPopups() {
    document.querySelectorAll(".iaas-toast").forEach(toast => toast.remove());
    const message = document.querySelector(".command-calendar-form-message");
    if (message) message.remove();
  }

  function setCalendarFormMessage(message) {
    document.querySelectorAll(".command-calendar-form-message").forEach(node => node.remove());
    const form = document.querySelector(".command-calendar-form");
    if (!form) return;
    form.prepend(h("p", { class: "command-calendar-form-message" }, [message]));
  }

  function isValidCalendarTime(value) {
    return /^\d{2}:\d{2}$/.test(value || "");
  }

  function commandEpiCounts(date) {
    return getCensusRows(date).reduce((out, row) => {
      const patient = store.patients[row.patientId] || {};
      const text = epidemiologicalText({ row, patient });
      const bases = epidemiologicalBasesForText(text);
      out.iaas += iaasCountForText(text);
      if (bases.includes("RIESGO IAAS")) out.riesgo += 1;
      if (bases.some(base => base.startsWith("VIG"))) out.vig += 1;
      return out;
    }, { iaas: 0, riesgo: 0, vig: 0 });
  }

  function epidemiologicalTagsForItem(item) {
    const text = normalizeText(epidemiologicalSearchText(item));
    if (!text) return [];
    const withoutNoRisk = text
      .replace(/\bNO\s+IAAS\b/g, " ")
      .replace(/\bRIESGO\s+IAAS\b/g, " ");
    return EPIDEMIOLOGICAL_TAGS.filter(tag => {
      if (tag.key === "iaas") return /\b(\d+\s*)?IAAS\b/.test(withoutNoRisk);
      if (tag.key === "noIaas") return /\bNO\s+IAAS\b/.test(text);
      if (tag.key === "riesgoIaas") return /\bRIESGO\s+IAAS\b/.test(text);
      if (tag.key === "vigTransmisible") return /\bVIG\s+TRANSMISIBLE\b/.test(text);
      if (tag.key === "vigNoTransmisible") return /\bVIG\s+NO\s+TRANSMISIBLE\b/.test(text);
      if (tag.key === "esavi") return /\bESAVI\b/.test(text);
      if (tag.key === "covidInfluenza") return /\bCOVID\b|\bINFLUENZA\b/.test(text);
      if (tag.key === "morbimortalidad") return /\bMORBIMORTALIDAD\b|\bMATERNA\b|\bPERINATAL\b/.test(text);
      return false;
    });
  }

  function epidemiologicalSearchText({ row = {}, patient = {} }) {
    return [
      patient.epidemiologicalDiagnosis,
      patient.currentEpidemiologicalDiagnosis,
      row.epidemiologicalDiagnosis,
      patient.observations,
      row.observations,
      row.notes,
      patient.currentDiagnosis,
      row.diagnosis
    ].filter(Boolean).join(" ");
  }

  function epidemiologicalText(item) {
    const seen = new Set();
    return [
      item.patient?.epidemiologicalDiagnosis,
      item.patient?.currentEpidemiologicalDiagnosis,
      item.row?.epidemiologicalDiagnosis
    ].map(cleanCell).filter(Boolean).filter(value => {
      const key = normalizeText(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join(" / ");
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

  function commandCalendarRange(date, view = "week") {
    const selected = new Date(`${date}T00:00:00`);
    const current = Number.isFinite(selected.getTime()) ? selected : new Date(`${activeDate()}T00:00:00`);
    const fmt = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric" });
    if (view === "day") {
      const iso = toIsoDate(current);
      return {
        start: iso,
        end: iso,
        days: [{ date: iso, label: fmt.format(current).replace(".", ""), today: iso === activeDate() }]
      };
    }
    if (view === "month") {
      const start = new Date(current.getFullYear(), current.getMonth(), 1);
      const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      return commandDateRange(start, end, fmt);
    }
    if (view === "year") {
      const start = new Date(current.getFullYear(), 0, 1);
      const end = new Date(current.getFullYear(), 11, 31);
      return commandDateRange(start, end, fmt);
    }
    const day = current.getDay() || 7;
    const monday = new Date(current);
    monday.setDate(current.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return commandDateRange(monday, sunday, fmt);
  }

  function commandDateRange(start, end, fmt) {
    const days = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const iso = toIsoDate(cursor);
      days.push({
        date: iso,
        label: fmt.format(cursor).replace(".", ""),
        today: iso === activeDate()
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return { start: toIsoDate(start), end: toIsoDate(end), days };
  }

  function commandCalendarEvents(date, view = "week", range = commandCalendarRange(date, view)) {
    const customEvents = commandStoredCalendarEvents().map(event => ({
      ...event,
      tone: event.tone || commandCalendarTone(event.category)
    }));
    return customEvents
      .filter(event => event.date >= range.start && event.date <= range.end)
      .sort((a, b) => `${a.date} ${commandEventStartTime(a)}`.localeCompare(`${b.date} ${commandEventStartTime(b)}`));
  }

  function commandCalendarTimes(events) {
    const workdayHours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
    return unique([...workdayHours, ...events.map(commandEventStartTime).filter(Boolean)]).sort();
  }

  function commandCalendarTimeOptions(current = "") {
    const options = [];
    for (let minutes = 8 * 60; minutes <= 15 * 60; minutes += 15) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
      const minute = String(minutes % 60).padStart(2, "0");
      options.push(`${hour}:${minute}`);
    }
    const safeCurrent = isValidCalendarTime(current) ? current : "";
    return unique([...options, safeCurrent].filter(Boolean)).sort();
  }

  function renderCommandTimeSelect(value, onChange) {
    const selectedValue = isValidCalendarTime(value) ? value : "08:00";
    return h("select", { class: "command-calendar-time-select", onchange: event => onChange(event.target.value) },
      commandCalendarTimeOptions(selectedValue).map(time => option(time, commandTimeLabel(time), time === selectedValue))
    );
  }

  function commandCalendarPeriodLabel(range, view) {
    const start = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);
    if (view === "day") return dayLabel(start);
    if (view === "month") return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(start);
    if (view === "year") return String(start.getFullYear());
    const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
    return `${fmt.format(start).replace(".", "")} - ${fmt.format(end).replace(".", "")} ${end.getFullYear()}`;
  }

  function commandCalendarMonthLabel(range, view) {
    const start = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);
    if (view === "year") return String(start.getFullYear());
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return capitalizeFirst(new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(start));
    }
    const fmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
    return `${capitalizeFirst(fmt.format(start))} - ${capitalizeFirst(fmt.format(end))}`;
  }

  function capitalizeFirst(value) {
    return String(value || "").replace(/^\S/, letter => letter.toUpperCase());
  }

  function commandEventStartTime(event) {
    return event.startTime || event.time || "08:00";
  }

  function commandEventEndTime(event) {
    return event.endTime || event.finishTime || commandEventStartTime(event);
  }

  function commandEventTimeRange(event) {
    const start = commandEventStartTime(event);
    const end = commandEventEndTime(event);
    return end && end !== start ? `${commandTimeLabel(start)} - ${commandTimeLabel(end)}` : commandTimeLabel(start);
  }

  function commandTimeLabel(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return value || "";
    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return minute === "00" ? `${displayHour} ${suffix}` : `${displayHour}:${minute} ${suffix}`;
  }

  function commandCalendarTone(category) {
    return {
      preventiva: "blue",
      iaas: "pink",
      vig: "green",
      rhove: "cyan"
    }[category] || "blue";
  }

  function commandCalendarCategoryLabel(category) {
    return {
      preventiva: "Preventiva",
      iaas: "IAAS",
      vig: "VIG",
      rhove: "RHOVE"
    }[category] || "Evento";
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
      plus: ['<path d="M12 5v14M5 12h14"/>'],
      pen: ['<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>'],
      clock: ['<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
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
        title: "Monitoreo Epidemiológico",
        text: "Censo epidemiológico y hospitalario con filtros clínicos, edición directa y etiquetas OPD.",
        href: "#/monitoreo-epidemiologico",
        action: "Abrir monitoreo",
        image: `${PRO_ASSET}/icons/extras/futuristic_microscope_with_virus_and_heartbeat.webp`,
        backdrop: `${PRO_ASSET}/backgrounds/extra-network-interface-concept.webp`,
        tone: "monitoreo",
        meta: ["Epidemiológico", "Hospitalario", "OPD"]
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
    ui.dashboardSlide = normalizeDashboardSlide(index);
    ui.dashboardSlidePausedUntil = Date.now() + 10000;
    if (!syncDashboardSlideDom()) renderIaas();
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
    const rows = iaasFollowUpRows(date);
    const activeDevices = rows.reduce((sum, item) => sum + activeEpisodes(item.row.patientId, date).length, 0);
    const pendingValuations = rows.filter(item => !store.dailyRounds[date]?.entries?.[item.row.patientId]?.iaasAssessment).length;
    const cultures = rows.filter(item => normalizeText(`${item.patient.cultureStatus || item.row.cultureStatus || ""} ${item.patient.observations || item.row.observations || ""}`).includes("CULT")).length;
    return h("div", { class: "iaas-page follow-up-hub" }, [
      h("section", { class: "iaas-panel follow-hero" }, [
        h("div", {}, [
          h("h1", {}, ["Seguimiento IAAS"]),
          h("p", {}, ["Seguimiento diario para pacientes con IAAS activa o importada. La valoración integra invasivos, signos vitales, laboratorios, cultivos, tratamiento, bitácora diaria y gráfica de temperatura."])
        ]),
        h("img", { src: `${PRO_ASSET}/icons/extras/futuristic_microscope_with_virus_and_heartbeat.webp`, alt: "", loading: "lazy" })
      ]),
      renderMetricGrid([
        ["Pacientes IAAS", rows.length, "activos/importados"],
        ["Invasivos activos", activeDevices, "solo pacientes IAAS"],
        ["Valoración pendiente", pendingValuations, "registro diario"],
        ["Cultivos visibles", cultures, "notas o resultados"]
      ], "compact"),
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("div", {}, [
            h("h2", {}, ["Pacientes IAAS para valoración"]),
            h("p", {}, ["Solo se muestran pacientes con diagnóstico epidemiológico IAAS. La revisión abre directamente la pestaña de valoración por IAAS."])
          ]),
          h("a", { href: "#/censo-hospitalario" }, ["Ver vigilancia hospitalaria"])
        ]),
        rows.length
          ? renderIaasFollowUpCards(rows, date)
          : h("p", { class: "muted" }, ["Sin pacientes IAAS activos en el censo actual."])
      ])
    ]);
  }

  function iaasFollowUpRows(date) {
    return monitoringRows(date)
      .filter(item => iaasCountForText(item.epiText) > 0)
      .sort((a, b) => sortByServiceBed(a.row, b.row));
  }

  function renderIaasFollowUpCards(rows, date) {
    return h("div", { class: "iaas-follow-list" }, rows.map(item => {
      const patient = item.patient || {};
      const active = activeEpisodes(item.row.patientId, date);
      const entry = store.dailyRounds[date]?.entries?.[item.row.patientId] || {};
      return h("article", { class: "iaas-follow-card" }, [
        h("div", { class: "iaas-follow-avatar" }, [
          h("img", { src: `${PRO_ASSET}/badges/badge-iaas.webp`, alt: "", loading: "lazy" })
        ]),
        h("div", { class: "iaas-follow-main" }, [
          h("strong", {}, [item.patientName || patientLabel(patient, item.row)]),
          h("span", {}, [`${serviceDisplayLabel(item.service)} · Cama ${item.bed || "S/C"}`]),
          h("small", {}, [item.dxHospital || "Sin diagnóstico hospitalario registrado"])
        ]),
        h("div", { class: "iaas-follow-tags" }, [
          h("span", { class: "badge epi-iaas" }, [cleanCell(item.epiText) || "IAAS"]),
          active.length ? h("span", { class: "badge device" }, [`${active.length} invasivo(s)`]) : h("span", { class: "badge neutral" }, ["Sin invasivos activos"]),
          entry.iaasAssessment ? h("span", { class: "badge revisado" }, ["Valoración del día"]) : h("span", { class: "badge pendiente" }, ["Pendiente"])
        ]),
        h("div", { class: "iaas-follow-actions" }, [
          h("a", {
            class: "iaas-button primary",
            href: `#/ronda/${date}/paciente/${item.row.patientId}/iaas`
          }, ["Revisar"]),
          h("a", { class: "iaas-button ghost", href: `#/pacientes/${item.row.patientId}/seguimiento` }, ["Historial"])
        ])
      ]);
    }));
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
            h("button", { class: "iaas-button primary", onclick: printEpidemiologicalCensusFromSheets }, ["Imprimir censo"])
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
    const importDate = ui.importDate || isoToday();
    return h("div", { class: "iaas-page import-page" }, [
      h("section", { class: "iaas-panel import-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("div", {}, [
            h("h1", {}, ["Base de Datos"]),
            h("p", {}, ["Pega desde Excel/Google Sheets como ruta principal, o carga CSV/XLSX como respaldo. La importación valida, deduplica, concilia y luego guarda."])
          ]),
          h("span", { class: "badge" }, ["Sin IA pagada"])
        ]),
        h("div", { class: "import-recommendation" }, [
          h("strong", {}, ["Recomendado para mañana: copiar y pegar"]),
          h("span", {}, ["Es el flujo más estable en móvil y escritorio: no depende del lector externo de XLSX y acepta el formato humano del censo con Servicio/Cama, Paciente, Dx hospitalario y Observaciones."])
        ]),
        h("div", { class: "import-controls" }, [
          h("label", { class: "field" }, [
            h("span", {}, ["Fecha del censo"]),
            h("input", {
              type: "date",
              value: importDate,
              id: "import-date",
              onchange: event => { ui.importDate = event.target.value || isoToday(); }
            })
          ]),
          h("label", { class: "field full" }, [
            h("span", {}, ["Pegar tabla del censo"]),
            h("textarea", {
              id: "import-text",
              placeholder: "Servicio/Cama\tPaciente\tSector\tEdad\tSexo\tIngreso\tEstado\tDx hospitalario\tDx epidemiologico\tObservaciones",
              oninput: event => { ui.importText = event.target.value; }
            }, [ui.importText])
          ]),
          h("div", { class: "import-actions" }, [
            h("label", { class: "import-file-picker" }, [
              h("span", {}, ["Cargar archivo CSV/TSV/XLSX"]),
              h("input", { type: "file", id: "census-file", accept: ".csv,.txt,.tsv,.xlsx", onchange: handleImportFile })
            ]),
            h("button", { class: "iaas-button", onclick: loadSampleImport }, ["Cargar ejemplo"]),
            h("button", { class: "iaas-button primary", onclick: parseImportInput }, ["Pegar y validar censo"]),
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
          h("thead", {}, [h("tr", {}, ["Estado", "Paciente/ID", "Servicio", "Cama", "Ingreso", "Dx", "Errores/avisos"].map(label => h("th", {}, [label])))]),
          h("tbody", {}, draft.rows.slice(0, 30).map(row => h("tr", { class: row.errors.length ? "has-error" : row.warnings.length ? "has-warning" : "" }, [
            h("td", {}, [row.errors.length ? "Error" : row.warnings.length ? "Advertencia" : "Válida"]),
            h("td", {}, [row.normalized.patient_name || row.normalized.patient_id || ""]),
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

  function renderPatientRound(date, patientId, requestedSection = null) {
    const patient = store.patients[patientId];
    if (!patient) return renderNotFound("Paciente no encontrado.");
    ensureDailyRound(date);
    const section = requestedSection === "iaas" ? "iaas" : "preventive";
    const draft = getReviewDraft(date, patientId, section);
    const active = activeEpisodes(patientId, date);
    const stay = isAmbulatoryStayService(patient.currentService) ? "Ambulatorio" : `${daysBetween(patient.admissionDate, date) ?? "NA"} días`;
    return h("div", { class: "iaas-page patient-round" }, [
      h("section", { class: "iaas-panel patient-sticky-summary" }, [
        h("div", {}, [
          h("a", { href: draft.activeRoundSection === "iaas" ? "#/seguimiento-iaas" : `#/ronda/${date}`, class: "back-link" }, ["Volver al servicio"]),
          h("h1", {}, [`Cama ${patient.currentBed} · ${patientLabel(patient)}`]),
          h("p", {}, [`${patient.currentService} · Estancia: ${stay}`])
        ]),
        h("span", { class: `risk ${riskClass(patient.currentRiskLevel)}` }, [patient.currentRiskLevel || "Sin riesgo"])
      ]),
      renderRoundModeTiles(date, patientId, draft),
      ...(draft.activeRoundSection === "iaas"
        ? [renderIaasAssessmentPanel(date, patientId, patient, active, draft)]
        : renderPreventiveReviewSections(date, patientId, patient, active, draft)),
      h("div", { class: "round-save-bar" }, [
        h("button", { class: "iaas-button ghost", onclick: () => saveRoundEntry(date, patientId, "incompleto", false) }, ["Guardar como incompleto"]),
        h("button", { class: "iaas-button", onclick: () => saveRoundEntry(date, patientId, "pendiente", false) }, ["Marcar pendiente"]),
        h("button", { class: "iaas-button primary", onclick: () => saveRoundEntry(date, patientId, "revisado", false) }, ["Guardar"]),
        h("button", { class: "iaas-button primary strong", onclick: () => saveRoundEntry(date, patientId, "revisado", true) }, ["Guardar y siguiente cama"])
      ])
    ]);
  }

  function renderRoundModeTiles(date, patientId, draft) {
    return h("section", { class: "patient-round-modes" }, [
      h("button", {
        class: `round-mode-card ${draft.activeRoundSection === "preventive" ? "active" : ""}`,
        type: "button",
        onclick: () => setRoundPatientSection(date, patientId, "preventive")
      }, [
        h("img", { src: `${PRO_ASSET}/icons/icon-seguridad.webp`, alt: "", loading: "lazy" }),
        h("span", {}, ["REVISIÓN PAQUETES PREVENTIVOS"]),
        h("small", {}, ["Ronda de invasivos y paquetes"])
      ]),
      h("button", {
        class: `round-mode-card iaas-mode ${draft.activeRoundSection === "iaas" ? "active" : ""}`,
        type: "button",
        onclick: () => setRoundPatientSection(date, patientId, "iaas")
      }, [
        h("img", { src: `${PRO_ASSET}/icons/extras/futuristic_microscope_with_virus_and_heartbeat.webp`, alt: "", loading: "lazy" }),
        h("span", {}, ["VALORACIÓN POR IAAS"]),
        h("small", {}, ["Registro clínico epidemiológico diario"])
      ])
    ]);
  }

  function setRoundPatientSection(date, patientId, activeRoundSection) {
    updateDraft(date, patientId, { activeRoundSection });
    const target = activeRoundSection === "iaas"
      ? `#/ronda/${date}/paciente/${patientId}/iaas`
      : `#/ronda/${date}/paciente/${patientId}`;
    if (location.hash !== target) {
      location.hash = target;
    } else {
      renderIaas();
    }
  }

  function renderPreventiveReviewSections(date, patientId, patient, active, draft) {
    return [
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
      ])
    ];
  }

  function renderIaasAssessmentPanel(date, patientId, patient, active, draft) {
    const assessment = normalizeIaasAssessment(draft.iaasAssessment);
    const limited = isLimitedIaasAssessmentService(patient.currentService);
    const hemodialysis = isHemodialysisService(patient.currentService);
    const hasVentilation = hasVentilationDevice(active);
    const viralOptions = limited ? IAAS_LIMITED_VIRAL_PANEL_TESTS : IAAS_VIRAL_PANEL_TESTS;
    return h("section", { class: "iaas-panel iaas-assessment-panel" }, [
      h("div", { class: "iaas-panel-head" }, [
        h("div", {}, [
          h("h2", {}, ["Valoración por IAAS"]),
          h("p", {}, [limited
            ? "Paciente de servicio ambulatorio: se limita a invasivos, signos vitales, panel viral, cultivos y tratamiento."
            : "Registro diario de signos vitales, laboratorio, orina, cultivos, tratamiento y evolución."])
        ]),
        h("span", { class: "badge epi-iaas" }, ["IAAS"])
      ]),
      h("div", { class: "iaas-assessment-grid" }, [
        renderIaasInvasiveSummary(active),
        renderIaasVitalSigns(date, patientId, assessment, hasVentilation),
        limited ? "" : renderIaasCbc(date, patientId, assessment),
        limited ? "" : renderIaasUrinalysis(date, patientId, assessment),
        renderIaasOtherStudies(date, patientId, assessment, limited, viralOptions),
        hemodialysis ? renderHemodialysisInfectionPanel(date, patientId, patient, assessment) : "",
        renderIaasCultures(date, patientId, assessment),
        renderIaasTreatments(date, patientId, assessment),
        renderIaasGeneralObservations(date, patientId, assessment)
      ]),
      h("div", { class: "iaas-daily-section" }, [
        h("div", { class: "iaas-panel-head compact" }, [
          h("div", {}, [
            h("h3", {}, ["Registro diario IAAS"]),
            h("p", {}, ["Tabla de seguimiento por fecha desde el ingreso; se completa al guardar la valoración diaria."])
          ])
        ]),
        renderIaasTemperatureChart(patientId),
        renderDailyIaasTable(patient, patientId, date),
        renderIaasStudyHistory(patient, patientId)
      ])
    ]);
  }

  function renderIaasInvasiveSummary(active) {
    return h("article", { class: "iaas-assessment-block iaas-invasive-summary" }, [
      h("h3", {}, ["Invasivos"]),
      active.length ? h("div", { class: "iaas-invasive-list" }, active.map(ep =>
        h("div", {}, [
          h("strong", {}, [ep.deviceType]),
          h("span", {}, [`Instalación ${formatDisplayDate(ep.installationDate) || "sin fecha"}${ep.anatomicalSite ? ` · ${ep.anatomicalSite}` : ""}`])
        ])
      )) : h("p", { class: "muted" }, ["Sin invasivos activos capturados por enfermería."])
    ]);
  }

  function renderIaasVitalSigns(date, patientId, assessment, hasVentilation) {
    const fields = IAAS_VITAL_FIELDS.map(([key, label]) => iaasTextInput(date, patientId, "vitalSigns", key, label, assessment.vitalSigns?.[key]));
    const ventilationFields = hasVentilation
      ? IAAS_VENTILATION_FIELDS.map(([key, label]) => iaasTextInput(date, patientId, "vitalSigns", key, label, assessment.vitalSigns?.[key]))
      : [h("p", { class: "iaas-locked-note" }, ["FiO2 y PEEP se desbloquean cuando exista ventilación activa."])];
    return h("article", { class: "iaas-assessment-block" }, [
      h("h3", {}, ["Signos vitales"]),
      h("div", { class: "iaas-field-grid" }, [
        iaasDateInput(date, patientId, "vitalSigns", "studyDate", "Fecha del estudio", assessment.vitalSigns?.studyDate || date),
        ...fields,
        ...ventilationFields
      ])
    ]);
  }

  function renderIaasCbc(date, patientId, assessment) {
    return h("article", { class: "iaas-assessment-block" }, [
      h("h3", {}, ["Biometría hemática"]),
      h("div", { class: "iaas-field-grid three" }, [
        iaasDateInput(date, patientId, "cbc", "studyDate", "Fecha del estudio", assessment.cbc?.studyDate || date),
        ...IAAS_CBC_FIELDS.map(([key, label]) => iaasTextInput(date, patientId, "cbc", key, label, assessment.cbc?.[key]))
      ])
    ]);
  }

  function renderIaasUrinalysis(date, patientId, assessment) {
    return h("article", { class: "iaas-assessment-block" }, [
      h("h3", {}, ["Examen general de orina"]),
      h("div", { class: "iaas-field-grid three" }, [
        iaasDateInput(date, patientId, "urinalysis", "studyDate", "Fecha del estudio", assessment.urinalysis?.studyDate || date),
        ...IAAS_URINALYSIS_SELECTS.map(([key, label, values]) => iaasSelectInput(date, patientId, "urinalysis", key, label, values, assessment.urinalysis?.[key])),
        iaasTextInput(date, patientId, "urinalysis", "leukocytes", "Leucocitos", assessment.urinalysis?.leukocytes)
      ])
    ]);
  }

  function renderIaasOtherStudies(date, patientId, assessment, limited, viralOptions) {
    const viralRows = assessment.otherStudies?.viralPanel?.length ? assessment.otherStudies.viralPanel : [{ test: viralOptions[0], result: "" }];
    return h("article", { class: "iaas-assessment-block" }, [
      h("div", { class: "iaas-block-head" }, [
        h("h3", {}, ["Otros estudios"]),
        h("button", { class: "iaas-button ghost compact", type: "button", onclick: () => addIaasViralPanel(date, patientId, viralOptions[0]) }, ["Agregar panel viral"])
      ]),
      h("div", { class: `iaas-field-grid ${limited ? "" : "four"}` }, [
        iaasDateInput(date, patientId, "otherStudies", "studyDate", "Fecha del estudio", assessment.otherStudies?.studyDate || date),
        ...(limited ? [] : IAAS_OTHER_STUDY_FIELDS.map(([key, label]) => iaasTextInput(date, patientId, "otherStudies", key, label, assessment.otherStudies?.[key])))
      ]),
      h("div", { class: "iaas-repeat-list viral-panel-list" }, viralRows.map((row, index) =>
        h("div", { class: "iaas-repeat-row viral-panel-row" }, [
          h("label", { class: "field" }, [
            h("span", {}, ["Panel viral"]),
            h("select", { onchange: event => updateIaasViralPanel(date, patientId, index, { test: event.target.value }) }, viralOptions.map(value => option(value, value, row.test === value)))
          ]),
          h("label", { class: "field" }, [
            h("span", {}, ["Resultado"]),
            h("select", { onchange: event => updateIaasViralPanel(date, patientId, index, { result: event.target.value }) }, ["", "Negativo", "Positivo"].map(value => option(value, value || "Sin resultado", row.result === value)))
          ]),
          h("button", { class: "iaas-button ghost compact", type: "button", onclick: () => removeIaasViralPanel(date, patientId, index) }, ["Quitar"])
        ])
      ))
    ]);
  }

  function renderHemodialysisInfectionPanel(date, patientId, patient, assessment) {
    const section = assessment.infectionTracking || {};
    const signals = hemodialysisInfectionSignals(patient);
    return h("article", { class: "iaas-assessment-block full hemodialysis-infection-panel" }, [
      h("div", { class: "iaas-block-head" }, [
        h("h3", {}, ["Seguimiento de infecciones"]),
        h("span", { class: "badge epi-riesgo-iaas" }, ["HEMODIÁLISIS"])
      ]),
      signals.length
        ? h("div", { class: "iaas-signal-list" }, signals.map(signal => h("span", { class: "iaas-signal-chip" }, [signal])))
        : h("p", { class: "muted" }, ["Sin datos de parche, gasas o secreciones detectados en el censo actual; registrar la valoración directa del acceso."]),
      h("div", { class: "iaas-field-grid three" }, [
        iaasDateInput(date, patientId, "infectionTracking", "assessmentDate", "Fecha de revisión", section.assessmentDate || date),
        iaasSelectInput(date, patientId, "infectionTracking", "patchIntegrity", "Parche", IAAS_PATCH_STATUS_OPTIONS, section.patchIntegrity),
        iaasSelectInput(date, patientId, "infectionTracking", "patchMoisture", "Humedad del parche", IAAS_MOISTURE_OPTIONS, section.patchMoisture),
        iaasSelectInput(date, patientId, "infectionTracking", "externalGauze", "Gasas externas", IAAS_GAUZE_OPTIONS, section.externalGauze),
        iaasSelectInput(date, patientId, "infectionTracking", "internalGauze", "Gasas internas", IAAS_GAUZE_OPTIONS, section.internalGauze),
        iaasSelectInput(date, patientId, "infectionTracking", "secretionPresence", "Secreción", IAAS_SECRETION_PRESENCE_OPTIONS, section.secretionPresence),
        iaasSelectInput(date, patientId, "infectionTracking", "secretionType", "Tipo de secreción", IAAS_SECRETION_TYPE_OPTIONS, section.secretionType),
        iaasTextInput(date, patientId, "infectionTracking", "secretionAmount", "Cantidad", section.secretionAmount),
        iaasTextInput(date, patientId, "infectionTracking", "insertionSite", "Sitio de inserción", section.insertionSite),
        iaasSelectInput(date, patientId, "infectionTracking", "probableOrigin", "Origen probable", IAAS_ORIGIN_OPTIONS, section.probableOrigin)
      ]),
      iaasTextareaInput(date, patientId, "infectionTracking", "carePlan", "Plan de cuidado y seguimiento", section.carePlan, "Ej. parche íntegro, gasas secas, sin secreción, seguimiento en hemodiálisis...")
    ]);
  }

  function renderIaasCultures(date, patientId, assessment) {
    const cultures = assessment.cultures || [];
    return h("article", { class: "iaas-assessment-block full" }, [
      h("div", { class: "iaas-block-head" }, [
        h("h3", {}, ["Cultivos"]),
        h("button", { class: "iaas-button primary compact", type: "button", onclick: () => addIaasCulture(date, patientId) }, ["Agregar cultivo"])
      ]),
      cultures.length ? h("div", { class: "iaas-repeat-list" }, cultures.map((culture, index) =>
        h("div", { class: "iaas-repeat-row culture-row" }, [
          h("label", { class: "field wide" }, [
            h("span", {}, ["Tipo de cultivo"]),
            h("select", { onchange: event => updateIaasCulture(date, patientId, index, { type: event.target.value }, true) }, ["", ...IAAS_CULTURE_TYPES].map(value => option(value, value || "Seleccionar", culture.type === value)))
          ]),
          culture.type === "Cultivo de herida" ? h("label", { class: "field" }, [
            h("span", {}, ["Sitio anatómico"]),
            h("input", { value: culture.woundSite || "", oninput: event => updateIaasCulture(date, patientId, index, { woundSite: event.target.value }) })
          ]) : "",
          h("label", { class: "field" }, [
            h("span", {}, ["Fecha de toma"]),
            h("input", { type: "date", value: culture.collectionDate || "", oninput: event => updateIaasCulture(date, patientId, index, { collectionDate: event.target.value }) })
          ]),
          h("label", { class: "field" }, [
            h("span", {}, ["Fecha de resultado"]),
            h("input", { type: "date", value: culture.resultDate || "", oninput: event => updateIaasCulture(date, patientId, index, { resultDate: event.target.value }) })
          ]),
          h("label", { class: "field wide" }, [
            h("span", {}, ["Microorganismo aislado"]),
            h("input", { value: culture.microorganism || "", oninput: event => updateIaasCulture(date, patientId, index, { microorganism: event.target.value }) })
          ]),
          h("button", { class: "iaas-button ghost compact", type: "button", onclick: () => removeIaasCulture(date, patientId, index) }, ["Quitar"])
        ])
      )) : h("p", { class: "muted" }, ["Sin cultivos agregados en esta valoración."])
    ]);
  }

  function renderIaasTreatments(date, patientId, assessment) {
    const treatments = assessment.treatments || [];
    return h("article", { class: "iaas-assessment-block full" }, [
      h("div", { class: "iaas-block-head" }, [
        h("h3", {}, ["Tratamiento"]),
        h("button", { class: "iaas-button primary compact", type: "button", onclick: () => addIaasTreatment(date, patientId) }, ["Agregar fármaco"])
      ]),
      treatments.length ? h("div", { class: "iaas-repeat-list" }, treatments.map((treatment, index) =>
        h("div", { class: "iaas-repeat-row treatment-row" }, [
          h("label", { class: "field wide" }, [
            h("span", {}, ["Fármaco"]),
            h("select", { onchange: event => updateIaasTreatment(date, patientId, index, { drug: event.target.value }, true) }, ["", ...IAAS_ANTIMICROBIALS].map(value => option(value, value || "Seleccionar", treatment.drug === value)))
          ]),
          treatment.drug === "Otro" ? h("label", { class: "field" }, [
            h("span", {}, ["Nombre del fármaco"]),
            h("input", { value: treatment.customDrug || "", oninput: event => updateIaasTreatment(date, patientId, index, { customDrug: event.target.value }) })
          ]) : "",
          h("label", { class: "field" }, [
            h("span", {}, ["Fecha de inicio"]),
            h("input", { type: "date", value: treatment.startDate || "", oninput: event => updateIaasTreatment(date, patientId, index, { startDate: event.target.value }, true) })
          ]),
          h("label", { class: "field" }, [
            h("span", {}, ["Fecha de término"]),
            h("input", { type: "date", value: treatment.endDate || "", oninput: event => updateIaasTreatment(date, patientId, index, { endDate: event.target.value }, true) })
          ]),
          h("label", { class: "field" }, [
            h("span", {}, ["Contador días"]),
            h("input", { value: treatmentDaysLabel(treatment, date), disabled: true })
          ]),
          h("button", { class: "iaas-button ghost compact", type: "button", onclick: () => removeIaasTreatment(date, patientId, index) }, ["Quitar"])
        ])
      )) : h("p", { class: "muted" }, ["Sin tratamiento agregado en esta valoración."])
    ]);
  }

  function renderIaasGeneralObservations(date, patientId, assessment) {
    return h("article", { class: "iaas-assessment-block full iaas-observations-block" }, [
      h("h3", {}, ["Observaciones IAAS"]),
      iaasTextareaInput(date, patientId, "observations", null, "Observaciones", assessment.observations || "", "Escribir libremente la evolución, pendientes, aclaraciones o seguimiento del día...")
    ]);
  }

  function iaasDateInput(date, patientId, section, key, label, value) {
    return h("label", { class: "field" }, [
      h("span", {}, [label]),
      h("input", {
        type: "date",
        value: normalizeDate(value) || normalizeDate(date) || isoToday(),
        oninput: event => updateIaasSectionField(date, patientId, section, key, event.target.value)
      })
    ]);
  }

  function iaasTextInput(date, patientId, section, key, label, value) {
    return h("label", { class: "field" }, [
      h("span", {}, [label]),
      h("input", {
        value: value || "",
        placeholder: label,
        oninput: event => updateIaasSectionField(date, patientId, section, key, event.target.value)
      })
    ]);
  }

  function iaasTextareaInput(date, patientId, section, key, label, value, placeholder = "") {
    return h("label", { class: "field full" }, [
      h("span", {}, [label]),
      h("textarea", {
        value: value || "",
        placeholder,
        oninput: event => key
          ? updateIaasSectionField(date, patientId, section, key, event.target.value)
          : updateIaasTopLevelField(date, patientId, section, event.target.value)
      })
    ]);
  }

  function iaasSelectInput(date, patientId, section, key, label, values, value) {
    return h("label", { class: "field" }, [
      h("span", {}, [label]),
      h("select", { onchange: event => updateIaasSectionField(date, patientId, section, key, event.target.value) },
        values.map(item => option(item, item || "Seleccionar", value === item))
      )
    ]);
  }

  function updateIaasSectionField(date, patientId, section, key, value, rerender = false) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment[section] ||= {};
      assessment[section][key] = value;
    }, rerender);
  }

  function updateIaasTopLevelField(date, patientId, key, value, rerender = false) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment[key] = value;
    }, rerender);
  }

  function addIaasViralPanel(date, patientId, test = "VIH") {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.otherStudies.viralPanel = [...(assessment.otherStudies.viralPanel || []), { test, result: "" }];
    }, true);
  }

  function updateIaasViralPanel(date, patientId, index, patch) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.otherStudies.viralPanel[index] = { ...(assessment.otherStudies.viralPanel[index] || {}), ...patch };
    });
  }

  function removeIaasViralPanel(date, patientId, index) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.otherStudies.viralPanel = (assessment.otherStudies.viralPanel || []).filter((_, itemIndex) => itemIndex !== index);
    }, true);
  }

  function addIaasCulture(date, patientId) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.cultures = [...(assessment.cultures || []), {
        type: "",
        woundSite: "",
        collectionDate: date,
        resultDate: "",
        microorganism: ""
      }];
    }, true);
  }

  function updateIaasCulture(date, patientId, index, patch, rerender = false) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.cultures[index] = { ...(assessment.cultures[index] || {}), ...patch };
    }, rerender);
  }

  function removeIaasCulture(date, patientId, index) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.cultures = (assessment.cultures || []).filter((_, itemIndex) => itemIndex !== index);
    }, true);
  }

  function addIaasTreatment(date, patientId) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.treatments = [...(assessment.treatments || []), {
        drug: "",
        customDrug: "",
        startDate: date,
        endDate: "",
        notes: ""
      }];
    }, true);
  }

  function updateIaasTreatment(date, patientId, index, patch, rerender = false) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.treatments[index] = { ...(assessment.treatments[index] || {}), ...patch };
    }, rerender);
  }

  function removeIaasTreatment(date, patientId, index) {
    mutateIaasAssessment(date, patientId, assessment => {
      assessment.treatments = (assessment.treatments || []).filter((_, itemIndex) => itemIndex !== index);
    }, true);
  }

  function mutateIaasAssessment(date, patientId, mutator, rerender = false) {
    const draft = getReviewDraft(date, patientId);
    draft.iaasAssessment = normalizeIaasAssessment(draft.iaasAssessment);
    mutator(draft.iaasAssessment);
    setReviewDraft(date, patientId, draft);
    if (rerender) renderIaas();
  }

  function renderIaasTemperatureChart(patientId) {
    const points = dailyIaasEntries(patientId)
      .map(entry => ({ date: entry.date, value: numericTemperature(entry.assessment.vitalSigns?.temperature) }))
      .filter(point => Number.isFinite(point.value));
    if (!points.length) {
      return h("div", { class: "iaas-temperature-chart empty" }, [
        h("strong", {}, ["Temperatura corporal"]),
        h("span", {}, ["Sin temperaturas guardadas todavía."])
      ]);
    }
    const min = Math.min(35, ...points.map(point => point.value));
    const max = Math.max(40, ...points.map(point => point.value));
    const width = 680;
    const height = 180;
    const coordinates = points.map((point, index) => {
      const x = 42 + index * ((width - 84) / Math.max(1, points.length - 1));
      const y = 26 + ((max - point.value) / Math.max(.1, max - min)) * (height - 58);
      return { ...point, x, y };
    });
    return h("div", { class: "iaas-temperature-chart" }, [
      h("strong", {}, ["Temperatura corporal"]),
      h("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Gráfica de temperatura corporal" }, [
        h("line", { x1: "42", y1: String(height - 32), x2: String(width - 24), y2: String(height - 32) }),
        h("line", { x1: "42", y1: "18", x2: "42", y2: String(height - 32) }),
        h("polyline", { points: coordinates.map(point => `${point.x},${point.y}`).join(" "), fill: "none" }),
        ...coordinates.map(point => h("circle", { cx: String(point.x), cy: String(point.y), r: "5" })),
        ...coordinates.map((point, index) => h("text", { x: String(point.x - 14), y: String(height - 10) }, [formatShortDate(point.date)])),
        ...coordinates.map(point => h("text", { x: String(point.x - 12), y: String(point.y - 10) }, [`${point.value}°`]))
      ])
    ]);
  }

  function renderDailyIaasTable(patient, patientId, date) {
    const saved = new Map(dailyIaasEntries(patientId).map(entry => [entry.date, entry.assessment]));
    const dates = patientIaasDateRange(patient, date);
    const rows = dailyIaasRowsForPatient(patient);
    return h("div", { class: "daily-iaas-scroll" }, [
      h("table", { class: "daily-iaas-table" }, [
        h("thead", {}, [h("tr", {}, [
          h("th", { colspan: "2", class: "daily-iaas-field-head" }, ["Campo"]),
          ...dates.map(item => h("th", {}, [formatDisplayDate(item)]))
        ])]),
        h("tbody", {}, rows.map((row, index) => {
          const previous = rows[index - 1];
          const isFirstInGroup = !previous || previous.group !== row.group;
          const rowSpan = isFirstInGroup ? rows.filter(item => item.group === row.group).length : 0;
          return h("tr", {}, [
            isFirstInGroup ? h("th", { class: "daily-iaas-group", rowspan: String(rowSpan) }, [row.group]) : "",
            h("th", { class: "daily-iaas-attribute" }, [row.label]),
            ...dates.map(item => h("td", {}, [row.getter(saved.get(item)) || h("span", { class: "muted" }, ["-"])]))
          ]);
        }))
      ])
    ]);
  }

  function dailyIaasRowsForPatient(patient) {
    const limited = isLimitedIaasAssessmentService(patient.currentService);
    const hemodialysis = isHemodialysisService(patient.currentService);
    const fieldRow = (group, label, getter) => ({ group, label, getter });
    const rows = [
      ...IAAS_VITAL_FIELDS.map(([key, label]) => fieldRow("SIGNOS VITALES", label, assessment => dailyFieldValue(assessment?.vitalSigns?.[key]))),
      ...IAAS_VENTILATION_FIELDS.map(([key, label]) => fieldRow("VENTILACIÓN", label, assessment => dailyFieldValue(assessment?.vitalSigns?.[key])))
    ];
    if (!limited) {
      rows.push(
        ...IAAS_CBC_FIELDS.map(([key, label]) => fieldRow("BIOMETRÍA HEMÁTICA", label, assessment => dailyFieldValue(assessment?.cbc?.[key]))),
        ...IAAS_URINALYSIS_SELECTS.map(([key, label]) => fieldRow("EXAMEN GENERAL DE ORINA", label, assessment => dailyFieldValue(assessment?.urinalysis?.[key]))),
        fieldRow("EXAMEN GENERAL DE ORINA", "Leucocitos", assessment => dailyFieldValue(assessment?.urinalysis?.leukocytes))
      );
    }
    rows.push(
      ...(limited ? [] : IAAS_OTHER_STUDY_FIELDS.map(([key, label]) => fieldRow("OTROS ESTUDIOS", label, assessment => dailyFieldValue(assessment?.otherStudies?.[key])))),
      fieldRow("OTROS ESTUDIOS", "Panel viral", assessment => summarizeViralPanel(assessment?.otherStudies?.viralPanel)),
      ...(hemodialysis ? IAAS_INFECTION_TRACKING_FIELDS
        .filter(([key]) => key !== "assessmentDate")
        .map(([key, label]) => fieldRow("SEGUIMIENTO DE INFECCIONES", label, assessment => dailyFieldValue(assessment?.infectionTracking?.[key]))) : []),
      fieldRow("CULTIVOS", "Cultivos", assessment => summarizeCultures(assessment?.cultures)),
      fieldRow("TRATAMIENTO", "Tratamiento", assessment => summarizeTreatments(assessment?.treatments)),
      fieldRow("OBSERVACIONES IAAS", "Observaciones", assessment => dailyFieldValue(assessment?.observations))
    );
    return rows;
  }

  function dailyFieldValue(value) {
    return cleanCell(value);
  }

  function renderIaasStudyHistory(patient, patientId) {
    const entries = dailyIaasEntries(patientId);
    const revisionEntries = iaasRevisionHistoryEntries(patientId);
    if (!entries.length && !revisionEntries.length) return "";
    return h("details", { class: "iaas-study-history" }, [
      h("summary", {}, ["Historial de estudios ingresados y ediciones"]),
      h("div", { class: "iaas-history-list" }, [
        ...entries.map(entry => renderIaasHistoryCard(patient, entry, false)),
        ...revisionEntries.map(entry => renderIaasHistoryCard(patient, entry, true))
      ])
    ]);
  }

  function renderIaasHistoryCard(patient, entry, revision) {
    const assessment = normalizeIaasAssessment(entry.assessment);
    const limited = isLimitedIaasAssessmentService(patient.currentService);
    const hemodialysis = isHemodialysisService(patient.currentService);
    const lines = [
      `Signos vitales (${formatDisplayDate(assessment.vitalSigns.studyDate || entry.date) || "sin fecha"}): ${summarizeSection(assessment.vitalSigns, [...IAAS_VITAL_FIELDS, ...IAAS_VENTILATION_FIELDS]) || "sin datos"}`,
      !limited ? `Biometría hemática (${formatDisplayDate(assessment.cbc.studyDate || entry.date) || "sin fecha"}): ${summarizeSection(assessment.cbc, IAAS_CBC_FIELDS) || "sin datos"}` : "",
      !limited ? `EGO (${formatDisplayDate(assessment.urinalysis.studyDate || entry.date) || "sin fecha"}): ${summarizeUrinalysis(assessment.urinalysis) || "sin datos"}` : "",
      `Otros estudios (${formatDisplayDate(assessment.otherStudies.studyDate || entry.date) || "sin fecha"}): ${summarizeOtherStudies(assessment.otherStudies) || "sin datos"}`,
      hemodialysis ? `Seguimiento infecciones: ${summarizeHemodialysisInfection(assessment.infectionTracking) || "sin datos"}` : "",
      assessment.observations ? `Observaciones IAAS: ${assessment.observations}` : ""
    ].filter(Boolean);
    return h("article", { class: `iaas-history-card ${revision ? "revision" : ""}` }, [
      h("strong", {}, [revision ? `Edición previa · ${formatDisplayDate(entry.date) || entry.date}` : `Registro guardado · ${formatDisplayDate(entry.date) || entry.date}`]),
      entry.editedAt ? h("small", {}, [`Guardado originalmente: ${formatDateTime(entry.editedAt)}`]) : "",
      h("ul", {}, lines.map(line => h("li", {}, [line])))
    ]);
  }

  function iaasRevisionHistoryEntries(patientId) {
    return Object.values(store.dailyRounds || {}).flatMap(round =>
      Object.values(round.entries || {})
        .filter(entry => entry.patientId === patientId)
        .flatMap(entry => Array.isArray(entry.iaasAssessmentHistory)
          ? entry.iaasAssessmentHistory.map(history => ({
            date: history.roundDate || entry.roundDate || "",
            editedAt: history.editedAt || "",
            assessment: history.assessment
          }))
          : [])
    ).filter(entry => entry.assessment);
  }

  function dailyIaasEntries(patientId) {
    return Object.entries(store.dailyRounds || {})
      .map(([date, round]) => {
        const entry = round.entries?.[patientId];
        return entry?.iaasAssessment ? { date: entry.roundDate || date, assessment: normalizeIaasAssessment(entry.iaasAssessment) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function patientIaasDateRange(patient, date) {
    const start = normalizeDate(patient.admissionDate) || date;
    const end = normalizeDate(date) || isoToday();
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) return [end];
    const out = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) out.push(toIsoDate(d));
    return out;
  }

  function summarizeSection(section, fields) {
    return fields.map(([key, label]) => cleanCell(section?.[key]) ? `${label}: ${cleanCell(section[key])}` : "").filter(Boolean).join(" · ");
  }

  function summarizeUrinalysis(section = {}) {
    return [
      summarizeSection(section, IAAS_URINALYSIS_SELECTS.map(([key, label]) => [key, label])),
      cleanCell(section.leukocytes) ? `Leucocitos: ${cleanCell(section.leukocytes)}` : ""
    ].filter(Boolean).join(" · ");
  }

  function summarizeOtherStudies(section = {}) {
    return [
      summarizeSection(section, IAAS_OTHER_STUDY_FIELDS),
      summarizeViralPanel(section.viralPanel)
    ].filter(Boolean).join(" · ");
  }

  function summarizeHemodialysisInfection(section = {}) {
    return summarizeSection(section, IAAS_INFECTION_TRACKING_FIELDS);
  }

  function summarizeViralPanel(rows = []) {
    return rows.map(row => cleanCell(row.test) ? `${row.test}: ${cleanCell(row.result) || "sin resultado"}` : "").filter(Boolean).join(" · ");
  }

  function summarizeCultures(rows = []) {
    return rows.map(row => {
      const type = cleanCell(row.type);
      if (!type) return "";
      const site = row.woundSite ? ` (${row.woundSite})` : "";
      const micro = row.microorganism ? `: ${row.microorganism}` : "";
      return `${type}${site}${micro}`;
    }).filter(Boolean).join(" · ");
  }

  function summarizeTreatments(rows = []) {
    return rows.map(row => {
      const drug = row.drug === "Otro" ? row.customDrug : row.drug;
      if (!cleanCell(drug)) return "";
      return `${drug}${row.startDate ? ` desde ${formatDisplayDate(row.startDate)}` : ""}${row.endDate ? ` a ${formatDisplayDate(row.endDate)}` : ""}`;
    }).filter(Boolean).join(" · ");
  }

  function numericTemperature(value) {
    const match = String(value || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function formatShortDate(value) {
    const iso = normalizeDate(value);
    if (!iso) return "";
    const [, month, day] = iso.split("-");
    return `${day}/${month}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return cleanCell(value);
    return date.toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function treatmentDaysLabel(treatment, fallbackDate) {
    const start = normalizeDate(treatment.startDate);
    if (!start) return "";
    const end = normalizeDate(treatment.endDate) || normalizeDate(fallbackDate) || isoToday();
    const days = (daysBetween(start, end) ?? 0) + 1;
    return `${days} ${days === 1 ? "día" : "días"}`;
  }

  function hasVentilationDevice(active) {
    return active.some(ep => ["Ventilación mecánica", "Tubo endotraqueal", "Traqueostomía"].includes(ep.deviceType));
  }

  function isLimitedIaasAssessmentService(service) {
    return ["HEMODIALISIS", "HEMODIÁLISIS", "ONCOLOGIA", "ONCOLOGÍA", "AMBULATORIO"].includes(normalizeText(service));
  }

  function isHemodialysisService(service) {
    return ["HEMODIALISIS", "HEMODIÁLISIS"].includes(normalizeText(service));
  }

  function hemodialysisInfectionSignals(patient = {}) {
    const text = normalizeText([
      patient.currentDiagnosis,
      patient.epidemiologicalDiagnosis,
      patient.currentEpidemiologicalDiagnosis,
      patient.observations,
      patient.notes
    ].filter(Boolean).join(" "));
    const signals = [];
    if (/PARCHE.*(DESPEG|NO INTEGRO|NO ÍNTEGRO)/.test(text)) signals.push("Parche no íntegro o despegado");
    if (/PARCHE.*(HUMED|HÚMED|MOJAD)/.test(text)) signals.push("Parche húmedo/mojado");
    if (/GASAS?.*EXTERNAS?.*(HUMED|HÚMED|MOJAD)/.test(text)) signals.push("Gasas externas húmedas/mojadas");
    if (/GASAS?.*INTERNAS?.*(HUMED|HÚMED|MOJAD)/.test(text)) signals.push("Gasas internas húmedas/mojadas");
    if (/GASAS?.*(INTERNAS?.*EXTERNAS?|EXTERNAS?.*INTERNAS?).*(HUMED|HÚMED|MOJAD)/.test(text)) signals.push("Gasas internas y externas húmedas/mojadas");
    if (/SECREC|SECRES|PURUL|VERDOSA|AMARILL/.test(text)) signals.push("Presencia o sospecha de secreción");
    if (/HEMOCULT|CULTIVO|STAPH|BACILLUS|PSEUDOMONA|KLEBSIELLA|E COLI|ENTEROCOC/.test(text)) signals.push("Cultivo o microorganismo documentado");
    if (/CASA|DOMICIL/.test(text)) signals.push("Dato relacionado con cuidado en casa");
    if (/HEMODIAL/.test(text)) signals.push("Dato relacionado con hemodiálisis");
    return unique(signals);
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
    ui.importDate = date;
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
    const date = document.querySelector("#import-date")?.value || ui.importDate || isoToday();
    ui.importDate = date;
    ui.importProgress = "Leyendo archivo...";
    renderIaas();
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const rows = await parseXlsx(file);
        ui.importDraft = buildImportDraft(rows, date);
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        const text = await file.text();
        ui.importText = text;
        ui.importDraft = buildImportDraft(parseDelimitedText(text), date);
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
    const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    return rowsFromMatrix(matrix);
  }

  function rowsFromMatrix(matrix) {
    const rows = (matrix || []).filter(row => Array.isArray(row) && row.some(cell => cleanCell(cell)));
    if (!rows.length) return [];
    const headerIndex = rows.findIndex(row => looksLikeImportHeader(row.map(cleanCell)));
    const startIndex = headerIndex >= 0 ? headerIndex : 0;
    const headers = rows[startIndex].map(header => cleanCell(header));
    return rows.slice(startIndex + 1).map(cells => {
      const row = {};
      headers.forEach((header, index) => row[header] = cells[index] ?? "");
      return row;
    });
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
    const serviceBed = splitServiceBed(mapped.servicio_cama);
    const row = {
      patient_id: cleanCell(mapped.patient_id || mapped.hospital_internal_id || ""),
      patient_name: cleanCell(mapped.patient_name).toUpperCase(),
      rfc: cleanCell(mapped.rfc),
      fecha_nacimiento: normalizeDate(mapped.fecha_nacimiento),
      fecha_censo: normalizeDate(mapped.fecha_censo) || fallbackDate,
      servicio: normalizeService(mapped.servicio || serviceBed.service),
      cama: normalizeBed(mapped.cama || serviceBed.bed),
      sector: cleanCell(mapped.sector),
      edad: parseAge(mapped.edad),
      sexo: normalizeSex(mapped.sexo),
      fecha_ingreso: normalizeDate(mapped.fecha_ingreso),
      dx_epidemiologico: cleanCell(mapped.dx_epidemiologico),
      estado: mapped.estado ? displayState(mapped.estado) : "",
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
    if (!row.patient_id && !row.hospital_internal_id && !row.patient_name) errors.push("Falta patient_id, expediente o nombre de paciente.");
    if (!row.fecha_censo) errors.push("Fecha de censo inválida.");
    if (!row.servicio) errors.push("Falta servicio.");
    if (!row.cama) errors.push("Falta cama.");
    if (mapped.edad && row.edad === null) warnings.push("Edad no numérica.");
    if (mapped.fecha_ingreso && !row.fecha_ingreso && !["AMB", "NA"].includes(normalizeText(mapped.fecha_ingreso))) warnings.push("Fecha de ingreso inválida.");
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
          rfc: row.rfc || null,
          birthDate: row.fecha_nacimiento || null,
          hospitalInternalId: row.hospital_internal_id || row.patient_id || null,
          pseudonymizedId: row.patientId,
          currentService: row.servicio,
          currentBed: row.cama,
          sector: row.sector || null,
          sex: row.sexo,
          age: row.edad,
          admissionDate: row.fecha_ingreso || null,
          currentState: row.estado || null,
          currentDiagnosis: row.diagnostico_actual || null,
          epidemiologicalDiagnosis: row.dx_epidemiologico || row.riesgo_iaas || null,
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
        previous.rfc = row.rfc || previous.rfc || null;
        previous.birthDate = row.fecha_nacimiento || previous.birthDate || null;
        previous.sector = row.sector || previous.sector || null;
        previous.sex = row.sexo || previous.sex;
        previous.age = row.edad ?? previous.age;
        previous.admissionDate = row.fecha_ingreso || previous.admissionDate;
        previous.currentState = row.estado || previous.currentState || null;
        previous.currentDiagnosis = row.diagnostico_actual || previous.currentDiagnosis;
        previous.epidemiologicalDiagnosis = row.dx_epidemiologico || row.riesgo_iaas || previous.epidemiologicalDiagnosis || null;
        previous.observations = row.observaciones || row.pendientes || previous.observations || null;
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
        rfc: row.rfc || store.patients[row.patientId]?.rfc || null,
        birthDate: row.fecha_nacimiento || store.patients[row.patientId]?.birthDate || null,
        sector: row.sector || store.patients[row.patientId]?.sector || null,
        age: row.edad ?? null,
        sex: row.sexo || null,
        admissionDate: row.fecha_ingreso || null,
        state: row.estado || null,
        epidemiologicalDiagnosis: row.dx_epidemiologico || row.riesgo_iaas || store.patients[row.patientId]?.epidemiologicalDiagnosis || null,
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

  async function saveRoundEntry(date, patientId, requestedStatus, goNext) {
    const patient = store.patients[patientId];
    const draft = getReviewDraft(date, patientId);
    const errors = validateReviewDraft(date, patientId, draft, requestedStatus);
    const forcedIncomplete = errors.length && requestedStatus === "revisado";
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
    const status = forcedIncomplete ? "incompleto" : alerts.length ? "alerta" : requestedStatus;
    const previousEntry = store.dailyRounds[date]?.entries?.[patientId] || {};
    const iaasAssessment = completeIaasAssessmentForSave(draft.iaasAssessment, date);
    const storesIaasAssessment = draft.activeRoundSection === "iaas" || iaasAssessmentHasContent(iaasAssessment) || Boolean(previousEntry.iaasAssessment);
    const iaasAssessmentHistory = storesIaasAssessment
      ? buildIaasAssessmentHistory(previousEntry, iaasAssessment, date)
      : (Array.isArray(previousEntry.iaasAssessmentHistory) ? previousEntry.iaasAssessmentHistory : []);
    ensureDailyRound(date);
    const initialSyncStatus = syncStatusForNewWrite();
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
      syncStatus: initialSyncStatus,
      localSavedAt: nowIso(),
      serverConfirmedAt: null,
      notes: draft.notes || "",
      activeRoundSection: draft.activeRoundSection || "preventive",
      iaasAssessment: storesIaasAssessment
        ? (draft.activeRoundSection === "iaas" || iaasAssessmentHasContent(iaasAssessment) ? iaasAssessment : previousEntry.iaasAssessment)
        : null,
      iaasAssessmentHistory,
      iaasAssessmentUpdatedAt: draft.activeRoundSection === "iaas" ? nowIso() : previousEntry.iaasAssessmentUpdatedAt || null
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
    const syncItem = await enqueueWrite({ type: "roundEntry", date, patientId, entry, patient, episodes: createdEpisodeIds.map(id => store.deviceEpisodes[id]) });
    const finalSyncStatus = syncItem?.status === "server_synced" ? "server_synced" : syncItem?.status === "error" ? "error" : "local_pending";
    entry.syncStatus = finalSyncStatus;
    entry.serverConfirmedAt = finalSyncStatus === "server_synced" ? (syncItem?.serverConfirmedAt || ui.sheets.lastSyncAt || nowIso()) : null;
    if (store.dailyCensus[date]?.patients?.[patientId]) {
      store.dailyCensus[date].patients[patientId].syncStatus = entry.syncStatus;
      store.dailyCensus[date].patients[patientId].serverConfirmedAt = entry.serverConfirmedAt;
    }
    saveStore();
    flashIaas(finalSyncStatus === "server_synced"
      ? "Sincronizado."
      : finalSyncStatus === "error"
        ? "Guardado localmente. No se pudo sincronizar; quedo pendiente."
        : "Guardado localmente. Pendiente de sincronizar.");
    if (goNext) {
      const next = draft.activeRoundSection === "iaas" ? nextIaasPatientId(date, patientId) : nextPatientId(date, patientId);
      location.hash = next ? `#/ronda/${date}/paciente/${next}${draft.activeRoundSection === "iaas" ? "/iaas" : ""}` : `#/${draft.activeRoundSection === "iaas" ? "seguimiento-iaas" : `ronda/${date}`}`;
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
    if (requestedStatus === "revisado" && draft.activeRoundSection !== "iaas" && !draft.noInvasivesConfirmed && !(draft.deviceDrafts || []).length && !activeEpisodes(patientId, date).length) {
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
    ui.sheets.errorDetail = "";
    renderIaas();
    try {
      const ranges = [
        sheetRange(SHEETS_CONFIG.tabs.appConfig, "A1:B100"),
        sheetRange(SHEETS_CONFIG.tabs.baseDatos, "A1:U1000"),
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
      ui.sheets.errorDetail = detailedError(error);
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
      sheetRange(SHEETS_CONFIG.tabs.baseDatos, `A1:U${SHEETS_CONFIG.maxRows}`),
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
          { range: sheetRange(SHEETS_CONFIG.tabs.baseDatos, `A1:U${baseRowsForSheets().length}`), values: baseRowsForSheets() },
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
    markSnapshotSynced(confirmedAt);
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
      throw sheetsApiError(response.status, text);
    }
    if (response.status === 204) return {};
    return response.json();
  }

  async function printEpidemiologicalCensusFromSheets() {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.opener = null;
      printWindow.document.write("<!doctype html><title>Preparando impresión</title><body style=\"font-family:Arial,sans-serif;padding:24px\">Preparando impresión nativa desde Google Sheets...</body>");
    }
    try {
      if (ui.sheets.connected) {
        if (pendingQueue().length) await flushSyncQueue();
        else await writeOperationToSheets();
      }
      if (!ui.sheets.accessToken) {
        flashIaas("Conecta Sheets para preparar el censo nativo actualizado antes de imprimir.");
        await connectSheets();
      }
      if (!ui.sheets.accessToken) throw new Error("No se imprimió para evitar abrir un censo desactualizado. Conecta Sheets y vuelve a presionar Imprimir.");
      const url = await epidemiologicalCensusPrintUrl();
      if (printWindow) {
        printWindow.location.replace(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      flashIaas("Abriendo impresión nativa del censo epidemiológico desde Google Sheets.");
    } catch (error) {
      if (printWindow) printWindow.close();
      flashIaas(friendlyError(error));
      console.error(error);
    }
  }

  async function epidemiologicalCensusPrintUrl() {
    const spreadsheetId = cleanCell(SHEETS_CONFIG.spreadsheetId);
    if (!spreadsheetId) throw new Error("No hay un Google Sheets configurado para imprimir el censo epidemiológico.");
    const configuredGid = cleanCell(SHEETS_CONFIG.printSheetGid || SHEETS_CONFIG.epidemiologicalPrintGid || "");
    const gid = configuredGid || await resolveEpidemiologicalPrintGid(spreadsheetId);
    if (!gid) throw new Error("No se encontró la pestaña del censo epidemiológico en Google Sheets. Conecta Sheets o configura printSheetGid.");
    const printGrid = ui.sheets.accessToken
      ? await syncEpidemiologicalReportSheet(spreadsheetId, gid)
      : printReportGridBounds();
    const params = new URLSearchParams({
      exportFormat: "pdf",
      format: "pdf",
      gid: String(gid),
      range: printGrid.range,
      r1: String(printGrid.r1),
      c1: String(printGrid.c1),
      r2: String(printGrid.r2),
      c2: String(printGrid.c2),
      size: "0",
      portrait: "false",
      fitw: "true",
      scale: "4",
      sheetnames: "false",
      printtitle: "false",
      pagenumbers: "false",
      gridlines: "false",
      fzr: "false",
      attachment: "false",
      printnotes: "false",
      pageorder: "2",
      horizontal_alignment: "CENTER",
      vertical_alignment: "TOP",
      top_margin: "0.10",
      bottom_margin: "0.10",
      left_margin: "0.10",
      right_margin: "0.10"
    });
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?${params.toString()}`;
  }

  async function resolveEpidemiologicalPrintGid(spreadsheetId) {
    const candidates = unique([
      SHEETS_CONFIG.printSheetName,
      SHEETS_CONFIG.tabs.censoEpidemiologico,
      SHEETS_CONFIG.tabs.epidemiologico,
      "🖨️ REPORTE_BN",
      "REPORTE_BN",
      "CENSO VIG EPIDEMIOLOGICA",
      "CENSO VIG EPIDEMIOLÓGICA",
      "CENSO EPIDEMIOLOGICO",
      "CENSO EPIDEMIOLÓGICO",
      SHEETS_CONFIG.printFallbackSheetName,
      SHEETS_CONFIG.tabs.baseDatos
    ].map(cleanCell).filter(Boolean));
    if (!ui.sheets.accessToken) return "";
    const response = await fetch(`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(sheetId,title))`, {
      headers: { Authorization: `Bearer ${ui.sheets.accessToken}` }
    });
    if (!response.ok) throw new Error("No se pudo leer la lista de pestañas de Google Sheets para imprimir.");
    const metadata = await response.json();
    const sheets = metadata.sheets || [];
    const match = sheets.find(sheet => candidates.some(name => normalizeText(sheet.properties?.title) === normalizeText(name)));
    return match?.properties?.sheetId ?? "";
  }

  async function syncEpidemiologicalReportSheet(spreadsheetId, gid) {
    const sheetId = Number(gid);
    if (!Number.isFinite(sheetId)) return printReportGridBounds();
    const report = buildPrintReportModel();
    await sheetsRequest(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: epidemiologicalReportSheetRequests(sheetId, report) })
    });
    return printReportGridBounds(report);
  }

  function epidemiologicalReportSheetRequests(sheetId, report = buildPrintReportModel()) {
    const printGrid = printReportGridBounds(report);
    const endRow = printGrid.r2;
    const hiddenStartRow = Math.max(endRow, 6);
    const reportRows = report.rows;
    const totalColumns = report.columns;
    const bottomStart = report.bottomStartIndex;
    const indicatorStart = bottomStart + 1;
    const indicatorEnd = reportRows.length;
    const requests = [
      { unmergeCells: { range: gridRange(sheetId, 0, SHEETS_CONFIG.maxRows, 0, 26) } },
      { updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: hiddenStartRow },
        properties: { hiddenByUser: false },
        fields: "hiddenByUser"
      } },
      { updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: hiddenStartRow, endIndex: SHEETS_CONFIG.maxRows },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser"
      } },
      { updateCells: {
        range: gridRange(sheetId, 0, SHEETS_CONFIG.maxRows, 0, 26),
        rows: [],
        fields: "userEnteredValue,userEnteredFormat"
      } },
      { updateCells: {
        range: gridRange(sheetId, 0, reportRows.length, 0, totalColumns),
        rows: reportRows.map(row => ({ values: row.map(value => sheetCellValue(value)) })),
        fields: "userEnteredValue"
      } },
      { repeatCell: {
        range: gridRange(sheetId, 0, endRow, 0, totalColumns),
        cell: { userEnteredFormat: {
          backgroundColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP",
          textFormat: { fontFamily: "Arial", fontSize: 7, foregroundColorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } }
        } },
        fields: "userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)"
      } },
      ...[0, 1, 2, 3].map(row => ({ mergeCells: { range: gridRange(sheetId, row, row + 1, 0, totalColumns), mergeType: "MERGE_ALL" } })),
      { repeatCell: {
        range: gridRange(sheetId, 0, 1, 0, totalColumns),
        cell: { userEnteredFormat: {
          horizontalAlignment: "CENTER",
          textFormat: { fontFamily: "Arial", fontSize: 10, bold: true, foregroundColorStyle: { rgbColor: { red: 0.05, green: 0.05, blue: 0.05 } } }
        } },
        fields: "userEnteredFormat(horizontalAlignment,textFormat)"
      } },
      { repeatCell: {
        range: gridRange(sheetId, 1, 2, 0, totalColumns),
        cell: { userEnteredFormat: {
          backgroundColorStyle: { rgbColor: { red: 0.08, green: 0.08, blue: 0.08 } },
          horizontalAlignment: "CENTER",
          textFormat: { fontFamily: "Arial", fontSize: 13, bold: true, foregroundColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } } }
        } },
        fields: "userEnteredFormat(backgroundColorStyle,horizontalAlignment,textFormat)"
      } },
      { repeatCell: {
        range: gridRange(sheetId, 2, 4, 0, totalColumns),
        cell: { userEnteredFormat: {
          horizontalAlignment: "CENTER",
          textFormat: { fontFamily: "Arial", fontSize: 10, bold: true, foregroundColorStyle: { rgbColor: { red: 0.12, green: 0.12, blue: 0.12 } } }
        } },
        fields: "userEnteredFormat(horizontalAlignment,textFormat)"
      } },
      { repeatCell: {
        range: gridRange(sheetId, 4, 5, 0, totalColumns),
        cell: { userEnteredFormat: {
          backgroundColorStyle: { rgbColor: { red: 0.16, green: 0.16, blue: 0.16 } },
          horizontalAlignment: "CENTER",
          textFormat: { fontFamily: "Arial", fontSize: 7, bold: true, foregroundColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } } }
        } },
        fields: "userEnteredFormat(backgroundColorStyle,horizontalAlignment,textFormat)"
      } },
      { repeatCell: {
        range: gridRange(sheetId, 5, bottomStart - 1, 0, 2),
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER", textFormat: { bold: true } } },
        fields: "userEnteredFormat(horizontalAlignment,textFormat.bold)"
      } },
      { repeatCell: {
        range: gridRange(sheetId, 5, bottomStart - 1, 3, 9),
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
        fields: "userEnteredFormat.horizontalAlignment"
      } },
      { repeatCell: {
        range: gridRange(sheetId, 5, bottomStart - 1, 0, totalColumns),
        cell: { userEnteredFormat: {
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP",
          textFormat: { fontFamily: "Arial", fontSize: 6 }
        } },
        fields: "userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment,userEnteredFormat.wrapStrategy,userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize"
      } },
      { repeatCell: {
        range: gridRange(sheetId, bottomStart, bottomStart + 1, 0, totalColumns),
        cell: { userEnteredFormat: {
          backgroundColorStyle: { rgbColor: { red: 0.03, green: 0.30, blue: 0.27 } },
          horizontalAlignment: "CENTER",
          textFormat: { fontFamily: "Arial", fontSize: 8, bold: true, foregroundColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } } }
        } },
        fields: "userEnteredFormat(backgroundColorStyle,horizontalAlignment,textFormat)"
      } },
      { updateBorders: {
        range: gridRange(sheetId, 4, bottomStart - 1, 0, totalColumns),
        top: reportBorder(),
        bottom: reportBorder(),
        left: reportBorder(),
        right: reportBorder(),
        innerHorizontal: reportBorder(),
        innerVertical: reportBorder()
      } },
      { updateBorders: {
        range: gridRange(sheetId, bottomStart, endRow, 0, totalColumns),
        top: reportBorder("SOLID_MEDIUM"),
        bottom: reportBorder(),
        left: reportBorder(),
        right: reportBorder(),
        innerHorizontal: reportBorder(),
        innerVertical: reportBorder()
      } },
      { repeatCell: {
        range: gridRange(sheetId, indicatorStart, indicatorEnd, 0, 5),
        cell: { userEnteredFormat: {
          backgroundColorStyle: { rgbColor: { red: 0.92, green: 0.96, blue: 0.95 } },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP",
          textFormat: { fontFamily: "Arial", fontSize: 7, bold: true, foregroundColorStyle: { rgbColor: { red: 0, green: 0.20, blue: 0.18 } } }
        } },
        fields: "userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)"
      } },
      { repeatCell: {
        range: gridRange(sheetId, indicatorStart, indicatorEnd, 5, 6),
        cell: { userEnteredFormat: {
          backgroundColorStyle: { rgbColor: { red: 0.97, green: 0.88, blue: 0.63 } },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          textFormat: { fontFamily: "Arial", fontSize: 8, bold: true, foregroundColorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } }
        } },
        fields: "userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment,textFormat)"
      } },
      { repeatCell: {
        range: gridRange(sheetId, indicatorStart, indicatorEnd, 6, totalColumns),
        cell: { userEnteredFormat: {
          backgroundColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP",
          textFormat: { fontFamily: "Arial", fontSize: 7, bold: false, foregroundColorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } }
        } },
        fields: "userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)"
      } },
      ...report.patientBreakRows.map(row => ({
        updateBorders: {
          range: gridRange(sheetId, row, row + 1, 0, totalColumns),
          top: reportBorder("SOLID_MEDIUM")
        }
      })),
      { mergeCells: { range: gridRange(sheetId, bottomStart, bottomStart + 1, 0, 6), mergeType: "MERGE_ALL" } },
      { mergeCells: { range: gridRange(sheetId, bottomStart, bottomStart + 1, 6, totalColumns), mergeType: "MERGE_ALL" } },
      ...indicatorMergeRequests(sheetId, indicatorStart, indicatorEnd),
      ...reportColumnWidthRequests(sheetId),
      { updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 4 },
        properties: { pixelSize: 22 },
        fields: "pixelSize"
      } },
      { autoResizeDimensions: { dimensions: { sheetId, dimension: "ROWS", startIndex: 4, endIndex: bottomStart - 1 } } },
      { updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: bottomStart, endIndex: endRow },
        properties: { pixelSize: 38 },
        fields: "pixelSize"
      } },
      { updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: totalColumns, endIndex: 26 },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser"
      } },
      { updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: totalColumns },
        properties: { hiddenByUser: false },
        fields: "hiddenByUser"
      } }
    ];
    return requests;
  }

  function buildPrintReportModel() {
    const date = activeDate();
    const items = monitoringRows(date).slice().sort(sortByPrintServiceBed);
    const headerRows = [
      ["INSTITUTO DE SEGURIDAD SOCIAL DE LOS TRABAJADORES DEL ESTADO DE CHIAPAS", "", "", "", "", "", "", "", "", "", "", ""],
      ["CENSO DE VIGILANCIA EPIDEMIOLÓGICA HOSPITALARIA", "", "", "", "", "", "", "", "", "", "", ""],
      ["HOSPITAL DE ESPECIALIDADES \"VIDA MEJOR\"", "", "", "", "", "", "", "", "", "", "", ""],
      [printReportDateTotalFormula(items.length), "", "", "", "", "", "", "", "", "", "", ""],
      ["SERVICIO", "CAMA", "PACIENTE", "SECTOR", "EDAD", "SEXO", "INGRESO", "DEIH", "ESTADO", "DX HOSPITALARIOS", "DX EPIDEMIOLÓGICOS", "OBSERVACIONES"]
    ];
    const patientRows = items.map(printReportPatientRow);
    const spacerRow = Array(12).fill("");
    const bottomRows = printReportBottomRows(items, date);
    const bottomStartIndex = headerRows.length + patientRows.length + 1;
    const rows = [...headerRows, ...patientRows, spacerRow, ...bottomRows];
    return {
      rows,
      columns: 12,
      patientRows: patientRows.length,
      bottomStartIndex,
      patientBreakRows: printReportServiceBreakRows(items, headerRows.length)
    };
  }

  function printReportPatientRow(item) {
    const ambulatory = isAmbulatoryStayService(item.service);
    return [
      printServiceLabel(item.service),
      printBedLabel(item.bed),
      cleanCell(item.patientName).toUpperCase(),
      printSectorLabel(item.sector),
      cleanCell(item.age),
      sexAbbreviation(item.sex),
      ambulatory ? "AMB" : formatDisplayDate(item.admissionDate),
      ambulatory ? "NA" : cleanCell(item.deih),
      cleanCell(item.state).toUpperCase(),
      cleanCell(item.dxHospital || "SIN DIAGNÓSTICO HOSPITALARIO").toUpperCase(),
      cleanCell(item.epiText || "SIN DX EPIDEMIOLÓGICO").toUpperCase(),
      cleanCell(item.observations || "SIN OBSERVACIONES").toUpperCase()
    ];
  }

  function printReportBottomRows(items, date) {
    const indicators = printReportIndicators(items, date);
    const responsiblePairs = {
      0: [
        "DRA. FABIOLA MONTERROSA HERNÁNDEZ\nJEFE DE DPTO. MED. PREV. Y EPIDEMIOLOGÍA",
        "DRA. GABRIELA ALEJANDRA TRUJILLO PALACIOS\nVIGILANCIA EPIDEMIOLÓGICA MATUTINO (RESPONSABLE IAAS)"
      ],
      3: [
        "DRA. MELANI CASTILLEJOS GORDILLO\nVIGILANCIA EPIDEMIOLÓGICA TRANSMISIBLES / NO TRANSMISIBLES",
        "DRA. ESTHER MARIN MÉNDEZ\nVIGILANCIA EPIDEMIOLÓGICA"
      ],
      6: [
        "L.E. MARIA ELENA LÓPEZ SARMIENTO\nVIGILANCIA EPIDEMIOLÓGICA HOSPITALARIA",
        "COPIA DE CONOCIMIENTO (CCP)\nDRA. BERENICE NORIEGA ACUÑA - DIRECCIÓN DEL HEVM\nDR. JORGE ALAN KENNETH SILVA BOTELLO - SUBDIRECCIÓN MÉDICA DEL HEVM\nDPTO. DE EPIDEMIOLOGÍA DEL HEVM"
      ]
    };
    const rows = [["CONCENTRADO DE INDICADORES", "", "", "", "", "", "VALIDACIÓN Y RESPONSABLES", "", "", "", "", ""]];
    indicators.forEach((indicator, index) => {
      const [leftResponsible, rightResponsible] = responsiblePairs[index] || ["", ""];
      rows.push([indicator.label, "", "", "", "", String(indicator.value), leftResponsible, "", "", rightResponsible, "", ""]);
    });
    return rows;
  }

  function printReportIndicators(items, date) {
    const dataStart = 6;
    const dataEnd = Math.max(dataStart, dataStart + items.length - 1);
    const dxRange = `$K$${dataStart}:$K$${dataEnd}`;
    const seedIndicator = label => cleanCell((window.CENSO_SEED?.indicators || []).find(item => normalizeText(item.name) === normalizeText(label))?.value);
    return [
      { label: "CONFIRMADOS INFLUENZA/COVID", value: `=COUNTIF(${dxRange};"*COVID/INFLUENZA*")` },
      { label: "ESAVIS", value: `=COUNTIF(${dxRange};"*ESAVI*")` },
      { label: "RIESGO IAAS", value: `=COUNTIF(${dxRange};"*RIESGO IAAS*")` },
      { label: "NO IAAS", value: `=COUNTIF(${dxRange};"*NO IAAS*")` },
      { label: "IAAS", value: `=SUM(ARRAYFORMULA(IF(REGEXMATCH(${dxRange};"NO IAAS|RIESGO IAAS");0;IFERROR(VALUE(REGEXEXTRACT(${dxRange};"([1-4]) IAAS"));IF(REGEXMATCH(${dxRange};"IAAS");1;0)))))` },
      { label: "VIG TRANSMISIBLES", value: `=COUNTIF(${dxRange};"*VIG TRANSMISIBLE*")` },
      { label: "VIG NO TRANSMISIBLES", value: `=COUNTIF(${dxRange};"*VIG NO TRANSMISIBLE*")` },
      { label: "MORBIMORTALIDAD MATERNA/PERINATAL", value: `=COUNTIF(${dxRange};"*MORBIMORTALIDAD*")` },
      { label: "PAQUETES PREVENTIVOS", value: seedIndicator("PAQUETES PREVENTIVOS") || "51" }
    ];
  }

  function printReportDateTotalFormula(patientCount) {
    const lastDataRow = Math.max(6, 5 + patientCount);
    return `=UPPER(TEXT(TODAY();"dddd d ""de"" mmmm ""de"" yyyy"))&" · TOTAL PACIENTES: "&COUNTA($A$6:$A$${lastDataRow})`;
  }

  function printReportServiceBreakRows(items, headerRowCount) {
    const rows = [];
    items.forEach((item, index) => {
      if (index > 0 && normalizeService(items[index - 1].service) !== normalizeService(item.service)) {
        rows.push(headerRowCount + index);
      }
    });
    return rows;
  }

  function indicatorMergeRequests(sheetId, startRow, endRow) {
    const requests = [];
    for (let row = startRow; row < endRow; row += 1) {
      requests.push({ mergeCells: { range: gridRange(sheetId, row, row + 1, 0, 5), mergeType: "MERGE_ALL" } });
    }
    [startRow, startRow + 3, startRow + 6].forEach(row => {
      const blockEnd = Math.min(row + 3, endRow);
      requests.push({ mergeCells: { range: gridRange(sheetId, row, blockEnd, 6, 9), mergeType: "MERGE_ALL" } });
      requests.push({ mergeCells: { range: gridRange(sheetId, row, blockEnd, 9, 12), mergeType: "MERGE_ALL" } });
    });
    return requests;
  }

  function sortByPrintServiceBed(a, b) {
    const ai = SERVICES.indexOf(normalizeService(a.service));
    const bi = SERVICES.indexOf(normalizeService(b.service));
    const serviceCompare = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    if (serviceCompare) return serviceCompare;
    return comparePrintBeds(a.bed, b.bed);
  }

  function comparePrintBeds(a, b) {
    const left = printBedLabel(a);
    const right = printBedLabel(b);
    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) return Number(left) - Number(right);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return left.localeCompare(right, "es", { numeric: true, sensitivity: "base" });
  }

  function printServiceLabel(service) {
    return serviceDisplayLabel(service).toUpperCase();
  }

  function printBedLabel(value) {
    const text = cleanCell(value).toUpperCase();
    if (!text) return "S/C";
    const stripped = text.replace(/^(CAMA|SILLÓN|SILLON|CAMILLA|CUBÍCULO|CUBICULO)\s*[-:]?\s*/i, "").trim();
    return stripped || text;
  }

  function printSectorLabel(value) {
    const key = normalizeText(value).replace(/\s+/g, "");
    const option = SECTOR_OPTIONS.find(item => normalizeText(item.value).replace(/\s+/g, "") === key || normalizeText(item.label).replace(/\s+/g, "") === key);
    return (option?.short || cleanCell(value)).toUpperCase();
  }

  function printReportFormulaRequests(sheetId) {
    const endRow = printReportGridBounds().r2;
    const formulas = [
      reportLookupFormula("Servicio"),
      reportLookupFormula("Cama"),
      reportLookupFormula("Paciente"),
      reportLookupFormula("Sector"),
      reportLookupFormula("Edad"),
      reportLookupFormula("Sexo"),
      reportLookupFormula("Fecha_ingreso"),
      '=IF(INDEX($A:$A;ROW())="";"";IF(OR(INDEX($G:$G;ROW())="";INDEX($G:$G;ROW())="AMB";REGEXMATCH(UPPER(INDEX($A:$A;ROW()));"HEMODI|ONCOLOG|AMBULATORIO"));"";MAX(0;TODAY()-INDEX($G:$G;ROW()))))',
      reportLookupFormula("Estado"),
      reportLookupFormula("Dx_hospitalario")
    ];
    return formulas.map((formula, columnIndex) => ({
      repeatCell: {
        range: gridRange(sheetId, 5, endRow, columnIndex, columnIndex + 1),
        cell: { userEnteredValue: { formulaValue: formula } },
        fields: "userEnteredValue"
      }
    }));
  }

  function reportLookupFormula(header) {
    const source = sheetFormulaName(SHEETS_CONFIG.tabs.baseDatos);
    const safeHeader = String(header).replace(/"/g, '""');
    return `=IFERROR(INDEX(${source}!$A:$U;ROW()-4;MATCH("${safeHeader}";${source}!$1:$1;0));"")`;
  }

  function printReportGridBounds(report = buildPrintReportModel()) {
    const endRow = Math.min(report.rows.length, SHEETS_CONFIG.maxRows);
    return {
      range: `A1:L${endRow}`,
      r1: 0,
      c1: 0,
      r2: endRow,
      c2: 12
    };
  }

  function reportColumnWidthRequests(sheetId) {
    return [86, 36, 150, 38, 30, 28, 58, 28, 56, 430, 150, 350].map((pixelSize, index) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
        properties: { pixelSize },
        fields: "pixelSize"
      }
    }));
  }

  function gridRange(sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex) {
    return { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex };
  }

  function sheetCellValue(value) {
    const text = String(value ?? "");
    return { userEnteredValue: text.startsWith("=") ? { formulaValue: text } : { stringValue: text } };
  }

  function sheetFormulaName(sheetName) {
    return `'${String(sheetName).replace(/'/g, "''")}'`;
  }

  function reportBorder(style = "SOLID") {
    return {
      style,
      width: 1,
      colorStyle: { rgbColor: { red: 0.78, green: 0.78, blue: 0.78 } }
    };
  }

  function sheetsApiError(status, bodyText) {
    const parsed = parseJsonSafe(bodyText);
    const apiError = parsed?.error || {};
    const message = apiError.message || bodyText || `Sheets API ${status}`;
    const details = Array.isArray(apiError.details)
      ? apiError.details.map(detail => detail.reason || detail.errorType || detail.domain || "").filter(Boolean).join(", ")
      : "";
    const error = new Error(details ? `${message} (${details})` : message);
    error.status = status;
    error.code = apiError.status || apiError.code || status;
    error.raw = bodyText;
    return error;
  }

  function parseJsonSafe(text) {
    if (!text || typeof text !== "string") return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
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
        rfc: cleanCell(row.RFC) || null,
        birthDate: sheetDateToIso(row.FECHA_NACIMIENTO) || null,
        hospitalInternalId: patientId,
        pseudonymizedId: patientId,
        currentService: service,
        currentBed: bed,
        sector: cleanCell(row.SECTOR) || null,
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
        rfc: patient.rfc,
        birthDate: patient.birthDate,
        sector: patient.sector,
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
      notes: "",
      activeRoundSection: "preventive",
      iaasAssessment: null,
      iaasAssessmentHistory: [],
      iaasAssessmentUpdatedAt: null
    };
  }

  function baseRowsForSheets() {
    const date = activeDate();
    const rows = getCensusRows(date).sort(sortByServiceBed).map(row => {
      const patient = store.patients[row.patientId] || {};
      const admission = patient.admissionDate || row.admissionDate || "";
      return [
        row.patientId,
        date,
        row.service || patient.currentService || "",
        row.bed || patient.currentBed || "",
        patient.patientName || row.patientName || "",
        patient.rfc || row.rfc || "",
        patient.birthDate || row.birthDate || "",
        patient.sector || row.sector || "",
        patient.age ?? row.age ?? "",
        patient.sex || row.sex || "",
        admission,
        isAmbulatoryStayService(row.service || patient.currentService || "") ? "" : daysBetween(admission, date) ?? "",
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
        return item;
      }
      try {
        await writeOperationToSheets(operation);
        item.status = "server_synced";
        item.serverConfirmedAt = ui.sheets.lastSyncAt || nowIso();
      } catch (error) {
        item.status = "error";
        item.error = friendlyError(error);
        store.writeQueue.push(item);
        addAudit("SYNC_ERROR", { metadata: { error: item.error, operationType: operation.type, provider: "google_sheets" } });
      }
      saveStore();
      renderIaas();
      return item;
    }
    if (!ui.firebase.ready || !navigator.onLine) {
      store.writeQueue.push(item);
      saveStore();
      return item;
    }
    try {
      await writeOperationToFirestore(operation);
      item.status = "server_synced";
      item.serverConfirmedAt = nowIso();
    } catch (error) {
      item.status = "error";
      item.error = friendlyError(error);
      store.writeQueue.push(item);
      addAudit("SYNC_ERROR", { metadata: { error: item.error, operationType: operation.type } });
    }
    saveStore();
    return item;
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
            restoreRememberedSheetsConnection();
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
          ui.sheets.autoReconnectAttempted = false;
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
          await withTimeout(
            firebaseRuntime.authMod.signInWithPopup(firebaseRuntime.auth, provider),
            "Google no respondio a tiempo. Revisa si la ventana emergente quedo abierta o bloqueada y vuelve a intentar en Chrome."
          );
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
    const attemptId = ui.sheets.connectAttemptId + 1;
    ui.sheets.connectAttemptId = attemptId;
    ui.sheets.autoReconnectAttempted = true;
    ui.sheets.status = "connecting";
    ui.sheets.error = "Esperando autorizacion de Google Sheets. Si no aparece la ventana de Google, cancela y vuelve a intentar en Chrome.";
    ui.sheets.errorDetail = "";
    try {
      let tokenResponse;
      try {
        const resultPromise = requestSheetsAccessToken();
        renderIaas();
        tokenResponse = await resultPromise;
      } catch (error) {
        if (attemptId !== ui.sheets.connectAttemptId) return;
        if (isPopupBlockedError(error)) throw new Error(oauthPopupHelpText());
        throw error;
      }
      if (attemptId !== ui.sheets.connectAttemptId) return;
      await finishSheetsConnection(tokenResponse.access_token, { tokenResponse });
    } catch (error) {
      if (attemptId !== ui.sheets.connectAttemptId) return;
      ui.sheets.connected = false;
      ui.sheets.accessToken = "";
      ui.sheets.status = "error";
      ui.sheets.error = friendlyError(error);
      ui.sheets.errorDetail = detailedError(error);
      flashIaas(`No se pudo conectar Sheets: ${ui.sheets.error}`);
      renderIaas();
    }
  }

  function cancelSheetsConnection() {
    ui.sheets.connectAttemptId += 1;
    ui.sheets.connected = false;
    ui.sheets.accessToken = "";
    ui.sheets.status = "error";
    ui.sheets.error = "Conexion de Sheets cancelada. Presiona Conectar Sheets para intentarlo de nuevo.";
    ui.sheets.errorDetail = ui.sheets.error;
    forgetSheetsSession();
    flashIaas(ui.sheets.error);
    renderIaas();
  }

  async function copySheetsError() {
    const text = [
      `status=${ui.sheets.status}`,
      `message=${ui.sheets.error || ""}`,
      `detail=${ui.sheets.errorDetail || ""}`,
      `url=${location.href}`,
      `sheet=${SHEETS_CONFIG.spreadsheetId}`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flashIaas("Detalle de error Sheets copiado.");
    } catch {
      window.prompt("Copia este error de Sheets:", text);
    }
  }

  async function requestSheetsAccessToken(options = {}) {
    if (!GOOGLE_OAUTH_CLIENT_ID) {
      throw new Error("Falta configurar EPIVIDA_SHEETS_CONFIG.googleClientId para autorizar Google Sheets.");
    }
    await loadGoogleIdentityServices();
    const prompt = options.prompt ?? (options.silent ? "" : "consent");
    const timeoutMs = options.timeoutMs || (options.silent ? 15000 : OAUTH_POPUP_TIMEOUT_MS);
    const email = ui.firebase.user?.email || firebaseRuntime?.auth?.currentUser?.email || "";
    return withTimeout(new Promise((resolve, reject) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          scope: SHEETS_SCOPE,
          hint: email || undefined,
          include_granted_scopes: true,
          callback: response => {
            if (response?.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            if (!response?.access_token) {
              reject(new Error("Google no devolvio token de Sheets."));
              return;
            }
            resolve(response);
          },
          error_callback: error => {
            reject(new Error(error?.message || error?.type || "No se pudo abrir la autorizacion de Google Sheets."));
          }
        });
        tokenClient.requestAccessToken({ prompt });
      } catch (error) {
        reject(error);
      }
    }), options.timeoutMessage || "La autorizacion directa de Google Sheets no respondio a tiempo. Revisa si la ventana de Google quedo abierta, bloqueada o en segundo plano; cierra esa ventana y presiona Reintentar.", timeoutMs);
  }

  async function loadGoogleIdentityServices() {
    if (window.google?.accounts?.oauth2) return;
    const existing = document.querySelector('script[data-epivida-gis="true"]');
    await new Promise((resolve, reject) => {
      const script = existing || document.createElement("script");
      const timeoutId = window.setTimeout(() => reject(new Error("No se pudo cargar Google Identity Services.")), 15000);
      script.onload = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("No se pudo cargar Google Identity Services."));
      };
      if (!existing) {
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.dataset.epividaGis = "true";
        document.head.append(script);
      }
    });
    if (!window.google?.accounts?.oauth2) {
      throw new Error("Google Identity Services no quedo disponible en el navegador.");
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
        await finishSheetsConnection(credential.accessToken, { tokenResponse: { access_token: credential.accessToken } });
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

  async function finishSheetsConnection(accessToken, options = {}) {
    ui.sheets.accessToken = accessToken;
    ui.sheets.connected = true;
    ui.sheets.status = "connected";
    ui.sheets.error = "";
    ui.sheets.errorDetail = "";
    rememberSheetsSession(options.tokenResponse);
    const hadPendingWrites = pendingQueue().length > 0;
    await hydrateFromSheets();
    if (hadPendingWrites) {
      ui.sheets.status = "sync_conflict";
      ui.sheets.error = "Se detectaron cambios locales previos. Recarga Sheets y repite la accion ya conectado antes de escribir en la base clinica.";
      ui.sheets.errorDetail = ui.sheets.error;
      store.writeQueue = store.writeQueue.map(item => ({ ...item, status: "error", error: ui.sheets.error }));
      saveStore();
      flashIaas(ui.sheets.error);
      renderIaas();
      return;
    }
    await flushSyncQueue();
  }

  async function restoreRememberedSheetsConnection() {
    if (!ui.sheets.enabled || !ui.firebase.ready || !ui.firebase.user || ui.sheets.connected || ui.sheets.autoReconnectAttempted) return;
    if (!rememberedSheetsSession()) return;
    const attemptId = ui.sheets.connectAttemptId + 1;
    ui.sheets.connectAttemptId = attemptId;
    ui.sheets.autoReconnectAttempted = true;
    ui.sheets.status = "connecting";
    ui.sheets.error = "Reconectando Google Sheets automaticamente.";
    ui.sheets.errorDetail = "";
    renderIaas();
    try {
      const tokenResponse = await requestSheetsAccessToken({
        silent: true,
        prompt: "",
        timeoutMs: 12000,
        timeoutMessage: "No se pudo reconectar Google Sheets automaticamente."
      });
      if (attemptId !== ui.sheets.connectAttemptId) return;
      await finishSheetsConnection(tokenResponse.access_token, { tokenResponse, silent: true });
      flashIaas("Google Sheets reconectado.");
    } catch {
      if (attemptId !== ui.sheets.connectAttemptId) return;
      ui.sheets.connected = false;
      ui.sheets.accessToken = "";
      ui.sheets.status = "disconnected";
      ui.sheets.error = "";
      ui.sheets.errorDetail = "";
      renderIaas();
    }
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

  function withTimeout(promise, message, timeoutMs = OAUTH_POPUP_TIMEOUT_MS) {
    let timeoutId = 0;
    const guarded = Promise.resolve(promise);
    guarded.catch(() => {});
    return Promise.race([
      guarded,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]).finally(() => {
      window.clearTimeout(timeoutId);
    });
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

  function rememberedSheetsSession() {
    const session = loadJson(SHEETS_SESSION_KEY, null);
    if (!session || !SHEETS_CONFIG.spreadsheetId) return null;
    if (session.spreadsheetId !== SHEETS_CONFIG.spreadsheetId) return null;
    const email = String(ui.firebase.user?.email || "").toLowerCase();
    if (session.email && email && String(session.email).toLowerCase() !== email) return null;
    return session;
  }

  function rememberSheetsSession(tokenResponse = {}) {
    if (!ui.sheets.enabled || !SHEETS_CONFIG.spreadsheetId) return;
    const now = Date.now();
    const expiresIn = Number(tokenResponse?.expires_in || 3600);
    saveJson(SHEETS_SESSION_KEY, {
      spreadsheetId: SHEETS_CONFIG.spreadsheetId,
      spreadsheetUrl: ui.sheets.spreadsheetUrl,
      email: String(ui.firebase.user?.email || "").toLowerCase(),
      connectedAt: nowIso(),
      expiresAt: new Date(now + Math.max(60, expiresIn) * 1000).toISOString()
    });
  }

  function forgetSheetsSession() {
    try {
      localStorage.removeItem(SHEETS_SESSION_KEY);
    } catch {}
  }

  async function signOutFirebase() {
    if (!firebaseRuntime) return;
    stopRealtimeSync();
    ui.sheets.connected = false;
    ui.sheets.accessToken = "";
    ui.sheets.status = ui.sheets.enabled ? "disconnected" : ui.sheets.status;
    ui.sheets.error = "";
    ui.sheets.errorDetail = "";
    ui.sheets.autoReconnectAttempted = false;
    forgetSheetsSession();
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

  function defaultIaasAssessment() {
    const blankFields = fields => Object.fromEntries(fields.map(([key]) => [key, ""]));
    return {
      vitalSigns: { studyDate: "", ...blankFields([...IAAS_VITAL_FIELDS, ...IAAS_VENTILATION_FIELDS]) },
      cbc: { studyDate: "", ...blankFields(IAAS_CBC_FIELDS) },
      urinalysis: {
        studyDate: "",
        ...blankFields(IAAS_URINALYSIS_SELECTS.map(([key, label]) => [key, label])),
        leukocytes: ""
      },
      otherStudies: {
        studyDate: "",
        ...blankFields(IAAS_OTHER_STUDY_FIELDS),
        viralPanel: []
      },
      infectionTracking: blankFields(IAAS_INFECTION_TRACKING_FIELDS),
      cultures: [],
      treatments: [],
      observations: ""
    };
  }

  function normalizeIaasAssessment(value = {}) {
    const base = defaultIaasAssessment();
    const source = value && typeof value === "object" ? value : {};
    return {
      vitalSigns: { ...base.vitalSigns, ...(source.vitalSigns || {}) },
      cbc: { ...base.cbc, ...(source.cbc || {}) },
      urinalysis: { ...base.urinalysis, ...(source.urinalysis || {}) },
      otherStudies: {
        ...base.otherStudies,
        ...(source.otherStudies || {}),
        viralPanel: Array.isArray(source.otherStudies?.viralPanel)
          ? source.otherStudies.viralPanel.map(row => ({ test: cleanCell(row.test), result: cleanCell(row.result) })).filter(row => row.test || row.result)
          : []
      },
      cultures: Array.isArray(source.cultures)
        ? source.cultures.map(row => ({
          type: cleanCell(row.type),
          woundSite: cleanCell(row.woundSite),
          collectionDate: normalizeDate(row.collectionDate) || cleanCell(row.collectionDate),
          resultDate: normalizeDate(row.resultDate) || cleanCell(row.resultDate),
          microorganism: cleanCell(row.microorganism)
        })).filter(row => row.type || row.woundSite || row.collectionDate || row.resultDate || row.microorganism)
        : [],
      treatments: Array.isArray(source.treatments)
        ? source.treatments.map(row => ({
          drug: cleanCell(row.drug),
          customDrug: cleanCell(row.customDrug),
          startDate: normalizeDate(row.startDate) || cleanCell(row.startDate),
          endDate: normalizeDate(row.endDate) || cleanCell(row.endDate),
          notes: cleanCell(row.notes)
        })).filter(row => row.drug || row.customDrug || row.startDate || row.endDate || row.notes)
        : [],
      infectionTracking: { ...base.infectionTracking, ...(source.infectionTracking || {}) },
      observations: cleanCell(source.observations)
    };
  }

  function completeIaasAssessmentForSave(value, date) {
    const assessment = normalizeIaasAssessment(value);
    [
      ["vitalSigns", "studyDate"],
      ["cbc", "studyDate"],
      ["urinalysis", "studyDate"],
      ["otherStudies", "studyDate"],
      ["infectionTracking", "assessmentDate"]
    ].forEach(([section, dateKey]) => {
      if (!assessment[section]) return;
      if (!assessment[section][dateKey] && iaasSectionHasValues(assessment[section], [dateKey])) {
        assessment[section][dateKey] = normalizeDate(date) || isoToday();
      }
    });
    return assessment;
  }

  function iaasSectionHasValues(section = {}, ignoredKeys = []) {
    const ignored = new Set(ignoredKeys);
    return Object.entries(section).some(([key, value]) => !ignored.has(key) && iaasAssessmentHasContent(value));
  }

  function buildIaasAssessmentHistory(previousEntry, nextAssessment, date) {
    const previousHistory = Array.isArray(previousEntry.iaasAssessmentHistory) ? previousEntry.iaasAssessmentHistory : [];
    const previousAssessment = previousEntry.iaasAssessment ? normalizeIaasAssessment(previousEntry.iaasAssessment) : null;
    if (!previousAssessment || !iaasAssessmentHasContent(previousAssessment)) return previousHistory.slice(-20);
    if (JSON.stringify(previousAssessment) === JSON.stringify(nextAssessment)) return previousHistory.slice(-20);
    return [
      ...previousHistory,
      {
        roundDate: previousEntry.roundDate || date,
        editedAt: previousEntry.iaasAssessmentUpdatedAt || previousEntry.reviewedAt || nowIso(),
        assessment: previousAssessment
      }
    ].slice(-20);
  }

  function iaasAssessmentHasContent(value) {
    if (Array.isArray(value)) return value.some(iaasAssessmentHasContent);
    if (value && typeof value === "object") return Object.values(value).some(iaasAssessmentHasContent);
    return Boolean(cleanCell(value));
  }

  function getReviewDraft(date, patientId, requestedSection = null) {
    const key = `${date}:${patientId}`;
    const savedEntry = store.dailyRounds?.[date]?.entries?.[patientId] || {};
    const existing = ui.reviewDrafts[key] || {};
    const draft = {
      deviceDrafts: [],
      removals: {},
      pendingText: "",
      notes: savedEntry.notes || "",
      noInvasivesConfirmed: Boolean(savedEntry.noInvasivesConfirmed),
      activeRoundSection: savedEntry.activeRoundSection || "preventive",
      iaasAssessment: normalizeIaasAssessment(savedEntry.iaasAssessment),
      ...existing
    };
    draft.iaasAssessment = normalizeIaasAssessment(draft.iaasAssessment);
    if (!draft.activeRoundSection) draft.activeRoundSection = "preventive";
    if (requestedSection) draft.activeRoundSection = requestedSection;
    ui.reviewDrafts[key] = draft;
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
    const delimiter = detectDelimiter(lines.reduce((best, line) => delimiterScore(line) > delimiterScore(best) ? line : best, lines[0]));
    const headerIndex = lines.findIndex(line => looksLikeImportHeader(splitCsvLine(line, delimiter)));
    const startIndex = headerIndex >= 0 ? headerIndex : 0;
    const headers = splitCsvLine(lines[startIndex], delimiter).map(header => header.trim());
    return lines.slice(startIndex + 1).map(line => {
      const cells = splitCsvLine(line, delimiter);
      const row = {};
      headers.forEach((header, index) => row[header] = cells[index] ?? "");
      return row;
    });
  }

  function delimiterScore(line) {
    return ["\t", ",", ";", "|"].reduce((score, delimiter) => Math.max(score, line.split(delimiter).length), 0);
  }

  function looksLikeImportHeader(cells) {
    const canonical = cells.map(canonicalColumn).filter(Boolean);
    const unique = new Set(canonical);
    return unique.size >= 3 && (unique.has("patient_name") || unique.has("patient_id") || unique.has("servicio") || unique.has("servicio_cama"));
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
    const date = ui.importDate || isoToday();
    ui.importText = [
      "Fecha_censo\tServicio/Cama\tPaciente\tSector\tEdad\tSexo\tIngreso\tEstado\tDx hospitalario\tDx epidemiologico\tObservaciones",
      `${date}\tMEDICINA INTERNA / Cama 23\tCASTILLO CARDEÑO FRANCISCO\tBUR\t71\tM\t16/04/2026\tDELICADO\tERC en hemodiálisis / vigilancia IAAS\t1 IAAS\tConfirmar curación de CVC`,
      `${date}\tCIRUGÍA Y TRAUMATOLOGÍA / Cama 45\tRINCÓN DUARTE MARÍA DE LOURDES\tPIM\t77\tF\t20/04/2026\tDELICADO\tFístula enterocutánea\t1 IAAS IMPORTADA\tRevisar paquete preventivo`,
      `${date}\tHEMODIÁLISIS / Sillón 1\tGÓMEZ PÉREZ CARLOS\tMAG\t62\tM\tAMB\tESTABLE\tERC en hemodiálisis\tNO IAAS\tParche seco sin secreción`
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
    const targetDate = censusDateFor(date);
    const rows = Object.values(store.dailyCensus[targetDate]?.patients || {});
    if (targetDate === date) return rows;
    return rows.map(row => ({
      ...row,
      roundDate: date,
      fecha_censo: date
    }));
  }

  function censusDateFor(date) {
    if (store.dailyCensus[date]?.patients) return date;
    const dates = Object.keys(store.dailyCensus || {})
      .filter(item => store.dailyCensus[item]?.patients)
      .sort();
    const previous = dates.filter(item => item <= date).pop();
    return previous || dates.at(-1) || date;
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

  function nextIaasPatientId(date, patientId) {
    const rows = iaasFollowUpRows(date);
    const index = rows.findIndex(item => item.row.patientId === patientId);
    return rows[index + 1]?.row.patientId || null;
  }

  function sortByServiceBed(a, b) {
    const ai = SERVICES.indexOf(normalizeService(a.service));
    const bi = SERVICES.indexOf(normalizeService(b.service));
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
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
      "monitoreo-epidemiologico": "Monitoreo Epidemiológico",
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
      "ONCOLOGIA": "ONCOLOGÍA",
      "UCIA": "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS",
      "UCIN": "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES",
      "UCIP": "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS",
      "GINECOLOGIA Y OBSTETRICIA": "GINECOLOGÍA Y OBSTETRICIA"
    };
    return SERVICES.find(service => normalizeText(service) === key) || mapped[key] || cleanCell(value).toUpperCase();
  }

  function splitServiceBed(value) {
    const text = cleanCell(value);
    if (!text) return { service: "", bed: "" };
    const slashParts = text.split(/\s*\/\s*/).filter(Boolean);
    if (slashParts.length >= 2) {
      return { service: slashParts[0], bed: slashParts.slice(1).join(" / ") };
    }
    const bedMatch = text.match(/^(.*?)(?:\s+-\s+|\s+)(CAMA\s+.+|AIS[-\s]*.+|SILL[ÓO]N\s+.+)$/i);
    if (bedMatch) return { service: bedMatch[1], bed: bedMatch[2] };
    return { service: text, bed: "" };
  }

  function normalizeBed(value) {
    return cleanCell(value)
      .replace(/^CAMA\s*[:#-]?\s*/i, "")
      .toUpperCase();
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
    return isoToday();
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
    const fallback = [row.patient_name, row.servicio, row.cama, row.fecha_ingreso || row.fecha_censo].map(cleanCell).join("|");
    return `px_${hashText(stable || fallback)}`;
  }

  function makeDisplayCode(patientId) {
    return `PX-${String(hashText(patientId)).slice(0, 6).toUpperCase()}`;
  }

  function createImportBatchId(date) {
    return `import-${date}-${Date.now().toString(36)}`;
  }

  function hashNormalizedRow(row) {
    return hashText([row.patient_id, row.patient_name, row.fecha_censo, row.servicio, row.cama, row.estado, row.dx_epidemiologico, row.diagnostico_actual, row.observaciones, row.pendientes].map(cleanCell).join("|"));
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
    const text = normalizeText(`${row.estado} ${row.riesgo_iaas} ${row.dx_epidemiologico} ${row.pendientes} ${row.diagnostico_actual}`);
    if (text.includes("CRITICO")) return "Crítico";
    if (text.includes("ALTO") || text.includes("IAAS")) return "Alto";
    if (text.includes("MODERADO") || text.includes("RIESGO")) return "Moderado";
    if (text) return "Bajo";
    return null;
  }

  function splitPending(text) {
    return cleanCell(text).split(/\/|\||;/).map(item => item.trim()).filter(Boolean).slice(0, 8);
  }

  function markSnapshotSynced(confirmedAt = nowIso()) {
    Object.values(store.dailyRounds || {}).forEach(round => {
      Object.values(round.entries || {}).forEach(entry => {
        if (!entry || entry.syncStatus === "server_synced") return;
        entry.syncStatus = "server_synced";
        entry.serverConfirmedAt = confirmedAt;
      });
    });
    Object.values(store.dailyCensus || {}).forEach(census => {
      Object.values(census.patients || {}).forEach(row => {
        if (!row || row.syncStatus === "server_synced") return;
        row.syncStatus = "server_synced";
      });
    });
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
      "GRAVE INTUBADO": "status-grave-intubado",
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
    if (/insufficient authentication scopes/i.test(text)) {
      return "Google no concedio el permiso de Sheets. Reintenta y acepta el acceso a hojas de calculo.";
    }
    if (/Google Sheets API has not been used|disabled/i.test(text)) {
      return "La API de Google Sheets no esta habilitada en el proyecto de Google Cloud/Firebase.";
    }
    if (/caller does not have permission|The caller does not have permission/i.test(text)) {
      return "La cuenta autenticada no tiene permiso para leer esta hoja de Google Sheets.";
    }
    if (/access.*denied|popup-closed-by-user|cancelled-popup-request/i.test(text)) {
      return "La autorizacion de Google fue cancelada o bloqueada.";
    }
    if (/unauthorized-domain/i.test(text)) {
      return `Dominio no autorizado en Firebase Auth. Usa http://localhost:${location.port || "5188"} o agrega ${location.hostname} en Firebase Console > Authentication > Settings > Authorized domains.`;
    }
    if (/permission/i.test(text)) return text;
    if (/network|offline/i.test(text)) return "Sin conexión.";
    return text;
  }

  function detailedError(error) {
    const code = error?.code ? `[${error.code}] ` : "";
    const status = error?.status ? `HTTP ${error.status}: ` : "";
    const message = error?.message || String(error);
    return `${status}${code}${message}`.trim();
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

(() => {
  "use strict";

  const STORE_KEY = "epivida-iaas-os-v1";
  const DRAFT_KEY = "epivida-iaas-drafts-v1";
  const ROUND_NAV_COLLAPSE_KEY = "epivida-round-nav-collapsed-v1";
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
  const ROUND_SERVICE_FILTERS = [
    { value: "Todos", label: "TODOS" },
    { value: "MEDICINA INTERNA", label: "MEDICINA INTERNA" },
    { value: "CIRUGÍA Y TRAUMATOLOGÍA", label: "CIRUGÍA Y TRAUMATOLOGÍA" },
    { value: "PEDIATRÍA", label: "PEDIATRÍA" },
    { value: "CUNEROS", label: "CUNEROS" },
    { value: "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", label: "UCIN" },
    { value: "HEMODIÁLISIS", label: "HEMODIÁLISIS" },
    { value: "ONCOLOGÍA", label: "ONCOLOGÍA" },
    { value: "GINECOLOGÍA Y OBSTETRICIA", label: "GINECOLOGÍA Y OBSTETRICIA" },
    { value: "UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS", label: "UCIP" },
    { value: "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS", label: "UCIA" },
    { value: "URGENCIAS", label: "URGENCIAS" },
    { value: "AMBULATORIO", label: "AMBULATORIO" }
  ];
  const DISCHARGE_TYPES = [
    "ALTA HOSPITALARIA POR MEJORÍA",
    "ALTA HOSPITALARIA VOLUNTARIA",
    "ALTA HOSPITALARIA POR MÁXIMO BENEFICIO",
    "ALTA HOSPITALARIA POR TRASLADO",
    "ALTA HOSPITALARIA NO AUTORIZADA",
    "DEFUNCIÓN"
  ];
  const DISCHARGE_SHIFTS = ["MATUTINO", "VESPERTINO", "NOCTURNO", "JORNADA ESPECIAL", "SIN TURNO"];
  const PROBABLE_DISCHARGE_MESSAGE = "REVISAR ALTA DEL PACIENTE Y SU PROBABLE CAUSA";
  const REPORTED_DISCHARGE_MESSAGE = "VERIFICAR SI ESTÁ CORRECTA EL ALTA HOSPITALARIA DEL PACIENTE ENCONTRADO";
  const PROTECTED_AMBULATORY_SERVICES = ["HEMODIÁLISIS", "ONCOLOGÍA"];
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
    "Catéter Mahurkar",
    "Catéter Permacath",
    "Catéter Tenckhoff",
    "Catéter Puerto",
    "PICC",
    "Catéter periférico",
    "Sonda Foley",
    "Ventilación mecánica",
    "Tubo endotraqueal",
    "Traqueostomía",
    "Drenaje",
    "DrenoVAC",
    "Sonda nasogástrica",
    "Puntas Nasales/Cánula Nasal",
    "Nutrición parenteral",
    "Otro"
  ];
  const PREVENTIVE_PACKAGE_TYPES = ["ITS - CC", "ITU - CU", "NAVM", "ISQ", "P.E. Y P.B.M.T.", "ESPECIAL"];
  const YES_NO_NA = ["SÍ", "NO", "NA"];
  const FRENCH_OPTIONS = ["3 Fr", "4 Fr", "5 Fr", "6 Fr", "7 Fr", "8 Fr", "9 Fr", "10 Fr", "12 Fr", "14 Fr", "16 Fr", "18 Fr", "20 Fr", "22 Fr", "24 Fr"];
  const ITS_DEVICE_TYPES = ["CVPC", "CVC", "PICC", "CATT HD", "C. PUERTO", "ONFALOCLISIS"];
  const ITU_MATERIAL_TYPES = ["SILICÓN", "LÁTEX"];
  const ITU_DEVICE_STATES = ["A DERIVACIÓN", "CIRCUITO CERRADO"];
  const NAVM_DEVICE_TYPES = ["PUNTAS NASALES", "CÁNULA NASAL", "MASCARILLA RESERVORIO", "COT", "CET", "INTUBACIÓN OROTRAQUEAL", "INTUBACIÓN ENDOTRAQUEAL", "TRAQUEOSTOMÍA", "CPAP", "BPAP"];
  const NAVM_ORAL_HYGIENE_TYPES = ["CLORHEXIDINA", "SALINA", "CEPILLO DENTAL"];
  const SPECIAL_DEVICE_TYPES = ["SONDA NASOGÁSTRICA", "SONDA OROGÁSTRICA", "GASTROSTOMÍA", "COLOSTOMÍA", "DRENOVAC", "PLEUROVAC"];
  const PREVENTIVE_CHECKS = {
    "ITS - CC": [
      ["dailyReview", "REGISTRO REVISIÓN DIARIA"],
      ["asepticDressing", "CURACIÓN ASÉPTICA DE CATÉTER"],
      ["correctOpening", "APERTURA CORRECTA EN CASO DE INTERRUMPIR CONEXIÓN"],
      ["infusionSystemChange", "CAMBIO SISTEMA DE INFUSIÓN"],
      ["evolutionNote", "NOTA DE EVOLUCIÓN VIGENTE"]
    ],
    "ITU - CU": [
      ["hasLabel", "CON MEMBRETE"],
      ["sexMatch", "DE ACUERDO A SEXO"],
      ["genitalHygiene", "HIGIENE GENITAL"],
      ["unobstructedDrainage", "DRENAJE SIN OBSTRUCCIÓN"],
      ["correctBagLevel", "CORRECTO NIVEL BOLSA COLECTORA"],
      ["closedSystem", "SISTEMA SIN DESCONEXIÓN"],
      ["evolutionNote", "NOTA DE EVOLUCIÓN"],
      ["urineCharacteristics", "REGISTRO CARACTERÍSTICAS DE LA ORINA"],
      ["installationDaysRecord", "REGISTRO DÍAS DE INSTALACIÓN"]
    ],
    NAVM: [
      ["asepticIntubation", "INTUBACIÓN ASÉPTICA"],
      ["patientPosition", "POSICIÓN ADECUADA DEL PACIENTE"],
      ["sedationInterruption", "REGISTRO DE POSIBLE INTERRUPCIÓN DE SEDACIÓN"],
      ["possibleRemoval", "REGISTRO DE POSIBLE RETIRO VM"],
      ["closedSuction", "ASPIRACIÓN DE SECRECIONES CON CIRCUITO CERRADO"],
      ["oralHygiene", "HIGIENE ORAL"],
      ["humidity", "HUMEDAD ACTIVA/PASIVA"]
    ],
    ISQ: [
      ["preSurgicalProphylaxis", "PROFILAXIS PREQUIRÚRGICA ADECUADA"],
      ["preSurgicalHairRemoval", "RASURADO ADECUADO PREQUIRÚRGICO"],
      ["glucoseMonitoring", "MONITOREO GLUCÉMICO"],
      ["temperature", "TEMPERATURA MAYOR A 35.5 °C"],
      ["dressing", "HERIDA CON APÓSITO"]
    ],
    "P.E. Y P.B.M.T.": [
      ["precautionAssignment", "ASIGNACIÓN MEDIDAS DE PRECAUCIÓN"],
      ["precautionUpdate", "ACTUALIZACIÓN MEDIDAS DE PRECAUCIÓN"],
      ["precautionRemoval", "RETIRO MEDIDAS DE PRECAUCIÓN"],
      ["supplies", "INSUMOS"],
      ["education", "EDUCACIÓN"],
      ["congruentPrescription", "PRESCRIPCIÓN Y ACCIÓN CONGRUENTE"],
      ["precautionCards", "TARJETAS DE PRECAUCIÓN ADECUADAS"]
    ]
  };

  const NON_IAAS_RISK_DEVICE_TYPES = new Set([
    "Catéter periférico",
    "Catéter periférico corto",
    "Puntas nasales",
    "Cánula nasal",
    "Puntas Nasales/Cánula Nasal"
  ].map(normalizeText));

  const IAAS_MOBILE_SECTIONS = [
    { key: "antibioticos", label: "ANTIBIÓTICOS" },
    { key: "cultivos", label: "CULTIVOS" },
    { key: "observaciones", label: "OBSERVACIONES" },
    { key: "signos", label: "SIGNOS VITALES" },
    { key: "biometria", label: "BIOMETRÍA HEMÁTICA" },
    { key: "ego", label: "EXAMEN GENERAL DE ORINA" },
    { key: "otros", label: "OTROS ESTUDIOS" }
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
    "Cultivo de herida",
    "Coprocultivo",
    "Coproparasitoscópico"
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
    "Claritromicina",
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
    "Rifaximina",
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
    "servicio",
    "cama",
    "paciente",
    "fecha_nacimiento",
    "edad",
    "sector",
    "rfc",
    "sexo",
    "fecha_ingreso",
    "deih",
    "estado",
    "diagnosticos_hospitalarios",
    "observaciones_y_pendientes"
  ];

  const IMPORT_REQUIRED_LABELS = [
    "Servicio",
    "Cama",
    "Paciente",
    "Fecha de nacimiento",
    "Edad",
    "Sector",
    "RFC",
    "Sexo",
    "Ingreso",
    "DEIH",
    "Estado",
    "Dx hospitalarios",
    "Observaciones y pendientes"
  ];

  const COLUMN_ALIASES = {
    patient_id: ["patient_id", "paciente_id", "id_paciente", "expediente", "id", "folio", "registro", "n_expediente", "no_expediente", "numero_expediente", "nss"],
    patient_name: ["patient_name", "paciente", "nombre_paciente", "nombre del paciente", "nombre", "nombre_completo", "nombre_y_apellidos", "paciente_nombre"],
    rfc: ["rfc"],
    fecha_nacimiento: ["fecha_nacimiento", "nacimiento", "fecha_de_nacimiento"],
    fecha_censo: ["fecha_censo", "fecha", "censo_fecha", "fecha_del_censo", "dia_censo"],
    servicio: ["servicio", "area", "área", "departamento", "sala", "unidad"],
    servicio_cama: ["servicio_cama", "servicio/cama", "servicio cama", "servicio_y_cama", "servicio-cama", "ubicacion", "ubicación"],
    cama: ["cama", "cama_actual", "numero_cama", "número_cama", "no_cama", "num_cama", "cama/sillon", "cama_sillon"],
    sector: ["sector", "derechohabiencia", "derecho_habiencia", "tipo_derechohabiente"],
    edad: ["edad"],
    sexo: ["sexo", "genero", "género"],
    fecha_ingreso: ["fecha_ingreso", "ingreso", "f_ingreso", "fecha ingreso", "fecha de ingreso", "fecha_ingreso_hospitalario"],
    deih: ["deih", "d.e.i.h", "dias_estancia", "días_estancia", "dias de estancia", "días de estancia", "estancia"],
    estado: ["estado", "estado_salud", "estado de salud", "estado_clinico", "estado clínico"],
    diagnostico_actual: ["diagnostico_actual", "diagnóstico_actual", "diagnostico actual", "diagnóstico actual", "diagnostico de ingreso", "diagnóstico de ingreso", "diagnostico ingreso", "diagnóstico ingreso", "diagnostico", "diagnóstico", "dx", "dx_hospitalario", "dx hospitalario", "diagnosticos_hospitalarios", "diagnósticos hospitalarios", "diagnostico_hospitalario", "diagnóstico hospitalario", "padecimiento"],
    pendientes: ["pendientes", "pendiente", "observaciones_pendientes"],
    hospital_internal_id: ["hospital_internal_id", "id_hospitalario", "registro", "n_expediente"],
    riesgo_iaas: ["riesgo_iaas", "riesgo", "clasificacion_iaas", "clasificación_iaas"],
    observaciones: ["observaciones", "obs", "observaciones_pendientes", "observaciones y pendientes"],
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
    importMode: "auto",
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
    monitorCensusView: "epi",
    monitorEditDraft: null,
    monitorEditMode: "",
    iaasMobileSection: "antibioticos",
    dashboardSlide: 0,
    dashboardSlidePausedUntil: 0,
    dashboardSlideTimer: null,
    renderTimer: null,
    renderCache: null,
    draftSaveTimer: null,
    draftsDirty: false,
    calendarView: "week",
    calendarDate: "",
    calendarDraftDate: "",
    calendarDraftStartTime: "08:00",
    calendarDraftEndTime: "09:00",
    calendarDraftTitle: "",
    calendarDraftCategory: "preventiva",
    focusTarget: "",
    expedienteIaasLoaded: {},
    expedienteRawLoaded: {},
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
  window.addEventListener("beforeunload", flushDraftSave);

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
      if (document.hidden) return;
      if (ui.route.page !== "dashboard") return;
      if (Date.now() < ui.dashboardSlidePausedUntil) return;
      advanceDashboardSlide();
    }, 14000);
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
    if (ui.renderTimer) {
      window.clearTimeout(ui.renderTimer);
      ui.renderTimer = null;
    }
    const date = activeDate();
    const previousCache = ui.renderCache;
    ui.renderCache = createRenderCache();
    try {
      recalculateRound(date);
      app.replaceChildren(renderShell());
      restoreFocusedControl();
    } finally {
      ui.renderCache = previousCache;
    }
  }

  function createRenderCache() {
    return {
      deviceEpisodes: Object.values(store.deviceEpisodes || {}),
      activeEpisodes: new Map(),
      patientEpisodes: new Map(),
      censusRows: new Map(),
      censusDates: new Map(),
      stats: new Map()
    };
  }

  function scheduleRenderIaas(delay = 80) {
    if (ui.renderTimer) window.clearTimeout(ui.renderTimer);
    ui.renderTimer = window.setTimeout(() => {
      ui.renderTimer = null;
      renderIaas();
    }, delay);
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
        h("span", {}, [`${activeDateLabel()} · ${Object.keys(store.patients).length} pacientes en sistema`])
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
        h("span", { class: "command-today" }, [commandIcon("calendar"), "Censo activo"]),
        h("strong", {}, [activeDateLabel()])
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
    if (page === "seguimiento-iaas" && parts[2] === "paciente" && parts[3]) return renderPatientRound(parts[1] || activeDate(), parts[3], "iaas");
    if (page === "seguimiento-iaas") return renderIaasFollowUpHub();
    if (page === "pacientes" && parts[2] === "expediente") return renderPatientExpediente(parts[1]);
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
      renderMonitorCensusSwitch(taggedRows.length, rows.length),
      h("div", { class: "monitor-census-stack" }, [
        ui.monitorCensusView === "epi" ? h("article", { class: "monitor-census-block epidemiological-census" }, [
          h("div", { class: "monitor-census-title" }, [
            h("div", {}, [
              h("h3", {}, ["Censo Epidemiológico"]),
              h("span", {}, [`${visibleEpiRows.length} de ${taggedRows.length} registro(s)`])
            ]),
            h("button", { class: "iaas-button primary compact", type: "button", onclick: () => openNewMonitoringPatientDraft("epi") }, [commandIcon("plus"), "Agregar paciente"])
          ]),
          renderMonitorFilters("epi", taggedRows.length, visibleEpiRows.length, true),
          visibleEpiRows.length ? renderMonitoringTable(visibleEpiRows, true, "epi") : renderMonitorEmpty("Sin pacientes con etiquetas epidemiológicas en los filtros actuales.")
        ]) : "",
        ui.monitorCensusView === "hospital" ? h("article", { class: "monitor-census-block hospital-census" }, [
          h("div", { class: "monitor-census-title" }, [
            h("div", {}, [
              h("h3", {}, ["Censo Hospitalario"]),
              h("span", {}, [`${visibleHospitalRows.length} de ${rows.length} registro(s)`])
            ]),
            h("button", { class: "iaas-button ghost compact", type: "button", onclick: () => openNewMonitoringPatientDraft("hospital") }, [commandIcon("plus"), "Agregar paciente"])
          ]),
          renderMonitorFilters("hospital", rows.length, visibleHospitalRows.length, true),
          visibleHospitalRows.length ? renderMonitoringTable(visibleHospitalRows, false, "hospital") : renderMonitorEmpty("Sin censo hospitalario cargado en los filtros actuales.")
        ]) : ""
      ])
    ]);
  }

  function renderMonitorCensusSwitch(epiCount, hospitalCount) {
    const tabs = [
      ["epi", "Censo epidemiológico", epiCount],
      ["hospital", "Censo hospitalario", hospitalCount]
    ];
    return h("div", { class: "monitor-census-switch", role: "tablist", "aria-label": "Seleccionar censo visible" }, tabs.map(([key, label, count]) =>
      h("button", {
        class: ui.monitorCensusView === key ? "active" : "",
        type: "button",
        role: "tab",
        "aria-selected": ui.monitorCensusView === key ? "true" : "false",
        onclick: () => { ui.monitorCensusView = key; renderIaas(); }
      }, [
        h("strong", {}, [label]),
        h("span", {}, [`${count} registro(s)`])
      ])
    ));
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
    const dischargeText = dischargePrintTextFor({ patient, row });
    const observations = dischargeText || patient.observations || row.observations || row.notes || "";
    const inferredRiskDevices = inferredRiskDevicesForText(`${dxHospital} ${epiText} ${observations}`);
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
      inferredRiskDevices,
      hasEpidemiologicalTag: tags.length > 0 || bases.length > 0,
      rfc: patient.rfc || patient.hospitalInternalId || row.rfc || "",
      birthDate: patient.birthDate || patient.fechaNacimiento || row.birthDate || "",
      dischargeType: patient.dischargeType || row.dischargeType || "",
      dischargeDate: patient.dischargeDate || row.dischargeDate || "",
      dischargeStatus: patient.dischargeStatus || row.dischargeStatus || "",
      dischargePrintText: dischargeText,
      importAlerts: row.importAlerts || []
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
      .filter(item => serviceMatchesFilter(item.service, service))
      .filter(item => sector === "Todos" || sectorMatches(item.sector, sector))
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
    if (/SIN ETIQUETA IAAS|VIGILANCIA IAAS|SEGUIMIENTO IAAS|DESCARTAR IAAS/.test(text)) return 0;
    const match = text.match(/\b([1-4])\s+IAAS\b/);
    if (match) return Number(match[1]);
    if (/\b(IAAS ACTIVA|IAAS IMPORTADA|IAAS CONFIRMADA|IAAS PROBABLE)\b/.test(text)) return 1;
    return text === "IAAS" ? 1 : 0;
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
    const overdue = overduePreventiveRows(date);
    const dischargeRows = probableDischargeNotificationRows(date);
    const movementRows = movementNotificationRows(date);
    const alerts = [];
    if (dischargeRows.length) {
      alerts.push({
        title: `${dischargeRows.length} alta(s) hospitalaria(s) por investigar`,
        detail: dischargeRows.slice(0, 3).map(item => `${patientLabel(item.patient, item.row)}: fecha, causa y turno de alta`).join(" Â· "),
        time: "Urgente",
        icon: "alert",
        tone: "critical",
        href: `#/ronda/${date}`
      });
    }
    if (movementRows.length) {
      alerts.push({
        title: `${movementRows.length} cambio(s) de cama/servicio detectado(s)`,
        detail: movementRows.slice(0, 3).map(item => item.notice).join(" Â· "),
        time: "Turno",
        icon: "info",
        tone: "culture",
        href: `#/ronda/${date}`
      });
    }
    return [
      ...alerts,
      {
        title: overdue.length ? `${overdue.length} cama(s) sin revisión > 24 h` : "Paquetes preventivos por completar",
        detail: overdue.length ? overdue.slice(0, 3).map(row => `${serviceDisplayLabel(row.service)} cama ${row.bed || "S/C"}`).join(" · ") : `${stats.pendingPatients} paciente(s) pendientes de ronda preventiva`,
        time: overdue.length ? "Atrasado" : "Hoy",
        icon: "check",
        tone: overdue.length ? "critical" : "round",
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
    const riskRows = iaasRiskNotificationRows(date);
    const cultureAlerts = cultureResultNotificationRows(isoToday());
    const topRisk = riskRows[0];
    const topAlert = stats.alertPatients[0];
    const topCulture = cultureAlerts[0];
    return [
      {
        title: topAlert ? `${topAlert.reason} en ${topAlert.currentService || "servicio"}` : topRisk ? `Riesgo IAAS detectado en ${serviceDisplayLabel(topRisk.service)}` : "Sin alertas IAAS críticas nuevas",
        detail: topAlert ? patientLabel(topAlert) : topRisk ? `${patientLabel(topRisk.patient, topRisk.row)} · ${topRisk.riskDevices.length} invasivo(s) relevante(s)` : "Seguimiento IAAS sin casos críticos activos",
        time: "08:24",
        icon: "alert",
        tone: "critical",
        href: "#/seguimiento-iaas"
      },
      {
        title: topCulture ? topCulture.title : briefing.cultureEvents[0] ? "Cultivo o PCR pendiente" : "Cultivos sin pendientes visibles",
        detail: topCulture ? topCulture.detail : briefing.cultureEvents[0]?.meta || "Sin eventos microbiológicos detectados",
        time: topCulture ? `D${topCulture.day}` : "07:58",
        icon: "flask",
        tone: "culture",
        href: topCulture?.href || "#/seguimiento-iaas"
      },
      {
        title: riskRows.length ? `${riskRows.length} paciente(s) con riesgo IAAS` : `${stats.incompletePatients} expediente(s) IAAS incompletos`,
        detail: riskRows.length ? "Incluidos automáticamente si tienen invasivos relevantes activos o detectados en el texto del censo" : (stats.incompletePatients ? "Requieren completar seguimiento clínico" : "Sin expedientes incompletos en seguimiento"),
        time: "IAAS",
        icon: "info",
        tone: "round",
        href: "#/seguimiento-iaas"
      },
      {
        title: "Recordatorio de catálogos pendientes",
        detail: "Confirmar próximos invasivos, fármacos y cultivos para agregarlos al sistema.",
        time: "Pendiente",
        icon: "info",
        tone: "culture",
        href: "#/importar-censo"
      }
    ];
  }

  function overduePreventiveRows(date) {
    return getCensusRows(date)
      .filter(row => {
        const entry = store.dailyRounds[date]?.entries?.[row.patientId];
        if (entry && ["revisado", "alerta"].includes(entry.status)) return false;
        const last = lastReviewedDateForPatient(row.patientId, date);
        return !last || daysBetween(last, date) >= 1;
      })
      .sort(sortByServiceBed);
  }

  function probableDischargeNotificationRows(date) {
    return Object.values(store.patients || {})
      .filter(patient => patient && patient.hospitalizationStatus !== "egresado")
      .filter(patient => patient.dischargeReviewRequired || ["alta_probable", "alta_reportada", "requiere_conciliaciÃ³n"].includes(patient.hospitalizationStatus))
      .filter(patient => !date || !patient.latestCensusDate || patient.latestCensusDate <= date)
      .map(patient => ({ patient, row: dischargeReviewRowFromPatient(patient, date) }))
      .sort((a, b) => sortByServiceBed(a.row, b.row));
  }

  function movementNotificationRows(date) {
    return getCensusRows(date)
      .flatMap(row => {
        const notices = mergeUnique(row.importAlerts || [], store.patients[row.patientId]?.activePendingIssues || [])
          .filter(item => normalizeText(item).includes("MOVIDO"));
        return notices.map(notice => ({ row, notice }));
      })
      .sort((a, b) => sortByServiceBed(a.row, b.row));
  }

  function lastReviewedDateForPatient(patientId, throughDate) {
    return Object.entries(store.dailyRounds || {})
      .filter(([date, round]) => date <= throughDate && ["revisado", "alerta"].includes(round?.entries?.[patientId]?.status))
      .map(([date]) => date)
      .sort()
      .at(-1) || "";
  }

  function iaasRiskNotificationRows(date) {
    return monitoringRows(date)
      .map(item => ({
        ...item,
        riskDevices: riskRelevantDevicesForItem(item, date)
      }))
      .filter(item => item.riskDevices.length)
      .sort((a, b) => sortByServiceBed(a.row, b.row));
  }

  function cultureResultNotificationRows(date) {
    const current = normalizeDate(date) || isoToday();
    const alerts = [];
    const seen = new Set();
    Object.entries(store.dailyRounds || {}).forEach(([roundDate, round]) => {
      Object.values(round.entries || {}).forEach(entry => {
        if (!entry?.patientId || !entry.iaasAssessment) return;
        const patient = store.patients[entry.patientId] || {};
        normalizeIaasAssessment(entry.iaasAssessment).cultures.forEach(culture => {
          const item = normalizeCultureTimelineItem(culture, roundDate);
          if (!item.type || !item.collectionDate || item.resultDate || item.microorganism) return;
          const day = daysBetween(item.collectionDate, current);
          const threshold = isBloodCulture(item.type) ? 7 : 2;
          if (!Number.isFinite(day) || day < threshold) return;
          const key = `${entry.patientId}|${cultureTimelineKey(item)}`;
          if (seen.has(key)) return;
          seen.add(key);
          const patientName = patientLabel(patient);
          alerts.push({
            patientId: entry.patientId,
            type: item.type,
            day,
            threshold,
            title: `${item.type} de ${patientName} se encuentra en su ${cultureDayText(day)} día`,
            detail: "Probablemente se encuentre ya el resultado definitivo.",
            href: `#/seguimiento-iaas/${current}/paciente/${entry.patientId}`
          });
        });
      });
    });
    return alerts.sort((a, b) => b.day - a.day || String(a.type).localeCompare(String(b.type), "es"));
  }

  function isBloodCulture(type) {
    return normalizeText(type).includes("HEMOCULTIVO");
  }

  function cultureDayText(day) {
    return {
      0: "cero",
      1: "primer",
      2: "segundo",
      3: "tercer",
      4: "cuarto",
      5: "quinto",
      6: "sexto",
      7: "séptimo"
    }[day] || String(day);
  }

  function riskRelevantDevicesForItem(item, date) {
    const patientId = item?.row?.patientId || item?.patient?.patientId;
    const active = patientId ? riskRelevantActiveEpisodes(patientId, date) : [];
    const inferred = item?.inferredRiskDevices || inferredRiskDevicesForText(`${item?.dxHospital || ""} ${item?.epiText || ""} ${item?.observations || ""}`);
    return uniqueDeviceRiskList([...active, ...inferred]);
  }

  function riskRelevantActiveEpisodes(patientId, date) {
    return activeEpisodes(patientId, date).filter(isIaasRiskRelevantEpisode);
  }

  function isIaasRiskRelevantEpisode(ep) {
    const type = normalizeText(ep?.deviceType);
    return Boolean(type) && !NON_IAAS_RISK_DEVICE_TYPES.has(type);
  }

  function hasIaasRiskFromDevices(patientId, date, item = null) {
    if (item && riskRelevantDevicesForItem(item, date).length > 0) return true;
    return riskRelevantActiveEpisodes(patientId, date).length > 0;
  }

  function isIaasFollowUpCandidate(item, date) {
    const epiText = normalizeText(item?.epiText || "");
    return epiText.includes("IAAS");
  }

  function deriveIaasReasoning(item, date, active) {
    const text = normalizeText(`${item?.epiText || ""} ${item?.dxHospital || ""} ${item?.observations || ""}`);
    const riskDevices = uniqueDeviceRiskList([...(active || []).filter(isIaasRiskRelevantEpisode), ...(item?.inferredRiskDevices || [])]);
    const infectionSignal = /INFECCION|INFECCIÓN|SEPSIS|BACTERIEM|NEUMON|FIEBRE|FEBRIL|LEUCOCIT|CULTIVO|HEMOCULT|UROCULT|PCR|PROCALCITON/.test(text);
    const explicitNoIaas = text.includes("NO IAAS") || text.includes("NO RELACIONADA");
    const explicitIaasSignal = iaasCountForText(item?.epiText || "") > 0 || /\b([1-4]\s+IAAS|IAAS ACTIVA|IAAS IMPORTADA|IAAS CONFIRMADA|IAAS PROBABLE)\b/.test(text);
    const explicitIaas = explicitIaasSignal && !explicitNoIaas;
    if (explicitIaas) {
      return {
        kind: "iaas",
        label: "IAAS probable/registrada",
        detail: riskDevices.length
          ? `Cruza etiqueta IAAS con ${riskDevices.length} invasivo(s) relevante(s).`
          : "Existe clasificación IAAS explícita; requiere validación clínica/documental."
      };
    }
    if (text.includes("RIESGO IAAS") || riskDevices.length) {
      return {
        kind: "risk",
        label: "Riesgo IAAS",
        detail: riskDevices.length
          ? `Riesgo por ${riskDevices.map(ep => ep.deviceType).join(", ")}.`
          : "Riesgo IAAS documentado en el censo."
      };
    }
    if (explicitNoIaas || infectionSignal) {
      return {
        kind: "non-iaas",
        label: "Infección no relacionada a IAAS",
        detail: "Hay datos infecciosos sin invasivo relevante activo; descartar relación con atención."
      };
    }
    return {
      kind: "clear",
      label: "Sin criterio IAAS",
      detail: "Sin etiqueta IAAS, sin riesgo por invasivo relevante y sin señal infecciosa visible."
    };
  }

  function inferredRiskDevicesForText(value) {
    const text = normalizeText(value);
    if (!text) return [];
    const candidates = [];
    const add = (deviceType, reason) => candidates.push({ deviceType, inferred: true, source: "census-text", reason });
    if (/\b(CVC|CATETER VENOSO CENTRAL|CATETER CENTRAL|LINEA CENTRAL|VIA CENTRAL)\b/.test(text)) add("CVC", "Texto compatible con cateter venoso central");
    if (/\b(MAHURKAR|MAHURCAR|CATETER HD|CAT HD|CATETER PARA HEMODIALISIS|ACCESO HD)\b/.test(text) || (/\bCATETER\b/.test(text) && /\bHEMODIALISIS\b/.test(text))) add("Catéter Mahurkar", "Texto compatible con acceso de hemodialisis");
    if (/\b(PERMACATH|PERMA CATH|CATETER PERMANENTE PARA HEMODIALISIS)\b/.test(text)) add("Catéter Permacath", "Texto compatible con Permacath");
    if (/\b(TENCKHOFF|TENKHOFF|TENKOF|CATETER PERITONEAL)\b/.test(text)) add("Catéter Tenckhoff", "Texto compatible con Tenckhoff");
    if (/\b(PUERTO|PORT A CATH|PORTACATH|PORT-A-CATH|CATETER PUERTO)\b/.test(text)) add("Catéter Puerto", "Texto compatible con cateter puerto");
    if (/\b(PICC|CATETER CENTRAL PERIFERICO|CATETER CENTRAL DE INSERCION PERIFERICA)\b/.test(text)) add("PICC", "Texto compatible con PICC");
    if (/\b(SONDA FOLEY|FOLEY|CATETER URINARIO|CATETER VESICAL|SONDA VESICAL)\b/.test(text) || /(^|[\s,.;:/-])C\.?U\.?($|[\s,.;:/-])/.test(text)) add("Sonda Foley", "Texto compatible con cateter urinario");
    if (/\b(VENTILACION MECANICA|VM|NAVM|TUBO ENDOTRAQUEAL|OROTRAQUEAL|INTUBACION|TRAQUEOSTOMIA)\b/.test(text)) add("Ventilación mecánica", "Texto compatible con ventilacion invasiva");
    if (/\b(DRENOVAC|DRENO VAC|DRENAJE|DREN)\b/.test(text)) add("DrenoVAC", "Texto compatible con drenaje");
    return uniqueDeviceRiskList(candidates.filter(isIaasRiskRelevantEpisode));
  }

  function uniqueDeviceRiskList(devices) {
    const seen = new Set();
    return (devices || []).filter(device => {
      const key = normalizeText(device?.deviceType);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
        text: `${activeDateLabel()}. ${stats.pendingPatients} pendientes, ${stats.activeAlerts} alertas y ${pendingSync} escritura(s) por sincronizar.`,
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
        text: `${stats.totalPatients} paciente(s) en censo activo y ${Object.keys(stats.byService).length} servicio(s) activos.`,
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
        href: `#/pacientes/${item.row.patientId}/expediente`,
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
      day: activeDateLabel(),
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
    const relevantDeviceSignals = rows.reduce((sum, item) => sum + riskRelevantDevicesForItem(item, date).length, 0);
    const pendingValuations = rows.filter(item => !store.dailyRounds[date]?.entries?.[item.row.patientId]?.iaasAssessment).length;
    const cultures = rows.filter(item => normalizeText(`${item.patient.cultureStatus || item.row.cultureStatus || ""} ${item.patient.observations || item.row.observations || ""}`).includes("CULT")).length;
    return h("div", { class: "iaas-page follow-up-hub" }, [
      renderBedBoard(rows.map(item => item.row).sort(sortByServiceBed), date, "iaas"),
      h("section", { class: "iaas-panel follow-hero" }, [
        h("div", {}, [
          h("h1", {}, ["Seguimiento IAAS"]),
          h("p", {}, ["Seguimiento diario para pacientes con diagnóstico epidemiológico IAAS, Riesgo IAAS, No IAAS, IAAS importada o variantes relacionadas. La valoración integra invasivos, signos vitales, laboratorios, cultivos, tratamiento, bitácora diaria y gráfica de temperatura."])
        ]),
        h("img", { src: `${PRO_ASSET}/icons/extras/futuristic_microscope_with_virus_and_heartbeat.webp`, alt: "", loading: "lazy" })
      ]),
      renderMetricGrid([
        ["Pacientes IAAS/riesgo", rows.length, "activos/importados"],
        ["Invasivos/riesgo", relevantDeviceSignals, "activos o detectados"],
        ["Valoración pendiente", pendingValuations, "registro diario"],
        ["Cultivos visibles", cultures, "notas o resultados"]
      ], "compact"),
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head" }, [
          h("div", {}, [
            h("h2", {}, ["Pacientes IAAS para valoración"]),
            h("p", {}, ["Se muestran solo pacientes cuyo diagnóstico epidemiológico contiene IAAS. La revisión abre directamente su seguimiento clínico epidemiológico."])
          ]),
          h("a", { href: "#/censo-hospitalario" }, ["Ver vigilancia hospitalaria"])
        ]),
        rows.length
          ? renderIaasFollowUpCards(rows, date)
          : h("p", { class: "muted" }, ["Sin pacientes IAAS o riesgo IAAS activos en el censo actual."])
      ])
    ]);
  }

  function iaasFollowUpRows(date) {
    return monitoringRows(date)
      .filter(item => isIaasFollowUpCandidate(item, date))
      .sort((a, b) => sortByServiceBed(a.row, b.row));
  }

  function renderIaasFollowUpCards(rows, date) {
    return h("div", { class: "iaas-follow-list" }, rows.map(item => {
      const patient = item.patient || {};
      const active = activeEpisodes(item.row.patientId, date);
      const riskDevices = riskRelevantDevicesForItem(item, date);
      const inferredCount = riskDevices.filter(device => device.inferred).length;
      const reasoning = deriveIaasReasoning(item, date, active);
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
          h("span", { class: `badge reasoning-${reasoning.kind}` }, [reasoning.label]),
          h("span", { class: "badge epi-iaas" }, [cleanCell(item.epiText) || "IAAS/riesgo"]),
          riskDevices.length ? h("span", { class: "badge device" }, [`${riskDevices.length} invasivo(s) relevante(s)`]) : h("span", { class: "badge neutral" }, ["Sin invasivos relevantes"]),
          inferredCount ? h("span", { class: "badge culture" }, [`${inferredCount} detectado(s) en censo`]) : "",
          entry.iaasAssessment ? h("span", { class: "badge revisado" }, ["Valoración del día"]) : h("span", { class: "badge pendiente" }, ["Pendiente"]),
          reasoning.detail ? h("small", { class: "iaas-reasoning-detail" }, [reasoning.detail]) : ""
        ]),
        h("div", { class: "iaas-follow-actions" }, [
          h("a", {
            class: "iaas-button primary",
            href: `#/seguimiento-iaas/${date}/paciente/${item.row.patientId}`
          }, ["Revisar"]),
          h("a", { class: "iaas-button ghost", href: `#/pacientes/${item.row.patientId}/expediente` }, ["Expediente"])
        ])
      ]);
    }));
  }

  function renderHospitalCensusPage() {
    const date = activeDate();
    const rows = hospitalCensusRows(date).sort((a, b) => sortByServiceBed(a.row, b.row));
    const serviceRows = rows.filter(censusServiceMatch);
    const visibleRows = serviceRows.filter(censusSearchMatch);
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
          h("strong", {}, [activeDateLabel()]),
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
                  scheduleCensusSearchDom();
                }
              })
            ]),
            h("span", { class: "badge neutral", "data-census-count": "true", "data-census-total": String(serviceRows.length) }, [`${visibleRows.length} de ${serviceRows.length}`])
          ])
        ]),
        serviceRows.length ? h("div", { class: "table-wrap census-scroll" }, [
          h("table", { class: "iaas-table hospital-census-table" }, [
            h("thead", {}, [h("tr", {}, ["Servicio / cama", "Paciente", "Edad / sexo", "Ingreso / estancia", "Estado", "Dx hospitalarios", "Dx epidemiologico", "Observaciones"].map(label => h("th", {}, [label])))]),
            h("tbody", {}, serviceRows.map(renderHospitalCensusRow))
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
      ]),
      renderHospitalDischargeHistory(date)
    ]);
  }

  function hospitalCensusRows(date) {
    return getCensusRows(date).map(row => ({ row, patient: store.patients[row.patientId] || {} }));
  }

  function probableDischargeHistoryRows(date) {
    return Object.values(store.patients || {})
      .filter(patient => patient && ["alta_probable", "alta_reportada", "requiere_conciliación", "requiere_conciliaciÃ³n"].includes(patient.hospitalizationStatus))
      .filter(patient => !date || !patient.latestCensusDate || patient.latestCensusDate <= date)
      .sort((a, b) => sortByServiceBed(
        { service: a.currentService || "", bed: a.currentBed || "" },
        { service: b.currentService || "", bed: b.currentBed || "" }
      ));
  }

  function renderHospitalDischargeHistory(date) {
    const rows = probableDischargeHistoryRows(date);
    if (!rows.length) return "";
    return h("section", { class: "iaas-panel census-discharge-history" }, [
      h("div", { class: "iaas-panel-head" }, [
        h("div", {}, [
          h("h2", {}, ["Historial de pacientes fuera del censo activo"]),
          h("p", {}, ["Pacientes que ya no aparecen en la importación actual. No ocupan cama activa; requieren investigar alta, fecha, causa y turno."])
        ]),
        h("span", { class: "badge critical" }, [`${rows.length} por verificar`])
      ]),
      h("div", { class: "discharge-history-grid" }, rows.map(patient => renderHospitalDischargeHistoryCard(patient, date)))
    ]);
  }

  function renderHospitalDischargeHistoryCard(patient, date) {
    const discharge = dischargePrintTextFor({ patient, row: {} });
    const status = patient.hospitalizationStatus === "alta_reportada" ? "Alta reportada" : "Alta probable";
    return h("article", { class: "discharge-history-card" }, [
      h("div", {}, [
        h("strong", {}, [patientLabel(patient)]),
        h("span", {}, [`${patient.currentService || "Sin servicio"} · Cama ${patient.currentBed || "S/C"}`]),
        h("small", {}, [`Último censo: ${patient.latestCensusDate || date || "sin fecha"}`])
      ]),
      h("p", {}, [discharge || "Investigar alta hospitalaria: fecha, causa y turno de alta."]),
      h("div", { class: "discharge-history-actions" }, [
        h("span", { class: "badge warning" }, [status]),
        h("a", { class: "iaas-button ghost", href: `#/ronda/${date || activeDate()}` }, ["Verificar alta"]),
        h("a", { class: "iaas-button", href: `#/pacientes/${patient.patientId}/expediente` }, ["Expediente"])
      ])
    ]);
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
    const dischargeText = dischargePrintTextFor({ patient, row });
    return h("tr", {
      class: `census-row ${stateClass(state)} ${epiClass(epi)}`,
      "data-census-row": "true",
      "data-census-search": normalizeText(censusSearchText(item)),
      hidden: !censusSearchMatch(item)
    }, [
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
      h("td", { "data-label": "Observaciones" }, [truncateText(dischargeText || patient.observations || row.observations || row.notes || "", 130)])
    ]);
  }

  function renderCensusServiceAtlas(rows) {
    const totals = new Map();
    rows.forEach(({ row, patient }) => {
      const parts = serviceParts(row.service || patient.currentService || "");
      (parts.length ? parts : [normalizeService(row.service || patient.currentService || "")]).filter(Boolean).forEach(service => {
        totals.set(service, (totals.get(service) || 0) + 1);
      });
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
    return serviceMatchesFilter(item.row.service || item.patient.currentService, ui.censusService);
  }

  function censusSearchMatch(item) {
    const query = normalizeText(ui.censusQuery);
    if (!query) return true;
    return normalizeText(censusSearchText(item)).includes(query);
  }

  function censusSearchText(item) {
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
    ].filter(Boolean).join(" ");
  }

  function applyCensusSearchDom() {
    const query = normalizeText(ui.censusQuery);
    const rows = [...document.querySelectorAll("tr[data-census-row='true']")];
    let visible = 0;
    rows.forEach(row => {
      const match = !query || String(row.dataset.censusSearch || "").includes(query);
      row.hidden = !match;
      row.classList.toggle("search-hidden", !match);
      if (match) visible += 1;
    });
    const badge = document.querySelector("[data-census-count]");
    if (badge) badge.textContent = `${visible} de ${badge.dataset.censusTotal || rows.length}`;
  }

  function scheduleCensusSearchDom() {
    if (ui.censusSearchFrame) cancelAnimationFrame(ui.censusSearchFrame);
    ui.censusSearchFrame = requestAnimationFrame(() => {
      ui.censusSearchFrame = 0;
      applyCensusSearchDom();
    });
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
            h("p", {}, ["Pega desde Excel/Google Sheets como ruta principal, o carga CSV/XLSX como respaldo. La importación interpreta censos hospitalarios con columnas extra, valida, deduplica, concilia y luego guarda."])
          ]),
          h("span", { class: "badge" }, ["Sin IA pagada"])
        ]),
        h("div", { class: "import-recommendation" }, [
          h("strong", {}, ["Recomendado para mañana: copiar y pegar"]),
          h("span", {}, ["Es el flujo más estable en móvil y escritorio: acepta el formato humano del censo, ignora columnas administrativas y conserva Servicio, Cama, Paciente, nacimiento, edad, sector, RFC, sexo, ingreso, DEIH, estado, Dx hospitalarios y Observaciones/Pendientes."])
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
          h("label", { class: "field" }, [
            h("span", {}, ["Tipo de importación"]),
            h("select", {
              id: "import-mode",
              value: ui.importMode || "auto",
              onchange: event => {
                ui.importMode = event.target.value || "auto";
                ui.importDraft = null;
                renderIaas();
              }
            }, [
              h("option", { value: "auto" }, ["Automática segura"]),
              h("option", { value: "full" }, ["Censo completo"]),
              h("option", { value: "partial" }, ["Solo pacientes pegados"])
            ])
          ]),
          h("label", { class: "field full" }, [
            h("span", {}, ["Pegar tabla del censo"]),
            h("textarea", {
              id: "import-text",
              placeholder: "Pega aquí el censo completo del hospital, incluso si trae encabezados, guardias, hora, médico, pendientes o columnas extra.",
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
      h("h3", {}, ["Campos que intenta reconocer"]),
      h("div", { class: "chip-row" }, IMPORT_REQUIRED_LABELS.map(col => h("span", { class: "chip" }, [col]))),
      h("p", {}, ["También acepta censos sin encabezados limpios: lee el servicio desde el título, limpia abreviaturas de cama, expande sector/sexo y deja pendientes cuando falte algún dato. El Dx epidemiológico no se importa porque pertenece al seguimiento de epidemiología."])
    ]);
  }

  function renderImportPreview(draft) {
    const s = draft.summary;
    const columns = [
      ["Servicio", row => row.servicio || "PENDIENTE"],
      ["Cama", row => row.cama || "PENDIENTE"],
      ["Paciente", row => row.patient_name || row.patient_id || "PENDIENTE"],
      ["Fecha nacimiento", row => formatDisplayDate(row.fecha_nacimiento) || "PENDIENTE"],
      ["Edad", row => row.edad ?? "PENDIENTE"],
      ["Sector", row => row.sector || "PENDIENTE"],
      ["RFC", row => row.rfc || "PENDIENTE"],
      ["Sexo", row => row.sexo || "PENDIENTE"],
      ["Ingreso", row => formatDisplayDate(row.fecha_ingreso) || (isAmbulatoryStayService(row.servicio) ? "AMB" : "PENDIENTE")],
      ["DEIH", row => row.deih ?? (isAmbulatoryStayService(row.servicio) ? "NA" : "PENDIENTE")],
      ["Estado", row => row.estado || "PENDIENTE"],
      ["Dx hospitalarios", row => truncateText(row.diagnostico_actual || "PENDIENTE", 120)],
      ["Observaciones y pendientes", row => row.observaciones || "SP"],
      ["Errores/avisos", row => [...(row.__errors || []), ...(row.__warnings || [])].join(" | ")]
    ];
    return h("section", { class: "import-preview" }, [
      renderMetricGrid([
        ["Total filas", s.totalRows, "Leídas"],
        ["Válidas", s.validRows, "Listas para guardar"],
        ["Modo", importScopeText(s.importScope), s.importScope === "full" ? "Concilia ausentes" : "Conserva existentes"],
        ["Errores", s.errorRows, "No se guardan"],
        ["Advertencias", s.warningRows, "Revisar"],
        ["Nuevos", s.newPatients, "Crear pacientes"],
        ["Actualizados", s.updatedPatients, "Sin duplicar"],
        ["Duplicados", s.duplicates, "Omitidos"],
        ["Conflictos", s.conflicts, "Requiere resolución"],
        ["Altas probables", s.probableDischarges || 0, "Verificar"],
        ["Altas reportadas", s.reportedDischarges || 0, "Pendientes"]
      ], "compact"),
      h("div", { class: "import-preview-actions" }, [
        h("button", { class: "iaas-button ghost", onclick: downloadImportErrors }, ["Descargar errores de importación"]),
        h("button", { class: "iaas-button primary", disabled: s.validRows === 0 || ui.importSaving ? "disabled" : null, onclick: confirmImport }, [ui.importSaving ? "Guardando..." : "Confirmar importación"])
      ]),
      renderImportIssues(draft),
      h("div", { class: "table-wrap" }, [
        h("table", { class: "iaas-table import-census-table" }, [
          h("thead", {}, [h("tr", {}, columns.map(([label]) => h("th", {}, [label])))]),
          h("tbody", {}, draft.rows.slice(0, 30).map(row => h("tr", { class: row.errors.length ? "has-error" : row.warnings.length ? "has-warning" : "" }, [
            ...columns.map(([, valueFor]) => h("td", {}, [valueFor({ ...row.normalized, __errors: row.errors, __warnings: row.warnings })]))
          ])))
        ])
      ])
    ]);
  }

  function renderImportIssues(draft) {
    const missing = draft.reconciliationMissing || [];
    const reported = draft.reportedDischarges || [];
    const automatic = draft.automaticDischarges || [];
    if (!draft.conflicts.length && !missing.length && !reported.length && !automatic.length) {
      if (draft.plan?.importScope === "partial") {
        return h("div", { class: "notice ok" }, ["Importación parcial segura: se actualizarán los pacientes pegados y se conservará el censo existente del día."]);
      }
      return h("div", { class: "notice ok" }, ["Sin conflictos críticos."]);
    }
    return h("div", { class: "notice warn" }, [
      h("strong", {}, ["Revisión necesaria"]),
      h("p", {}, [`Conflictos servicio/cama: ${draft.conflicts.length}. Altas probables por ausencia: ${missing.length}. Altas encontradas en pendientes: ${reported.length}. Altas automáticas del día anterior: ${automatic.length}.`])
    ]);
  }

  function renderRoundPage(date) {
    ensureDailyRound(date);
    const round = store.dailyRounds[date];
    const rows = getCensusRows(date);
    const serviceValues = new Set(ROUND_SERVICE_FILTERS.map(filter => filter.value));
    if (!serviceValues.has(ui.selectedService)) ui.selectedService = "Todos";
    const filtered = rows
      .filter(row => serviceMatchesFilter(row.service, ui.selectedService))
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
      renderRoundServiceFilters(rows),
      renderBedBoard(filtered, date, "preventive"),
      renderPreventivePackagePanel(stats, rows, date),
      renderMetricGrid([
        ["Total", stats.totalPatients, "Pacientes"],
        ["Revisados", stats.reviewedPatients, "Sincronizados/locales"],
        ["Pendientes", stats.pendingPatients, "Por revisar"],
        ["Incompletos", stats.incompletePatients, "Datos incompletos"],
        ["Alertas", stats.activeAlerts, "Alerta IAAS"],
        ["Sync pendiente", pendingQueue().length, "Pendiente de sincronizar"]
      ], "compact"),
      renderRoundWorklistSummary(rows, filtered, stats, date),
      renderDischargeReviewPanel(date),
      h("section", { class: "round-list" }, filtered.map(row => renderRoundCard(row, date)))
    ]);
  }

  function renderRoundServiceFilters(rows) {
    const counts = rows.reduce((map, row) => {
      const parts = serviceParts(row.service);
      (parts.length ? parts : [normalizeService(row.service)]).filter(Boolean).forEach(service => {
        map.set(service, (map.get(service) || 0) + 1);
      });
      return map;
    }, new Map());
    return h("section", { class: "service-filter round-service-filter", "aria-label": "Filtrar camas por servicio" }, ROUND_SERVICE_FILTERS.map(filter => {
      const active = ui.selectedService === filter.value;
      const count = filter.value === "Todos" ? rows.length : counts.get(filter.value) || 0;
      return h("button", {
        class: `${active ? "active" : ""}${count ? "" : " empty"}`.trim(),
        type: "button",
        title: `${filter.value === "Todos" ? "Todos los servicios" : filter.value}: ${count} cama(s)`,
        "aria-pressed": active ? "true" : "false",
        onclick: () => {
          ui.selectedService = filter.value;
          renderIaas();
        }
      }, [filter.label]);
    }));
  }

  function renderDischargeReviewPanel(date) {
    const byPatient = new Map();
    Object.values(store.dailyCensus[date]?.patients || {})
      .filter(row => {
        const patient = store.patients[row.patientId] || {};
        return row.dischargeReviewRequired
          || row.probableDischarge
          || row.dischargeReported
          || ["alta_probable", "alta_reportada", "requiere_conciliaciÃ³n"].includes(patient.hospitalizationStatus);
      })
      .forEach(row => byPatient.set(row.patientId, row));
    probableDischargeNotificationRows(date).forEach(item => {
      if (!byPatient.has(item.patient.patientId)) byPatient.set(item.patient.patientId, item.row);
    });
    const rows = [...byPatient.values()]
      .sort(sortByServiceBed);
    if (!rows.length) return "";
    return h("section", { class: "iaas-panel discharge-review-panel" }, [
      h("div", { class: "panel-head" }, [
        h("div", {}, [
          h("h2", {}, ["Altas por verificar"]),
          h("p", {}, ["Pacientes ausentes, reportados con alta o encontrados en otro servicio."])
        ]),
        h("span", { class: "badge warn" }, [`${rows.length} pendiente(s)`])
      ]),
      h("div", { class: "discharge-review-list" }, rows.map(row => renderDischargeReviewCard(row, date)))
    ]);
  }

  function dischargeReviewRowFromPatient(patient, date) {
    return {
      patientId: patient.patientId,
      service: patient.currentService || "SIN SERVICIO",
      bed: patient.currentBed || "S/C",
      patientName: patient.patientName || null,
      rfc: patient.rfc || patient.hospitalInternalId || null,
      birthDate: patient.birthDate || null,
      sector: patient.sector || null,
      age: patient.age ?? null,
      sex: patient.sex || null,
      admissionDate: patient.admissionDate || null,
      deih: patient.deih ?? daysBetween(patient.admissionDate, date),
      state: patient.currentState || "ALTA PROBABLE",
      diagnosis: patient.currentDiagnosis || null,
      observations: PROBABLE_DISCHARGE_MESSAGE,
      present: false,
      probableDischarge: patient.hospitalizationStatus === "alta_probable",
      dischargeReported: patient.hospitalizationStatus === "alta_reportada",
      dischargeReviewRequired: true,
      reconciliationRequired: true,
      importAlerts: mergeUnique(patient.activePendingIssues || [], [PROBABLE_DISCHARGE_MESSAGE]),
      notes: "Investigar fecha, causa y turno de alta hospitalaria."
    };
  }

  function renderDischargeReviewCard(row, date) {
    const patient = store.patients[row.patientId] || {};
    const alerts = mergeUnique(row.importAlerts || [], patient.activePendingIssues || [])
      .filter(item => [PROBABLE_DISCHARGE_MESSAGE, REPORTED_DISCHARGE_MESSAGE].includes(item) || normalizeText(item).includes("MOVIDO") || normalizeText(item).includes("ALTA"));
    const safeId = safeDomId(row.patientId);
    const selectedType = patient.dischargeType || row.dischargeType || DISCHARGE_TYPES[0];
    const selectedDate = normalizeDate(patient.dischargeDate || row.dischargeDate) || date;
    const selectedShift = patient.dischargeShift || row.dischargeShift || DISCHARGE_SHIFTS.at(-1);
    return h("article", { class: "discharge-review-card" }, [
      h("div", { class: "discharge-review-main" }, [
        h("strong", {}, [patientLabel(patient, row).toUpperCase()]),
        h("span", {}, [`${row.service || patient.currentService || "SIN SERVICIO"} · cama ${row.bed || patient.currentBed || "S/C"}`]),
        h("small", {}, [alerts.length ? alerts.join(" | ") : "Revisar situación actual del paciente."])
      ]),
      h("div", { class: "discharge-review-fields" }, [
        h("label", {}, [
          h("span", {}, ["Tipo de alta"]),
          h("select", { id: `discharge-type-${safeId}` }, DISCHARGE_TYPES.map(type => option(type, type, normalizeText(type) === normalizeText(selectedType))))
        ]),
        h("label", {}, [
          h("span", {}, ["Fecha de alta"]),
          h("input", { id: `discharge-date-${safeId}`, type: "date", value: selectedDate })
        ]),
        h("label", {}, [
          h("span", {}, ["Turno de alta"]),
          h("select", { id: `discharge-shift-${safeId}` }, DISCHARGE_SHIFTS.map(shift => option(shift, shift, normalizeText(shift) === normalizeText(selectedShift))))
        ])
      ]),
      h("div", { class: "discharge-review-actions" }, [
        h("button", { class: "iaas-button primary", onclick: () => confirmHospitalDischarge(date, row.patientId) }, ["Confirmar alta"]),
        h("button", { class: "iaas-button ghost", onclick: () => markPatientStillHospitalized(date, row.patientId) }, ["Sigue hospitalizado"])
      ])
    ]);
  }

  function safeDomId(value) {
    return String(value || "").replace(/[^a-zA-Z0-9_-]+/g, "-");
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

  function renderBedBoard(rows, date, mode = "preventive") {
    const items = bedBoardItems(rows, date, mode);
    const label = mode === "iaas" ? "Mapa de camas IAAS" : "Mapa de camas preventivas";
    const pending = items.filter(item => item.row && bedTileState(item.row, date, mode).status === "overdue").length;
    const reviewed = items.filter(item => item.row && bedTileState(item.row, date, mode).status === "reviewed").length;
    return h("section", { class: `bed-board ${mode}` }, [
      h("div", { class: "bed-board-head" }, [
        h("div", {}, [
          h("h2", {}, [label]),
          h("p", {}, [mode === "iaas"
            ? "Toca una cama para abrir la valoración IAAS. Las camas sin riesgo IAAS quedan bloqueadas."
            : "Toca una cama para abrir el paciente. Las vacías quedan bloqueadas y las atrasadas aparecen en rojo."])
        ]),
        h("div", { class: "bed-board-totals" }, [
          h("span", {}, [`${items.length} cama(s)`]),
          h("span", {}, [`${reviewed} vistas`]),
          pending ? h("strong", {}, [`${pending} pendientes`]) : ""
        ])
      ]),
      h("div", { class: "bed-board-legend" }, [
        h("span", { class: "legend available" }, ["Disponible"]),
        h("span", { class: "legend vacant" }, ["Desocupada"]),
        h("span", { class: "legend reviewed" }, ["Vista"]),
        h("span", { class: "legend overdue" }, ["Pendiente"])
      ]),
      renderBedBoardPicker(items, date, mode),
      h("div", { class: "bed-board-grid" }, items.map(item => renderBedTile(item, date, mode)))
    ]);
  }

  function renderBedBoardPicker(items, date, mode) {
    const selectable = items.filter(item => item.row && !bedTileState(item.row, date, mode).disabled);
    if (!selectable.length) return "";
    return h("label", { class: "bed-board-picker" }, [
      h("span", {}, [mode === "iaas" ? "Ir a cama IAAS" : "Ir a cama preventiva"]),
      h("select", {
        onchange: event => {
          const patientId = event.target.value;
          if (patientId) location.hash = bedTileHref(date, patientId, mode);
        }
      }, [
        option("", "Seleccionar cama disponible", true),
        ...selectable.map(item => option(
          item.row.patientId,
          `Cama ${item.bed || item.row.bed || "S/C"} · ${patientLabel(store.patients[item.row.patientId] || {}, item.row)}`,
          false
        ))
      ])
    ]);
  }

  function bedTileHref(date, patientId, mode) {
    return mode === "iaas" ? `#/seguimiento-iaas/${date}/paciente/${patientId}` : `#/ronda/${date}/paciente/${patientId}`;
  }

  function bedBoardItems(rows, date, mode) {
    const sorted = dedupeBedBoardRows(rows).sort(sortByServiceBed);
    const serviceNames = unique(sorted.map(row => normalizeService(row.service)).filter(Boolean));
    if (serviceNames.length !== 1) {
      return sorted.map(row => ({ bed: row.bed || "S/C", row }));
    }
    const numericRows = sorted
      .map(row => ({ row, number: bedNumberToken(row.bed) }))
      .filter(item => Number.isFinite(item.number));
    if (numericRows.length < Math.max(3, Math.floor(sorted.length * 0.6))) {
      return sorted.map(row => ({ bed: row.bed || "S/C", row }));
    }
    const min = Math.min(...numericRows.map(item => item.number));
    const max = Math.max(...numericRows.map(item => item.number));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max - min > 80) {
      return sorted.map(row => ({ bed: row.bed || "S/C", row }));
    }
    const byNumber = new Map();
    numericRows.forEach(item => {
      if (!byNumber.has(item.number)) byNumber.set(item.number, item.row);
    });
    const inferred = [];
    for (let number = min; number <= max; number += 1) {
      const row = byNumber.get(number);
      inferred.push({ bed: row?.bed || String(number), row: row || null });
    }
    return inferred;
  }

  function dedupeBedBoardRows(rows) {
    const byLocation = new Map();
    (rows || []).filter(isActiveCensusRow).forEach(row => {
      const key = `${normalizeService(row.service || "")}|${normalizeText(row.bed || "S/C")}`;
      const current = byLocation.get(key);
      if (!current) {
        byLocation.set(key, row);
        return;
      }
      const currentEntry = store.dailyRounds[row.roundDate || activeDate()]?.entries?.[current.patientId];
      const nextEntry = store.dailyRounds[row.roundDate || activeDate()]?.entries?.[row.patientId];
      const currentScore = (current.present === false ? -10 : 0) + (currentEntry?.status === "revisado" ? 1 : 0);
      const nextScore = (row.present === false ? -10 : 0) + (nextEntry?.status === "revisado" ? 1 : 0);
      if (nextScore > currentScore) byLocation.set(key, row);
    });
    return [...byLocation.values()];
  }

  function bedNumberToken(bed) {
    const match = String(bed || "").match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function renderBedTile(item, date, mode) {
    const state = bedTileState(item.row, date, mode);
    const bed = item.bed || item.row?.bed || "S/C";
    const patient = item.row ? store.patients[item.row.patientId] || {} : null;
    const content = [
      h("strong", {}, [bed]),
      h("span", {}, [state.label]),
      h("small", {}, [patient ? truncateText(patientLabel(patient, item.row), 24) : "Sin paciente"])
    ];
    const attrs = {
      class: `bed-tile ${state.status}`,
      title: state.title,
      "aria-label": `${bed}: ${state.title}`
    };
    if (state.disabled) {
      return h("button", { ...attrs, type: "button", disabled: true }, content);
    }
    return h("a", { ...attrs, href: bedTileHref(date, item.row.patientId, mode) }, content);
  }

  function renderRoundNavigationBoard(date, patientId, section, patient) {
    const mode = section === "iaas" ? "iaas" : "preventive";
    const rows = roundNavigationRows(date, patientId, mode, patient);
    const items = bedBoardItems(rows, date, mode);
    if (!items.length) return "";
    const roundNavMode = mode;

    const collapsed = roundNavCollapsed(roundNavMode);

    return h("div", { class: "round-nav-board " + roundNavMode + (collapsed ? " collapsed" : "") }, [
      h("div", { class: "round-nav-head" }, [
        h("strong", {}, [mode === "iaas" ? "Camas IAAS" : `Camas ${serviceDisplayLabel(patient.currentService)}`]),
        h("div", { class: "round-nav-actions" }, [
        h("span", {}, ["Seleccionar cama"]),
        h("button", {
          type: "button",
          class: "round-nav-toggle",
          "aria-expanded": String(!collapsed),
          onclick: event => {
            event.preventDefault();
            setRoundNavCollapsed(roundNavMode, !collapsed);
          }
        }, [roundNavToggleLabel(roundNavMode, collapsed)])
      ])
      ]),
      h("div", { class: "round-nav-grid" }, items.map(item => renderRoundNavTile(item, date, mode, patientId)))
    ]);
  }

  function roundNavigationRows(date, patientId, mode, patient) {
    if (mode === "iaas") return iaasFollowUpRows(date).map(item => item.row);
    const service = normalizeService(patient.currentService || store.dailyCensus?.[date]?.patients?.[patientId]?.service);
    return getCensusRows(date)
      .filter(row => normalizeService(row.service) === service)
      .sort(sortByServiceBed);
  }

  function renderRoundNavTile(item, date, mode, currentPatientId) {
    const state = bedTileState(item.row, date, mode);
    const bed = item.bed || item.row?.bed || "S/C";
    const patient = item.row ? store.patients[item.row.patientId] || {} : null;
    const content = [
      h("strong", {}, [bed]),
      h("span", {}, [state.label]),
      h("small", {}, [patient ? truncateText(patientLabel(patient, item.row), mode === "iaas" ? 34 : 22) : "Sin paciente"])
    ];
    const attrs = {
      class: `bed-tile round-nav-tile ${state.status} ${item.row?.patientId === currentPatientId ? "current" : ""}`,
      title: state.title,
      "aria-label": `${bed}: ${state.title}`
    };
    if (state.disabled) return h("button", { ...attrs, type: "button", disabled: true }, content);
    return h("a", { ...attrs, href: bedTileHref(date, item.row.patientId, mode) }, content);
  }

  function bedTileState(row, date, mode) {
    if (!row?.patientId) {
      return { status: "vacant", disabled: true, label: "Vacía", title: "Cama desocupada" };
    }
    if (mode === "iaas") {
      const item = enrichMonitoringItem({ row, patient: store.patients[row.patientId] || {} }, date);
      if (!isIaasFollowUpCandidate(item, date)) {
        return { status: "locked", disabled: true, label: "Sin riesgo", title: "Bloqueada: paciente sin riesgo IAAS definido" };
      }
      const reviewed = Boolean(store.dailyRounds[date]?.entries?.[row.patientId]?.iaasAssessment);
      if (reviewed) return { status: "reviewed", disabled: false, label: "Vista", title: "Valoración IAAS capturada" };
      const last = lastIaasAssessmentDateForPatient(row.patientId, date);
      if (!last || daysBetween(last, date) >= 1) return { status: "overdue", disabled: false, label: "Pendiente", title: "Pendiente de valoración IAAS" };
      return { status: "available", disabled: false, label: "Disponible", title: "Disponible para valoración IAAS" };
    }
    const entry = store.dailyRounds[date]?.entries?.[row.patientId];
    if (entry && ["revisado", "alerta"].includes(entry.status)) {
      return { status: "reviewed", disabled: false, label: "Vista", title: "Ronda preventiva guardada" };
    }
    const last = lastReviewedDateForPatient(row.patientId, date);
    if (!last || daysBetween(last, date) >= 1) {
      return { status: "overdue", disabled: false, label: "Pendiente", title: "Pendiente de ronda preventiva" };
    }
    return { status: "available", disabled: false, label: "Disponible", title: "Disponible para ronda preventiva" };
  }

  function lastIaasAssessmentDateForPatient(patientId, throughDate) {
    return Object.entries(store.dailyRounds || {})
      .filter(([date, round]) => date <= throughDate && round?.entries?.[patientId]?.iaasAssessment)
      .map(([date]) => date)
      .sort()
      .at(-1) || "";
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
        h("a", { class: "iaas-button ghost", href: `#/pacientes/${row.patientId}/expediente` }, ["Expediente"])
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


  function roundNavStorageKey(mode) {
    return ROUND_NAV_COLLAPSE_KEY + "-" + (mode || "default");
  }

  function roundNavCollapsed(mode) {
    try {
      return sessionStorage.getItem(roundNavStorageKey(mode)) === "1";
    } catch (error) {
      return false;
    }
  }

  function setRoundNavCollapsed(mode, collapsed) {
    try {
      sessionStorage.setItem(roundNavStorageKey(mode), collapsed ? "1" : "0");
    } catch (error) {
      // La preferencia de vista no es critica si el navegador bloquea sessionStorage.
    }
    render();
  }

  function roundNavToggleLabel(mode, collapsed) {
    const label = mode === "iaas" ? "camas IAAS" : "camas";
    return (collapsed ? "Mostrar " : "Ocultar ") + label;
  }

  function renderPatientRound(date, patientId, requestedSection = null) {
    const patient = store.patients[patientId];
    if (!patient) return renderNotFound("Paciente no encontrado.");
    ensureDailyRound(date);
    const section = requestedSection === "iaas" ? "iaas" : "preventive";
    const draft = getReviewDraft(date, patientId, section);
    const active = activeEpisodes(patientId, date);
    const patientDevices = episodesForPatient(patientId);
    const stay = isAmbulatoryStayService(patient.currentService) ? "Ambulatorio" : `${daysBetween(patient.admissionDate, date) ?? "NA"} dias`;
    const backHref = section === "iaas" ? "#/seguimiento-iaas" : `#/ronda/${date}`;
    return h("div", { class: "iaas-page patient-round" }, [
      renderPatientRoundSummary(date, patientId, patient, stay, backHref, section),
      ...(section === "iaas"
        ? [renderIaasInvasiveSummary(patientDevices, date, patientId), renderIaasAssessmentPanel(date, patientId, patient, active, draft)]
        : renderPreventiveReviewSections(date, patientId, patient, active, draft)),
      h("div", { class: "round-save-bar" }, [
        renderRoundNavigationBoard(date, patientId, section, patient),
        h("button", { class: "iaas-button ghost", onclick: () => saveRoundEntry(date, patientId, "incompleto", false) }, ["Guardar como incompleto"]),
        h("button", { class: "iaas-button", onclick: () => saveRoundEntry(date, patientId, "pendiente", false) }, ["Marcar pendiente"]),
        h("button", { class: "iaas-button primary", onclick: () => saveRoundEntry(date, patientId, "revisado", "previous") }, ["Guardar y anterior cama"]),
        h("button", { class: "iaas-button primary", onclick: () => saveRoundEntry(date, patientId, "revisado", false) }, ["Guardar"]),
        h("button", { class: "iaas-button primary strong", onclick: () => saveRoundEntry(date, patientId, "revisado", "next") }, ["Guardar y siguiente cama"])
      ])
    ]);
  }

  function renderPatientRoundSummary(date, patientId, patient, stay, backHref, section) {
    return h("section", { class: "iaas-panel patient-sticky-summary" }, [
      h("div", { class: "patient-summary-main" }, [
        h("a", { href: backHref, class: "back-link" }, ["Volver al servicio"]),
        h("h1", {}, [`Cama ${patient.currentBed} - ${patientLabel(patient)}`]),
        h("p", {}, [`${patient.currentService} - Estancia: ${stay}`]),
        renderPatientDiagnosisSummary(date, patientId, patient)
      ]),
      h("div", { class: "patient-summary-side" }, [
        h("span", { class: `risk ${riskClass(patient.currentRiskLevel)}` }, [patient.currentRiskLevel || "Sin riesgo"]),
        section === "iaas" ? renderPatientCultureAlerts(patientId, date) : ""
      ])
    ]);
  }
  function renderPreventiveReviewSections(date, patientId, patient, active, draft) {
    const deviceCards = preventiveDeviceCards(active, draft, date);
    const hasAnyInvasive = active.length > 0 || (draft.deviceDrafts || []).some(packageCreatesDevice);
    return [
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head compact" }, [
          h("div", {}, [
            h("h2", {}, ["Dispositivos invasivos actuales"]),
            h("p", {}, ["Vista compacta para revisar tipo, French, instalación, retiro y días de invasivo."])
          ]),
          h("div", { class: "iaas-panel-actions" }, [
            h("a", { class: "iaas-button ghost compact", href: `#/seguimiento-iaas/${date}/paciente/${patientId}` }, ["Ir a seguimiento IAAS"]),
            h("a", { class: "iaas-button ghost compact", href: "#/censo-hospitalario" }, ["Ir a vigilancia hospitalaria"]),
            hasAnyInvasive ? h("span", { class: "badge device" }, [`${active.length} registrado(s)`]) : h("span", { class: "badge neutral" }, ["Sin invasivos"])
          ])
        ]),
        deviceCards.length ? h("div", { class: "device-list compact-device-grid" }, deviceCards.map(ep => renderActiveDevice(ep, draft, date))) : h("p", { class: "muted" }, ["No hay invasivos activos capturados."]),
        !hasAnyInvasive ? h("button", { class: draft.noInvasivesConfirmed ? "iaas-button primary" : "iaas-button", onclick: () => toggleNoInvasives(date, patientId) }, [draft.noInvasivesConfirmed ? "Sin invasivos confirmado" : "Confirmar sin invasivos"]) : ""
      ]),
      h("section", { class: "iaas-panel" }, [
        h("div", { class: "iaas-panel-head compact" }, [
          h("div", {}, [
            h("h2", {}, ["Agregar paquete preventivo"]),
            h("p", {}, ["Selecciona el paquete y captura solo los criterios necesarios para enfermería."])
          ])
        ]),
        h("div", { class: "quick-device-grid package-selector-grid" }, PREVENTIVE_PACKAGE_TYPES.map(type =>
          h("button", { class: "quick-device package-selector", onclick: () => addDeviceDraft(date, patientId, type) }, [type])
        )),
        draft.deviceDrafts?.length ? h("div", { class: "device-drafts package-drafts" }, draft.deviceDrafts.map((device, index) => renderDeviceDraft(date, patientId, device, index))) : ""
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

  function preventiveDeviceCards(active, draft, date) {
    const removalDrafts = draft.removals || {};
    return [...active].sort((a, b) => {
      const aRemoved = Boolean(removalDrafts[a.episodeId] || a.removalDate);
      const bRemoved = Boolean(removalDrafts[b.episodeId] || b.removalDate);
      if (aRemoved !== bRemoved) return aRemoved ? 1 : -1;
      return invasiveDays(b, date, removalDrafts[b.episodeId]) - invasiveDays(a, date, removalDrafts[a.episodeId])
        || String(a.deviceType || "").localeCompare(String(b.deviceType || ""), "es");
    });
  }

  function invasiveDays(ep, date, draftRemoval = "") {
    const end = normalizeDate(draftRemoval) || normalizeDate(ep.removalDate) || normalizeDate(date) || isoToday();
    return daysBetween(ep.installationDate, end) ?? 0;
  }

  function packageCreatesDevice(device) {
    const type = typeof device === "string" ? device : device?.packageType;
    return !["ISQ", "P.E. Y P.B.M.T."].includes(type);
  }

  function defaultPreventiveDevice(packageType) {
    return {
      packageType,
      createsDevice: packageCreatesDevice(packageType),
      deviceType: packageType === "ITS - CC" ? "CVPC"
        : packageType === "ITU - CU" ? "Sonda Foley"
          : packageType === "NAVM" ? "PUNTAS NASALES"
            : packageType === "ESPECIAL" ? "SONDA NASOGÁSTRICA"
              : packageType,
      deviceSubtype: "",
      material: packageType === "ITU - CU" ? "SILICÓN" : "",
      deviceState: packageType === "ITU - CU" ? "CIRCUITO CERRADO" : "",
      french: "",
      installationDate: packageCreatesDevice(packageType) ? "" : "",
      removalDate: "",
      preventiveChecks: {},
      oralHygieneMethod: "",
      observations: "",
      notes: ""
    };
  }

  function preventiveCompliance(checks = {}) {
    const values = Object.values(checks).map(normalizeText).filter(value => value === "SÍ" || value === "SI" || value === "NO");
    if (!values.length) return "";
    const yes = values.filter(value => value === "SÍ" || value === "SI").length;
    return `${Math.round((yes / values.length) * 100)}%`;
  }

  function deviceDisplayName(device = {}) {
    return [device.deviceType, device.deviceSubtype].map(cleanCell).filter(Boolean).join(" · ") || device.packageType || "Dispositivo";
  }

  function packageReviewSummary(device = {}) {
    const checks = PREVENTIVE_CHECKS[device.packageType] || [];
    return {
      packageType: device.packageType || "",
      deviceType: deviceDisplayName(device),
      material: device.material || "",
      deviceState: device.deviceState || "",
      french: device.french || "",
      installationDate: device.installationDate || "",
      removalDate: device.removalDate || "",
      preventiveChecks: device.preventiveChecks || {},
      compliance: preventiveCompliance(device.preventiveChecks || {}),
      observations: device.observations || "",
      reviewedFields: checks.map(([key, label]) => ({ key, label, value: device.preventiveChecks?.[key] || "" }))
    };
  }

  function renderIaasAssessmentPanel(date, patientId, patient, active, draft) {
    const assessment = normalizeIaasAssessment(draft.iaasAssessment);
    const limited = isLimitedIaasAssessmentService(patient.currentService);
    const hemodialysis = isHemodialysisService(patient.currentService);
    const hasVentilation = hasVentilationDevice(active);
    const viralOptions = limited ? IAAS_LIMITED_VIRAL_PANEL_TESTS : IAAS_VIRAL_PANEL_TESTS;
    const mobileSection = IAAS_MOBILE_SECTIONS.some(section => section.key === ui.iaasMobileSection) ? ui.iaasMobileSection : "antibioticos";
    const sectionBlock = (key, node) => node ? h("div", {
      class: `iaas-mobile-section iaas-mobile-${key} ${mobileSection === key ? "mobile-active" : ""}`
    }, [node]) : "";
    return h("section", { class: "iaas-panel iaas-assessment-panel" }, [
      h("div", { class: "iaas-panel-head" }, [
        h("div", {}, [
          h("h2", {}, ["Seguimiento clínico IAAS"]),
          h("p", {}, [limited
            ? "Paciente de servicio ambulatorio: se limita a invasivos, signos vitales, panel viral, cultivos y tratamiento."
            : "Registro diario de signos vitales, laboratorio, orina, cultivos, tratamiento y evolución."])
        ]),
        h("span", { class: "badge epi-iaas" }, ["IAAS"])
      ]),
      renderIaasMobileSectionTabs(),
      h("div", { class: "iaas-assessment-grid" }, [
        sectionBlock("antibioticos", renderIaasTreatments(date, patientId, assessment)),
        sectionBlock("cultivos", renderIaasCultures(date, patientId, assessment)),
        hemodialysis ? sectionBlock("cultivos", renderHemodialysisInfectionPanel(date, patientId, patient, assessment)) : "",
        sectionBlock("observaciones", renderIaasGeneralObservations(date, patientId, assessment)),
        sectionBlock("signos", renderIaasVitalSigns(date, patientId, assessment, hasVentilation)),
        limited ? "" : sectionBlock("biometria", renderIaasCbc(date, patientId, assessment)),
        limited ? "" : sectionBlock("ego", renderIaasUrinalysis(date, patientId, assessment)),
        sectionBlock("otros", renderIaasOtherStudies(date, patientId, assessment, limited, viralOptions))
      ]),
      h("div", { class: "iaas-daily-section" }, [
        h("div", { class: "iaas-panel-head compact" }, [
          h("div", {}, [
            h("h3", {}, ["Registro diario IAAS"]),
            h("p", {}, ["Tabla de seguimiento por fecha desde el ingreso; se completa al guardar la valoración diaria."])
          ])
        ]),
        renderIaasVitalSignsChart(patient, patientId, date),
        renderDailyIaasTable(patient, patientId, date),
        renderIaasStudyHistory(patient, patientId)
      ])
    ]);
  }

  function renderIaasMobileSectionTabs() {
    return h("div", { class: "iaas-mobile-section-tabs", role: "tablist", "aria-label": "Filtro móvil de captura IAAS" }, IAAS_MOBILE_SECTIONS.map(section =>
      h("button", {
        class: ui.iaasMobileSection === section.key ? "active" : "",
        type: "button",
        role: "tab",
        "aria-selected": ui.iaasMobileSection === section.key ? "true" : "false",
        onclick: () => { ui.iaasMobileSection = section.key; renderIaas(); }
      }, [section.label])
    ));
  }

  function renderIaasInvasiveSummary(episodes = [], date = activeDate(), patientId = "") {
    const rows = [...episodes].sort((a, b) =>
      String(a.installationDate || "").localeCompare(String(b.installationDate || ""))
        || String(deviceDisplayName(a)).localeCompare(String(deviceDisplayName(b)), "es")
    );
    return h("section", { class: "iaas-panel iaas-invasive-summary top-summary" }, [
      h("div", { class: "iaas-panel-head compact" }, [
        h("div", {}, [
          h("h2", {}, ["Invasivos colocados por enfermería"]),
          h("p", {}, ["Resumen de paquetes preventivos: tipo de invasivo, instalación y retiro."])
        ]),
        h("div", { class: "iaas-panel-actions" }, [
          patientId ? h("a", { class: "iaas-button ghost compact", href: `#/ronda/${date}/paciente/${patientId}` }, ["Revisar paquetes preventivos"]) : "",
          h("span", { class: "badge device" }, [`${rows.length} invasivo(s)`])
        ])
      ]),
      rows.length ? h("div", { class: "iaas-invasive-list summary-grid" }, rows.map(ep => {
        const active = isSummaryDeviceActive(ep);
        return h("article", { class: `iaas-invasive-card ${active ? "active" : "inactive"}` }, [
          h("strong", {}, [deviceDisplayName(ep)]),
          h("span", {}, [`Instalación: ${formatDisplayDate(ep.installationDate) || "S/D"}`]),
          h("span", {}, [`Retiro: ${formatDisplayDate(ep.removalDate) || "Activo"}`])
        ]);
      })) : h("p", { class: "muted" }, ["Sin invasivos capturados por enfermería."])
    ]);
  }

  function isSummaryDeviceActive(ep = {}) {
    if (normalizeDate(ep.removalDate)) return false;
    return normalizeText(ep.status || "activo") !== "RETIRADO";
  }

  function renderIaasVitalSigns(date, patientId, assessment, hasVentilation) {
    const fields = IAAS_VITAL_FIELDS.map(([key, label]) => iaasTextInput(date, patientId, "vitalSigns", key, label, assessment.vitalSigns?.[key]));
    const ventilationFields = hasVentilation
      ? IAAS_VENTILATION_FIELDS.map(([key, label]) => iaasTextInput(date, patientId, "vitalSigns", key, label, assessment.vitalSigns?.[key]))
      : [h("p", { class: "iaas-locked-note" }, ["FiO2 y PEEP se desbloquean cuando exista ventilación activa."])];
    return h("article", { class: "iaas-assessment-block" }, [
      h("h3", {}, ["Signos vitales"]),
      h("div", { class: "iaas-field-grid" }, [
        iaasDateInput(date, patientId, "vitalSigns", "studyDate", "Fecha del estudio", assessment.vitalSigns?.studyDate || isoToday()),
        ...fields,
        ...ventilationFields
      ])
    ]);
  }

  function renderIaasCbc(date, patientId, assessment) {
    return h("article", { class: "iaas-assessment-block" }, [
      h("h3", {}, ["Biometría hemática"]),
      h("div", { class: "iaas-field-grid three" }, [
        iaasDateInput(date, patientId, "cbc", "studyDate", "Fecha del estudio", assessment.cbc?.studyDate || isoToday()),
        ...IAAS_CBC_FIELDS.map(([key, label]) => iaasTextInput(date, patientId, "cbc", key, label, assessment.cbc?.[key]))
      ])
    ]);
  }

  function renderIaasUrinalysis(date, patientId, assessment) {
    return h("article", { class: "iaas-assessment-block" }, [
      h("h3", {}, ["Examen general de orina"]),
      h("div", { class: "iaas-field-grid three" }, [
        iaasDateInput(date, patientId, "urinalysis", "studyDate", "Fecha del estudio", assessment.urinalysis?.studyDate || isoToday()),
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
        iaasDateInput(date, patientId, "otherStudies", "studyDate", "Fecha del estudio", assessment.otherStudies?.studyDate || isoToday()),
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
            h("input", { type: "date", value: normalizeDate(culture.collectionDate) || isoToday(), oninput: event => updateIaasCulture(date, patientId, index, { collectionDate: event.target.value }) })
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
            h("input", { type: "date", value: normalizeDate(treatment.startDate) || isoToday(), oninput: event => updateIaasTreatment(date, patientId, index, { startDate: event.target.value }, true) })
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
      iaasTopLevelDateInput(date, patientId, "observationsDate", "Fecha de observación", assessment.observationsDate || isoToday()),
      iaasTextareaInput(date, patientId, "observations", null, "Observaciones", assessment.observations || "", "Escribir libremente la evolución, pendientes, aclaraciones o seguimiento del día...")
    ]);
  }

  function iaasTopLevelDateInput(date, patientId, key, label, value) {
    return h("label", { class: "field" }, [
      h("span", {}, [label]),
      h("input", {
        type: "date",
        value: normalizeDate(value) || normalizeDate(date) || isoToday(),
        oninput: event => updateIaasTopLevelField(date, patientId, key, event.target.value)
      })
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
        collectionDate: isoToday(),
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
        startDate: isoToday(),
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

  function renderIaasVitalSignsChart(patient, patientId, date) {
    const saved = dailyIaasAssessmentMap(patientId);
    const dates = patientIaasDateRange(patient, date, saved);
    const series = vitalChartSeries().map(item => ({
      ...item,
      points: dates
        .map(day => {
          const raw = saved.get(day)?.vitalSigns?.[item.key];
          return { date: day, raw: cleanCell(raw), value: item.parse(raw) };
        })
        .filter(point => Number.isFinite(point.value))
    })).filter(item => item.points.length);
    if (!series.length) {
      return h("div", { class: "iaas-temperature-chart empty" }, [
        h("strong", {}, ["Grafica de signos vitales"]),
        h("span", {}, ["Sin signos vitales guardados todavia."])
      ]);
    }
    return h("div", { class: "iaas-temperature-chart vital-signs-chart" }, [
      h("div", { class: "chart-head" }, [
        h("strong", {}, ["Grafica de signos vitales"]),
        h("span", {}, ["Cada variable se muestra en su propia escala para que la tendencia sea legible."])
      ]),
      h("div", { class: "vital-trend-grid" }, series.map(item => renderVitalTrendCard(item)))
    ]);
  }

  function renderVitalTrendCard(item) {
    const width = 320;
    const height = 116;
    const left = 38;
    const right = 18;
    const top = 16;
    const bottom = 30;
    const values = item.points.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(1, max - min);
    const xForIndex = index => left + index * ((width - left - right) / Math.max(1, item.points.length - 1));
    const yForValue = value => top + ((max - value) / spread) * (height - top - bottom);
    const points = item.points.length === 1
      ? `${left},${roundForSvg(yForValue(item.points[0].value))} ${width - right},${roundForSvg(yForValue(item.points[0].value))}`
      : item.points.map((point, index) => `${roundForSvg(xForIndex(index))},${roundForSvg(yForValue(point.value))}`).join(" ");
    const latest = item.points[item.points.length - 1];
    return h("article", { class: "vital-trend-card" }, [
      h("div", { class: "vital-trend-head" }, [
        h("span", {}, [h("i", { style: `background:${item.color}` }), item.label]),
        h("strong", {}, [formatVitalValue(item, latest)])
      ]),
      h("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${item.label} ${formatVitalValue(item, latest)}` }, [
        h("line", { x1: String(left), y1: String(height - bottom), x2: String(width - right), y2: String(height - bottom), class: "trend-axis" }),
        h("text", { x: "2", y: String(top + 5), class: "axis-label" }, [formatVitalValue(item, { value: max, raw: String(max) })]),
        h("text", { x: "2", y: String(height - bottom + 4), class: "axis-label" }, [formatVitalValue(item, { value: min, raw: String(min) })]),
        h("polyline", { points, fill: "none", style: `stroke:${item.color}` }),
        ...item.points.map((point, index) => h("circle", { cx: String(roundForSvg(xForIndex(index))), cy: String(roundForSvg(yForValue(point.value))), r: "3.5", style: `fill:${item.color}` })),
        h("text", { x: String(left), y: String(height - 8), class: "axis-label" }, [formatShortDate(item.points[0].date)]),
        h("text", { x: String(width - right - 38), y: String(height - 8), class: "axis-label" }, [formatShortDate(latest.date)])
      ])
    ]);
  }

  function formatVitalValue(item, point) {
    const raw = cleanCell(point?.raw);
    if (raw && item.key === "bloodPressure") return appendUnit(raw, item.unit);
    if (raw) return appendUnit(raw, item.unit);
    const value = Number.isFinite(point?.value) ? String(point.value) : "";
    return appendUnit(value, item.unit);
  }
  function renderPatientDiagnosisSummary(date, patientId, patient) {
    const row = store.dailyCensus?.[date]?.patients?.[patientId] || {};
    const diagnoses = [];
    const seen = new Set();
    [
      ["Dx hospitalario", patient.currentDiagnosis || row.diagnosis],
      ["Dx epidemiologico", patient.epidemiologicalDiagnosis || row.epidemiologicalDiagnosis],
      ...((patient.diagnosisHistory || []).map(item => ["Historial Dx", item.value]).filter(([, value]) => cleanCell(value))),
      ["Observaciones", patient.observations || row.observations || row.notes]
    ].forEach(([label, value]) => {
      const text = cleanCell(value);
      const key = normalizeText(text);
      if (!text || seen.has(key)) return;
      seen.add(key);
      diagnoses.push([label, text]);
    });
    return diagnoses.length ? h("div", { class: "patient-diagnosis-list" }, diagnoses.map(([label, value]) =>
      h("span", {}, [h("strong", {}, [label]), cleanCell(value)])
    )) : h("div", { class: "patient-diagnosis-list empty" }, [
      h("span", {}, [h("strong", {}, ["Diagnosticos"]), "Sin diagnosticos capturados"])
    ]);
  }

  function renderPatientCultureAlerts(patientId, date) {
    const items = patientCulturePendingItems(patientId, date);
    return h("div", { class: "patient-culture-alerts" }, [
      h("strong", {}, ["Cultivos pendientes"]),
      items.length ? h("div", {}, items.map(item =>
        h("span", { class: `culture-alert-chip ${item.due ? "due" : "pending"}` }, [
          h("b", {}, [item.type]),
          `${item.due ? "Recabar resultado" : "Pendiente de resultado"} - Dia ${item.day}/${item.threshold}`
        ])
      )) : h("span", { class: "culture-alert-chip clear" }, ["Sin cultivos pendientes"])
    ]);
  }

  function patientCulturePendingItems(patientId, date) {
    const current = isoToday() || normalizeDate(date);
    return cultureTimelineItems(patientId, dailyIaasAssessmentMap(patientId))
      .filter(item => item.type && item.collectionDate && !item.resultDate && !item.microorganism)
      .map(item => {
        const day = daysBetween(item.collectionDate, current) ?? 0;
        const threshold = isBloodCulture(item.type) ? 7 : 2;
        return { ...item, day, threshold, due: day >= threshold };
      })
      .sort((a, b) => Number(b.due) - Number(a.due) || b.day - a.day || String(a.type).localeCompare(String(b.type), "es"));
  }

  function vitalChartSeries() {
    return [
      { key: "temperature", label: "Temperatura", unit: "°C", color: "#ef4444", parse: numericTemperature },
      { key: "bloodPressure", label: "Presión arterial", unit: "mm/Hg", color: "#111827", parse: numericBloodPressure },
      { key: "heartRate", label: "Frecuencia cardiaca", unit: "lpm", color: "#f97316", parse: numericPlainValue },
      { key: "respiratoryRate", label: "Frecuencia respiratoria", unit: "rpm", color: "#22c55e", parse: numericPlainValue },
      { key: "oxygenSaturation", label: "Saturación de oxígeno", unit: "%", color: "#2563eb", parse: numericPlainValue }
    ];
  }

  function roundForSvg(value) {
    return Math.round(value * 10) / 10;
  }

  function renderDailyIaasTable(patient, patientId, date) {
    const saved = dailyIaasAssessmentMap(patientId);
    const dates = patientIaasDateRange(patient, date, saved);
    const rows = dailyIaasRowsForPatient(patient, patientId, saved);
    return h("div", { class: "daily-iaas-scroll" }, [
      h("table", { class: "daily-iaas-table" }, [
        h("thead", {}, [h("tr", {}, [
          h("th", { colspan: "2", class: "daily-iaas-field-head" }, ["Campo"]),
          ...dates.map(item => h("th", {}, formatIaasColumnHeader(item, patient)))
        ])]),
        h("tbody", {}, rows.map((row, index) => {
          const previous = rows[index - 1];
          const isFirstInGroup = !previous || previous.group !== row.group;
          const rowSpan = isFirstInGroup ? rows.filter(item => item.group === row.group).length : 0;
          const groupClass = dailyIaasGroupClass(row.group);
          return h("tr", { class: `daily-iaas-row ${groupClass}` }, [
            isFirstInGroup ? h("th", { class: `daily-iaas-group ${groupClass}`, rowspan: String(rowSpan) }, [row.group]) : "",
            h("th", { class: `daily-iaas-attribute ${groupClass}` }, [row.label]),
            ...dates.map(item => {
              const value = row.getter(saved.get(item), item, saved);
              return h("td", { class: groupClass }, [value || h("span", { class: "muted" }, ["-"])]);
            })
          ]);
        }))
      ])
    ]);
  }

  function dailyIaasRowsForPatient(patient, patientId, saved) {
    const limited = isLimitedIaasAssessmentService(patient.currentService);
    const hemodialysis = isHemodialysisService(patient.currentService);
    const fieldRow = (group, label, getter) => ({ group, label, getter });
    const rows = [
      ...IAAS_VITAL_FIELDS.map(([key, label]) => fieldRow("SIGNOS VITALES", label, assessment => dailyVitalFieldValue(key, assessment?.vitalSigns?.[key]))),
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
      ...dailyCultureRows(patientId, saved),
      ...dailyTreatmentRows(patientId, saved),
      fieldRow("OBSERVACIONES IAAS", "Observaciones", assessment => dailyFieldValue(assessment?.observations))
    );
    return rows;
  }

  function dailyFieldValue(value) {
    return cleanCell(value);
  }

  function dailyVitalFieldValue(key, value) {
    const text = cleanCell(value);
    if (!text) return "";
    const units = {
      temperature: "°C",
      bloodPressure: "mm/Hg",
      heartRate: "lpm",
      respiratoryRate: "rpm",
      oxygenSaturation: "%"
    };
    return appendUnit(text, units[key]);
  }

  function appendUnit(value, unit) {
    const text = cleanCell(value);
    if (!text || !unit) return text;
    if (normalizeText(text).includes(normalizeText(unit)) || (unit === "%" && text.includes("%"))) return text;
    return unit === "%" ? `${text}%` : `${text} ${unit}`;
  }

  function dailyCultureRows(patientId, saved) {
    const rows = cultureTimelineItems(patientId, saved);
    if (!rows.length) {
      return [{ group: "CULTIVOS", label: "Cultivos", getter: assessment => summarizeCultures(assessment?.cultures) }];
    }
    return rows.map((culture, index) => ({
      group: "CULTIVOS",
      label: cultureTimelineLabel(culture, index),
      getter: (_, date) => cultureCellForDate(culture, date)
    }));
  }

  function dailyTreatmentRows(patientId, saved) {
    const rows = treatmentTimelineItems(patientId, saved);
    if (!rows.length) {
      return [{ group: "TRATAMIENTO", label: "Tratamiento", getter: assessment => summarizeTreatments(assessment?.treatments) }];
    }
    return rows.map((treatment, index) => ({
      group: "TRATAMIENTO",
      label: treatmentTimelineLabel(treatment, index),
      getter: (_, date) => treatmentCellForDate(treatment, date)
    }));
  }

  function cultureTimelineItems(patientId, saved = new Map()) {
    const map = new Map();
    dailyIaasEntries(patientId).forEach(entry => {
      normalizeIaasAssessment(entry.assessment).cultures.forEach(culture => {
        const item = normalizeCultureTimelineItem(culture, entry.date);
        if (!item.type || !item.collectionDate) return;
        const key = cultureTimelineKey(item);
        const previous = map.get(key);
        map.set(key, previous ? mergeCultureTimelineItem(previous, item) : item);
      });
    });
    [...saved.values()].forEach(assessment => {
      normalizeIaasAssessment(assessment).cultures.forEach(culture => {
        const item = normalizeCultureTimelineItem(culture, culture.collectionDate || culture.resultDate);
        if (!item.type || !item.collectionDate) return;
        const key = cultureTimelineKey(item);
        const previous = map.get(key);
        map.set(key, previous ? mergeCultureTimelineItem(previous, item) : item);
      });
    });
    return [...map.values()].sort((a, b) =>
      String(a.collectionDate).localeCompare(String(b.collectionDate))
        || String(a.type).localeCompare(String(b.type), "es")
    );
  }

  function normalizeCultureTimelineItem(culture = {}, fallbackDate = "") {
    return {
      type: cleanCell(culture.type),
      woundSite: cleanCell(culture.woundSite),
      collectionDate: normalizeDate(culture.collectionDate) || normalizeDate(fallbackDate),
      resultDate: normalizeDate(culture.resultDate),
      microorganism: cleanCell(culture.microorganism)
    };
  }

  function mergeCultureTimelineItem(previous, next) {
    return {
      ...previous,
      resultDate: next.resultDate || previous.resultDate,
      microorganism: next.microorganism || previous.microorganism,
      woundSite: next.woundSite || previous.woundSite
    };
  }

  function cultureTimelineKey(culture) {
    return [normalizeText(culture.type), normalizeText(culture.woundSite), culture.collectionDate].join("|");
  }

  function cultureTimelineLabel(culture, index) {
    const site = culture.woundSite ? ` · ${culture.woundSite}` : "";
    return cleanCell(`${culture.type || `Cultivo ${index + 1}`}${site}`);
  }

  function cultureCellForDate(culture, date) {
    const collection = normalizeDate(culture.collectionDate);
    if (!collection || date < collection) return "";
    const result = normalizeDate(culture.resultDate);
    if (result && date > result) return "";
    if (result && date === result) {
      const text = culture.microorganism ? `${culture.type}: ${culture.microorganism}` : `${culture.type}: resultado definitivo`;
      return h("span", { class: "daily-culture-result" }, [text]);
    }
    const day = daysBetween(collection, date);
    return Number.isFinite(day) ? h("span", { class: "daily-culture-pending" }, [`${culture.type} (${day})`]) : "";
  }

  function treatmentTimelineItems(patientId, saved = new Map()) {
    const map = new Map();
    dailyIaasEntries(patientId).forEach(entry => {
      normalizeIaasAssessment(entry.assessment).treatments.forEach(treatment => {
        const item = normalizeTreatmentTimelineItem(treatment, entry.date);
        if (!item.drugName || !item.startDate) return;
        const key = treatmentTimelineKey(item);
        const previous = map.get(key);
        map.set(key, previous ? mergeTreatmentTimelineItem(previous, item) : item);
      });
    });
    [...saved.values()].forEach(assessment => {
      normalizeIaasAssessment(assessment).treatments.forEach(treatment => {
        const item = normalizeTreatmentTimelineItem(treatment, treatment.startDate || treatment.endDate);
        if (!item.drugName || !item.startDate) return;
        const key = treatmentTimelineKey(item);
        const previous = map.get(key);
        map.set(key, previous ? mergeTreatmentTimelineItem(previous, item) : item);
      });
    });
    return [...map.values()].sort((a, b) =>
      String(a.startDate).localeCompare(String(b.startDate))
        || String(a.drugName).localeCompare(String(b.drugName), "es")
    );
  }

  function normalizeTreatmentTimelineItem(treatment = {}, fallbackDate = "") {
    const drugName = treatmentName(treatment);
    return {
      drug: cleanCell(treatment.drug),
      customDrug: cleanCell(treatment.customDrug),
      drugName,
      startDate: normalizeDate(treatment.startDate) || normalizeDate(fallbackDate),
      endDate: normalizeDate(treatment.endDate),
      notes: cleanCell(treatment.notes)
    };
  }

  function mergeTreatmentTimelineItem(previous, next) {
    return {
      ...previous,
      endDate: next.endDate || previous.endDate,
      notes: next.notes || previous.notes
    };
  }

  function treatmentTimelineKey(treatment) {
    return [normalizeText(treatment.drugName), treatment.startDate].join("|");
  }

  function treatmentTimelineLabel(treatment, index) {
    return treatment.drugName || `Tratamiento ${index + 1}`;
  }

  function treatmentName(treatment = {}) {
    return cleanCell(treatment.drug === "Otro" ? treatment.customDrug : treatment.drug);
  }

  function treatmentCellForDate(treatment, date) {
    const start = normalizeDate(treatment.startDate);
    if (!start || date < start) return "";
    const end = normalizeDate(treatment.endDate);
    if (end && date > end) return "";
    const day = daysBetween(start, date);
    if (!Number.isFinite(day)) return "";
    const label = `${treatment.drugName} (${day})`;
    if (end && date === end) return h("span", { class: "daily-treatment-stopped" }, [`${label} suspendido`]);
    return h("span", { class: "daily-treatment-active" }, [label]);
  }

  function dailyIaasGroupClass(group) {
    const text = normalizeText(group);
    if (text.includes("SIGNOS VITALES")) return "daily-group-vitals";
    if (text.includes("VENTILACION")) return "daily-group-ventilation";
    if (text.includes("BIOMETRIA")) return "daily-group-cbc";
    if (text.includes("ORINA")) return "daily-group-urinalysis";
    if (text.includes("OTROS")) return "daily-group-other";
    if (text.includes("CULTIVOS")) return "daily-group-cultures";
    if (text.includes("TRATAMIENTO")) return "daily-group-treatment";
    if (text.includes("OBSERVACIONES")) return "daily-group-observations";
    return "daily-group-default";
  }

  function renderIaasStudyHistory(patient, patientId) {
    const entries = dailyIaasEntries(patientId);
    const revisionEntries = iaasRevisionHistoryEntries(patientId);
    if (!entries.length && !revisionEntries.length) return "";
    return h("details", { class: "iaas-study-history" }, [
      h("summary", {}, ["Historial de estudios ingresados y ediciones"]),
      h("div", { class: "iaas-history-list" }, [
        ...entries.map(entry => renderIaasHistoryCard(patient, patientId, entry, false)),
        ...revisionEntries.map(entry => renderIaasHistoryCard(patient, patientId, entry, true))
      ])
    ]);
  }

  function renderIaasHistoryCard(patient, patientId, entry, revision) {
    const assessment = normalizeIaasAssessment(entry.assessment);
    const lines = iaasHistorySections(patient, assessment, entry.date);
    return h("article", { class: `iaas-history-card ${revision ? "revision" : ""}` }, [
      h("div", { class: "iaas-history-card-head" }, [
        h("strong", {}, [revision ? `Edicion previa - ${formatDisplayDate(entry.date) || entry.date}` : `Registro guardado - ${formatDisplayDate(entry.date) || entry.date}`]),
        entry.editedAt ? h("small", {}, [`Guardado originalmente: ${formatDateTime(entry.editedAt)}`]) : ""
      ]),
      h("ul", {}, lines.map(line => h("li", {}, [
        h("span", {}, [line.text]),
        !revision ? h("div", { class: "iaas-history-actions" }, [
          h("button", { class: "iaas-mini-action", type: "button", onclick: () => editIaasAssessmentSection(entry.date, patientId, assessment, line.key) }, ["Editar"]),
          h("button", { class: "iaas-mini-action danger", type: "button", onclick: () => deleteIaasAssessmentSection(entry.date, patientId, line.key) }, ["Eliminar"])
        ]) : ""
      ])))
    ]);
  }

  function iaasHistorySections(patient, assessment, date) {
    const limited = isLimitedIaasAssessmentService(patient.currentService);
    const hemodialysis = isHemodialysisService(patient.currentService);
    return [
      { key: "vitalSigns", text: `Signos vitales (${formatDisplayDate(assessment.vitalSigns.studyDate || date) || "sin fecha"}): ${summarizeSection(assessment.vitalSigns, [...IAAS_VITAL_FIELDS, ...IAAS_VENTILATION_FIELDS]) || "sin datos"}` },
      !limited ? { key: "cbc", text: `Biometria hematica (${formatDisplayDate(assessment.cbc.studyDate || date) || "sin fecha"}): ${summarizeSection(assessment.cbc, IAAS_CBC_FIELDS) || "sin datos"}` } : null,
      !limited ? { key: "urinalysis", text: `Examen general de orina (${formatDisplayDate(assessment.urinalysis.studyDate || date) || "sin fecha"}): ${summarizeUrinalysis(assessment.urinalysis) || "sin datos"}` } : null,
      { key: "otherStudies", text: `Otros estudios (${formatDisplayDate(assessment.otherStudies.studyDate || date) || "sin fecha"}): ${summarizeOtherStudies(assessment.otherStudies) || "sin datos"}` },
      hemodialysis ? { key: "infectionTracking", text: `Seguimiento infecciones: ${summarizeHemodialysisInfection(assessment.infectionTracking) || "sin datos"}` } : null,
      { key: "cultures", text: `Cultivos: ${summarizeCultures(assessment.cultures) || "sin datos"}` },
      { key: "treatments", text: `Tratamiento: ${summarizeTreatments(assessment.treatments) || "sin datos"}` },
      { key: "observations", text: `Observaciones IAAS (${formatDisplayDate(assessment.observationsDate || date) || "sin fecha"}): ${assessment.observations || "sin datos"}` }
    ].filter(Boolean);
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

  function editIaasAssessmentSection(date, patientId, assessment, sectionKey) {
    const draft = getReviewDraft(date, patientId, "iaas");
    draft.activeRoundSection = "iaas";
    draft.editingIaasAssessment = true;
    draft.iaasAssessment = normalizeIaasAssessment(assessment);
    setReviewDraft(date, patientId, draft);
    ui.iaasMobileSection = iaasSectionTabForHistory(sectionKey);
    flashIaas("Estudio cargado para edición.");
    renderIaas();
  }

  async function deleteIaasAssessmentSection(date, patientId, sectionKey) {
    if (!window.confirm("Eliminar esta sección del seguimiento IAAS guardado?")) return;
    const entry = store.dailyRounds?.[date]?.entries?.[patientId];
    if (!entry?.iaasAssessment) return;
    const before = clone(entry.iaasAssessment);
    const assessment = normalizeIaasAssessment(entry.iaasAssessment);
    clearIaasAssessmentSection(assessment, sectionKey);
    entry.iaasAssessmentHistory = buildIaasAssessmentHistory(entry, assessment, date);
    entry.iaasAssessment = iaasAssessmentHasContent(assessment) ? assessment : null;
    entry.iaasAssessmentUpdatedAt = nowIso();
    entry.reviewedAt = nowIso();
    entry.syncStatus = syncStatusForNewWrite();
    addAudit("IAAS_ASSESSMENT_SECTION_DELETED", { patientId, roundDate: date, before, after: entry.iaasAssessment, metadata: { sectionKey } });
    recalculateRound(date);
    saveStore();
    await enqueueWrite({ type: "roundEntry", date, patientId, entry, patient: store.patients[patientId], episodes: [] });
    clearReviewDraftAfterSave(date, patientId, "iaas");
    flashIaas("Sección eliminada del seguimiento.");
    renderIaas();
  }

  function clearIaasAssessmentSection(assessment, sectionKey) {
    const blank = defaultIaasAssessment();
    if (sectionKey === "observations") {
      assessment.observations = "";
      assessment.observationsDate = "";
      return;
    }
    if (sectionKey === "cultures" || sectionKey === "treatments") {
      assessment[sectionKey] = [];
      return;
    }
    if (blank[sectionKey]) assessment[sectionKey] = clone(blank[sectionKey]);
  }

  function iaasSectionTabForHistory(sectionKey) {
    if (sectionKey === "cultures") return "cultivos";
    if (sectionKey === "treatments") return "antibioticos";
    if (sectionKey === "observations") return "observaciones";
    if (sectionKey === "vitalSigns") return "signos";
    if (sectionKey === "cbc") return "biometria";
    if (sectionKey === "urinalysis") return "ego";
    return "otros";
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

  function dailyIaasAssessmentMap(patientId) {
    const map = new Map();
    dailyIaasEntries(patientId).forEach(entry => {
      const assessment = normalizeIaasAssessment(entry.assessment);
      mergeAssessmentByDate(map, entry.date, assessment);
      mergeAssessmentByDate(map, assessment.vitalSigns?.studyDate, { vitalSigns: assessment.vitalSigns });
      mergeAssessmentByDate(map, assessment.cbc?.studyDate, { cbc: assessment.cbc });
      mergeAssessmentByDate(map, assessment.urinalysis?.studyDate, { urinalysis: assessment.urinalysis });
      mergeAssessmentByDate(map, assessment.otherStudies?.studyDate, { otherStudies: assessment.otherStudies });
      mergeAssessmentByDate(map, assessment.infectionTracking?.assessmentDate, { infectionTracking: assessment.infectionTracking });
      mergeAssessmentByDate(map, assessment.observationsDate || entry.date, { observations: assessment.observations, observationsDate: assessment.observationsDate || entry.date });
      (assessment.cultures || []).forEach(culture => {
        mergeAssessmentByDate(map, culture.collectionDate || entry.date, { cultures: [culture] });
        if (culture.resultDate) mergeAssessmentByDate(map, culture.resultDate, { cultures: [culture] });
      });
      (assessment.treatments || []).forEach(treatment => {
        mergeAssessmentByDate(map, treatment.startDate || entry.date, { treatments: [treatment] });
        if (treatment.endDate) mergeAssessmentByDate(map, treatment.endDate, { treatments: [treatment] });
      });
    });
    return map;
  }

  function mergeAssessmentByDate(map, date, patch) {
    const key = normalizeDate(date);
    if (!key || !patch) return;
    const current = normalizeIaasAssessment(map.get(key) || {});
    const next = normalizeIaasAssessment({
      ...current,
      ...patch,
      vitalSigns: { ...current.vitalSigns, ...(patch.vitalSigns || {}) },
      cbc: { ...current.cbc, ...(patch.cbc || {}) },
      urinalysis: { ...current.urinalysis, ...(patch.urinalysis || {}) },
      otherStudies: { ...current.otherStudies, ...(patch.otherStudies || {}) },
      infectionTracking: { ...current.infectionTracking, ...(patch.infectionTracking || {}) },
      cultures: [...(current.cultures || []), ...(patch.cultures || [])],
      treatments: [...(current.treatments || []), ...(patch.treatments || [])],
      observationsDate: patch.observationsDate || current.observationsDate,
      observations: cleanCell(patch.observations) || current.observations
    });
    map.set(key, next);
  }

  function patientIaasDateRange(patient, date, saved = new Map()) {
    const start = normalizeDate(patient.admissionDate) || normalizeDate(date) || isoToday();
    const studyDates = [...saved.keys()].filter(Boolean).sort();
    const end = [normalizeDate(date), isoToday(), ...studyDates].filter(Boolean).sort().at(-1) || isoToday();
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) return unique([...(studyDates || []), end]).sort();
    const out = studyDates.filter(item => item < start);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) out.push(toIsoDate(d));
    return unique(out).sort();
  }

  function formatIaasColumnHeader(date, patient) {
    const admission = normalizeDate(patient.admissionDate);
    const day = admission && date >= admission ? daysBetween(admission, date) : null;
    return [
      h("span", {}, [formatDisplayDate(date)]),
      h("small", {}, [day === null ? "Estudio previo" : `D${day}`])
    ];
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

  function numericPlainValue(value) {
    const match = String(value || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function numericBloodPressure(value) {
    const text = cleanCell(value).replace(",", ".");
    const match = text.match(/(\d{2,3})(?:\s*\/\s*(\d{2,3}))?/);
    return match ? Number(match[1]) : NaN;
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
    const start = normalizeDate(treatment.startDate) || isoToday();
    if (!start) return "";
    const end = normalizeDate(treatment.endDate) || isoToday() || normalizeDate(fallbackDate);
    const days = daysBetween(start, end) ?? 0;
    return `Día ${days}`;
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

  function renderActiveDevice(ep, draft, date) {
    const removalDraft = draft.removals?.[ep.episodeId] || "";
    const removed = Boolean(removalDraft || ep.removalDate);
    const endDate = removalDraft || ep.removalDate || "";
    const days = invasiveDays(ep, date, removalDraft);
    return h("article", { class: `device-card compact-device-card ${removed ? "removed" : "active"}` }, [
      h("strong", {}, [deviceDisplayName(ep)]),
      h("span", {}, [`French: ${ep.french || ep.deviceFrench || "S/D"}`]),
      h("span", {}, [`Instalación: ${formatDisplayDate(ep.installationDate) || "S/D"}`]),
      h("span", {}, [`Retiro: ${formatDisplayDate(endDate) || "Activo"}`]),
      h("em", {}, [`${days} día${days === 1 ? "" : "s"}`]),
      h("label", { class: "field compact-date" }, [
        h("span", {}, ["Fecha de retiro"]),
        h("input", {
          type: "date",
          value: removalDraft || normalizeDate(ep.removalDate) || "",
          oninput: event => updateRemovalDraft(draft, ep.episodeId, event.target.value),
          onchange: () => renderIaas()
        })
      ])
    ]);
  }

  function renderDeviceDraft(date, patientId, device, index) {
    const update = (patch, rerender = true) => updateDeviceDraft(date, patientId, index, patch, rerender);
    const packageType = device.packageType || device.deviceType;
    const checks = PREVENTIVE_CHECKS[packageType] || [];
    return h("article", { class: `device-draft package-draft ${riskClass(packageType)}` }, [
      h("div", { class: "device-draft-head" }, [
        h("div", {}, [
          h("strong", {}, [packageType]),
          h("span", {}, [packageCreatesDevice(device) ? "Registro de invasivo y paquete preventivo" : "Registro de paquete preventivo"])
        ]),
        h("button", { class: "icon-text", onclick: () => removeDeviceDraft(date, patientId, index) }, ["Quitar"])
      ]),
      renderPackageSpecificFields(date, patientId, device, index),
      checks.length ? h("div", { class: "preventive-check-grid" }, checks.map(([key, label]) =>
        renderCheckSelector(label, device.preventiveChecks?.[key], value => update({ preventiveChecks: { ...(device.preventiveChecks || {}), [key]: value } }))
      )) : "",
      packageType === "NAVM" ? renderButtonGroup("Método higiene oral", NAVM_ORAL_HYGIENE_TYPES, device.oralHygieneMethod, value => update({ oralHygieneMethod: value })) : "",
      checks.length ? h("div", { class: "compliance-box" }, [
        h("span", {}, ["% cumplimiento"]),
        h("strong", {}, [preventiveCompliance(device.preventiveChecks || {}) || "Pendiente"])
      ]) : "",
      h("label", { class: "field full" }, [
        h("span", {}, ["Observaciones"]),
        h("textarea", { value: device.observations || "", oninput: event => update({ observations: event.target.value }, false) })
      ])
    ]);
  }

  function renderPackageSpecificFields(date, patientId, device, index) {
    const update = (patch, rerender = true) => updateDeviceDraft(date, patientId, index, patch, rerender);
    const type = device.packageType || "";
    if (type === "ITS - CC") {
      return h("div", { class: "package-fields" }, [
        renderButtonGroup("Tipo de invasivo", ITS_DEVICE_TYPES, device.deviceType, value => update({ deviceType: value, deviceSubtype: value === "CATT HD" ? device.deviceSubtype : "" })),
        device.deviceType === "CATT HD" ? renderButtonGroup("Tipo CATT HD", ["PERMACATH", "MAHURKAR"], device.deviceSubtype, value => update({ deviceSubtype: value })) : "",
        renderButtonGroup("French", FRENCH_OPTIONS, device.french, value => update({ french: value })),
        renderPackageDates(device, update, true)
      ]);
    }
    if (type === "ITU - CU") {
      return h("div", { class: "package-fields" }, [
        renderButtonGroup("Tipo de material", ITU_MATERIAL_TYPES, device.material, value => update({ material: value })),
        renderButtonGroup("Estado", ITU_DEVICE_STATES, device.deviceState, value => update({ deviceState: value })),
        renderButtonGroup("French", FRENCH_OPTIONS, device.french, value => update({ french: value })),
        renderPackageDates(device, update, true)
      ]);
    }
    if (type === "NAVM") {
      return h("div", { class: "package-fields" }, [
        renderButtonGroup("Tipo de dispositivo", NAVM_DEVICE_TYPES, device.deviceType, value => update({ deviceType: value })),
        renderButtonGroup("French", FRENCH_OPTIONS, device.french, value => update({ french: value })),
        renderPackageDates(device, update, true)
      ]);
    }
    if (type === "ESPECIAL") {
      return h("div", { class: "package-fields" }, [
        renderButtonGroup("Invasivo especial", SPECIAL_DEVICE_TYPES, device.deviceType, value => update({ deviceType: value })),
        renderPackageDates(device, update, true)
      ]);
    }
    return h("div", { class: "package-fields" }, [
      renderPackageDates(device, update, false)
    ]);
  }

  function renderPackageDates(device, update, showInstallation) {
    return h("div", { class: "form-grid compact package-date-grid" }, [
      showInstallation ? h("label", { class: "field" }, [
        h("span", {}, ["Fecha de instalación"]),
        h("input", { type: "date", value: normalizeDate(device.installationDate) || "", oninput: event => update({ installationDate: event.target.value }, false) })
      ]) : "",
      showInstallation ? h("label", { class: "field" }, [
        h("span", {}, ["Fecha de retiro"]),
        h("input", { type: "date", value: normalizeDate(device.removalDate) || "", oninput: event => update({ removalDate: event.target.value }, false) })
      ]) : ""
    ]);
  }

  function renderCheckSelector(label, value, onSelect) {
    return h("div", { class: "check-selector" }, [
      h("span", {}, [label]),
      h("div", { class: "button-segment" }, YES_NO_NA.map(item =>
        h("button", {
          type: "button",
          class: normalizeText(value) === normalizeText(item) ? "active" : "",
          onclick: () => onSelect(item)
        }, [item])
      ))
    ]);
  }

  function renderButtonGroup(label, values, value, onSelect) {
    return h("div", { class: "button-group-field" }, [
      h("span", {}, [label]),
      h("div", { class: "button-chip-row" }, values.map(item =>
        h("button", {
          type: "button",
          class: normalizeText(value) === normalizeText(item) ? "selected" : "",
          onclick: () => onSelect(item)
        }, [item])
      ))
    ]);
  }

  function renderPatientFollowUp(patientId) {
    const patient = store.patients[patientId];
    if (!patient) return renderNotFound("Paciente no encontrado.");
    const episodes = episodesForPatient(patientId).sort((a, b) => String(a.installationDate).localeCompare(String(b.installationDate)));
    const entries = patientRoundHistoryEntries(patientId);
    const censusRows = patientCensusHistoryRows(patientId);
    const isDischarged = isArchivedPatientStatus(patient.hospitalizationStatus);
    const dischargeText = dischargePrintTextFor({ patient, row: censusRows.at(-1)?.row || {} });
    return h("div", { class: "iaas-page follow-page expediente-page" }, [
      h("section", { class: `iaas-panel follow-hero expediente-hero ${isDischarged ? "archived" : ""}` }, [
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

  function renderPatientExpediente(patientId) {
    const patient = store.patients[patientId];
    if (!patient) return renderNotFound("Paciente no encontrado.");
    const episodes = episodesForPatient(patientId).sort((a, b) => String(a.installationDate).localeCompare(String(b.installationDate)));
    const entries = patientRoundHistoryEntries(patientId);
    const censusRows = patientCensusHistoryRows(patientId);
    const latest = censusRows.at(-1)?.row || {};
    const archived = isArchivedPatientStatus(patient.hospitalizationStatus);
    const dischargeText = dischargePrintTextFor({ patient, row: latest });
    return h("div", { class: "iaas-page expediente-page" }, [
      h("section", { class: `iaas-panel follow-hero expediente-hero ${archived ? "archived" : ""}` }, [
        h("div", {}, [
          h("h1", {}, [`Expediente · ${patientLabel(patient, latest)}`]),
          h("p", {}, [`${patient.currentService || latest.service || "Sin servicio"} · Cama ${patient.currentBed || latest.bed || "S/C"} · Ingreso ${patient.admissionDate || latest.admissionDate || "NA"}`]),
          h("div", { class: "expediente-status-row" }, [
            h("span", { class: `badge ${archived ? "warning" : "ok"}` }, [patientStatusLabel(patient)]),
            dischargeText ? h("span", { class: "badge neutral" }, [truncateText(dischargeText, 110)]) : ""
          ])
        ]),
        h("div", { class: "report-actions" }, [
          h("a", { class: "iaas-button ghost", href: "#/censo-hospitalario" }, ["Volver al censo"]),
          h("button", { class: "iaas-button", onclick: () => printPatientExpediente(patientId) }, ["Imprimir expediente"])
        ])
      ]),
      renderMetricGrid([
        ["Estancia", daysBetween(patient.admissionDate || latest.admissionDate, patient.dischargeDate || latest.dischargeDate || isoToday()) ?? "NA", "dias"],
        ["Censos", censusRows.length, "historico"],
        ["Rondas", entries.length, "registradas"],
        ["Episodios", episodes.length, "invasivos"],
        ["Invasivos activos", activeEpisodes(patientId, isoToday()).length, "actual"]
      ], "compact"),
      renderPatientExpedienteSummary(patient, latest),
      h("section", { class: "iaas-grid two" }, [
        h("article", { class: "iaas-panel" }, [
          h("h2", {}, ["Linea de tiempo de invasivos"]),
          renderDeviceTimeline(episodes)
        ]),
        h("article", { class: "iaas-panel" }, [
          h("h2", {}, ["Estado por ronda"]),
          renderRoundTimeline(entries)
        ])
      ]),
      renderPatientCensusHistoryTable(censusRows),
      renderPatientRoundHistoryTable(entries),
      renderPatientDeviceHistoryTable(episodes),
      renderExpedienteIaasSection(patient, patientId, patient.dischargeDate || latest.dischargeDate || isoToday()),
      renderExpedienteRawData(patient, censusRows, entries, episodes)
    ]);
  }

  function printPatientExpediente(patientId) {
    location.hash = `#/pacientes/${patientId}/expediente`;
    setTimeout(() => window.print(), 80);
  }

  function isArchivedPatientStatus(status) {
    return ["alta_probable", "alta_reportada", "egresado", "traslado_probable", "defunciÃ³n_probable", "defunción_probable"].includes(status);
  }

  function patientStatusLabel(patient = {}) {
    const labels = {
      hospitalizado: "Hospitalizado",
      alta_probable: "Alta probable",
      alta_reportada: "Alta reportada",
      egresado: "Egresado",
      traslado_probable: "Traslado probable",
      "defunciÃ³n_probable": "Defuncion probable",
      "defunción_probable": "Defuncion probable",
      "requiere_conciliaciÃ³n": "Requiere conciliacion",
      "requiere_conciliación": "Requiere conciliacion"
    };
    return labels[patient.hospitalizationStatus] || patient.hospitalizationStatus || "Sin estado";
  }

  function dischargeTypeLabel(type) {
    const value = cleanCell(type);
    if (!value) return "Pendiente";
    const found = DISCHARGE_TYPES.find(item => item.value === value || normalizeText(item.label) === normalizeText(value));
    return found?.label || value;
  }

  function patientCensusHistoryRows(patientId) {
    return Object.entries(store.dailyCensus || {})
      .flatMap(([date, census]) => {
        const row = census.patients?.[patientId];
        return row ? [{ date, row }] : [];
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function patientRoundHistoryEntries(patientId) {
    return Object.entries(store.dailyRounds || {})
      .flatMap(([date, round]) => {
        const entry = round.entries?.[patientId];
        return entry ? [{ ...entry, roundDate: entry.roundDate || date }] : [];
      })
      .sort((a, b) => String(a.roundDate).localeCompare(String(b.roundDate)));
  }

  function renderPatientExpedienteSummary(patient, latest = {}) {
    const rows = [
      ["Nombre", patientLabel(patient, latest)],
      ["Servicio actual/ultimo", patient.currentService || latest.service || "Sin servicio"],
      ["Cama actual/ultima", patient.currentBed || latest.bed || "S/C"],
      ["Fecha de ingreso", patient.admissionDate || latest.admissionDate || "NA"],
      ["Fecha de alta", patient.dischargeDate || latest.dischargeDate || "Pendiente"],
      ["Causa de alta", dischargeTypeLabel(patient.dischargeType || latest.dischargeType)],
      ["Turno de alta", patient.dischargeShift || latest.dischargeShift || "Pendiente"],
      ["Edad / sexo", `${patient.age ?? latest.age ?? "S/E"} / ${patient.sex || latest.sex || "S/S"}`],
      ["Sector", patient.sector || latest.sector || "Sin sector"],
      ["RFC / ID", patient.rfc || patient.hospitalInternalId || latest.rfc || patient.patientId],
      ["Estado clinico", patient.currentState || latest.state || "Sin estado"],
      ["Dx hospitalario", patient.currentDiagnosis || latest.diagnosis || "Sin diagnostico"],
      ["Dx epidemiologico", patient.epidemiologicalDiagnosis || latest.epidemiologicalDiagnosis || "Sin clasificar"],
      ["Observaciones", patient.observations || latest.observations || latest.notes || "Sin observaciones"]
    ];
    return h("section", { class: "iaas-panel expediente-summary-panel" }, [
      h("h2", {}, ["Datos completos del paciente"]),
      h("div", { class: "expediente-data-grid" }, rows.map(([label, value]) =>
        h("div", { class: "expediente-data-item" }, [
          h("span", {}, [label]),
          h("strong", {}, [String(value || "NA")])
        ])
      ))
    ]);
  }

  function renderPatientCensusHistoryTable(rows) {
    return h("section", { class: "iaas-panel expediente-history-panel" }, [
      h("h2", {}, ["Historial de censos"]),
      rows.length ? h("div", { class: "table-wrap" }, [
        h("table", { class: "iaas-table compact" }, [
          h("thead", {}, [h("tr", {}, ["Fecha", "Servicio", "Cama", "Presente", "Estado", "Diagnostico", "Notas"].map(label => h("th", {}, [label])))]),
          h("tbody", {}, rows.map(({ date, row }) => h("tr", {}, [
            h("td", {}, [date]),
            h("td", {}, [row.service || "Sin servicio"]),
            h("td", {}, [row.bed || "S/C"]),
            h("td", {}, [row.present === false ? "No" : "Si"]),
            h("td", {}, [row.probableDischarge ? "Alta probable" : row.reviewStatus || row.dischargeStatus || "Activo"]),
            h("td", {}, [truncateText(row.diagnosis || row.epidemiologicalDiagnosis || "", 120)]),
            h("td", {}, [truncateText(row.notes || row.observations || "", 160)])
          ])))
        ])
      ]) : h("p", { class: "muted" }, ["Sin censos guardados para este paciente."])
    ]);
  }

  function renderPatientRoundHistoryTable(entries) {
    return h("section", { class: "iaas-panel expediente-history-panel" }, [
      h("h2", {}, ["Historial de rondas y alertas"]),
      entries.length ? h("div", { class: "table-wrap" }, [
        h("table", { class: "iaas-table compact" }, [
          h("thead", {}, [h("tr", {}, ["Fecha", "Servicio", "Cama", "Estado", "Alertas", "Notas"].map(label => h("th", {}, [label])))]),
          h("tbody", {}, entries.map(entry => h("tr", {}, [
            h("td", {}, [entry.roundDate || "NA"]),
            h("td", {}, [entry.service || "Sin servicio"]),
            h("td", {}, [entry.bed || "S/C"]),
            h("td", {}, [statusLabel(entry.status)]),
            h("td", {}, [truncateText((entry.alertsGenerated || []).join(" · "), 170)]),
            h("td", {}, [truncateText(entry.notes || "", 170)])
          ])))
        ])
      ]) : h("p", { class: "muted" }, ["Sin rondas guardadas para este paciente."])
    ]);
  }

  function renderPatientDeviceHistoryTable(episodes) {
    return h("section", { class: "iaas-panel expediente-history-panel" }, [
      h("h2", {}, ["Episodios de dispositivos"]),
      episodes.length ? h("div", { class: "table-wrap" }, [
        h("table", { class: "iaas-table compact" }, [
          h("thead", {}, [h("tr", {}, ["Tipo", "Instalacion", "Retiro", "Estado", "Reinstalacion", "Cuidado"].map(label => h("th", {}, [label])))]),
          h("tbody", {}, episodes.map(ep => h("tr", {}, [
            h("td", {}, [ep.deviceType]),
            h("td", {}, [ep.installationDate || "Datos incompletos"]),
            h("td", {}, [ep.removalDate || "Activo"]),
            h("td", {}, [ep.status || "Activo"]),
            h("td", {}, [ep.isReinstallation ? "Si" : "No"]),
            h("td", {}, [careLabel(ep.careStatus)])
          ])))
        ])
      ]) : h("p", { class: "muted" }, ["No hay episodios capturados."])
    ]);
  }

  function renderExpedienteIaasSection(patient, patientId, date) {
    const loaded = Boolean(ui.expedienteIaasLoaded?.[patientId]);
    return h("section", { class: "iaas-panel expediente-detail-panel" }, [
      h("div", { class: "iaas-panel-head" }, [
        h("div", {}, [
          h("h2", {}, ["Seguimiento IAAS diario"]),
          h("p", { class: "muted" }, ["Tabla extensa cargada bajo demanda para mantener rapido el expediente y el censo."])
        ]),
        loaded ? h("button", {
          class: "iaas-button ghost",
          onclick: () => {
            ui.expedienteIaasLoaded[patientId] = false;
            renderIaas();
          }
        }, ["Ocultar tabla"]) : h("button", {
          class: "iaas-button",
          onclick: () => {
            ui.expedienteIaasLoaded[patientId] = true;
            renderIaas();
          }
        }, ["Cargar tabla"])
      ]),
      loaded ? renderDailyIaasTable(patient, patientId, date) : h("p", { class: "muted" }, ["El expediente ya conserva los datos. Carga la tabla solo cuando necesites revisar el seguimiento diario completo."])
    ]);
  }

  function renderExpedienteRawData(patient, censusRows, entries, episodes) {
    const patientId = patient.patientId;
    const loaded = Boolean(ui.expedienteRawLoaded?.[patientId]);
    return h("section", { class: "iaas-panel expediente-raw-panel" }, [
      h("div", { class: "iaas-panel-head" }, [
        h("div", {}, [
          h("h2", {}, ["Datos tecnicos completos conservados"]),
          h("p", { class: "muted" }, ["Vista de auditoria bajo demanda. No se construye al abrir el censo ni al abrir el expediente inicial."])
        ]),
        loaded ? h("button", {
          class: "iaas-button ghost",
          onclick: () => {
            ui.expedienteRawLoaded[patientId] = false;
            renderIaas();
          }
        }, ["Ocultar datos"]) : h("button", {
          class: "iaas-button",
          onclick: () => {
            ui.expedienteRawLoaded[patientId] = true;
            renderIaas();
          }
        }, ["Cargar datos tecnicos"])
      ]),
      loaded ? h("pre", {}, [JSON.stringify({ paciente: patient, censos: censusRows, rondas: entries, dispositivos: episodes }, null, 2)]) : h("p", { class: "muted" }, ["Los datos completos estan conservados. Cargalos solo si necesitas auditoria tecnica o exportacion manual."])
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
      .filter(patient => ["requiere_conciliación", "alta_probable", "alta_reportada"].includes(patient.hospitalizationStatus))
      .slice(0, 12);
    if (!rows.length) return h("p", { class: "muted" }, ["No hay pacientes pendientes de conciliación."]);
    return h("div", { class: "reconciliation-list" }, rows.map(patient =>
      h("article", { class: "reconciliation-card" }, [
        h("div", {}, [
          h("strong", {}, [patientLabel(patient)]),
          h("span", {}, [`${patient.currentService} · Cama ${patient.currentBed}`]),
          h("small", {}, ["No encontrado en censo activo"])
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
    const mode = document.querySelector("#import-mode")?.value || ui.importMode || "auto";
    ui.importDate = date;
    ui.importMode = mode;
    if (!text) {
      flashIaas("Archivo o tabla vacía.");
      return;
    }
    ui.importProgress = "Validando...";
    renderIaas();
    await waitFrame();
    const parsedRows = parseDelimitedText(text, date);
    ui.importDraft = buildImportDraft(parsedRows, date, { mode });
    ui.importProgress = "";
    renderIaas();
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const date = document.querySelector("#import-date")?.value || ui.importDate || isoToday();
    const mode = document.querySelector("#import-mode")?.value || ui.importMode || "auto";
    ui.importDate = date;
    ui.importMode = mode;
    ui.importProgress = "Leyendo archivo...";
    renderIaas();
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const rows = await parseXlsx(file, date);
        ui.importDraft = buildImportDraft(rows, date, { mode });
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        const text = await file.text();
        ui.importText = text;
        ui.importDraft = buildImportDraft(parseDelimitedText(text, date), date, { mode });
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

  async function parseXlsx(file, fallbackDate = "") {
    await loadSheetJs();
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    return rowsFromMatrix(matrix, fallbackDate);
  }

  function rowsFromMatrix(matrix, fallbackDate = "") {
    const rows = (matrix || []).filter(row => Array.isArray(row) && row.some(cell => cleanCell(cell)));
    if (!rows.length) return [];
    const headerIndex = rows.findIndex(row => looksLikeImportHeader(row.map(cleanCell)));
    const hasHospitalLayout = rows.some(row => looksLikeHospitalCensusHeader(row.map(cleanCell)));
    if (headerIndex < 0 || hasHospitalLayout) return rowsFromHeaderlessMatrix(rows, fallbackDate);
    const startIndex = headerIndex;
    const headers = rows[startIndex].map(header => cleanCell(header));
    return rows.slice(startIndex + 1).map(cells => {
      const row = {};
      headers.forEach((header, index) => row[header] = cells[index] ?? "");
      return row;
    });
  }

  function rowsFromHeaderlessMatrix(matrix, fallbackDate = "") {
    const out = [];
    let currentService = "";
    let currentDate = normalizeDate(fallbackDate) || "";
    (matrix || []).forEach((sourceRow, index) => {
      const cells = sourceRow.map(cleanCell);
      const nonEmpty = cells.filter(Boolean);
      if (!nonEmpty.length) return;
      const serviceInRow = serviceFromHospitalHeader(cells);
      const dateInRow = censusDateFromRow(cells);
      if (serviceInRow) currentService = serviceInRow;
      if (dateInRow && !normalizeDate(fallbackDate)) currentDate = dateInRow;
      if (isHospitalCensusGuideRow(cells)) return;
      const singleService = nonEmpty.length <= 2 ? knownServiceFromText(nonEmpty.join(" ")) : "";
      if (singleService && !looksLikeBedCell(nonEmpty[0]) && !looksLikePatientNameCell(nonEmpty[0])) {
        currentService = singleService;
        return;
      }
      const row = headerlessRowToObject(cells, currentService, currentDate);
      if (row) {
        row.__source_row = String(index + 1);
        out.push(row);
      }
    });
    return out;
  }

  function headerlessRowToObject(cells, currentService = "", currentDate = "") {
    const values = cells.map(cleanCell);
    const nonEmpty = values.filter(Boolean);
    if (nonEmpty.length < 2 || isHospitalCensusGuideRow(values)) return null;
    const serviceBedIndex = values.findIndex(value => {
      if (normalizeDate(value)) return false;
      const item = splitServiceBed(value);
      return Boolean(item.bed && knownServiceFromText(item.service));
    });
    const serviceIndex = values.findIndex((value, index) => {
      const key = normalizeText(value);
      return /\bSERVICIO\b/.test(key) || (index <= 1 && knownServiceFromText(value) && !looksLikeBedCell(value));
    });
    const explicitBedIndex = values.findIndex(looksLikeBedCell);
    const bedIndex = explicitBedIndex >= 0 ? explicitBedIndex : serviceBedIndex;
    const patientIndex = findPatientNameIndex(values, bedIndex, serviceIndex);
    const serviceBed = serviceBedIndex >= 0 ? splitServiceBed(values[serviceBedIndex]) : { service: "", bed: "" };
    const service = (serviceIndex >= 0 ? knownServiceFromText(values[serviceIndex]) : "") || knownServiceFromText(serviceBed.service) || serviceFromBedCell(values[bedIndex]) || currentService;
    if (patientIndex < 0 && bedIndex < 0) return null;

    const row = {};
    const first = nonEmpty[0] || "";
    const second = nonEmpty[1] || "";
    if (knownServiceFromText(first) && looksLikeBedCell(second) && patientIndex < 0) {
      row.Servicio = knownServiceFromText(first);
      row.Cama = second;
      row.Paciente = nonEmpty[2] || "";
      row.Sector = nonEmpty[3] || "";
      row.Edad = nonEmpty[4] || "";
      row.Sexo = nonEmpty[5] || "";
      row.Ingreso = nonEmpty[6] || "";
      row.Estado = nonEmpty[7] || "";
      row["Dx hospitalario"] = nonEmpty[8] || "";
      row.Observaciones = nonEmpty.slice(9).join(" / ");
      return row;
    }
    if ((knownServiceFromText(first) || splitServiceBed(first).bed) && patientIndex < 0) {
      const serviceBed = splitServiceBed(first);
      row["Servicio/Cama"] = serviceBed.bed ? first : `${knownServiceFromText(first) || first} / ${second}`;
      row.Paciente = serviceBed.bed ? second : nonEmpty[2] || "";
      row.Sector = serviceBed.bed ? nonEmpty[2] || "" : nonEmpty[3] || "";
      row.Edad = serviceBed.bed ? nonEmpty[3] || "" : nonEmpty[4] || "";
      row.Sexo = serviceBed.bed ? nonEmpty[4] || "" : nonEmpty[5] || "";
      row.Ingreso = serviceBed.bed ? nonEmpty[5] || "" : nonEmpty[6] || "";
      row.Estado = serviceBed.bed ? nonEmpty[6] || "" : nonEmpty[7] || "";
      row["Dx hospitalario"] = serviceBed.bed ? nonEmpty[7] || "" : nonEmpty[8] || "";
      row.Observaciones = (serviceBed.bed ? nonEmpty.slice(8) : nonEmpty.slice(9)).join(" / ");
      return row;
    }
    if (patientIndex >= 0) {
      const entries = values.map((value, index) => ({ value, index })).filter(item => item.value);
      const rfc = entries.find(item => looksLikeRfcCell(item.value));
      const sex = entries.find(item => looksLikeSexCell(item.value));
      const dates = entries
        .map(item => ({ ...item, iso: normalizeDate(item.value) }))
        .filter(item => item.iso);
      const birth = selectBirthDate(dates, currentDate);
      const admission = selectAdmissionDate(dates, birth, currentDate);
      const age = selectAgeValue(entries, birth, currentDate, sex?.index);
      const sector = entries.find(item => looksLikeSectorCell(item.value));
      const state = entries.find(item => looksLikeStateCell(item.value));
      const observations = entries
        .filter(item => isObservationCandidate(item.value, item.index, values.length))
        .map(item => normalizeObservationText(item.value));
      const observationIndexes = observations
        .map(text => values.findIndex(value => normalizeObservationText(value) === text))
        .filter(index => index >= 0);
      const used = new Set([
        serviceIndex,
        bedIndex,
        patientIndex,
        rfc?.index,
        sex?.index,
        birth?.index,
        admission?.index,
        age?.index,
        sector?.index,
        state?.index,
        ...observationIndexes
      ].filter(index => index >= 0));
      const diagnosisParts = entries
        .filter(item => !used.has(item.index))
        .filter(item => isHospitalDiagnosisCandidate(item.value))
        .map(item => item.value);
      row.Fecha_censo = currentDate || "";
      row.Servicio = service;
      row.Cama = serviceBed.bed || (bedIndex >= 0 ? values[bedIndex] : "");
      row.Paciente = values[patientIndex];
      row.RFC = rfc?.value || "";
      row["Fecha nacimiento"] = birth?.iso || "";
      row.Sector = sector?.value || "";
      row.Edad = age?.value || "";
      row.Sexo = sex?.value || "";
      row.Ingreso = admission?.iso || "";
      row.Estado = state?.value || "";
      row["Dx hospitalario"] = unique(diagnosisParts).join(" / ");
      row.Observaciones = unique(observations).join(" / ");
      return row;
    }
    return null;
  }

  function looksLikeHospitalCensusHeader(cells) {
    const text = normalizeText((cells || []).map(cleanCell).filter(Boolean).join(" "));
    if (!text) return false;
    const hasPatientHeader = /\bNOMBRE\b.*\bPACIENTE\b/.test(text);
    const hasHospitalMarkers = /\bSERVICIO\s*:|\bGUARDIA\b|\bHORA\b|\bFECHA\s+INGRESO\b|\bESPECIALIDAD\b|\bMEDICO\b|\bPENDIENTES\b|\bE\s*C\s*D\b/.test(text);
    return hasPatientHeader && hasHospitalMarkers;
  }

  function isHospitalCensusGuideRow(cells) {
    const values = (cells || []).map(cleanCell).filter(Boolean);
    if (!values.length) return true;
    const text = normalizeText(values.join(" "));
    if (looksLikeHospitalCensusHeader(values)) return true;
    if (/\b(NOMBRE\s+DEL\s+PACIENTE|FECHA\s+INGRESO|GUARDIA|ESPECIALIDAD|MEDICO|PENDIENTES|E\s*C\s*D|RESUMENES|RESÚMENES|INGRESOS|GRAVES)\b/.test(text)) return true;
    if (/\.(DOCX?|XLSX?|PDF|CSV|TXT)\b/.test(text)) return true;
    if (values.length <= 3 && values.some(value => knownServiceFromText(value)) && !values.some(looksLikePatientNameCell)) return true;
    return false;
  }

  function serviceFromHospitalHeader(cells) {
    const values = (cells || []).map(cleanCell).filter(Boolean);
    const explicit = values.find(value => /\bSERVICIO\b/i.test(value) && knownServiceFromText(value));
    if (explicit) return knownServiceFromText(explicit);
    if (looksLikeHospitalCensusHeader(values)) {
      return knownServiceFromText(values.join(" "));
    }
    if (values.length <= 3) return knownServiceFromText(values.join(" "));
    return "";
  }

  function censusDateFromRow(cells) {
    const values = (cells || []).map(cleanCell).filter(Boolean);
    if (!values.some(value => /\b(SERVICIO|CENSO|FECHA)\b/i.test(value))) return "";
    return values.map(normalizeDate).find(Boolean) || "";
  }

  function findPatientNameIndex(values, bedIndex, serviceIndex) {
    const blocked = new Set([bedIndex, serviceIndex].filter(index => index >= 0));
    const start = bedIndex >= 0 ? bedIndex + 1 : 0;
    const afterBed = values.findIndex((value, index) => index >= start && !blocked.has(index) && looksLikePatientNameCell(value));
    if (afterBed >= 0) return afterBed;
    return values.findIndex((value, index) => !blocked.has(index) && looksLikePatientNameCell(value));
  }

  function looksLikeRfcCell(value) {
    const text = normalizeText(value).replace(/\s+/g, "");
    return /^[A-ZÑ&]{3,5}\d{6}-?[A-Z0-9]{1,4}$/.test(text);
  }

  function looksLikeSexCell(value) {
    return ["M", "F", "MASCULINO", "FEMENINO", "HOMBRE", "MUJER"].includes(normalizeText(value));
  }

  function looksLikeSectorCell(value) {
    return Boolean(normalizeSectorImport(value));
  }

  function looksLikeStateCell(value) {
    const key = normalizeText(value);
    return STATE_OPTIONS.some(option => normalizeText(option) === key)
      || ["ESTABLE", "DELICADO", "GRAVE", "CRITICO", "CRÍTICO"].includes(key);
  }

  function selectBirthDate(dates, censusDate) {
    if (!dates.length) return null;
    const censusYear = Number((normalizeDate(censusDate) || isoToday()).slice(0, 4));
    const likelyBirth = dates.find(item => Number(item.iso.slice(0, 4)) <= censusYear - 1);
    return likelyBirth || (dates.length > 1 ? dates[0] : null);
  }

  function selectAdmissionDate(dates, birth, censusDate) {
    if (!dates.length) return null;
    const census = normalizeDate(censusDate) || isoToday();
    const candidates = dates.filter(item => item.index !== birth?.index);
    return candidates.find(item => item.iso <= census) || candidates[0] || null;
  }

  function selectAgeValue(entries, birth, censusDate, sexIndex) {
    const candidates = entries
      .map(item => ({ ...item, value: normalizeImportAge(item.value) }))
      .filter(item => item.value !== "");
    if (!candidates.length && birth?.iso) {
      const years = ageFromBirthDate(birth.iso, censusDate);
      return years === null ? null : { value: years, index: -1 };
    }
    const nearBirth = birth ? candidates.find(item => item.index > birth.index && item.index <= birth.index + 3) : null;
    if (nearBirth) return nearBirth;
    const beforeSex = Number.isFinite(sexIndex) ? candidates.filter(item => item.index < sexIndex).at(-1) : null;
    return beforeSex || candidates[0] || null;
  }

  function isObservationCandidate(value, index, totalCells) {
    const text = normalizeText(value);
    if (!text || looksLikeRfcCell(value) || looksLikeSexCell(value) || looksLikeSectorCell(value) || normalizeDate(value)) return false;
    if (/^(DR|DRA|DR\.|DRA\.)\b/.test(text) || isSpecialtyOnlyCell(text)) return false;
    if (/^(SP|S\/P|S P|NA|N\/A|PENDIENTE)$/.test(text)) return true;
    if (/\b(CITA|PROGRAMAR|VALORACION|VALORACIÓN|LABORATORIO|PENDIENTE|VIGILAR|PROCEDIMIENTO|CONSULTA|ARCO EN C|PREALTA|GUARDIA|CIRUGIA\s+MA[NÑ]ANA)\b/.test(text)) return true;
    return index >= Math.max(0, totalCells - 3) && text.length <= 80 && !isHospitalDiagnosisCandidate(value);
  }

  function normalizeObservationText(value) {
    const text = cleanCell(value);
    return /^S\s*\/?\s*P$/i.test(text) ? "SP" : text.toUpperCase();
  }

  function isHospitalDiagnosisCandidate(value) {
    const text = cleanCell(value);
    const key = normalizeText(text);
    if (!text || text.length < 3) return false;
    if (knownServiceFromText(text) || looksLikeBedCell(text) || looksLikeRfcCell(text) || looksLikeSexCell(text) || looksLikeSectorCell(text) || looksLikeStateCell(text) || normalizeDate(text)) return false;
    if (/^\d{1,3}$/.test(key) || /^\d{1,2}:\d{2}$/.test(text)) return false;
    if (isLocationOnlyCell(key) || /^(AMERITA|NO AMERITA)$/.test(key)) return false;
    if (isSpecialtyOnlyCell(key)) return false;
    if (/\b(DR|DRA|MEDICO|GUARDIA|CITA|PROGRAMAR|PENDIENTE|PREALTA)\b/.test(key)) return false;
    return /[A-ZÁÉÍÓÚÑ]{3,}/i.test(text);
  }

  function isSpecialtyOnlyCell(value) {
    const key = normalizeText(value);
    return /^(CX|TYO|ORL|MED|PED|GYO|GO|MI|UCIA|UCIN|UCIP|OTORRINO|TRAUMA|URO|NEURO|CARDIO|ONCO|GINECO|CIRUGIA|CIRUGÍA)$/.test(key);
  }

  function isLocationOnlyCell(value) {
    const key = normalizeText(value).replace(/\s+/g, " ").trim();
    return /^(TUXTLA|TUXTLA GUTIERREZ|SAN CRISTOBAL|JIQUIPILAS|VILLA CORZO|BERRIOZABAL|COMITAN|JITOTOL|CHIAPA DE CORZO|CHIAPAS)$/.test(key)
      || /^[A-ZÁÉÍÓÚÑ ]+,\s*CHIAPAS$/.test(key);
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

  function buildImportDraft(rawRows, fallbackDate, options = {}) {
    const rows = rawRows.map((raw, index) => normalizeImportRow(raw, index, fallbackDate));
    const validRows = rows.filter(row => !row.errors.length);
    const plan = buildImportPlanV2(validRows.map(row => row.normalized), fallbackDate, options);
    const summary = {
      totalRows: rows.length,
      validRows: validRows.length,
      errorRows: rows.filter(row => row.errors.length).length,
      warningRows: rows.filter(row => row.warnings.length).length,
      newPatients: plan.newPatients.length,
      updatedPatients: plan.updatedPatients.length,
      duplicates: plan.duplicates.length,
      conflicts: plan.conflicts.length,
      probableDischarges: plan.reconciliationMissing.length,
      automaticDischarges: (plan.automaticDischarges || []).length,
      reportedDischarges: plan.rows.filter(row => row.dischargeReported).length,
      existingDuplicates: (plan.duplicateExisting || []).length,
      importScope: plan.importScope
    };
    return { rows, plan, summary, conflicts: plan.conflicts, reconciliationMissing: plan.reconciliationMissing, automaticDischarges: plan.automaticDischarges || [], reportedDischarges: plan.rows.filter(row => row.dischargeReported) };
  }

  function normalizeImportRow(raw, index, fallbackDate) {
    const mapped = {};
    Object.entries(raw).forEach(([key, value]) => {
      const canonical = canonicalColumn(key);
      if (!canonical) return;
      const cleaned = cleanCell(value);
      if (["diagnostico_actual", "observaciones", "pendientes"].includes(canonical) && mapped[canonical]) {
        mapped[canonical] = mergeClinicalText(mapped[canonical], cleaned);
      } else {
        mapped[canonical] = cleaned;
      }
    });
    const serviceBed = splitServiceBed(mapped.servicio_cama);
    const service = normalizeImportService(mapped.servicio || serviceBed.service);
    const bed = normalizeBed(mapped.cama || serviceBed.bed);
    const censusDate = normalizeDate(mapped.fecha_censo) || fallbackDate;
    const birthDate = normalizeDate(mapped.fecha_nacimiento);
    const admissionDate = normalizeDate(mapped.fecha_ingreso);
    const age = normalizeImportAge(mapped.edad) || ageFromBirthDate(birthDate, censusDate);
    const sector = normalizeSectorImport(mapped.sector);
    const sex = normalizeImportSex(mapped.sexo);
    const deih = normalizeImportDeih(mapped.deih, admissionDate, censusDate, service);
    const observations = normalizeObservationText(mapped.observaciones || mapped.pendientes || "SP") || "SP";
    const row = {
      patient_id: cleanCell(mapped.patient_id || mapped.hospital_internal_id || ""),
      patient_name: cleanCell(mapped.patient_name).toUpperCase(),
      rfc: cleanCell(mapped.rfc),
      fecha_nacimiento: birthDate,
      fecha_censo: censusDate,
      servicio: service || "PENDIENTE",
      cama: bed || "PENDIENTE",
      sector: sector || "PENDIENTE",
      edad: age,
      sexo: sex || "PENDIENTE",
      fecha_ingreso: admissionDate,
      deih,
      dx_epidemiologico: "",
      estado: normalizeImportState(mapped.estado, service, bed),
      diagnostico_actual: cleanCell(mapped.diagnostico_actual) || "PENDIENTE",
      pendientes: cleanCell(mapped.pendientes),
      hospital_internal_id: cleanCell(mapped.hospital_internal_id),
      riesgo_iaas: cleanCell(mapped.riesgo_iaas),
      observaciones: observations,
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
    if (row.servicio === "PENDIENTE") warnings.push("Servicio pendiente: no se detectó en el título ni en la fila.");
    if (row.cama === "PENDIENTE") warnings.push("Cama pendiente: revisar ubicación.");
    if (row.sector === "PENDIENTE") warnings.push("Sector pendiente: actualizar derechohabiencia.");
    if (row.sexo === "PENDIENTE") warnings.push("Sexo pendiente.");
    if (!row.edad && row.edad !== 0) warnings.push("Edad pendiente.");
    if (mapped.fecha_ingreso && !row.fecha_ingreso && !["AMB", "NA"].includes(normalizeText(mapped.fecha_ingreso))) warnings.push("Fecha de ingreso inválida.");
    if (row.fecha_ingreso && row.fecha_censo && row.fecha_ingreso > row.fecha_censo) warnings.push("Ingreso posterior al censo.");
    if (!row.fecha_ingreso && !isAmbulatoryStayService(row.servicio)) warnings.push("Fecha de ingreso pendiente.");
    if (row.deih === null && !isAmbulatoryStayService(row.servicio)) warnings.push("DEIH pendiente: falta fecha de ingreso para calcular estancia.");
    if (row.diagnostico_actual === "PENDIENTE") warnings.push("Diagnóstico hospitalario pendiente.");
    return { index: index + 1, raw, normalized: row, errors, warnings };
  }

  function enrichImportRowForReconciliation(row, date) {
    const reported = extractReportedDischarge(row, date);
    if (reported) {
      row.dischargeReported = true;
      row.dischargeReviewRequired = true;
      row.dischargeType = reported.type;
      row.dischargeDate = reported.date;
      row.importAlerts = mergeUnique(row.importAlerts || [], [REPORTED_DISCHARGE_MESSAGE]);
    }
    return row;
  }

  function extractReportedDischarge(row, date) {
    const text = cleanCell(`${row.observaciones || ""} ${row.pendientes || ""}`);
    const key = normalizeText(text);
    if (!/\b(ALTA|EGRESO|DEFUNCION|DEFUNCIÓN)\b/.test(key)) return null;
    const dischargeDate = firstDateInText(text) || normalizeDate(date) || normalizeDate(row.fecha_censo) || isoToday();
    let type = "ALTA HOSPITALARIA POR MEJORÍA";
    if (/\bDEFUNCION|DEFUNCIÓN\b/.test(key)) type = "DEFUNCIÓN";
    else if (/\bTRASLADO\b/.test(key)) type = "ALTA HOSPITALARIA POR TRASLADO";
    else if (/\bVOLUNTARIA\b/.test(key)) type = "ALTA HOSPITALARIA VOLUNTARIA";
    else if (/\bMAXIMO BENEFICIO|MÁXIMO BENEFICIO\b/.test(key)) type = "ALTA HOSPITALARIA POR MÁXIMO BENEFICIO";
    else if (/\bNO AUTORIZADA|FUGA|ABANDONO\b/.test(key)) type = "ALTA HOSPITALARIA NO AUTORIZADA";
    return { type, date: dischargeDate };
  }

  function firstDateInText(value) {
    const text = cleanCell(value);
    const direct = normalizeDate(text);
    if (direct) return direct;
    const matches = text.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g) || [];
    return matches.map(normalizeDate).find(Boolean) || "";
  }

  function dischargeLabel(type, date) {
    const safeType = DISCHARGE_TYPES.find(item => normalizeText(item) === normalizeText(type)) || DISCHARGE_TYPES[0];
    return `${safeType} ${formatDisplayDate(date || isoToday())}`.trim();
  }

  function protectedHospitalStayId(patientId) {
    return `${patientId}__hospital`;
  }

  function movementNotice(before, row) {
    if (!before) return "";
    const fromService = normalizeService(before.currentService || "");
    const fromBed = cleanCell(before.currentBed || "S/C");
    const toService = normalizeService(row.servicio || "");
    const toBed = cleanCell(row.cama || "S/C");
    if (!fromService || !toService) return "";
    if (fromService === toService && fromBed === toBed) return "";
    const name = cleanCell(row.patient_name || before.patientName || "PACIENTE").toUpperCase();
    return `${name} DE LA CAMA ${fromBed || "S/C"} DE ${fromService} HA SIDO MOVIDO A ${toService} CAMA ${toBed || "S/C"}.`;
  }

  function carryProtectedAmbulatoryRow(patient, date, importBatchId) {
    return {
      patient_id: patient.hospitalInternalId || patient.displayCode || patient.patientId,
      patient_name: cleanCell(patient.patientName).toUpperCase(),
      rfc: patient.rfc || "",
      fecha_nacimiento: patient.birthDate || "",
      fecha_censo: date,
      servicio: normalizeService(patient.currentService || ""),
      cama: patient.currentBed || "AMB",
      sector: patient.sector || "PENDIENTE",
      edad: patient.age ?? "",
      sexo: patient.sex || "PENDIENTE",
      fecha_ingreso: patient.admissionDate || "",
      deih: "NA",
      dx_epidemiologico: "",
      estado: patient.currentState || "ESTABLE",
      diagnostico_actual: patient.currentDiagnosis || "PENDIENTE",
      pendientes: "",
      hospital_internal_id: patient.hospitalInternalId || "",
      riesgo_iaas: "",
      observaciones: patient.observations || "SP",
      patientId: patient.patientId,
      rowHash: `carry-${patient.patientId}-${date}`,
      importedFromFile: false,
      carriedProtectedAmbulatory: true,
      importBatchId,
      importAlerts: []
    };
  }

  function makeProtectedAmbulatoryCompanionRow(row, sourcePatient, sourcePatientId) {
    const target = { ...row };
    target.basePatientId = sourcePatientId;
    target.ambulatoryCompanion = true;
    target.ambulatorySourceService = normalizeService(sourcePatient.currentService || "");
    target.patientId = protectedHospitalStayId(sourcePatientId);
    target.servicio = combinedServiceLabel(sourcePatient.currentService, row.servicio);
    target.importAlerts = mergeUnique(row.importAlerts || [], [
      `${cleanCell(row.patient_name || sourcePatient.patientName).toUpperCase()} conserva registro en ${normalizeService(sourcePatient.currentService)} y se agrega estancia hospitalaria en ${normalizeService(row.servicio)} cama ${row.cama || "S/C"}.`
    ]);
    return target;
  }

  function shouldAutoDischargeBeforeImport(patient, date) {
    if (!patient || patient.hospitalizationStatus === "egresado") return false;
    const latest = normalizeDate(patient.latestCensusDate);
    if (!latest || latest >= date) return false;
    if (["alta_probable", "alta_reportada"].includes(patient.hospitalizationStatus)) return true;
    return isPlainAmbulatoryService(patient.currentService) && !isProtectedAmbulatoryService(patient.currentService);
  }

  function shouldReconcileMissingPatient(patient, date) {
    if (!patient || patient.hospitalizationStatus === "egresado") return false;
    if (shouldAutoDischargeBeforeImport(patient, date)) return false;
    return true;
  }

  function importIdentityMatchesPatient(row, patient) {
    if (!patient) return false;
    const stable = cleanCell(row.patient_id || row.hospital_internal_id);
    if (stable && [patient.hospitalInternalId, patient.pseudonymizedId, patient.displayCode, patient.patientId].some(value => cleanCell(value) === stable)) return true;
    if (row.rfc && cleanCell(patient.rfc) && cleanCell(row.rfc) === cleanCell(patient.rfc)) return true;
    const sameName = normalizedPatientNameKey(row.patient_name) && normalizedPatientNameKey(row.patient_name) === normalizedPatientNameKey(patient.patientName);
    const sameBirth = row.fecha_nacimiento && normalizeDate(patient.birthDate) === normalizeDate(row.fecha_nacimiento);
    return Boolean(sameName && (sameBirth || !row.fecha_nacimiento));
  }

  function duplicateExistingPatientsForRow(row, keepPatientId) {
    return Object.values(store.patients || {})
      .filter(patient => patient.patientId !== keepPatientId)
      .filter(patient => patient.hospitalizationStatus !== "egresado")
      .filter(patient => importIdentityMatchesPatient(row, patient));
  }

  function buildImportPlan(rows, date) {
    const seen = new Map();
    const uniqueRows = [];
    const newPatients = [];
    const updatedPatients = [];
    const duplicates = [];
    const conflicts = [];
    const existingPresent = new Set(Object.values(store.patients)
      .filter(patient => patient.hospitalizationStatus !== "egresado")
      .map(patient => patient.patientId));
    const incomingIds = new Set();

    rows.forEach(row => {
      const patientId = resolveImportPatientId(row);
      const rowHash = hashNormalizedRow(row);
      row.patientId = patientId;
      row.rowHash = rowHash;
      incomingIds.add(patientId);
      if (seen.has(patientId)) {
        const previous = seen.get(patientId);
        if (previous.servicio !== row.servicio || previous.cama !== row.cama) {
          conflicts.push({ patientId, previous, current: row, reason: "Mismo paciente detectado en dos ubicaciones del archivo; se conservará la fila más completa y se dejará auditoría." });
        }
        const merged = mergeImportRows(previous, row);
        merged.patientId = patientId;
        merged.rowHash = hashNormalizedRow(merged);
        seen.set(patientId, merged);
        const index = uniqueRows.findIndex(item => item.patientId === patientId);
        if (index >= 0) uniqueRows[index] = merged;
        duplicates.push(row);
        return;
      }
      seen.set(patientId, row);
      uniqueRows.push(row);
    });

    uniqueRows.forEach(row => {
      if (store.patients[row.patientId]) updatedPatients.push(row);
      else newPatients.push(row);
    });

    const reconciliationMissing = [...existingPresent]
      .filter(patientId => !incomingIds.has(patientId))
      .map(patientId => store.patients[patientId])
      .filter(Boolean);

    return { date, importBatchId: createImportBatchId(date), rows: uniqueRows, newPatients, updatedPatients, duplicates, conflicts, reconciliationMissing };
  }

  function resolveImportScope(rows, date, requestedMode = "auto") {
    if (requestedMode === "full") return "full";
    if (requestedMode === "partial") return "partial";
    const normalizedDate = normalizeDate(date) || isoToday();
    const incomingCount = rows.filter(row => cleanCell(row.patient_name || row.patient_id || row.hospital_internal_id)).length;
    const sameDayCensusCount = Object.keys(store.dailyCensus?.[normalizedDate]?.patients || {}).length;
    const activeCount = Object.values(store.patients || {}).filter(patient => shouldReconcileMissingPatient(patient, normalizedDate)).length;
    const serviceCount = new Set(rows.map(row => primaryService(row.servicio)).filter(Boolean)).size;
    if (!activeCount && !sameDayCensusCount) return "full";
    if (sameDayCensusCount && incomingCount < Math.max(8, sameDayCensusCount * 0.75)) return "partial";
    if (activeCount && incomingCount >= Math.ceil(activeCount * 0.75)) return "full";
    if (serviceCount >= 3 && incomingCount >= Math.max(8, Math.ceil(activeCount * 0.5))) return "full";
    return "partial";
  }

  function importScopeText(scope) {
    return scope === "full" ? "Completo" : "Parcial";
  }

  function buildImportPlanV2(rows, date, options = {}) {
    const seen = new Map();
    const uniqueRows = [];
    const newPatients = [];
    const updatedPatients = [];
    const duplicates = [];
    const conflicts = [];
    const duplicateExisting = [];
    const automaticDischarges = [];
    const carryRows = new Map();
    const normalizedDate = normalizeDate(date) || isoToday();
    const importBatchId = createImportBatchId(normalizedDate);
    const importScope = resolveImportScope(rows, normalizedDate, options.mode || "auto");
    const reconcileMissingPatients = importScope === "full";
    if (reconcileMissingPatients) {
      Object.values(store.patients || {}).forEach(patient => {
        if (shouldAutoDischargeBeforeImport(patient, normalizedDate)) automaticDischarges.push(patient);
      });
    }
    const existingPresent = reconcileMissingPatients
      ? new Set(Object.values(store.patients || {})
        .filter(patient => shouldReconcileMissingPatient(patient, normalizedDate))
        .map(patient => patient.patientId))
      : new Set();
    const incomingIds = new Set();

    rows.forEach(sourceRow => {
      let row = enrichImportRowForReconciliation(sourceRow, normalizedDate);
      const resolvedPatientId = resolveImportPatientId(row);
      const existing = store.patients[resolvedPatientId];
      let patientId = resolvedPatientId;
      if (existing && isProtectedAmbulatoryService(existing.currentService) && isHospitalStayService(row.servicio)) {
        carryRows.set(existing.patientId, carryProtectedAmbulatoryRow(existing, normalizedDate, importBatchId));
        row = makeProtectedAmbulatoryCompanionRow(row, existing, existing.patientId);
        patientId = row.patientId;
        incomingIds.add(existing.patientId);
      } else {
        row.patientId = patientId;
        const notice = movementNotice(existing, row);
        if (notice) row.importAlerts = mergeUnique(row.importAlerts || [], [notice]);
      }
      row.rowHash = hashNormalizedRow(row);
      incomingIds.add(patientId);
      duplicateExistingPatientsForRow(row, patientId).forEach(patient => {
        if (!duplicateExisting.some(item => item.patientId === patient.patientId)) duplicateExisting.push(patient);
      });
      if (seen.has(patientId)) {
        const previous = seen.get(patientId);
        if (previous.servicio !== row.servicio || previous.cama !== row.cama) {
          conflicts.push({ patientId, previous, current: row, reason: "Mismo paciente detectado en dos ubicaciones del archivo; se conservará la fila más completa y se dejará auditoría." });
        }
        const merged = mergeImportRows(previous, row);
        merged.patientId = patientId;
        merged.rowHash = hashNormalizedRow(merged);
        seen.set(patientId, merged);
        const index = uniqueRows.findIndex(item => item.patientId === patientId);
        if (index >= 0) uniqueRows[index] = merged;
        duplicates.push(row);
        return;
      }
      seen.set(patientId, row);
      uniqueRows.push(row);
    });

    carryRows.forEach(row => {
      if (seen.has(row.patientId)) return;
      seen.set(row.patientId, row);
      uniqueRows.push(row);
      incomingIds.add(row.patientId);
    });

    uniqueRows.forEach(row => {
      if (store.patients[row.patientId]) updatedPatients.push(row);
      else newPatients.push(row);
    });

    const reconciliationMissing = [...existingPresent]
      .filter(patientId => !incomingIds.has(patientId))
      .map(patientId => store.patients[patientId])
      .filter(Boolean);

    return {
      date: normalizedDate,
      importBatchId,
      rows: uniqueRows,
      newPatients,
      updatedPatients,
      duplicates,
      conflicts,
      reconciliationMissing,
      automaticDischarges,
      duplicateExisting,
      importScope,
      preserveExistingCensus: importScope !== "full"
    };
  }

  async function confirmImport() {
    const draft = ui.importDraft;
    if (!draft) return;
    ui.importSaving = true;
    ui.importProgress = "Preparando importación...";
    renderIaas();
    await waitFrame();
    try {
      executeImportPlanLocalV2(draft.plan);
      const ops = buildImportWriteOpsV2(draft.plan);
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
          deih: row.deih ?? null,
          currentState: row.estado || null,
          currentDiagnosis: row.diagnostico_actual || null,
          epidemiologicalDiagnosis: null,
          diagnosisHistory: [{ date: plan.date, value: row.diagnostico_actual || "", source: "import" }],
          serviceHistory: [{
            date: row.fecha_ingreso || plan.date,
            fromService: null,
            fromBed: null,
            toService: row.servicio,
            toBed: row.cama,
            source: "import"
          }],
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
        const diagnosisChanged = cleanCell(row.diagnostico_actual) && cleanCell(previous.currentDiagnosis) !== cleanCell(row.diagnostico_actual);
        const serviceChanged = cleanCell(previous.currentService) !== cleanCell(row.servicio) || cleanCell(previous.currentBed) !== cleanCell(row.cama);
        previous.currentService = row.servicio;
        previous.currentBed = row.cama;
        previous.patientName = row.patient_name || previous.patientName || null;
        previous.rfc = row.rfc || previous.rfc || null;
        previous.birthDate = row.fecha_nacimiento || previous.birthDate || null;
        previous.sector = row.sector || previous.sector || null;
        previous.sex = row.sexo || previous.sex;
        previous.age = row.edad ?? previous.age;
        previous.admissionDate = earliestIsoDate(previous.admissionDate, row.fecha_ingreso) || row.fecha_ingreso || previous.admissionDate;
        previous.deih = row.deih ?? previous.deih ?? null;
        previous.currentState = row.estado || previous.currentState || null;
        previous.currentDiagnosis = row.diagnostico_actual || previous.currentDiagnosis;
        previous.epidemiologicalDiagnosis = previous.epidemiologicalDiagnosis || null;
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
        if (serviceChanged) {
          previous.serviceHistory = [
            ...(previous.serviceHistory || []),
            {
              date: plan.date,
              fromService: before.currentService || null,
              fromBed: before.currentBed || null,
              toService: row.servicio,
              toBed: row.cama,
              source: "import"
            }
          ].slice(-80);
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
        admissionDate: row.fecha_ingreso || store.patients[row.patientId]?.admissionDate || null,
        deih: row.deih ?? null,
        state: row.estado || null,
        epidemiologicalDiagnosis: store.patients[row.patientId]?.epidemiologicalDiagnosis || null,
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
      totalPatientsDetected: Object.keys(censusPatients).length,
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
    store.activeDate = plan.date;
    ui.sheets.activeDate = plan.date;
    ensureDailyRound(plan.date);
    const entries = {};
    Object.values(censusPatients).forEach(row => {
      const requiresReconciliation = Boolean(row.reconciliationRequired);
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
        alertsGenerated: requiresReconciliation ? ["Requiere conciliación"] : [],
        status: requiresReconciliation ? "incompleto" : "pendiente",
        syncStatus: syncStatusForNewWrite(),
        localSavedAt: null,
        serverConfirmedAt: null,
        notes: requiresReconciliation ? "Paciente ausente en el censo importado; confirmar ubicación o egreso." : ""
      };
    });
    store.dailyRounds[plan.date].entries = entries;
    store.dailyRounds[plan.date].status = "not_started";
    recalculateRound(plan.date);
  }

  function reconciliationCensusRow(patient, plan) {
    return {
      patientId: patient.patientId,
      service: patient.currentService || "SIN SERVICIO",
      bed: patient.currentBed || "S/C",
      patientName: patient.patientName || null,
      rfc: patient.rfc || patient.hospitalInternalId || null,
      birthDate: patient.birthDate || null,
      sector: patient.sector || null,
      age: patient.age ?? null,
      sex: patient.sex || null,
      admissionDate: patient.admissionDate || null,
      deih: patient.deih ?? daysBetween(patient.admissionDate, plan.date),
      state: patient.currentState || "Requiere conciliación",
      epidemiologicalDiagnosis: patient.epidemiologicalDiagnosis || null,
      diagnosis: patient.currentDiagnosis || null,
      observations: "Paciente activo no encontrado en el censo importado; requiere conciliación manual.",
      present: false,
      reconciliationRequired: true,
      importedFromFile: false,
      importBatchId: plan.importBatchId,
      rowHash: `reconciliation-${patient.patientId}-${plan.date}`,
      reviewedByNursing: false,
      reviewStatus: "requiere_conciliación",
      reviewedAt: null,
      syncStatus: syncStatusForNewWrite(),
      notes: "Requiere conciliación por ausencia en importación."
    };
  }

  function executeImportPlanLocalV2(plan) {
    const now = nowIso();
    const previousCensusPatients = store.dailyCensus?.[plan.date]?.patients || {};
    const censusPatients = plan.preserveExistingCensus ? clone(previousCensusPatients) : {};
    const affectedPatientIds = new Set();
    const incomingPatientIds = new Set((plan.rows || []).flatMap(row => [row.patientId, row.basePatientId].filter(Boolean)));

    (plan.automaticDischarges || []).forEach(patient => {
      if (!patient || incomingPatientIds.has(patient.patientId)) return;
      const before = clone(patient);
      patient.hospitalizationStatus = "egresado";
      patient.presentInLatestCensus = false;
      patient.latestRoundStatus = "revisado";
      patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], ["Alta automática por ausencia posterior al día de aviso"]);
      patient.updatedAt = now;
      patient.updatedBy = currentUserId();
      affectedPatientIds.add(patient.patientId);
      addAudit("PATIENT_AUTO_DISCHARGED", { patientId: patient.patientId, before, after: patient, importBatchId: plan.importBatchId });
    });

    (plan.duplicateExisting || []).forEach(patient => {
      if (!patient || incomingPatientIds.has(patient.patientId)) return;
      const before = clone(patient);
      patient.hospitalizationStatus = "egresado";
      patient.presentInLatestCensus = false;
      patient.latestRoundStatus = "revisado";
      patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], ["Registro duplicado omitido por importación"]);
      patient.updatedAt = now;
      patient.updatedBy = currentUserId();
      affectedPatientIds.add(patient.patientId);
      addAudit("PATIENT_DUPLICATE_CLOSED", { patientId: patient.patientId, before, after: patient, importBatchId: plan.importBatchId });
    });

    (plan.rows || []).forEach(row => {
      const previous = store.patients[row.patientId];
      const pending = mergeUnique(splitPending(row.pendientes || row.observaciones), row.importAlerts || []);
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
          deih: row.deih ?? null,
          currentState: row.estado || null,
          currentDiagnosis: normalizedClinicalImportValue(row.diagnostico_actual) || null,
          epidemiologicalDiagnosis: null,
          diagnosisHistory: normalizedClinicalImportValue(row.diagnostico_actual) ? [{ date: plan.date, value: normalizedClinicalImportValue(row.diagnostico_actual), source: "import" }] : [],
          serviceHistory: [{
            date: row.fecha_ingreso || plan.date,
            fromService: null,
            fromBed: null,
            toService: row.servicio,
            toBed: row.cama,
            source: "import"
          }],
          observations: normalizedObservationImportValue(row.observaciones || row.pendientes) || null,
          activePendingIssues: pending,
          currentRiskLevel: riskFromImport(row),
          hospitalizationStatus: row.dischargeReported ? "alta_reportada" : "hospitalizado",
          dischargeType: row.dischargeType || null,
          dischargeDate: row.dischargeDate || null,
          dischargeShift: row.dischargeShift || null,
          dischargeStatus: row.dischargeReported ? "reportada_por_censo" : null,
          dischargeReviewRequired: Boolean(row.dischargeReviewRequired),
          presentInLatestCensus: true,
          latestCensusDate: plan.date,
          latestRoundDate: null,
          latestRoundStatus: row.importAlerts?.length || row.dischargeReviewRequired ? "alerta" : "pendiente",
          basePatientId: row.basePatientId || null,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUserId(),
          updatedBy: currentUserId()
        };
        addAudit("PATIENT_CREATED", { patientId: row.patientId, after: store.patients[row.patientId], importBatchId: plan.importBatchId });
      } else {
        const before = clone(previous);
        const incomingDx = normalizedClinicalImportValue(row.diagnostico_actual);
        const nextDx = mergeClinicalImportValue(previous.currentDiagnosis, incomingDx);
        const diagnosisChanged = incomingDx && cleanCell(previous.currentDiagnosis) !== cleanCell(nextDx);
        const serviceChanged = cleanCell(previous.currentService) !== cleanCell(row.servicio) || cleanCell(previous.currentBed) !== cleanCell(row.cama);
        previous.currentService = row.servicio;
        previous.currentBed = row.cama;
        previous.patientName = row.patient_name || previous.patientName || null;
        previous.rfc = row.rfc || previous.rfc || null;
        previous.birthDate = row.fecha_nacimiento || previous.birthDate || null;
        previous.sector = row.sector || previous.sector || null;
        previous.sex = row.sexo || previous.sex;
        previous.age = row.edad ?? previous.age;
        previous.admissionDate = row.fecha_ingreso || previous.admissionDate || null;
        previous.deih = row.deih ?? previous.deih ?? null;
        previous.currentState = row.estado || previous.currentState || null;
        previous.currentDiagnosis = nextDx || previous.currentDiagnosis || null;
        previous.epidemiologicalDiagnosis = previous.epidemiologicalDiagnosis || null;
        previous.observations = mergeObservationImportValue(previous.observations, row.observaciones || row.pendientes) || previous.observations || null;
        previous.activePendingIssues = mergeUnique(previous.activePendingIssues || [], pending);
        previous.currentRiskLevel = riskFromImport(row) || previous.currentRiskLevel;
        previous.hospitalizationStatus = row.dischargeReported ? "alta_reportada" : "hospitalizado";
        previous.dischargeType = row.dischargeType || (row.dischargeReported ? previous.dischargeType : previous.dischargeType || null);
        previous.dischargeDate = row.dischargeDate || (row.dischargeReported ? previous.dischargeDate : previous.dischargeDate || null);
        previous.dischargeShift = row.dischargeShift || previous.dischargeShift || null;
        previous.dischargeStatus = row.dischargeReported ? "reportada_por_censo" : previous.dischargeStatus || null;
        previous.dischargeReviewRequired = Boolean(row.dischargeReviewRequired);
        previous.presentInLatestCensus = true;
        previous.latestCensusDate = plan.date;
        previous.latestRoundStatus = row.importAlerts?.length || row.dischargeReviewRequired ? "alerta" : (previous.latestRoundDate === plan.date ? previous.latestRoundStatus : "pendiente");
        previous.basePatientId = row.basePatientId || previous.basePatientId || null;
        previous.updatedAt = now;
        previous.updatedBy = currentUserId();
        if (diagnosisChanged) {
          previous.diagnosisHistory = [...(previous.diagnosisHistory || []), { date: plan.date, value: incomingDx, source: "import" }].slice(-100);
        }
        if (serviceChanged) {
          previous.serviceHistory = [
            ...(previous.serviceHistory || []),
            {
              date: plan.date,
              fromService: before.currentService || null,
              fromBed: before.currentBed || null,
              toService: row.servicio,
              toBed: row.cama,
              source: "import"
            }
          ].slice(-80);
        }
        addAudit("PATIENT_UPDATED", { patientId: row.patientId, before, after: previous, importBatchId: plan.importBatchId });
      }
      affectedPatientIds.add(row.patientId);
      censusPatients[row.patientId] = importCensusRowV2(row, store.patients[row.patientId], plan);
    });

    const reconciliationMissing = [...(plan.reconciliationMissing || [])];
    if (plan.fullImport && !plan.preserveExistingCensus) {
      Object.keys(previousCensusPatients || {}).forEach(patientId => {
        if (incomingPatientIds.has(patientId) || reconciliationMissing.some(patient => patient?.patientId === patientId)) return;
        const patient = store.patients[patientId];
        if (patient && patient.hospitalizationStatus !== "egresado") reconciliationMissing.push(patient);
      });
    }
    plan.reconciliationMissing = reconciliationMissing;

    reconciliationMissing.forEach(patient => {
      const before = clone(patient);
      patient.presentInLatestCensus = false;
      patient.latestCensusDate = plan.date;
      patient.hospitalizationStatus = "alta_probable";
      patient.latestRoundStatus = "alerta";
      patient.dischargeReviewRequired = true;
      patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], [PROBABLE_DISCHARGE_MESSAGE]);
      patient.updatedAt = now;
      patient.updatedBy = currentUserId();
      affectedPatientIds.add(patient.patientId);
      addAudit("PATIENT_PROBABLE_DISCHARGE", { patientId: patient.patientId, before, after: patient, importBatchId: plan.importBatchId });
    });

    store.dailyCensus[plan.date] = {
      date: plan.date,
      importBatchId: plan.importBatchId,
      importedAt: now,
      importedBy: currentUserId(),
      totalRows: (plan.rows || []).length + (plan.duplicates || []).length + (plan.conflicts || []).length,
      totalPatientsDetected: Object.keys(censusPatients).length,
      totalNewPatients: (plan.newPatients || []).length,
      totalUpdatedPatients: (plan.updatedPatients || []).length,
      totalDuplicatesSkipped: (plan.duplicates || []).length + (plan.duplicateExisting || []).length,
      totalErrors: (plan.conflicts || []).length,
      status: "imported",
      closedAt: null,
      closedBy: null,
      patients: censusPatients,
      conflicts: plan.conflicts || []
    };
    plan.removedCensusPatientIds = Object.keys(previousCensusPatients || {}).filter(patientId => !censusPatients[patientId]);
    plan.removedCensusArchiveRows = Object.fromEntries((plan.removedCensusPatientIds || []).map(patientId => [
      patientId,
      archivedMissingCensusRow(previousCensusPatients[patientId], store.patients[patientId], plan)
    ]));
    plan.removedRoundArchiveEntries = Object.fromEntries((plan.removedCensusPatientIds || []).map(patientId => [
      patientId,
      clone(store.dailyRounds?.[plan.date]?.entries?.[patientId] || {})
    ]));
    store.activeDate = plan.date;
    ui.sheets.activeDate = plan.date;
    ensureDailyRound(plan.date);
    const entries = {};
    Object.values(censusPatients).forEach(row => {
      const existingEntry = store.dailyRounds[plan.date].entries[row.patientId];
      const alerts = mergeUnique(row.importAlerts || [], row.reconciliationRequired ? [PROBABLE_DISCHARGE_MESSAGE] : []);
      const needsAttention = Boolean(alerts.length || row.dischargeReviewRequired || row.probableDischarge);
      const defaultEntry = {
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
        alertsGenerated: alerts,
        status: needsAttention ? "alerta" : "pendiente",
        syncStatus: syncStatusForNewWrite(),
        localSavedAt: null,
        serverConfirmedAt: null,
        notes: alerts.join(" | ")
      };
      entries[row.patientId] = existingEntry ? {
        ...defaultEntry,
        ...existingEntry,
        service: row.service,
        bed: row.bed,
        alertsGenerated: mergeUnique(existingEntry.alertsGenerated || [], alerts),
        status: existingEntry.status === "pendiente" && needsAttention ? "alerta" : existingEntry.status,
        notes: mergeClinicalText(existingEntry.notes || "", alerts.join(" | "))
      } : defaultEntry;
    });
    store.dailyRounds[plan.date].entries = entries;
    store.dailyRounds[plan.date].status = "not_started";
    store.dailyRounds[plan.date].probableDischarges = reconciliationMissing.length;
    store.dailyRounds[plan.date].reportedDischarges = Object.values(censusPatients).filter(row => row.dischargeReported).length;
    recalculateRound(plan.date);
    plan.affectedPatientIds = [...affectedPatientIds];
  }

  function importCensusRowV2(row, patient, plan) {
    return {
      patientId: row.patientId,
      service: row.servicio,
      bed: row.cama,
      patientName: row.patient_name || patient?.patientName || null,
      rfc: row.rfc || patient?.rfc || null,
      birthDate: row.fecha_nacimiento || patient?.birthDate || null,
      sector: row.sector || patient?.sector || null,
      age: row.edad ?? patient?.age ?? null,
      sex: row.sexo || patient?.sex || null,
      admissionDate: row.fecha_ingreso || patient?.admissionDate || null,
      deih: row.deih ?? patient?.deih ?? null,
      state: row.estado || patient?.currentState || null,
      epidemiologicalDiagnosis: patient?.epidemiologicalDiagnosis || null,
      diagnosis: normalizedClinicalImportValue(row.diagnostico_actual) || patient?.currentDiagnosis || null,
      observations: normalizedObservationImportValue(row.observaciones || row.pendientes) || patient?.observations || null,
      present: true,
      importedFromFile: row.importedFromFile !== false,
      carriedProtectedAmbulatory: Boolean(row.carriedProtectedAmbulatory),
      ambulatoryCompanion: Boolean(row.ambulatoryCompanion),
      basePatientId: row.basePatientId || null,
      dischargeReported: Boolean(row.dischargeReported),
      dischargeReviewRequired: Boolean(row.dischargeReviewRequired),
      dischargeType: row.dischargeType || patient?.dischargeType || null,
      dischargeDate: row.dischargeDate || patient?.dischargeDate || null,
      dischargeShift: row.dischargeShift || patient?.dischargeShift || null,
      dischargeStatus: row.dischargeReported ? "reportada_por_censo" : patient?.dischargeStatus || null,
      importAlerts: row.importAlerts || [],
      importBatchId: plan.importBatchId,
      rowHash: row.rowHash,
      reviewedByNursing: false,
      reviewStatus: "pendiente",
      reviewedAt: null,
      syncStatus: syncStatusForNewWrite(),
      notes: mergeClinicalText(row.observaciones || "", (row.importAlerts || []).join(" | "))
    };
  }

  function probableDischargeCensusRow(patient, plan) {
    return {
      patientId: patient.patientId,
      service: patient.currentService || "SIN SERVICIO",
      bed: patient.currentBed || "S/C",
      patientName: patient.patientName || null,
      rfc: patient.rfc || patient.hospitalInternalId || null,
      birthDate: patient.birthDate || null,
      sector: patient.sector || null,
      age: patient.age ?? null,
      sex: patient.sex || null,
      admissionDate: patient.admissionDate || null,
      deih: patient.deih ?? daysBetween(patient.admissionDate, plan.date),
      state: patient.currentState || "GRAVE",
      epidemiologicalDiagnosis: patient.epidemiologicalDiagnosis || null,
      diagnosis: patient.currentDiagnosis || null,
      observations: PROBABLE_DISCHARGE_MESSAGE,
      present: false,
      probableDischarge: true,
      dischargeReviewRequired: true,
      reconciliationRequired: true,
      importAlerts: [PROBABLE_DISCHARGE_MESSAGE],
      importedFromFile: false,
      importBatchId: plan.importBatchId,
      rowHash: `probable-discharge-${patient.patientId}-${plan.date}`,
      reviewedByNursing: false,
      reviewStatus: "alerta",
      reviewedAt: null,
      syncStatus: syncStatusForNewWrite(),
      notes: PROBABLE_DISCHARGE_MESSAGE
    };
  }

  function archivedMissingCensusRow(previousRow, patient, plan) {
    const base = previousRow || probableDischargeCensusRow(patient || {}, plan);
    return {
      ...base,
      patientId: base.patientId || patient?.patientId,
      service: base.service || patient?.currentService || "SIN SERVICIO",
      bed: base.bed || patient?.currentBed || "S/C",
      patientName: base.patientName || patient?.patientName || null,
      present: false,
      probableDischarge: true,
      dischargeReviewRequired: true,
      reconciliationRequired: true,
      importedFromFile: false,
      importBatchId: plan.importBatchId,
      reviewStatus: "alerta",
      importAlerts: mergeUnique(base.importAlerts || [], [PROBABLE_DISCHARGE_MESSAGE]),
      observations: mergeClinicalText(base.observations || "", PROBABLE_DISCHARGE_MESSAGE),
      notes: mergeClinicalText(base.notes || "", PROBABLE_DISCHARGE_MESSAGE),
      syncStatus: syncStatusForNewWrite()
    };
  }

  function normalizedClinicalImportValue(value) {
    const text = cleanCell(value);
    const key = normalizeText(text);
    if (!text || ["PENDIENTE", "SP", "S/P", "SIN DATO", "SD", "NA", "N/A"].includes(key)) return "";
    return text.toUpperCase();
  }

  function normalizedObservationImportValue(value) {
    const text = cleanCell(value);
    const key = normalizeText(text);
    if (!text || ["PENDIENTE", "SIN DATO", "SD", "NA", "N/A"].includes(key)) return "";
    if (/^S\s*\/?\s*P$/.test(key)) return "SP";
    return text.toUpperCase();
  }

  function mergeClinicalImportValue(previous, incoming) {
    const value = normalizedClinicalImportValue(incoming) || normalizedObservationImportValue(incoming);
    if (!value) return cleanCell(previous);
    return mergeClinicalText(previous, value);
  }

  function mergeObservationImportValue(previous, incoming) {
    const value = normalizedObservationImportValue(incoming);
    if (!value || (value === "SP" && cleanCell(previous))) return cleanCell(previous);
    return mergeClinicalText(previous, value);
  }

  function buildImportWriteOpsV2(plan) {
    const ops = [];
    const affected = new Set(plan.affectedPatientIds || []);
    ops.push({ path: `dailyCensus/${plan.date}`, action: "set", data: omitPatients(store.dailyCensus[plan.date]) });
    Object.values(store.dailyCensus[plan.date].patients || {}).forEach(row => {
      affected.add(row.patientId);
      ops.push({ path: `dailyCensus/${plan.date}/patients/${row.patientId}`, action: "set", data: row });
    });
    (plan.removedCensusPatientIds || []).forEach(patientId => {
      const archivedRow = plan.removedCensusArchiveRows?.[patientId] || archivedMissingCensusRow(null, store.patients[patientId], plan);
      const existingEntry = plan.removedRoundArchiveEntries?.[patientId] || store.dailyRounds[plan.date]?.entries?.[patientId] || {};
      ops.push({ path: `dailyCensus/${plan.date}/patients/${patientId}`, action: "set", data: archivedRow, merge: true });
      ops.push({
        path: `dailyRounds/${plan.date}/entries/${patientId}`,
        action: "set",
        merge: true,
        data: {
          ...existingEntry,
          entryId: patientId,
          patientId,
          service: archivedRow.service,
          bed: archivedRow.bed,
          roundDate: plan.date,
          status: existingEntry.status || "alerta",
          alertsGenerated: mergeUnique(existingEntry.alertsGenerated || [], [PROBABLE_DISCHARGE_MESSAGE]),
          notes: mergeClinicalText(existingEntry.notes || "", PROBABLE_DISCHARGE_MESSAGE),
          syncStatus: syncStatusForNewWrite()
        }
      });
    });
    (plan.rows || []).forEach(row => affected.add(row.patientId));
    (plan.reconciliationMissing || []).forEach(patient => affected.add(patient.patientId));
    (plan.automaticDischarges || []).forEach(patient => affected.add(patient.patientId));
    (plan.duplicateExisting || []).forEach(patient => affected.add(patient.patientId));
    affected.forEach(patientId => {
      if (store.patients[patientId]) ops.push({ path: `patients/${patientId}`, action: "set", data: store.patients[patientId], merge: true });
    });
    ops.push({ path: `dailyRounds/${plan.date}`, action: "set", data: omitEntries(store.dailyRounds[plan.date]), merge: true });
    Object.values(store.dailyRounds[plan.date].entries || {}).forEach(entry => {
      ops.push({ path: `dailyRounds/${plan.date}/entries/${entry.entryId}`, action: "set", data: entry, merge: true });
    });
    return ops;
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
    const packageReviews = [];
    (draft.deviceDrafts || []).forEach(device => {
      if (!packageCreatesDevice(device)) {
        packageReviews.push(packageReviewSummary(device));
        return;
      }
      if (!device.installationDate) return;
      const previous = detectReinstallation(patientId, device);
      const removalDate = normalizeDate(device.removalDate);
      const episode = {
        episodeId: buildDeviceEpisodeId(patientId, deviceDisplayName(device), device.installationDate, device.french || ""),
        patientId,
        deviceType: device.deviceType,
        deviceSubtype: device.deviceSubtype || null,
        french: device.french || null,
        material: device.material || null,
        deviceState: device.deviceState || null,
        preventivePackage: device.packageType || null,
        preventiveChecks: device.preventiveChecks || {},
        preventiveCompliance: preventiveCompliance(device.preventiveChecks || {}),
        oralHygieneMethod: device.oralHygieneMethod || null,
        anatomicalSite: device.anatomicalSite || null,
        installationDate: normalizeDate(device.installationDate) || device.installationDate,
        removalDate: removalDate || null,
        status: removalDate ? "retirado" : "activo",
        isReinstallation: Boolean(previous),
        previousEpisodeId: previous?.episodeId || null,
        dressingCurrent: nullable(device.dressingCurrent),
        dressingDate: device.dressingDate || null,
        careStatus: device.careStatus || "no_valorado",
        infectionSigns: nullable(device.infectionSigns),
        infectionSignsDescription: device.infectionSignsDescription || null,
        notes: mergeClinicalText(device.notes || "", device.observations || ""),
        createdDuringRoundDate: date,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdBy: currentUserId(),
        updatedBy: currentUserId(),
        source: "nursing_round"
      };
      store.deviceEpisodes[episode.episodeId] = episode;
      createdEpisodeIds.push(episode.episodeId);
      packageReviews.push(packageReviewSummary(device));
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
      episode.removalDate = normalizeDate(removalDate) || removalDate;
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
    const completedIaasAssessment = completeIaasAssessmentForSave(draft.iaasAssessment, date);
    const iaasAssessment = mergeIaasAssessmentForSave(previousEntry.iaasAssessment, completedIaasAssessment);
    const storesIaasAssessment = draft.activeRoundSection === "iaas" || iaasAssessmentHasContent(completedIaasAssessment) || Boolean(previousEntry.iaasAssessment);
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
      noInvasivesConfirmed: Boolean(draft.noInvasivesConfirmed) && activeNow.length === 0 && createdEpisodeIds.length === 0,
      reviewedDevices: mergeUnique(activeNow.map(ep => ep.episodeId), createdEpisodeIds),
      pendingIssuesAdded: pendingAdded,
      alertsGenerated: alerts,
      status,
      syncStatus: initialSyncStatus,
      localSavedAt: nowIso(),
      serverConfirmedAt: null,
      notes: draft.notes || "",
      activeRoundSection: draft.activeRoundSection || "preventive",
      packageReviews: [...(previousEntry.packageReviews || []), ...packageReviews],
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
    clearReviewDraftAfterSave(date, patientId, draft.activeRoundSection);
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
    const direction = goNext === true ? "next" : goNext;
    if (direction) {
      const target = navigationPatientId(date, patientId, draft.activeRoundSection, direction);
      location.hash = target
        ? (draft.activeRoundSection === "iaas" ? `#/seguimiento-iaas/${date}/paciente/${target}` : `#/ronda/${date}/paciente/${target}`)
        : `#/${draft.activeRoundSection === "iaas" ? "seguimiento-iaas" : `ronda/${date}`}`;
    } else {
      renderIaas();
    }
  }

  function validateReviewDraft(date, patientId, draft, requestedStatus) {
    const errors = [];
    (draft.deviceDrafts || []).forEach(device => {
      if (!packageCreatesDevice(device)) return;
      if (!device.installationDate) errors.push(`${deviceDisplayName(device)}: falta fecha de instalación.`);
      if (device.installationDate && !normalizeDate(device.installationDate)) errors.push(`${deviceDisplayName(device)}: fecha de instalación inválida.`);
      if (device.removalDate && !normalizeDate(device.removalDate)) errors.push(`${deviceDisplayName(device)}: fecha de retiro inválida.`);
      if (device.installationDate && device.removalDate && normalizeDate(device.removalDate) < normalizeDate(device.installationDate)) errors.push(`${deviceDisplayName(device)}: retiro antes de instalación.`);
    });
    Object.entries(draft.removals || {}).forEach(([episodeId, removalDate]) => {
      const episode = store.deviceEpisodes[episodeId];
      if (!removalDate) errors.push(`${episode?.deviceType || "Dispositivo"}: falta fecha de retiro.`);
      if (episode?.installationDate && removalDate < episode.installationDate) errors.push(`${episode.deviceType}: retiro antes de instalación.`);
    });
    if (draft.noInvasivesConfirmed && activeEpisodes(patientId, date).some(ep => !draft.removals?.[ep.episodeId])) {
      errors.push("Había invasivos activos. Confirme fecha de retiro o marque como incompleto.");
    }
    const newInvasives = (draft.deviceDrafts || []).some(packageCreatesDevice);
    if (requestedStatus === "revisado" && draft.activeRoundSection !== "iaas" && !draft.noInvasivesConfirmed && !newInvasives && !activeEpisodes(patientId, date).length) {
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

  function confirmHospitalDischarge(date, patientId) {
    const safeId = safeDomId(patientId);
    const type = document.querySelector(`#discharge-type-${safeId}`)?.value || DISCHARGE_TYPES[0];
    const dischargeDate = document.querySelector(`#discharge-date-${safeId}`)?.value || date;
    const dischargeShift = document.querySelector(`#discharge-shift-${safeId}`)?.value || DISCHARGE_SHIFTS.at(-1);
    applyHospitalDischarge(date, patientId, type, dischargeDate, dischargeShift);
  }

  function applyHospitalDischarge(date, patientId, type, dischargeDate, dischargeShift = "") {
    const patient = store.patients[patientId];
    if (!patient) return;
    const before = clone(patient);
    const normalizedDate = normalizeDate(dischargeDate) || date || isoToday();
    const shift = DISCHARGE_SHIFTS.find(item => normalizeText(item) === normalizeText(dischargeShift)) || DISCHARGE_SHIFTS.at(-1);
    const label = `${dischargeLabel(type, normalizedDate)} · TURNO ${shift}`;
    patient.hospitalizationStatus = "egresado";
    patient.presentInLatestCensus = false;
    patient.dischargeType = DISCHARGE_TYPES.find(item => normalizeText(item) === normalizeText(type)) || DISCHARGE_TYPES[0];
    patient.dischargeDate = normalizedDate;
    patient.dischargeShift = shift;
    patient.dischargeStatus = "confirmada";
    patient.dischargeReviewRequired = false;
    patient.observations = label;
    patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], [label]);
    patient.latestRoundStatus = "alerta";
    patient.updatedAt = nowIso();
    patient.updatedBy = currentUserId();
    const row = store.dailyCensus[date]?.patients?.[patientId];
    if (row) {
      row.present = false;
      row.dischargeConfirmed = true;
      row.dischargeReviewRequired = false;
      row.dischargeType = patient.dischargeType;
      row.dischargeDate = normalizedDate;
      row.dischargeShift = shift;
      row.dischargeStatus = "confirmada";
      row.observations = label;
      row.importAlerts = mergeUnique(row.importAlerts || [], [label]);
      row.notes = label;
      row.syncStatus = syncStatusForNewWrite();
    }
    const entry = store.dailyRounds[date]?.entries?.[patientId];
    if (entry) {
      entry.status = "alerta";
      entry.alertsGenerated = mergeUnique(entry.alertsGenerated || [], [label]);
      entry.notes = label;
      entry.syncStatus = syncStatusForNewWrite();
    }
    addAudit("PATIENT_DISCHARGE_CONFIRMED", { patientId, before, after: patient, roundDate: date, metadata: { dischargeType: patient.dischargeType, dischargeDate: normalizedDate, dischargeShift: shift } });
    saveStore();
    enqueueWrite({ type: "patientUpdate", patientId, patient });
    flashIaas("Alta hospitalaria confirmada para el censo.");
    renderIaas();
  }

  function markPatientStillHospitalized(date, patientId) {
    const patient = store.patients[patientId];
    if (!patient) return;
    const before = clone(patient);
    patient.hospitalizationStatus = "hospitalizado";
    patient.presentInLatestCensus = true;
    patient.dischargeReviewRequired = false;
    patient.dischargeStatus = null;
    patient.latestRoundStatus = "pendiente";
    patient.activePendingIssues = mergeUnique(patient.activePendingIssues || [], ["Alta descartada: sigue hospitalizado"]);
    patient.updatedAt = nowIso();
    patient.updatedBy = currentUserId();
    const row = store.dailyCensus[date]?.patients?.[patientId];
    if (row) {
      row.present = true;
      row.probableDischarge = false;
      row.dischargeReported = false;
      row.dischargeReviewRequired = false;
      row.reconciliationRequired = false;
      row.importAlerts = (row.importAlerts || []).filter(item => ![PROBABLE_DISCHARGE_MESSAGE, REPORTED_DISCHARGE_MESSAGE].includes(item));
      row.reviewStatus = "pendiente";
      row.notes = "Paciente confirmado como hospitalizado.";
      row.syncStatus = syncStatusForNewWrite();
    }
    const entry = store.dailyRounds[date]?.entries?.[patientId];
    if (entry) {
      entry.status = "pendiente";
      entry.alertsGenerated = (entry.alertsGenerated || []).filter(item => ![PROBABLE_DISCHARGE_MESSAGE, REPORTED_DISCHARGE_MESSAGE].includes(item));
      entry.notes = "Paciente confirmado como hospitalizado.";
      entry.syncStatus = syncStatusForNewWrite();
    }
    addAudit("PATIENT_STILL_HOSPITALIZED", { patientId, before, after: patient, roundDate: date });
    saveStore();
    enqueueWrite({ type: "patientUpdate", patientId, patient });
    flashIaas("Paciente marcado como hospitalizado.");
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
    const statsCache = ui.renderCache?.stats;
    if (statsCache?.has(date)) return statsCache.get(date);
    ensureDailyRound(date);
    const round = store.dailyRounds[date];
    const censusRows = getCensusRows(date);
    const entries = Object.values(round.entries || {});
    const episodes = deviceEpisodesForCurrentRender();
    const active = episodes.filter(ep => isEpisodeActiveOn(ep, date));
    const installedToday = episodes.filter(ep => ep.installationDate === date).length;
    const removedToday = episodes.filter(ep => ep.removalDate === date).length;
    const reinstallationsToday = episodes.filter(ep => ep.isReinstallation && ep.createdDuringRoundDate === date).length;
    const deviceDaysByType = {};
    const activeByPatient = new Map();
    active.forEach(ep => {
      deviceDaysByType[ep.deviceType] = (deviceDaysByType[ep.deviceType] || 0) + 1;
      const list = activeByPatient.get(ep.patientId) || [];
      list.push(ep);
      activeByPatient.set(ep.patientId, list);
    });
    const byService = {};
    censusRows.forEach(row => {
      byService[row.service] ||= { total: 0, reviewed: 0, devices: 0 };
      byService[row.service].total += 1;
      const entry = round.entries[row.patientId];
      if (entry && ["revisado", "alerta"].includes(entry.status)) byService[row.service].reviewed += 1;
      byService[row.service].devices += (activeByPatient.get(row.patientId) || []).length;
    });
    const alertPatients = Object.values(store.patients).flatMap(patient => {
      const patientEpisodes = activeByPatient.get(patient.patientId) || [];
      const hasEpisodeAlert = patientEpisodes.some(ep => ep.infectionSigns || deviceOver48h(ep, date));
      if (patient.latestRoundStatus !== "alerta" && !hasEpisodeAlert) return [];
      return [{ ...patient, reason: patientEpisodes.some(ep => ep.infectionSigns) ? "Signos de infección" : "Invasivo > 48 h" }];
    });
    const pending = entries.filter(entry => entry.status === "pendiente").length;
    const incomplete = entries.filter(entry => entry.status === "incompleto").length;
    const reconciliation = Object.values(store.patients).filter(patient => ["requiere_conciliación", "alta_probable", "alta_reportada"].includes(patient.hospitalizationStatus)).length;
    const stats = {
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
    if (statsCache) statsCache.set(date, stats);
    return stats;
  }

  function computeRangeStats(days) {
    const out = [];
    const today = new Date(`${activeDate()}T00:00:00`);
    const episodes = deviceEpisodesForCurrentRender();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const date = toIsoDate(d);
      const activeDevices = episodes.filter(ep => isEpisodeActiveOn(ep, date)).length;
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
      ...(report.dischargeRows || []).map(row => ({
        repeatCell: {
          range: gridRange(sheetId, row, row + 1, 11, 12),
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: "userEnteredFormat.textFormat.bold"
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
    const dischargeRows = items
      .map((item, index) => item.dischargePrintText ? headerRows.length + index : null)
      .filter(Number.isFinite);
    const spacerRow = Array(12).fill("");
    const bottomRows = printReportBottomRows(items, date);
    const bottomStartIndex = headerRows.length + patientRows.length + 1;
    const rows = [...headerRows, ...patientRows, spacerRow, ...bottomRows];
    return {
      rows,
      columns: 12,
      patientRows: patientRows.length,
      bottomStartIndex,
      dischargeRows,
      patientBreakRows: printReportServiceBreakRows(items, headerRows.length)
    };
  }

  function printReportPatientRow(item) {
    const ambulatory = isAmbulatoryStayService(item.service);
    const dischargeText = item.dischargePrintText || dischargePrintTextFor(item);
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
      cleanCell(dischargeText || item.observations || "SIN OBSERVACIONES").toUpperCase()
    ];
  }

  function dischargePrintTextFor(item) {
    const row = item?.row || item || {};
    const patient = item?.patient || store.patients?.[row.patientId] || {};
    const type = patient.dischargeType || row.dischargeType || item?.dischargeType || "";
    const date = patient.dischargeDate || row.dischargeDate || item?.dischargeDate || "";
    const status = patient.dischargeStatus || row.dischargeStatus || item?.dischargeStatus || "";
    const show = type && date && (
      status
      || patient.hospitalizationStatus === "egresado"
      || patient.hospitalizationStatus === "alta_reportada"
      || row.dischargeConfirmed
      || row.dischargeReported
    );
    return show ? dischargeLabel(type, date).toUpperCase() : "";
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
    const ai = SERVICES.indexOf(primaryService(a.service));
    const bi = SERVICES.indexOf(primaryService(b.service));
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
        if (op.action === "delete") batch.delete(ref);
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
      observationsDate: "",
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
      observationsDate: normalizeDate(source.observationsDate) || cleanCell(source.observationsDate),
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
        assessment[section][dateKey] = isoToday() || normalizeDate(date);
      }
    });
    if (assessment.observations && !assessment.observationsDate) {
      assessment.observationsDate = isoToday();
    }
    assessment.cultures = (assessment.cultures || []).map(culture => ({
      ...culture,
      collectionDate: normalizeDate(culture.collectionDate) || isoToday()
    }));
    assessment.treatments = (assessment.treatments || []).map(treatment => ({
      ...treatment,
      startDate: normalizeDate(treatment.startDate) || isoToday()
    }));
    return assessment;
  }

  function mergeIaasAssessmentForSave(previousValue, nextValue) {
    const previous = normalizeIaasAssessment(previousValue);
    const next = normalizeIaasAssessment(nextValue);
    const merged = normalizeIaasAssessment(previous);
    [
      ["vitalSigns", "studyDate"],
      ["cbc", "studyDate"],
      ["urinalysis", "studyDate"],
      ["otherStudies", "studyDate"],
      ["infectionTracking", "assessmentDate"]
    ].forEach(([section, dateKey]) => {
      if (iaasSectionHasValues(next[section], [dateKey])) merged[section] = next[section];
    });
    if ((next.cultures || []).length) merged.cultures = mergeCultureAssessments(previous.cultures, next.cultures);
    if ((next.treatments || []).length) merged.treatments = mergeTreatmentAssessments(previous.treatments, next.treatments);
    if (cleanCell(next.observations)) {
      merged.observations = cleanCell(next.observations);
      merged.observationsDate = normalizeDate(next.observationsDate) || isoToday();
    }
    return merged;
  }

  function mergeCultureAssessments(previousRows = [], nextRows = []) {
    const map = new Map();
    [...previousRows, ...nextRows].forEach(row => {
      const item = normalizeCultureTimelineItem(row, row.collectionDate || row.resultDate || isoToday());
      if (!item.type) return;
      const key = cultureTimelineKey(item);
      const previous = map.get(key);
      map.set(key, previous ? mergeCultureTimelineItem(previous, item) : item);
    });
    return [...map.values()];
  }

  function mergeTreatmentAssessments(previousRows = [], nextRows = []) {
    const map = new Map();
    [...previousRows, ...nextRows].forEach(row => {
      const item = normalizeTreatmentTimelineItem(row, row.startDate || row.endDate || isoToday());
      if (!item.drugName) return;
      const key = treatmentTimelineKey(item);
      const previous = map.get(key);
      map.set(key, previous ? mergeTreatmentTimelineItem(previous, item) : item);
    });
    return [...map.values()].map(item => ({
      drug: item.drug,
      customDrug: item.customDrug,
      startDate: item.startDate,
      endDate: item.endDate,
      notes: item.notes
    }));
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
    const isIaasNewCapture = requestedSection === "iaas" && !existing.editingIaasAssessment && !existing.iaasAssessment;
    const draft = {
      deviceDrafts: [],
      removals: {},
      pendingText: "",
      notes: savedEntry.notes || "",
      noInvasivesConfirmed: Boolean(savedEntry.noInvasivesConfirmed),
      activeRoundSection: savedEntry.activeRoundSection || "preventive",
      iaasAssessment: isIaasNewCapture ? defaultIaasAssessment() : normalizeIaasAssessment(savedEntry.iaasAssessment),
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
    scheduleDraftSave();
  }

  function updateDraft(date, patientId, patch) {
    const draft = { ...getReviewDraft(date, patientId), ...patch };
    setReviewDraft(date, patientId, draft);
  }

  function clearReviewDraft(date, patientId) {
    delete ui.reviewDrafts[`${date}:${patientId}`];
    ui.draftsDirty = true;
    flushDraftSave();
  }

  function clearReviewDraftAfterSave(date, patientId, section = "preventive") {
    clearReviewDraft(date, patientId);
    if (section !== "iaas") return;
    ui.reviewDrafts[`${date}:${patientId}`] = {
      activeRoundSection: "iaas",
      iaasAssessment: defaultIaasAssessment()
    };
    ui.draftsDirty = true;
    flushDraftSave();
  }

  function addDeviceDraft(date, patientId, type) {
    const draft = getReviewDraft(date, patientId);
    draft.noInvasivesConfirmed = false;
    draft.deviceDrafts = [...(draft.deviceDrafts || []), defaultPreventiveDevice(type)];
    setReviewDraft(date, patientId, draft);
    renderIaas();
  }

  function updateDeviceDraft(date, patientId, index, patch, rerender = true) {
    const draft = getReviewDraft(date, patientId);
    draft.deviceDrafts[index] = { ...(draft.deviceDrafts[index] || {}), ...patch };
    setReviewDraft(date, patientId, draft);
    if (rerender) renderIaas();
  }

  function removeDeviceDraft(date, patientId, index) {
    const draft = getReviewDraft(date, patientId);
    draft.deviceDrafts.splice(index, 1);
    setReviewDraft(date, patientId, draft);
    renderIaas();
  }

  function toggleNoInvasives(date, patientId) {
    if (activeEpisodes(patientId, date).length) {
      flashIaas("Este paciente tiene invasivos activos; no se puede marcar sin invasivos.");
      return;
    }
    const draft = getReviewDraft(date, patientId);
    draft.noInvasivesConfirmed = !draft.noInvasivesConfirmed;
    if (draft.noInvasivesConfirmed) draft.deviceDrafts = [];
    setReviewDraft(date, patientId, draft);
    renderIaas();
  }

  function updateRemovalDraft(draft, episodeId, value) {
    draft.removals ||= {};
    draft.removals[episodeId] = value;
    scheduleDraftSave();
  }

  function parseDelimitedText(text, fallbackDate = "") {
    const lines = text.replace(/\r/g, "").split("\n").filter(line => line.trim());
    if (!lines.length) return [];
    const delimiter = detectDelimiter(lines.reduce((best, line) => delimiterScore(line) > delimiterScore(best) ? line : best, lines[0]));
    const headerIndex = lines.findIndex(line => looksLikeImportHeader(splitCsvLine(line, delimiter)));
    const matrix = lines.map(line => splitCsvLine(line, delimiter));
    const hasHospitalLayout = matrix.some(row => looksLikeHospitalCensusHeader(row));
    if (headerIndex < 0 || hasHospitalLayout) {
      return rowsFromHeaderlessMatrix(matrix, fallbackDate);
    }
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

  function knownServiceFromText(value) {
    const key = normalizeText(value).replace(/\s+/g, " ");
    if (!key) return "";
    const exact = SERVICES.find(service => normalizeText(service) === key);
    if (exact) return exact;
    const aliases = [
      ["MEDICINA INTERNA", /\b(MI|MEDICINA\s+INTERNA|MED\s+INT)\b/],
      ["CIRUGÍA Y TRAUMATOLOGÍA", /\b(CX\s*TX|CX\s+TRAUMA|CIRUGIA\s+Y\s+TRAUMATOLOGIA|CIRUGIA|TRAUMATOLOGIA)\b/],
      ["PEDIATRÍA", /\b(PED|PEDS|PEDIATRIA)\b/],
      ["CUNEROS", /\b(CUNERO|CUNEROS|ESCOLAR|ESCOLARES)\b/],
      ["UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", /\b(UCIN|NEONATAL|NEONATALES)\b/],
      ["HEMODIÁLISIS", /\b(HEMO|HD|HEMODIALISIS)\b/],
      ["ONCOLOGÍA", /\b(ONCO|ONCOLOGIA)\b/],
      ["GINECOLOGÍA Y OBSTETRICIA", /\b(GYO|GO|GINECO|GINECOLOGIA|OBSTETRICIA)\b/],
      ["UNIDAD DE CUIDADOS INTENSIVOS PEDIÁTRICOS", /\b(UCIP|UTIP|UCI\s+PED)\b/],
      ["UNIDAD DE CUIDADOS INTENSIVOS ADULTOS", /\b(UCIA|UCI\s+ADULTO|UCI\s+ADULTOS|TERAPIA\s+INTENSIVA)\b/],
      ["URGENCIAS", /\b(URG|URGENCIAS|OBSERVACION|OBSERVACIÓN)\b/],
      ["AMBULATORIO", /\b(AMB|AMBULATORIO|CONSULTA\s+EXTERNA)\b/]
    ];
    const alias = aliases.find(([, pattern]) => pattern.test(key));
    if (alias) return alias[0];
    if (key.length < 3) return "";
    return SERVICES.find(service => key.includes(normalizeText(service)) || normalizeText(service).includes(key)) || "";
  }

  function looksLikeBedCell(value) {
    const text = normalizeText(value);
    if (!text || normalizeDate(value) || text.length > 24) return false;
    if (/[\/()]/.test(text)) return false;
    return Boolean(text && (/^(CAMA|CAM|SILLON|SILLÓN|AIS|AISLADO|AISLADA|OBS|OBSERVACION|OBSERVACIÓN|AMB|AMBULATORIO|A|B|C|UCIA|UCIN|UCIP|CUNERO|ESCOLAR|CUBICULO|CUBÍCULO|CAMILLA)[\s:-]*[A-Z0-9-]+(?:\s+[A-Z]{1,4})?$/.test(text) || /^\d{1,3}(?:\s|-)?[A-Z]{0,4}(?:\s+[A-Z]{1,4})?$/.test(text)));
  }

  function looksLikePatientNameCell(value) {
    const text = cleanCell(value);
    const normalized = normalizeText(text);
    if (!text || text.length < 5 || knownServiceFromText(text) || looksLikeBedCell(text) || looksLikeRfcCell(text)) return false;
    if (/\b(NOMBRE|PACIENTE|SERVICIO|FECHA|SECTOR|GUARDIA|MEDICO|PENDIENTES|ESPECIALIDAD)\b/.test(normalized)) return false;
    if (normalizeDate(text) || STATE_OPTIONS.some(option => normalizeText(option) === normalized)) return false;
    if (/[\/:;]/.test(text) && text.length > 40) return false;
    return /[A-ZÁÉÍÓÚÑ]{2,}\s+[A-ZÁÉÍÓÚÑ]{2,}/i.test(text);
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
      `NOMBRE DEL PACIENTE\tSERVICIO: CIRUGIA Y TRAUMATOLOGIA\t${formatDisplayDate(date)}\tSECTOR\tFECHA INGRESO\tHORA\tGUARDIA B\tDE\tESPECIALIDAD\tMEDICO\tPENDIENTES`,
      "49 CX\tLUNA SANTOS CLARA\t12/08/1936\t89\tAMERITA\tCALA640401-92\tF\tTUXTLA GUTIERREZ\tPIM\t05/05/26\t12:30\tEPISTAXIS SECUNDARIA A CONTUSION NASAL TRAUMATICA\tEPISTAXIS SECUNDARIA A TRAUMATISMO\t2\tOTORRINO\tDR. MICELI\tCITA CONSULTA EXTERNA ORL 9:00 AM",
      "50 CX\tMARIA OLGA CHACON RUIZ\t06/06/1955\t70\tAMERITA\tCARO550606-01\tF\tTUXTLA GUTIERREZ\tPIB\t30/04/2026\t01:00\tFX PROXIMAL HUMERO DERECHO\tFX PROXIMAL HUMERO DERECHO\t5\tTYO\tDR. SANCHEZ\tPROGRAMAR ARCO EN C",
      "51 CX\tMARIA DE LOURDES RINCON DURANTE\t15/03/1979\t47\tAMERITA\tZEGH460213-02\tF\tTUXTLA GUTIERREZ\tPIM\t20/04/2026\t14:00\tPROBABLE FISTULA ENTEROCUTANEA\tFISTULA ENTEROCUTANEA\t15\tCX\tDRA. MELCHOR\tSP"
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
    location.hash = `#/pacientes/${patientId}/expediente`;
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
    round.reconciliationPatients = Object.values(store.patients).filter(patient => ["requiere_conciliación", "alta_probable", "alta_reportada"].includes(patient.hospitalizationStatus)).length;
    round.activeAlerts = entries.filter(entry => entry.status === "alerta").length;
    round.localPendingWritesCount = entries.filter(entry => entry.syncStatus === "local_pending").length;
    round.serverSyncedWritesCount = entries.filter(entry => entry.syncStatus === "server_synced").length;
    round.errorWritesCount = entries.filter(entry => entry.syncStatus === "error").length;
    if (round.status === "in_progress" && round.pendingPatients === 0 && round.localPendingWritesCount === 0 && round.errorWritesCount === 0) {
      round.status = "ready_to_close";
    }
  }

  function getCensusRows(date) {
    const cache = ui.renderCache?.censusRows;
    if (cache?.has(date)) return cache.get(date).slice();
    const targetDate = censusDateFor(date);
    const rows = Object.values(store.dailyCensus[targetDate]?.patients || {}).filter(isActiveCensusRow);
    const normalizedRows = targetDate === date ? rows : rows.map(row => ({
      ...row,
      roundDate: date,
      fecha_censo: date
    }));
    if (cache) cache.set(date, normalizedRows);
    return normalizedRows.slice();
  }

  function isActiveCensusRow(row) {
    return Boolean(row)
      && row.present !== false
      && !row.probableDischarge
      && !row.reconciliationRequired
      && !row.dischargeConfirmed
      && !row.dischargeReviewRequired;
  }

  function censusDateFor(date) {
    const cache = ui.renderCache?.censusDates;
    if (cache?.has(date)) return cache.get(date);
    if (store.dailyCensus[date]?.patients) return date;
    const dates = Object.keys(store.dailyCensus || {})
      .filter(item => store.dailyCensus[item]?.patients)
      .sort();
    const previous = dates.filter(item => item <= date).pop();
    const resolved = previous || dates.at(-1) || date;
    if (cache) cache.set(date, resolved);
    return resolved;
  }

  function activeEpisodes(patientId, date) {
    const cache = ui.renderCache?.activeEpisodes;
    const key = `${patientId}|${date}`;
    if (cache?.has(key)) return cache.get(key);
    const episodes = deviceEpisodesForCurrentRender().filter(ep => ep.patientId === patientId && isEpisodeActiveOn(ep, date));
    if (cache) cache.set(key, episodes);
    return episodes;
  }

  function episodesForPatient(patientId) {
    const cache = ui.renderCache?.patientEpisodes;
    if (cache?.has(patientId)) return cache.get(patientId);
    const episodes = deviceEpisodesForCurrentRender().filter(ep => ep.patientId === patientId);
    if (cache) cache.set(patientId, episodes);
    return episodes;
  }

  function deviceEpisodesForCurrentRender() {
    return ui.renderCache?.deviceEpisodes || Object.values(store.deviceEpisodes || {});
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
      if (isIaasRiskRelevantEpisode(ep)) alerts.push(`Riesgo IAAS: invasivo relevante activo (${ep.deviceType})`);
      if (deviceOver48h(ep, isoToday())) alerts.push(`${ep.deviceType} > 48 h`);
      if (ep.infectionSigns || draft.deviceDrafts?.some(device => device.deviceType === ep.deviceType && device.infectionSigns)) alerts.push(`Alerta IAAS: signos de infección en ${ep.deviceType}`);
      if (ep.dressingCurrent === false) alerts.push(`Curación pendiente: ${ep.deviceType}`);
    });
    if (patient.hospitalizationStatus === "requiere_conciliación") alerts.push("Requiere conciliación");
    if (patient.hospitalizationStatus === "alta_probable") alerts.push(PROBABLE_DISCHARGE_MESSAGE);
    if (patient.hospitalizationStatus === "alta_reportada") alerts.push(REPORTED_DISCHARGE_MESSAGE);
    if (patient.dischargeStatus === "confirmada") alerts.push(dischargeLabel(patient.dischargeType, patient.dischargeDate));
    return unique(alerts);
  }

  function deviceOver48h(ep, date) {
    const days = daysBetween(ep.installationDate, date);
    return Number.isFinite(days) && days >= 2;
  }

  function nextPatientId(date, patientId) {
    const patient = store.patients[patientId] || {};
    const rows = roundNavigationRows(date, patientId, "preventive", patient);
    const index = rows.findIndex(row => row.patientId === patientId);
    return rows[index + 1]?.patientId || null;
  }

  function previousPatientId(date, patientId) {
    const patient = store.patients[patientId] || {};
    const rows = roundNavigationRows(date, patientId, "preventive", patient);
    const index = rows.findIndex(row => row.patientId === patientId);
    return rows[index - 1]?.patientId || null;
  }

  function nextIaasPatientId(date, patientId) {
    const rows = iaasFollowUpRows(date);
    const index = rows.findIndex(item => item.row.patientId === patientId);
    return rows[index + 1]?.row.patientId || null;
  }

  function previousIaasPatientId(date, patientId) {
    const rows = iaasFollowUpRows(date);
    const index = rows.findIndex(item => item.row.patientId === patientId);
    return rows[index - 1]?.row.patientId || null;
  }

  function navigationPatientId(date, patientId, section, direction) {
    if (section === "iaas") return direction === "previous" ? previousIaasPatientId(date, patientId) : nextIaasPatientId(date, patientId);
    return direction === "previous" ? previousPatientId(date, patientId) : nextPatientId(date, patientId);
  }

  function sortByServiceBed(a, b) {
    const ai = SERVICES.indexOf(primaryService(a.service));
    const bi = SERVICES.indexOf(primaryService(b.service));
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
    if (tag === "img") {
      node.decoding = "async";
      node.loading = attrs.loading || "lazy";
    }
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

  function scheduleDraftSave(delay = 350) {
    ui.draftsDirty = true;
    if (ui.draftSaveTimer) window.clearTimeout(ui.draftSaveTimer);
    ui.draftSaveTimer = window.setTimeout(flushDraftSave, delay);
  }

  function flushDraftSave() {
    if (ui.draftSaveTimer) {
      window.clearTimeout(ui.draftSaveTimer);
      ui.draftSaveTimer = null;
    }
    if (!ui.draftsDirty) return;
    ui.draftsDirty = false;
    saveJson(DRAFT_KEY, ui.reviewDrafts);
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
    if (!key.includes("/") && key.includes("HEMODI")) return "HEMODIÁLISIS";
    if (!key.includes("/") && key.includes("ONCOLOG")) return "ONCOLOGÍA";
    return SERVICES.find(service => normalizeText(service) === key) || mapped[key] || cleanCell(value).toUpperCase();
  }

  function serviceParts(value) {
    return cleanCell(value)
      .split(/\s*\/\s*/)
      .map(part => normalizeService(part))
      .filter(Boolean);
  }

  function serviceMatchesFilter(value, filter) {
    if (!filter || filter === "Todos") return true;
    const target = normalizeService(filter);
    const direct = normalizeService(value);
    return direct === target || serviceParts(value).includes(target);
  }

  function primaryService(value) {
    return serviceParts(value)[0] || normalizeService(value);
  }

  function isProtectedAmbulatoryService(value) {
    const key = normalizeText(primaryService(value));
    return key.includes("HEMODI") || key.includes("ONCOLOG") || PROTECTED_AMBULATORY_SERVICES.some(service => normalizeText(service) === key);
  }

  function isPlainAmbulatoryService(value) {
    return normalizeService(value) === "AMBULATORIO";
  }

  function isHospitalStayService(value) {
    const service = primaryService(value);
    return Boolean(service) && !isPlainAmbulatoryService(service) && !PROTECTED_AMBULATORY_SERVICES.includes(service);
  }

  function combinedServiceLabel(baseService, targetService) {
    const left = normalizeService(baseService);
    const right = normalizeService(targetService);
    return left && right && left !== right ? `${left} / ${right}` : right || left;
  }

  function splitServiceBed(value) {
    const text = cleanCell(value);
    if (!text) return { service: "", bed: "" };
    if (looksLikeBedCell(text)) {
      const serviceFromBed = serviceFromBedCell(text);
      if (serviceFromBed) return { service: serviceFromBed, bed: text };
    }
    const slashParts = text.split(/\s*\/\s*/).filter(Boolean);
    if (slashParts.length >= 2) {
      return { service: slashParts[0], bed: slashParts.slice(1).join(" / ") };
    }
    const bedMatch = text.match(/^(.*?)(?:\s+-\s+|\s+)(CAMA\s+.+|AIS[-\s]*.+|SILL[ÓO]N\s+.+)$/i);
    if (bedMatch) return { service: bedMatch[1], bed: bedMatch[2] };
    return { service: text, bed: "" };
  }

  function normalizeImportService(value) {
    return knownServiceFromText(value) || normalizeService(value || "");
  }

  function serviceFromBedCell(value) {
    const key = normalizeText(value);
    if (/\b(CX|TX|CIR|TRAUMA)\b/.test(key)) return "CIRUGÍA Y TRAUMATOLOGÍA";
    if (/\b(MI|MED\s*INT)\b/.test(key)) return "MEDICINA INTERNA";
    if (/\b(PED|PEDS)\b/.test(key)) return "PEDIATRÍA";
    if (/\b(CUNERO|CUNEROS|ESCOLAR|ESCOLARES)\b/.test(key)) return "CUNEROS";
    if (/\b(GYO|GO)\b/.test(key)) return "GINECOLOGÍA Y OBSTETRICIA";
    if (/\b(UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB)\b/.test(key)) return knownServiceFromText(key);
    return "";
  }

  function normalizeBed(value) {
    if (normalizeDate(value)) return "";
    const text = cleanCell(value)
      .replace(/^CAMA\s*[:#-]?\s*/i, "")
      .replace(/\s+/g, " ")
      .toUpperCase();
    if (/[\/()]/.test(text) || text.length > 24) return "";
    const cleaned = text
      .replace(/\s+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "")
      .replace(/(\d+)[\s-]+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UCIA|HEMO|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "$1")
      .trim();
    return cleaned;
  }

  function normalizeSex(value) {
    const key = normalizeText(value);
    if (["M", "MASCULINO", "HOMBRE"].includes(key)) return "M";
    if (["F", "FEMENINO", "MUJER"].includes(key)) return "F";
    return key ? cleanCell(value).toUpperCase() : null;
  }

  function normalizeImportSex(value) {
    const key = normalizeText(value);
    if (["M", "MASCULINO", "HOMBRE"].includes(key)) return "MASCULINO";
    if (["F", "FEMENINO", "MUJER"].includes(key)) return "FEMENINO";
    return "";
  }

  function parseAge(value) {
    const key = normalizeText(value);
    if (/\b(DIA|DIAS|MES|MESES|NEONATO|RN|RECIEN NACIDO)\b/.test(key)) return 0;
    const n = Number(String(value ?? "").match(/\d+/)?.[0]);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeImportAge(value) {
    const text = cleanCell(value);
    const key = normalizeText(text);
    const n = Number(text.match(/\d+/)?.[0]);
    if (!Number.isFinite(n)) return "";
    if (/\b(DIA|DIAS)\b/.test(key)) return `${n} ${n === 1 ? "día" : "días"}`;
    if (/\b(MES|MESES)\b/.test(key)) return `${n} ${n === 1 ? "mes" : "meses"}`;
    return n;
  }

  function ageFromBirthDate(birthDate, censusDate) {
    const birth = normalizeDate(birthDate);
    const census = normalizeDate(censusDate) || isoToday();
    if (!birth || !census) return null;
    const b = new Date(`${birth}T00:00:00`);
    const c = new Date(`${census}T00:00:00`);
    if (!Number.isFinite(b.getTime()) || !Number.isFinite(c.getTime()) || b > c) return null;
    let years = c.getFullYear() - b.getFullYear();
    const beforeBirthday = c.getMonth() < b.getMonth() || (c.getMonth() === b.getMonth() && c.getDate() < b.getDate());
    if (beforeBirthday) years -= 1;
    if (years >= 1) return years;
    const days = daysBetween(birth, census);
    if (days === null) return null;
    if (days < 31) return `${days} ${days === 1 ? "día" : "días"}`;
    const months = Math.max(1, Math.floor(days / 30.44));
    return `${months} ${months === 1 ? "mes" : "meses"}`;
  }

  function normalizeSectorImport(value) {
    const key = normalizeText(value).replace(/\s+/g, " ").trim();
    if (!key || ["NO APLICA", "SIN DATO", "SD", "S/D"].includes(key)) return "";
    if (["MAG", "MAGISTERIO"].includes(key)) return "MAGISTERIO";
    if (["BUR", "BUROCRACIA"].includes(key)) return "BUROCRACIA";
    if (["PIM", "PENSIONADO ISSTECH MAGISTERIO", "PENSIONADO MAGISTERIO"].includes(key)) return "PENSIONADO ISSTECH MAGISTERIO";
    if (["PIB", "PENSIONADO ISSTECH BUROCRACIA", "PENSIONADO BUROCRACIA"].includes(key)) return "PENSIONADO ISSTECH BUROCRACIA";
    if (key.includes("ISSTECH")) return key.includes("PENSIONADO") ? cleanCell(value).toUpperCase() : "ISSTECH";
    if (["PRIV", "PRIVADO", "PARTICULAR", "NA", "N/A"].includes(key)) return "PRIVADO";
    return "";
  }

  function normalizeImportState(value, service, bed) {
    const key = normalizeText(value);
    const explicit = STATE_OPTIONS.find(option => normalizeText(option) === key);
    if (explicit) return displayState(explicit);
    const serviceKey = normalizeText(service);
    const bedKey = normalizeText(bed);
    if (serviceKey === "AMBULATORIO") return "ESTABLE";
    if (/\b(AIS|AISLAD|OBS|OBSERVACION|OBSERVACIÓN|UCIA|UCIN|UCIP)\b/.test(`${serviceKey} ${bedKey}`)) return "GRAVE";
    return "DELICADO";
  }

  function normalizeImportDeih(value, admissionDate, censusDate, service) {
    if (isAmbulatoryStayService(service)) return "NA";
    const explicit = cleanCell(value).match(/\d+/)?.[0];
    if (explicit !== undefined) return Math.max(0, Number(explicit));
    const calculated = daysBetween(admissionDate, censusDate);
    return calculated === null ? null : calculated;
  }

  function excelSerialDateToIso(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 20000 || n > 80000) return "";
    const d = new Date(Math.round((n - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function normalizeDate(value) {
    const text = cleanCell(value);
    if (!text || normalizeText(text) === "AMB" || normalizeText(text) === "NA") return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validIsoDate(text) ? text : "";
    const m = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const year = m[3].length === 2 ? expandTwoDigitYear(m[3]) : m[3];
      const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      return validIsoDate(iso) ? iso : "";
    }
    if (/^\d+(?:\.\d+)?$/.test(text)) return excelSerialDateToIso(text);
    if (/[A-Za-zÁÉÍÓÚÑ]/i.test(text)) return "";
    const d = new Date(text);
    return Number.isFinite(d.getTime()) ? toIsoDate(d) : "";
  }

  function expandTwoDigitYear(value) {
    const n = Number(value);
    const current = new Date().getFullYear() % 100;
    return `${n <= current + 1 ? 2000 + n : 1900 + n}`;
  }

  function validIsoDate(iso) {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isFinite(d.getTime()) && toIsoDate(d) === iso;
  }

  function earliestIsoDate(a, b) {
    const left = normalizeDate(a);
    const right = normalizeDate(b);
    if (!left) return right;
    if (!right) return left;
    return left <= right ? left : right;
  }

  function toIsoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function isoToday() {
    return toIsoDate(new Date());
  }

  function activeDate() {
    return normalizeDate(ui.sheets.activeDate)
      || normalizeDate(store.activeDate)
      || latestCensusDate()
      || isoToday();
  }

  function latestCensusDate() {
    return Object.keys(store.dailyCensus || {})
      .map(normalizeDate)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  }

  function activeDateLabel() {
    const date = normalizeDate(activeDate()) || isoToday();
    return dayLabel(new Date(`${date}T00:00:00`));
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
    const fallback = [normalizedPatientNameKey(row.patient_name), row.fecha_nacimiento || "", row.sexo || "", row.fecha_ingreso || row.fecha_censo].map(cleanCell).join("|");
    return `px_${hashText(stable || fallback)}`;
  }

  function resolveImportPatientId(row) {
    const stable = cleanCell(row.patient_id || row.hospital_internal_id);
    if (stable) {
      const exact = Object.values(store.patients || {}).find(patient =>
        cleanCell(patient.hospitalInternalId) === stable
        || cleanCell(patient.pseudonymizedId) === stable
        || cleanCell(patient.displayCode) === stable
      );
      return exact?.patientId || `px_${hashText(stable)}`;
    }
    const existing = findExistingPatientForImport(row);
    if (existing) return existing.patientId;
    return createPatientId(row);
  }

  function findExistingPatientForImport(row) {
    const nameKey = normalizedPatientNameKey(row.patient_name);
    if (!nameKey) return null;
    const candidates = Object.values(store.patients || {}).filter(patient => normalizedPatientNameKey(patient.patientName) === nameKey);
    if (!candidates.length) return null;
    const active = candidates.find(patient => patient.hospitalizationStatus !== "egresado");
    if (active) return active;
    const sameAdmission = candidates.find(patient => normalizeDate(patient.admissionDate) && normalizeDate(patient.admissionDate) === normalizeDate(row.fecha_ingreso));
    if (sameAdmission) return sameAdmission;
    const sameDemographics = candidates.find(patient =>
      (row.fecha_nacimiento && normalizeDate(patient.birthDate) === normalizeDate(row.fecha_nacimiento))
      || (row.sexo && normalizeText(patient.sex) === normalizeText(row.sexo))
    );
    return sameDemographics || null;
  }

  function normalizedPatientNameKey(value) {
    return normalizeText(value).replace(/[^A-Z0-9]+/g, " ").replace(/\b(DE|DEL|LA|LAS|LOS|Y)\b/g, "").replace(/\s+/g, " ").trim();
  }

  function mergeImportRows(previous, current) {
    const merged = { ...previous };
    Object.entries(current).forEach(([key, value]) => {
      if (["diagnostico_actual", "dx_epidemiologico", "observaciones", "pendientes"].includes(key)) {
        merged[key] = mergeClinicalText(merged[key], value);
      } else if (!isBlankValue(value) || isBlankValue(merged[key])) {
        merged[key] = value;
      }
    });
    merged.servicio = current.servicio || previous.servicio;
    merged.cama = current.cama || previous.cama;
    return merged;
  }

  function mergeClinicalText(a, b) {
    const parts = cleanCell(`${a || ""} / ${b || ""}`)
      .split(/\s+\/\s+|\s*\|\s*|;\s*/)
      .map(cleanCell)
      .filter(Boolean);
    return unique(parts).join(" / ");
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
    const text = normalizeText(`${row.estado} ${row.riesgo_iaas} ${row.pendientes} ${row.diagnostico_actual}`);
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
      "requiere_conciliación": "Requiere conciliación",
      alta_probable: "Alta probable",
      alta_reportada: "Alta por verificar"
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
    return SECTOR_LABELS[key] || normalizeSectorImport(value) || "";
  }

  function sectorMatches(value, filterValue) {
    const left = normalizeSectorImport(value) || sectorLabel(value) || cleanCell(value);
    const right = normalizeSectorImport(filterValue) || sectorLabel(filterValue) || cleanCell(filterValue);
    return normalizeText(left) === normalizeText(right);
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

  if (window.__EPIVIDA_TEST_MODE__) {
    window.__EPIVIDA_TEST__ = {
      store,
      ui,
      buildImportDraft,
      parseDelimitedText,
      executeImportPlanLocalV2,
      buildImportWriteOpsV2,
      getCensusRows,
      commandPreventiveNotifications,
      probableDischargeNotificationRows,
      probableDischargeHistoryRows,
      movementNotificationRows,
      buildPrintReportModel,
      applyHospitalDischarge,
      serviceMatchesFilter,
      normalizeService,
      dischargePrintTextFor,
      isIaasFollowUpCandidate,
      getReviewDraft,
      setReviewDraft,
      addDeviceDraft,
      updateDeviceDraft,
      renderPatientRound,
      renderPatientExpediente,
      validateReviewDraft,
      defaultPreventiveDevice,
      packageCreatesDevice,
      preventiveCompliance,
      isoToday
    };
  }
})();

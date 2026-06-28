import { appConfig } from "../lib/config.js";

const PATIENTS = [
  {
    patientId: "p_uci_02",
    patientName: "Paciente QA UCIA",
    service: "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS",
    currentService: "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS",
    bed: "UCIA 2",
    currentBed: "UCIA 2",
    sector: "QA",
    sex: "F",
    age: 54,
    admissionDate: "2026-06-01",
    status: "DELICADO",
    currentState: "DELICADO",
    epidemiologicalDiagnosis: "RIESGO IAAS",
    currentEpidemiologicalDiagnosis: "RIESGO IAAS",
    hospitalDiagnosis: "Neumonia asociada a ventilacion en vigilancia",
    active: true
  },
  {
    patientId: "p_history",
    patientName: "Paciente QA Historial",
    service: "MEDICINA INTERNA",
    currentService: "MEDICINA INTERNA",
    bed: "12",
    currentBed: "12",
    sector: "QA",
    sex: "M",
    age: 67,
    admissionDate: "2026-05-29",
    status: "ESTABLE",
    currentState: "ESTABLE",
    epidemiologicalDiagnosis: "NO IAAS",
    currentEpidemiologicalDiagnosis: "NO IAAS",
    hospitalDiagnosis: "Posoperatorio con cateter venoso central",
    active: true
  },
  {
    patientId: "p_discharge",
    patientName: "Paciente QA Alta",
    service: "URGENCIAS",
    currentService: "URGENCIAS",
    bed: "CHOQUE",
    currentBed: "CHOQUE",
    sector: "QA",
    sex: "F",
    age: 42,
    admissionDate: "2026-06-02",
    status: "ESTABLE",
    currentState: "ESTABLE",
    epidemiologicalDiagnosis: "VIG NO TRANSMISIBLE",
    currentEpidemiologicalDiagnosis: "VIG NO TRANSMISIBLE",
    hospitalDiagnosis: "Alta probable por mejoria",
    probableDischarge: true,
    dischargeReviewRequired: true,
    opd: {
      address: "",
      phone: "",
      symptomStartDate: "2026-06-01",
      dischargeDate: "",
      uploaded: false,
      discharged: false
    },
    active: true
  }
];

const DEVICES = [
  {
    episodeId: "d_navm_uci_02",
    patientId: "p_uci_02",
    patientName: "Paciente QA UCIA",
    service: "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS",
    bed: "UCIA 2",
    deviceType: "Ventilacion mecanica",
    deviceSubtype: "Tubo endotraqueal",
    preventivePackage: "NAVM",
    anatomicalSite: "Tubo endotraqueal",
    installationDate: "2026-06-02",
    careStatus: "pendiente",
    infectionSigns: false,
    active: true
  },
  {
    episodeId: "d_cvc_history",
    patientId: "p_history",
    patientName: "Paciente QA Historial",
    service: "MEDICINA INTERNA",
    bed: "12",
    deviceType: "CVC",
    deviceSubtype: "Mahurkar",
    french: "12",
    preventivePackage: "ITS - CC",
    anatomicalSite: "Subclavio derecho",
    installationDate: "2026-05-31",
    careStatus: "completo",
    infectionSigns: false,
    active: true
  }
];

const ARCHIVED_DEVICES = [
  {
    episodeId: "d_cvc_history_removed",
    patientId: "p_history",
    patientName: "Paciente QA Historial",
    service: "MEDICINA INTERNA",
    bed: "12",
    deviceType: "CVC",
    deviceSubtype: "Mahurkar",
    french: "12",
    preventivePackage: "ITS - CC",
    anatomicalSite: "Yugular derecha",
    installationDate: "2026-05-29",
    removalDate: "2026-06-02",
    careStatus: "retirado",
    infectionSigns: false,
    active: false,
    status: "retirado"
  }
];

const ROUNDS = [
  {
    roundId: "2026-06-03_p_history",
    date: "2026-06-03",
    patientId: "p_history",
    patientName: "Paciente QA Historial",
    service: "MEDICINA INTERNA",
    bed: "12",
    status: "reviewed",
    packageReviews: [
      {
        packageType: "P.E. Y P.B.M.T.",
        deviceType: "CVC",
        deviceEpisodeId: "d_cvc_history",
        compliance: "100%",
        preventiveChecks: { handHygiene: "SI", dailyReview: "SI" },
        observations: "Revision sintetica local QA."
      }
    ],
    savedActions: ["Curacion revisada", "Sin datos de infeccion"],
    syncStatus: "server_synced"
  },
  {
    roundId: "2026-06-04_p_history",
    date: "2026-06-04",
    patientId: "p_history",
    patientName: "Paciente QA Historial",
    service: "MEDICINA INTERNA",
    bed: "12",
    status: "reviewed",
    packageReviews: [
      {
        packageType: "ITS - CC",
        deviceType: "CVC",
        deviceEpisodeId: "d_cvc_history",
        compliance: "75%",
        preventiveChecks: { handHygiene: "SI", dailyReview: "NO" },
        observations: "Pendiente reevaluar necesidad."
      }
    ],
    activePendingIssues: ["Revisar necesidad diaria de CVC"],
    syncStatus: "server_synced"
  }
];

const IAAS_CASES = [
  {
    iaasId: "iaas_history_its",
    patientId: "p_history",
    patientName: "Paciente QA Historial",
    service: "MEDICINA INTERNA",
    bed: "12",
    iaasType: "ITS-CVC",
    status: "sospecha",
    onsetDate: "2026-06-04",
    probableOrigin: "Cateter venoso central",
    criteria: "Fiebre persistente con CVC en seguimiento y cultivo pendiente.",
    criteriaVersion: "IAAS-LITE-2026-06",
    deviceEpisodeId: "d_cvc_history",
    vitalSigns: { temperature: "38.2 C", heartRate: "104", respiratoryRate: "22", bloodPressure: "110/70", spo2: "95%", fio2: "21%", peep: "" },
    labs: {
      biometry: "Leucocitosis leve",
      ego: "Sin datos",
      otherStudies: "Procalcitonina: pendiente",
      customStudies: [{ name: "Procalcitonina", value: "pendiente" }]
    },
    followUp: { reviewDate: "2026-06-05", evolution: "Sin deterioro hemodinamico.", carePlan: "Revalorar retiro de CVC y cultivo." },
    active: true,
    syncStatus: "server_synced"
  }
];

const CULTURES = [
  {
    cultureId: "culture_history_01",
    patientId: "p_history",
    iaasId: "iaas_history_its",
    sampleType: "Hemocultivo central y periferico",
    requestedAt: "2026-06-04",
    resultAt: "",
    organism: "Pendiente",
    susceptibility: "Pendiente",
    status: "solicitado"
  },
  {
    cultureId: "culture_history_negative",
    patientId: "p_history",
    iaasId: "iaas_history_negative",
    sampleType: "Urocultivo",
    requestedAt: "2026-06-25",
    resultAt: "2026-06-26",
    organism: "Sin desarrollo",
    susceptibility: "",
    status: "negativo"
  }
];

const ANTIMICROBIALS = [
  {
    antimicrobialId: "atb_history_01",
    patientId: "p_history",
    iaasId: "iaas_history_its",
    drug: "Vancomicina",
    startDate: "2026-06-04",
    endDate: "",
    indication: "Cobertura empirica por sospecha ITS-CVC",
    status: "activo"
  },
  {
    antimicrobialId: "atb_history_proph",
    patientId: "p_history",
    iaasId: "",
    drug: "Cefazolina",
    startDate: "2026-06-23",
    endDate: "",
    indication: "Profilaxis quirurgica",
    status: "profilaxis"
  },
  {
    antimicrobialId: "atb_history_adjusted",
    patientId: "p_history",
    iaasId: "iaas_history_negative",
    drug: "Meropenem",
    startDate: "2026-06-25",
    endDate: "",
    indication: "Ajuste por sospecha urinaria",
    status: "ajustado"
  }
];

const AUDIT_LOGS = [
  {
    auditId: "audit_device_removed_01",
    patientId: "p_history",
    actionType: "device_remove",
    module: "dispositivos",
    entityType: "device",
    entityId: "d_cvc_history_removed",
    userEmail: "test@epivida.local",
    createdAt: "2026-06-02T10:15:00.000Z"
  },
  {
    auditId: "audit_device_archive_update_01",
    patientId: "p_history",
    actionType: "device_archive_update",
    module: "dispositivos",
    entityType: "device_archive",
    entityId: "d_cvc_history_removed",
    userEmail: "test@epivida.local",
    createdAt: "2026-06-03T11:30:00.000Z"
  },
  {
    auditId: "audit_history_round_01",
    patientId: "p_history",
    actionType: "round_review",
    module: "ronda-paquetes",
    entityType: "nursing_round",
    entityId: "2026-06-04_p_history",
    userEmail: "test@epivida.local",
    createdAt: "2026-06-04T14:00:00.000Z"
  },
  {
    auditId: "audit_history_iaas_01",
    patientId: "p_history",
    actionType: "iaas_update",
    module: "epi-iaas",
    entityType: "iaas_case",
    entityId: "iaas_history_its",
    userEmail: "test@epivida.local",
    createdAt: "2026-06-05T09:20:00.000Z"
  }
];

const SYNTHETIC_SERVICES = [
  ["MEDICINA INTERNA", "MI"],
  ["CIRUGIA Y TRAUMATOLOGIA", "CX"],
  ["PEDIATRIA", "PED"],
  ["CUNEROS", "CUN"],
  ["UNIDAD DE CUIDADOS INTENSIVOS NEONATALES", "UCIN"],
  ["HEMODIALISIS", "HEM"],
  ["GINECOLOGIA Y OBSTETRICIA", "GYO"],
  ["UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS", "UTIP"],
  ["UNIDAD DE CUIDADOS INTENSIVOS ADULTOS", "UCIA"],
  ["URGENCIAS", "URG"]
];

const SYNTHETIC_DIAGNOSES = ["IAAS", "RIESGO IAAS", "NO IAAS", "VIG TRANSMISIBLE", "VIG NO TRANSMISIBLE"];
const SYNTHETIC_STATUS = ["ESTABLE", "DELICADO", "GRAVE", "MUY GRAVE"];
const SYNTHETIC_SEX = ["F", "M"];
const SYNTHETIC_LIMIT = 1000;

function requestedSyntheticPatients() {
  if (!testDataEnabled()) return 0;
  const params = new URLSearchParams(globalThis.location?.search || "");
  const count = Number(params.get("seedPatients") || params.get("qaPatients") || 0);
  if (!Number.isFinite(count) || count <= PATIENTS.length) return 0;
  return Math.min(SYNTHETIC_LIMIT, Math.floor(count)) - PATIENTS.length;
}

function syntheticBed(prefix, index) {
  if (prefix === "URG") return index % 5 === 0 ? "CHOQUE" : `UX ${index % 12 + 1}`;
  if (prefix === "GYO") return `ALOJ ${index % 8 + 1}`;
  if (prefix === "CUN") return `CUN ${index % 6 + 1}`;
  if (["UCIN", "UTIP", "UCIA", "HEM"].includes(prefix)) return `${prefix} ${index % 12 + 1}`;
  return String(index % 90 + 1);
}

function syntheticPatients(count) {
  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1;
    const [service, prefix] = SYNTHETIC_SERVICES[index % SYNTHETIC_SERVICES.length];
    const diagnosis = SYNTHETIC_DIAGNOSES[index % SYNTHETIC_DIAGNOSES.length];
    const status = SYNTHETIC_STATUS[index % SYNTHETIC_STATUS.length];
    return {
      patientId: `qa_patient_${String(sequence).padStart(4, "0")}`,
      patientName: `Paciente QA ${String(sequence).padStart(4, "0")}`,
      service,
      currentService: service,
      bed: syntheticBed(prefix, sequence),
      currentBed: syntheticBed(prefix, sequence),
      sector: "QA",
      sex: SYNTHETIC_SEX[index % SYNTHETIC_SEX.length],
      age: 18 + (index % 74),
      admissionDate: `2026-06-${String(index % 14 + 1).padStart(2, "0")}`,
      status,
      currentState: status,
      epidemiologicalDiagnosis: diagnosis,
      currentEpidemiologicalDiagnosis: diagnosis,
      hospitalDiagnosis: `Diagnostico sintetico ${diagnosis.toLowerCase()} ${prefix}`,
      syncStatus: index % 37 === 0 ? "local_pending" : "server_synced",
      active: true
    };
  });
}

export function testDataEnabled() {
  return appConfig().testMode;
}

export function testActivePatients() {
  if (!testDataEnabled()) return [];
  return [...PATIENTS, ...syntheticPatients(requestedSyntheticPatients())].map(row => ({ ...row }));
}

export function testActiveDevices() {
  return testDataEnabled() ? DEVICES.map(row => ({ ...row })) : [];
}

export function testArchivedDevicesForPatient(patientId = "") {
  if (!testDataEnabled() || !patientId) return [];
  return ARCHIVED_DEVICES.filter(row => row.patientId === patientId).map(row => ({ ...row }));
}

export function testRounds(date = "") {
  if (!testDataEnabled()) return [];
  return ROUNDS.filter(row => !date || row.date === date).map(row => ({ ...row }));
}

export function testRoundsForPatient(patientId = "") {
  if (!testDataEnabled() || !patientId) return [];
  return ROUNDS.filter(row => row.patientId === patientId).map(row => ({ ...row }));
}

export function testActiveIaas() {
  return testDataEnabled() ? IAAS_CASES.filter(row => row.active !== false).map(row => ({ ...row })) : [];
}

export function testIaasForPatient(patientId = "") {
  if (!testDataEnabled() || !patientId) return [];
  return IAAS_CASES.filter(row => row.patientId === patientId).map(row => ({ ...row }));
}

export function testCulturesForPatient(patientId = "") {
  if (!testDataEnabled() || !patientId) return [];
  return CULTURES.filter(row => row.patientId === patientId).map(row => ({ ...row }));
}

export function testCultures() {
  return testDataEnabled() ? CULTURES.map(row => ({ ...row })) : [];
}

export function testCulturesForIaas(iaasId = "") {
  if (!testDataEnabled() || !iaasId) return [];
  return CULTURES.filter(row => row.iaasId === iaasId).map(row => ({ ...row }));
}

export function testAntimicrobialsForPatient(patientId = "") {
  if (!testDataEnabled() || !patientId) return [];
  return ANTIMICROBIALS.filter(row => row.patientId === patientId).map(row => ({ ...row }));
}

export function testAntimicrobials() {
  return testDataEnabled() ? ANTIMICROBIALS.map(row => ({ ...row })) : [];
}

export function testAntimicrobialsForIaas(iaasId = "") {
  if (!testDataEnabled() || !iaasId) return [];
  return ANTIMICROBIALS.filter(row => row.iaasId === iaasId).map(row => ({ ...row }));
}

export function testAuditForPatient(patientId = "") {
  if (!testDataEnabled() || !patientId) return [];
  return AUDIT_LOGS.filter(row => row.patientId === patientId).map(row => ({ ...row }));
}

export function testAuditForEntity(entityId = "") {
  if (!testDataEnabled() || !entityId) return [];
  return AUDIT_LOGS.filter(row => row.entityId === entityId).map(row => ({ ...row }));
}

export function testAuditLogs() {
  return testDataEnabled() ? AUDIT_LOGS.map(row => ({ ...row })) : [];
}

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
    preventivePackage: "ITS - CC",
    anatomicalSite: "Subclavio derecho",
    installationDate: "2026-05-31",
    careStatus: "completo",
    infectionSigns: false,
    active: true
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

export function testRounds(date = "") {
  if (!testDataEnabled()) return [];
  return ROUNDS.filter(row => !date || row.date === date).map(row => ({ ...row }));
}

export function testRoundsForPatient(patientId = "") {
  if (!testDataEnabled() || !patientId) return [];
  return ROUNDS.filter(row => row.patientId === patientId).map(row => ({ ...row }));
}

import { listAuditForPatient } from "./auditService.js";
import { listAntimicrobialsForPatient } from "./antimicrobialService.js";
import { listCulturesForPatient } from "./cultureService.js";
import { activeDevice, listArchivedDevicesForPatient, listDevicesForPatient, mergeDeviceHistory } from "./deviceService.js";
import { listIaasForPatient } from "./iaasService.js";
import { getPatientById } from "./patientService.js";
import { listRoundsForPatient } from "./roundService.js";

const DEVICE_HISTORY_LIMIT = 50;
const CLINICAL_HISTORY_LIMIT = 50;

export async function loadPatientExpediente(patientId) {
  if (!patientId) return null;
  const [patientDoc, activeDeviceRows, archivedDeviceRows, rounds, iaasRows, cultures, antimicrobials, auditRows] = await Promise.all([
    getPatientById(patientId),
    listDevicesForPatient(patientId),
    listArchivedDevicesForPatient(patientId, { limit: DEVICE_HISTORY_LIMIT }),
    listRoundsForPatient(patientId),
    listIaasForPatient(patientId, { limit: CLINICAL_HISTORY_LIMIT }),
    listCulturesForPatient(patientId, { limit: CLINICAL_HISTORY_LIMIT }),
    listAntimicrobialsForPatient(patientId, { limit: CLINICAL_HISTORY_LIMIT }),
    listAuditForPatient(patientId, { limit: CLINICAL_HISTORY_LIMIT })
  ]);
  const patient = patientDoc || null;
  const devices = mergeDeviceHistory(activeDeviceRows, archivedDeviceRows);
  return {
    patient,
    devices,
    activeDevices: devices.filter(activeDevice),
    archivedDevices: archivedDeviceRows,
    rounds,
    iaasRows,
    cultures,
    antimicrobials,
    auditRows,
    limits: {
      devicesArchive: DEVICE_HISTORY_LIMIT,
      clinicalHistory: CLINICAL_HISTORY_LIMIT
    }
  };
}

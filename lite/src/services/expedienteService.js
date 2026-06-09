import { activeDevice, listArchivedDevicesForPatient, listDevicesForPatient, mergeDeviceHistory } from "./deviceService.js";
import { listActiveIaas } from "./iaasService.js";
import { listActivePatients } from "./patientService.js";
import { listRoundsForPatient } from "./roundService.js";

const DEVICE_HISTORY_LIMIT = 50;

export async function loadPatientExpediente(patientId) {
  if (!patientId) return null;
  const [patients, activeDeviceRows, archivedDeviceRows, rounds, iaasRows] = await Promise.all([
    listActivePatients(),
    listDevicesForPatient(patientId),
    listArchivedDevicesForPatient(patientId, { limit: DEVICE_HISTORY_LIMIT }),
    listRoundsForPatient(patientId),
    listActiveIaas()
  ]);
  const patient = patients.find(row => row.patientId === patientId) || null;
  const devices = mergeDeviceHistory(activeDeviceRows, archivedDeviceRows);
  return {
    patient,
    devices,
    activeDevices: devices.filter(activeDevice),
    archivedDevices: archivedDeviceRows,
    rounds,
    iaasRows: iaasRows.filter(row => row.patientId === patientId),
    limits: {
      devicesArchive: DEVICE_HISTORY_LIMIT
    }
  };
}

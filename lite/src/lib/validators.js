export function cleanText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function required(value) {
  return cleanText(value).length > 0;
}

export function validPatient(patient = {}) {
  return required(patient.patientName) && required(patient.service);
}

export function validDevice(device = {}) {
  return required(device.patientId) && required(device.deviceType) && required(device.installationDate);
}

export function validIaasCase(row = {}) {
  return required(row.patientId) && required(row.iaasType) && required(row.status);
}

export function stripUndefined(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

import { listAuditForPatient, pageAuditForPatient } from "./auditService.js";
import { listAntimicrobialsForPatient, pageAntimicrobialsForPatient } from "./antimicrobialService.js";
import { listCulturesForPatient, pageCulturesForPatient } from "./cultureService.js";
import { activeDevice, listArchivedDevicesForPatient, listDevicesForPatient, mergeDeviceHistory, pageArchivedDevicesForPatient } from "./deviceService.js";
import { listIaasForPatient, pageIaasForPatient } from "./iaasService.js";
import { getPatientById } from "./patientService.js";
import { listRoundsForPatient, pageRoundsForPatient } from "./roundService.js";

const DEVICE_HISTORY_LIMIT = 50;
const CLINICAL_HISTORY_LIMIT = 50;

export async function loadPatientExpediente(patientId) {
  if (!patientId) return null;
  const [patientDoc, activeDeviceRows, archivedDevicePage, roundsPage, iaasPage, culturesPage, antimicrobialsPage, auditPage] = await Promise.all([
    getPatientById(patientId),
    listDevicesForPatient(patientId),
    loadExpedienteSectionPage(patientId, "archivedDevices", { pageSize: DEVICE_HISTORY_LIMIT }),
    loadExpedienteSectionPage(patientId, "rounds", { pageSize: CLINICAL_HISTORY_LIMIT }),
    loadExpedienteSectionPage(patientId, "iaasRows", { pageSize: CLINICAL_HISTORY_LIMIT }),
    loadExpedienteSectionPage(patientId, "cultures", { pageSize: CLINICAL_HISTORY_LIMIT }),
    loadExpedienteSectionPage(patientId, "antimicrobials", { pageSize: CLINICAL_HISTORY_LIMIT }),
    loadExpedienteSectionPage(patientId, "auditRows", { pageSize: CLINICAL_HISTORY_LIMIT })
  ]);
  const patient = patientDoc || null;
  const archivedDeviceRows = archivedDevicePage.rows;
  const rounds = roundsPage.rows;
  const cultures = culturesPage.rows;
  const antimicrobials = antimicrobialsPage.rows;
  const iaasRows = attachIaasClinicalLinks(iaasPage.rows, cultures, antimicrobials);
  const auditRows = auditPage.rows;
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
    pages: {
      archivedDevices: pageMeta(archivedDevicePage),
      rounds: pageMeta(roundsPage),
      iaasRows: pageMeta(iaasPage),
      cultures: pageMeta(culturesPage),
      antimicrobials: pageMeta(antimicrobialsPage),
      auditRows: pageMeta(auditPage)
    },
    limits: {
      devicesArchive: DEVICE_HISTORY_LIMIT,
      clinicalHistory: CLINICAL_HISTORY_LIMIT
    }
  };
}

export async function loadExpedienteSectionPage(patientId, section, cursorState = {}) {
  const loader = sectionLoaders[section];
  if (!loader) throw new Error(`Seccion de expediente no soportada: ${section}`);
  return loader(patientId, cursorState);
}

const sectionLoaders = {
  archivedDevices: pageArchivedDevicesForPatient,
  rounds: pageRoundsForPatient,
  iaasRows: pageIaasForPatient,
  cultures: pageCulturesForPatient,
  antimicrobials: pageAntimicrobialsForPatient,
  auditRows: pageAuditForPatient
};

function pageMeta(page = {}) {
  return {
    firstCursor: page.firstCursor || null,
    lastCursor: page.lastCursor || null,
    hasNext: Boolean(page.hasNext),
    hasPrevious: Boolean(page.hasPrevious),
    pageSize: page.pageSize || CLINICAL_HISTORY_LIMIT
  };
}

function attachIaasClinicalLinks(rows = [], cultures = [], antimicrobials = []) {
  const culturesByCase = groupByIaasId(cultures);
  const antimicrobialsByCase = groupByIaasId(antimicrobials);
  return rows.map(row => {
    const id = row.iaasId || row.id;
    return {
      ...row,
      relatedCultures: id ? culturesByCase.get(id) || [] : [],
      relatedAntimicrobials: id ? antimicrobialsByCase.get(id) || [] : []
    };
  });
}

function groupByIaasId(rows = []) {
  return rows.reduce((map, row) => {
    const id = row.iaasId;
    if (!id) return map;
    const group = map.get(id) || [];
    group.push(row);
    map.set(id, group);
    return map;
  }, new Map());
}

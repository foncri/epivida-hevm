import { nowIso } from "../lib/date.js";
import { appConfig } from "../lib/config.js";
import { cleanText, stripUndefined } from "../lib/validators.js";
import { listCollectionWhere, paginateQuery } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";
import { testAntimicrobialsForIaas, testAntimicrobialsForPatient } from "./testDataService.js";

const ANTIMICROBIAL_PAGE_SIZE = 50;

function makeAntimicrobialId() {
  if (globalThis.crypto?.randomUUID) return `antimicrobial_${globalThis.crypto.randomUUID()}`;
  return `antimicrobial_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function byAntimicrobialId(rows = []) {
  return rows.reduce((map, row) => {
    const id = row.antimicrobialId || row.id;
    if (!id) return map;
    map.set(id, { ...map.get(id), ...row, antimicrobialId: id });
    return map;
  }, new Map());
}

async function mergePending(collectionRows = [], filter = () => true) {
  const map = byAntimicrobialId(collectionRows);
  const pending = await pendingPayloadsForCollection("antimicrobials");
  pending.filter(filter).forEach(row => {
    const id = row.antimicrobialId || row.id;
    map.set(id, { ...map.get(id), ...row, antimicrobialId: id });
  });
  return [...map.values()].sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")));
}

export async function listAntimicrobialsForPatient(patientId, options = {}) {
  if (!patientId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || ANTIMICROBIAL_PAGE_SIZE));
  if (appConfig().testMode) {
    return mergePending(testAntimicrobialsForPatient(patientId).slice(0, limit), row => row.patientId === patientId);
  }
  try {
    const rows = await listCollectionWhere("antimicrobials", [["patientId", "==", patientId]], {
      orderBy: [["startDate", "desc"]],
      limit
    });
    return mergePending(rows, row => row.patientId === patientId);
  } catch {
    return mergePending([], row => row.patientId === patientId);
  }
}

export async function pageAntimicrobialsForPatient(patientId, cursorState = {}) {
  if (!patientId) return emptyCursorPage([], cursorState.pageSize || ANTIMICROBIAL_PAGE_SIZE);
  const pageSize = Math.min(100, Math.max(1, Number(cursorState.pageSize) || ANTIMICROBIAL_PAGE_SIZE));
  if (appConfig().testMode) {
    return emptyCursorPage(await listAntimicrobialsForPatient(patientId, { limit: pageSize }), pageSize);
  }
  try {
    const page = await paginateQuery("antimicrobials", [["patientId", "==", patientId]], [["startDate", "desc"]], pageSize, cursorState, cursorState.direction || "next");
    const rows = (await mergePending(page.rows, row => row.patientId === patientId))
      .filter(row => row.patientId === patientId)
      .slice(0, page.pageSize);
    return { ...page, rows };
  } catch {
    return emptyCursorPage(await listAntimicrobialsForPatient(patientId, { limit: pageSize }), pageSize);
  }
}

export async function listAntimicrobialsForIaas(iaasId, options = {}) {
  if (!iaasId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || ANTIMICROBIAL_PAGE_SIZE));
  if (appConfig().testMode) {
    return mergePending(testAntimicrobialsForIaas(iaasId).slice(0, limit), row => row.iaasId === iaasId);
  }
  try {
    const rows = await listCollectionWhere("antimicrobials", [["iaasId", "==", iaasId]], {
      orderBy: [["startDate", "desc"]],
      limit
    });
    return mergePending(rows, row => row.iaasId === iaasId);
  } catch {
    return mergePending([], row => row.iaasId === iaasId);
  }
}

function emptyCursorPage(rows = [], pageSize = ANTIMICROBIAL_PAGE_SIZE) {
  return {
    rows,
    firstCursor: null,
    lastCursor: null,
    hasNext: false,
    hasPrevious: false,
    pageSize
  };
}

export async function saveAntimicrobial(app, antimicrobial = {}) {
  if (!antimicrobial.patientId || !antimicrobial.drug || !antimicrobial.startDate) {
    throw new Error("Antimicrobiano sin paciente, farmaco o fecha de inicio.");
  }
  const antimicrobialId = antimicrobial.antimicrobialId || makeAntimicrobialId();
  const payload = stripUndefined({
    ...antimicrobial,
    antimicrobialId,
    drug: cleanText(antimicrobial.drug, 160),
    indication: cleanText(antimicrobial.indication || "", 240),
    status: antimicrobial.status || "activo",
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || "",
    createdAt: antimicrobial.createdAt || nowIso(),
    createdBy: antimicrobial.createdBy || app.state.auth.user?.uid || "",
    source: antimicrobial.source || "lite_antimicrobial_service"
  });
  const saved = await setDocMergeOrQueue(app, `antimicrobials/${antimicrobialId}`, payload, {
    module: "epi-iaas",
    entityType: "antimicrobial",
    entityId: antimicrobialId
  });
  await writeAudit(app, {
    actionType: antimicrobial.antimicrobialId ? "antimicrobial_update" : "antimicrobial_create",
    module: "epi-iaas",
    entityType: "antimicrobial",
    entityId: antimicrobialId,
    patientId: antimicrobial.patientId,
    after: saved
  });
  return saved;
}

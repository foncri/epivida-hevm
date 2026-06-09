import { nowIso } from "../lib/date.js";
import { cleanText, stripUndefined } from "../lib/validators.js";
import { listCollectionWhere } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";

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

export async function listAntimicrobialsForIaas(iaasId, options = {}) {
  if (!iaasId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || ANTIMICROBIAL_PAGE_SIZE));
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

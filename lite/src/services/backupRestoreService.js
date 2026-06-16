import { nowIso } from "../lib/date.js";
import { cleanText, stripUndefined } from "../lib/validators.js";
import { writeAudit } from "./auditService.js";
import { setDocMergeOrQueue } from "./offlineQueueService.js";

const RESTORE_DATASETS = {
  patients_active: {
    label: "Pacientes activos",
    collection: "patients_active",
    idField: "patientId",
    entityType: "patient"
  },
  devices_active: {
    label: "Dispositivos activos",
    collection: "devices_active",
    idField: "episodeId",
    entityType: "device"
  },
  iaas_active: {
    label: "IAAS activas",
    collection: "iaas_active",
    idField: "iaasId",
    entityType: "iaas_case"
  },
  catalogs: {
    label: "Catalogos",
    collection: "catalogs",
    idField: "catalogId",
    entityType: "catalog"
  }
};

const RESTORE_CHUNK_SIZE = 25;

export function restoreDatasetOptions() {
  return Object.entries(RESTORE_DATASETS).map(([key, config]) => ({ key, ...config }));
}

export function parseOperationalBackupText(text = "") {
  const payload = JSON.parse(text);
  if (!payload || typeof payload !== "object" || !payload.datasets || typeof payload.datasets !== "object") {
    throw new Error("El JSON no contiene datasets de respaldo EPIVIDA.");
  }
  return payload;
}

export function summarizeOperationalBackup(backup = {}) {
  const datasets = backup.datasets || {};
  return Object.keys(datasets).sort().map(key => {
    const rows = Array.isArray(datasets[key]) ? datasets[key] : [];
    const config = RESTORE_DATASETS[key];
    return {
      key,
      label: config?.label || key,
      count: rows.length,
      supported: Boolean(config),
      idField: config?.idField || "",
      collection: config?.collection || ""
    };
  });
}

export async function restoreOperationalBackup(app, backup = {}, selectedKeys = [], options = {}) {
  const selected = selectedKeys.filter(key => RESTORE_DATASETS[key]);
  if (!selected.length) throw new Error("Selecciona al menos un dataset restaurable.");
  const maxRows = Math.min(5000, Math.max(1, Number(options.maxRows) || 1000));
  const restoredAt = nowIso();
  const restoredBy = app.state.auth.user?.uid || "";
  const results = [];

  for (const key of selected) {
    const config = RESTORE_DATASETS[key];
    const rows = Array.isArray(backup.datasets?.[key]) ? backup.datasets[key] : [];
    const limitedRows = rows.slice(0, maxRows);
    let written = 0;
    let skipped = rows.length - limitedRows.length;

    for (const row of limitedRows) {
      const id = restoreRowId(row, config.idField);
      if (!id) {
        skipped += 1;
        continue;
      }
      const payload = stripUndefined({
        ...row,
        [config.idField]: id,
        restoredAt,
        restoredBy,
        restoredFromBackupSchema: cleanText(backup.schema || "epivida-lite-operational-backup", 120),
        restoredFromBackupCreatedAt: cleanText(backup.createdAt || "", 80)
      });
      await setDocMergeOrQueue(app, `${config.collection}/${id}`, payload, {
        module: "admin",
        entityType: config.entityType,
        entityId: id
      });
      written += 1;
      if (written % RESTORE_CHUNK_SIZE === 0) await yieldToBrowser();
    }

    results.push({
      key,
      label: config.label,
      written,
      skipped,
      total: rows.length,
      truncated: rows.length > limitedRows.length
    });
  }

  await writeAudit(app, {
    actionType: "backup_restore",
    module: "admin",
    entityType: "operational_backup",
    entityId: restoredAt,
    after: {
      schema: backup.schema || "",
      createdAt: backup.createdAt || "",
      selected,
      maxRows,
      results
    }
  });
  return { restoredAt, results };
}

function restoreRowId(row = {}, idField = "") {
  const raw = row[idField] || row.id || "";
  return cleanText(raw, 180).replace(/[\\/#?]/g, "_");
}

function yieldToBrowser() {
  return new Promise(resolve => globalThis.setTimeout(resolve, 0));
}

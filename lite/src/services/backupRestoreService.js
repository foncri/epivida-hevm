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
  },
  daily_snapshots: {
    label: "Snapshots diarios",
    collection: "daily_snapshots",
    idField: "date",
    entityType: "daily_snapshot"
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

export function restoreOperationalBackupPlan(backup = {}, selectedKeys = [], options = {}) {
  const selected = [...new Set(selectedKeys)].filter(Boolean);
  const unsupported = selected.filter(key => !RESTORE_DATASETS[key]);
  const supported = selected.filter(key => RESTORE_DATASETS[key]);
  if (!supported.length) throw new Error("Selecciona al menos un dataset restaurable.");

  const maxRows = Math.min(5000, Math.max(1, Number(options.maxRows) || 1000));
  const datasets = supported.map(key => {
    const config = RESTORE_DATASETS[key];
    const rows = Array.isArray(backup.datasets?.[key]) ? backup.datasets[key] : [];
    const limitedRows = rows.slice(0, maxRows);
    const validRows = [];
    let invalidRows = rows.length - limitedRows.length;

    for (const row of limitedRows) {
      if (!isRecord(row)) {
        invalidRows += 1;
        continue;
      }
      const id = restoreRowId(row, config.idField);
      if (!id) {
        invalidRows += 1;
        continue;
      }
      validRows.push({ row, id });
    }

    return {
      key,
      label: config.label,
      collection: config.collection,
      idField: config.idField,
      entityType: config.entityType,
      total: rows.length,
      writable: validRows.length,
      skipped: invalidRows,
      truncated: rows.length > limitedRows.length,
      validRows
    };
  });

  return {
    schema: cleanText(backup.schema || "epivida-lite-operational-backup", 120),
    createdAt: cleanText(backup.createdAt || "", 80),
    selected: supported,
    unsupported,
    maxRows,
    datasets,
    total: datasets.reduce((sum, item) => sum + item.total, 0),
    writable: datasets.reduce((sum, item) => sum + item.writable, 0),
    skipped: datasets.reduce((sum, item) => sum + item.skipped, 0)
  };
}

export async function restoreOperationalBackup(app, backup = {}, selectedKeys = [], options = {}) {
  const plan = restoreOperationalBackupPlan(backup, selectedKeys, options);
  const restoredAt = nowIso();
  const restoredBy = app.state.auth.user?.uid || "";
  const restoreRunId = `restore_${restoredAt.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const results = [];

  for (const dataset of plan.datasets) {
    let written = 0;

    for (const { row, id } of dataset.validRows) {
      const payload = stripUndefined({
        ...row,
        [dataset.idField]: id,
        restoredAt,
        restoredBy,
        restoreRunId,
        restoredFromBackupSchema: plan.schema,
        restoredFromBackupCreatedAt: plan.createdAt
      });
      await setDocMergeOrQueue(app, `${dataset.collection}/${id}`, payload, {
        module: "admin",
        entityType: dataset.entityType,
        entityId: id
      });
      written += 1;
      if (written % RESTORE_CHUNK_SIZE === 0) await yieldToBrowser();
    }

    results.push({
      key: dataset.key,
      label: dataset.label,
      written,
      skipped: dataset.skipped,
      total: dataset.total,
      truncated: dataset.truncated
    });
  }

  await writeAudit(app, {
    actionType: "backup_restore",
    module: "admin",
    entityType: "operational_backup",
    entityId: restoreRunId,
    after: {
      schema: plan.schema,
      createdAt: plan.createdAt,
      selected: plan.selected,
      unsupported: plan.unsupported,
      maxRows: plan.maxRows,
      restoreRunId,
      results
    }
  });
  return { restoredAt, restoreRunId, results, unsupported: plan.unsupported };
}

function restoreRowId(row = {}, idField = "") {
  const raw = row[idField] || row.id || "";
  return cleanText(raw, 180).replace(/[\\/#?]/g, "_");
}

function isRecord(row) {
  return Boolean(row) && typeof row === "object" && !Array.isArray(row);
}

function yieldToBrowser() {
  return new Promise(resolve => globalThis.setTimeout(resolve, 0));
}

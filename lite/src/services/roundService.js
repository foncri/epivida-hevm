import { todayIso, nowIso } from "../lib/date.js";
import { listCollection } from "./firestoreService.js";
import { writeAudit } from "./auditService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";

async function mergePending(rows = []) {
  const map = rows.reduce((acc, row) => acc.set(row.roundId || row.id, row), new Map());
  const pending = await pendingPayloadsForCollection("nursing_rounds");
  pending.forEach(row => map.set(row.roundId || row.id, { ...map.get(row.roundId || row.id), ...row }));
  return [...map.values()];
}

export async function listTodayRounds(date = todayIso()) {
  try {
    const rows = await listCollection("nursing_rounds");
    return (await mergePending(rows)).filter(row => row.date === date);
  } catch {
    return (await mergePending([])).filter(row => row.date === date);
  }
}

export async function saveRoundReview(app, review) {
  const roundId = review.roundId || `${review.date || todayIso()}_${review.patientId}`;
  const payload = {
    ...review,
    roundId,
    date: review.date || todayIso(),
    status: review.status || "reviewed",
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || ""
  };
  const saved = await setDocMergeOrQueue(app, `nursing_rounds/${roundId}`, payload, {
    module: "ronda-paquetes",
    entityType: "nursing_round",
    entityId: roundId
  });
  await writeAudit(app, {
    actionType: "round_review",
    module: "ronda-paquetes",
    entityType: "nursing_round",
    entityId: roundId,
    patientId: review.patientId,
    after: saved
  });
  return saved;
}

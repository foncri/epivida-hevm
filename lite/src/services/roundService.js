import { todayIso, nowIso } from "../lib/date.js";
import { listCollection, setDocMerge } from "./firestoreService.js";
import { writeAudit } from "./auditService.js";

export async function listTodayRounds(date = todayIso()) {
  try {
    const rows = await listCollection("nursing_rounds");
    return rows.filter(row => row.date === date);
  } catch {
    return [];
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
  await setDocMerge(`nursing_rounds/${roundId}`, payload);
  await writeAudit(app, {
    actionType: "round_review",
    module: "ronda-paquetes",
    entityType: "nursing_round",
    entityId: roundId,
    patientId: review.patientId,
    after: payload
  });
  return payload;
}

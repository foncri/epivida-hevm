import { todayIso, nowIso } from "../lib/date.js";
import { getDocData, listCollectionWhere } from "./firestoreService.js";
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
    const rows = await listCollectionWhere("nursing_rounds", [["date", "==", date]]);
    return (await mergePending(rows)).filter(row => row.date === date);
  } catch {
    return (await mergePending([])).filter(row => row.date === date);
  }
}

export async function listRoundsForPatient(patientId) {
  if (!patientId) return [];
  try {
    const rows = await listCollectionWhere("nursing_rounds", [["patientId", "==", patientId]]);
    return (await mergePending(rows))
      .filter(row => row.patientId === patientId)
      .sort((a, b) => String(a.date || a.roundDate || "").localeCompare(String(b.date || b.roundDate || "")));
  } catch {
    return (await mergePending([]))
      .filter(row => row.patientId === patientId)
      .sort((a, b) => String(a.date || a.roundDate || "").localeCompare(String(b.date || b.roundDate || "")));
  }
}

export async function roundSessionForDate(date = todayIso()) {
  const sessionId = date;
  const pending = await pendingPayloadsForCollection("round_sessions");
  const pendingSession = pending.find(row => (row.sessionId || row.id) === sessionId || row.date === date);
  try {
    const saved = await getDocData(`round_sessions/${sessionId}`);
    return {
      ...(saved || {}),
      ...(pendingSession || {})
    };
  } catch {
    return pendingSession || null;
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

export async function saveRoundSession(app, session) {
  const date = session.date || todayIso();
  const sessionId = session.sessionId || date;
  const payload = {
    ...session,
    sessionId,
    date,
    status: session.status || "in_progress",
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || ""
  };
  const saved = await setDocMergeOrQueue(app, `round_sessions/${sessionId}`, payload, {
    module: "ronda-paquetes",
    entityType: "round_session",
    entityId: sessionId
  });
  await writeAudit(app, {
    actionType: "round_session_update",
    module: "ronda-paquetes",
    entityType: "round_session",
    entityId: sessionId,
    after: saved
  });
  return saved;
}

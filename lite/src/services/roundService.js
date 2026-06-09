import { appConfig } from "../lib/config.js";
import { todayIso, nowIso } from "../lib/date.js";
import { getDocData, listCollectionWhere, paginateQuery } from "./firestoreService.js";
import { writeAudit } from "./auditService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { testRounds, testRoundsForPatient } from "./testDataService.js";

const todayRoundsPromises = new Map();
const patientRoundsPromises = new Map();
const roundSessionPromises = new Map();
const ROUND_HISTORY_LIMIT = 50;

async function mergePending(rows = []) {
  const map = rows.reduce((acc, row) => acc.set(row.roundId || row.id, row), new Map());
  const pending = await pendingPayloadsForCollection("nursing_rounds");
  pending.forEach(row => map.set(row.roundId || row.id, { ...map.get(row.roundId || row.id), ...row }));
  return [...map.values()];
}

async function mergePendingForPatient(patientId, rows = []) {
  const map = rows.reduce((acc, row) => acc.set(row.roundId || row.id, row), new Map());
  const pending = await pendingPayloadsForCollection("nursing_rounds");
  pending
    .filter(row => row.patientId === patientId)
    .forEach(row => map.set(row.roundId || row.id, { ...map.get(row.roundId || row.id), ...row }));
  return [...map.values()].sort((a, b) => roundDateValue(b).localeCompare(roundDateValue(a)));
}

function roundDateValue(round = {}) {
  return String(round.date || round.roundDate || round.reviewDate || "");
}

async function loadTodayRounds(date = todayIso()) {
  if (appConfig().testMode) {
    return (await mergePending(testRounds(date))).filter(row => row.date === date);
  }
  try {
    const rows = await listCollectionWhere("nursing_rounds", [["date", "==", date]]);
    return (await mergePending([...testRounds(date), ...rows])).filter(row => row.date === date);
  } catch {
    return (await mergePending(testRounds(date))).filter(row => row.date === date);
  }
}

export async function listTodayRounds(date = todayIso()) {
  const key = date || todayIso();
  if (!todayRoundsPromises.has(key)) {
    todayRoundsPromises.set(key, loadTodayRounds(key).finally(() => {
      todayRoundsPromises.delete(key);
    }));
  }
  return todayRoundsPromises.get(key);
}

async function loadRoundsForPatient(patientId, limit = ROUND_HISTORY_LIMIT) {
  const pageSize = Math.min(100, Math.max(1, Number(limit) || ROUND_HISTORY_LIMIT));
  if (appConfig().testMode) {
    return (await mergePendingForPatient(patientId, testRoundsForPatient(patientId)))
      .filter(row => row.patientId === patientId)
      .slice(0, pageSize);
  }
  try {
    const rows = await listCollectionWhere("nursing_rounds", [["patientId", "==", patientId]], {
      orderBy: [["date", "desc"]],
      limit: pageSize
    });
    return (await mergePendingForPatient(patientId, rows))
      .filter(row => row.patientId === patientId)
      .slice(0, pageSize);
  } catch {
    return (await mergePendingForPatient(patientId, testRoundsForPatient(patientId)))
      .filter(row => row.patientId === patientId)
      .slice(0, pageSize);
  }
}

function invalidatePatientRounds(patientId) {
  if (!patientId) return;
  for (const key of [...patientRoundsPromises.keys()]) {
    if (key.startsWith(`${patientId}:`)) patientRoundsPromises.delete(key);
  }
}

export async function listRoundsForPatient(patientId, options = {}) {
  if (!patientId) return [];
  const limit = Math.min(100, Math.max(1, Number(options.limit) || ROUND_HISTORY_LIMIT));
  const key = `${patientId}:${limit}`;
  if (!patientRoundsPromises.has(key)) {
    patientRoundsPromises.set(key, loadRoundsForPatient(patientId, limit).finally(() => {
      patientRoundsPromises.delete(key);
    }));
  }
  return patientRoundsPromises.get(key);
}

export async function pageRoundsForPatient(patientId, cursorState = {}) {
  if (!patientId) return emptyPage(cursorState);
  const pageSize = Math.min(100, Math.max(1, Number(cursorState.pageSize) || ROUND_HISTORY_LIMIT));
  if (appConfig().testMode) {
    return emptyCursorPage(await listRoundsForPatient(patientId, { limit: pageSize }), pageSize);
  }
  try {
    const page = await paginateQuery("nursing_rounds", [["patientId", "==", patientId]], [["date", "desc"]], pageSize, cursorState, cursorState.direction || "next");
    const rows = (await mergePendingForPatient(patientId, page.rows))
      .filter(row => row.patientId === patientId)
      .slice(0, page.pageSize);
    return { ...page, rows };
  } catch {
    return emptyCursorPage(await listRoundsForPatient(patientId, { limit: pageSize }), pageSize);
  }
}

function emptyPage(cursorState = {}) {
  const pageSize = Math.min(100, Math.max(1, Number(cursorState.pageSize) || ROUND_HISTORY_LIMIT));
  return emptyCursorPage([], pageSize);
}

function emptyCursorPage(rows = [], pageSize = ROUND_HISTORY_LIMIT) {
  return {
    rows,
    firstCursor: null,
    lastCursor: null,
    hasNext: false,
    hasPrevious: false,
    pageSize
  };
}

async function loadRoundSessionForDate(date = todayIso()) {
  const sessionId = date;
  const pending = await pendingPayloadsForCollection("round_sessions");
  const pendingSession = pending.find(row => (row.sessionId || row.id) === sessionId || row.date === date);
  if (appConfig().testMode) return pendingSession || null;
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

export async function roundSessionForDate(date = todayIso()) {
  const key = date || todayIso();
  if (!roundSessionPromises.has(key)) {
    roundSessionPromises.set(key, loadRoundSessionForDate(key).finally(() => {
      roundSessionPromises.delete(key);
    }));
  }
  return roundSessionPromises.get(key);
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
  todayRoundsPromises.delete(payload.date);
  invalidatePatientRounds(payload.patientId);
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
  roundSessionPromises.delete(date);
  await writeAudit(app, {
    actionType: "round_session_update",
    module: "ronda-paquetes",
    entityType: "round_session",
    entityId: sessionId,
    after: saved
  });
  return saved;
}

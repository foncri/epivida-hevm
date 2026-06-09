import { nowIso } from "../lib/date.js";
import { appConfig } from "../lib/config.js";
import { cleanText, stripUndefined } from "../lib/validators.js";
import { knownRole, normalizeRole } from "../lib/security.js";
import { getDocData, listCollection, setDocMerge } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";
import { writeAudit } from "./auditService.js";

const TEST_USERS = [
  {
    uid: "test-user",
    email: "test@epivida.local",
    displayName: "Prueba local",
    role: "admin_epidemiologia",
    active: true,
    defaultRoute: "inicio"
  }
];

export async function getUserProfile(uid) {
  const profile = await getDocData(`users/${uid}`);
  if (!profile) throw new Error("Usuario sin perfil en Firestore.");
  return profile;
}

export async function getRequiredUserProfile(user) {
  return getUserProfile(user.uid);
}

export async function touchLastLogin(uid) {
  await setDocMerge(`users/${uid}`, { lastLoginAt: nowIso(), updatedAt: nowIso() });
}

function byUid(rows = []) {
  return rows.reduce((map, row) => {
    const uid = row.uid || row.id;
    if (!uid) return map;
    map.set(uid, { ...map.get(uid), ...row, uid });
    return map;
  }, new Map());
}

async function mergePendingUsers(rows = []) {
  const map = byUid(rows);
  const pending = await pendingPayloadsForCollection("users");
  pending.forEach(row => map.set(row.uid || row.id, { ...map.get(row.uid || row.id), ...row }));
  return [...map.values()];
}

export async function listUserProfiles() {
  if (appConfig().testMode) return mergePendingUsers(TEST_USERS);
  try {
    return mergePendingUsers(await listCollection("users"));
  } catch {
    return mergePendingUsers([]);
  }
}

async function existingUserProfile(uid) {
  if (appConfig().testMode) return TEST_USERS.find(row => row.uid === uid) || null;
  try {
    return await getDocData(`users/${uid}`);
  } catch {
    return null;
  }
}

export async function saveUserProfile(app, profile = {}) {
  const uid = cleanText(profile.uid, 160);
  const email = cleanText(profile.email, 240).toLowerCase();
  const role = normalizeRole(profile.role);
  if (!uid) throw new Error("Usuario sin UID.");
  if (!email) throw new Error("Usuario sin correo.");
  if (!knownRole(role)) throw new Error("Rol no permitido.");
  const payload = stripUndefined({
    uid,
    email,
    displayName: cleanText(profile.displayName, 240),
    role,
    active: profile.active === true,
    defaultRoute: cleanText(profile.defaultRoute, 80) || "",
    createdAt: profile.createdAt || nowIso(),
    createdBy: profile.createdBy || app.state.auth.user?.uid || "",
    updatedAt: nowIso(),
    updatedBy: app.state.auth.user?.uid || ""
  });
  const before = await existingUserProfile(uid);
  const saved = await setDocMergeOrQueue(app, `users/${uid}`, payload, {
    module: "admin",
    entityType: "user",
    entityId: uid
  });
  await writeAudit(app, {
    actionType: before ? "user_profile_update" : "user_profile_create",
    module: "admin",
    entityType: "user",
    entityId: uid,
    before,
    after: saved
  });
  return saved;
}

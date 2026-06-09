import { nowIso } from "../lib/date.js";
import { appConfig } from "../lib/config.js";
import { cleanText, stripUndefined } from "../lib/validators.js";
import { knownRole, normalizeRole } from "../lib/security.js";
import { getDocData, listCollection, setDocMerge } from "./firestoreService.js";
import { pendingPayloadsForCollection, setDocMergeOrQueue } from "./offlineQueueService.js";

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

const BOOTSTRAP_ADMIN_EMAILS = new Set(["todofoncri@gmail.com"]);

function authEmail(user) {
  return cleanText(user?.email, 240).toLowerCase();
}

function canBootstrapAdmin(user) {
  return Boolean(user?.uid && BOOTSTRAP_ADMIN_EMAILS.has(authEmail(user)));
}

function isProfileReadBlocked(error) {
  const text = String(`${error?.code || ""} ${error?.message || ""}`).toLowerCase();
  return text.includes("permission-denied")
    || text.includes("missing or insufficient permissions")
    || text.includes("usuario sin perfil");
}

export async function getUserProfile(uid) {
  const profile = await getDocData(`users/${uid}`);
  if (!profile) throw new Error("Usuario sin perfil en Firestore.");
  return profile;
}

export async function getOrBootstrapUserProfile(user) {
  try {
    return await getUserProfile(user.uid);
  } catch (error) {
    if (!canBootstrapAdmin(user) || !isProfileReadBlocked(error)) throw error;
    const now = nowIso();
    const payload = stripUndefined({
      uid: user.uid,
      email: authEmail(user),
      displayName: cleanText(user.displayName || user.email, 240),
      role: "admin_epidemiologia",
      active: true,
      defaultRoute: "inicio",
      createdAt: now,
      updatedAt: now,
      seedSource: "epivida-lite-bootstrap"
    });
    await setDocMerge(`users/${user.uid}`, payload);
    return payload;
  }
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
  return setDocMergeOrQueue(app, `users/${uid}`, payload, {
    module: "admin",
    entityType: "user",
    entityId: uid
  });
}

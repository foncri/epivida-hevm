import { nowIso } from "../lib/date.js";
import { getDocData, setDocMerge } from "./firestoreService.js";

export async function getUserProfile(uid) {
  const profile = await getDocData(`users/${uid}`);
  if (!profile) throw new Error("Usuario sin perfil en Firestore.");
  return profile;
}

export async function touchLastLogin(uid) {
  await setDocMerge(`users/${uid}`, { lastLoginAt: nowIso(), updatedAt: nowIso() });
}

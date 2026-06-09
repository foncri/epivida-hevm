import { FIREBASE_VERSION, firebaseConfig } from "./config.js";

let baseRuntimePromise = null;
let authRuntimePromise = null;
let firestoreRuntimePromise = null;
let persistenceAttempted = false;
let firestorePersistenceEnabled = false;
let firestorePersistenceError = "";

export async function firebaseBaseRuntime() {
  if (baseRuntimePromise) return baseRuntimePromise;
  baseRuntimePromise = loadBaseRuntime();
  return baseRuntimePromise;
}

async function loadBaseRuntime() {
  const config = firebaseConfig();
  if (!config) return null;
  const appMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(config);
  return { appMod, app };
}

export async function firebaseAuthRuntime() {
  if (authRuntimePromise) return authRuntimePromise;
  authRuntimePromise = loadAuthRuntime();
  return authRuntimePromise;
}

async function loadAuthRuntime() {
  const base = await firebaseBaseRuntime();
  if (!base) return null;
  const authMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`);
  const auth = authMod.getAuth(base.app);
  return { ...base, authMod, auth };
}

export async function firebaseFirestoreRuntime() {
  if (firestoreRuntimePromise) return firestoreRuntimePromise;
  firestoreRuntimePromise = loadFirestoreRuntime();
  return firestoreRuntimePromise;
}

async function loadFirestoreRuntime() {
  const base = await firebaseBaseRuntime();
  if (!base) return null;
  const fsMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
  const db = fsMod.getFirestore(base.app);
  if (!persistenceAttempted) {
    persistenceAttempted = true;
    try {
      if (typeof fsMod.enableIndexedDbPersistence === "function") {
        await fsMod.enableIndexedDbPersistence(db);
        firestorePersistenceEnabled = true;
        firestorePersistenceError = "";
      }
    } catch (error) {
      firestorePersistenceEnabled = false;
      firestorePersistenceError = error?.code || error?.message || "unavailable";
      console.warn("Persistencia Firestore no disponible.", error);
    }
  }
  return { ...base, fsMod, db };
}

export function firestorePersistenceStatus() {
  return {
    attempted: persistenceAttempted,
    enabled: firestorePersistenceEnabled,
    error: firestorePersistenceError
  };
}

export async function firebaseRuntime() {
  const [authRuntime, firestoreRuntime] = await Promise.all([
    firebaseAuthRuntime(),
    firebaseFirestoreRuntime()
  ]);
  if (!authRuntime || !firestoreRuntime) return null;
  return {
    ...authRuntime,
    fsMod: firestoreRuntime.fsMod,
    db: firestoreRuntime.db
  };
}

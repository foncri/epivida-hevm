import { FIREBASE_VERSION, firebaseConfig } from "./config.js";

let runtimePromise = null;

export async function firebaseRuntime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = loadRuntime();
  return runtimePromise;
}

async function loadRuntime() {
  const config = firebaseConfig();
  if (!config) return null;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
  ]);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(config);
  const auth = authMod.getAuth(app);
  const db = fsMod.getFirestore(app);
  return { appMod, authMod, fsMod, app, auth, db };
}

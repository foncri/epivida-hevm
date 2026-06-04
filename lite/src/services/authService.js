import { appConfig } from "../lib/config.js";
import { firebaseRuntime } from "../lib/firebase.js";
import { activeProfile, normalizeRole } from "../lib/security.js";
import { getUserProfile, touchLastLogin } from "./userService.js";
import { defaultRouteForRole, parseRoute } from "../router.js";

let currentApp = null;

export function initAuthState(app) {
  currentApp = app;
  const config = appConfig();
  if (config.testMode) {
    app.setAuth({
      status: "ready",
      user: { uid: "test-user", email: "test@epivida.local", displayName: "Prueba local" },
      profile: { uid: "test-user", email: "test@epivida.local", role: "admin_epidemiologia", active: true }
    });
    if (parseRoute().key === "login") location.hash = `#/${defaultRouteForRole("admin_epidemiologia")}`;
    app.loadCurrentRoute?.();
    return;
  }
  firebaseRuntime().then(runtime => {
    if (!runtime) {
      app.setAuth({ status: "setup", error: "Falta configurar Firebase para EPIVIDA Lite." });
      return;
    }
    runtime.authMod.onAuthStateChanged(runtime.auth, async user => {
      if (!user) {
        app.setAuth({ status: "signed_out", user: null, profile: null });
        return;
      }
      try {
        const profile = await getUserProfile(user.uid);
        if (!activeProfile(profile)) {
          app.setAuth({ status: "denied", user, profile: null, error: "Usuario inactivo o no autorizado." });
          return;
        }
        const normalized = { ...profile, role: normalizeRole(profile.role), uid: user.uid, email: user.email };
        app.setAuth({ status: "ready", user, profile: normalized, error: "" });
        touchLastLogin(user.uid).catch(() => undefined);
        if (parseRoute().key === "login") location.hash = `#/${defaultRouteForRole(normalized.role)}`;
        app.loadCurrentRoute?.();
      } catch (error) {
        app.setAuth({ status: "denied", user, profile: null, error: error?.message || "No se pudo validar el rol." });
      }
    });
  }).catch(error => {
    app.setAuth({ status: "error", error: error?.message || "No se pudo iniciar Firebase." });
  });
}

export async function signInWithGoogle() {
  const runtime = await firebaseRuntime();
  if (!runtime) {
    currentApp?.setAuth({ status: "setup", error: "Configura Firebase antes de iniciar sesion." });
    return;
  }
  const provider = new runtime.authMod.GoogleAuthProvider();
  await runtime.authMod.signInWithPopup(runtime.auth, provider);
}

export async function signOut() {
  const runtime = await firebaseRuntime();
  if (runtime) await runtime.authMod.signOut(runtime.auth);
}

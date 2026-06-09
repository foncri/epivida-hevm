import { appConfig } from "../lib/config.js";
import { firebaseAuthRuntime } from "../lib/firebase.js";
import { activeProfile, normalizeRole } from "../lib/security.js";
import { defaultRouteForRole, parseRoute } from "../router.js";

let currentApp = null;
let authSetupPromise = null;
let redirectResultChecked = false;

function loginErrorMessage(error) {
  const code = String(error?.code || "");
  if (code === "auth/unauthorized-domain") return "Dominio no autorizado en Firebase Auth.";
  if (code === "auth/popup-blocked") return "El navegador bloqueo la ventana de Google. Se intentara redireccion.";
  if (code === "permission-denied" || String(error?.message || "").toLowerCase().includes("missing or insufficient permissions")) {
    return "Firestore bloqueo el perfil del usuario. Revisa que las reglas Lite esten desplegadas y que exista users/{UID} activo.";
  }
  return error?.message || "No se pudo iniciar sesion con Google.";
}

function popupCanFallbackToRedirect(error) {
  const code = String(error?.code || "");
  return code.includes("popup") || code === "auth/operation-not-supported-in-this-environment";
}

async function prepareAuthRuntime() {
  const runtime = await firebaseAuthRuntime();
  if (!runtime) return null;
  if (!authSetupPromise) {
    authSetupPromise = (async () => {
      try {
        await runtime.authMod.setPersistence(runtime.auth, runtime.authMod.browserLocalPersistence);
      } catch (error) {
        console.warn("Persistencia Auth local no disponible.", error);
      }
      if (!redirectResultChecked) {
        redirectResultChecked = true;
        try {
          await runtime.authMod.getRedirectResult(runtime.auth);
        } catch (error) {
          currentApp?.setAuth({ status: "signed_out", error: loginErrorMessage(error) });
        }
      }
      return runtime;
    })();
  }
  return authSetupPromise;
}

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
  prepareAuthRuntime().then(runtime => {
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
        const { getOrBootstrapUserProfile, touchLastLogin } = await import("./userService.js");
        const profile = await getOrBootstrapUserProfile(user);
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
        app.setAuth({ status: "denied", user, profile: null, error: loginErrorMessage(error) || "No se pudo validar el rol." });
      }
    });
  }).catch(error => {
    app.setAuth({ status: "error", error: error?.message || "No se pudo iniciar Firebase." });
  });
}

export async function signInWithGoogle() {
  const runtime = await prepareAuthRuntime();
  if (!runtime) {
    currentApp?.setAuth({ status: "setup", error: "Configura Firebase antes de iniciar sesion." });
    return;
  }
  const provider = new runtime.authMod.GoogleAuthProvider();
  try {
    await runtime.authMod.signInWithPopup(runtime.auth, provider);
  } catch (error) {
    if (!popupCanFallbackToRedirect(error)) {
      currentApp?.setAuth({ status: "signed_out", error: loginErrorMessage(error) });
      return;
    }
    currentApp?.setAuth({ status: "loading", error: loginErrorMessage(error) });
    try {
      await runtime.authMod.signInWithRedirect(runtime.auth, provider);
    } catch (redirectError) {
      currentApp?.setAuth({ status: "signed_out", error: loginErrorMessage(redirectError) });
    }
  }
}

export async function signOut() {
  const runtime = await firebaseAuthRuntime();
  if (runtime) await runtime.authMod.signOut(runtime.auth);
}

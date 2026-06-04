(() => {
  "use strict";

  const FIREBASE_VERSION = "10.12.4";
  const LOGO_SRC = "./assets/epivida/logos/epivida-logo-gradient.svg";
  const APP_VERSION = "2026-06-04-authgate03";
  const FULL_STYLES = [
    "./styles/epivida-assets.css",
    "./iaas-system.css?v=2026-06-03-syncperf02",
    "./epivida-opd-2026-05-20.css?v=2026-05-20-followup01",
    "./preventive-round-hotfix.css?v=2026-05-08-preventive07",
    "./preventive-hide-cultures.css?v=2026-05-08-placecultures02",
    "./import-census-repair.css?v=2026-05-11-import01",
    "./contrast-repair.css?v=2026-05-11-bedcolors01",
    "./patient-icon-repair.css?v=2026-05-11-riskposition02"
  ];
  const FULL_SCRIPTS = [
    "./epivida-offline-storage-2026-06-03.js?v=2026-06-03-localapp01",
    "./epivida-date-guard.js?v=2026-05-08-date01",
    "./data/censo-data.js",
    "./iaas-followup-flow-stabilizer-2026-05-12.js?v=2026-05-13-flow05",
    "./iaas-followup-ownership-2026-05-12.js?v=2026-05-19-noreload01",
    "./iaas-history-range-filter-2026-05-12.js?v=2026-05-12-history01",
    "./preventive-bed-prerender-2026-05-12.js?v=2026-06-01-aisp01",
    "./iaas-emergency-label-guard-2026-05-12.js?v=2026-05-12-urgencias01",
    "./iaas-urgencias-aisp-system-preloader-2026-06-01.js?v=2026-06-01-aisp02",
    "./hospital-bed-service-normalizer-2026-06-02.js?v=2026-06-03-censusflow01",
    "./preventive-pe-summary-visibility-2026-06-01.js?v=2026-06-01-pe02",
    "./preventive-round-workflow-hotfix-2026-06-02.js?v=2026-06-03-notes01",
    "./preventive-packages-enhancement-2026-06-01.js?v=2026-06-01-preventive02",
    "./iaas-system-grid-resize-preloader-2026-05-22.js?v=2026-05-22-grid01",
    "./iaas-system-cedulas-loader-2026-05-21.js?v=2026-06-04-authgate02",
    "./epivida-interface-stability-hotfix-2026-05-18.js?v=2026-05-18-fix01",
    "./iaas-round-nav-toggle-fix.js?v=2026-05-07-iaas-navtoggle06",
    "./preventive-native-save-guard-2026-05-12.js?v=2026-05-12-iaassave01",
    "./preventive-round-repair.js?v=2026-05-19-noreload01",
    "./preventive-invasive-editor.js?v=2026-05-19-noreload01",
    "./preventive-hide-cultures.js?v=2026-05-19-noreload01",
    "./import-service-fix.js?v=2026-06-03-cirugia01",
    "./import-urgencias-aisp-fix-2026-06-01.js?v=2026-06-01-aisp01",
    "./import-census-repair.js?v=2026-06-03-cirugia01",
    "./contrast-repair.js?v=2026-06-03-syncperf02",
    "./preventive-page-behavior-2026-05-12.js?v=2026-05-12-fixedbeds02",
    "./epivida-iaas-followup-noreload-hotfix-2026-05-13.js?v=2026-05-13-noreload01",
    "./epivida-iaas-sheets-preventive-hotfix-2026-05-18.js?v=2026-06-03-syncperf02",
    "./epivida-iaas-monitor-sync-hotfix-2026-05-18.js?v=2026-05-18-fix02",
    "./epivida-monitor-filter-visibility-hotfix-2026-05-18.js?v=2026-05-19-fix02",
    "./epivida-iaas-followup-counts-hotfix-2026-05-18.js?v=2026-05-18-fix02"
  ];

  const appRoot = document.getElementById("app");
  let authRuntime = null;
  let appLoading = null;
  let authBusy = false;

  function allowedEmail(email) {
    const allowed = (window.EPIVIDA_ALLOWED_EMAILS || []).map(item => String(item).toLowerCase());
    return !allowed.length || allowed.includes(String(email || "").toLowerCase());
  }

  function clearRoot() {
    if (!appRoot) return null;
    appRoot.textContent = "";
    const shell = document.createElement("main");
    shell.className = "ev-auth-gate";
    appRoot.append(shell);
    return shell;
  }

  function card(title, body, actions = [], note = null) {
    const shell = clearRoot();
    if (!shell) return;
    const article = document.createElement("article");
    article.className = "ev-auth-card";

    const img = document.createElement("img");
    img.className = "ev-auth-logo";
    img.src = LOGO_SRC;
    img.alt = "EpiVida Vigilancia Epidemiologica";
    article.append(img);

    const h1 = document.createElement("h1");
    h1.textContent = title;
    article.append(h1);

    const p = document.createElement("p");
    p.textContent = body;
    article.append(p);

    if (actions.length) {
      const actionWrap = document.createElement("div");
      actionWrap.className = "ev-auth-actions";
      actions.forEach(action => actionWrap.append(action));
      article.append(actionWrap);
    }

    if (note) {
      const noteBox = document.createElement("div");
      noteBox.className = `ev-auth-note${note.type === "error" ? " error" : ""}`;
      noteBox.textContent = note.text;
      article.append(noteBox);
    }

    shell.append(article);
  }

  function button(label, onClick, className = "") {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `ev-auth-button ${className}`.trim();
    item.textContent = label;
    item.addEventListener("click", onClick);
    return item;
  }

  function renderLoading(message = "Preparando EpiVida...") {
    const shell = clearRoot();
    if (!shell) return;
    const article = document.createElement("article");
    article.className = "ev-auth-card";
    const img = document.createElement("img");
    img.className = "ev-auth-logo";
    img.src = LOGO_SRC;
    img.alt = "EpiVida Vigilancia Epidemiologica";
    const h1 = document.createElement("h1");
    h1.textContent = "Cargando centro de vigilancia";
    const p = document.createElement("p");
    p.textContent = message;
    const progress = document.createElement("div");
    progress.className = "ev-auth-progress";
    progress.append(document.createElement("span"));
    article.append(img, h1, p, progress);
    shell.append(article);
  }

  function renderLogin(note = null) {
    const action = button("Iniciar sesion con Google", signIn);
    action.disabled = authBusy;
    card(
      "Acceso requerido",
      "Inicia sesion con una cuenta de Google autorizada para ver datos clinicos.",
      [action],
      note
    );
  }

  function renderDenied(user) {
    card(
      "Acceso denegado",
      "La cuenta detectada no esta autorizada para operar EpiVida HEVM.",
      [button("Cerrar sesion", signOut, "secondary")],
      user?.email ? { type: "error", text: `Correo detectado: ${user.email}` } : null
    );
  }

  function renderOffline() {
    card(
      "Sin conexion",
      "No se pudo validar la sesion en linea. Puedes abrir el respaldo local si este dispositivo ya fue preparado para trabajar offline.",
      [button("Abrir respaldo local", () => loadFullApp("offline"))],
      { text: "Los cambios se guardaran localmente hasta recuperar conexion." }
    );
  }

  function loadStyle(href) {
    if ([...document.styleSheets].some(sheet => sheet.href && sheet.href.endsWith(href.replace(/^\.\//, "")))) {
      return Promise.resolve();
    }
    if (document.querySelector(`link[data-epivida-full-style="${href}"]`)) return Promise.resolve();
    return new Promise(resolve => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.epividaFullStyle = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.append(link);
    });
  }

  function preloadAsset(href, as) {
    if (document.querySelector(`link[data-epivida-preload="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.href = href;
    link.as = as;
    link.dataset.epividaPreload = href;
    if (as === "script") link.fetchPriority = "high";
    document.head.append(link);
  }

  function warmFullAssets() {
    FULL_STYLES.forEach(href => preloadAsset(href, "style"));
    FULL_SCRIPTS.forEach(src => preloadAsset(src, "script"));
  }

  function loadScript(src) {
    if (document.querySelector(`script[data-epivida-full-script="${src}"]`)) return Promise.resolve();
    return new Promise(resolve => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.epividaFullScript = src;
      script.onload = async () => {
        try {
          if (src.includes("epivida-offline-storage") && window.__epividaOfflineReady) {
            await window.__epividaOfflineReady;
          }
          if (src.includes("iaas-system-cedulas-loader") && window.__epividaCedulasReady) {
            await window.__epividaCedulasReady;
          }
        } catch (error) {
          console.error("No se pudo completar un cargador diferido de EpiVida.", error);
        }
        resolve();
      };
      script.onerror = () => {
        console.warn("No se pudo cargar modulo EpiVida:", src);
        resolve();
      };
      document.body.append(script);
    });
  }

  function registerServiceWorkerWhenReady() {
    if (!("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker
      .register(`./epivida-service-worker.js?v=${APP_VERSION}`)
      .catch(error => console.warn("No se pudo registrar modo offline EpiVida.", error));
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(register, { timeout: 5000 });
    } else {
      setTimeout(register, 1500);
    }
  }

  async function loadFullApp(reason = "authenticated") {
    if (appLoading) return appLoading;
    window.__EPIVIDA_AUTH_GATE_REASON = reason;
    renderLoading(reason === "offline" ? "Abriendo respaldo local..." : "Sesion validada. Cargando modulos clinicos...");
    appLoading = (async () => {
      warmFullAssets();
      await Promise.all(FULL_STYLES.map(loadStyle));
      registerServiceWorkerWhenReady();
      for (const src of FULL_SCRIPTS) {
        await loadScript(src);
      }
    })().catch(error => {
      console.error("No se pudo cargar EpiVida.", error);
      appLoading = null;
      card(
        "No se pudo cargar EpiVida",
        "Recarga la pagina. Si el problema persiste, revisa la conexion o el estado de GitHub Pages.",
        [button("Reintentar", () => loadFullApp(reason))],
        { type: "error", text: String(error?.message || error) }
      );
    });
    return appLoading;
  }

  async function initAuth() {
    if (window.EPIVIDA_REQUIRE_AUTH === false || !window.EPIVIDA_FIREBASE_CONFIG) {
      await loadFullApp("auth-disabled");
      return;
    }
    if (!navigator.onLine) {
      renderOffline();
      return;
    }
    renderLoading("Validando sesion segura...");
    try {
      const [appMod, authMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`)
      ]);
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(window.EPIVIDA_FIREBASE_CONFIG);
      const auth = authMod.getAuth(app);
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
      authRuntime = { appMod, authMod, app, auth };
      window.__EPIVIDA_FIREBASE_GATE_RUNTIME = authRuntime;
      try {
        await authMod.getRedirectResult(auth);
      } catch (error) {
        console.warn("No se pudo leer retorno de Google Auth.", error);
      }
      authMod.onAuthStateChanged(auth, user => {
        if (!user) {
          renderLogin();
          return;
        }
        if (!allowedEmail(user.email)) {
          renderDenied(user);
          return;
        }
        loadFullApp("authenticated");
      });
    } catch (error) {
      console.error("No se pudo preparar autenticacion.", error);
      renderLogin({ type: "error", text: String(error?.message || error) });
    }
  }

  async function signIn() {
    if (!authRuntime || authBusy) return;
    authBusy = true;
    renderLogin({ text: "Abriendo Google para validar la cuenta..." });
    try {
      const provider = new authRuntime.authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await authRuntime.authMod.signInWithPopup(authRuntime.auth, provider);
      if (result?.user && allowedEmail(result.user.email)) await loadFullApp("authenticated");
    } catch (error) {
      const text = String(error?.code || error?.message || error);
      if (/popup|cancelled-popup-request|auth\/popup-blocked/i.test(text)) {
        const provider = new authRuntime.authMod.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await authRuntime.authMod.signInWithRedirect(authRuntime.auth, provider);
        return;
      }
      renderLogin({ type: "error", text: String(error?.message || error) });
    } finally {
      authBusy = false;
    }
  }

  async function signOut() {
    if (!authRuntime) return;
    await authRuntime.authMod.signOut(authRuntime.auth);
    renderLogin();
  }

  if (window.__EPIVIDA_TEST_MODE__) {
    window.__EPIVIDA_AUTH_GATE_TEST__ = { loadFullApp };
  }

  initAuth();
})();

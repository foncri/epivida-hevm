import { canonicalRouteKey, routeLabel, defaultRouteForRole } from "./router.js";
import { canAccessRoute } from "./lib/security.js";
import { button, el, link, statusDot } from "./components/dom.js";

const NAV = [
  ["inicio", "Inicio"],
  ["censo", "Censo"],
  ["monitoreo-epidemiologico", "Monitoreo"],
  ["ronda-paquetes", "Ronda"],
  ["epi-iaas", "EPI-IAAS"],
  ["dispositivos", "Dispositivos"],
  ["reportes", "Reportes"],
  ["admin", "Admin"]
];

export function createApp(root) {
  const state = {
    route: { key: "inicio", parts: [] },
    auth: { status: "loading", user: null, profile: null, error: "" },
    moduleState: {},
    catalogs: null
  };

  function setState(patch) {
    Object.assign(state, patch);
    render();
  }

  function setAuth(auth) {
    state.auth = { ...state.auth, ...auth };
    render();
  }

  function setRoute(route) {
    state.route = route;
    render();
  }

  function shell(children) {
    const user = state.auth.user;
    const role = state.auth.profile?.role || "";
    const activeRoute = canonicalRouteKey(state.route.key);
    const allowedNav = NAV.filter(([route]) => canAccessRoute(route, role));
    return el("div", { class: "app-shell" }, [
      el("header", { class: "topbar" }, [
        link("#/inicio", "EPIVIDA", { class: "brand", "aria-label": "EPIVIDA inicio" }),
        el("nav", { class: "main-nav", "aria-label": "Modulos" }, allowedNav.map(([route, label]) =>
          link(`#/${route}`, label, { class: route === activeRoute ? "active" : "" })
        )),
        el("div", { class: "session" }, [
          statusDot(state.auth.status === "ready" ? "ok" : state.auth.status === "denied" ? "bad" : "idle"),
          el("span", {}, [user?.email || state.auth.status]),
          user ? button("Salir", () => import("./services/authService.js").then(mod => mod.signOut()), { class: "ghost small" }) : ""
        ])
      ]),
      el("main", { class: "workspace" }, children)
    ]);
  }

  function renderBlocked() {
    return shell([
      el("section", { class: "empty-state" }, [
        el("h1", {}, ["Acceso no autorizado"]),
        el("p", {}, ["Tu usuario no tiene permisos para abrir este modulo."]),
        link(`#/${defaultRouteForRole(state.auth.profile?.role)}`, "Volver a mi inicio", { class: "button" })
      ])
    ]);
  }

  function renderDenied() {
    return shell([
      el("section", { class: "empty-state" }, [
        el("h1", {}, ["Acceso pendiente"]),
        el("p", {}, [state.auth.error || "Tu usuario inicio sesion, pero todavia no tiene un perfil activo en EPIVIDA."]),
        el("p", { class: "muted" }, [`Usuario: ${state.auth.user?.email || state.auth.user?.uid || "sin correo"}`]),
        button("Salir", () => import("./services/authService.js").then(mod => mod.signOut()), { class: "ghost" })
      ])
    ]);
  }

  function renderLoading() {
    return shell([
      el("section", { class: "empty-state" }, [
        el("h1", {}, ["Cargando"]),
        el("p", {}, ["Preparando modulo " + routeLabel(state.route.key) + "."])
      ])
    ]);
  }

  function renderLoginGate() {
    return el("main", { class: "login-shell" }, [
      el("section", { class: "login-panel" }, [
        el("h1", {}, ["EPIVIDA"]),
        el("p", {}, ["Acceso clinico protegido. Inicia sesion para continuar."]),
        button("Iniciar sesion con Google", () => import("./services/authService.js").then(mod => mod.signInWithGoogle()), { class: "primary" }),
        state.auth.error ? el("p", { class: "error-text" }, [state.auth.error]) : ""
      ])
    ]);
  }

  function render() {
    if (!root) return;
    root.replaceChildren();
    if (state.route.key !== "login" && state.auth.status === "loading") {
      root.append(renderLoading());
      return;
    }
    if (state.route.key === "login" || !state.auth.user) {
      root.append(renderLoginGate());
      return;
    }
    if (state.auth.status === "denied" || state.auth.status === "error") {
      root.append(renderDenied());
      return;
    }
    if (!canAccessRoute(state.route.key, state.auth.profile?.role)) {
      root.append(renderBlocked());
      return;
    }
    root.append(shell([el("section", { class: "module-host", id: "module-host" }, [])]));
  }

  function mountModule(node) {
    const host = root.querySelector("#module-host");
    if (!host) return;
    host.replaceChildren(node);
  }

  render();
  return { state, setState, setAuth, setRoute, render, renderLoading, mountModule };
}

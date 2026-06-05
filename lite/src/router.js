import { canAccessRoute } from "./lib/security.js";

const ROUTES = {
  login: () => import("./modules/login/index.js"),
  inicio: () => import("./modules/inicio/index.js"),
  censo: () => import("./modules/censo/index.js"),
  expediente: () => import("./modules/expediente/index.js"),
  "monitoreo-epidemiologico": () => import("./modules/monitoreo/index.js"),
  "ronda-paquetes": () => import("./modules/ronda-paquetes/index.js"),
  "epi-iaas": () => import("./modules/epi-iaas/index.js"),
  dispositivos: () => import("./modules/dispositivos/index.js"),
  reportes: () => import("./modules/reportes/index.js"),
  admin: () => import("./modules/admin/index.js")
};

const ROUTE_ALIASES = {
  dashboard: "inicio",
  "censo-hospitalario": "censo",
  "importar-censo": "admin",
  pacientes: "expediente",
  ronda: "ronda-paquetes",
  "reporte-diario": "reportes",
  "seguimiento-iaas": "epi-iaas"
};

const LABELS = {
  login: "Login",
  inicio: "Inicio",
  censo: "Censo",
  expediente: "Expediente",
  "monitoreo-epidemiologico": "Monitoreo Epidemiologico",
  "ronda-paquetes": "Paquetes Preventivos",
  "epi-iaas": "EPI-IAAS",
  dispositivos: "Dispositivos",
  reportes: "Reportes",
  admin: "Admin"
};

async function perf() {
  return import("./lib/performance.js");
}

export function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const legacyKey = parts[0] || "";
  const canonicalKey = canonicalRouteKey(legacyKey);
  const key = canonicalKey && ROUTES[canonicalKey] ? canonicalKey : "inicio";
  return { key, parts, legacyKey, canonicalKey: key };
}

export function canonicalRouteKey(key) {
  return ROUTE_ALIASES[key] || key;
}

export function routeLabel(key) {
  return LABELS[canonicalRouteKey(key)] || "EPIVIDA";
}

export function defaultRouteForRole(role) {
  if (role === "enfermeria") return "ronda-paquetes";
  if (role === "epidemiologia") return "monitoreo-epidemiologico";
  if (role === "lectura") return "monitoreo-epidemiologico";
  return "inicio";
}

export function initRouter(app) {
  let loadingToken = 0;

  async function loadCurrentRoute() {
    const route = parseRoute();
    app.setRoute(route);
    if (route.key === "login" || !app.state.auth.user) return;
    const token = ++loadingToken;
    try {
      if (app.state.auth.status !== "ready" || !canAccessRoute(route.key, app.state.auth.profile?.role)) return;
      const perfMod = await perf();
      perfMod.mark(`route:${route.key}`);
      const mod = await ROUTES[route.key]();
      if (token !== loadingToken) return;
      app.mountModule(await mod.render({ app, route }));
      perfMod.measure(`route:${route.key}`, `route:${route.key}`);
    } catch (error) {
      if (token !== loadingToken) return;
      const { moduleError } = await import("./components/moduleLayout.js");
      app.mountModule(moduleError(routeLabel(route.key), error));
    }
  }

  window.addEventListener("hashchange", loadCurrentRoute);
  app.loadCurrentRoute = loadCurrentRoute;
  loadCurrentRoute();
}

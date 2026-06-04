const ROUTES = {
  login: () => import("./modules/login/index.js"),
  inicio: () => import("./modules/inicio/index.js"),
  censo: () => import("./modules/censo/index.js"),
  "monitoreo-epidemiologico": () => import("./modules/monitoreo/index.js"),
  ronda: () => import("./modules/ronda-paquetes/index.js"),
  "ronda-paquetes": () => import("./modules/ronda-paquetes/index.js"),
  "epi-iaas": () => import("./modules/epi-iaas/index.js"),
  dispositivos: () => import("./modules/dispositivos/index.js"),
  reportes: () => import("./modules/reportes/index.js"),
  admin: () => import("./modules/admin/index.js")
};

const LABELS = {
  login: "Login",
  inicio: "Inicio",
  censo: "Censo",
  "monitoreo-epidemiologico": "Monitoreo Epidemiologico",
  ronda: "Paquetes Preventivos",
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
  const key = parts[0] && ROUTES[parts[0]] ? parts[0] : "inicio";
  return { key, parts };
}

export function routeLabel(key) {
  return LABELS[key] || "EPIVIDA";
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

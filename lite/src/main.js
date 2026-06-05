import { createApp } from "./app.js";
import { initRouter } from "./router.js";

const root = document.querySelector("#app");
const app = createApp(root);

initRouter(app);

function afterFirstFrame(callback) {
  const schedule = globalThis.requestAnimationFrame || (fn => globalThis.setTimeout(fn, 16));
  schedule(() => callback());
}

afterFirstFrame(() => {
  import("./services/authService.js")
    .then(module => module.initAuthState(app))
    .catch(error => {
      app.setAuth({
        status: "error",
        error: error?.message || "No se pudo iniciar autenticacion."
      });
    });
});

afterFirstFrame(() => {
  import("./lib/pwa.js")
    .then(module => module.registerLiteServiceWorker())
    .catch(() => undefined);
});

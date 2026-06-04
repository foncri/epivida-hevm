import { createApp } from "./app.js";
import { initRouter } from "./router.js";
import { initAuthState } from "./services/authService.js";
import { registerLiteServiceWorker } from "./lib/pwa.js";

const root = document.querySelector("#app");
const app = createApp(root);

initRouter(app);
initAuthState(app);
registerLiteServiceWorker();

export function registerLiteServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./epivida-lite-sw.js").catch(() => undefined);
  }, { once: true });
}

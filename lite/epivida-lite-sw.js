const APP_VERSION = "2026-06-16-parity08";
const CACHE_NAME = `epivida-lite-shell-${APP_VERSION}`;
const CORE = ["./index.html", "./src/styles/base.css", "./src/main.js"];
const NEVER_CACHE = new Set(["/lite/epivida-lite-config.js", "/epivida-lite-config.js"]);
const NEVER_CACHE_PREFIXES = [
  "/iaas-system",
  "/epivida-auth-gate",
  "/google",
  "/sheets"
];
const RUNTIME_DESTINATIONS = new Set(["script", "style", "worker", "manifest", "image"]);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (shouldNeverCache(url)) return;
  if (shouldRuntimeCache(request, url)) {
    event.respondWith(cacheFirstWithRefresh(request, event));
    return;
  }
  event.respondWith(
    fetch(request)
      .then(response => {
        if (request.destination === "document") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(hit => {
        if (hit) return hit;
        if (request.destination === "document") return caches.match("./index.html");
        return Response.error();
      }))
  );
});

function shouldRuntimeCache(request, url) {
  if (shouldNeverCache(url)) return false;
  return RUNTIME_DESTINATIONS.has(request.destination) || url.pathname.includes("/src/");
}

function shouldNeverCache(url) {
  if (NEVER_CACHE.has(url.pathname)) return true;
  return NEVER_CACHE_PREFIXES.some(prefix => url.pathname.startsWith(prefix) || url.pathname.startsWith(`/lite${prefix}`));
}

async function cacheFirstWithRefresh(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return cached || await refresh || Response.error();
}

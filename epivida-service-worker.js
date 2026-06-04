const CACHE_NAME = "epivida-hevm-offline-2026-06-04-authgate03";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./epivida-auth-gate.css?v=2026-06-04-authgate01",
  "./epivida-auth-gate.js?v=2026-06-04-authgate03",
  "./epivida-offline-storage-2026-06-03.js?v=2026-06-03-localapp01",
  "./iaas-system.css?v=2026-06-03-syncperf02",
  "./styles/epivida-assets.css",
  "./epivida-date-guard.js?v=2026-05-08-date01",
  "./data/censo-data.js",
  "./iaas-system-cedulas-loader-2026-05-21.js?v=2026-06-04-authgate02",
  "./iaas-system.js?v=2026-06-04-sheets40301",
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
  "./epivida-iaas-followup-counts-hotfix-2026-05-18.js?v=2026-05-18-fix02",
  "./epivida-opd-2026-05-20.css?v=2026-05-20-followup01",
  "./preventive-round-hotfix.css?v=2026-05-08-preventive07",
  "./preventive-hide-cultures.css?v=2026-05-08-placecultures02",
  "./import-census-repair.css?v=2026-05-11-import01",
  "./contrast-repair.css?v=2026-05-11-bedcolors01",
  "./patient-icon-repair.css?v=2026-05-11-riskposition02",
  "./assets/epivida/logos/favicon.svg",
  "./assets/epivida/logos/epivida-logo-gradient.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
  return {
    cacheName: CACHE_NAME,
    requested: APP_SHELL.length,
    cached: results.filter(result => result.status === "fulfilled").length,
    failed: results
      .map((result, index) => result.status === "rejected" ? APP_SHELL[index] : "")
      .filter(Boolean)
  };
}

async function offlineStatus() {
  const cache = await caches.open(CACHE_NAME);
  const checks = await Promise.all(APP_SHELL.map(async url => [url, Boolean(await cache.match(url))]));
  return {
    cacheName: CACHE_NAME,
    requested: APP_SHELL.length,
    cached: checks.filter(([, hit]) => hit).length,
    missing: checks.filter(([, hit]) => !hit).map(([url]) => url)
  };
}

self.addEventListener("message", event => {
  const message = event.data || {};
  if (!message || !["EPIVIDA_PREPARE_OFFLINE", "EPIVIDA_OFFLINE_STATUS"].includes(message.type)) return;
  const port = event.ports && event.ports[0];
  const action = message.type === "EPIVIDA_PREPARE_OFFLINE" ? cacheAppShell : offlineStatus;
  event.waitUntil(
    action()
      .then(payload => port?.postMessage?.({ ok: true, ...payload }))
      .catch(error => port?.postMessage?.({ ok: false, error: String(error?.message || error) }))
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

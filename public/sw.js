// Minimal service worker — its only job is to exist and control the page, which is what
// satisfies "installable" criteria on browsers that still require an active SW (Chrome's
// own bar has loosened over time, but Firefox/Samsung Internet etc. still check for one).
// Deliberately does NOT cache anything: this is a live admin dashboard, not offline-first
// content — serving stale user/report data from a cache would be actively wrong here, so
// every request just passes straight through to the network.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

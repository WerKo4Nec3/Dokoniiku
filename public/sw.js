// Bump on every change to this file: activation deletes older caches.
const CACHE_NAME = "tabi-compass-v7";
const OFFLINE_URL = "/offline";
const APP_SHELL = [OFFLINE_URL, "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Hashed build files never change at a given URL.
const isBuildAsset = (url) => url.pathname.startsWith("/_next/static/");
// Our own images/fonts may be replaced in place (e.g. new scene art).
const isMedia = (url) => /\.(?:png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname);

function store(request, response) {
  if (response.ok && response.type === "basic") {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never cache cross-origin requests (Wikipedia, weather, Firebase...).
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Page data (?_rsc=), API routes and everything else go straight to the
  // network. Caching them served a previous deploy's pages to the new code
  // ("This page couldn't load").
  if (url.searchParams.has("_rsc") || url.pathname.startsWith("/api/")) return;

  if (isBuildAsset(url)) {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request).then((res) => store(event.request, res))),
    );
    return;
  }

  if (isMedia(url)) {
    // Stale-while-revalidate: instant from cache, refreshed in the background.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fresh = fetch(event.request)
          .then((res) => store(event.request, res))
          .catch(() => cached);
        return cached || fresh;
      }),
    );
  }
});

// Bump this version on every deploy that changes app behavior so old caches
// are cleared and clients pick up the new code.
const CACHE_NAME = "kanakku-book-v3";

const PRECACHE_URLS = [
  "/dashboard",
  "/borrowers",
  "/repay",
  "/delayed",
  "/missed",
  "/settings",
  "/login",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
  // Activate this new SW immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to tell a waiting SW to activate right away.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Data must always go live to Supabase — never served from cache.
  if (request.url.includes("supabase.co")) return;

  const url = new URL(request.url);

  const isNavigation =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  // NETWORK-FIRST for page navigations AND the app's own build assets
  // (Next.js chunks live under /_next/). This ensures that whenever the phone
  // has a connection, it gets the LATEST code — fixing "sometimes old,
  // sometimes new behavior". It only falls back to cache when truly offline.
  const isAppAsset = url.pathname.startsWith("/_next/");

  if (isNavigation || isAppAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
          return response;
        })
        .catch(async () => {
          const exact = await caches.match(request);
          if (exact) return exact;
          if (isNavigation) {
            const noQuery = await caches.match(url.pathname);
            if (noQuery) return noQuery;
            const section = "/" + (url.pathname.split("/")[1] || "dashboard");
            const sectionMatch = await caches.match(section);
            if (sectionMatch) return sectionMatch;
            return caches.match("/dashboard");
          }
          return undefined;
        })
    );
    return;
  }

  // Other static assets (fonts, images, icons): cache-first is fine since
  // they rarely change and are fingerprinted when they do.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

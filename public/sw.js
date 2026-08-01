// Bump the cache version whenever this file changes so old caches are cleared.
const CACHE_NAME = "kanakku-book-v2";

// Precache every top-level app route so navigation works offline even if the
// user hasn't visited that tab yet in this session. Dynamic routes like
// /borrowers/[id] can't be listed here, so they're handled at fetch time.
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
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Data must always go live to Supabase — never served from cache. The app's
  // own IndexedDB layer is what makes data available offline, not this cache.
  if (request.url.includes("supabase.co")) return;

  const url = new URL(request.url);

  // For page navigations (HTML documents), use network-first, then fall back
  // to a cached version of the SAME path, then to a sensible app route.
  // Crucially, a dynamic route like /borrowers/<name> that isn't cached falls
  // back to /borrowers (its section) rather than always to the dashboard —
  // this fixes swipe→repay and tab navigation landing on the wrong screen.
  const isNavigation =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
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
          // 1) exact cached page for this path
          const exact = await caches.match(request);
          if (exact) return exact;
          // 2) cached page for the pathname without query string
          const noQuery = await caches.match(url.pathname);
          if (noQuery) return noQuery;
          // 3) the section root (e.g. /borrowers/xyz -> /borrowers)
          const section = "/" + (url.pathname.split("/")[1] || "dashboard");
          const sectionMatch = await caches.match(section);
          if (sectionMatch) return sectionMatch;
          // 4) last resort
          return caches.match("/dashboard");
        })
    );
    return;
  }

  // Non-navigation assets (JS, CSS, fonts, images): cache-first for speed and
  // offline resilience, updating the cache in the background.
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

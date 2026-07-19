const CACHE_NAME = "kanakku-book-v1";
const PRECACHE_URLS = ["/dashboard", "/borrowers", "/login", "/manifest.json"];

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

  // Data must always go live to Supabase — never served from cache. The
  // app's own IndexedDB layer is what makes data available offline, not
  // this cache.
  if (request.url.includes("supabase.co")) return;

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
      .catch(
        () =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/dashboard"))
      )
  );
});

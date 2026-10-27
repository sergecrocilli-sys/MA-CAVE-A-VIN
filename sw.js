/* V1.2.1 : ressources cohérentes et mise à jour de l'accueil par le réseau.
   Aucune suppression ni modification d'IndexedDB. */
const CACHE = "ma-cave-mobile-v1.2.1";
const FILES = [
  "index.html",
  "app.js?v=1.2.1",
  "style.css?v=1.2.1",
  "manifest.json?v=1.2.1",
  "assets/logo.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/apple-touch-icon.png",
  "README.pdf",
  "js/bouteilles.js?v=1.2.1",
  "js/database.js?v=1.2.1",
  "js/degustations.js?v=1.2.1",
  "js/exports.js?v=1.2.1",
  "js/mouvements.js?v=1.2.1",
  "js/ui.js?v=1.2.1",
  "pages/bouteille.html",
  "pages/cave.html",
  "pages/dashboard.html",
  "pages/degustations.html",
  "pages/emplacements.html",
  "pages/settings.html",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          FILES.map(
            (file) =>
              new Request(new URL(file, self.registration.scope), {
                cache: "reload",
              }),
          ),
        ),
      ),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("ma-cave-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url),
    scope = new URL(self.registration.scope);
  if (
    event.request.method !== "GET" ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname)
  )
    return;
  const rel = url.pathname.slice(scope.pathname.length);
  if (
    event.request.mode === "navigate" &&
    (rel === "" || rel === "index.html")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE),
          controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(event.request, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.ok) {
            await cache.put("index.html", response.clone());
            return response;
          }
          const fallback = await cache.match("index.html");
          return fallback || response;
        } catch (error) {
          return (await cache.match("index.html")) || Response.error();
        } finally {
          clearTimeout(timer);
        }
      })(),
    );
    return;
  }
  const file = rel + url.search;
  if (!FILES.includes(file)) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then(async (cache) => (await cache.match(file)) || fetch(event.request)),
  );
});

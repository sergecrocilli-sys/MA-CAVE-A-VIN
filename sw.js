const CACHE = "ma-cave-mobile-v1.2.0";
const FILES = [
  "./",
  "index.html",
  "app.js",
  "style.css",
  "manifest.json",
  "assets/logo.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/apple-touch-icon.png",
  "README.pdf",
  "js/bouteilles.js",
  "js/database.js",
  "js/degustations.js",
  "js/exports.js",
  "js/mouvements.js",
  "js/ui.js",
  "pages/bouteille.html",
  "pages/cave.html",
  "pages/dashboard.html",
  "pages/degustations.html",
  "pages/emplacements.html",
  "pages/settings.html",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ma-cave-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url),
    scope = new URL(self.registration.scope);
  if (
    event.request.method !== "GET" ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname) ||
    url.search
  )
    return;
  const rel = url.pathname.slice(scope.pathname.length) || "index.html";
  if (!FILES.includes(rel)) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then(async (cache) => (await cache.match(rel)) || fetch(event.request)),
  );
});

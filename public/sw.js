/*
 * Service worker de Cotizador — estrategia prudente:
 * - Precarga solo recursos PÚBLICOS (página sin conexión, iconos, manifest).
 * - Cachea assets estáticos versionados de Next (/_next/static/*, inmutables por hash).
 * - NUNCA cachea páginas autenticadas, APIs, PDFs ni logos privados (network-only).
 * - Navegación sin red => muestra /sin-conexion.
 */
const VERSION = "v1";
const STATIC_CACHE = `cotizador-static-${VERSION}`;
const PRECACHE = ["/sin-conexion", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cotizador-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/sin-conexion")));
  }
  // Todo lo demás (APIs, PDFs, archivos privados, datos RSC) va directo a red sin caché.
});

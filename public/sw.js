// Service Worker: App läuft offline (App-Shell + verschlüsseltes Stück im Cache).
// VERSION muss mit public/js/version.js übereinstimmen (Test prüft das). Jede neue Version
// ändert diese Datei -> Browser installiert den neuen Worker -> App zeigt "Neue Version".
const VERSION = "0.6.1";
const CACHE = `tl-${VERSION}`;

// Alle Dateien der App (Test prüft, dass keine fehlt und alle existieren)
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "js/app.js",
  "js/badges.js",
  "js/cards.js",
  "js/crypto.js",
  "js/dom.js",
  "js/hilfe.js",
  "js/leitner.js",
  "js/pwa.js",
  "js/quiz.js",
  "js/roles.js",
  "js/speech.js",
  "js/store.js",
  "js/version.js",
  "js/voices.js",
  "js/views/ablauf.js",
  "js/views/badges.js",
  "js/views/einstellungen.js",
  "js/views/hoerprobe.js",
  "js/views/karte.js",
  "js/views/passwort.js",
  "js/views/quiz.js",
  "js/views/rolle.js",
  "js/views/start.js",
  "js/views/statistik.js",
  "js/views/stimmen.js",
  "js/views/weg.js",
  "js/views/zufall.js",
];
const DATEN = "data/stueck.enc";

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll([...SHELL, DATEN].map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("tl-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (ev) => {
  if (ev.data?.typ === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Stücktext: zuerst Netz (neue Textversion), sonst Cache (offline)
  if (url.pathname.endsWith("/" + DATEN)) {
    ev.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: "no-cache" });
        if (res.ok) await cache.put(DATEN, res.clone());
        return res;
      } catch {
        return (await cache.match(DATEN)) ?? Response.error();
      }
    })());
    return;
  }

  // App-Dateien: Cache zuerst (versioniert), sonst Netz
  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === "navigate" ? "index.html" : req;
    const treffer = await cache.match(key, { ignoreSearch: req.mode === "navigate" });
    if (treffer) return treffer;
    try {
      const res = await fetch(req);
      if (res.ok && url.pathname.startsWith(new URL("./", self.location).pathname)) cache.put(req, res.clone());
      return res;
    } catch {
      return req.mode === "navigate" ? (await cache.match("index.html")) : Response.error();
    }
  })());
});

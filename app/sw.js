const CACHE_VERSION = "v1";
const CACHE_NAME = `homeschool-coders-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./home.css",
  "./app.js",
  "./learn.html",
  "./learn.css",
  "./learn.js",
  "./report.html",
  "./report.css",
  "./report.js",
  "./lesson.html",
  "./lesson.css",
  "./lesson.js",
  "./track.html",
  "./track.css",
  "./track.js",
  "./unit.html",
  "./unit.css",
  "./unit.js",
  "./curriculum.html",
  "./curriculum.css",
  "./curriculumPage.js",
  "./state.js",
  "./commands.js",
  "./curriculum.js",
  "./teacherGate.js",
  "./lessons.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("homeschool-coders-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
      self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (_error) {
        // Offline navigation fallback.
        if (request.mode === "navigate") {
          return (await cache.match("./index.html")) || new Response("Offline", { status: 503 });
        }
        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});

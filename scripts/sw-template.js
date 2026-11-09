const version = "__CACHE_VERSION__";
const paths = /* __APP_FILES__ */ [];
const scope = new URL(self.registration.scope);
const prefix = "chess-coach:" + scope.href + ":";
const generation = prefix + "v2:";
const cacheName = generation + version;
const assets = new Map(paths.map(path => {
  const url = new URL(path, scope);
  return [url.pathname, url.href];
}));
const home = new URL("index.html", scope);

self.addEventListener("install", event => {
  const requests = Array.from(assets.values(), url => new Request(url, {cache: "reload"}));
  event.waitUntil((async () => {
    const legacy = (await caches.keys()).some(name => name.startsWith(prefix) && !name.startsWith(generation));
    const cache = await caches.open(cacheName);
    await cache.addAll(requests);
    // Earlier versions have no update button, so migrate them once the new cache is complete.
    if (legacy) await self.skipWaiting();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_UPDATE") event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const previous = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName);
    await Promise.all(previous.map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== scope.origin) return;

  const asset = url.pathname === scope.pathname ? home.href : assets.get(url.pathname);
  if (!asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(asset) ?? fetch(request);
  })());
});

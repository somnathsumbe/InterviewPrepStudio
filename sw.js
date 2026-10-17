const CACHE_NAME = "interview-prep-studio-v5";
const NETWORK_TIMEOUT_MS = 4000;
const CORE_ASSETS = [
    "./index.html",
    "./technology.html",
    "./css/style.css",
    "./js/app.js",
    "./js/questions.js",
    "./data/technologies.json",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-512-maskable.png"
];

async function cacheFresh(cache, url) {
    const absoluteUrl = new URL(url, self.registration.scope).href;
    const request = new Request(absoluteUrl, { cache: "reload" });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`Precache failed for ${url}: ${response.status}`);
    await cache.put(absoluteUrl, response);
}

async function fetchWithTimeout(request) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    try {
        return await fetch(request, { signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(CORE_ASSETS.map(url => cacheFresh(cache, url)));

        const response = await cache.match(new URL("./data/technologies.json", self.registration.scope).href);
        const technologies = await response.json();
        const optionalAssets = technologies.flatMap(technology => [technology.pageUrl, technology.dataUrl]);
        const results = await Promise.allSettled(optionalAssets.map(url => {
            const resolved = new URL(url, self.registration.scope);
            if (resolved.origin !== self.location.origin) {
                return Promise.reject(new Error(`Cannot precache cross-origin asset: ${url}`));
            }
            return cacheFresh(cache, resolved.href);
        }));
        results.filter(result => result.status === "rejected")
            .forEach(result => console.warn("An optional offline resource could not be cached.", result.reason));
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith("interview-prep-studio-") && name !== CACHE_NAME)
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const { request } = event;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith((async () => {
            try {
                const response = await fetchWithTimeout(request);
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
                return response;
            } catch {
                const cache = await caches.open(CACHE_NAME);
                const cachedPage = await cache.match(request)
                    || await cache.match(new URL(new URL(request.url).pathname, self.location.origin).href)
                    || await cache.match(new URL("./index.html", self.registration.scope).href);
                if (cachedPage) return cachedPage;
                return new Response("This page is unavailable offline. Open the dashboard after reconnecting.", {
                    status: 503,
                    headers: { "Content-Type": "text/plain; charset=utf-8" }
                });
            }
        })());
        return;
    }

    if (new URL(request.url).pathname.endsWith(".json")) {
        event.respondWith((async () => {
            try {
                const response = await fetchWithTimeout(request);
                if (!response.ok) throw new Error(`Request failed with ${response.status}`);
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
                return response;
            } catch {
                const cached = await caches.match(request);
                if (cached) return cached;
                return new Response(JSON.stringify({ error: "This data is unavailable offline." }), {
                    status: 503,
                    headers: { "Content-Type": "application/json; charset=utf-8" }
                });
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    })());
});

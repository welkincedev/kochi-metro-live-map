/**
 * Kochi Metro Service Worker v2.0
 * Cache-first for static + GTFS data. Skip map tiles.
 */

const CACHE = 'kochi-metro-v2';

const PRECACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './stations.json',
    './fares.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
    // trips.json / shapes.json are large (~2.5MB total) — cached on first request
];

// ── Install: pre-cache critical assets ────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: clear old caches ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// ── Fetch: cache-first for same-origin, skip tiles ────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Skip map tiles (CartoCDN, OSM) — too many, too large
    if (url.hostname.includes('cartocdn') || url.hostname.includes('tile') || url.hostname.includes('openstreetmap')) return;

    if (url.origin === self.location.origin) {
        // Same-origin: cache-first
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(res => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE).then(c => c.put(request, clone));
                    }
                    return res;
                });
            }).catch(() => caches.match('./index.html'))
        );
    } else {
        // External (Leaflet CDN, Google Fonts): network with cache fallback
        event.respondWith(
            fetch(request).then(res => {
                if (res && res.status === 200) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(request, clone));
                }
                return res;
            }).catch(() => caches.match(request))
        );
    }
});

const CACHE_NAME = 'kochi-metro-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

const DATA_ASSETS = [
    'stations.json',
    'fares.json',
    'shapes.json',
    'trips.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Caching App Shell and Data...');
            return cache.addAll([...STATIC_ASSETS, ...DATA_ASSETS]);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // For navigation requests, fallback to index.html
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Network First strategy for API / JSON data (ensures live schedule updates)
    if (event.request.url.endsWith('.json') && !event.request.url.includes('manifest.json')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clonedRes = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedRes));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache First strategy for Static Assets (CSS, JS, Fonts)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).then((response) => {
                // Ignore caching external unsanitized responses (opaque)
                if(!response || response.status !== 200 || response.type !== 'basic') {
                    if (event.request.url.includes('fonts') || event.request.url.includes('unpkg')) {
                        const clonedRes = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedRes));
                    }
                    return response;
                }

                const clonedRes = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedRes));
                return response;
            });
        })
    );
});

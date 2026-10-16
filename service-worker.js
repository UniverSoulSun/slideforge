// SlideForge service worker: installable PWA + offline use.
// Bump CACHE_NAME whenever APP_SHELL files or CDN_ASSETS versions change.
const CACHE_NAME = 'slideforge-v4';

// '/index.html' is intentionally absent: with cleanUrls it redirects to '/',
// and a cached redirect cannot be served for a page navigation.
const APP_SHELL = [
    '/', '/styles.css', '/config.js', '/analytics.js', '/script.js', '/manifest.json',
    '/fonts/bricolage-grotesque-latin-wght-normal.woff2',
    '/fonts/source-serif-4-latin-wght-normal.woff2',
    '/fonts/source-serif-4-latin-wght-italic.woff2',
    '/fonts/jetbrains-mono-latin-400-normal.woff2'
];

// Must match index.html exactly. Versioned URLs never change, so cache-first.
// Mermaid (3.5 MB) is deliberately NOT precached: it is only fetched when a
// slide has a diagram, then kept by the cache-first CDN handler below, so
// people who never use diagrams never pay for it.
const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js',
    'https://cdn.jsdelivr.net/npm/marked@18.0.14/lib/marked.umd.js',
    'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/html2canvas-pro@2.4.4/dist/html2canvas-pro.min.js'
];
const CDN_HOSTS = ['cdn.jsdelivr.net'];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL); // required: install fails without the shell
        // Best effort: a CDN hiccup should not block install.
        await Promise.allSettled(CDN_ASSETS.map(async (url) => {
            const response = await fetch(url, { mode: 'cors' });
            if (response.ok) await cache.put(url, response);
        }));
    })());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Page loads (including /share-target?text=...): network first so updates
    // land immediately, cached app shell when offline. The query string stays
    // in the address bar, so shared text still reaches script.js offline.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(async () =>
                (await caches.match('/')) || Response.error()
            )
        );
        return;
    }

    // Pinned CDN libraries (including Mermaid on first use): cache first.
    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith((async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            const response = await fetch(request);
            if (response.ok && response.type === 'cors') {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
        })());
        return;
    }

    // Same-origin static files: serve cached, refresh in the background.
    if (url.origin === self.location.origin) {
        event.respondWith((async () => {
            const cached = await caches.match(request);
            const network = fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            });
            if (cached) {
                network.catch(() => {}); // offline refresh failure is fine
                return cached;
            }
            return network;
        })());
    }
    // Anything else: let the browser handle it normally.
});

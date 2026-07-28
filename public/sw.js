const CACHE_VERSION = 'tududi-v1';
const API_CACHE = 'tududi-api-v1';
const SYNC_QUEUE = 'tududi-sync-queue';

const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/icon-logo.png',
];

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION && key !== API_CACHE)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/api/')) {
        if (request.method === 'GET') {
            event.respondWith(handleApiGet(request));
        } else {
            event.respondWith(handleApiMutation(request));
        }
        return;
    }

    // Navigation: network-first, fall back to cached shell
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match('/').then((cached) => cached || fetch(request))
            )
        );
        return;
    }

    // Static assets: cache-first
    event.respondWith(
        caches.match(request).then(
            (cached) =>
                cached ||
                fetch(request).then((response) => {
                    if (response.ok && response.type !== 'opaque') {
                        const clone = response.clone();
                        caches
                            .open(CACHE_VERSION)
                            .then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
        )
    );
});

// ─── API GET: network-first, stale cache fallback ────────────────────────────

async function handleApiGet(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request, { cacheName: API_CACHE });
        if (cached) return cached;
        return new Response(
            JSON.stringify({ error: 'Offline', offline: true }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}

// ─── API Mutations: queue when offline, replay on sync ───────────────────────

async function handleApiMutation(request) {
    try {
        return await fetch(request);
    } catch {
        await queueRequest(request);
        return new Response(
            JSON.stringify({ queued: true, offline: true }),
            {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}

async function queueRequest(request) {
    const body = await request.text().catch(() => '');
    const entry = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body,
        timestamp: Date.now(),
    };

    const db = await openQueueDb();
    const tx = db.transaction(SYNC_QUEUE, 'readwrite');
    tx.objectStore(SYNC_QUEUE).add(entry);

    // Register background sync if supported
    if ('sync' in self.registration) {
        await self.registration.sync.register('tududi-sync');
    }
}

// ─── Background Sync ─────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
    if (event.tag === 'tududi-sync') {
        event.waitUntil(replayQueuedRequests());
    }
});

async function replayQueuedRequests() {
    const db = await openQueueDb();
    const tx = db.transaction(SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE);
    const entries = await idbAll(store);

    for (const entry of entries) {
        try {
            const response = await fetch(entry.url, {
                method: entry.method,
                headers: entry.headers,
                body: entry.body || undefined,
            });
            if (response.ok) {
                const delTx = db.transaction(SYNC_QUEUE, 'readwrite');
                delTx.objectStore(SYNC_QUEUE).delete(entry.id);
            }
        } catch {
            // Will retry on next sync event
        }
    }

    // Notify open clients to refresh data
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

// ─── Message handler (e.g. SKIP_WAITING for instant updates) ────────────────

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ─── IndexedDB helpers ───────────────────────────────────────────────────────

function openQueueDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('tududi-offline', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(SYNC_QUEUE)) {
                db.createObjectStore(SYNC_QUEUE, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

function idbAll(store) {
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

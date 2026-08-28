const CACHE_VERSION = 'tududi-v1';
const API_CACHE = 'tududi-api-v1';
const SYNC_QUEUE = 'tududi-sync-queue';

// Non-GET endpoints with nothing worth replaying later (stateless reads
// that happen to use a POST body). Queuing these would waste storage and
// hand callers a stale/synthetic result instead of a real one.
const NO_QUEUE_PATHS = ['/api/inbox/analyze-text'];

// Set via SESSION_UPDATE message from the client after login.
// Used to tag queued mutations and detect cross-principal replays.
let sessionUserId = null;

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

// ─── Message handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
    const { type, sessionId } = event.data || {};

    if (type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }
    if (type === 'SESSION_UPDATE') {
        sessionUserId = sessionId || null;
        return;
    }
    if (type === 'CLEAR_CACHE') {
        event.waitUntil(clearUserData());
        return;
    }
});

async function clearUserData() {
    sessionUserId = null;
    await caches.delete(API_CACHE);
    await purgeQueue();
}

async function purgeQueue() {
    const db = await openQueueDb();
    const tx = db.transaction(SYNC_QUEUE, 'readwrite');
    tx.objectStore(SYNC_QUEUE).clear();
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/api/')) {
        if (request.method === 'GET') {
            event.respondWith(handleApiGet(request));
        } else if (NO_QUEUE_PATHS.some((p) => url.pathname.startsWith(p))) {
            event.respondWith(handleApiNoQueue(request));
        } else {
            event.respondWith(handleApiMutation(request));
        }
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match('/').then((cached) => cached || fetch(request))
            )
        );
        return;
    }

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

        // A 401 means the session expired or a different user is now active.
        // Clear cached data so the next user cannot see stale responses.
        if (response.status === 401 || response.status === 403) {
            clearUserData().then(() => {
                self.clients.matchAll({ type: 'window' }).then((clients) =>
                    clients.forEach((client) =>
                        client.postMessage({ type: 'AUTH_EXPIRED' })
                    )
                );
            });
            return response;
        }

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

// ─── API calls that are never queued (stateless, nothing to replay) ──────────

async function handleApiNoQueue(request) {
    try {
        return await fetch(request);
    } catch {
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
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tududi-Queued': '1',
                },
            }
        );
    }
}

// Sensitive headers that must not be persisted; the browser re-attaches
// session cookies automatically when replaying via fetch().
const SENSITIVE_HEADERS = new Set([
    'authorization',
    'cookie',
    'cookie2',
    'x-auth-token',
]);

async function queueRequest(request) {
    const body = await request.text().catch(() => '');

    const safeHeaders = {};
    for (const [k, v] of request.headers.entries()) {
        if (!SENSITIVE_HEADERS.has(k.toLowerCase())) {
            safeHeaders[k] = v;
        }
    }

    const entry = {
        url: request.url,
        method: request.method,
        headers: safeHeaders,
        body,
        sessionId: sessionUserId,
        timestamp: Date.now(),
    };

    const db = await openQueueDb();
    const tx = db.transaction(SYNC_QUEUE, 'readwrite');
    tx.objectStore(SYNC_QUEUE).add(entry);

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

// Entries may have been queued with no CSRF token (getCsrfToken()
// degrades to '' offline - see frontend/utils/csrfService.ts) or with one
// that's gone stale by the time we're back online. The Background Sync
// event firing implies connectivity, so fetch a fresh one and overwrite
// whatever the entry captured before replaying. Falls back to the
// entry's original headers if the refresh itself fails, so a flaky
// reconnect doesn't drop the whole batch - the per-entry try/catch below
// leaves it queued for the next sync either way.
async function refreshCsrfHeader(headers) {
    const csrfKey = Object.keys(headers).find(
        (key) => key.toLowerCase() === 'x-csrf-token'
    );
    if (!csrfKey) return headers;

    try {
        const response = await fetch('/api/csrf-token', {
            credentials: 'include',
        });
        if (!response.ok) return headers;
        const { csrfToken } = await response.json();
        return { ...headers, [csrfKey]: csrfToken };
    } catch {
        return headers;
    }
}

async function replayQueuedRequests() {
    const db = await openQueueDb();
    const tx = db.transaction(SYNC_QUEUE, 'readonly');
    const entries = await idbAll(tx.objectStore(SYNC_QUEUE));

    for (const entry of entries) {
        // Drop entries queued by a different user — never replay another
        // principal's mutations under the current session.
        if (
            entry.sessionId !== null &&
            sessionUserId !== null &&
            entry.sessionId !== sessionUserId
        ) {
            const delTx = db.transaction(SYNC_QUEUE, 'readwrite');
            delTx.objectStore(SYNC_QUEUE).delete(entry.id);
            continue;
        }

        try {
            const headers = await refreshCsrfHeader(entry.headers);
            const response = await fetch(entry.url, {
                method: entry.method,
                headers,
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

    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

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

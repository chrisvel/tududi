# PWA & Offline Support

[← Back to Index](../CLAUDE.md)

---

## Overview

Tududi is an installable Progressive Web App (PWA). Users can add it to their home screen on Android, iOS, and desktop browsers and use it like a native app. When the network is unavailable the app stays readable from cache; write operations are queued and replayed automatically once connectivity returns.

---

## Installation

### What browsers support

| Browser | Install method |
|---------|---------------|
| Chrome / Edge (Android, desktop) | Address bar install icon or `⋮ → Install app` |
| Safari (iOS 16.4+) | Share sheet → Add to Home Screen |
| Firefox (Android) | `⋮ → Install` |

### Requirements satisfied by Tududi

1. `public/manifest.json` — declares name, icons, `display: standalone`
2. `<link rel="manifest">` in `public/index.html`
3. `public/sw.js` — service worker registered from `frontend/index.tsx` in production
4. HTTPS — required in production; localhost is exempt for development

### Verifying installability (Chrome DevTools)

1. Open DevTools → **Application** → **Manifest** — no errors should appear
2. **Application** → **Service Workers** — status should be "activated and running"
3. **Lighthouse** → **PWA** category — installability check should pass

---

## Web App Manifest (`public/manifest.json`)

```json
{
  "id": "/",
  "name": "tududi",
  "short_name": "tududi",
  "description": "A simple and effective task management application",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#4a5568",
  "background_color": "#ffffff",
  "lang": "en",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icon-logo.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-logo.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" },
    { "src": "/favicon-32.png", "sizes": "32x32", "type": "image/png" },
    { "src": "/favicon-16.png", "sizes": "16x16", "type": "image/png" }
  ]
}
```

**Icon notes:**
- `purpose: "any"` — standard icon used in most contexts
- `purpose: "maskable"` — Android adaptive icon; the 512×512 PNG has safe-zone padding
- Two separate entries are required; `"purpose": "any maskable"` in a single entry is a spec violation

**Sub-path deployments (e.g. Home Assistant ingress):** The static `start_url: "/"` and `scope: "/"` will not match the ingress path, so the install prompt will not appear. A dynamic manifest served from the backend is needed for those deployments — this is a known limitation and a future enhancement.

---

## Service Worker (`public/sw.js`)

The SW is a plain JS file (not transpiled by webpack) served from the origin root. `CopyWebpackPlugin` copies it from `public/` to `dist/` on every production build.

### Lifecycle

```
install   → pre-cache STATIC_ASSETS, skipWaiting()
activate  → delete stale static-cache versions, clients.claim()
fetch     → route to handler by request type
message   → handle SKIP_WAITING / SESSION_UPDATE / CLEAR_CACHE
sync      → replay queued mutations (Background Sync API)
```

### Cache strategy

| Request type | Handler | Behaviour |
|---|---|---|
| Static assets (same-origin, non-API) | cache-first | Serve from `tududi-v1` cache; populate on first network hit |
| API `GET` `/api/*` | `handleApiGet` | Network-first; on success write to `tududi-api-v1`; on network failure serve stale cache; if no cache return `503 { offline: true }` |
| API mutations `/api/*` | `handleApiMutation` | Attempt network; if offline queue to IndexedDB, return `202 { queued: true }` with an `X-Tududi-Queued: 1` header; register Background Sync tag `tududi-sync` |
| Stateless POST endpoints (e.g. `/api/inbox/analyze-text`) | `handleApiNoQueue` | Network-only; on failure return `503 { offline: true }` — never queued, since there's nothing meaningful to replay |
| Navigation (`mode: navigate`) | inline | Network-first; fall back to cached `/` shell for SPA routing |

### Cache names

| Name | Contents | Cleared when |
|------|----------|-------------|
| `tududi-v1` | Static assets (JS, CSS, fonts, icons, manifest) | SW activate removes old versions |
| `tududi-api-v1` | API GET responses | 401/403 from any live fetch; CLEAR_CACHE message; manual SW update |

### Offline mutation queue

Mutations that fail due to network error are stored in an IndexedDB database named `tududi-offline`, object store `tududi-sync-queue`. Each entry contains:

```
{ id, url, method, headers (auth headers stripped), body, sessionId, timestamp }
```

The Background Sync API fires the `tududi-sync` event when connectivity returns. Before replaying each entry the SW re-fetches a fresh CSRF token (`GET /api/csrf-token`) and overwrites whatever `x-csrf-token`/`X-CSRF-Token` header was captured at queue time — a token fetched while offline (see below) may be missing or stale by replay time, and the session-scoped CSRF secret backing it doesn't rotate, so a freshly-issued token is always valid. If the refresh itself fails, the entry replays with its original header and is left queued for the next sync attempt. The SW replays entries in order, deleting successfully-replayed entries from the store. After all replays it sends `{ type: 'SYNC_COMPLETE' }` to all open windows; `frontend/index.tsx` handles this by calling SWR's global `mutate(() => true)` to revalidate all cached data.

**CSRF tokens while offline:** every mutating request needs a CSRF token, normally fetched via `getCsrfToken()` (`frontend/utils/csrfService.ts`) — itself a `GET`, so it's never queued by the SW. If that fetch fails (e.g. offline), `getCsrfToken()` resolves `''` instead of throwing, so the caller's actual mutating `fetch()` still fires and reaches `handleApiMutation` to be queued, rather than aborting before the request is ever made. Frontend code that receives the synthetic `202` response must check for it (`isQueuedOfflineResponse()` / `handleAuthResponse()` throwing `OfflineQueuedError`, both in `frontend/utils/authUtils.ts`) rather than treating the `{ queued: true }` placeholder body as the real resource.

**Limitation:** Creating tasks offline generates a server-assigned numeric ID on replay. If the queue contains multiple dependent mutations (e.g. create task then update it) the second mutation may reference an ID that didn't exist at queue time. This edge case is tracked alongside the broader id/uid consistency work.

### SW update flow

When a new version of `sw.js` is deployed:

1. Browser detects the changed file during the next visit
2. New SW installs in the background (`install` event)
3. `frontend/index.tsx` detects `updatefound` → `statechange: 'installed'` → sends `{ type: 'SKIP_WAITING' }` to the new worker
4. New SW calls `self.skipWaiting()` → takes control immediately
5. `activate` event deletes old static caches (API cache is preserved)

---

## Session Security

The service worker caches API responses and queues mutations across page navigations. In a multi-user or shared-device scenario this creates two risks:

**Risk 1 — Cached data visible to next user:** If User A logs out and User B logs in, the API cache could serve User A's task list to User B.

**Mitigation:**
- `handleApiGet` detects 401/403 responses from live fetches and calls `clearUserData()`, which deletes `tududi-api-v1` and purges the mutation queue.
- `App.tsx` calls `notifySwClearCache()` when `/api/current_user` returns 401.
- `Navbar.tsx` calls `notifySwClearCache()` in `handleLogout()` before navigating to `/login`.
- The SW handles the `CLEAR_CACHE` postMessage by deleting the API cache and clearing IndexedDB.

**Risk 2 — Queued mutations replayed under wrong session:** User A queues mutations, logs out, User B logs in. Background Sync fires and could replay User A's operations authenticated as User B.

**Mitigation:**
- Auth-sensitive headers (`Authorization`, `Cookie`, `Cookie2`, `X-Auth-Token`) are stripped before storing queue entries — they cannot be persisted or forged.
- `App.tsx` calls `notifySwSession(user.id)` after successful login. The SW stores this as `sessionUserId`.
- Each queued entry is tagged with the `sessionUserId` at queue time.
- On replay, if `entry.sessionId !== sessionUserId` the entry is deleted without executing.
- The SW also broadcasts `{ type: 'AUTH_EXPIRED' }` to open clients on any 401, allowing the app to redirect to login.

### SW communication utilities (`frontend/utils/swUtils.ts`)

```typescript
notifySwSession(userId)   // Called after login in App.tsx
notifySwClearCache()      // Called on logout (Navbar.tsx) and on 401 (App.tsx)
```

Both functions handle the case where the SW has not yet taken control of the page (falls back to `navigator.serviceWorker.ready`).

---

## Development Mode

The service worker is **not registered** when `NODE_ENV !== 'production'`. Instead, `frontend/index.tsx` actively unregisters any existing SWs and clears all caches at startup. This prevents stale cached responses from interfering with live development.

```typescript
// In frontend/index.tsx (dev only)
if (isDevelopment && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
    });
    if ('caches' in window) {
        caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
}
```

---

## Adding New API Endpoints

No changes to the service worker are needed for new API endpoints. The SW applies its strategy based on the `/api/` path prefix:

- **GET endpoints**: automatically cached in `tududi-api-v1` on first successful response
- **Mutations**: automatically queued when offline

If a new endpoint should **not** be cached (e.g. an endpoint that returns one-time tokens or download URLs), add its path prefix to a blocklist in `handleApiGet`:

```javascript
const NO_CACHE_PATHS = ['/api/auth/token', '/api/downloads/'];

async function handleApiGet(request) {
    const url = new URL(request.url);
    if (NO_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) {
        return fetch(request); // network only, no cache
    }
    // ... rest of handler
}
```

---

## Updating the Cache Version

When making a breaking change to the static asset structure (e.g. removing or renaming a cached file), bump `CACHE_VERSION` at the top of `public/sw.js`:

```javascript
const CACHE_VERSION = 'tududi-v2'; // was tududi-v1
```

The `activate` event deletes all caches that don't match the current `CACHE_VERSION` or `API_CACHE`. If the API response format changes significantly, also bump `API_CACHE`:

```javascript
const API_CACHE = 'tududi-api-v2'; // was tududi-api-v1
```

---

## Known Limitations

| Limitation | Detail |
|-----------|--------|
| Sub-path deployments | Static `manifest.json` uses `start_url: "/"` — install prompt won't appear for Home Assistant ingress or other sub-path setups |
| Offline task creation | Creating a task offline queues a POST; the server-assigned `id` is unknown at queue time, so dependent mutations in the same offline session may fail on replay |
| No conflict resolution | If the server state changed while offline, replayed mutations apply on top of the new state without merging — last writer wins |
| iOS Safari background sync | iOS does not support the Background Sync API; queued mutations are replayed the next time the app is opened while online |

---

[← Back to Index](../CLAUDE.md)

// Service Worker for tududi PWA
// This is the source template - placeholders are replaced during build
// CACHE_NAME and STATIC_ASSETS are injected by scripts/sw-template.js

/* global clients */
/* eslint-disable no-undef */
const CACHE_NAME = "__CACHE_NAME__";
const staticAssets = __STATIC_ASSETS__;
const OFFLINE_PAGE = "/offline.html";
/* eslint-enable no-undef */

// Installation event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache offline page first (critical)
      const offlinePromise = cache
        .add(OFFLINE_PAGE)
        .catch((error) => {
          console.warn(`✗ Failed to cache ${OFFLINE_PAGE}:`, error.message);
        });

      // Cache other assets individually to identify failures
      const assetsPromise = Promise.all(
        staticAssets.map((url) => {
          return cache
            .add(url)
            .catch((error) => {
              console.warn(`✗ Failed to cache ${url}:`, error.message);
              // Continue even if this asset fails
              return Promise.resolve();
            });
        })
      );

      return Promise.all([offlinePromise, assetsPromise]);
    })
  );
  self.skipWaiting();
});

// Activation event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - different strategies for different resource types
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // Static files that should be cached aggressively
  // - /api/uploads/* : User uploaded files (images, attachments)
  // - /locales/* : Translation files
  if (pathname.startsWith("/api/uploads/") || pathname.startsWith("/locales/")) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          })
          .catch((error) => {
            console.error(`❌ Failed to fetch static file: ${pathname}`, error);
            // Return 404 for missing static files when offline
            return new Response("File not found", {
              status: 404,
              statusText: "Not Found",
              headers: {
                "Content-Type": "text/plain",
              },
            });
          });
      })
    );
    return;
  }

  // Dynamic API requests - always try network first
  // Excludes uploads and locales which are handled above
  if (pathname.startsWith("/api/")) {
    // List of endpoints that should NOT be cached (auth, sessions, etc.)
    const noCacheEndpoints = [
      "/api/login",
      "/api/logout",
      "/api/register",
      "/api/current_user",
    ];
    const shouldCache = !noCacheEndpoints.some((endpoint) =>
      pathname.startsWith(endpoint)
    );

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful GET responses for offline use (except sensitive endpoints)
          if (
            shouldCache &&
            response &&
            response.status === 200 &&
            event.request.method === "GET"
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Both network and cache failed - return error
            console.error(`❌ API call failed (offline, no cache): ${pathname}`);
            return new Response(
              JSON.stringify({
                error: "Offline",
                message: "You are offline and this data is not cached.",
                path: pathname,
              }),
              {
                status: 503,
                statusText: "Service Unavailable",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
          });
        })
    );
    return;
  }

  // For all other requests (static assets, SPA routes)
  // Try cache first, then network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (
            !response ||
            response.status !== 200 ||
            response.type === "error"
          ) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch((error) => {
          console.error("Fetch failed:", error);
          
          // For navigation requests (HTML pages), show offline page
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_PAGE).then((offlineResponse) => {
              if (offlineResponse) {
                return offlineResponse;
              }
              // Fallback if offline page isn't cached
              return new Response("Offline - Resource not available", {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "text/plain" },
              });
            });
          }

          // For non-navigation requests, return error response
          return new Response("Offline - Resource not available", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/plain" },
          });
        });
    })
  );
});

// Push notification event - show browser notification
self.addEventListener("push", (event) => {
  if (!event.data) {
    event.waitUntil(
      self.registration.showNotification("tududi", { body: "New notification" })
    );
    return;
  }

  try {
    const data = event.data.json();
    const title = data.title || "tududi";
    const options = {
      body: data.body || data.message || "",
      icon: data.icon || "/icon-logo.png",
      badge: data.badge || "/favicon-32.png",
      tag: data.tag || `notification-${Date.now()}`,
      data: data.data || {},
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("Error showing push notification:", error);
  }
});

// Notification click event - open app and navigate to relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = "/";

  // Navigate to relevant page based on notification data
  if (data.taskUid) {
    targetUrl = `/tasks/${data.taskUid}`;
  } else if (data.projectUid) {
    targetUrl = `/projects/${data.projectUid}`;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if found
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window if no existing window
      return clients.openWindow(targetUrl);
    })
  );
});
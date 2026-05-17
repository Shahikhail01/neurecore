/**
 * sw.js — NeureCore HeadQuarter Service Worker
 * ------------------------------------------------------------
 * Strategy map:
 *  • Static assets (_next/static, fonts)  → CacheFirst
 *  • Pages (HTML navigation)              → NetworkFirst with offline fallback
 *  • API calls (/api/*)                   → NetworkFirst, no cache
 *  • Icons / images                       → CacheFirst (30 days)
 *
 * Background Sync: queues failed PATCH/POST mutations for replay.
 * Push Notifications: receives and shows push payloads from server.
 */

'use strict';

const CACHE_VERSION  = 'hq-v1';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const PAGES_CACHE    = `${CACHE_VERSION}-pages`;
const IMAGES_CACHE   = `${CACHE_VERSION}-images`;
const SYNC_QUEUE_KEY = 'hq-sync-queue';

const STATIC_PRECACHE = [
  '/offline.html',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('hq-') && k !== STATIC_CACHE && k !== PAGES_CACHE && k !== IMAGES_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // API calls — NetworkFirst, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, null));
    return;
  }

  // Next.js static assets — CacheFirst (immutable)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 30 * 24 * 60 * 60));
    return;
  }

  // Images — CacheFirst (30 days)
  if (/\.(png|jpg|jpeg|svg|gif|webp|avif|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGES_CACHE, 30 * 24 * 60 * 60));
    return;
  }

  // HTML pages — NetworkFirst with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, '/offline.html'));
    return;
  }
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'hq-mutation-sync') {
    event.waitUntil(replayQueuedMutations());
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = { title: 'HeadQuarter', body: 'You have a new update.' };

  try {
    if (event.data) payload = event.data.json();
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body:    payload.body || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    tag:     payload.tag || 'hq-notification',
    renotify: true,
    data:    payload.data || {},
    actions: payload.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options),
  );
});

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cache-First strategy */
async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);

  if (cached) {
    const date = cached.headers.get('date');
    if (!maxAgeSeconds || !date || (Date.now() - new Date(date).getTime()) < maxAgeSeconds * 1000) {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok || response.status === 0) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached ?? new Response('Offline', { status: 503 });
  }
}

/** Network-First strategy */
async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (cacheName && (response.ok || response.status === 0)) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (cacheName) {
      const cache  = await caches.open(cacheName);
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Service Unavailable', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

/** Replay stored PATCH/POST/PUT/DELETE requests */
async function replayQueuedMutations() {
  const db   = await openSyncDB();
  const queue = await getQueue(db);

  for (const entry of queue) {
    try {
      await fetch(entry.url, {
        method:  entry.method,
        headers: entry.headers,
        body:    entry.body,
      });
      await removeFromQueue(db, entry.id);
    } catch {
      // Will retry on next sync event
    }
  }
}

// ─── Minimal IndexedDB for sync queue ─────────────────────────────────────────
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hq-sync', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function getQueue(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function removeFromQueue(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readwrite');
    const req = tx.objectStore('queue').delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

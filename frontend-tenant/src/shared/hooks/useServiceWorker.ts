'use client';
// ─── useServiceWorker.ts ──────────────────────────────────────────────────────
// SRP: Service worker registration lifecycle only.
// DIP: Depends on browser's navigator.serviceWorker abstraction.
//
// Usage: call once at app root — <ServiceWorkerRegistrar />

import { useEffect, useRef } from 'react';

export type SWStatus = 'unsupported' | 'pending' | 'active' | 'waiting' | 'error';

export interface ServiceWorkerState {
  status: SWStatus;
  updateAvailable: boolean;
  skipWaiting: () => void;
}

/** Enqueues a failed mutation into the SW sync queue (IndexedDB) */
export async function enqueueMutation(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const db = await openSyncDB();
  const tx = db.transaction('queue', 'readwrite');
  tx.objectStore('queue').add({ url, method, headers, body, timestamp: Date.now() });
  db.close();

  // Request background sync
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as unknown as { sync: { register(tag: string): Promise<void> } })
      .sync.register('hq-mutation-sync');
  }
}

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hq-sync', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function useServiceWorker(): ServiceWorkerState {
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Handle update found
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              waitingRef.current = installing;
              // Notify app that update is ready (custom event)
              window.dispatchEvent(new CustomEvent('hq:sw-update'));
            }
          });
        });
      })
      .catch((err) => {
        console.error('[SW] Registration failed:', err);
      });

    // Listening for controller change (after skipWaiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  return {
    status: 'active',
    updateAvailable: false,
    skipWaiting: () => {
      if (waitingRef.current) {
        waitingRef.current.postMessage({ type: 'SKIP_WAITING' });
      }
    },
  };
}

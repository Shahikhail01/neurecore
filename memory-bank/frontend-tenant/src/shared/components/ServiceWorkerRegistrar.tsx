'use client';
// ─── ServiceWorkerRegistrar.tsx ───────────────────────────────────────────────
// SRP: Mounts SW registration and listens for update events only.
// Renders nothing visible — pure side-effect component.

import { useEffect, useState } from 'react';
import { useServiceWorker } from '@/shared/hooks/useServiceWorker';

export function ServiceWorkerRegistrar(): null {
  useServiceWorker();

  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const handler = () => setUpdateReady(true);
    window.addEventListener('hq:sw-update', handler);
    return () => window.removeEventListener('hq:sw-update', handler);
  }, []);

  // When update is ready, show a non-blocking toast via CustomEvent
  useEffect(() => {
    if (!updateReady) return;
    window.dispatchEvent(
      new CustomEvent('hq:toast', {
        detail: {
          message: 'A new version of HeadQuarter is available. Refresh to update.',
          severity: 'info',
          duration: 10000,
          action: { label: 'Refresh', onClick: () => window.location.reload() },
        },
      }),
    );
  }, [updateReady]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PageShell, GlassPanel } from '@neurecore/ui-visual';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error] Route error:', error);
  }, [error]);

  return (
    <PageShell variant="default">
      <GlassPanel variant="panel" padding="lg" className="text-center max-w-md mx-auto">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-[color:var(--state-danger)]/15">
          <AlertTriangle className="w-8 h-8 text-[color:var(--state-danger)]" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Something went wrong
        </h2>
        <p className="text-zinc-400 text-sm mb-6">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <button
          onClick={reset}
          className="nv-btn-accent inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </GlassPanel>
    </PageShell>
  );
}

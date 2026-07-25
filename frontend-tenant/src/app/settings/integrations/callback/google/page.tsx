'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { GlassPanel } from '@neurecore/ui-visual';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    const connected = searchParams.get('connected');
    const email = searchParams.get('email');

    if (error) {
      // Show error briefly then redirect
      const decodedError = atob(error);
      setTimeout(() => {
        router.replace('/settings/integrations');
      }, 3000);
    } else if (connected === 'true') {
      setTimeout(() => {
        router.replace('/settings/integrations');
      }, 2000);
    } else {
      router.replace('/settings/integrations');
    }
  }, [searchParams, router]);

  const error = searchParams.get('error');
  const connected = searchParams.get('connected');
  const email = searchParams.get('email');

  if (error) {
    const decodedError = atob(error);
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
      <GlassPanel variant="panel" padding="lg" className="text-center space-y-4 max-w-md w-full">

          <div className="w-16 h-16 rounded-full bg-[color:var(--state-danger)]/10 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-[color:var(--state-danger)]" />
          </div>
          <h1 className="text-xl font-semibold">Connection Failed</h1>
          <p className="text-muted-foreground text-sm">{decodedError}</p>
          <p className="text-xs text-muted-foreground">Redirecting to settings...</p>
        </GlassPanel>
      </div>
    );
  }

  if (connected === 'true') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
      <GlassPanel variant="panel" padding="lg" className="text-center space-y-4 max-w-md w-full">

          <div className="w-16 h-16 rounded-full bg-[color:var(--state-success)]/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[color:var(--state-success)]" />
          </div>
          <h1 className="text-xl font-semibold">Google Workspace Connected!</h1>
          {email && <p className="text-muted-foreground text-sm">Account: {email}</p>}
          <p className="text-muted-foreground text-sm">Your agents now have access to Gmail, Drive, Calendar, and Sheets.</p>
          <p className="text-xs text-muted-foreground">Redirecting to settings...</p>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <GlassPanel variant="panel" padding="lg" className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Completing Google connection...</p>
      </GlassPanel>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}

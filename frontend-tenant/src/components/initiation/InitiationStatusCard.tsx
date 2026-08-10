'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  enterpriseInitiationService,
  type EnterpriseInitiationStatus,
} from '@/services/enterpriseInitiation.service';
import { InitiationStatusView } from './InitiationStatusView';

export interface InitiationStatusCardProps {
  initiationId: string;
  className?: string;
  showTimeline?: boolean;
}

export function InitiationStatusCard({
  initiationId,
  className,
  showTimeline = true,
}: InitiationStatusCardProps) {
  const [initiation, setInitiation] =
    useState<EnterpriseInitiationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await enterpriseInitiationService.getStatus(initiationId);
      setInitiation(next);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load initiation status',
      );
    } finally {
      setLoading(false);
    }
  }, [initiationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !initiation) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading initiation status…
      </div>
    );
  }

  if (error && !initiation) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {error}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-rose-200 px-2 py-1 text-xs hover:bg-rose-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!initiation) {
    return null;
  }

  return (
    <InitiationStatusView
      className={className}
      showTimeline={showTimeline}
      initiation={{
        id: initiation.initiationId,
        status: initiation.status,
        projectId: initiation.projectId,
        approvedAt: initiation.approvedAt,
        approvalComment: null,
        createdAt: initiation.updatedAt,
        updatedAt: initiation.updatedAt,
      }}
    />
  );
}

export default InitiationStatusCard;

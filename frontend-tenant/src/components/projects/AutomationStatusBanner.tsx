'use client';
/**
 * AutomationStatusBanner — Phase 3A
 *
 * Shows the automation status after project creation:
 *   - ⚙️ Setting up... (automation in progress)
 *   - ✅ Live (automation complete)
 *   - ❌ Setup incomplete (automation failed)
 *
 * Polls GET /v1/projects/:id/automation/latest until COMPLETED or FAILED.
 */

import { useState, useEffect } from 'react';
import api from '@/services/api';

type AutomationStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

interface AutomationBannerProps {
  projectId: string;
  onComplete?: () => void;
}

export function AutomationStatusBanner({ projectId, onComplete }: AutomationBannerProps) {
  const [status, setStatus] = useState<AutomationStatus>('PENDING');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    async function poll() {
      try {
        const res = await api.get(
          `/v1/projects/${projectId}/automation/latest`,
        );

        if (cancelled) return;

        const data = res.data?.data ?? res.data;
        setStatus(data.status);
        setResult(data.result);

        if (data.status === 'COMPLETED') {
          onComplete?.();
          return;
        }

        if (data.status === 'FAILED') {
          return;
        }

        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch {
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 3000);
        }
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [projectId, onComplete]);

  if (status === 'COMPLETED') {
    const agents = result?.['agentsSpawned'] ?? 0;
    const goals = result?.['goalsCreated'] ?? 0;
    const tasks = result?.['tasksCreated'] ?? 0;
    const cos = result?.['chiefOfStaffAssigned'] ?? false;

    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
        <span className="text-[color:var(--state-success)] text-sm font-medium">✅ AI workforce ready</span>
        <span className="text-[color:var(--state-success)] text-xs">
          {String(agents)} agents · {String(goals)} goals · {String(tasks)} tasks{cos ? ' · CoS assigned' : ''}
        </span>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
        <span className="text-[color:var(--state-danger)] text-sm font-medium">❌ AI setup incomplete</span>
        <span className="text-[color:var(--state-danger)] text-xs">
          {(result?.['errors'] as string[])?.[0] ?? 'Automation failed. Trigger manually from project settings.'}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-2">
      <span className="animate-spin text-[color:var(--state-info)]">⚙️</span>
      <span className="text-[color:var(--state-info)] text-sm font-medium">AI is setting up your project...</span>
      <span className="text-[color:var(--state-info)] text-xs">spawning agents, creating goals, planning tasks</span>
    </div>
  );
}

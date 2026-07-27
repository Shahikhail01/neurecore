// src/components/assignments/AgentAssignmentPanel.tsx
//
// Phase 7 — wires the existing AgentPicker (Phase 4) onto the
// assignments backend (eligible-agents + assign + release). The panel
// is self-contained and renders inline in the project workspace or
// task inspector.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AgentPicker, type AgentPickerAgent } from '@/components/assignments/AgentPicker';
import { assignmentsService } from '@/services/assignments.service';
import { Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AgentAssignmentPanelProps {
  taskId: string;
  requiredRole?: string;
  requiredCapabilities?: string[];
  allowManualOverride?: boolean;
  onAssigned?: (result: { agentId: string; assignmentId: string }) => void;
  className?: string;
}

export function AgentAssignmentPanel({
  taskId,
  requiredRole,
  requiredCapabilities = [],
  allowManualOverride = true,
  onAssigned,
  className,
}: AgentAssignmentPanelProps) {
  const [agents, setAgents] = useState<AgentPickerAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    try {
      const list = await assignmentsService.listEligibleAgents(taskId);
      setAgents(
        list.map((a) => ({
          agentId: a.agentId,
          name: a.name,
          score: a.score,
          rationale: a.rationale,
          currentWorkload: a.currentWorkload,
          capabilityScore: 0,
          workloadScore: 0,
          departmentScore: 0,
          historicalScore: 0,
          policyVersion: 'canonical-v1',
        })),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'eligible agents failed');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  const submit = async (agentId: string, rationale: string) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const isOverride = !agents.some((a) => a.agentId === agentId);
      const result = await assignmentsService.assign({
        taskId,
        agentId,
        manualOverrideRationale: isOverride ? rationale : undefined,
      });
      onAssigned?.({
        agentId: result.agentId,
        assignmentId: result.assignmentId,
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        className={cn(
          'flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600',
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading eligible AI employees…
      </div>
    );
  }

  if (error && agents.length === 0) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700',
          className,
        )}
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span className="flex-1">{error}</span>
        <button
          type="button"
          onClick={fetchOnce}
          className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
        >
          <RefreshCcw className="h-3 w-3" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {submitError ? (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {submitError}
        </p>
      ) : null}
      <AgentPicker
        taskId={taskId}
        requiredRole={requiredRole ?? 'any'}
        requiredCapabilities={requiredCapabilities}
        agents={agents}
        onAssign={async (agentId, rationale) => {
          await submit(agentId, rationale);
        }}
        onCancel={() => {
          /* no-op — host renders the cancel */
        }}
        allowManualOverride={allowManualOverride}
        overrideCandidates={agents}
      />
      {submitting ? (
        <p className="text-xs text-slate-500">Assigning…</p>
      ) : null}
    </div>
  );
}

export default AgentAssignmentPanel;

/**
 * src/components/assignments/AgentPicker.tsx
 *
 * Phase 4 (AI-IMPLEMENTATION-PLAN-v2.md §6.3) — Searchable AI
 * assignment picker.
 *
 * Behavior:
 *  - Lists eligible agents for a task with name / role / capabilities
 *  - Shows availability, current workload, department alignment
 *  - Surfaces the assignment rationale returned by the backend
 *  - Manual override mode allows authorized users to choose any
 *    agent and provide a rationale
 *  - Calls onAssign(agentId) — never lets users type UUIDs manually
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  Search,
  ShieldCheck,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export interface AgentPickerAgent {
  agentId: string;
  name: string;
  score: number;
  rationale: string;
  currentWorkload: number;
  capabilityScore: number;
  workloadScore: number;
  departmentScore: number;
  historicalScore: number;
  policyVersion: string;
}

export interface AgentPickerProps {
  taskId: string;
  requiredRole: string;
  requiredCapabilities: string[];
  agents: AgentPickerAgent[];
  onAssign: (agentId: string, rationale: string) => Promise<void> | void;
  onCancel: () => void;
  /** Optional: when true, surface the manual override control. */
  allowManualOverride?: boolean;
  /** Optional: pre-supplied manual override candidates. */
  overrideCandidates?: AgentPickerAgent[];
}

function badgeColor(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700';
  if (score >= 60) return 'bg-blue-100 text-blue-700';
  if (score >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

export const AgentPicker: React.FC<AgentPickerProps> = ({
  taskId,
  requiredRole,
  requiredCapabilities,
  agents,
  onAssign,
  onCancel,
  allowManualOverride = false,
  overrideCandidates,
}) => {
  const [query, setQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [overrideRationale, setOverrideRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => {
      if (a.name.toLowerCase().includes(q)) return true;
      if (a.policyVersion.toLowerCase().includes(q)) return true;
      if (a.rationale.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [agents, query]);

  const selectedAgent =
    agents.find((a) => a.agentId === selectedAgentId) ??
    overrideCandidates?.find((a) => a.agentId === selectedAgentId) ??
    null;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!selectedAgentId) {
      setError('Please choose an AI employee before submitting.');
      return;
    }
    const overrideMode = !agents.some((a) => a.agentId === selectedAgentId);
    if (overrideMode && !overrideRationale.trim()) {
      setError('Manual override requires a rationale.');
      return;
    }
    setSubmitting(true);
    try {
      await onAssign(
        selectedAgentId,
        overrideMode
          ? overrideRationale.trim()
          : selectedAgent?.rationale ?? 'auto-assignment',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign AI employee.');
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="agent-picker"
      data-task-id={taskId}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Pick an AI employee
          </h2>
          <p className="text-sm text-slate-500">
            Task <span className="font-mono">{taskId.slice(0, 8)}</span> needs
            role <span className="font-medium">{requiredRole || 'any'}</span>
            {requiredCapabilities.length > 0 ? (
              <>
                {' '}with capabilities{' '}
                <span className="font-medium">
                  {requiredCapabilities.join(', ')}
                </span>
              </>
            ) : null}
            .
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </header>

      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" aria-hidden />
        <input
          aria-label="Search AI employees"
          placeholder="Search by name, rationale, or policy"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          data-testid="agent-picker-search"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          No eligible AI employee matches this task. You may use manual
          override if permitted.
        </div>
      ) : (
        <ul
          role="listbox"
          aria-label="Eligible AI employees"
          className="flex flex-col gap-2"
        >
          {filtered.map((agent) => {
            const selected = agent.agentId === selectedAgentId;
            return (
              <li key={agent.agentId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-testid={`agent-picker-option-${agent.agentId}`}
                  onClick={() => setSelectedAgentId(agent.agentId)}
                  className={`flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition ${
                    selected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">
                      {agent.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor(agent.score)}`}
                    >
                      score {Math.round(agent.score)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>workload {agent.currentWorkload}</span>
                    <span>capability {agent.capabilityScore}</span>
                    <span>workload score {agent.workloadScore}</span>
                    <span>department {agent.departmentScore}</span>
                    <span>historical {agent.historicalScore}</span>
                    <span>policy {agent.policyVersion}</span>
                  </div>
                  <p className="text-xs text-slate-500">{agent.rationale}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {allowManualOverride ? (
        <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <ShieldCheck className="h-4 w-4" />
            Manual override
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <select
              aria-label="Override candidate"
              className="rounded-md border border-slate-200 bg-white p-2 text-sm"
              value={selectedAgentId ?? ''}
              onChange={(e) => setSelectedAgentId(e.target.value || null)}
              data-testid="agent-picker-override-select"
            >
              <option value="">Select override target…</option>
              {(overrideCandidates ?? agents).map((candidate) => (
                <option key={candidate.agentId} value={candidate.agentId}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <textarea
              aria-label="Override rationale"
              placeholder="Required: explain why the override is necessary"
              value={overrideRationale}
              onChange={(e) => setOverrideRationale(e.target.value)}
              className="min-h-[64px] rounded-md border border-slate-200 bg-white p-2 text-sm"
              data-testid="agent-picker-override-rationale"
            />
          </div>
        </details>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <footer className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {selectedAgent ? (
            <>
              <CheckCircle2 className="inline h-3 w-3" /> Will assign to{' '}
              <span className="font-medium">{selectedAgent.name}</span>
              {' '}using policy {selectedAgent.policyVersion}
            </>
          ) : (
            'No selection yet.'
          )}
        </span>
        <button
          type="submit"
          disabled={submitting || !selectedAgentId}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="agent-picker-submit"
        >
          <UserPlus className="h-4 w-4" />
          {submitting ? 'Assigning…' : 'Assign AI employee'}
        </button>
      </footer>
    </form>
  );
};

export default AgentPicker;
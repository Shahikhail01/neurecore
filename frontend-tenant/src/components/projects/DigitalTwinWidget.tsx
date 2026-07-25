'use client';
/**
 * DigitalTwinWidget — Phase 3E
 *
 * Displays the project's Digital Twin snapshot (health, progress, team, info)
 * and an activity timeline tab.
 *
 * API: GET /v1/projects/:id/digital-twin, GET /v1/projects/:id/timeline
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

interface DigitalTwinData {
  projectId: string;
  name: string;
  status: string;
  generatedAt: string;
  health: {
    score: number | null;
    status: 'healthy' | 'at_risk' | 'critical';
    signals: Array<{ name: string; value: number; detail: string | null }>;
    atRiskReasons: string[];
  };
  progress: {
    goalsTotal: number;
    goalsCompleted: number;
    tasksTotal: number;
    tasksCompleted: number;
    stageProgress: string | null;
    completionPercent: number;
  };
  team: {
    memberCount: number;
    activeAgents: number;
    roles: string[];
  };
  information: {
    completenessScore: number;
    missingCount: number;
    lastDiscoveryAt: string | null;
  };
  recentActivity: Array<{
    type: string;
    title: string;
    actor: string;
    timestamp: string;
  }>;
  milestones: Array<{
    type: string;
    title: string;
    date: string | null;
    achieved: boolean;
  }>;
}

interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  actorId: string;
  timestamp: string;
  severity: string;
}

interface DigitalTwinWidgetProps {
  projectId: string;
}

export function DigitalTwinWidget({ projectId }: DigitalTwinWidgetProps) {
  const [tab, setTab] = useState<'twin' | 'timeline'>('twin');
  const [twin, setTwin] = useState<DigitalTwinData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTwin = useCallback(async () => {
    try {
      const res = await api.get(`/v1/projects/${projectId}/digital-twin`);
      setTwin(res.data?.data ?? res.data);
    } catch {
      setTwin(null);
    }
  }, [projectId]);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await api.get(`/v1/projects/${projectId}/timeline?limit=20`);
      const data = res.data?.data ?? res.data;
      setTimeline(data.entries ?? []);
    } catch {
      setTimeline([]);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTwin(), fetchTimeline()]).finally(() => setLoading(false));
  }, [fetchTwin, fetchTimeline]);

  if (loading) {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-8 bg-slate-200 rounded w-1/2" />
          <div className="h-24 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  const healthColor =
    twin?.health.status === 'healthy'
      ? 'text-[color:var(--state-success)] bg-green-50 border-green-200'
      : twin?.health.status === 'at_risk'
        ? 'text-[color:var(--state-warning)] bg-amber-50 border-amber-200'
        : 'text-[color:var(--state-danger)] bg-red-50 border-red-200';

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      <div className="flex border-b">
        <button
          onClick={() => setTab('twin')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            tab === 'twin'
              ? 'border-b-2 border-[color:var(--state-info)] text-[color:var(--state-info)]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Digital Twin
        </button>
        <button
          onClick={() => setTab('timeline')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            tab === 'timeline'
              ? 'border-b-2 border-[color:var(--state-info)] text-[color:var(--state-info)]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Activity Timeline
        </button>
      </div>

      {tab === 'twin' && twin && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{twin.name}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${healthColor}`}
            >
              {twin.health.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded p-3">
              <span className="text-xs text-slate-500">Health Score</span>
              <p className="text-2xl font-bold">{twin.health.score ?? 'N/A'}</p>
            </div>
            <div className="border rounded p-3">
              <span className="text-xs text-slate-500">Progress</span>
              <p className="text-2xl font-bold">{twin.progress.completionPercent}%</p>
            </div>
            <div className="border rounded p-3">
              <span className="text-xs text-slate-500">Completeness</span>
              <p className="text-2xl font-bold">{twin.information.completenessScore}%</p>
            </div>
            <div className="border rounded p-3">
              <span className="text-xs text-slate-500">Team</span>
              <p className="text-2xl font-bold">{twin.team.memberCount}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Goals & Tasks</h4>
            <div className="flex gap-4 text-sm">
              <span>
                Goals: {twin.progress.goalsCompleted}/{twin.progress.goalsTotal}
              </span>
              <span>
                Tasks: {twin.progress.tasksCompleted}/{twin.progress.tasksTotal}
              </span>
              <span>Stage: {twin.progress.stageProgress ?? 'N/A'}</span>
            </div>
          </div>

          {twin.health.atRiskReasons.length > 0 && (
            <div className="border border-red-200 bg-red-50 rounded p-3">
              <h4 className="text-sm font-medium text-red-700 mb-1">At-Risk Reasons</h4>
              <ul className="text-xs text-[color:var(--state-danger)] list-disc list-inside">
                {twin.health.atRiskReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {twin.milestones.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Milestones</h4>
              <div className="space-y-1">
                {twin.milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={m.achieved ? 'text-[color:var(--state-success)]' : 'text-slate-300'}>
                      {m.achieved ? '✓' : '○'}
                    </span>
                    <span className={m.achieved ? 'text-slate-700' : 'text-slate-400'}>
                      {m.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No activity recorded yet
            </p>
          ) : (
            <div className="space-y-2">
              {timeline.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 text-sm border-b border-slate-100 pb-2"
                >
                  <span className="text-slate-400 text-xs whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <div>
                    <p className="text-slate-700">{entry.title}</p>
                    <p className="text-xs text-slate-400">
                      {entry.type} · {entry.actorId}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

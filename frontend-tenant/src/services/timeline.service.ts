// src/services/timeline.service.ts
//
// Phase 7 (§9.2, §9.3) — Unified Timeline API client.
//
// Reads the per-entity or per-project timeline stream exposed by the
// backend TimelineController, with polling fallback semantics wrapped
// behind a single `subscribe` API. The transport layer (Socket.IO when
// available, polling fallback otherwise) is implemented in
// `useTimeline` so this surface stays transport-agnostic.

import api from './api';

export type SupportedEntityType =
  | 'Initiation'
  | 'Project'
  | 'Goal'
  | 'Task'
  | 'ExecutionAttempt'
  | 'Review';

export type ActorType = 'HUMAN' | 'AI_AGENT' | 'SYSTEM';

export type TimelineSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TimelineEvent {
  id: string;
  tenantId: string;
  entityType: SupportedEntityType;
  entityId: string;
  eventType: string;
  title: string;
  description: string;
  actorType: ActorType;
  actorId: string;
  actorName: string;
  severity: TimelineSeverity;
  correlationId: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export const timelineService = {
  /**
   * Returns the timeline for a single entity (project, task, attempt, ...).
   * Used by the inspector screens and the polling fallback.
   */
  async getEntityTimeline(
    entityType: SupportedEntityType,
    entityId: string,
    opts?: { since?: string; limit?: number },
  ): Promise<TimelineEvent[]> {
    const params = new URLSearchParams();
    if (opts?.since) params.set('since', opts.since);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const res = await api.get(
      `/timeline/${entityType}/${entityId}${qs ? `?${qs}` : ''}`,
    );
    const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
    return Array.isArray(inner) ? (inner as TimelineEvent[]) : [];
  },

  /**
   * Returns the full project timeline for the unified timeline tab on
   * the project workspace.
   */
  async getProjectTimeline(
    projectId: string,
    opts?: { since?: string; limit?: number },
  ): Promise<TimelineEvent[]> {
    const params = new URLSearchParams();
    if (opts?.since) params.set('since', opts.since);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const res = await api.get(
      `/timeline/project/${projectId}${qs ? `?${qs}` : ''}`,
    );
    const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
    return Array.isArray(inner) ? (inner as TimelineEvent[]) : [];
  },
};

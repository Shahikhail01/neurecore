/**
 * Phase 11 — Skills service (frontend).
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md.
 *
 * Single client for the `/api/v1/skill-registry/*` surface. The
 * catalog page (`/skills`) and inline-AI buttons (`Summarize on
 * /customers/[id]`, etc.) both call this service.
 *
 * SRP: every method maps to exactly one HTTP endpoint. No
 * caching, no local mutation — the canonical store is the backend.
 */

import api from './api';

export type SkillCategory =
  | 'productivity'
  | 'communication'
  | 'analysis'
  | 'extraction'
  | 'translation'
  | 'generation'
  | 'comparison';

export type SkillMode = 'chat' | 'workflow';
export type SkillInputType = 'text' | 'record' | 'file' | 'thread' | 'selection';
export type SkillOutputType = 'text' | 'json' | 'table' | 'markdown' | 'message';

export interface SkillImplementationRef {
  readonly owner: string;
  readonly endpoint: string;
}

export interface SkillDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: SkillCategory;
  readonly modes: ReadonlyArray<SkillMode>;
  readonly supportedIntents: ReadonlyArray<string>;
  readonly inputTypes: ReadonlyArray<SkillInputType>;
  readonly outputTypes: ReadonlyArray<SkillOutputType>;
  readonly version: string;
  readonly certifiedAt: string;
  readonly implemented: boolean;
  readonly implementation: SkillImplementationRef;
  readonly requiresAuthorization: boolean;
}

export interface SkillListResponse {
  data: SkillDescriptor[];
  total: number;
}

/**
 * Per-skill typed inputs. The dispatcher enforces the schema, so
 * the FE only needs to thread these together.
 */
export interface SkillInvokeInputMap {
  summarize: { source: { kind: 'text'; text: string } };
  rewrite:   { text: string; mode: 'tone' | 'shorten' | 'expand'; targetTone?: string };
  translate: { text: string; targetLocale: string; sourceLocale?: string };
  extract:   { source: { kind: 'text'; text: string }; schema: Record<string, { type: string }> };
  compare:   { left: { kind: 'text'; text: string }; right: { kind: 'text'; text: string } };
  'draft-report': { topic: string; sources: Array<{ kind: 'text'; text: string }> };
  'draft-email':   { source: { kind: 'thread' | 'text'; text?: string; threadId?: string }; recipient: { email: string; name?: string }; intent: string; brandVoice?: string };
}

export interface SkillInvocationResult<TContent> {
  skillId: string;
  content: TContent;
  citations: ReadonlyArray<{ locator: string; quote?: string; recordType?: string; recordId?: string }>;
  confidence: number;
  durationMs: number;
  limits: ReadonlyArray<string>;
}

export const skillsService = {
  /** Read the full registry catalog. */
  async list(): Promise<SkillListResponse> {
    const res = await api.get<SkillListResponse>('/skill-registry');
    return res.data;
  },

  /** Read a single skill metadata record. */
  async get(id: string): Promise<SkillDescriptor> {
    const res = await api.get<SkillDescriptor>(`/skill-registry/${id}`);
    return res.data;
  },

  /** List the seven categories for filter chips. */
  async categories(): Promise<SkillCategory[]> {
    const res = await api.get<{ data: SkillCategory[] }>('/skill-registry/categories');
    return res.data.data;
  },

  /**
   * Invoke a skill through the chat. The dispatcher routes by intent
   * (e.g. "/summarize …") and the chat panel handles reply rendering.
   *
   * Preferred over a dedicated skill-execute endpoint because the
   * chat layer already runs the LLM via the ai-gateway and has the
   * audit, tenant-scope, and rate-limit wiring we want.
   */
  async invokeViaChat<K extends keyof SkillInvokeInputMap>(
    id: K,
    payload: SkillInvokeInputMap[K],
  ): Promise<SkillInvocationResult<string> | SkillInvocationResult<Record<string, unknown>>> {
    const slash = `/${id} ${JSON.stringify(payload)}`;
    const res = await api.post<{
      reply: string;
      conversationId: string;
      skill?: { id: string; confidence: number; limits: string[]; citations: number };
    }>('/chat/messages', {
      message: slash,
      conversationId: null,
    });
    return {
      skillId: res.data.skill?.id ?? id,
      content: res.data.reply,
      citations: [],
      confidence: res.data.skill?.confidence ?? 0,
      durationMs: 0,
      limits: res.data.skill?.limits ?? [],
    } as SkillInvocationResult<string>;
  },
};

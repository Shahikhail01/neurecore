'use client';

/**
 * Phase 24 — SkillGraphClient (CR-AI-0602 save/load).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §5 (P24).
 *
 * SOLID — ISP: the composer page depends on this narrow HTTP client;
 * the canvas never sees the underlying API shape. Swap the client for
 * a mock in tests.
 *
 * DIP: the composer never imports fetch / axios directly — it depends
 * on the injected `fetchImpl` (defaults to the global fetch).
 */

import type { SkillGraph } from './SkillGraph.types';

export interface ISavedSkillGraph {
  id: string;
  tenantId: string;
  name: string;
  mode: string;
  graph: SkillGraph;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISkillGraphClient {
  list(): Promise<ReadonlyArray<ISavedSkillGraph>>;
  save(input: { name: string; graph: SkillGraph }): Promise<ISavedSkillGraph>;
  load(id: string): Promise<ISavedSkillGraph | null>;
  remove(id: string): Promise<boolean>;
  preview(input: { skillId: string; sample: unknown }): Promise<{
    skillId: string;
    content: unknown;
    citations: ReadonlyArray<unknown>;
    confidence: number;
    durationMs: number;
    nonMutating: true;
  }>;
}

export class SkillGraphHttpClient implements ISkillGraphClient {
  constructor(
    private readonly baseUrl: string = '/api/v1/skill-composer',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async list(): Promise<ReadonlyArray<ISavedSkillGraph>> {
    const res = await this.fetchImpl(`${this.baseUrl}/graphs`, {
      credentials: 'include',
    });
    if (!res.ok) return [];
    return (await res.json()) as ReadonlyArray<ISavedSkillGraph>;
  }

  async save(input: { name: string; graph: SkillGraph }): Promise<ISavedSkillGraph> {
    const res = await this.fetchImpl(`${this.baseUrl}/graphs`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`save failed: ${res.status} ${text}`);
    }
    return (await res.json()) as ISavedSkillGraph;
  }

  async load(id: string): Promise<ISavedSkillGraph | null> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/graphs/${encodeURIComponent(id)}`,
      { credentials: 'include' },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`load failed: ${res.status}`);
    return (await res.json()) as ISavedSkillGraph;
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/graphs/${encodeURIComponent(id)}`,
      { method: 'DELETE', credentials: 'include' },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { deleted: boolean };
    return json.deleted;
  }

  async preview(input: { skillId: string; sample: unknown }) {
    const res = await this.fetchImpl(
      `${this.baseUrl}/skills/${encodeURIComponent(input.skillId)}/preview`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.sample }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`preview failed: ${res.status} ${text}`);
    }
    return (await res.json()) as {
      skillId: string;
      content: unknown;
      citations: ReadonlyArray<unknown>;
      confidence: number;
      durationMs: number;
      nonMutating: true;
    };
  }
}

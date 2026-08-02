// ─── skill-registry.service.ts ─────────────────────────────────────────────────
// P1 — typed skill catalog. The service talks to the canonical
// `/api/v1/skill-registry` endpoint so the FE never invents skill metadata
// (no mocks, no stubs). The `implemented` flag is honoured by callers:
//   - true  → "Use" button enabled;
//   - false → the card renders, but the button is disabled and labelled
//             "Coming soon" so users see what is on the roadmap.

import { restClient } from './api';

export type SkillMode = 'chat' | 'workflow';
export type SkillCategory =
  | 'productivity'
  | 'communication'
  | 'analysis'
  | 'extraction'
  | 'translation'
  | 'generation'
  | 'comparison';

export type SkillInputType = 'text' | 'record' | 'file' | 'thread' | 'selection';
export type SkillOutputType = 'text' | 'json' | 'table' | 'markdown' | 'message';

export interface SkillDescriptor {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  modes: SkillMode[];
  supportedIntents: string[];
  inputTypes: SkillInputType[];
  outputTypes: SkillOutputType[];
  version: string;
  certifiedAt: string;
  implemented: boolean;
  implementation: {
    owner: string;
    endpoint: string;
  };
  requiresAuthorization: boolean;
}

interface ListResponse {
  data: SkillDescriptor[];
  total: number;
}

interface CategoryResponse {
  data: SkillCategory[];
}

const unwrap = async <T,>(p: Promise<{ data?: T } | null | undefined>): Promise<T | null> => {
  try {
    const r = await p;
    if (!r) return null;
    return (r.data ?? null) as T | null;
  } catch {
    return null;
  }
};

class SkillRegistryService {
  async list(): Promise<SkillDescriptor[]> {
    const r = await unwrap<ListResponse>(restClient.get<ListResponse>('/skill-registry'));
    return r?.data ?? [];
  }

  async get(id: string): Promise<SkillDescriptor | null> {
    const r = await unwrap<SkillDescriptor>(
      restClient.get<SkillDescriptor>(`/skill-registry/${encodeURIComponent(id)}`),
    );
    return r ?? null;
  }

  async categories(): Promise<SkillCategory[]> {
    const r = await unwrap<CategoryResponse>(
      restClient.get<CategoryResponse>('/skill-registry/categories'),
    );
    return r?.data ?? [];
  }
}

export const skillRegistryService = new SkillRegistryService();
export default skillRegistryService;

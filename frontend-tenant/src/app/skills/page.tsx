'use client';

/**
 * Phase 11 — Skills catalog page.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md.
 *
 * Shows the seven Phase-11 generative-productivity skills backed by
 * the runtime SkillRegistry. The `implemented` flag is the live
 * gate (when false, the "Use" button is disabled and the card
 * shows a Phase-12-pending notice).
 */

import { useEffect, useState } from 'react';
import { SkillDescriptor, skillsService } from '@/services/skills.service';
import { SkillCard } from '@/components/skills/SkillCard';

const FILTERS: Array<{ id: 'all' | 'implemented' | 'planned'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'implemented', label: 'Available now' },
  { id: 'planned', label: 'Coming in Phase 12' },
];

export default function SkillsCatalogPage() {
  const [skills, setSkills] = useState<SkillDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'implemented' | 'planned'>('all');

  useEffect(() => {
    void (async () => {
      try {
        const res = await skillsService.list();
        setSkills(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = skills.filter((s) => {
    if (filter === 'implemented') return s.implemented;
    if (filter === 'planned') return !s.implemented;
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Skills</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Phase 11 generative-productivity skills. Click a card to invoke it on a record, thread, or pasted text.
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              filter === f.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-muted hover:bg-surface-muted/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded bg-surface-muted animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded border border-dashed border-border p-8 text-center text-foreground-muted">
          No skills match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}

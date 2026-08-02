'use client';

// P1 — Skill catalog page. Lists registered skills from the canonical
// `/api/v1/skill-registry` endpoint. Each card is the typed metadata from
// the registry. The "Use" button is disabled (and labelled "Coming soon")
// when the registry reports `implemented: false` — we never fake success.
//
// WCAG 2.2 AA:
//   - The card list is a `role="list"` with each card a `role="listitem"`.
//   - Every interactive control has a programmatic accessible name.
//   - "Use" buttons are focusable even when disabled so screen readers
//     can announce the upcoming state.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantShell from '@/components/TenantShell';
import { useTenantAuth } from '@/auth';
import { skillRegistryService, type SkillDescriptor, type SkillCategory } from '@/services/skill-registry.service';
import { useSetPageContext } from '@/shared/contexts/page-context';

export default function SkillsPage() {
  const user = useTenantAuth();
  const [skills, setSkills] = useState<SkillDescriptor[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<SkillCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { setPageContext } = useSetPageContext();
  const router = useRouter();

  useEffect(() => {
    setPageContext({ entityType: 'SkillCatalog', allowedActions: ['view', 'use'] });
  }, [setPageContext]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [list, cats] = await Promise.all([
          skillRegistryService.list(),
          skillRegistryService.categories(),
        ]);
        if (cancelled) return;
        setSkills(list);
        setCategories(cats);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load skills');
          setSkills([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUse = useCallback(
    (skill: SkillDescriptor) => {
      if (!skill.implemented) return;
      router.push(`/workspace?skill=${encodeURIComponent(skill.id)}`);
    },
    [router],
  );

  const visible = activeCategory === 'all'
    ? skills
    : skills.filter((s) => s.category === activeCategory);

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <main
        className="min-h-screen bg-surface text-zinc-100 p-6"
        aria-labelledby="skills-heading"
      >
      <header className="max-w-6xl mx-auto">
        <h1 id="skills-heading" className="text-2xl font-semibold">
          Skill catalog
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Reusable, certified skills. Cards marked &ldquo;Coming soon&rdquo; are
          declared in the registry but the runtime path is not yet implemented.
        </p>
      </header>

      <nav
        aria-label="Filter skills by category"
        className="max-w-6xl mx-auto mt-6 flex flex-wrap gap-2"
      >
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          aria-pressed={activeCategory === 'all'}
          className={`text-xs rounded-full px-3 py-1 border ${
            activeCategory === 'all'
              ? 'bg-violet-700/60 border-violet-500 text-white'
              : 'bg-surface-overlay border-surface-border text-zinc-300'
          }`}
        >
          All ({skills.length})
        </button>
        {categories.map((cat) => {
          const count = skills.filter((s) => s.category === cat).length;
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              aria-pressed={active}
              className={`text-xs rounded-full px-3 py-1 border ${
                active
                  ? 'bg-violet-700/60 border-violet-500 text-white'
                  : 'bg-surface-overlay border-surface-border text-zinc-300'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </nav>

      {error && (
        <div
          role="alert"
          className="max-w-6xl mx-auto mt-4 rounded-lg border border-red-700/40 bg-red-900/30 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          className="max-w-6xl mx-auto mt-6 text-sm text-zinc-500"
          role="status"
          aria-live="polite"
        >
          Loading skills…
        </div>
      ) : (
        <ul
          role="list"
          aria-label="Available skills"
          className="max-w-6xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {visible.map((skill) => (
            <li
              key={skill.id}
              role="listitem"
              className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-100">{skill.name}</h2>
                <span
                  className={`shrink-0 text-[9px] rounded-full px-1.5 py-0.5 border ${
                    skill.implemented
                      ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700/40'
                      : 'bg-amber-900/40 text-amber-200 border-amber-700/40'
                  }`}
                  aria-label={skill.implemented ? 'Available' : 'Coming soon'}
                >
                  {skill.implemented ? 'Available' : 'Coming soon'}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-400 flex-1">{skill.description}</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 gap-x-3 text-[10px] text-zinc-500">
                <dt className="font-medium text-zinc-400">Category</dt>
                <dd>{skill.category}</dd>
                <dt className="font-medium text-zinc-400">Modes</dt>
                <dd>{skill.modes.join(', ')}</dd>
                <dt className="font-medium text-zinc-400">Intents</dt>
                <dd>{skill.supportedIntents.join(', ')}</dd>
                <dt className="font-medium text-zinc-400">Inputs</dt>
                <dd>{skill.inputTypes.join(', ')}</dd>
                <dt className="font-medium text-zinc-400">Outputs</dt>
                <dd>{skill.outputTypes.join(', ')}</dd>
                <dt className="font-medium text-zinc-400">Version</dt>
                <dd>
                  v{skill.version} · {skill.certifiedAt}
                </dd>
              </dl>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-zinc-600 font-mono">
                  {skill.implementation.endpoint}
                </span>
                <button
                  type="button"
                  onClick={() => handleUse(skill)}
                  disabled={!skill.implemented}
                  aria-label={
                    skill.implemented
                      ? `Use ${skill.name} skill`
                      : `${skill.name} skill is coming soon`
                  }
                  className="text-xs rounded-lg bg-[color:var(--accent-500)] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5"
                >
                  {skill.implemented ? 'Use' : 'Coming soon'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {visible.length === 0 && !loading && !error && (
        <div
          className="max-w-6xl mx-auto mt-6 text-sm text-zinc-500"
          role="status"
        >
          No skills in this category.
        </div>
      )}
      </main>
    </TenantShell>
  );
}

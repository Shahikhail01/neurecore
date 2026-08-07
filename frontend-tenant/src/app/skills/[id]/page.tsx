'use client';

/**
 * Phase 11 — Skill detail page.
 *
 * Single skill's metadata + invocation entry point.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { SkillDescriptor, skillsService } from '@/services/skills.service';
import { SkillCard } from '@/components/skills/SkillCard';

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [skill, setSkill] = useState<SkillDescriptor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const res = await skillsService.get(id);
        setSkill(res);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-8 w-48 rounded bg-surface-muted animate-pulse" />
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-foreground">Skill not found</h1>
        <p className="text-sm text-foreground-muted mt-2">{error ?? 'No such skill.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-foreground-muted">
          {skill.category} · v{skill.version} · certified {skill.certifiedAt}
        </p>
        <h1 className="text-2xl font-semibold text-foreground mt-1">{skill.name}</h1>
        <p className="text-sm text-foreground-muted mt-2">{skill.description}</p>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-2">Intents</h2>
        <div className="flex flex-wrap gap-2">
          {skill.supportedIntents.map((intent) => (
            <span
              key={intent}
              className="inline-block rounded-full text-xs bg-surface-muted text-foreground px-2.5 py-0.5"
            >
              {intent}
            </span>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-2">Modes</h2>
        <div className="flex flex-wrap gap-2">
          {skill.modes.map((mode) => (
            <span
              key={mode}
              className="inline-block rounded-full text-xs bg-primary/10 text-primary px-2.5 py-0.5"
            >
              {mode}
            </span>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-2">Input / Output</h2>
        <p className="text-sm text-foreground-muted">
          Input: {skill.inputTypes.join(', ')}
        </p>
        <p className="text-sm text-foreground-muted mt-1">
          Output: {skill.outputTypes.join(', ')}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-2">Try it</h2>
        <SkillCard skill={skill} />
      </section>
    </div>
  );
}

'use client';

/**
 * Phase 11 — SkillCard component.
 *
 * Renders a single SkillDescriptor with a status pill, an
 * "Available" / "Coming soon" badge, and a "Use" button (or "Read
 * more" link to the detail page).
 *
 * `implemented === true`  → card is interactive, opens a Drawer with
 * the input form for the skill.
 * `implemented === false` → card is dimmed + "Coming in Phase 12".
 */

import { useState } from 'react';
import Link from 'next/link';
import { SkillDescriptor } from '@/services/skills.service';
import { SkillInvocationDrawer } from './SkillInvocationDrawer';

interface SkillCardProps {
  skill: SkillDescriptor;
}

export function SkillCard({ skill }: SkillCardProps) {
  const [open, setOpen] = useState(false);

  const onUse = () => {
    if (!skill.implemented) return;
    setOpen(true);
  };

  return (
    <>
      <article
        className={`rounded border border-border p-4 transition-shadow ${
          skill.implemented
            ? 'hover:shadow-md bg-background'
            : 'bg-surface-muted/40 opacity-70 cursor-not-allowed'
        }`}
      >
        <header className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-medium text-foreground">{skill.name}</h3>
            <p className="text-xs uppercase tracking-wide text-foreground-muted mt-0.5">
              {skill.category} · v{skill.version}
            </p>
          </div>
          <span
            className={`inline-block rounded-full text-[10px] font-medium px-2 py-0.5 ${
              skill.implemented
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {skill.implemented ? 'Available' : 'Coming soon'}
          </span>
        </header>

        <p className="mt-3 text-sm text-foreground-muted line-clamp-3">
          {skill.description}
        </p>

        <footer className="mt-4 flex items-center justify-between">
          <Link
            href={`/skills/${skill.id}`}
            className="text-xs text-primary hover:underline"
          >
            Read more →
          </Link>
          <button
            type="button"
            disabled={!skill.implemented}
            onClick={onUse}
            className="rounded text-sm px-3 py-1.5 bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use
          </button>
        </footer>
      </article>

      {open ? (
        <SkillInvocationDrawer
          skill={skill}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

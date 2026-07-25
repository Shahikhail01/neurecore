/**
 * SkinSwitcher — pick the preferred channel for a project.
 *
 * Persists choice per project in localStorage (key: `nc.discovery.skin.<projectId>`).
 * 2D ships the UI; full per-question `askVia` filtering lives in the engine
 * and is consumed by `QuestionEngine` to gate which skins are selectable.
 */

'use client';

import { useEffect, useState } from 'react';

export type SkinKind = 'form' | 'interview' | 'document';

const STORAGE_KEY = (id: string) => `nc.discovery.skin.${id}`;

export function readSkinChoice(projectId: string, fallback: SkinKind = 'form'): SkinKind {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(STORAGE_KEY(projectId));
  if (raw === 'form' || raw === 'interview' || raw === 'document') return raw;
  return fallback;
}

export function writeSkinChoice(projectId: string, skin: SkinKind): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY(projectId), skin);
}

export interface SkinSwitcherProps {
  projectId: string;
  value: SkinKind;
  onChange: (skin: SkinKind) => void;
  allowed?: SkinKind[];
}

export function SkinSwitcher({ projectId, value, onChange, allowed }: SkinSwitcherProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    const saved = readSkinChoice(projectId);
    if (saved !== value) onChange(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!hydrated) return null;

  const all: Array<{ kind: SkinKind; label: string }> = [
    { kind: 'form', label: 'Form' },
    { kind: 'interview', label: 'Interview' },
    { kind: 'document', label: 'Document' },
  ];
  const visible = allowed ? all.filter((a) => allowed.includes(a.kind)) : all;

  return (
    <div
      className="inline-flex rounded border border-surface-border bg-surface-base p-0.5 text-xs"
      data-testid="skin-switcher"
    >
      {visible.map((s) => (
        <button
          key={s.kind}
          type="button"
          onClick={() => {
            writeSkinChoice(projectId, s.kind);
            onChange(s.kind);
          }}
          className={`px-2 py-0.5 rounded transition ${
            value === s.kind
              ? 'bg-[color:var(--accent-500)] text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
'use client';

/**
 * AmbientBackdrop — the ONLY place blur blobs live.
 *
 * SOLID: SRP — owns decorative glow blobs. No surface logic.
 * SOLID: OCP — new layouts added via the `layout` prop without edits elsewhere.
 */

import { clsx } from 'clsx';
import type { AccentPalette } from '../tokens/palette';

export type AmbientLayout = 'hero' | 'auth' | 'corner' | 'top-bottom';

export interface AmbientBackdropProps {
  /** Layout preset — where the blobs sit. */
  layout?: AmbientLayout;
  /** Which accent palette the blobs use. */
  accent?: AccentPalette;
  /** A second accent for mixed-glow layouts (e.g. hero). */
  secondaryAccent?: AccentPalette;
  className?: string;
}

const BLOB_BASE = 'nv-ambient-blob';

function blobClass(accent: AccentPalette): string {
  return `${BLOB_BASE} nv-ambient-blob-${accent}`;
}

interface BlobSpec {
  size: string;
  position: string;
  accent: AccentPalette;
}

const LAYOUTS: Record<AmbientLayout, BlobSpec[]> = {
  hero: [
    { size: 'w-96 h-96', position: 'top-0 right-0',  accent: 'violet' },
    { size: 'w-96 h-96', position: 'bottom-0 left-0', accent: 'blue' },
  ],
  auth: [
    { size: 'w-[28rem] h-[28rem]', position: '-top-40 -right-40',  accent: 'violet' },
    { size: 'w-[28rem] h-[28rem]', position: '-bottom-40 -left-40', accent: 'cyan' },
  ],
  corner: [
    { size: 'w-80 h-80', position: 'top-0 right-0', accent: 'violet' },
  ],
  'top-bottom': [
    { size: 'w-72 h-72', position: '-top-20 left-1/3',   accent: 'violet' },
    { size: 'w-72 h-72', position: '-bottom-20 right-1/3', accent: 'blue' },
  ],
};

export function AmbientBackdrop({
  layout = 'hero',
  accent = 'violet',
  secondaryAccent = 'blue',
  className,
}: AmbientBackdropProps) {
  const blobs = LAYOUTS[layout].map((b) =>
    b.accent === 'violet'
      ? { ...b, accent: accent }
      : b.accent === 'blue'
      ? { ...b, accent: secondaryAccent }
      : b,
  );
  return (
    <div className={clsx('nv-ambient', className)} aria-hidden>
      {blobs.map((b, i) => (
        <div
          key={i}
          className={clsx(blobClass(b.accent), b.size, b.position)}
        />
      ))}
    </div>
  );
}
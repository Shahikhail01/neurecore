'use client';

/**
 * PageHero — page header with eyebrow + gradient title + subtitle.
 *
 * SOLID: SRP — owns the page-header presentation.
 */

import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { GradientText } from './GradientText';
import { AmbientBackdrop } from './AmbientBackdrop';
import type { AccentPalette } from '../tokens/palette';
import { DEFAULT_ACCENT } from '../tokens/palette';
import { fadeInUp, mediumTransition } from '../tokens/motion';

export interface PageHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: AccentPalette;
  /** When true, renders an ambient backdrop behind the hero. */
  ambient?: boolean;
  /** Optional right-aligned actions slot. */
  actions?: ReactNode;
  className?: string;
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  accent = DEFAULT_ACCENT,
  ambient = true,
  actions,
  className,
}: PageHeroProps) {
  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={mediumTransition}
      className={clsx('relative overflow-hidden nv-pad-lg', className)}
      aria-label="Page header"
    >
      {ambient && <AmbientBackdrop layout="corner" accent={accent} />}
      <div className="relative z-10 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="nv-eyebrow mb-2">{eyebrow}</div>}
          <h1 className="nv-section-title">
            <GradientText>{title}</GradientText>
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm md:text-base text-zinc-400 max-w-2xl">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </motion.section>
  );
}
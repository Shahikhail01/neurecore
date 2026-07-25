/**
 * Motion — framer-motion presets consumed by primitives.
 *
 * Honours `prefers-reduced-motion` via the shared transition helper.
 * Centralising here means a single change to global animation timing
 * propagates everywhere.
 */

import type { Transition, Variants } from 'framer-motion';

export const DURATION = {
  fast: 0.12,
  base: 0.2,
  medium: 0.35,
  slow: 0.5,
} as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1] as const,
  in: [0.4, 0, 1, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1 },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
};

export const baseTransition: Transition = {
  duration: DURATION.base,
  ease: EASE.out,
};

export const mediumTransition: Transition = {
  duration: DURATION.medium,
  ease: EASE.out,
};
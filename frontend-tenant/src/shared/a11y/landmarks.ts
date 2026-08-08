/**
 * Phase 29 — Landmark ids (CR-AI-1304).
 *
 * One source of truth for the ids the skip link targets and the shells
 * apply, so the two can never drift apart.
 *
 * SOLID
 *   SRP — owns ONLY the landmark identifiers.
 */

/** id of the `<main>` region in every shell. */
export const MAIN_CONTENT_ID = 'main-content';
/** id of the primary navigation landmark. */
export const PRIMARY_NAV_ID = 'primary-navigation';

'use client';
// ─── dept-colors.ts ──────────────────────────────────────────────────────────
// Assigns each department a unique color pair (dark card / light agent cards).
// Color is deterministically chosen from department name hash.

export interface DeptColorPair {
  /** Dark background + border for the department card */
  dark:  { bg: string; border: string; text: string; icon: string };
  /** Light background for agent cards inside this department */
  light: { bg: string; border: string; text: string; accent: string };
}

const PALETTE: DeptColorPair[] = [
  {
    dark:  { bg: 'bg-[color:var(--state-info)]/90',    border: 'border-[color:var(--state-info)]/60',   text: 'text-blue-300',   icon: 'text-[color:var(--state-info)]' },
    light: { bg: 'bg-[color:var(--state-info)]/50',    border: 'border-[color:var(--state-info)]/40',   text: 'text-blue-200',   accent: 'text-[color:var(--state-info)]' },
  },
  {
    dark:  { bg: 'bg-[color:var(--accent-500)]/90',  border: 'border-[color:var(--accent-500)]/60', text: 'text-indigo-300', icon: 'text-[color:var(--accent-400)]' },
    light: { bg: 'bg-[color:var(--accent-500)]/50',  border: 'border-[color:var(--accent-500)]/40', text: 'text-indigo-200', accent: 'text-[color:var(--accent-400)]' },
  },
  {
    dark:  { bg: 'bg-[color:var(--state-success)]/90', border: 'border-[color:var(--state-success)]/60', text: 'text-emerald-300', icon: 'text-[color:var(--state-success)]' },
    light: { bg: 'bg-[color:var(--state-success)]/50', border: 'border-[color:var(--state-success)]/40', text: 'text-emerald-200', accent: 'text-[color:var(--state-success)]' },
  },
  {
    dark:  { bg: 'bg-[color:var(--visual-accent-rose-500)]/90',    border: 'border-rose-700/60',   text: 'text-rose-300',   icon: 'text-[color:var(--visual-accent-rose-400)]' },
    light: { bg: 'bg-[color:var(--visual-accent-rose-500)]/50',    border: 'border-rose-700/40',   text: 'text-rose-200',   accent: 'text-[color:var(--visual-accent-rose-400)]' },
  },
  {
    dark:  { bg: 'bg-[color:var(--state-warning)]/90',   border: 'border-[color:var(--state-warning)]/60',  text: 'text-amber-300',  icon: 'text-[color:var(--state-warning)]' },
    light: { bg: 'bg-[color:var(--state-warning)]/50',   border: 'border-[color:var(--state-warning)]/40',  text: 'text-amber-200',  accent: 'text-[color:var(--state-warning)]' },
  },
  {
    dark:  { bg: 'bg-sky-950/90',     border: 'border-sky-700/60',    text: 'text-sky-300',    icon: 'text-sky-400' },
    light: { bg: 'bg-sky-900/50',     border: 'border-sky-700/40',    text: 'text-sky-200',    accent: 'text-sky-400' },
  },
  {
    dark:  { bg: 'bg-purple-950/90',  border: 'border-purple-700/60', text: 'text-purple-300', icon: 'text-purple-400' },
    light: { bg: 'bg-purple-900/50',  border: 'border-purple-700/40', text: 'text-purple-200', accent: 'text-purple-400' },
  },
  {
    dark:  { bg: 'bg-teal-950/90',   border: 'border-teal-700/60',  text: 'text-teal-300',  icon: 'text-teal-400' },
    light: { bg: 'bg-teal-900/50',   border: 'border-teal-700/40',  text: 'text-teal-200',  accent: 'text-teal-400' },
  },
  {
    dark:  { bg: 'bg-orange-950/90',  border: 'border-orange-700/60', text: 'text-orange-300', icon: 'text-orange-400' },
    light: { bg: 'bg-orange-900/50',  border: 'border-orange-700/40', text: 'text-orange-200', accent: 'text-orange-400' },
  },
  {
    dark:  { bg: 'bg-[color:var(--visual-accent-cyan-500)]/90',    border: 'border-cyan-700/60',   text: 'text-cyan-300',   icon: 'text-[color:var(--visual-accent-cyan-400)]' },
    light: { bg: 'bg-[color:var(--visual-accent-cyan-500)]/50',    border: 'border-cyan-700/40',   text: 'text-cyan-200',   accent: 'text-[color:var(--visual-accent-cyan-400)]' },
  },
  {
    dark:  { bg: 'bg-pink-950/90',    border: 'border-pink-700/60',   text: 'text-pink-300',   icon: 'text-pink-400' },
    light: { bg: 'bg-pink-900/50',    border: 'border-pink-700/40',   text: 'text-pink-200',   accent: 'text-pink-400' },
  },
  {
    dark:  { bg: 'bg-lime-950/90',    border: 'border-lime-700/60',   text: 'text-lime-300',   icon: 'text-lime-400' },
    light: { bg: 'bg-lime-900/50',    border: 'border-lime-700/40',   text: 'text-lime-200',   accent: 'text-lime-400' },
  },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDeptColors(deptId: string, deptName: string): DeptColorPair {
  const idx = hashString(deptId) % PALETTE.length;
  return PALETTE[idx];
}

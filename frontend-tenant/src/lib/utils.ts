import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getActiveLocaleContext } from "@/shared/i18n/active-locale";
import { localeFormatters } from "@/shared/i18n/locale-formatter.registry";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Phase 29 (CR-AI-1304) — every helper below renders through the
// resolved locale context. No hard-coded `en-US`, no hard-coded `$`,
// no server-time-zone drift.

export function formatCents(cents: number): string {
  return localeFormatters.format("currency", cents, getActiveLocaleContext());
}

export function formatDate(date: Date | string): string {
  return localeFormatters.format("date", date, getActiveLocaleContext());
}

export function formatDateTime(date: Date | string): string {
  return localeFormatters.format("datetime", date, getActiveLocaleContext());
}

export function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(date);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

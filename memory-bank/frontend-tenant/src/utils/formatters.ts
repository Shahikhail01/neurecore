// ─── formatters.ts ────────────────────────────────────────────────────────────
// Pure utility functions — no side effects, full tree-shakeable.
// SRP: One file owns all display formatting for the tenant frontend.

/** Format ISO date string to human-readable label. */
export function formatDate(iso: string, style: 'short' | 'medium' | 'long' | 'relative' = 'medium'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';

  if (style === 'relative') return formatRelative(date);

  const opts = ({
    short:  { month: 'short' as const, day: 'numeric' as const },
    medium: { month: 'short' as const, day: 'numeric' as const, year: 'numeric' as const },
    long:   { month: 'long' as const, day: 'numeric' as const, year: 'numeric' as const, hour: '2-digit' as const, minute: '2-digit' as const },
  } as Record<string, Intl.DateTimeFormatOptions>)[style];

  return new Intl.DateTimeFormat('en-US', opts).format(date);
}

/** "2 minutes ago", "just now", "3 days ago" */
export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d.toISOString(), 'short');
}

/** Format duration in seconds → "2m 34s" | "1h 15m" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

/** Compact number: 1234 → "1.2K", 1500000 → "1.5M" */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

/** Format percentage with optional decimal places. */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/** Format currency (defaults to USD). */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

/** Truncate long strings with ellipsis. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '…';
}

/** Capitalise first letter of each word. */
export function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/** Convert snake_case / UPPER_CASE to readable label. */
export function labelFromKey(key: string): string {
  return titleCase(key.replace(/_/g, ' ').toLowerCase());
}

/** Build initials from a full name, e.g. "John Doe" → "JD" */
export function initials(name: string, maxChars = 2): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, maxChars)
    .map((p) => p[0].toUpperCase())
    .join('');
}

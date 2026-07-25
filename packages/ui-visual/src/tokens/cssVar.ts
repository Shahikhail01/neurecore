/**
 * cssVar — helper for reading a CSS variable at runtime.
 *
 * Only place in the package that bridges from CSS to literal strings
 * (used by libraries like recharts/d3 that demand color literals).
 * Everywhere else, primitives compose CSS-var-only class strings.
 */
export function cssVar(name: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v.trim() || fallback;
}
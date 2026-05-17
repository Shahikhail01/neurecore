import { describe, it, expect } from 'vitest';
import { formatDate, formatDuration, formatCompact, formatPercent, formatCurrency, truncate, titleCase, labelFromKey, initials } from '../formatters';
import { validateEmail as checkEmail, validatePassword as checkPw, validateRequired, validateUUID } from '../validators';

// ─── Re-export for single import in this test file ─────────────────────────────
// Using both formatters and validators to demonstrate SOLID Interface Segregation:
// each module exposes only the functions a consumer needs.

// ─── formatDate tests ──────────────────────────────────────────────────────────
describe('formatDate', () => {
  it('formats a valid ISO date string in medium style', () => {
    const result = formatDate('2026-05-17', 'medium');
    expect(result).toMatch(/May.*17.*2026/);
  });

  it('formats a valid date in long style with time', () => {
    const result = formatDate('2026-05-17T10:30:00Z', 'long');
    expect(result).toMatch(/May/);
  });

  it('returns em-dash for empty input', () => {
    expect(formatDate('')).toBe('—');
  });

  it('returns em-dash for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});

// ─── formatDuration tests ──────────────────────────────────────────────────────
describe('formatDuration', () => {
  it('formats seconds under 60', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds for under an hour', () => {
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('formats hours and minutes for over an hour', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });
});

// ─── formatCompact tests ──────────────────────────────────────────────────────
describe('formatCompact', () => {
  it('formats thousands as K', () => {
    expect(formatCompact(1500)).toBe('1.5K');
  });

  it('formats millions as M', () => {
    expect(formatCompact(2_500_000)).toBe('2.5M');
  });

  it('returns raw number below 1000', () => {
    expect(formatCompact(999)).toBe('999');
  });
});

// ─── formatPercent tests ──────────────────────────────────────────────────────
describe('formatPercent', () => {
  it('formats with default 0 decimals', () => {
    expect(formatPercent(75)).toBe('75%');
  });

  it('formats with specified decimal places', () => {
    expect(formatPercent(33.333, 1)).toBe('33.3%');
  });
});

// ─── validateEmail tests (validators.ts) ─────────────────────────────────────
describe('validateEmail', () => {
  it('returns valid for correct email', () => {
    expect(checkEmail('user@example.com').valid).toBe(true);
  });

  it('fails for missing @', () => {
    expect(checkEmail('userexample.com').valid).toBe(false);
  });

  it('fails for empty string', () => {
    expect(checkEmail('').valid).toBe(false);
  });
});

// ─── validatePassword tests ───────────────────────────────────────────────────
describe('validatePassword', () => {
  it('passes a strong password', () => {
    expect(checkPw('SecurePass123').valid).toBe(true);
  });

  it('fails for too short', () => {
    expect(checkPw('Short1').valid).toBe(false);
  });

  it('fails without uppercase', () => {
    expect(checkPw('password123').valid).toBe(false);
  });
});

// ─── validateRequired tests ───────────────────────────────────────────────────
describe('validateRequired', () => {
  it('passes non-empty string', () => {
    expect(validateRequired('hello')).toEqual({ valid: true });
  });

  it('fails for empty string', () => {
    expect(validateRequired('').valid).toBe(false);
  });

  it('fails for whitespace-only string', () => {
    expect(validateRequired('   ').valid).toBe(false);
  });
});

// ─── validateUUID tests ────────────────────────────────────────────────────────
describe('validateUUID', () => {
  it('passes valid UUID v4', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(validateUUID(uuid).valid).toBe(true);
  });

  it('fails for random string', () => {
    expect(validateUUID('not-a-uuid').valid).toBe(false);
  });
});
/**
 * Cron — minimal 5-field parser.
 *
 * Source plan: §5.13.17 + §5.14.4.
 *
 * No external dep — just enough to drive DAILY / WEEKLY / MONTHLY
 * schedules. The parser supports '*', single integers, comma lists,
 * and the * /N step syntax.
 *
 * Solid: SRP — only parsing + next-fire computation. Used by both the
 * governance scheduler and the Studio CD runner.
 */

export type CronField = number[];

export interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dom: CronField;
  month: CronField;
  dow: CronField;
}

const FIELD_RANGES: Record<keyof Omit<ParsedCron, never>, [number, number]> = {
  minute: [0, 59],
  hour: [0, 23],
  dom: [1, 31],
  month: [1, 12],
  dow: [0, 6],
};

export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`cron expression must have 5 fields: "${expr}"`);
  }
  const keys: Array<keyof typeof FIELD_RANGES> = [
    'minute',
    'hour',
    'dom',
    'month',
    'dow',
  ];
  const out: ParsedCron = {
    minute: [],
    hour: [],
    dom: [],
    month: [],
    dow: [],
  };
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const raw = parts[i];
    const [lo, hi] = FIELD_RANGES[key];
    out[key] = expandField(raw, lo, hi);
  }
  return out;
}

function expandField(raw: string, lo: number, hi: number): number[] {
  const result = new Set<number>();
  for (const part of raw.split(',')) {
    const stepMatch = part.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = Number(stepMatch[1]);
      for (let v = lo; v <= hi; v += step) result.add(v);
      continue;
    }
    if (part === '*') {
      for (let v = lo; v <= hi; v++) result.add(v);
      continue;
    }
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      for (let v = a; v <= b; v++) result.add(v);
      continue;
    }
    const v = Number(part);
    if (Number.isInteger(v) && v >= lo && v <= hi) {
      result.add(v);
    } else {
      throw new Error(`invalid cron field "${part}" (range ${lo}..${hi})`);
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

/**
 * Compute the next fire time strictly after `from`. Returns null if no
 * match exists in the next 4 years (a safety bound so we don't loop).
 */
export function nextFireAt(parsed: ParsedCron, from: Date): Date | null {
  const FOUR_YEARS_MS = 4 * 365 * 24 * 60 * 60 * 1000;
  // Start at from + 1 minute (strictly after) and snap to minute 0
  // seconds for clean field-by-field matching.
  const startMs = Math.floor((from.getTime() + 60_000) / 60_000) * 60_000;
  const limit = startMs + FOUR_YEARS_MS;
  // Build cursor as a calendar-aligned minute (UTC).
  let cursor = new Date(startMs);

  while (cursor.getTime() <= limit) {
    const month = cursor.getUTCMonth() + 1;
    const dom = cursor.getUTCDate();
    const dow = cursor.getUTCDay();
    const hour = cursor.getUTCHours();
    const minute = cursor.getUTCMinutes();

    if (!parsed.month.includes(month)) {
      cursor = bumpMonth(cursor);
      continue;
    }
    // Cron semantics (Vixie + standard): when both day-of-month and
    // day-of-week are restricted (neither is the full range), fire when
    // BOTH match. When only one is restricted, fire when THAT ONE matches.
    // The test expectation for `0 4 1 * *` (MONTHLY) is "day 1 only" —
    // the dow=`*` is unrestricted, so dom must match alone.
    const dowFullRange = parsed.dow.length === 7;
    const domFullRange = parsed.dom.length === 31;
    const domMatches = parsed.dom.includes(dom);
    const dowMatches = parsed.dow.includes(dow);
    let dayMatches: boolean;
    if (dowFullRange && !domFullRange) {
      dayMatches = domMatches;
    } else if (domFullRange && !dowFullRange) {
      dayMatches = dowMatches;
    } else {
      dayMatches = domMatches && dowMatches;
    }
    if (!dayMatches) {
      cursor = bumpDay(cursor);
      continue;
    }
    if (!parsed.hour.includes(hour)) {
      cursor = bumpHour(cursor);
      continue;
    }
    if (!parsed.minute.includes(minute)) {
      cursor = new Date(cursor.getTime() + 60_000);
      continue;
    }
    return cursor;
  }
  return null;
}

function bumpMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}
function bumpDay(d: Date): Date {
  // Round up to the next day at 00:00:00.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}
function bumpHour(d: Date): Date {
  // Round up to the next hour at :00:00.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours() + 1, 0, 0, 0));
}

/**
 * Convenience: standard cron presets.
 */
export const CRON_PRESETS: Readonly<Record<string, string>> = {
  HOURLY: '0 * * * *',
  DAILY: '0 2 * * *',
  WEEKLY: '0 3 * * 0',
  MONTHLY: '0 4 1 * *',
};

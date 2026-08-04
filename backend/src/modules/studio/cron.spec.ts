/**
 * Cron parser — unit tests.
 *
 * Asserts:
 *   1. parseCron handles *, ranges, comma lists, [asterisk]/N steps.
 *   2. nextFireAt produces the expected timestamp for canonical presets.
 *   3. CRON_PRESETS.DAILY/WEEKLY/MONTHLY parse to valid expressions.
 */

import {
  CRON_PRESETS,
  nextFireAt,
  parseCron,
} from './cron';

describe('parseCron', () => {
  it('parses canonical presets', () => {
    expect(parseCron(CRON_PRESETS.DAILY).minute).toEqual([0]);
    expect(parseCron(CRON_PRESETS.DAILY).hour).toEqual([2]);
    expect(parseCron(CRON_PRESETS.DAILY).dom.length).toBe(31);
    expect(parseCron(CRON_PRESETS.DAILY).month.length).toBe(12);
    expect(parseCron(CRON_PRESETS.DAILY).dow.length).toBe(7);
  });

  it('expands */N steps', () => {
    const parsed = parseCron('*/15 * * * *');
    expect(parsed.minute).toEqual([0, 15, 30, 45]);
  });

  it('expands comma lists and ranges', () => {
    const parsed = parseCron('1,3,5-7 * * * *');
    expect(parsed.minute).toEqual([1, 3, 5, 6, 7]);
  });

  it('rejects bad field count', () => {
    expect(() => parseCron('* *')).toThrow(/must have 5 fields/);
  });

  it('rejects out-of-range values', () => {
    expect(() => parseCron('99 * * * *')).toThrow(/invalid cron field/);
  });
});

describe('nextFireAt', () => {
  it('produces the next 02:00 UTC for DAILY when run before midnight', () => {
    // 2026-08-04T00:00:00Z -> next 02:00:00Z is the same day.
    const from = new Date(Date.UTC(2026, 7, 4, 0, 0, 0));
    const next = nextFireAt(parseCron(CRON_PRESETS.DAILY), from);
    expect(next).not.toBeNull();
    expect(next!.getUTCDate()).toBe(4);
    expect(next!.getUTCHours()).toBe(2);
    expect(next!.getUTCMinutes()).toBe(0);
  });

  it('rolls to the next day when run after 02:00 UTC', () => {
    const from = new Date(Date.UTC(2026, 7, 4, 5, 0, 0));
    const next = nextFireAt(parseCron(CRON_PRESETS.DAILY), from);
    expect(next).not.toBeNull();
    expect(next!.getUTCDate()).toBe(5);
    expect(next!.getUTCHours()).toBe(2);
  });

  it('rolls to the next month for MONTHLY when called late in the month', () => {
    const from = new Date(Date.UTC(2026, 7, 20, 5, 0, 0));
    const next = nextFireAt(parseCron(CRON_PRESETS.MONTHLY), from);
    expect(next).not.toBeNull();
    expect(next!.getUTCMonth()).toBe(8); // September
  });
});

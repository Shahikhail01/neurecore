/**
 * channel-health.spec.ts — ChannelHealthService unit coverage (P8 CR-AI-1205).
 *
 * Asserts the pure helper that maps failure rate + token presence
 * to a grade.
 */

import { channelGrade } from '../channel-health.service';

describe('ChannelHealthService.channelGrade (P8 CR-AI-1205)', () => {
  it('UNKNOWN when no token', () => {
    expect(channelGrade(0, false)).toBe('UNKNOWN');
    expect(channelGrade(0.1, false)).toBe('UNKNOWN');
  });

  it('HEALTHY when low failure rate and token present', () => {
    expect(channelGrade(0, true)).toBe('HEALTHY');
    expect(channelGrade(0.19, true)).toBe('HEALTHY');
  });

  it('DEGRADED at 20-49% failure', () => {
    expect(channelGrade(0.2, true)).toBe('DEGRADED');
    expect(channelGrade(0.49, true)).toBe('DEGRADED');
  });

  it('UNHEALTHY at >=50% failure', () => {
    expect(channelGrade(0.5, true)).toBe('UNHEALTHY');
    expect(channelGrade(0.9, true)).toBe('UNHEALTHY');
  });
});

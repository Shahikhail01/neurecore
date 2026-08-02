/**
 * security-events.spec.ts — SecurityEventsService unit coverage (P8 CR-AI-1206).
 *
 * Asserts pure helpers: IP masking, severity classification, and
 * the summary-aggregator that derives totals from grouped counts.
 */

import {
  SECURITY_ACTIONS,
  computeSecuritySummary,
  isSecurityAction,
  maskIp,
  severityFromAction,
} from '../security-events.service';

describe('SecurityEventsService helpers (P8 CR-AI-1206)', () => {
  it('maskIp redacts IPv4 to /24 prefix', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.113.0/24');
    expect(maskIp(null)).toBeNull();
    expect(maskIp(undefined)).toBeNull();
  });

  it('maskIp redacts IPv6 first-4-group prefix', () => {
    const out = maskIp('2001:db8:abcd:0012:3456:7890:1234:5678');
    expect(out).toBe('2001:db8:abcd:0012:****');
  });

  it('maskIp returns null on empty input', () => {
    expect(maskIp('')).toBeNull();
  });

  it('severityFromAction maps injection / malware / cross-tenant to critical', () => {
    expect(severityFromAction('security.injection_attempt')).toBe('critical');
    expect(severityFromAction('security.malware_detected')).toBe('critical');
    expect(severityFromAction('security.cross_tenant_blocked')).toBe(
      'critical',
    );
    expect(severityFromAction('tenant.isolation_violation')).toBe('critical');
  });

  it('severityFromAction maps dlp / policy_denied to high', () => {
    expect(severityFromAction('security.dlp_event')).toBe('high');
    expect(severityFromAction('security.policy_denied')).toBe('high');
  });

  it('severityFromAction maps token_revoked / rate_limit to medium', () => {
    expect(severityFromAction('auth.token_revoked')).toBe('medium');
    expect(severityFromAction('rate_limit.exceeded')).toBe('medium');
  });

  it('severityFromAction defaults unknown actions to low', () => {
    expect(severityFromAction('auth.login')).toBe('low');
  });

  it('isSecurityAction accepts canonical + P2 knowledge security actions', () => {
    expect(isSecurityAction('security.injection_attempt')).toBe(true);
    expect(isSecurityAction('knowledge.security.malware_detected')).toBe(true);
    expect(isSecurityAction('knowledge.security.dlp_violation')).toBe(true);
    expect(isSecurityAction('unrelated.event')).toBe(false);
    expect(SECURITY_ACTIONS.length).toBeGreaterThan(8);
  });

  it('computeSecuritySummary rolls up totals and per-bucket counts', () => {
    const out = computeSecuritySummary([
      { action: 'security.injection_attempt', count: 3 },
      { action: 'security.malware_detected', count: 2 },
      { action: 'security.policy_denied', count: 4 },
      { action: 'auth.token_revoked', count: 1 },
    ]);
    expect(out.total).toBe(10);
    expect(out.injectionAttempts).toBe(3);
    expect(out.malwareEvents).toBe(2);
    expect(out.dlpEvents).toBe(0);
    expect(out.denials).toBe(4);
    expect(out.criticalCount).toBe(5);
  });

  it('computeSecuritySummary returns zero summary for empty input', () => {
    const out = computeSecuritySummary([]);
    expect(out.total).toBe(0);
    expect(out.criticalCount).toBe(0);
  });
});

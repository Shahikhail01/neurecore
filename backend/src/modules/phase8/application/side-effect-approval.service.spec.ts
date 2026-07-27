import {
  SideEffectApprovalService,
  SideEffectRequest,
} from './side-effect-approval.service';

function buildRequest(
  overrides: Partial<SideEffectRequest> = {},
): SideEffectRequest {
  return {
    tenantId: 'tnt-1',
    requesterActorId: 'agent-1',
    requesterActorType: 'HUMAN',
    action: 'crm.update',
    target: 'contact:42',
    sideEffectClass: 'INTERNAL',
    justification: 'Update contact phone number after outreach',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    ...overrides,
  };
}

describe('SideEffectApprovalService (Phase 8 — §10.1 side-effect approval gates)', () => {
  let svc: SideEffectApprovalService;

  beforeEach(() => {
    svc = new SideEffectApprovalService();
  });

  it('issues a stable approval token for the same request shape', () => {
    const a = svc.issue(buildRequest());
    const b = svc.issue(buildRequest());
    expect(a.approved).toBe(true);
    expect(a.approvalToken).toBe(b.approvalToken);
    expect(a.approvalToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it('denies AI agents from issuing EXTERNAL side effects', () => {
    const result = svc.issue(
      buildRequest({
        requesterActorType: 'AI_AGENT',
        sideEffectClass: 'EXTERNAL',
      }),
    );
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('AI_AGENT_REQUIRES_HUMAN_APPROVAL');
  });

  it('denies AI agents from issuing IRREVERSIBLE side effects', () => {
    const result = svc.issue(
      buildRequest({
        requesterActorType: 'AI_AGENT',
        sideEffectClass: 'IRREVERSIBLE',
      }),
    );
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('IRREVERSIBLE_REQUIRES_HUMAN');
  });

  it('permits AI agents to issue INTERNAL side effects', () => {
    const result = svc.issue(
      buildRequest({
        requesterActorType: 'AI_AGENT',
        sideEffectClass: 'INTERNAL',
      }),
    );
    expect(result.approved).toBe(true);
    expect(result.reason).toBe('AUTO_APPROVED');
  });

  it('verify() returns true for the token returned by issue()', () => {
    const issued = svc.issue(buildRequest());
    expect(
      svc.verify(
        buildRequest(),
        issued.approvalToken,
        issued.approverActorId ?? '',
      ),
    ).toBe(true);
  });

  it('verify() returns false when the token is missing', () => {
    expect(svc.verify(buildRequest(), '', 'user-1')).toBe(false);
  });

  it('verify() returns false for a token issued against a different idempotency key', () => {
    const issued = svc.issue(buildRequest());
    expect(
      svc.verify(
        buildRequest({ idempotencyKey: 'idem-2' }),
        issued.approvalToken,
        issued.approverActorId ?? '',
      ),
    ).toBe(false);
  });

  it('override() requires an approver and a non-trivial reason', () => {
    const noApprover = svc.override(
      buildRequest({ sideEffectClass: 'IRREVERSIBLE' }),
      '',
      'x',
    );
    expect(noApprover.approved).toBe(false);
    expect(noApprover.reason).toBe('MISSING_APPROVER');

    const shortReason = svc.override(
      buildRequest({ sideEffectClass: 'IRREVERSIBLE' }),
      'u1',
      'no',
    );
    expect(shortReason.approved).toBe(false);
    expect(shortReason.reason).toBe('INSUFFICIENT_JUSTIFICATION');
  });

  it('override() issues a HUMAN_OVERRIDE token', () => {
    const result = svc.override(
      buildRequest({ sideEffectClass: 'IRREVERSIBLE' }),
      'u1',
      'Approved by manager: refund is in line with SLA',
    );
    expect(result.approved).toBe(true);
    expect(result.reason).toBe('HUMAN_OVERRIDE');
    expect(result.approverActorId).toBe('u1');
    expect(result.approvalToken).toMatch(/^[a-f0-9]{64}$/);
  });
});

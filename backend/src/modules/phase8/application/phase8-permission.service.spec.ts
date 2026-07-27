import { Phase8PermissionService } from './phase8-permission.service';
import { Phase8Role } from '../domain/phase8.constants';

describe('Phase8PermissionService (Phase 8 — §10.1 + §10.5 role/permission matrix)', () => {
  let svc: Phase8PermissionService;

  beforeEach(() => {
    svc = new Phase8PermissionService();
  });

  it('allows OWNER to approve a review submitted by another human', () => {
    expect(
      svc.isAllowed({
        role: 'OWNER',
        actorType: 'HUMAN',
        actorId: 'user-1',
        action: 'APPROVE_REVIEW',
        subjectActorId: 'user-2',
      }),
    ).toBe(true);
  });

  it('rejects USER from cancelling an execution (action not in matrix)', () => {
    const reason = svc.denyReason({
      role: 'USER',
      actorType: 'HUMAN',
      actorId: 'user-1',
      action: 'CANCEL_EXECUTION',
    });
    expect(reason).toBe('ROLE_ACTION_NOT_PERMITTED');
  });

  it('rejects AI_AGENT from approving its own review (self-approval forbidden)', () => {
    const reason = svc.denyReason({
      role: 'AI_AGENT',
      actorType: 'AI_AGENT',
      actorId: 'agent-1',
      action: 'APPROVE_REVIEW',
      subjectActorId: 'agent-1',
    });
    expect(reason).toBe('SELF_APPROVAL_FORBIDDEN');
  });

  it('rejects AI_AGENT from approving any review even without subject id', () => {
    const reason = svc.denyReason({
      role: 'AI_AGENT',
      actorType: 'AI_AGENT',
      actorId: 'agent-1',
      action: 'APPROVE_REVIEW',
    });
    expect(reason).toBe('SELF_APPROVAL_FORBIDDEN');
  });

  it('allows AUDITOR to read artifacts', () => {
    expect(
      svc.isAllowed({
        role: 'AUDITOR',
        actorType: 'HUMAN',
        actorId: 'auditor-1',
        action: 'READ_ARTIFACT',
      }),
    ).toBe(true);
  });

  it('rejects USER from toggling feature flags', () => {
    expect(
      svc.isAllowed({
        role: 'USER',
        actorType: 'HUMAN',
        actorId: 'user-1',
        action: 'TOGGLE_FEATURE_FLAG',
      }),
    ).toBe(false);
  });

  it('throws a stable error on assertAllowed when denied', () => {
    expect(() =>
      svc.assertAllowed({
        role: 'USER',
        actorType: 'HUMAN',
        actorId: 'user-1',
        action: 'REPLAY_DEAD_LETTER',
      }),
    ).toThrow(/PHASE8_PERMISSION_DENIED/);
  });

  it('covers every role × action intersection deterministically', () => {
    const roles: Phase8Role[] = [
      'OWNER',
      'ADMIN',
      'USER',
      'AUDITOR',
      'SECURITY_OFFICER',
      'PLATFORM_ADMIN',
      'SUPER_ADMIN',
      'AI_AGENT',
      'SYSTEM',
    ];
    for (const role of roles) {
      for (const action of [
        'INITIATE',
        'APPROVE_REVIEW',
        'READ_ARTIFACT',
        'REPLAY_DEAD_LETTER',
      ] as const) {
        const result = svc.isAllowed({
          role,
          actorType:
            role === 'AI_AGENT'
              ? 'AI_AGENT'
              : role === 'SYSTEM'
                ? 'SYSTEM'
                : 'HUMAN',
          actorId: 'actor',
          action,
        });
        // Result must be a boolean — never throw — for any combination.
        expect(typeof result).toBe('boolean');
      }
    }
  });
});

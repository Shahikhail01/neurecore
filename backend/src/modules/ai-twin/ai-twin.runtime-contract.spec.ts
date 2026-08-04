/**
 * AI Twin — Runtime Contract unit tests.
 *
 * Asserts the runtime contract from v2 §5.3.6-5.3.8:
 *   • tenantId '*' is rejected on every envelope.
 *   • actor's tenant must equal envelope tenant.
 *   • write intents require OWNER+ role.
 *   • scopes not in allow-list are rejected.
 *   • PAUSED twins cannot invoke tools.
 *   • ARCHIVED twins are inert except for wizard edits.
 */

import {
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  TwinActionIntent,
  TwinPermissionMirrorGuard,
  TwinPermissionScope,
} from './ai-twin.runtime-contract';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';

function jwt(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: overrides.sub ?? 'user-1',
    role: overrides.role ?? UserRole.OWNER,
    tenantId: overrides.tenantId ?? 'tenant-a',
    email: 'user@x.test',
  } as JwtPayload;
}

describe('TwinPermissionMirrorGuard', () => {
  let guard: TwinPermissionMirrorGuard;
  const allowList = {
    read: ['crm.read.contacts', 'crm.read.deals'] as TwinPermissionScope[],
    write: ['crm.write.tasks'] as TwinPermissionScope[],
    status: 'ACTIVE' as const,
  };

  beforeEach(() => {
    guard = new TwinPermissionMirrorGuard();
  });

  it('refuses wildcard tenant on envelope', () => {
    expect(() =>
      guard.assertCanExecute({
        actor: jwt(),
        twinId: 't1',
        envelope: {
          tenantId: '*',
          actorUserId: 'user-1',
          intent: TwinActionIntent.TOOL_INVOKED,
          scopesUsed: ['crm.read.contacts'],
        },
        twinAllowList: allowList,
      }),
    ).toThrow(ForbiddenException);
  });

  it('refuses actor with different tenantId', () => {
    expect(() =>
      guard.assertCanExecute({
        actor: jwt({ tenantId: 'tenant-b' }),
        twinId: 't1',
        envelope: {
          tenantId: 'tenant-a',
          actorUserId: 'user-1',
          intent: TwinActionIntent.TOOL_INVOKED,
          scopesUsed: ['crm.read.contacts'],
        },
        twinAllowList: allowList,
      }),
    ).toThrow(ForbiddenException);
  });

  it('refuses write intent for non-OWNER role', () => {
    expect(() =>
      guard.assertCanExecute({
        actor: jwt({ role: UserRole.ADMIN }),
        twinId: 't1',
        envelope: {
          tenantId: 'tenant-a',
          actorUserId: 'user-1',
          intent: TwinActionIntent.TOOL_INVOKED,
          scopesUsed: ['crm.read.contacts'],
        },
        twinAllowList: allowList,
      }),
    ).toThrow(ForbiddenException);
  });

  it('refuses scope not in the twin read allow-list', () => {
    expect(() =>
      guard.assertCanExecute({
        actor: jwt(),
        twinId: 't1',
        envelope: {
          tenantId: 'tenant-a',
          actorUserId: 'user-1',
          intent: TwinActionIntent.INTENT_RESOLVED,
          scopesUsed: ['crm.write.deals'],
        },
        twinAllowList: allowList,
      }),
    ).toThrow(ForbiddenException);
  });

  it('refuses scope not in the twin write allow-list (write intent)', () => {
    expect(() =>
      guard.assertCanExecute({
        actor: jwt(),
        twinId: 't1',
        envelope: {
          tenantId: 'tenant-a',
          actorUserId: 'user-1',
          intent: TwinActionIntent.TOOL_INVOKED,
          scopesUsed: ['crm.read.contacts'],
        },
        twinAllowList: allowList,
      }),
    ).toThrow(ForbiddenException);
  });

  it('refuses PAUSED twin from invoking tools', () => {
    expect(() =>
      guard.assertCanExecute({
        actor: jwt(),
        twinId: 't1',
        envelope: {
          tenantId: 'tenant-a',
          actorUserId: 'user-1',
          intent: TwinActionIntent.TOOL_INVOKED,
          scopesUsed: ['crm.read.contacts'],
        },
        twinAllowList: { ...allowList, status: 'PAUSED' },
      }),
    ).toThrow(ForbiddenException);
  });

  it('refuses ARCHIVED twin from non-wizard intents', () => {
    expect(() =>
      guard.assertCanExecute({
        actor: jwt(),
        twinId: 't1',
        envelope: {
          tenantId: 'tenant-a',
          actorUserId: 'user-1',
          intent: TwinActionIntent.TOOL_INVOKED,
          scopesUsed: ['crm.read.contacts'],
        },
        twinAllowList: { ...allowList, status: 'ARCHIVED' },
      }),
    ).toThrow(ForbiddenException);
  });

  it('permits a read intent within scope', () => {
    const env = guard.assertCanExecute({
      actor: jwt(),
      twinId: 't1',
      envelope: {
        tenantId: 'tenant-a',
        actorUserId: 'user-1',
        intent: TwinActionIntent.INTENT_RESOLVED,
        scopesUsed: ['crm.read.contacts'],
      },
      twinAllowList: allowList,
    });
    expect(env.intent).toBe(TwinActionIntent.INTENT_RESOLVED);
    expect(env.actorUserId).toBe('user-1');
    expect(env.tenantId).toBe('tenant-a');
    expect(env.occurredAt).toBeTruthy();
  });

  it('permits a write intent within scope and OWNER role', () => {
    const env = guard.assertCanExecute({
      actor: jwt(),
      twinId: 't1',
      envelope: {
        tenantId: 'tenant-a',
        actorUserId: 'user-1',
        intent: TwinActionIntent.TOOL_INVOKED,
        scopesUsed: ['crm.write.tasks'],
      },
      twinAllowList: allowList,
    });
    expect(env.intent).toBe(TwinActionIntent.TOOL_INVOKED);
  });

  it('permits platform admin to act across tenants', () => {
    const env = guard.assertCanExecute({
      actor: jwt({ sub: 'platform-admin', role: UserRole.PLATFORM_ADMIN, tenantId: null }),
      twinId: 't1',
      envelope: {
        tenantId: 'tenant-a',
        actorUserId: 'platform-admin',
        intent: TwinActionIntent.PAUSED,
        scopesUsed: [],
      },
      twinAllowList: { ...allowList, status: 'PAUSED' },
    });
    expect(env.actorUserId).toBe('platform-admin');
  });

  it('buildWizardEnvelope refuses wildcard', () => {
    expect(() =>
      guard.buildWizardEnvelope({
        actor: jwt(),
        tenantId: '*',
        intent: TwinActionIntent.WIZARD_ADVANCED,
      }),
    ).toThrow(ForbiddenException);
  });

  it('buildWizardEnvelope accepts real tenantId', () => {
    const env = guard.buildWizardEnvelope({
      actor: jwt(),
      tenantId: 'tenant-a',
      intent: TwinActionIntent.WIZARD_ADVANCED,
      metadata: { step: 1 },
    });
    expect(env.tenantId).toBe('tenant-a');
    expect(env.actorUserId).toBe('user-1');
  });
});

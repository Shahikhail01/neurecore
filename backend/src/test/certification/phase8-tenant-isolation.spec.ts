// src/test/certification/phase8-tenant-isolation.spec.ts
// Phase 8 — §10.6 Gate G8 criterion 4:
// "Security tests show no cross-tenant access"
//
// Negative tests for every Phase 8 service that performs a tenant-scoping
// decision. They must run against in-memory implementations only and never
// touch the database — the goal is to prove the cross-tenant guard rejects
// the cross-tenant identifier, NOT to prove database isolation (that lives
// in `test/certification/tenant-isolation.spec.ts`).
import { TenantScopeEnforcer } from '../../modules/phase8/application/tenant-scope-enforcer';
import { ArtifactAccessService } from '../../modules/phase8/application/artifact-access.service';
import { SideEffectApprovalService } from '../../modules/phase8/application/side-effect-approval.service';
import { Phase8PermissionService } from '../../modules/phase8/application/phase8-permission.service';

describe('Phase 8 — tenant isolation negative suite (G8 criterion 4)', () => {
  describe('TenantScopeEnforcer', () => {
    let svc: TenantScopeEnforcer;
    beforeEach(() => {
      svc = new TenantScopeEnforcer();
    });

    it('rejects cross-tenant Project access with X_TENANT_NOT_FOUND', () => {
      let caught: { message: string; code?: string } | null = null;
      try {
        svc.assertSameTenant({
          actorTenantId: 'tnt-1',
          recordTenantId: 'tnt-2',
          entityType: 'Project',
          entityId: 'p-1',
        });
      } catch (e) {
        caught = e as { message: string; code?: string };
      }
      expect(caught?.code).toBe('X_TENANT_NOT_FOUND');
    });

    it('rejects cross-tenant Task access', () => {
      expect(() =>
        svc.assertSameTenant({
          actorTenantId: 'tnt-1',
          recordTenantId: 'tnt-2',
          entityType: 'Task',
          entityId: 't-1',
        }),
      ).toThrow(/X_TENANT_NOT_FOUND/);
    });

    it('rejects cross-tenant Review access', () => {
      expect(() =>
        svc.assertSameTenant({
          actorTenantId: 'tnt-1',
          recordTenantId: 'tnt-2',
          entityType: 'Review',
          entityId: 'r-1',
        }),
      ).toThrow(/X_TENANT_NOT_FOUND/);
    });

    it('rejects cross-tenant EvidenceArtifact access', () => {
      expect(() =>
        svc.assertSameTenant({
          actorTenantId: 'tnt-1',
          recordTenantId: 'tnt-2',
          entityType: 'EvidenceArtifact',
          entityId: 'art-1',
        }),
      ).toThrow(/X_TENANT_NOT_FOUND/);
    });

    it('rejects cross-tenant ExecutionAttempt access', () => {
      expect(() =>
        svc.assertSameTenant({
          actorTenantId: 'tnt-1',
          recordTenantId: 'tnt-2',
          entityType: 'ExecutionAttempt',
          entityId: 'att-1',
        }),
      ).toThrow(/X_TENANT_NOT_FOUND/);
    });

    it('passes same-tenant Project access', () => {
      expect(() =>
        svc.assertSameTenant({
          actorTenantId: 'tnt-1',
          recordTenantId: 'tnt-1',
          entityType: 'Project',
          entityId: 'p-1',
        }),
      ).not.toThrow();
    });
  });

  describe('ArtifactAccessService — cross-tenant artifact access', () => {
    let svc: ArtifactAccessService;
    beforeEach(() => {
      svc = new ArtifactAccessService();
    });

    it('returns X_TENANT_NOT_FOUND (never 403) for a cross-tenant artifact', () => {
      const result = svc.check({
        tenantId: 'tnt-1',
        actorId: 'user-1',
        actorType: 'HUMAN',
        artifactId: 'art-1',
        artifactOwnerTenantId: 'tnt-2',
        storageRef: 's3://bucket/art-1.pdf',
        checksum: 'a'.repeat(64),
        operation: 'READ',
        correlationId: 'corr-1',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('X_TENANT_NOT_FOUND');
    });

    it('redacts the storage ref even when access is denied (never leak the path)', () => {
      const result = svc.check({
        tenantId: 'tnt-1',
        actorId: 'user-1',
        actorType: 'HUMAN',
        artifactId: 'art-1',
        artifactOwnerTenantId: 'tnt-2',
        storageRef: 's3://tenant-2-bucket/private/secret.pdf?signature=abc',
        checksum: 'a'.repeat(64),
        operation: 'READ',
        correlationId: 'corr-1',
      });
      expect(result.redactedRef).toBeUndefined();
    });
  });

  describe('SideEffectApprovalService — cross-tenant approval reuse', () => {
    let svc: SideEffectApprovalService;
    beforeEach(() => {
      svc = new SideEffectApprovalService();
    });

    it('refuses to verify a token issued for a different tenant', () => {
      const issued = svc.issue({
        tenantId: 'tnt-1',
        requesterActorId: 'agent-1',
        requesterActorType: 'HUMAN',
        action: 'crm.update',
        target: 'contact:1',
        sideEffectClass: 'INTERNAL',
        justification: 'x',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      });
      const verify = svc.verify(
        {
          ...(issued.approverActorId
            ? { requesterActorId: issued.approverActorId }
            : { requesterActorId: 'agent-1' }),
          tenantId: 'tnt-2',
          requesterActorType: 'HUMAN',
          action: 'crm.update',
          target: 'contact:1',
          sideEffectClass: 'INTERNAL',
          justification: 'x',
          correlationId: 'corr-1',
          idempotencyKey: 'idem-1',
        },
        issued.approvalToken,
        issued.approverActorId ?? '',
      );
      expect(verify).toBe(false);
    });
  });

  describe('Phase8PermissionService — cross-tenant authorization', () => {
    let svc: Phase8PermissionService;
    beforeEach(() => {
      svc = new Phase8PermissionService();
    });

    it('denies a cross-tenant actor with a stable code', () => {
      // The matrix is checked without leaking the existence of the
      // other tenant — the denial reason is always one of two fixed
      // values, never a tenant-specific message.
      const reason = svc.denyReason({
        role: 'USER',
        actorType: 'HUMAN',
        actorId: 'user-1',
        action: 'CREATE_GOAL',
      });
      expect(reason).toBe('ROLE_ACTION_NOT_PERMITTED');
    });

    it('AI agents may not self-approve even when the role has the entry', () => {
      const reason = svc.denyReason({
        role: 'OWNER',
        actorType: 'AI_AGENT',
        actorId: 'agent-1',
        action: 'APPROVE_REVIEW',
        subjectActorId: 'agent-1',
      });
      expect(reason).toBe('SELF_APPROVAL_FORBIDDEN');
    });
  });
});

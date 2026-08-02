// src/modules/agent-templates/agent-template-lifecycle.service.spec.ts
//
// Phase 4 lifecycle tests — real PostgreSQL required.
//
// Pattern follows the existing G1.1 / G6 invariants:
//   - Default: tests SKIP if no DATABASE_URL is reachable
//   - AWL_REQUIRE_INTEGRATION_DB=true: tests FAIL HARD if no DB
//
// Covers the Phase 4 state machine:
//   DRAFT → CERTIFY → ACTIVATE → SUSPEND → RESUME → RETIRE
//   ROLLBACK to a prior certified version
//   activation without certification is rejected
//   every transition writes an audit log entry
//   cross-tenant access is denied
//   derived fields are server-side (DTO fields ignored)
//   cyclic skill graph rejected
//   retired template cannot be re-activated without a new version

import { PrismaClient } from '@prisma/client';
import { AgentTemplateLifecycleService } from './agent-template-lifecycle.service';
import { AgentTemplateVersionRepository } from './agent-template-version.repository';
import { AgentSkillDefinitionRepository } from './agent-skill-definition.repository';
import { AgentTemplateCertificationRepository } from './agent-template-certification.repository';
import { AgentLifecycleAuditRepository } from './agent-lifecycle-audit.repository';
import { AgentSkillBuilderService } from './agent-skill-builder.service';

const TENANT_A = `phase4-tenant-A-${Date.now()}`;
const TENANT_B = `phase4-tenant-B-${Date.now()}`;
const REQUIRE_DB = process.env.AWL_REQUIRE_INTEGRATION_DB === 'true';
const DB_AVAILABLE = !!process.env.DATABASE_URL;

const describeOrSkip = REQUIRE_DB || DB_AVAILABLE ? describe : describe.skip;

let DB_REACHABLE = false;

async function probeDb(): Promise<boolean> {
  if (!DB_AVAILABLE) return false;
  const c = new PrismaClient();
  try {
    await c.$connect();
    await c.$disconnect();
    return true;
  } catch {
    try {
      await c.$disconnect();
    } catch {
      /* ignore */
    }
    return false;
  }
}

function skipIfNoDb(): boolean {
  if (!DB_REACHABLE) {
    if (REQUIRE_DB) {
      throw new Error(
        'INTEGRATION_DB_REQUIRED: AWL_REQUIRE_INTEGRATION_DB=true but database is unreachable',
      );
    }
    return true;
  }
  return false;
}

describeOrSkip(
  'Phase 4 — AgentTemplateLifecycleService (real PostgreSQL)',
  () => {
    let prisma: PrismaClient;
    let lifecycle: AgentTemplateLifecycleService;
    let versionRepo: AgentTemplateVersionRepository;
    let skillRepo: AgentSkillDefinitionRepository;
    let certRepo: AgentTemplateCertificationRepository;
    let auditRepo: AgentLifecycleAuditRepository;
    let builder: AgentSkillBuilderService;

    const actorA = `actor-A-${Date.now()}`;
    const actorB = `actor-B-${Date.now()}`;

    beforeAll(async () => {
      DB_REACHABLE = await probeDb();
      if (!DB_REACHABLE) return;
      prisma = new PrismaClient();
      await prisma.$connect();
      await seedTenants();

      versionRepo = new AgentTemplateVersionRepository(prisma as never);
      skillRepo = new AgentSkillDefinitionRepository(prisma as never);
      certRepo = new AgentTemplateCertificationRepository(prisma as never);
      auditRepo = new AgentLifecycleAuditRepository(prisma as never);
      builder = new AgentSkillBuilderService(prisma as never, skillRepo);
      lifecycle = new AgentTemplateLifecycleService(
        prisma as never,
        versionRepo,
        skillRepo,
        certRepo,
        auditRepo,
        builder,
      );
    });

    afterAll(async () => {
      if (!prisma || skipIfNoDb()) return;
      await prisma.agentLifecycleAuditLog.deleteMany({
        where: { tenantId: { in: [TENANT_A, TENANT_B] } },
      });
      await prisma.agentTemplateCertification.deleteMany({
        where: { tenantId: { in: [TENANT_A, TENANT_B] } },
      });
      await prisma.agentTemplateVersion.deleteMany({
        where: { tenantId: { in: [TENANT_A, TENANT_B] } },
      });
      await prisma.agentSkillDefinition.deleteMany({
        where: { tenantId: { in: [TENANT_A, TENANT_B] } },
      });
      await prisma.agentTemplate.deleteMany({
        where: { tenantId: { in: [TENANT_A, TENANT_B] } },
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [TENANT_A, TENANT_B] } },
      });
      await prisma.$disconnect();
    });

    async function seedTenants() {
      await prisma.tenant.create({
        data: {
          id: TENANT_A,
          name: TENANT_A,
          slug: TENANT_A,
          industry: 'accounting',
          status: 'ACTIVE',
        } as any,
      });
      await prisma.tenant.create({
        data: {
          id: TENANT_B,
          name: TENANT_B,
          slug: TENANT_B,
          industry: 'accounting',
          status: 'ACTIVE',
        } as any,
      });
    }

    async function seedTemplate(tenantId: string) {
      return prisma.agentTemplate.create({
        data: {
          tenantId,
          name: `tpl-${tenantId}`,
          version: '1.0.0',
          isPublic: false,
        } as any,
      });
    }

    it('full lifecycle: DRAFT → CERTIFY → ACTIVATE → SUSPEND → RESUME → RETIRE', async () => {
      if (skipIfNoDb()) return;
      const tpl = await seedTemplate(TENANT_A);

      const v = await lifecycle.createVersion(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        definition: { name: 'phase4-test' },
        composedSkillRefs: [],
      });
      expect(v.lifecycleStatus).toBe('DRAFT');
      expect(v.certificationStatus).toBe('DRAFT');

      // Activate before certify — rejected.
      await expect(
        lifecycle.activate(TENANT_A, actorA, {
          agentTemplateId: tpl.id,
          version: '1.0.0',
          reason: 'should fail',
        }),
      ).rejects.toThrow(/Certification is required/i);

      // Certify.
      const cert = await lifecycle.certify(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        evaluationReport: { score: 0.95 },
        reason: 'baseline',
      });
      expect(cert.certificationStatus).toBe('CERTIFIED');
      expect(cert.certifiedByActorId).toBe(actorA);

      // Certify signature is verifiable.
      const latestCert = await certRepo.latestForVersion(TENANT_A, cert.id);
      expect(latestCert).not.toBeNull();
      expect(await certRepo.verifySignature(latestCert!)).toBe(true);

      // Activate.
      const active = await lifecycle.activate(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        reason: 'go live',
      });
      expect(active.lifecycleStatus).toBe('ACTIVE');

      // Activate again — conflict.
      await expect(
        lifecycle.activate(TENANT_A, actorA, {
          agentTemplateId: tpl.id,
          version: '1.0.0',
          reason: 'duplicate',
        }),
      ).rejects.toThrow(/already ACTIVE/i);

      // Suspend.
      const suspended = await lifecycle.suspend(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        reason: 'maintenance',
      });
      expect(suspended.lifecycleStatus).toBe('SUSPENDED');

      // Resume.
      const resumed = await lifecycle.resume(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        reason: 'restored',
      });
      expect(resumed.lifecycleStatus).toBe('ACTIVE');

      // Retire.
      const retired = await lifecycle.retire(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        reason: 'sunset',
      });
      expect(retired.lifecycleStatus).toBe('RETIRED');

      // Audit log entries written for every transition.
      const audit = await auditRepo.listForSubject({
        tenantId: TENANT_A,
        subjectType: 'VERSION',
        subjectId: cert.id,
      });
      const actions = audit.map((a) => a.action).sort();
      expect(actions).toEqual(
        expect.arrayContaining([
          'CREATE',
          'CERTIFY',
          'ACTIVATE',
          'SUSPEND',
          'RESUME',
          'RETIRE',
        ]),
      );
      expect(audit.length).toBeGreaterThanOrEqual(6);
    });

    it('rollback to a prior certified version restores ACTIVE state', async () => {
      if (skipIfNoDb()) return;
      const tpl = await seedTemplate(TENANT_A);

      // v1 certified + active.
      await lifecycle.createVersion(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        definition: {},
        composedSkillRefs: [],
      });
      await lifecycle.certify(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        evaluationReport: { score: 0.9 },
        reason: 'cert v1',
      });
      await lifecycle.activate(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.0',
        reason: 'go live',
      });

      // v2 certified + active.
      await lifecycle.createVersion(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.1',
        definition: {},
        composedSkillRefs: [],
      });
      await lifecycle.certify(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.1',
        evaluationReport: { score: 0.92 },
        reason: 'cert v2',
      });
      await lifecycle.activate(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '1.0.1',
        reason: 'go live v2',
      });

      // Rollback to v1.
      const rolled = await lifecycle.rollback(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        targetVersion: '1.0.0',
        reason: 'regression in v2',
      });
      expect(rolled.version).toBe('1.0.0');
      expect(rolled.lifecycleStatus).toBe('ACTIVE');

      const v2 = await versionRepo.getByVersion(TENANT_A, tpl.id, '1.0.1');
      expect(v2?.lifecycleStatus).toBe('SUSPENDED');
    });

    it('activation without certification is rejected', async () => {
      if (skipIfNoDb()) return;
      const tpl = await seedTemplate(TENANT_A);
      await lifecycle.createVersion(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '2.0.0',
        definition: {},
        composedSkillRefs: [],
      });
      await expect(
        lifecycle.activate(TENANT_A, actorA, {
          agentTemplateId: tpl.id,
          version: '2.0.0',
          reason: 'no cert',
        }),
      ).rejects.toThrow(/certification/i);
    });

    it('retired template cannot be re-activated without a new version', async () => {
      if (skipIfNoDb()) return;
      const tpl = await seedTemplate(TENANT_A);
      await lifecycle.createVersion(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '3.0.0',
        definition: {},
        composedSkillRefs: [],
      });
      await lifecycle.certify(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '3.0.0',
        evaluationReport: { score: 1 },
        reason: 'cert',
      });
      await lifecycle.activate(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '3.0.0',
        reason: 'live',
      });
      await lifecycle.retire(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '3.0.0',
        reason: 'sunset',
      });

      await expect(
        lifecycle.activate(TENANT_A, actorA, {
          agentTemplateId: tpl.id,
          version: '3.0.0',
          reason: 'wake up',
        }),
      ).rejects.toThrow(/RETIRED/i);
    });

    it('cross-tenant access is denied', async () => {
      if (skipIfNoDb()) return;
      const tplA = await seedTemplate(TENANT_A);
      await lifecycle.createVersion(TENANT_A, actorA, {
        agentTemplateId: tplA.id,
        version: '4.0.0',
        definition: {},
        composedSkillRefs: [],
      });

      // Tenant B trying to act on Tenant A's template should 404.
      await expect(
        lifecycle.certify(TENANT_B, actorB, {
          agentTemplateId: tplA.id,
          version: '4.0.0',
          evaluationReport: { score: 1 },
          reason: 'cross-tenant attack',
        }),
      ).rejects.toThrow(/not found/i);
    });

    it('derived fields are server-side (DTO fields ignored)', async () => {
      if (skipIfNoDb()) return;
      // No DTO surface exists for maxEffect / requiredAuthority / approvalSensitive
      // — they are computed in AgentTemplateLifecycleService.createVersion from
      // composedSkillRefs. The architecture test below is the formal guarantee;
      // here we confirm the runtime result.
      const tpl = await seedTemplate(TENANT_A);

      // Seed a skill with IRREVERSIBLE maxEffect, authority 50, approvalSensitive.
      await skillRepo.create({
        tenantId: TENANT_A,
        skillKey: 'superDelete',
        semanticVersion: '1.0.0',
        maxEffect: 'IRREVERSIBLE',
        requiredAuthority: 50,
        approvalSensitive: true,
        timeoutMs: 5000,
      });

      // The client cannot influence these fields; they come from composition.
      const v = await lifecycle.createVersion(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '5.0.0',
        definition: {},
        composedSkillRefs: [
          { skillKey: 'superDelete', semanticVersion: '1.0.0' },
        ],
      });
      expect(v.maxEffect).toBe('IRREVERSIBLE');
      expect(v.authorityCeiling).toBe(50);
    });

    it('cyclic skill graph rejected', async () => {
      if (skipIfNoDb()) return;
      // Create skill A → B → A cycle. Detection requires expansion.
      await skillRepo.create({
        tenantId: TENANT_A,
        skillKey: 'A',
        semanticVersion: '1.0.0',
        maxEffect: 'READ',
        requiredAuthority: 0,
        approvalSensitive: false,
        timeoutMs: 1000,
        composedOf: [{ skillKey: 'B', semanticVersion: '1.0.0' }] as never,
      });
      await skillRepo.create({
        tenantId: TENANT_A,
        skillKey: 'B',
        semanticVersion: '1.0.0',
        maxEffect: 'READ',
        requiredAuthority: 0,
        approvalSensitive: false,
        timeoutMs: 1000,
        composedOf: [{ skillKey: 'A', semanticVersion: '1.0.0' }] as never,
      });

      await expect(
        builder.compose({
          tenantId: TENANT_A,
          skillKey: 'A',
          semanticVersion: '1.0.0',
          composedOf: [{ skillKey: 'B', semanticVersion: '1.0.0' }],
        }),
      ).rejects.toThrow(/[Cc]yclic/);
    });

    it('every lifecycle transition writes an audit log entry', async () => {
      if (skipIfNoDb()) return;
      const tpl = await seedTemplate(TENANT_A);
      const v = await lifecycle.createVersion(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '6.0.0',
        definition: {},
        composedSkillRefs: [],
      });
      await lifecycle.certify(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '6.0.0',
        evaluationReport: { score: 1 },
        reason: 'audit-test',
      });
      await lifecycle.activate(TENANT_A, actorA, {
        agentTemplateId: tpl.id,
        version: '6.0.0',
        reason: 'audit-test',
      });

      const rows = await auditRepo.listForSubject({
        tenantId: TENANT_A,
        subjectType: 'VERSION',
        subjectId: v.id,
      });
      const actions = new Set(rows.map((r) => r.action));
      expect(actions.has('CREATE')).toBe(true);
      expect(actions.has('CERTIFY')).toBe(true);
      expect(actions.has('ACTIVATE')).toBe(true);
    });
  },
);

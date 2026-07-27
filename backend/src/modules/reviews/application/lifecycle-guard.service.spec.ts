// src/modules/reviews/application/lifecycle-guard.service.spec.ts
//
// Unit tests for the lifecycle transition guard (plan §8.2). Mocks
// repository ports to verify the cross-aggregate guard logic without
// touching a real database.

import { LifecycleGuardService } from './lifecycle-guard.service';
import { ProjectStatus } from '../../projects/common/project-lifecycle';

type TaskRow = { id: string; title: string; status: string };

class FakeProjectRepo {
  async findById(_tenantId: string, _projectId: string): Promise<any> {
    return {
      id: 'project-1',
      tenantId: 'tenant-A',
      status: 'REVIEW',
      stageVersion: 1,
    };
  }
}

class FakeTaskRepo {
  async findByProjectAndStatuses(): Promise<TaskRow[]> {
    return [];
  }
}

class FakeWaiverRepo {
  public created: any[] = [];
  async create(input: any) {
    this.created.push(input);
    return { id: `waiver-${this.created.length}`, ...input };
  }
  async findById() {
    return null;
  }
  async listForEntity() {
    return [];
  }
}

describe('LifecycleGuardService', () => {
  let guard: LifecycleGuardService;
  let projectRepo: FakeProjectRepo;
  let taskRepo: FakeTaskRepo;
  let waiverRepo: FakeWaiverRepo;

  beforeEach(async () => {
    projectRepo = new FakeProjectRepo();
    taskRepo = new FakeTaskRepo();
    waiverRepo = new FakeWaiverRepo();
    // Bypass Nest DI for a pure-logic test: instantiate the service directly.
    guard = new LifecycleGuardService(
      projectRepo as any,
      taskRepo as any,
      waiverRepo as any,
    );
  });

  const tenantId = 'tenant-A';

  describe('state-machine guard', () => {
    it('rejects an invalid transition (LEAD → COMPLETED)', async () => {
      const res = await guard.canTransition(
        tenantId,
        'project-1',
        'LEAD' as ProjectStatus,
        'COMPLETED' as ProjectStatus,
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Invalid transition/);
    });

    it('accepts a valid transition (REVIEW → COMPLETED) when no blocking tasks', async () => {
      taskRepo.findByProjectAndStatuses = async () => [];
      const res = await guard.canTransition(
        tenantId,
        'project-1',
        'REVIEW' as ProjectStatus,
        'COMPLETED' as ProjectStatus,
      );
      expect(res.allowed).toBe(true);
    });

    it('accepts ACTIVE → ON_HOLD (no completion-guard applies)', async () => {
      const res = await guard.canTransition(
        tenantId,
        'project-1',
        'ACTIVE' as ProjectStatus,
        'ON_HOLD' as ProjectStatus,
      );
      expect(res.allowed).toBe(true);
    });

    it('rejects missing tenantId', async () => {
      const res = await guard.canTransition(
        '',
        'project-1',
        'ACTIVE' as ProjectStatus,
        'ON_HOLD' as ProjectStatus,
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('TENANT_REQUIRED');
    });

    it('rejects cross-tenant project ids', async () => {
      projectRepo.findById = async () => null;
      const res = await guard.canTransition(
        tenantId,
        'project-1',
        'REVIEW' as ProjectStatus,
        'COMPLETED' as ProjectStatus,
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('PROJECT_NOT_FOUND_IN_TENANT');
    });
  });

  describe('project completion guard (mandatory tasks approved)', () => {
    it('REVIEW → COMPLETED blocked when tasks in NEEDS_REVIEW remain', async () => {
      taskRepo.findByProjectAndStatuses = async () => [
        { id: 't1', title: 'T1', status: 'NEEDS_REVIEW' },
      ];
      const res = await guard.canTransition(
        tenantId,
        'project-1',
        'REVIEW' as ProjectStatus,
        'COMPLETED' as ProjectStatus,
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/mandatory task/i);
    });

    it('REVIEW → COMPLETED blocked when tasks in IN_PROGRESS remain', async () => {
      taskRepo.findByProjectAndStatuses = async () => [
        { id: 't1', title: 'T1', status: 'IN_PROGRESS' },
      ];
      const res = await guard.canTransition(
        tenantId,
        'project-1',
        'REVIEW' as ProjectStatus,
        'COMPLETED' as ProjectStatus,
      );
      expect(res.allowed).toBe(false);
    });

    it('REVIEW → COMPLETED allowed when all tasks are APPROVED or COMPLETED', async () => {
      taskRepo.findByProjectAndStatuses = async () => [];
      const res = await guard.canTransition(
        tenantId,
        'project-1',
        'REVIEW' as ProjectStatus,
        'COMPLETED' as ProjectStatus,
      );
      expect(res.allowed).toBe(true);
    });

    it('ACTIVE → COMPLETED also applies the completion guard', async () => {
      taskRepo.findByProjectAndStatuses = async () => [
        { id: 't1', title: 'T1', status: 'NEEDS_REVIEW' },
      ];
      const res = await guard.canTransition(
        tenantId,
        'project-1',
        'ACTIVE' as ProjectStatus,
        'COMPLETED' as ProjectStatus,
      );
      expect(res.allowed).toBe(false);
    });
  });

  describe('recordStructuredWaiver', () => {
    it('persists a structured waiver row and returns its id', async () => {
      const id = await guard.recordStructuredWaiver(
        tenantId,
        'project-1',
        'REVIEW' as ProjectStatus,
        'COMPLETED' as ProjectStatus,
        'Override: customer requested expedited close',
        '1 mandatory task requires approval before completion',
        {
          tenantId,
          actorId: 'user-1',
          actorType: 'HUMAN' as const,
          correlationId: 'corr-1',
          causationId: null,
          idempotencyKey: 'k1',
          occurredAt: new Date().toISOString(),
          schemaVersion: 1,
        },
      );
      expect(id).toMatch(/^waiver-/);
      expect(waiverRepo.created).toHaveLength(1);
      expect(waiverRepo.created[0]).toMatchObject({
        tenantId,
        entityType: 'Project',
        entityId: 'project-1',
        fromStage: 'REVIEW',
        toStage: 'COMPLETED',
        waivedByActorId: 'user-1',
        reason: 'Override: customer requested expedited close',
        guardFailureReason:
          '1 mandatory task requires approval before completion',
      });
    });

    it('rejects empty waiver reason', async () => {
      await expect(
        guard.recordStructuredWaiver(
          tenantId,
          'project-1',
          'REVIEW' as ProjectStatus,
          'COMPLETED' as ProjectStatus,
          '   ',
          'guard',
          {
            tenantId,
            actorId: 'user-1',
            actorType: 'HUMAN' as const,
            correlationId: 'corr-1',
            causationId: null,
            idempotencyKey: 'k1',
            occurredAt: new Date().toISOString(),
            schemaVersion: 1,
          },
        ),
      ).rejects.toThrow(/WAIVER_REASON_REQUIRED/);
    });
  });
});

/**
 * Regression test for the empty-tenantId bug in
 * ApprovalWorkflowEngine.notifyApprover and notifyCompletion.
 *
 * Plan ref: NC-ACCT-IMP-1 §5 (Prerequisite bug fix).
 *
 * The bug: notification.create was called with `tenantId: ''`, which
 * silently dropped the notification into the global (no-tenant) namespace
 * or failed the FK constraint on Notification.tenantId → tenants.id.
 *
 * This test mocks the prisma + notifications dependencies and asserts
 * that both notify* methods pass a real tenantId through to
 * notifications.create.
 */

import { ApprovalWorkflowEngine } from './approval-workflow.engine';
import { ApprovalStatus, ApprovalWorkflowType, UserRole } from '@prisma/client';

describe('ApprovalWorkflowEngine — notification tenantId bug fix', () => {
  // Build a minimal mock that satisfies the constructor and exposes the
  // methods we want to assert on.
  function buildEngine() {
    const calls: Array<{ args: any; method: string }> = [];
    const mockPrisma: any = {
      approvalWorkflow: {
        create: jest.fn(async ({ data, include }: any) => ({
          id: 'wf-1',
          tenantId: data.tenantId,
          currentStep: 0,
          steps: include?.steps
            ? (data.steps?.create ?? []).map((s: any, i: number) => ({
                stepOrder: s.stepOrder ?? i,
                approverId: s.approverId,
                approverRole: s.approverRole,
              }))
            : [],
        })),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(async ({ where, data }: any) => ({
          id: where.id,
          tenantId: 'tenant-real',
          currentStep: 0,
          status: data?.status ?? ApprovalStatus.PENDING,
        })),
        updateMany: jest.fn(),
      },
      approvalWorkflowStep: { update: jest.fn() },
    };
    const mockNotifications: any = {
      create: jest.fn(async (args: any) => {
        calls.push({ args, method: 'notifications.create' });
        return { id: 'notif-1', ...args };
      }),
    };
    const engine = new ApprovalWorkflowEngine(mockPrisma, mockNotifications);
    return { engine, calls };
  }

  it('notifyApprover receives a real tenantId (not empty string)', async () => {
    const { engine, calls } = buildEngine();
    await engine.create({
      name: 'Test workflow',
      workflowType: ApprovalWorkflowType.CUSTOM,
      tenantId: 'tenant-real-123',
      requesterId: 'user-1',
      steps: [
        { stepOrder: 0, approverId: 'user-2', approverRole: [UserRole.ADMIN] },
      ],
    });

    const notifyCalls = calls.filter((c) => c.method === 'notifications.create');
    expect(notifyCalls.length).toBeGreaterThan(0);
    for (const c of notifyCalls) {
      expect(c.args.tenantId).toBe('tenant-real-123');
      expect(c.args.tenantId).not.toBe('');
    }
  });

  it('notifyCompletion receives a real tenantId (not empty string)', async () => {
    // This test is harder to drive through public API because
    // notifyCompletion is invoked after a workflow goes APPROVED/REJECTED.
    // We test the private method via the engine's prototype.
    const { engine, calls } = buildEngine();
    await (engine as any).notifyCompletion({
      id: 'wf-99',
      tenantId: 'tenant-real-456',
      status: ApprovalStatus.APPROVED,
    });

    const notifyCalls = calls.filter((c) => c.method === 'notifications.create');
    expect(notifyCalls.length).toBe(1);
    expect(notifyCalls[0].args.tenantId).toBe('tenant-real-456');
    expect(notifyCalls[0].args.tenantId).not.toBe('');
  });

  it('step-advance notification passes tenantId through', async () => {
    const { engine, calls } = buildEngine();
    // Drive notifyApprover via the public step-advance path
    await (engine as any).notifyApprover({
      id: 'wf-77',
      tenantId: 'tenant-real-789',
      currentStep: 0,
      steps: [{ approverId: 'user-3', approverRole: [UserRole.ADMIN] }],
    });
    const notifyCalls = calls.filter((c) => c.method === 'notifications.create');
    expect(notifyCalls.length).toBe(1);
    expect(notifyCalls[0].args.tenantId).toBe('tenant-real-789');
    expect(notifyCalls[0].args.tenantId).not.toBe('');
  });
});
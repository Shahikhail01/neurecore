/**
 * ApprovalPort — Phase 7 unit tests (ADR-006).
 *
 * Tests the ApprovalPortService in isolation using test doubles for:
 *   - IGovernanceEvaluator
 *   - IApprovalWorkflowEngine
 *   - IApprovalChainsService
 *   - IEnterpriseEventTransport
 *   - ApprovalsService
 *
 * Coverage:
 *   1. Auto-approve path: LOW risk + allowed governance → returns AUTO_APPROVED
 *   2. Require approval path: HIGH risk → creates workflow
 *   3. Require approval path: governance requires review → creates workflow
 *   4. EvaluateRequirement: delegates correctly to governance evaluator
 *   5. Decide: routes to workflow engine for workflow approvals
 *   6. Decide: falls back to governance approvals service for simple approvals
 *   7. getStatus: tries workflow engine first, falls back to governance
 *   8. cancel: delegates to correct engine
 */

import { ApprovalPortService } from '../approval-port.service';
import { IGovernanceEvaluator } from '../../governance/interfaces/governance-evaluator.interface';
import {
  IApprovalWorkflowEngine,
  ApprovalContext,
  WorkActor,
  ApprovalRequestData,
} from '../approval-port.interface';
import { IApprovalChainsService } from '../../approval-chains/interfaces/approval-chain.interface';
import { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import { ApprovalsService } from '../../governance/services/approvals.service';
import type { RiskTier, ApprovalPriority } from '@prisma/client';

function makeGovernanceEvaluator(overrides: Partial<IGovernanceEvaluator> = {}): IGovernanceEvaluator {
  return {
    evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, triggeredRules: [], actions: [] }),
    ...overrides,
  };
}

function makeWorkflowEngine(overrides: Partial<IApprovalWorkflowEngine> = {}): IApprovalWorkflowEngine {
  return {
    create: jest.fn().mockResolvedValue({ id: 'wf_1' }),
    advance: jest.fn().mockResolvedValue({ id: 'wf_1', status: 'APPROVED', currentStep: 1, totalSteps: 1, context: {} }),
    cancel: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue(null),
    canApprove: jest.fn().mockResolvedValue(false),
    getPendingForApprover: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeChainService(overrides: Partial<IApprovalChainsService> = {}): IApprovalChainsService {
  return {
    resolveChain: jest.fn().mockResolvedValue({ workflowId: 'wf_chain', steps: [], isSequential: true, totalSteps: 2 }),
    advanceChain: jest.fn().mockResolvedValue(undefined),
    isStepBlocked: jest.fn().mockResolvedValue(false),
    findPendingWorkflows: jest.fn().mockResolvedValue([]),
    getCurrentStep: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeEventTransport(): IEnterpriseEventTransport {
  return {
    publish: jest.fn().mockResolvedValue({ eventId: 'evt_1', deduplicated: false }),
    registerConsumer: jest.fn(),
    getConsumerStatus: jest.fn().mockResolvedValue({ consumerId: '', pending: 0, processing: 0, processed: 0, failed: 0, deadLettered: 0 }),
    replayDeadLetter: jest.fn().mockResolvedValue(false),
  };
}

function makeGovernanceApprovalsService(overrides: Partial<ApprovalsService> = {}): ApprovalsService {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    review: jest.fn().mockResolvedValue({ id: 'gov_1', status: 'APPROVED' }),
    cancel: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function defaultContext(): ApprovalContext {
  return {
    tenantId: 't1',
    projectId: null,
    resourceType: 'agent_action',
    resourceId: 'res_1',
    riskTier: 'LOW' as RiskTier,
    priority: 'MEDIUM' as ApprovalPriority,
    amount: null,
    currency: null,
  };
}

function defaultActor(): WorkActor {
  return { id: 'user_1', type: 'AI_AGENT', tenantId: 't1' };
}

function defaultRequest(): ApprovalRequestData {
  return {
    title: 'Approve test action',
    description: null,
    payload: null,
    expiresAt: null,
    workRequestId: null,
    correlationId: 'corr_1',
  };
}

describe('ApprovalPortService', () => {
  describe('request()', () => {
    it('returns AUTO_APPROVED when governance allows and riskTier is LOW', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, triggeredRules: [], actions: [] }),
      });
      const wf = makeWorkflowEngine();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.request(defaultContext(), defaultActor(), defaultRequest());

      expect(result.status).toBe('AUTO_APPROVED');
      expect(result.requiresHumanReview).toBe(false);
      expect(wf.create).not.toHaveBeenCalled();
    });

    it('creates a basic workflow when requiresApproval is true', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: true, triggeredRules: ['rule_1'], actions: ['REQUIRE_APPROVAL'] }),
      });
      const wf = makeWorkflowEngine({ create: jest.fn().mockResolvedValue({ id: 'wf_2' }) });
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.request(defaultContext(), defaultActor(), defaultRequest());

      expect(result.status).toBe('PENDING');
      expect(result.requiresHumanReview).toBe(true);
      expect(wf.create).toHaveBeenCalled();
      expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'enterprise.approval.requested' }));
    });

    it('uses chain resolution for deliverable resource type with non-LOW risk', async () => {
      const chain = makeChainService({
        resolveChain: jest.fn().mockResolvedValue({
          workflowId: 'wf_chain',
          steps: [
            { id: 's1', stepOrder: 0, approverRole: ['ADMIN'], approverId: null, status: 'PENDING', decision: null, comment: null, decidedAt: null, chainStepOrder: 0, chainStepTotal: 2, blockedByPriorStep: false },
            { id: 's2', stepOrder: 1, approverRole: ['PROJECT_MANAGER'], approverId: null, status: 'PENDING', decision: null, comment: null, decidedAt: null, chainStepOrder: 1, chainStepTotal: 2, blockedByPriorStep: true },
          ],
          isSequential: true,
          totalSteps: 2,
        }),
      });
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: true, triggeredRules: [], actions: [] }),
      });
      const wf = makeWorkflowEngine();
      const events = makeEventTransport();

      const ctx = { ...defaultContext(), resourceType: 'deliverable', riskTier: 'HIGH' as RiskTier, projectId: 'proj_1' };
      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.request(ctx, defaultActor(), defaultRequest());

      expect(chain.resolveChain).toHaveBeenCalledWith('t1', 'res_1', '');
      expect(result.status).toBe('PENDING');
      expect(result.requiresHumanReview).toBe(true);
    });

    it('returns REJECTED when governance disallows and no approval required', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: false, requiresApproval: false, triggeredRules: ['block_rule'], actions: ['BLOCK'] }),
      });
      const wf = makeWorkflowEngine();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.request(defaultContext(), defaultActor(), defaultRequest());

      expect(result.status).toBe('REJECTED');
      expect(result.requiresHumanReview).toBe(false);
      expect(wf.create).not.toHaveBeenCalled();
    });

    it('governance evaluator is called with correct tenant and context', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, triggeredRules: [], actions: [] }),
      });
      const wf = makeWorkflowEngine();
      const chain = makeChainService();
      const events = makeEventTransport();

      const ctx = { ...defaultContext(), tenantId: 'tenant_x', resourceType: 'expense', amount: 5000, currency: 'USD' };
      const actor = { ...defaultActor(), id: 'actor_y', type: 'HUMAN' as const };
      const svc = new ApprovalPortService(gov, wf, chain, events);
      await svc.request(ctx, actor, defaultRequest());

      expect(gov.evaluate).toHaveBeenCalledWith('tenant_x', expect.objectContaining({
        action: 'expense',
        resourceId: 'res_1',
        projectId: null,
        actorId: 'actor_y',
        actorType: 'HUMAN',
        amount: 5000,
        currency: 'USD',
      }));
    });
  });

  describe('evaluateRequirement()', () => {
    it('maps governance result to ApprovalRequirement correctly for allowed + no approval needed', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, triggeredRules: [], actions: [] }),
      });
      const wf = makeWorkflowEngine();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.evaluateRequirement(defaultContext(), defaultActor());

      expect(result.requiresApproval).toBe(false);
      expect(result.autoApproved).toBe(true);
      expect(result.governanceAllowed).toBe(true);
      expect(result.riskTier).toBe('LOW');
    });

    it('sets autoApproved=false when governance requires approval', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: true, triggeredRules: ['r1'], actions: ['REQUIRE_APPROVAL'] }),
      });
      const wf = makeWorkflowEngine();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.evaluateRequirement(defaultContext(), defaultActor());

      expect(result.requiresApproval).toBe(true);
      expect(result.autoApproved).toBe(false);
      expect(result.triggeredRules).toContain('r1');
    });

    it('sets governanceAllowed=false when governance blocks', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: false, requiresApproval: false, triggeredRules: ['block_r1'], actions: ['BLOCK'] }),
      });
      const wf = makeWorkflowEngine();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.evaluateRequirement(defaultContext(), defaultActor());

      expect(result.governanceAllowed).toBe(false);
      expect(result.autoApproved).toBe(false);
      expect(result.requiresApproval).toBe(false);
    });

    it('derives maxAutonomyLevel based on riskTier', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, triggeredRules: [], actions: [] }),
      });
      const wf = makeWorkflowEngine();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);

      const lowRisk = await svc.evaluateRequirement({ ...defaultContext(), riskTier: 'LOW' as RiskTier }, defaultActor());
      const medRisk = await svc.evaluateRequirement({ ...defaultContext(), riskTier: 'MEDIUM' as RiskTier }, defaultActor());
      const highRisk = await svc.evaluateRequirement({ ...defaultContext(), riskTier: 'HIGH' as RiskTier }, defaultActor());

      expect(lowRisk.maxAutonomyLevel).toBe(5);
      expect(medRisk.maxAutonomyLevel).toBe(4);
      expect(highRisk.maxAutonomyLevel).toBe(2);
    });
  });

  describe('decide()', () => {
    it('rejects an AI_AGENT reviewer (self-approval prohibition)', async () => {
      const wf = makeWorkflowEngine({ getStatus: jest.fn().mockResolvedValue(null) });
      const govApprovals = makeGovernanceApprovalsService();
      const gov = makeGovernanceEvaluator();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events, govApprovals);
      await expect(
        svc.decide(
          { approvalId: 'wf_1', decision: 'APPROVED', reason: null, revisionInstructions: null, correlationId: 'corr_1' },
          { id: 'ai_employee_1', type: 'AI_AGENT', tenantId: 't1' },
        ),
      ).rejects.toThrow(/SELF_APPROVAL_FORBIDDEN/);
      expect(wf.advance).not.toHaveBeenCalled();
      expect(govApprovals.review).not.toHaveBeenCalled();
    });

    it('routes to workflow engine when approval is a workflow', async () => {
      const wf = makeWorkflowEngine({
        getStatus: jest.fn().mockResolvedValue({ id: 'wf_1', status: 'PENDING', currentStep: 0, totalSteps: 1, steps: [], context: {} }),
        advance: jest.fn().mockResolvedValue({ id: 'wf_1', status: 'APPROVED', currentStep: 1, totalSteps: 1, context: {} }),
      });
      const gov = makeGovernanceEvaluator();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.decide(
        { approvalId: 'wf_1', decision: 'APPROVED', reason: null, revisionInstructions: null, correlationId: 'corr_1' },
        { id: 'reviewer_1', type: 'HUMAN', tenantId: 't1' },
      );

      expect(wf.advance).toHaveBeenCalledWith('wf_1', 'reviewer_1', 'APPROVED', undefined);
      expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'enterprise.approval.granted' }));
      expect(result.eventEmitted).toBe(true);
    });

    it('routes to governance approvals service when not a workflow', async () => {
      const wf = makeWorkflowEngine({ getStatus: jest.fn().mockResolvedValue(null) });
      const govApprovals = makeGovernanceApprovalsService({
        findOne: jest.fn().mockResolvedValue({ id: 'gov_1', status: 'PENDING', tenantId: 't1' }),
        review: jest.fn().mockResolvedValue({ id: 'gov_1', status: 'REJECTED' }),
      });
      const gov = makeGovernanceEvaluator();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events, govApprovals);
      const result = await svc.decide(
        { approvalId: 'gov_1', decision: 'REJECTED', reason: 'Not approved', revisionInstructions: null, correlationId: 'corr_1' },
        { id: 'reviewer_1', type: 'HUMAN', tenantId: 't1' },
      );

      expect(govApprovals.review).toHaveBeenCalledWith('gov_1', 't1', 'reviewer_1', { status: 'REJECTED', rejectionReason: 'Not approved' });
      expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'enterprise.approval.rejected' }));
    });

    it('maps RETURNED_FOR_REVISION to REJECTED in governance decision', async () => {
      const wf = makeWorkflowEngine({ getStatus: jest.fn().mockResolvedValue(null) });
      const govApprovals = makeGovernanceApprovalsService({
        findOne: jest.fn().mockResolvedValue({ id: 'gov_2', status: 'PENDING', tenantId: 't1' }),
        review: jest.fn().mockResolvedValue({ id: 'gov_2', status: 'REJECTED' }),
      });
      const gov = makeGovernanceEvaluator();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events, govApprovals);
      await svc.decide(
        { approvalId: 'gov_2', decision: 'RETURNED_FOR_REVISION', reason: 'Needs more detail', revisionInstructions: 'Add budget breakdown', correlationId: 'corr_1' },
        { id: 'reviewer_1', type: 'HUMAN', tenantId: 't1' },
      );

      expect(govApprovals.review).toHaveBeenCalledWith('gov_2', 't1', 'reviewer_1', {
        status: 'REJECTED',
        rejectionReason: 'Add budget breakdown',
      });
    });
  });

  describe('getStatus()', () => {
    it('returns workflow status when found in workflow engine', async () => {
      const wf = makeWorkflowEngine({
        getStatus: jest.fn().mockResolvedValue({
          id: 'wf_1',
          status: 'PENDING',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            { id: 's1', stepOrder: 0, approverRole: ['ADMIN'], approverId: null, status: 'PENDING', decision: null, comment: null, decidedAt: null },
            { id: 's2', stepOrder: 1, approverRole: ['PROJECT_MANAGER'], approverId: null, status: 'PENDING', decision: null, comment: null, decidedAt: null },
          ],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:01:00Z',
          completedAt: null,
        }),
      });
      const gov = makeGovernanceEvaluator();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      const result = await svc.getStatus('wf_1', 't1');

      expect(result).not.toBeNull();
      expect(result!.approvalId).toBe('wf_1');
      expect(result!.status).toBe('PENDING');
      expect(result!.currentStep).toBe(1);
      expect(result!.totalSteps).toBe(2);
    });

    it('returns null when not found in either engine', async () => {
      const wf = makeWorkflowEngine({ getStatus: jest.fn().mockResolvedValue(null) });
      const govApprovals = makeGovernanceApprovalsService({ findOne: jest.fn().mockRejectedValue(new Error('not found')) });
      const gov = makeGovernanceEvaluator();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events, govApprovals);
      const result = await svc.getStatus('nonexistent', 't1');

      expect(result).toBeNull();
    });
  });

  describe('cancel()', () => {
    it('cancels via workflow engine when it is a workflow', async () => {
      const wf = makeWorkflowEngine({
        getStatus: jest.fn().mockResolvedValue({ id: 'wf_1', status: 'PENDING', currentStep: 0, totalSteps: 1, steps: [], context: {} }),
        cancel: jest.fn().mockResolvedValue(undefined),
      });
      const gov = makeGovernanceEvaluator();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events);
      await svc.cancel('wf_1', 'user_1', 't1');

      expect(wf.cancel).toHaveBeenCalledWith('wf_1', 'user_1');
    });

    it('cancels via governance approvals service when not a workflow', async () => {
      const wf = makeWorkflowEngine({ getStatus: jest.fn().mockResolvedValue(null) });
      const govApprovals = makeGovernanceApprovalsService({ cancel: jest.fn().mockResolvedValue(undefined) });
      const gov = makeGovernanceEvaluator();
      const chain = makeChainService();
      const events = makeEventTransport();

      const svc = new ApprovalPortService(gov, wf, chain, events, govApprovals);
      await svc.cancel('gov_1', 'user_1', 't1');

      expect(govApprovals.cancel).toHaveBeenCalledWith('gov_1', 't1', 'user_1');
    });
  });

  describe('event emission', () => {
    it('skips event emission gracefully when transport is not available', async () => {
      const gov = makeGovernanceEvaluator({
        evaluate: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, triggeredRules: [], actions: [] }),
      });
      const wf = makeWorkflowEngine();
      const chain = makeChainService();

      const svc = new ApprovalPortService(gov, wf, chain, undefined);
      const result = await svc.request(defaultContext(), defaultActor(), defaultRequest());

      expect(result.status).toBe('AUTO_APPROVED');
    });
  });
});

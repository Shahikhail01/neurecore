/**
 * Enterprise Cognition — unit + integration tests (Phase 5).
 */

import { AgentSelector } from './specialists/agent-selector.service';
import { CognitiveEvaluator } from './reasoning/synthesis-engines.service';
import {
  guardReasoning,
  evidenceFromContext,
  confidenceFromEvidence,
} from './reasoning/cognition-support';
import { EnterpriseCognitionService } from './enterprise-cognition.service';
import type {
  EnterpriseObjective,
  ReasoningTrace,
} from './contracts/enterprise-cognition.interface';

function obj(overrides: Partial<EnterpriseObjective> = {}): EnterpriseObjective {
  return {
    id: 'o1', tenantId: 't1', statement: 'Prepare marketing budget plan',
    departments: ['marketing', 'finance'], requiredContextCapabilities: ['projects', 'finance'],
    constraints: [], expectedDeliverables: ['budget'], successCriteria: [],
    reasoning: { conclusion: '', evidence: [], assumptions: [], knownUnknowns: [], alternativesConsidered: [], rejectedAlternatives: [], policiesConsidered: [], confidence: 'MEDIUM' },
    ...overrides,
  };
}

describe('AgentSelector (deterministic)', () => {
  const sel = new AgentSelector();
  it('returns a stable set for the same objective', () => {
    const a = sel.select(obj()).map((s) => s.role);
    const b = sel.select(obj()).map((s) => s.role);
    expect(a).toEqual(b);
  });
  it('convenes marketing + finance specialists for a marketing/finance objective', () => {
    const roles = sel.select(obj()).map((s) => s.role);
    expect(roles).toContain('Marketing Strategist');
    expect(roles).toContain('Finance Analyst');
    // Always includes Risk Analyst + Project Manager for coverage.
    expect(roles).toContain('Risk Analyst');
    expect(roles).toContain('Project Manager');
  });
  it('specialists never carry execution authority (advisory ceiling only)', () => {
    for (const s of sel.listAll()) expect(s.maxAuthority).toBeLessThanOrEqual(70);
  });
});

describe('hallucination guard + evidence', () => {
  it('extracts evidence only from non-denied, available capabilities', () => {
    const ctx = { capabilities: {
      projects: { access: 'FULL', unavailable: false, data: {} },
      finance: { access: 'DENIED', data: {} },
      comms: { access: 'FULL', unavailable: true, data: {} },
    } };
    const ev = evidenceFromContext(ctx);
    const caps = ev.map((e) => e.capability);
    expect(caps).toContain('projects');
    expect(caps).not.toContain('finance'); // DENIED → no evidence
    expect(caps).not.toContain('comms'); // unavailable → no evidence
  });

  it('caps confidence when a conclusion has no grounded evidence', () => {
    const trace: ReasoningTrace = {
      conclusion: 'x', evidence: [], assumptions: [], knownUnknowns: [],
      alternativesConsidered: [], rejectedAlternatives: [], policiesConsidered: [], confidence: 'VERY_HIGH',
    };
    const { trace: guarded, issues } = guardReasoning(trace);
    expect(issues.length).toBeGreaterThan(0);
    expect(['VERY_LOW', 'LOW']).toContain(guarded.confidence);
  });

  it('flags evidence from disallowed sources', () => {
    const trace: ReasoningTrace = {
      conclusion: 'x',
      evidence: [{ source: 'FABRICATED' as never, reference: 'r', detail: 'd' }],
      assumptions: [], knownUnknowns: [], alternativesConsidered: [], rejectedAlternatives: [], policiesConsidered: [], confidence: 'HIGH',
    };
    const { issues } = guardReasoning(trace);
    expect(issues.some((i) => /disallowed sources/.test(i))).toBe(true);
  });

  it('confidence scales with grounded evidence count', () => {
    expect(confidenceFromEvidence([])).toBe('VERY_LOW');
    expect(confidenceFromEvidence([{ source: 'CONTEXT_PLANE', reference: 'a', detail: '' }])).toBe('LOW');
  });
});

describe('CognitiveEvaluator', () => {
  it('raises hallucination risk when recommendations lack evidence', () => {
    const ev = new CognitiveEvaluator();
    const score = ev.score({
      requestId: 'r', tenantId: 't1', objective: obj(),
      decomposition: { objectiveId: 'o1', goals: [], reasoning: obj().reasoning },
      specialistOpinions: [],
      recommendations: [{ id: 'x', tenantId: 't1', title: 't', summary: '', priority: 'MEDIUM', confidence: 'HIGH', evidence: [], reasoning: '', assumptions: [], risks: [], alternatives: [], departments: [], recommendedAgentRole: null, requiresApproval: false, shouldBecomeWorkRun: false, proposedWorkRequest: null }],
      strategicFindings: [],
    });
    expect(score.issues.length).toBeGreaterThan(0);
    expect(['MEDIUM', 'HIGH']).toContain(score.hallucinationRisk);
  });
});

// ── Integration: full cognize workflow with fakes ────────────────────────────
describe('EnterpriseCognitionService (integration)', () => {
  function build(opts: { autoHandoff?: boolean } = {}) {
    const events: any[] = [];
    const runsCreated: any[] = [];
    const contextPlane = { assemble: async () => ({
      tenantId: 't1', actorId: 'owner',
      identity: { role: 'OWNER', authorityLevel: 100, departmentId: null },
      authContext: { effectiveAuthority: 100, governanceBlocked: false },
      capabilities: { projects: { authorization: { access: 'FULL' }, data: { total: 2 }, unavailable: false } },
    }) };
    const core = {
      start: async (p: any) => { const r = { id: `run_${runsCreated.length + 1}`, status: 'COMPLETED', ...p }; runsCreated.push(p); return r; },
      startDurable: async () => ({ run: {}, created: true }),
      executeRun: async () => ({}),
      get: async () => null, list: async () => [], resume: async () => ({}), cancel: async () => ({}),
    };
    const transport = { publish: async (e: any) => { events.push(e); return { eventId: 'e', deduplicated: false }; }, registerConsumer: () => {} };
    const objectives = { analyze: async () => obj() };
    const decomposer = { decompose: async () => ({ objectiveId: 'o1', goals: [{ id: 'g1', sequence: 1, title: 'Budget', description: '', dependsOn: [], suggestedDepartment: 'finance', executable: true }], reasoning: obj().reasoning }) };
    const selector = new AgentSelector();
    const coordinator = { coordinate: async () => [{ role: 'Finance Analyst', department: 'finance', opinion: 'budget looks tight', reasoning: obj().reasoning }] };
    const recommender = { recommend: async () => [{ id: 'rec1', tenantId: 't1', title: 'Prepare budget', summary: 's', priority: 'HIGH', confidence: 'MEDIUM', evidence: [{ source: 'CONTEXT_PLANE', reference: 'projects', detail: '' }], reasoning: 'r', assumptions: [], risks: ['overrun'], alternatives: [], departments: ['finance'], recommendedAgentRole: 'Finance Analyst', requiresApproval: true, shouldBecomeWorkRun: opts.autoHandoff === true, proposedWorkRequest: opts.autoHandoff ? 'Create a budget task' : null }] };
    const strategy = { evaluate: async () => [{ area: 'KPI', finding: 'budget trend rising', priority: 'MEDIUM', reasoning: obj().reasoning }] };
    const evaluator = new CognitiveEvaluator();
    const svc = new EnterpriseCognitionService(
      contextPlane as never, core as never, transport as never,
      objectives as never, decomposer as never, selector as never, coordinator as never,
      recommender as never, strategy as never, evaluator as never,
    );
    return { svc, events, runsCreated };
  }

  it('produces recommendations with evidence + confidence and does NOT execute by default', async () => {
    const { svc, events, runsCreated } = build();
    const result = await svc.cognize({ tenantId: 't1', actorId: 'owner', actorType: 'HUMAN', request: 'Prepare next month marketing budget.' });
    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].evidence.length).toBeGreaterThan(0);
    expect(result.recommendations[0].confidence).toBeDefined();
    expect(result.handedOffWorkRunIds).toHaveLength(0); // no execution by default
    expect(runsCreated).toHaveLength(0);
    const types = events.map((e) => e.eventType);
    expect(types).toEqual(expect.arrayContaining([
      'enterprise.cognition.started', 'enterprise.goal.decomposed', 'enterprise.specialist.assigned',
      'enterprise.recommendation.created', 'enterprise.cognition.completed',
    ]));
  });

  it('hands off to AIEmployeeCore (create + execute) only when autoHandoff=true AND an Employee is supplied', async () => {
    const { svc, runsCreated } = build({ autoHandoff: true });
    const result = await svc.cognize({ tenantId: 't1', actorId: 'owner', actorType: 'HUMAN', request: 'Prepare budget and create the task.', autoHandoff: true, handoffEmployeeId: 'emp-1' });
    expect(result.handedOffWorkRunIds).toHaveLength(1);
    expect(runsCreated).toHaveLength(1); // via core.start (create + execute)
    expect(runsCreated[0].employeeId).toBe('emp-1');
    expect(runsCreated[0].trigger.type).toBe('EVENT');
  });

  it('blocks handoff (no dormant CREATED run) when autoHandoff is true but no Employee is supplied', async () => {
    const { svc, runsCreated } = build({ autoHandoff: true });
    const result = await svc.cognize({ tenantId: 't1', actorId: 'owner', actorType: 'HUMAN', request: 'Prepare budget and create the task.', autoHandoff: true });
    expect(result.handedOffWorkRunIds).toHaveLength(0);
    expect(runsCreated).toHaveLength(0); // blocked, never dormant
  });

  it('attaches a cognitive score with hallucination risk', async () => {
    const { svc } = build();
    const result = await svc.cognize({ tenantId: 't1', actorId: 'owner', actorType: 'HUMAN', request: 'x' });
    expect(result.score.hallucinationRisk).toBe('VERY_LOW'); // grounded evidence present
  });
});

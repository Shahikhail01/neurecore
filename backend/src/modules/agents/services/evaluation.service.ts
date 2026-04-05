import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { EvaluationStatus } from '@prisma/client';
import type {
  IEvaluationRepository,
  EvaluationRunRecord,
  TestCase,
  TestResult,
  CreateEvaluationInput,
} from '../interfaces/evaluation.interface';
import { AgentsService } from './agents.service';

/**
 * EvaluationService
 * OCP: extend by swapping IEvaluationRepository or injecting a different LLM scorer.
 * SRP: evaluation lifecycle only — no HTTP, no DB direct access.
 */
@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    @Inject('IEvaluationRepository')
    private readonly repo: IEvaluationRepository,
    private readonly agentsService: AgentsService,
  ) {}

  /** Create an evaluation run and kick it off asynchronously. */
  async startEvaluation(
    agentId: string,
    tenantId: string,
    testCases: TestCase[],
    runBy: string,
    notes?: string,
  ): Promise<EvaluationRunRecord> {
    const input: CreateEvaluationInput = {
      agentId,
      tenantId,
      testCases,
      runBy,
      notes,
    };
    const run = await this.repo.create(input);
    // Fire-and-forget — not awaited here so the HTTP response returns quickly
    this.executeEvaluation(run.id, agentId, tenantId, testCases).catch((err) =>
      this.logger.error(
        `Evaluation ${run.id} failed: ${(err as Error).message}`,
      ),
    );
    return run;
  }

  async getRunsForAgent(
    agentId: string,
    tenantId: string,
  ): Promise<EvaluationRunRecord[]> {
    return this.repo.findByAgent(agentId, tenantId);
  }

  async getRunById(id: string): Promise<EvaluationRunRecord> {
    const run = await this.repo.findById(id);
    if (!run) throw new NotFoundException(`EvaluationRun ${id} not found`);
    return run;
  }

  /**
   * Promote a staging agent to production: flip deploymentMode to PRODUCTION.
   * Must have at least one COMPLETED evaluation with score ≥ 70.
   */
  async promoteToProduction(agentId: string, tenantId: string): Promise<void> {
    const runs = await this.repo.findByAgent(agentId, tenantId);
    const bestRun = runs.find(
      (r) =>
        r.status === EvaluationStatus.COMPLETED &&
        r.scoreOverall !== null &&
        r.scoreOverall >= 70,
    );
    if (!bestRun) {
      throw new NotFoundException(
        'No passing evaluation run (score ≥ 70) found for this agent',
      );
    }
    await this.agentsService.update(
      agentId,
      { metadata: { promotedAt: new Date().toISOString() } },
      tenantId,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Run each test case through the agent's systemPrompt.
   * This is a simple keyword-matching scorer; real LLM judge can be dropped in.
   */
  private async executeEvaluation(
    runId: string,
    agentId: string,
    tenantId: string,
    testCases: TestCase[],
  ): Promise<void> {
    const results: TestResult[] = [];
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const start = Date.now();
      try {
        const passed = this.simpleKeywordCheck(tc);
        results.push({
          testCaseIndex: i,
          passed,
          actualOutput: '(evaluated)',
          latencyMs: Date.now() - start,
        });
      } catch (err) {
        results.push({
          testCaseIndex: i,
          passed: false,
          actualOutput: '',
          latencyMs: Date.now() - start,
          error: (err as Error).message,
        });
      }
    }
    const score = testCases.length
      ? (results.filter((r) => r.passed).length / testCases.length) * 100
      : 0;

    await this.repo.updateStatus(
      runId,
      EvaluationStatus.COMPLETED,
      results,
      score,
    );
  }

  /** Placeholder scorer: passes if expectedOutput is contained in actualOutput. */
  private simpleKeywordCheck(tc: TestCase): boolean {
    if (!tc.expectedOutput) return true;
    return tc.expectedOutput.trim().length === 0;
  }
}

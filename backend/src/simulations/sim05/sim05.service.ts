/**
 * Sim05Service — runs the Sim-05 training scenarios through the
 * accounting capability.
 *
 * Plan ref: NC-SIM05-IMP-2.
 *
 * Architecture:
 *   - Scenarios are listed from `sim05-scenarios.ts` (static metadata).
 *   - COMPUTE scenarios are exercised by calling the existing TIER-1
 *     `nc.accounting.*` tools (which are now wired through ToolsModule).
 *     This service acts as a thin wrapper that provides schema-validated
 *     access for the agent and the test harness.
 *   - JUDGMENT scenarios are not invoked here; they require an LLM
 *     orchestrator and reference oracles (textbook answers). They are
 *     surfaced as metadata + datasets only; full execution is Phase 2
 *     of Sim-05 work.
 *
 * **Honest scope:** This service deliberately does NOT:
 *   - Synthesize the dataset (Python script generation is Phase 2).
 *   - Score agent answers against reference oracles (Phase 2).
 *   - Implement the day-runner orchestration (existing DayRunner is
 *     for general simulations; sim05-specific day decomposition is
 *     Phase 2).
 *
 * What this DOES:
 *   - Lists all 20 scenarios with metadata.
 *   - Exposes a "run compute step" endpoint that produces a textual
 *     recipe + the canonical computation (NPV/IRR/MIRR/amortize) for
 *     the agent to call. The agent then uses the tools to execute.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  SIM05_SCENARIOS,
  COMPUTE_SCENARIOS,
  JUDGMENT_SCENARIOS,
  getScenarioById,
  Sim05Scenario,
  Sim05Category,
} from './sim05-scenarios';
import { AccountingService } from '../../modules/accounting/services/accounting.service';

export interface Sim05RunComputeStepResult {
  scenarioId: number;
  step: 'COMPUTE_NPV' | 'COMPUTE_IRR' | 'COMPUTE_MIRR' | 'AMORTIZE_LOAN';
  result: unknown;
}

@Injectable()
export class Sim05Service {
  private readonly logger = new Logger(Sim05Service.name);

  constructor(private readonly accounting: AccountingService) {}

  /** All 20 scenarios. */
  list(): Sim05Scenario[] {
    return SIM05_SCENARIOS;
  }

  /** Filter by category. */
  listByCategory(category: Sim05Category): Sim05Scenario[] {
    return category === 'COMPUTE' ? COMPUTE_SCENARIOS : JUDGMENT_SCENARIOS;
  }

  /** Single scenario by ID. */
  get(id: number): Sim05Scenario {
    const s = getScenarioById(id);
    if (!s) {
      throw new NotFoundException(`Sim-05 scenario ${id} not found`);
    }
    return s;
  }

  /**
   * Execute a compute step for a COMPUTE scenario and tenant.
   * Actor (tenantId, userId) come from the request context.
   *
   * NOTE: This is a server-side executor for cert harness and scripted
   * agents only. The Sim05 **end-user agent** should invoke the
   * `nc.accounting.*` tools directly (which now have access to the sidecar).
   *
   * Returns the result of the compute (matches the shape returned by
   * the sidecar's compute endpoint).
   */
  async runComputeStep(
    tenantId: string,
    userId: string,
    scenarioId: number,
    dataset: Record<string, unknown>,
  ): Promise<Sim05RunComputeStepResult> {
    const scenario = this.get(scenarioId);
    if (scenario.category !== 'COMPUTE') {
      throw new BadRequestException(
        `Scenario ${scenarioId} is JUDGMENT, not COMPUTE; cannot run compute step`,
      );
    }

    // Validate dataset against datasetSpec (lightweight)
    if (scenario.datasetSpec) {
      const missing = scenario.datasetSpec
        .filter((f) => f.required && !(f.name in dataset))
        .map((f) => f.name);
      if (missing.length > 0) {
        throw new BadRequestException(
          `Missing required fields: ${missing.join(', ')}`,
        );
      }
    }

    // Route to the right compute based on the requested step.
    // The step is inferred from the dataset keys (caller-friendly).
    const step = inferStep(dataset);
    let result: unknown;
    switch (step) {
      case 'COMPUTE_NPV':
        result = await this.accounting.computeNpv(tenantId, userId,
          num(dataset, 'discount_rate', 0.10),
          arr(dataset, 'cashflows'));
        break;
      case 'COMPUTE_IRR':
        result = await this.accounting.computeIrr(tenantId, userId,
          arr(dataset, 'cashflows'));
        break;
      case 'COMPUTE_MIRR':
        result = await this.accounting.computeMirr(tenantId, userId,
          num(dataset, 'finance_rate', 0.10),
          num(dataset, 'reinvest_rate', 0.10),
          arr(dataset, 'cashflows'));
        break;
      case 'AMORTIZE_LOAN':
        result = await this.accounting.amortizeLoan(tenantId, userId,
          num(dataset, 'principal', 100_000),
          num(dataset, 'rate', 0.06),
          num(dataset, 'nper', 12));
        break;
      default:
        throw new BadRequestException(`Unknown compute step: ${step}`);
    }
    return { scenarioId, step, result };
  }
}

function num(d: Record<string, unknown>, key: string, fallback?: number): number {
  const v = d[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  if (fallback !== undefined) return fallback;
  throw new BadRequestException(`Missing or non-numeric: ${key}`);
}

function arr(d: Record<string, unknown>, key: string): number[] {
  const v = d[key];
  if (Array.isArray(v)) {
    return v.map((x) => num(x === undefined ? d : { x }, 'x'));
  }
  if (typeof v === 'string') {
    // Accept CSV like "300, 400, 500" or "300 400 500"
    return v.split(/[\s,]+/).filter((s) => s.length).map((s) => Number(s));
  }
  throw new BadRequestException(`Missing or non-array: ${key}`);
}

function inferStep(d: Record<string, unknown>): Sim05RunComputeStepResult['step'] {
  if ('salvage_value' in d || 'sensitivity_grid' in d || 'reinvest_rate' in d) {
    return 'COMPUTE_MIRR';
  }
  if ('principal' in d && 'rate' in d && 'nper' in d) {
    return 'AMORTIZE_LOAN';
  }
  if (!('discount_rate' in d) && 'cashflows' in d) {
    return 'COMPUTE_IRR';
  }
  return 'COMPUTE_NPV';
}
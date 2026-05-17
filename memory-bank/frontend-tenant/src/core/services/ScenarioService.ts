// ─── ScenarioService.ts ───────────────────────────────────────────────────────
// SRP: Pure scenario computation — no UI concerns.
// OCP: New templates added as data entries — no class modification needed.
// DIP: Consumers depend on IScenarioService, not this class.

import type {
  IScenarioService,
  ScenarioVariable,
  ScenarioResult,
  ScenarioTemplate,
} from '@/core/services/interfaces/IScenarioService';

// ─── Built-in scenario templates (OCP: extend by adding entries) ──────────────
const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id:          'scale-agents',
    name:        'Scale Agent Workforce',
    description: 'Project what happens if you increase active agents and reduce task backlog.',
    icon:        '🤖',
    variables: [
      {
        id: 'agent-count',   label: 'Active Agents',
        description: 'Number of agents running concurrently',
        baseline: 40,        min: 10, max: 200, step: 5, unit: 'agents', impactWeight: 0.45,
      },
      {
        id: 'automation-rate', label: 'Automation Rate',
        description: 'Percentage of tasks handled autonomously',
        baseline: 65,         min: 0, max: 100, step: 5, unit: '%', impactWeight: 0.35,
      },
      {
        id: 'model-quality', label: 'Model Quality',
        description: 'AI model performance tier (1 = basic, 100 = elite)',
        baseline: 70,         min: 1, max: 100, step: 1, unit: 'pts', impactWeight: 0.20,
      },
    ],
  },
  {
    id:          'revenue-push',
    name:        'Revenue Acceleration',
    description: 'Simulate impact of budget injection, sales headcount, and deal velocity.',
    icon:        '💰',
    variables: [
      {
        id: 'sales-agents',  label: 'Sales Agent Count',
        description: 'Agents dedicated to sales workflows',
        baseline: 8,         min: 1, max: 50, step: 1, unit: 'agents', impactWeight: 0.40,
      },
      {
        id: 'budget-boost',  label: 'Budget Allocation',
        description: 'Marketing & operations budget index',
        baseline: 60,        min: 10, max: 100, step: 5, unit: 'idx', impactWeight: 0.35,
      },
      {
        id: 'lead-quality',  label: 'Lead Quality Score',
        description: 'Average inbound lead quality (1–100)',
        baseline: 55,        min: 1, max: 100, step: 1, unit: 'pts', impactWeight: 0.25,
      },
    ],
  },
  {
    id:          'cost-reduction',
    name:        'Cost Optimization',
    description: 'Explore savings from automation, token efficiency, and workflow streamlining.',
    icon:        '⚡',
    variables: [
      {
        id: 'token-efficiency', label: 'Token Efficiency',
        description: 'API token usage efficiency (0 = wasteful, 100 = optimal)',
        baseline: 50,            min: 0, max: 100, step: 5, unit: '%', impactWeight: 0.40,
      },
      {
        id: 'workflow-steps', label: 'Avg Workflow Steps',
        description: 'Average number of steps per workflow (fewer = cheaper)',
        baseline: 12,            min: 2, max: 30, step: 1, unit: 'steps', impactWeight: 0.35,
      },
      {
        id: 'error-rate',     label: 'Error Rate',
        description: 'Task failure rate (lower is better)',
        baseline: 15,            min: 0, max: 50, step: 1, unit: '%', impactWeight: 0.25,
      },
    ],
  },
];

let _resultId = 0;

export class ScenarioService implements IScenarioService {
  private savedResults: ScenarioResult[] = [];

  // ─── IScenarioRunner ──────────────────────────────────────────────────────

  runSimulation(variables: ScenarioVariable[]): ScenarioResult {
    const outcomes = this._computeOutcomes(variables);
    const confidence = this._computeConfidence(variables);

    // Find the template for the name/description (best-effort match)
    const template = SCENARIO_TEMPLATES.find((t) =>
      t.variables.some((tv) => variables.some((v) => v.id === tv.id)),
    );

    return {
      id:          `sim_${++_resultId}`,
      name:        template?.name ?? 'Custom Scenario',
      description: template?.description ?? 'Custom what-if simulation',
      variables,
      outcomes,
      confidence,
      computedAt:  new Date().toISOString(),
    };
  }

  // ─── IScenarioStore ───────────────────────────────────────────────────────

  getTemplates(): ScenarioTemplate[] {
    return [...SCENARIO_TEMPLATES];
  }

  saveResult(result: ScenarioResult): void {
    this.savedResults = [result, ...this.savedResults].slice(0, 20);
  }

  getSavedResults(): ScenarioResult[] {
    return [...this.savedResults];
  }

  clearResults(): void {
    this.savedResults = [];
  }

  // ─── Private computation ──────────────────────────────────────────────────

  private _computeOutcomes(vars: ScenarioVariable[]) {
    // Weighted delta score across all variables
    const totalWeight = vars.reduce((s, v) => s + v.impactWeight, 0) || 1;
    const weightedDelta = vars.reduce((s, v) => {
      const range = v.max - v.min;
      const baselineNorm = (v.baseline - v.min) / range;
      const adjustedNorm = (v.adjusted - v.min) / range;
      return s + (adjustedNorm - baselineNorm) * (v.impactWeight / totalWeight);
    }, 0);

    const mkOutcome = (label: string, baseVal: number, multiplier: number, unit: string, higherIsBetter = true) => {
      const projected = Math.max(0, Math.round(baseVal * (1 + weightedDelta * multiplier)));
      const delta     = projected - baseVal;
      return {
        label,
        baseline:   baseVal,
        projected,
        delta,
        unit,
        isPositive: higherIsBetter ? delta >= 0 : delta <= 0,
      };
    };

    return [
      mkOutcome('Task Throughput',     120, 1.8, 'tasks/day'),
      mkOutcome('Success Rate',         75, 0.6, '%'),
      mkOutcome('Team Harmony',         70, 0.8, '%'),
      mkOutcome('Estimated Cost',      100, 0.5, 'idx', false),
      mkOutcome('Response Time',       180, -0.7, 'ms', false),
    ];
  }

  private _computeConfidence(vars: ScenarioVariable[]): number {
    // Confidence drops as adjustments deviate further from baseline
    const avgDeviation = vars.reduce((s, v) => {
      const range = v.max - v.min;
      return s + Math.abs(v.adjusted - v.baseline) / range;
    }, 0) / Math.max(1, vars.length);

    return Math.max(20, Math.round(95 - avgDeviation * 70));
  }
}

export const scenarioService = new ScenarioService();

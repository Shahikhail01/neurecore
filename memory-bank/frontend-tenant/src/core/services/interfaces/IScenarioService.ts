// ─── IScenarioService.ts ──────────────────────────────────────────────────────
// ISP: Segregated into IScenarioRunner (compute) and IScenarioStore (CRUD).

export interface ScenarioVariable {
  id:          string;
  label:       string;
  description: string;
  /** Current baseline value (0–100 or domain-specific range) */
  baseline:    number;
  /** User-dragged what-if value */
  adjusted:    number;
  min:         number;
  max:         number;
  step:        number;
  unit:        string;
  /** How strongly this variable affects outcomes (weight 0–1) */
  impactWeight: number;
}

export interface ScenarioOutcome {
  label:      string;
  baseline:   number;
  projected:  number;
  /** Projected – baseline (positive = better) */
  delta:      number;
  unit:       string;
  isPositive: boolean;
}

export interface ScenarioResult {
  id:            string;
  name:          string;
  description:   string;
  variables:     ScenarioVariable[];
  outcomes:      ScenarioOutcome[];
  confidence:    number;    // 0–100
  computedAt:    string;    // ISO datetime
}

export interface IScenarioRunner {
  /** Compute projected outcomes from current variable adjustments */
  runSimulation(variables: ScenarioVariable[]): ScenarioResult;
}

export interface IScenarioStore {
  /** Built-in scenario templates */
  getTemplates(): ScenarioTemplate[];
  saveResult(result: ScenarioResult): void;
  getSavedResults(): ScenarioResult[];
  clearResults(): void;
}

export interface ScenarioTemplate {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  variables:   Omit<ScenarioVariable, 'adjusted'>[];
}

export interface IScenarioService extends IScenarioRunner, IScenarioStore {}

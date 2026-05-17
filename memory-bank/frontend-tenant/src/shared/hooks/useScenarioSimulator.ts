'use client';
// ─── useScenarioSimulator.ts ──────────────────────────────────────────────────
// SRP: Bridges ScenarioService ↔ React component state.
// DIP: Depends on IScenarioService abstraction.

import { useState, useCallback } from 'react';
import { scenarioService }        from '@/core/services/ScenarioService';
import type {
  ScenarioTemplate,
  ScenarioVariable,
  ScenarioResult,
} from '@/core/services/interfaces/IScenarioService';

interface UseScenarioSimulatorReturn {
  templates:     ScenarioTemplate[];
  activeTemplate: ScenarioTemplate | null;
  variables:     ScenarioVariable[];
  result:        ScenarioResult | null;
  isRunning:     boolean;
  /** Load a template and initialise variables with baseline values */
  loadTemplate:  (templateId: string) => void;
  /** Update a single variable's adjusted value */
  adjust:        (variableId: string, value: number) => void;
  /** Run the simulation */
  simulate:      () => void;
  /** Reset adjustments to baseline */
  reset:         () => void;
  /** Save current result */
  save:          () => void;
  savedResults:  ScenarioResult[];
}

export function useScenarioSimulator(): UseScenarioSimulatorReturn {
  const templates = scenarioService.getTemplates();

  const [activeTemplate, setActiveTemplate] = useState<ScenarioTemplate | null>(null);
  const [variables, setVariables]           = useState<ScenarioVariable[]>([]);
  const [result, setResult]                 = useState<ScenarioResult | null>(null);
  const [isRunning, setRunning]             = useState(false);
  const [savedResults, setSaved]            = useState<ScenarioResult[]>(() => scenarioService.getSavedResults());

  const loadTemplate = useCallback((templateId: string) => {
    const t = templates.find((tpl) => tpl.id === templateId);
    if (!t) return;
    setActiveTemplate(t);
    setVariables(t.variables.map((v) => ({ ...v, adjusted: v.baseline })));
    setResult(null);
  }, [templates]);

  const adjust = useCallback((variableId: string, value: number) => {
    setVariables((prev) =>
      prev.map((v) => v.id === variableId ? { ...v, adjusted: value } : v),
    );
    // Clear stale result when user adjusts
    setResult(null);
  }, []);

  const simulate = useCallback(() => {
    if (variables.length === 0) return;
    setRunning(true);
    // Simulate async work for UX feel
    setTimeout(() => {
      const r = scenarioService.runSimulation(variables);
      setResult(r);
      setRunning(false);
    }, 600);
  }, [variables]);

  const reset = useCallback(() => {
    if (!activeTemplate) return;
    setVariables(activeTemplate.variables.map((v) => ({ ...v, adjusted: v.baseline })));
    setResult(null);
  }, [activeTemplate]);

  const save = useCallback(() => {
    if (!result) return;
    scenarioService.saveResult(result);
    setSaved(scenarioService.getSavedResults());
  }, [result]);

  return {
    templates,
    activeTemplate,
    variables,
    result,
    isRunning,
    loadTemplate,
    adjust,
    simulate,
    reset,
    save,
    savedResults,
  };
}

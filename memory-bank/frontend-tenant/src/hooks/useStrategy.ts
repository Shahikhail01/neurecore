'use client';

/**
 * useStrategy.ts — Strategy Room data hook
 *
 * S: forecast orchestration only; UI stays in page component
 * D: calls strategyService (injected shapes, not concrete import)
 */

import { useState, useCallback } from 'react';
import { strategyService } from '@/services/chat.service';
import { useStrategyStore } from '@/stores/chatStore';
import type { ScenarioParameters, Scenario, ForecastResult } from '@/types/strategy.types';

const SCENARIO_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#a855f7', '#ec4899', '#14b8a6',
];

export function useStrategy() {
  const { scenarios, currentScenarioId, addScenario, removeScenario, setCurrentScenario } =
    useStrategyStore();

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const current = scenarios.find((s) => s.id === currentScenarioId) ?? null;

  const runForecast = useCallback(
    async (params: ScenarioParameters, name: string) => {
      setLoading(true);
      setError(null);
      try {
        const result: ForecastResult = await strategyService.forecast(params);
        const scenario: Scenario = {
          id:         crypto.randomUUID(),
          name,
          parameters: params,
          result,
          createdAt:  new Date().toISOString(),
          color:      SCENARIO_COLORS[scenarios.length % SCENARIO_COLORS.length],
        };
        addScenario(scenario);
        setCurrentScenario(scenario.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Forecast failed');
      } finally {
        setLoading(false);
      }
    },
    [scenarios.length, addScenario, setCurrentScenario],
  );

  const deleteScenario = useCallback(
    (id: string) => {
      removeScenario(id);
      if (currentScenarioId === id) {
        const remaining = scenarios.filter((s) => s.id !== id);
        setCurrentScenario(remaining[remaining.length - 1]?.id ?? null);
      }
    },
    [scenarios, currentScenarioId, removeScenario, setCurrentScenario],
  );

  return { scenarios, current, loading, error, runForecast, deleteScenario, setCurrentScenario };
}

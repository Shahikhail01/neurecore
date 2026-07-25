'use client';

/**
 * ScenarioBuilder.tsx — Strategy Room parameter editor
 *
 * S: scenario parameter input + submission; forecast display in sibling
 * O: slider config array — extend by adding entries
 * I: calls onRun(params) prop; no store mutations here
 * D: parent page wires to strategyService via hook
 */

import { useState } from 'react';
import type { ScenarioParameters } from '@/types/strategy.types';

interface SliderConfig {
  key: keyof Omit<ScenarioParameters, 'forecastMonths'>;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderConfig[] = [
  {
    key: 'tenantGrowth',
    label: 'Tenant Growth',
    min: 0,
    max: 50,
    step: 1,
    format: (v) => `+${v}%`,
  },
  {
    key: 'tokenMultiplier',
    label: 'Token Volume Multiplier',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}×`,
  },
  {
    key: 'modelAdoptionRate',
    label: 'Premium Model Adoption',
    min: 0,
    max: 100,
    step: 5,
    format: (v) => `${v}%`,
  },
  {
    key: 'automationSavings',
    label: 'Automation Cost Delta',
    min: -50,
    max: 50,
    step: 5,
    format: (v) => (v >= 0 ? `+${v}%` : `${v}%`),
  },
];

const MONTH_OPTIONS = [3, 6, 12] as const;

const DEFAULT_PARAMS: ScenarioParameters = {
  tenantGrowth: 10,
  tokenMultiplier: 1.0,
  modelAdoptionRate: 30,
  automationSavings: 0,
  forecastMonths: 6,
};

interface Props {
  onRun: (params: ScenarioParameters, scenarioName: string) => void;
  loading: boolean;
}

export function ScenarioBuilder({ onRun, loading }: Props) {
  const [params, setParams]   = useState<ScenarioParameters>(DEFAULT_PARAMS);
  const [name, setName]       = useState('Scenario 1');

  const set = (key: keyof ScenarioParameters, value: number) =>
    setParams((p) => ({ ...p, [key]: value }));

  const accentClass = (val: number, zero = 0) =>
    val > zero ? 'text-status-profit' : val < zero ? 'text-status-risk' : 'text-zinc-400';

  return (
    <div className="flex flex-col gap-5">
      {/* Scenario name */}
      <div>
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Scenario Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[color:var(--accent-500)] transition"
        />
      </div>

      {/* Sliders */}
      {SLIDERS.map(({ key, label, min, max, step, format }) => (
        <div key={key}>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {label}
            </span>
            <span className={`text-xs font-mono font-semibold ${accentClass(params[key], key === 'automationSavings' ? 0 : -1)}`}>
              {format(params[key])}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={params[key]}
            onChange={(e) => set(key, parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-surface-border accent-indigo-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
            <span>{format(min)}</span>
            <span>{format(max)}</span>
          </div>
        </div>
      ))}

      {/* Forecast horizon */}
      <div>
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Forecast Horizon
        </label>
        <div className="flex gap-2 mt-1.5">
          {MONTH_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => set('forecastMonths', m)}
              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition ${
                params.forecastMonths === m
                  ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/20 text-indigo-300'
                  : 'border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Run */}
      <button
        onClick={() => onRun(params, name)}
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-40 text-sm font-semibold text-white transition"
      >
        {loading ? 'Computing…' : 'Run Forecast'}
      </button>
    </div>
  );
}

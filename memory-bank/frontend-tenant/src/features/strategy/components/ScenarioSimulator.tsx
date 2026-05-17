'use client';
// ─── ScenarioSimulator.tsx ────────────────────────────────────────────────────
// SRP: Renders the Strategy Room what-if simulator — data via useScenarioSimulator().
// All computation delegated to ScenarioService (DIP, SRP).

import { motion, AnimatePresence } from 'framer-motion';
import { useScenarioSimulator }     from '@/shared/hooks/useScenarioSimulator';
import type { ScenarioVariable, ScenarioOutcome } from '@/core/services/interfaces/IScenarioService';

// ─── Variable slider ──────────────────────────────────────────────────────────
function VariableSlider({
  variable,
  onChange,
}: {
  variable: ScenarioVariable;
  onChange: (id: string, val: number) => void;
}) {
  const delta  = variable.adjusted - variable.baseline;
  const pct    = ((variable.adjusted - variable.min) / (variable.max - variable.min)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-zinc-200">{variable.label}</span>
          <p className="text-[10px] text-zinc-500 mt-0.5">{variable.description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300">
            {variable.adjusted}{variable.unit}
          </span>
          {delta !== 0 && (
            <span className={`text-[10px] font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {delta > 0 ? '+' : ''}{delta}{variable.unit}
            </span>
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="relative group">
        <input
          type="range"
          min={variable.min}
          max={variable.max}
          step={variable.step}
          value={variable.adjusted}
          onChange={(e) => onChange(variable.id, Number(e.target.value))}
          className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-800
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125"
          style={{
            background: `linear-gradient(to right, #6366f1 ${pct}%, #27272a ${pct}%)`,
          }}
          aria-label={`Adjust ${variable.label}`}
        />
        {/* Baseline marker */}
        <div
          className="absolute top-0 h-1.5 w-0.5 bg-zinc-500 rounded pointer-events-none"
          style={{
            left: `calc(${((variable.baseline - variable.min) / (variable.max - variable.min)) * 100}% - 1px)`,
          }}
          title={`Baseline: ${variable.baseline}${variable.unit}`}
        />
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between text-[9px] text-zinc-600">
        <span>{variable.min}{variable.unit}</span>
        <span>{variable.max}{variable.unit}</span>
      </div>
    </div>
  );
}

// ─── Outcome row ──────────────────────────────────────────────────────────────
function OutcomeRow({ outcome }: { outcome: ScenarioOutcome }) {
  const deltaPct = outcome.baseline > 0
    ? Math.round((outcome.delta / outcome.baseline) * 100)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
    >
      <span className="text-sm text-zinc-300">{outcome.label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">
          {outcome.baseline}<span className="ml-0.5 text-[10px]">{outcome.unit}</span>
        </span>
        <span className="text-zinc-600">→</span>
        <span className={`text-sm font-semibold ${outcome.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {outcome.projected}<span className="ml-0.5 text-[10px]">{outcome.unit}</span>
        </span>
        {outcome.delta !== 0 && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            outcome.isPositive
              ? 'bg-emerald-950/40 text-emerald-400'
              : 'bg-red-950/40 text-red-400'
          }`}>
            {deltaPct > 0 ? '+' : ''}{deltaPct}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ScenarioSimulator() {
  const {
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
  } = useScenarioSimulator();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-100">Strategy Simulator</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Adjust variables and run what-if projections for your AI team.
        </p>
      </div>

      {/* Template picker */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => loadTemplate(t.id)}
            className={`rounded-xl border p-4 text-left transition-all ${
              activeTemplate?.id === t.id
                ? 'border-indigo-500/60 bg-indigo-950/30 ring-1 ring-indigo-500/30'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
            }`}
          >
            <span className="text-2xl">{t.icon}</span>
            <p className="mt-2 text-sm font-medium text-zinc-200">{t.name}</p>
            <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{t.description}</p>
          </button>
        ))}
      </div>

      {activeTemplate ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Variables panel */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Variables</h3>
              <button
                onClick={reset}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ↺ Reset to baseline
              </button>
            </div>

            <div className="space-y-5">
              {variables.map((v) => (
                <VariableSlider key={v.id} variable={v} onChange={adjust}/>
              ))}
            </div>

            <button
              onClick={simulate}
              disabled={isRunning}
              className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white
                hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20"/>
                  </svg>
                  Running Simulation…
                </span>
              ) : '▶ Run Simulation'}
            </button>
          </div>

          {/* Outcomes panel */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="mb-4 text-sm font-semibold text-zinc-200">Projected Outcomes</h3>

            <AnimatePresence mode="wait">
              {!result ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                >
                  <span className="text-4xl">🔮</span>
                  <p className="text-sm text-zinc-500">Adjust variables and run the simulation to see projected outcomes.</p>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {/* Confidence badge */}
                  <div className="flex items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2 mb-2">
                    <span className="text-xs text-zinc-400">Simulation Confidence</span>
                    <span className={`text-sm font-bold ${
                      result.confidence >= 80 ? 'text-emerald-400' :
                      result.confidence >= 60 ? 'text-amber-400' : 'text-red-400'
                    }`}>{result.confidence}%</span>
                  </div>

                  {result.outcomes.map((o) => (
                    <OutcomeRow key={o.label} outcome={o}/>
                  ))}

                  <button
                    onClick={save}
                    className="mt-3 w-full rounded-lg border border-zinc-700 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    💾 Save Scenario
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Select a scenario template to get started.</p>
        </div>
      )}
    </div>
  );
}

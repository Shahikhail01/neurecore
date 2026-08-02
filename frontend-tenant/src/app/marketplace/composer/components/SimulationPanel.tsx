'use client';

/**
 * SimulationPanel — runs the deterministic simulation through the
 * canonical SkillComposerController endpoint.
 */

import { useState, useCallback } from 'react';
import { Loader2, Play } from 'lucide-react';
import { serializeGraph } from './SkillCanvas';
import type { Edge, Node } from 'reactflow';
import type { SkillComposerNodeData } from './SkillNode';

export interface SimulationStep {
  step: number;
  nodeId: string;
  nodeKind: string;
  outcome: 'success' | 'abstain' | 'error' | 'skipped';
  reason?: string;
  elapsedMs: number;
}

export interface SimulationResult {
  scenario: string;
  ok: boolean;
  trace: SimulationStep[];
  unreachable: string[];
  issues: string[];
}

interface SimulationPanelProps {
  nodes: Node<SkillComposerNodeData>[];
  edges: Edge[];
}

export default function SimulationPanel({ nodes, edges }: SimulationPanelProps) {
  const [scenario, setScenario] = useState('Default scenario');
  const [inputs, setInputs] = useState('{\n  "text": "Hello"\n}');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const json = (() => {
        try {
          return JSON.parse(inputs) as Record<string, unknown>;
        } catch {
          return { text: inputs };
        }
      })();
      const graph = serializeGraph(nodes, edges);
      const res = await fetch('/api/v1/skill-composer/simulate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph,
          scenario: { name: scenario, inputs: json },
        }),
      });
      const body = (await res.json()) as SimulationResult;
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'simulation failed');
    } finally {
      setRunning(false);
    }
  }, [scenario, inputs, nodes, edges]);

  return (
    <section
      aria-label="Simulation panel"
      style={{
        background: 'rgba(17,19,26,0.92)',
        border: '1px solid #27272a',
        borderRadius: 12,
        padding: 14,
        color: '#e4e4e7',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 600 }}>Simulation</h3>
        <button
          type="button"
          aria-label="Run simulation"
          onClick={() => void run()}
          disabled={running}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #a855f7',
            background: '#a855f722',
            color: '#e4e4e7',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: running ? 'progress' : 'pointer',
            fontSize: 12,
          }}
        >
          {running ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="w-3 h-3" aria-hidden="true" />
          )}
          Run
        </button>
      </header>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 11,
          color: '#a1a1aa',
        }}
      >
        Scenario name
        <input
          type="text"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          aria-label="Scenario name"
          style={{
            background: '#0f1014',
            border: '1px solid #27272a',
            borderRadius: 6,
            color: '#e4e4e7',
            padding: '6px 8px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
          }}
        />
      </label>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 11,
          color: '#a1a1aa',
        }}
      >
        Inputs (JSON)
        <textarea
          value={inputs}
          onChange={(e) => setInputs(e.target.value)}
          rows={4}
          aria-label="Scenario inputs JSON"
          style={{
            background: '#0f1014',
            border: '1px solid #27272a',
            borderRadius: 6,
            color: '#e4e4e7',
            padding: '6px 8px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
          }}
        />
      </label>
      {error ? (
        <div
          role="alert"
          style={{
            background: '#7f1d1d33',
            border: '1px solid #ef4444',
            borderRadius: 6,
            padding: 8,
            fontSize: 12,
            color: '#fca5a5',
          }}
        >
          {error}
        </div>
      ) : null}
      {result ? (
        <div style={{ fontSize: 12 }}>
          <div
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              background: result.ok ? '#10b98122' : '#ef444422',
              color: result.ok ? '#6ee7b7' : '#fca5a5',
              border: `1px solid ${result.ok ? '#10b981' : '#ef4444'}`,
            }}
          >
            {result.ok ? 'Simulation OK' : `${result.issues.length} issue(s)`}
          </div>
          <ol style={{ marginTop: 8, paddingLeft: 18 }}>
            {result.trace.map((step) => (
              <li key={step.step} style={{ marginBottom: 2, color: '#d4d4d8' }}>
                <strong>{step.nodeKind}</strong>: {step.outcome}
                {step.reason ? ` — ${step.reason}` : ''}
              </li>
            ))}
          </ol>
          {result.unreachable.length > 0 ? (
            <div style={{ marginTop: 6, color: '#fca5a5' }}>
              Unreachable: {result.unreachable.join(', ')}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

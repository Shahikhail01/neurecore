'use client';

/**
 * Phase 24 — SkillGraphControls (CR-AI-0602 save / load / preview).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §5 (P24).
 *
 * SOLID — SRP: this component owns ONLY the save/load/preview
 * controls. The canvas owns rendering; the page owns routing.
 *
 * DIP: depends on `ISkillGraphClient` (injected via prop). The
 * component is testable by passing a mock client.
 *
 * ISP: takes only the typed graph + a small callback surface.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Edge, Node } from 'reactflow';
import type { SkillComposerNodeData } from './SkillNode';
import type { ISkillGraphClient, ISavedSkillGraph } from './SkillGraphClient';

export interface SkillGraphControlsProps {
  readonly client: ISkillGraphClient;
  readonly nodes: ReadonlyArray<Node<SkillComposerNodeData>>;
  readonly edges: ReadonlyArray<Edge>;
  readonly mode: 'chat' | 'workflow';
  readonly onLoad: (graph: ISavedSkillGraph) => void;
}

interface ListState {
  readonly status: 'idle' | 'loading' | 'error';
  readonly items: ReadonlyArray<ISavedSkillGraph>;
  readonly error: string | null;
}

export function SkillGraphControls({
  client,
  nodes,
  edges,
  mode,
  onLoad,
}: SkillGraphControlsProps) {
  const [name, setName] = useState('untitled-graph');
  const [list, setList] = useState<ListState>({ status: 'idle', items: [], error: null });
  const [saveStatus, setSaveStatus] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; message: string | null }>({
    status: 'idle',
    message: null,
  });

  const refresh = useCallback(async () => {
    setList((s) => ({ ...s, status: 'loading' }));
    try {
      const items = await client.list();
      setList({ status: 'idle', items, error: null });
    } catch (e) {
      setList({ status: 'error', items: [], error: (e as Error).message });
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = useCallback(async () => {
    setSaveStatus({ status: 'saving', message: null });
    try {
      const graph = {
        mode,
        nodes: nodes.map((n) => ({
          id: n.id,
          kind: n.data.kind,
          label: n.data.label,
          config: { toolKey: n.data.toolKey, effect: n.data.effect },
          inputs: n.data.inputs,
          outputs: n.data.outputs,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: { nodeId: e.source, portId: e.sourceHandle ?? 'out' },
          target: { nodeId: e.target, portId: e.targetHandle ?? 'in' },
        })),
        inputs: [],
        outputs: [],
      };
      await client.save({ name, graph });
      setSaveStatus({ status: 'saved', message: `saved as "${name}"` });
      void refresh();
    } catch (e) {
      setSaveStatus({ status: 'error', message: (e as Error).message });
    }
  }, [client, edges, mode, name, nodes, refresh]);

  const handleLoad = useCallback(
    async (id: string) => {
      try {
        const row = await client.load(id);
        if (row) onLoad(row);
      } catch (e) {
        setSaveStatus({ status: 'error', message: (e as Error).message });
      }
    },
    [client, onLoad],
  );

  return (
    <div
      role="region"
      aria-label="Graph save/load controls"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'rgba(17, 19, 26, 0.92)',
        border: '1px solid #27272a',
        borderRadius: 10,
        padding: 10,
        color: '#e4e4e7',
        fontSize: 11,
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <label htmlFor="graph-name" style={{ color: '#a1a1aa' }}>Name</label>
        <input
          id="graph-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Graph name"
          style={{
            flex: 1,
            background: '#0f1014',
            border: '1px solid #3f3f46',
            borderRadius: 4,
            color: '#e4e4e7',
            padding: '4px 6px',
            fontSize: 11,
          }}
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveStatus.status === 'saving'}
          aria-label="Save graph"
          style={{
            background: '#a855f722',
            border: '1px solid #a855f7',
            borderRadius: 4,
            color: '#e4e4e7',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          {saveStatus.status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {saveStatus.message ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            color: saveStatus.status === 'error' ? '#f87171' : '#10b981',
            fontSize: 10,
          }}
        >
          {saveStatus.message}
        </div>
      ) : null}
      <div style={{ color: '#a1a1aa', fontWeight: 600 }}>Saved graphs</div>
      {list.status === 'loading' ? (
        <div role="status" style={{ color: '#71717a' }}>Loading…</div>
      ) : list.error ? (
        <div role="alert" style={{ color: '#f87171' }}>{list.error}</div>
      ) : list.items.length === 0 ? (
        <div style={{ color: '#71717a' }}>No saved graphs yet.</div>
      ) : (
        <ul role="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {list.items.map((g) => (
            <li
              key={g.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #27272a',
                padding: '4px 0',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {g.name}
              </span>
              <button
                type="button"
                onClick={() => void handleLoad(g.id)}
                aria-label={`Load graph ${g.name}`}
                style={{
                  background: 'transparent',
                  border: '1px solid #3f3f46',
                  borderRadius: 4,
                  color: '#a1a1aa',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                Load
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

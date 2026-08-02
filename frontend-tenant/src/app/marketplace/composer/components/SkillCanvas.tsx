'use client';

/**
 * SkillCanvas — drag/drop canvas + palette for the composer.
 * Pure presentation + interaction; no LLM, no execution.
 */

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import SkillNode, {
  type SkillComposerNodeKind,
  type SkillComposerNodeData,
  type SkillComposerPort,
} from './SkillNode';

interface SkillCanvasProps {
  onGraphChange?: (graph: ComposerGraph) => void;
  initialNodes?: Node<SkillComposerNodeData>[];
  initialEdges?: Edge[];
}

export interface ComposerGraph {
  nodes: Node<SkillComposerNodeData>[];
  edges: Edge[];
  mode: 'chat' | 'workflow';
}

const PALETTE: Array<{
  kind: SkillComposerNodeKind;
  label: string;
  description: string;
  ports: { inputs: SkillComposerPort[]; outputs: SkillComposerPort[] };
}> = [
  {
    kind: 'prompt',
    label: 'Prompt',
    description: 'Captures natural-language input.',
    ports: {
      inputs: [],
      outputs: [{ id: 'text', name: 'text', dataType: 'string', direction: 'OUT', required: false }],
    },
  },
  {
    kind: 'read',
    label: 'Read',
    description: 'Reads a registered record.',
    ports: {
      inputs: [{ id: 'query', name: 'query', dataType: 'string', direction: 'IN', required: true }],
      outputs: [{ id: 'record', name: 'record', dataType: 'record', direction: 'OUT', required: false }],
    },
  },
  {
    kind: 'action',
    label: 'Action',
    description: 'Invokes a registered tool.',
    ports: {
      inputs: [{ id: 'input', name: 'input', dataType: 'record', direction: 'IN', required: true }],
      outputs: [{ id: 'result', name: 'result', dataType: 'record', direction: 'OUT', required: false }],
    },
  },
  {
    kind: 'condition',
    label: 'Condition',
    description: 'Branches on a typed predicate.',
    ports: {
      inputs: [{ id: 'predicate', name: 'predicate', dataType: 'boolean', direction: 'IN', required: true }],
      outputs: [
        { id: 'true', name: 'true', dataType: 'envelope', direction: 'OUT', required: false },
        { id: 'false', name: 'false', dataType: 'envelope', direction: 'OUT', required: false },
      ],
    },
  },
  {
    kind: 'transform',
    label: 'Transform',
    description: 'Maps typed ports to typed ports.',
    ports: {
      inputs: [{ id: 'input', name: 'input', dataType: 'record', direction: 'IN', required: true }],
      outputs: [{ id: 'output', name: 'output', dataType: 'record', direction: 'OUT', required: false }],
    },
  },
  {
    kind: 'approval',
    label: 'Approval',
    description: 'Pauses for human approval.',
    ports: {
      inputs: [{ id: 'draft', name: 'draft', dataType: 'string', direction: 'IN', required: true }],
      outputs: [{ id: 'decision', name: 'decision', dataType: 'boolean', direction: 'OUT', required: false }],
    },
  },
  {
    kind: 'envelope',
    label: 'Envelope',
    description: 'Renders a channel-neutral envelope.',
    ports: {
      inputs: [{ id: 'response', name: 'response', dataType: 'envelope', direction: 'IN', required: true }],
      outputs: [{ id: 'response', name: 'response', dataType: 'envelope', direction: 'OUT', required: true }],
    },
  },
];

const NODE_TYPES: NodeTypes = Object.freeze({ skill: SkillNode });

let idCounter = 0;
const nextId = (kind: SkillComposerNodeKind) =>
  `${kind}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

const defaultNodeLabel = (kind: SkillComposerNodeKind): string => {
  const item = PALETTE.find((p) => p.kind === kind);
  return item ? item.label : 'Node';
};

function makeNode(
  kind: SkillComposerNodeKind,
  position: { x: number; y: number },
): Node<SkillComposerNodeData> {
  const item = PALETTE.find((p) => p.kind === kind);
  return {
    id: nextId(kind),
    type: 'skill',
    position,
    data: {
      kind,
      label: defaultNodeLabel(kind),
      description: item?.description ?? '',
      inputs: item?.ports.inputs ?? [],
      outputs: item?.ports.outputs ?? [],
      effect: kind === 'action' ? 'INTERNAL_WRITE' : 'READ',
    },
  };
}

const INITIAL_NODES: Node<SkillComposerNodeData>[] = [
  makeNode('prompt', { x: 40, y: 40 }),
  makeNode('read', { x: 320, y: 40 }),
  makeNode('envelope', { x: 620, y: 40 }),
];

export default function SkillCanvas({
  onGraphChange,
  initialNodes,
  initialEdges,
}: SkillCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<SkillComposerNodeData>(
    initialNodes ?? INITIAL_NODES,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>(
    initialEdges ?? [],
  );
  const [mode, setMode] = useState<'chat' | 'workflow'>('workflow');
  const [validation, setValidation] = useState<{ ok: boolean; issues: string[] }>({
    ok: true,
    issues: [],
  });

  const emitChange = useCallback(
    (next: Node<SkillComposerNodeData>[], e: Edge[]) => {
      onGraphChange?.({ nodes: next, edges: e, mode });
    },
    [mode, onGraphChange],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...params, animated: true }, eds);
        emitChange(nodes, next);
        return next;
      });
    },
    [setEdges, emitChange, nodes],
  );

  const handleAdd = useCallback(
    (kind: SkillComposerNodeKind) => {
      setNodes((nds) => {
        const created = makeNode(kind, {
          x: 80 + (nds.length % 4) * 220,
          y: 240 + Math.floor(nds.length / 4) * 140,
        });
        const next = [...nds, created];
        emitChange(next, edges);
        return next;
      });
    },
    [setNodes, emitChange, edges],
  );

  const validate = useCallback(async () => {
    const graph = serializeGraph(nodes, edges);
    try {
      const res = await fetch('/api/v1/skill-composer/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph }),
      });
      const json = (await res.json()) as { ok: boolean; issues: { message: string }[] };
      setValidation({ ok: json.ok, issues: (json.issues ?? []).map((i) => i.message) });
      return json;
    } catch (err) {
      setValidation({ ok: false, issues: ['composer service unavailable'] });
      return null;
    }
  }, [nodes, edges]);

  const palette = useMemo(() => PALETTE, []);

  return (
    <div
      role="application"
      aria-label="Skill composer canvas"
      style={{ width: '100%', height: '100%', minHeight: 480, position: 'relative' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: true, style: { strokeWidth: 1.5 } }}
        connectionLineStyle={{ stroke: '#a855f7' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#3f3f46"
        />
        <Controls
          position="bottom-right"
          style={{ background: '#18181b', borderRadius: 8, border: '1px solid #27272a' }}
        />
        <MiniMap
          nodeColor={(n) => {
            const kind = (n.data as SkillComposerNodeData | undefined)?.kind;
            if (kind === 'prompt') return '#06b6d4';
            if (kind === 'read') return '#3b82f6';
            if (kind === 'action') return '#f97316';
            if (kind === 'condition') return '#eab308';
            if (kind === 'transform') return '#a855f7';
            if (kind === 'approval') return '#ef4444';
            if (kind === 'envelope') return '#10b981';
            return '#52525b';
          }}
          style={{ background: '#18181b', border: '1px solid #27272a' }}
        />
        <Panel position="top-left">
          <div
            role="region"
            aria-label="Composer palette"
            style={{
              background: 'rgba(17, 19, 26, 0.92)',
              border: '1px solid #27272a',
              borderRadius: 10,
              padding: 12,
              minWidth: 200,
              color: '#e4e4e7',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#a1a1aa' }}>
              PALETTE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {palette.map((p) => (
                <button
                  key={p.kind}
                  type="button"
                  aria-label={`Add ${p.label} node`}
                  onClick={() => handleAdd(p.kind)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #3f3f46',
                    background: '#0f1014',
                    color: '#e4e4e7',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{p.label}</span>
                  <div style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>
                    {p.description}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#a1a1aa' }}>
              MODE
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {(['chat', 'workflow'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  aria-label={`Switch to ${m} mode`}
                  onClick={() => {
                    setMode(m);
                    emitChange(nodes, edges);
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: mode === m ? '1px solid #a855f7' : '1px solid #3f3f46',
                    background: mode === m ? '#a855f722' : '#0f1014',
                    color: '#e4e4e7',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </Panel>
        <Panel position="bottom-left">
          <div
            role="status"
            aria-live="polite"
            style={{
              background: 'rgba(17, 19, 26, 0.92)',
              border: `1px solid ${validation.ok ? '#10b981' : '#ef4444'}`,
              borderRadius: 10,
              padding: 10,
              maxWidth: 360,
              color: '#e4e4e7',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
              {validation.ok ? 'Graph OK' : `${validation.issues.length} validation issue(s)`}
            </div>
            {!validation.ok && validation.issues.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#f87171' }}>
                {validation.issues.slice(0, 6).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              onClick={() => void validate()}
              aria-label="Validate composer graph"
              style={{
                marginTop: 6,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #a855f7',
                background: '#a855f722',
                color: '#e4e4e7',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Validate
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function serializeGraph(
  nodes: Node<SkillComposerNodeData>[],
  edges: Edge[],
): unknown {
  return {
    mode: 'workflow',
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      label: n.data.label,
      config: {
        toolKey: n.data.toolKey,
        effect: n.data.effect,
      },
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
}

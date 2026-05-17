'use client';

/**
 * ReactFlowBuilder — Visual workflow editor
 * O principle: canvas capabilities are extended via node types registry, not by editing this component
 * Uses ReactFlow v11 (reactflow package)
 */

import { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkflowInput {
  id: string;
  name: string;
  steps?: unknown[];
}

interface Props {
  workflow: WorkflowInput | null;
  onSave: () => void;
}

// ─── Node type registry (O — add new node types here) ─────────────────────────
const NODE_TYPES_CONFIG = [
  { type: 'trigger',  label: 'Trigger',   color: '#6366f1' },
  { type: 'agent',    label: 'Agent',     color: '#8b5cf6' },
  { type: 'decision', label: 'Decision',  color: '#f59e0b' },
  { type: 'tool',     label: 'Tool Call', color: '#06b6d4' },
  { type: 'output',   label: 'Output',    color: '#22c55e' },
] as const;

type NodeType = typeof NODE_TYPES_CONFIG[number]['type'];

// ─── Custom dark node style ───────────────────────────────────────────────────
const nodeStyle = (color: string): React.CSSProperties => ({
  background: '#1c1c23',
  border: `1px solid ${color}`,
  borderRadius: 10,
  padding: '8px 14px',
  color: '#e4e4e7',
  fontSize: 12,
  fontFamily: 'Inter, sans-serif',
  minWidth: 120,
  boxShadow: `0 0 0 0px ${color}`,
});

function makeNode(type: NodeType, position: { x: number; y: number }, label?: string): Node {
  const cfg = NODE_TYPES_CONFIG.find((n) => n.type === type)!;
  return {
    id: `${type}-${Date.now()}`,
    type: 'default',
    position,
    data: { label: label ?? cfg.label },
    style: nodeStyle(cfg.color),
  };
}

const INITIAL_NODES: Node[] = [
  makeNode('trigger',  { x: 50,  y: 100 }, 'Start'),
  makeNode('agent',    { x: 280, y: 100 }, 'Agent Step'),
  makeNode('output',   { x: 510, y: 100 }, 'Complete'),
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: INITIAL_NODES[0].id, target: INITIAL_NODES[1].id, animated: true, style: { stroke: '#6366f1' } },
  { id: 'e2', source: INITIAL_NODES[1].id, target: INITIAL_NODES[2].id, animated: false, style: { stroke: '#22c55e' } },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReactFlowBuilder({ workflow, onSave }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(workflow?.name ?? 'New Workflow');

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds: Edge[]) =>
        addEdge({ ...params, animated: true, style: { stroke: '#8b5cf6' } }, eds),
      ),
    [setEdges],
  );

  function addNode(type: NodeType) {
    const newNode = makeNode(type, {
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 200,
    });
    setNodes((nds: Node[]) => nds.concat(newNode));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const steps = nodes.map((n, i) => ({
        id: n.id,
        name: String(n.data?.label ?? `Step ${i + 1}`),
        type: 'AGENT',
        order: i,
        config: {},
      }));

      if (workflow?.id) {
        await api.patch(`/workflows/${workflow.id}`, { name, steps });
      } else {
        await api.post('/workflows', { name, steps, isActive: false });
      }
      onSave();
    } catch (e) {
      console.error('Save failed', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0f0f14]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-border bg-surface-raised">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 max-w-xs rounded-lg border border-surface-border bg-surface-overlay px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 transition"
          placeholder="Workflow name"
        />
        {/* Node type palette */}
        <div className="flex gap-1.5">
          {NODE_TYPES_CONFIG.map((cfg) => (
            <button
              key={cfg.type}
              onClick={() => addNode(cfg.type)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition hover:opacity-80"
              style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}
            >
              + {cfg.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          deleteKeyCode="Delete"
          className="react-flow-dark"
        >
          <Background variant={BackgroundVariant.Dots} color="#27272a" gap={20} size={1} />
          <Controls className="react-flow-controls-dark" />
          <MiniMap
            nodeColor={(n: Node) => {
              const style = n.style as React.CSSProperties | undefined;
              return (style?.borderColor as string) ?? '#6366f1';
            }}
            maskColor="#0f0f1488"
            className="react-flow-minimap-dark"
          />
          <Panel position="bottom-center">
            <p className="text-xs text-zinc-600 bg-surface rounded px-2 py-1">
              Connect nodes by dragging between handles · Delete key removes selected
            </p>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

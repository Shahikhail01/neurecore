"use client";

/**
 * Visual Workflow Canvas — Phase 2.2
 * Uses reactflow v11 API (the version installed in this workspace).
 * Node types: trigger, agent_task, condition, done.
 * Canvas state is saved as `config.canvasState` on the workflow record.
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, Plus, Save, Zap } from "lucide-react";
import api from "@/services/api";

// ─── Node type colours ───────────────────────────────────────────────────────

const nodeStyle = (color: string) =>
  ({
    background: `${color}15`,
    border: `1px solid ${color}55`,
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 12,
    color: "#e2e8f0",
    minWidth: 140,
  }) as React.CSSProperties;

// ─── Custom node components ──────────────────────────────────────────────────

function TriggerNode({ data }: { data: { label: string } }) {
  return (
    <div style={nodeStyle("#10b981")}>
      <div className="text-[10px] text-emerald-400 font-semibold mb-0.5">
        TRIGGER
      </div>
      <div>{data.label}</div>
    </div>
  );
}

function AgentTaskNode({ data }: { data: { label: string } }) {
  return (
    <div style={nodeStyle("#8b5cf6")}>
      <div className="text-[10px] text-violet-400 font-semibold mb-0.5">
        AGENT TASK
      </div>
      <div>{data.label}</div>
    </div>
  );
}

function ConditionNode({ data }: { data: { label: string } }) {
  return (
    <div style={nodeStyle("#f59e0b")}>
      <div className="text-[10px] text-amber-400 font-semibold mb-0.5">
        CONDITION
      </div>
      <div>{data.label}</div>
    </div>
  );
}

function DoneNode({ data }: { data: { label: string } }) {
  return (
    <div style={nodeStyle("#64748b")}>
      <div className="text-[10px] text-slate-400 font-semibold mb-0.5">
        DONE
      </div>
      <div>{data.label}</div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  agent_task: AgentTaskNode,
  condition: ConditionNode,
  done: DoneNode,
};

// ─── Initial canvas state ────────────────────────────────────────────────────

const initialNodes: Node[] = [
  {
    id: "trigger-0",
    type: "trigger",
    position: { x: 250, y: 50 },
    data: { label: "Workflow Start" },
  },
  {
    id: "done-0",
    type: "done",
    position: { x: 250, y: 300 },
    data: { label: "Workflow End" },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e-trigger-done",
    source: "trigger-0",
    target: "done-0",
    animated: true,
  },
];

// ─── Node-type menu entries ──────────────────────────────────────────────────

const NODE_PALETTE = [
  { type: "agent_task", label: "Agent Task", color: "#8b5cf6" },
  { type: "condition", label: "Condition", color: "#f59e0b" },
  { type: "done", label: "Done", color: "#64748b" },
] as const;

// ─── Page component ──────────────────────────────────────────────────────────

export default function NewWorkflowCanvasPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nodeCounter = useRef(1);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const addNode = (type: string, label: string) => {
    const id = `${type}-${nodeCounter.current++}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type,
        position: {
          x: 100 + Math.random() * 300,
          y: 150 + Math.random() * 200,
        },
        data: { label },
      },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const canvasState = { nodes, edges };
      const definition = {
        steps: nodes
          .filter((n) => n.type === "agent_task")
          .map((n) => ({ id: n.id, name: n.data.label })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
      };
      await api.post("/workflows", {
        name: name.trim(),
        description: description.trim() || undefined,
        definition,
        config: { canvasState },
      });
      router.push("/workflows");
    } catch {
      setError("Failed to save workflow. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--surface-border)] flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Zap className="w-4 h-4 text-violet-400" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workflow name…"
          className="flex-1 bg-transparent text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-56 text-xs px-2 py-1 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-secondary)] focus:outline-none focus:border-violet-500"
        />
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          onClick={handleSave}
          disabled={loading || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs text-white font-medium transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {loading ? "Saving…" : "Save"}
        </button>
      </div>

      {/* ── Canvas + Palette ── */}
      <div className="flex flex-1 min-h-0">
        {/* Node Palette */}
        <div className="w-44 flex-shrink-0 border-r border-[var(--surface-border)] p-3 space-y-2 overflow-y-auto">
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Add Node
          </p>
          {NODE_PALETTE.map((entry) => (
            <button
              key={entry.type}
              onClick={() => addNode(entry.type, entry.label)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-[var(--text-primary)] bg-[var(--surface-overlay)] border border-[var(--surface-border)] hover:border-violet-500/50 transition-colors"
            >
              <Plus className="w-3 h-3" style={{ color: entry.color }} />
              {entry.label}
            </button>
          ))}
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 bg-[#0d0d14]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#1e293b"
            />
            <Controls className="react-flow__controls--dark" />
            <MiniMap
              nodeColor={(n) => {
                const t = n.type;
                if (t === "trigger") return "#10b981";
                if (t === "agent_task") return "#8b5cf6";
                if (t === "condition") return "#f59e0b";
                return "#64748b";
              }}
              style={{ background: "#1e293b" }}
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

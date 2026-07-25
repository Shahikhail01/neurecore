'use client';

/**
 * BrainMapCanvas — Animated Platform Brain Visualization
 *
 * S: graph layout + animation in one canvas; controls in separate panel
 * D: data via api service; animation state via useBrainMapAnimations hook
 *
 * Animations:
 *  - Pulse ring on agents running tasks
 *  - Thinking spinner inside node during reasoning
 *  - Animated dashed flow-edges between agents passing tasks
 *  - Error glow on failed agents
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Graph } from '@visx/network';
import api from '@/services/api';
import { useInspectorStore } from '@/stores/inspectorStore';
import { useBrainMapAnimations, type AgentAnimState } from '@/hooks/useBrainMapAnimations';
import { unwrapArrayOrEmpty } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GraphNode {
  id: string;
  label: string;
  type: 'tenant' | 'department' | 'agent';
  status?: string;
  x: number;
  y: number;
  color: string;
  r: number;
}

interface GraphLink {
  source: GraphNode;
  target: GraphNode;
}

// Node colors by type
const NODE_COLOR: Record<GraphNode['type'], string> = {
  tenant:     '#6366f1',
  department: '#8b5cf6',
  agent:      '#06b6d4',
};

const NODE_RADIUS: Record<GraphNode['type'], number> = {
  tenant:     22,
  department: 16,
  agent:      10,
};

function agentStatusColor(status?: string): string {
  switch (status) {
    case 'RUNNING': return '#22c55e';
    case 'ERROR':   return '#ef4444';
    case 'PAUSED':  return '#f59e0b';
    case 'IDLE':    return '#71717a';
    default:        return '#06b6d4';
  }
}

// ─── Force-like layout ────────────────────────────────────────────────────────
function buildGraph(
  tenants: { id: string; name: string }[],
  agents: { id: string; name: string; status?: string; departmentId?: string; tenantId?: string; department?: { id: string; name: string; tenantId?: string } }[],
  width: number,
  height: number,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeMap = new Map<string, GraphNode>();

  const cx = width / 2;
  const cy = height / 2;
  const tenantRadius = Math.min(cx, cy) * 0.55;

  // Place tenants in a circle
  tenants.forEach((t, i) => {
    const angle = (i / Math.max(tenants.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const node: GraphNode = {
      id: t.id,
      label: t.name,
      type: 'tenant',
      x: cx + tenantRadius * Math.cos(angle),
      y: cy + tenantRadius * Math.sin(angle),
      color: NODE_COLOR.tenant,
      r: NODE_RADIUS.tenant,
    };
    nodes.push(node);
    nodeMap.set(t.id, node);
  });

  // Collect unique departments
  const deptSet = new Map<string, { id: string; name: string; tenantId?: string }>();
  for (const a of agents) {
    if (a.department) deptSet.set(a.department.id, { ...a.department, tenantId: a.department.tenantId });
    if (a.departmentId && !deptSet.has(a.departmentId)) deptSet.set(a.departmentId, { id: a.departmentId, name: 'Dept', tenantId: a.tenantId });
  }

  // Place departments near parent tenant
  Array.from(deptSet.values()).forEach((d, i) => {
    const parentNode = nodeMap.get(d.tenantId ?? '');
    const px = parentNode?.x ?? cx;
    const py = parentNode?.y ?? cy;
    const angle = (i / Math.max(deptSet.size, 1)) * 2 * Math.PI;
    const r = 80;
    const node: GraphNode = {
      id: d.id,
      label: d.name,
      type: 'department',
      x: px + r * Math.cos(angle),
      y: py + r * Math.sin(angle),
      color: NODE_COLOR.department,
      r: NODE_RADIUS.department,
    };
    nodes.push(node);
    nodeMap.set(d.id, node);
    if (parentNode) links.push({ source: parentNode, target: node });
  });

  // Place agents near parent dept
  agents.slice(0, 60).forEach((a, i) => {
    const parentId = a.departmentId ?? a.tenantId ?? '';
    const parentNode = nodeMap.get(parentId);
    const px = parentNode?.x ?? cx + (Math.random() - 0.5) * 300;
    const py = parentNode?.y ?? cy + (Math.random() - 0.5) * 300;
    const angle = (i * 37.5 * Math.PI) / 180; // golden angle spread
    const r = 45 + Math.random() * 20;
    const node: GraphNode = {
      id: a.id,
      label: a.name,
      type: 'agent',
      x: Math.max(20, Math.min(width - 20, px + r * Math.cos(angle))),
      y: Math.max(20, Math.min(height - 20, py + r * Math.sin(angle))),
      color: a.status === 'RUNNING' || a.status === 'ACTIVE' ? '#22c55e' : NODE_COLOR.agent,
      r: NODE_RADIUS.agent,
    };
    nodes.push(node);
    nodeMap.set(a.id, node);
    if (parentNode) links.push({ source: parentNode, target: node });
  });

  return { nodes, links };
}

// ─── Animated sub-components ─────────────────────────────────────────────────

interface AgentNodeProps {
  node: GraphNode;
  hovered: boolean;
  animState?: AgentAnimState;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}

function AgentNode({ node, hovered, animState, onHover, onLeave, onClick }: AgentNodeProps) {
  const isPulsing  = animState?.pulse    ?? false;
  const isThinking = animState?.thinking ?? false;
  const isError    = animState?.error    ?? false;
  const r          = hovered ? node.r * 1.3 : node.r;
  const fill       = isError ? '#ef4444' : node.color;

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      style={{ cursor: 'pointer' }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {/* Error glow */}
      {isError && (
        <circle
          r={r + 6}
          fill="none"
          stroke="#ef4444"
          strokeWidth={3}
          strokeOpacity={0.5}
          style={{ animation: 'brainError 1.2s ease-in-out infinite' }}
        />
      )}

      {/* Pulse ring(s) */}
      {isPulsing && !isError && (
        <>
          <circle
            r={r + 8}
            fill="none"
            stroke={fill}
            strokeWidth={1.5}
            strokeOpacity={0.6}
            style={{ animation: 'brainPulse 1.4s ease-out infinite' }}
          />
          <circle
            r={r + 4}
            fill="none"
            stroke={fill}
            strokeWidth={1}
            strokeOpacity={0.4}
            style={{ animation: 'brainPulse 1.4s ease-out infinite 0.35s' }}
          />
        </>
      )}

      {/* Main body */}
      <circle
        r={r}
        fill={fill}
        fillOpacity={0.85}
        stroke={hovered ? '#fff' : `${fill}88`}
        strokeWidth={hovered ? 2 : 1}
        style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
      />

      {/* Thinking spinner */}
      {isThinking && (
        <circle
          cx={0}
          cy={0}
          r={r * 0.55}
          fill="none"
          stroke="#fff"
          strokeWidth={1.5}
          strokeDasharray={`${r * 2} ${r * 1.5}`}
          strokeOpacity={0.8}
          style={{ animation: 'brainSpin 0.9s linear infinite', transformOrigin: '0 0' }}
        />
      )}

      {/* Label */}
      {hovered && (
        <text
          textAnchor="middle"
          dy={r + 12}
          fill="#d4d4d8"
          fontSize={9}
          fontFamily="Inter, sans-serif"
          pointerEvents="none"
        >
          {node.label.slice(0, 16)}
        </text>
      )}
    </g>
  );
}

interface GraphEdgeProps {
  link: GraphLink;
  animated: boolean;
}

function GraphEdge({ link, animated }: GraphEdgeProps) {
  return (
    <line
      x1={link.source.x}
      y1={link.source.y}
      x2={link.target.x}
      y2={link.target.y}
      stroke={animated ? '#6366f1' : '#3f3f46'}
      strokeWidth={animated ? 1.5 : 1}
      strokeOpacity={animated ? 0.8 : 0.5}
      strokeDasharray={animated ? '4 4' : undefined}
      style={animated ? { animation: 'dashFlow 0.6s linear infinite' } : undefined}
    />
  );
}

// ─── Canvas component ─────────────────────────────────────────────────────────
export default function BrainMapCanvas() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const openInspector = useInspectorStore((s) => s.openInspector);

  const [size, setSize]       = useState({ width: 900, height: 600 });
  const [graph, setGraph]     = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hideIdle, setHideIdle]   = useState(false);

  // Animation states managed by useBrainMapAnimations hook
  const [animStates, setAnimStates] = useState<Map<string, AgentAnimState>>(new Map());

  const handleAnimUpdate = useCallback((agentId: string, patch: Partial<AgentAnimState>) => {
    setAnimStates((prev) => {
      const next = new Map(prev);
      const current = next.get(agentId) ?? { pulse: false, thinking: false, error: false, flowEdges: [] };
      next.set(agentId, { ...current, ...patch });
      return next;
    });
  }, []);

  useBrainMapAnimations(handleAnimUpdate);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    });
    ro.observe(el);
    setSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // Load data
  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantRes, agentRes] = await Promise.all([
        api.get<{ data: { data: { id: string; name: string }[] } }>('/tenants?limit=20'),
        api.get<{ data: { data: unknown[] } }>('/agents?limit=60'),
      ]);
      const tenants = unwrapArrayOrEmpty(tenantRes);
      const agents = unwrapArrayOrEmpty(agentRes);
      setGraph(buildGraph(tenants, agents, size.width, size.height));
    } catch {
      setGraph({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  }, [size.width, size.height]);

  useEffect(() => { void loadGraph(); }, [loadGraph]);

  // Derive visible graph (optionally hide idle agents)
  const visibleGraph = hideIdle
    ? {
        nodes: graph.nodes.filter((n) => n.type !== 'agent' || n.color !== NODE_COLOR.agent),
        links: graph.links.filter(
          (l) =>
            l.source.type !== 'agent' ||
            l.source.color !== NODE_COLOR.agent,
        ),
      }
    : graph;

  // Active flow edges set
  const activeFlowEdgeSet = new Set<string>();
  animStates.forEach((state, agentId) => {
    state.flowEdges?.forEach((targetId) => {
      activeFlowEdgeSet.add(`${agentId}→${targetId}`);
    });
  });

  const isFlowEdge = (link: GraphLink) =>
    activeFlowEdgeSet.has(`${link.source.id}→${link.target.id}`) ||
    activeFlowEdgeSet.has(`${link.target.id}→${link.source.id}`);

  return (
    <>
      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes brainPulse {
          0%   { opacity: 0.8; r: 0; }
          100% { opacity: 0;   }
        }
        @keyframes brainError {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1;   }
        }
        @keyframes brainSpin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes dashFlow {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -8; }
        }
      `}</style>

      <div ref={containerRef} className="w-full h-full relative brain-map-canvas">
        {/* Legend + controls */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-3 bg-surface-overlay/90 rounded-lg px-3 py-2 border border-surface-border">
          {Object.entries(NODE_COLOR).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-xs text-zinc-400 capitalize">{type}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
            <span className="text-xs text-zinc-400">Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
            <span className="text-xs text-zinc-400">Error</span>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <button
            onClick={() => setHideIdle((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs transition ${
              hideIdle
                ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/20 text-indigo-300'
                : 'border-surface-border bg-surface-overlay text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {hideIdle ? 'Show all' : 'Hide idle'}
          </button>
          <button
            onClick={() => void loadGraph()}
            className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface-overlay text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
            Building graph…
          </div>
        ) : visibleGraph.nodes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
            No data — deploy some employees first
          </div>
        ) : (
          <svg width={size.width} height={size.height}>
            <Graph<GraphLink, GraphNode>
              graph={visibleGraph}
              linkComponent={({ link }) => (
                <GraphEdge link={link} animated={isFlowEdge(link)} />
              )}
              nodeComponent={({ node }) =>
                node.type === 'agent' ? (
                  <AgentNode
                    key={node.id}
                    node={node}
                    hovered={hoveredId === node.id}
                    animState={animStates.get(node.id)}
                    onHover={() => setHoveredId(node.id)}
                    onLeave={() => setHoveredId(null)}
                    onClick={() => openInspector('agent', node.id)}
                  />
                ) : (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    style={{ cursor: 'default' }}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <circle
                      r={hoveredId === node.id ? node.r * 1.2 : node.r}
                      fill={node.color}
                      fillOpacity={0.85}
                      stroke={hoveredId === node.id ? '#fff' : `${node.color}88`}
                      strokeWidth={hoveredId === node.id ? 2 : 1}
                      style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
                    />
                    <text
                      textAnchor="middle"
                      dy={node.r + 12}
                      fill="#d4d4d8"
                      fontSize={node.type === 'tenant' ? 11 : 9}
                      fontFamily="Inter, sans-serif"
                      pointerEvents="none"
                    >
                      {node.label.slice(0, 16)}
                    </text>
                  </g>
                )
              }
            />
          </svg>
        )}
      </div>
    </>
  );
}

// ─── UI Type System ───────────────────────────────────────────────────────────
// I — Interface Segregation: each interface covers exactly its domain

export type StatusColor = 'profit' | 'risk' | 'ops' | 'strategy' | 'warn' | 'neutral';
export type ChartTimeRange = '1h' | '24h' | '7d' | '30d' | '90d';

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
export interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: number;        // % change from previous period (positive = up)
  deltaLabel?: string;   // e.g. "vs last 7d"
  color: StatusColor;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
export type AgentCardVariant = 'compact' | 'full' | 'inspector';
export type AgentCardAction = 'pause' | 'resume' | 'retrain' | 'audit' | 'inspect' | 'delete';

export interface AgentCardProps {
  agent: AgentCardData;
  variant?: AgentCardVariant;
  onAction?: (action: AgentCardAction, id: string) => void;
  selected?: boolean;
  className?: string;
}

export interface AgentCardData {
  id: string;
  name: string;
  role?: string;
  type: string;
  status: string;
  workloadPct?: number;     // 0–100
  workload?: number;        // alias for workloadPct (used in page mappers)
  successRate?: number;     // 0–100
  costToday?: number;
  tasksToday?: number;
  taskCount?: number;       // raw task count
  budgetUsed?: number;      // amount used from budget
  budgetTotal?: number;     // total budget limit
  tenantName?: string;      // admin portal only
  lastActiveAt?: string;
  department?: string;      // department name for display
  model?: string;           // LLM model identifier
  updatedAt?: string;       // ISO timestamp of last update
}

// ─── Charts ───────────────────────────────────────────────────────────────────
// L — Liskov: all chart components fulfil this contract and are substitutable
export interface ChartProps<T = Record<string, unknown>> {
  data: T[];
  loading?: boolean;
  height?: number;
  className?: string;
  timeRange?: ChartTimeRange;
}

export interface TimeSeriesPoint {
  ts: string;       // ISO timestamp
  value: number;
  label?: string;
}

export interface MultiSeriesPoint {
  ts: string;
  [key: string]: number | string;
}

export interface BarDataPoint {
  label: string;
  value: number;
  color?: string;
}

// ─── Inspector Panel ──────────────────────────────────────────────────────────
export type InspectorType = 'agent' | 'task' | 'workflow' | 'department' | 'tenant';

export interface InspectorState {
  open: boolean;
  type: InspectorType | null;
  id: string | null;
}

// ─── Command Palette ─────────────────────────────────────────────────────────
export interface Command {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
}

// ─── Activity Stream ─────────────────────────────────────────────────────────
export interface ActivityEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'agent' | 'task' | 'workflow' | 'system' | 'approval';
  severity: 'info' | 'success' | 'warn' | 'error';
}

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────
export interface DashboardKpis {
  activeAgents: number;
  activeAgentsDelta?: number;
  runningTasks: number;
  runningTasksDelta?: number;
  completedToday: number;
  completedTodayDelta?: number;
  activeWorkflows: number;
  successRate?: number;
  successRateDelta?: number;
  costToday?: number;
  totalTasks?: number;
  failedTasks?: number;
  avgCostPerTask?: number;
}

// ─── Status helpers ───────────────────────────────────────────────────────────
export const STATUS_COLOR_MAP: Record<string, StatusColor> = {
  RUNNING:    'ops',
  ACTIVE:     'profit',
  COMPLETED:  'profit',
  SUCCESS:    'profit',
  IDLE:       'neutral',
  DRAFT:      'neutral',
  PAUSED:     'warn',
  PENDING:    'warn',
  QUEUED:     'warn',
  FAILED:     'risk',
  ERROR:      'risk',
  CANCELLED:  'neutral',
};

export const STATUS_BADGE_CLASS: Record<StatusColor, string> = {
  profit:   'bg-status-profit/15 text-status-profit border border-status-profit/30',
  risk:     'bg-status-risk/15 text-status-risk border border-status-risk/30',
  ops:      'bg-status-ops/15 text-status-ops border border-status-ops/30',
  strategy: 'bg-status-strategy/15 text-status-strategy border border-status-strategy/30',
  warn:     'bg-status-warn/15 text-status-warn border border-status-warn/30',
  neutral:  'bg-surface-muted/40 text-zinc-400 border border-surface-border',
};

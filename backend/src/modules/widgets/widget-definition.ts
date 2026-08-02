/**
 * WidgetDefinition — the 4-layer widget definition schema.
 *
 * Per `EAOS-implementation-plan.md` §3.3. Every Widget is defined by:
 *   Layer 1: Capability   — what business need does it serve?
 *   Layer 2: Data Source  — what data does it need?
 *   Layer 3: Aggregation  — how is the data processed?
 *   Layer 4: Visualization — how is the result shown?
 */

import { IndustryGroupSlug } from '../industry/tier-industry-matrix';

export type WidgetCapability =
  | 'FINANCIAL_PERFORMANCE'
  | 'WORKFORCE_STATUS'
  | 'OPERATIONAL_EFFICIENCY'
  | 'AI_PERFORMANCE'
  | 'RISK_POSTURE'
  | 'CUSTOMER_HEALTH'
  | 'PREDICTIVE_FORECAST'
  | 'DOCUMENT_MANAGEMENT'
  | 'KNOWLEDGE_ACCESS'
  | 'COLLABORATION'
  | 'AUTOMATION_STATUS'
  | 'COMPLIANCE_STATUS'
  | 'INVENTORY_STATUS'
  | 'QUALITY_METRICS';

export type AggregationType =
  | 'SUM'
  | 'AVG'
  | 'COUNT'
  | 'MIN'
  | 'MAX'
  | 'PERCENTAGE'
  | 'RATIO'
  | 'TREND'
  | 'CUSTOM';

export type Visualization =
  | 'CARD'
  | 'LINE_CHART'
  | 'BAR_CHART'
  | 'GAUGE'
  | 'TABLE'
  | 'HEATMAP'
  | 'KANBAN'
  | 'GANTT'
  | 'GRID'
  | 'SPARKLINE'
  | 'PERCENTAGE_BAR'
  | 'STATUS_BADGE';

export type EaosEntityTypeForWidget =
  | 'AGENT'
  | 'DEPARTMENT'
  | 'PROJECT'
  | 'GOAL'
  | 'TASK'
  | 'WORKFLOW'
  | 'ROUTINE'
  | 'KNOWLEDGE'
  | 'INTEGRATION'
  | 'TOOL'
  | 'FACILITY'
  | 'CUSTOMER'
  | 'ASSET'
  | 'VENDOR'
  | 'PROCESS'
  | 'DOCUMENT';

export interface WidgetSize {
  w: number; // grid width (12-col grid → 1-12)
  h: number; // grid height in rows
}

export interface DataSourceRef {
  entity: EaosEntityTypeForWidget;
  field: string;
  requiredPermission?: 'READ' | 'WRITE' | 'ADMIN';
}

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'select' | 'number' | 'text' | 'boolean' | 'dateRange';
  defaultValue: unknown;
  options?: ConfigFieldOption[];
  required?: boolean;
}

export interface WidgetDefinition {
  id: string;

  // Layer 1 — Capability
  capability: WidgetCapability;
  capabilityDomain:
    | 'financial'
    | 'workforce'
    | 'operational'
    | 'ai'
    | 'risk'
    | 'customer'
    | 'predictive'
    | 'document'
    | 'knowledge'
    | 'collaboration'
    | 'automation'
    | 'compliance'
    | 'inventory'
    | 'quality';

  // Layer 2 — Data Source
  dataSources: DataSourceRef[];
  requiredCapabilities?: string[];

  // Layer 3 — Aggregation
  aggregationType: AggregationType;
  aggregationParams?: Record<string, unknown>;
  computation: string;

  // Layer 4 — Visualization
  visualizations: Visualization[];
  defaultVisualization: Visualization;

  // Sizing (per react-grid-layout)
  minSize: WidgetSize;
  maxSize: WidgetSize;
  defaultSize: WidgetSize;

  // Configuration
  configurableFields: ConfigField[];
  refreshInterval: number; // ms; 0 = manual

  // Display
  title: string;
  subtitle?: string;
  icon?: string;

  // EAOS binding
  entityTypes: EaosEntityTypeForWidget[];
  category: 'CORE' | 'CONTEXTUAL' | 'INDUSTRY_SPECIFIC';

  // Phase 7 G2 — when set, this widget is only registered for tenants in
  // the named industry group (e.g. INDUSTRY_GROUP.FINANCIAL_COMPLIANCE).
  // When omitted, the widget is available to every tenant regardless of industry.
  // The runtime filter lives in WidgetRegistry.listForIndustryGroup().
  // PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.1 (R1) — typed against the
  // single-source constant from tier-industry-matrix.ts.
  industryGroup?: IndustryGroupSlug;
}

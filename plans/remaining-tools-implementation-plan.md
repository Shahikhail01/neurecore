# Comprehensive Agent Tools Implementation Plan

## Document Version: 1.0

**Last Updated**: April 4, 2026
**Goal**: Implement all remaining tools needed for 90+ agent templates across 20 departments

---

## Current Status

| Status             | Count | Tools                                                                                                                                                                                                                                                                                                        |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ Implemented     | 21    | Calculator, Database Query, Web Search, Email, Calendar, CRM, Spreadsheet, Document Creation/Summary, Social Media, Knowledge Base, Vector Search, Code Deployment, Alerting, Banking, Maps, HTTP Request, Agent Messaging, Task Management                                                                  |
| 🔴 Not Implemented | ~25   | Analytics Dashboard, Invoice Generation, Budget Tracking, HR Systems API, Google Workspace API, PDF Generation, Report Builder, Code Analysis, Export Tools, Template Engine, Voice Input, Geocoding, SEO Tools, Ad Optimization, System Monitor, Security Scanner, Meeting Scheduler, Workflow Engine, etc. |

---

## Implementation Phases

### Phase 1: Critical (P0) - Blocking 90+ Agents

#### 1. Analytics Dashboard Tool

- **Purpose**: Dashboard metrics, charts, data visualization for Marketing, Sales, Product, HR, Finance
- **Actions**: query_metrics, create_chart, export_dashboard, set_alerts
- **Dependencies**: Database Query (exists), Chart library

#### 2. Invoice Generation Tool

- **Purpose**: Generate invoices for Finance (AP/AR)
- **Actions**: create_invoice, list_invoices, update_invoice, send_invoice, mark_paid
- **Dependencies**: Spreadsheet (exists), PDF Generation

#### 3. Budget Tracking Tool

- **Purpose**: Budget creation, tracking, alerts for Finance
- **Actions**: create_budget, update_budget, track_spending, check_thresholds, get_summary
- **Dependencies**: Database Query (exists), Spreadsheet (exists)

#### 4. HR Systems API Tool

- **Purpose**: HR integration for CHRO, Recruiter agents
- **Actions**: list_candidates, get_candidate, update_candidate, create_offer, onboard_employee
- **Providers**: Workday, BambooHR, Greenhouse (mock)

#### 5. Google Workspace API Tool

- **Purpose**: Google Calendar, Gmail, Docs, Sheets for Administration
- **Actions**: calendar_events, send_email, create_document, create_spreadsheet
- **Providers**: Google API client

---

### Phase 2: High Priority (P1) - Full Functionality

#### 6. PDF Generation Tool

- **Purpose**: Generate PDFs for Legal, Finance, Operations
- **Actions**: create_pdf, convert_html_to_pdf, add_images, add_tables
- **Library**: PDFKit or Puppeteer

#### 7. Report Builder Tool

- **Purpose**: Custom reports for Analytics, BI Analyst
- **Actions**: create_report, add_widgets, schedule_report, export_report
- **Dependencies**: Analytics Dashboard, Export Tools

#### 8. Code Analysis Tool

- **Purpose**: Static code analysis for CTO, DevOps agents
- **Actions**: analyze_code, check_security, get_metrics, suggest_improvements
- **Providers**: SonarQube API, eslint (local)

#### 9. Export Tools (CSV/JSON)

- **Purpose**: Data export for Analytics, Data Engineer
- **Actions**: export_csv, export_json, export_excel, batch_export
- **Dependencies**: Database Query (exists)

#### 10. Template Engine Tool

- **Purpose**: Dynamic template rendering for all departments
- **Actions**: render_template, create_template, list_templates, update_template
- **Template Types**: Email, Document, Report, Invoice

---

### Phase 3: Medium Priority (P2) - Enhanced Capabilities

#### 11. Voice Input/Analytics Tool

- **Purpose**: Voice commands for Executive, Admin
- **Actions**: transcribe_audio, analyze_sentiment, get_keywords
- **Providers**: OpenAI Whisper

#### 12. Geocoding Tool

- **Purpose**: Location services for Logistics, Facilities
- **Actions**: geocode_address, reverse_geocode, get_timezone
- **Providers**: Google Maps API, OpenStreetMap

#### 13. SEO Tools Tool

- **Purpose**: Search optimization for Marketing
- **Actions**: check_rankings, analyze_keywords, get_backlinks, audit_site
- **Providers**: Ahrefs API, SEMrush API, custom

#### 14. Ad Optimization API Tool

- **Purpose**: Paid media optimization for Marketing
- **Actions**: optimize_budget, analyze_campaigns, suggest_bids
- **Providers**: Google Ads API, Facebook Ads API

#### 15. System Monitor Tool

- **Purpose**: System health monitoring for IT
- **Actions**: get_metrics, check_services, get_logs, alert_on_threshold
- **Providers**: Prometheus, Datadog, custom

#### 16. Security Scanner Tool

- **Purpose**: Security monitoring for IT
- **Actions**: scan_vulnerabilities, check_compliance, get_findings
- **Providers**: OWASP, custom

#### 17. Meeting Scheduler Tool

- **Purpose**: Meeting scheduling for Scheduler, Coordinator
- **Actions**: schedule_meeting, find_slots, send_invites, update_meeting
- **Dependencies**: Calendar (exists)

#### 18. Workflow Engine Tool

- **Purpose**: Workflow automation for Task Router
- **Actions**: trigger_workflow, get_status, pause_workflow, resume_workflow
- **Dependencies**: Existing workflow module

---

## Implementation Pattern (SOLID)

All tools follow this pattern:

```typescript
/**
 * [ToolName] Tool - N of remaining tools
 * Enables AI agents to [purpose]
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for [domain] operations
 * - OCP: Extensible via provider interfaces
 * - DIP: Depends on abstractions for [channel/system]
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// Input Schema
export const [ToolName]InputSchema = z.object({ ... });

// Output Schema
export const [ToolName]OutputSchema = z.object({ ... });

// Provider Interface (DIP)
interface I[Provider]Provider {
  [method](options: ...): Promise<...>;
}

// Implementation
@Injectable()
class [Provider]Provider implements I[Provider]Provider { ... }

@Injectable()
export class [ToolName]Tool extends BaseStructuredTool {
  readonly name = '[tool-name]';
  readonly description = '...';
  readonly category = ToolCategory.[CATEGORY];
  readonly inputSchema = [ToolName]InputSchema;

  constructor(private readonly config: ConfigService) { ... }

  protected async executeImpl(...): Promise<StructuredToolResult<unknown>> {
    // Implementation
  }
}
```

---

## Registration Steps

For each new tool:

1. **Create file**: `backend/src/modules/tools/built-in/[tool-name].tool.ts`
2. **Update module**: Add import and provider in `tools.module.ts`
3. **Update initializer**: Add constructor parameter and registry.register() in `tools-initializer.service.ts`
4. **Verify build**: Run `pnpm run build` - must pass with 0 errors
5. **Verify lint**: Run `pnpm run lint` - must pass with 0 errors

---

## Priority Implementation Order

| Priority | Tool                 | File to Create              | Module Update | Initializer Update |
| -------- | -------------------- | --------------------------- | ------------- | ------------------ |
| P0       | Analytics Dashboard  | analytics-dashboard.tool.ts | ✅            | ✅                 |
| P0       | Invoice Generation   | invoice-generation.tool.ts  | ✅            | ✅                 |
| P0       | Budget Tracking      | budget-tracking.tool.ts     | ✅            | ✅                 |
| P0       | HR Systems API       | hr-systems.tool.ts          | ✅            | ✅                 |
| P0       | Google Workspace API | google-workspace.tool.ts    | ✅            | ✅                 |
| P1       | PDF Generation       | pdf-generation.tool.ts      | ✅            | ✅                 |
| P1       | Report Builder       | report-builder.tool.ts      | ✅            | ✅                 |
| P1       | Code Analysis        | code-analysis.tool.ts       | ✅            | ✅                 |
| P1       | Export Tools         | export-tools.tool.ts        | ✅            | ✅                 |
| P1       | Template Engine      | template-engine.tool.ts     | ✅            | ✅                 |
| P2       | Voice Input          | voice-input.tool.ts         | ✅            | ✅                 |
| P2       | Geocoding            | geocoding.tool.ts           | ✅            | ✅                 |
| P2       | SEO Tools            | seo-tools.tool.ts           | ✅            | ✅                 |
| P2       | Ad Optimization      | ad-optimization.tool.ts     | ✅            | ✅                 |
| P2       | System Monitor       | system-monitor.tool.ts      | ✅            | ✅                 |
| P2       | Security Scanner     | security-scanner.tool.ts    | ✅            | ✅                 |
| P2       | Meeting Scheduler    | meeting-scheduler.tool.ts   | ✅            | ✅                 |
| P2       | Workflow Engine      | workflow-engine.tool.ts     | ✅            | ✅                 |

---

## Quality Requirements

1. **Zero TypeScript Errors**: All code must compile without errors
2. **Zero ESLint Errors**: All code must pass linting
3. **SOLID Compliance**: Each tool follows single responsibility, open/closed, dependency inversion
4. **Zod Validation**: All inputs validated with Zod schemas
5. **Provider Pattern**: External integrations use provider interfaces
6. **Error Handling**: All tools handle errors gracefully with proper error messages
7. **Logging**: All tools use NestJS Logger for debugging
8. **Documentation**: JSDoc comments explain purpose and usage
9. **Unit Tests**: Each tool should have test coverage (where feasible)

---

## Start Implementation

Begin with P0 tools in order:

1. Analytics Dashboard Tool
2. Invoice Generation Tool
3. Budget Tracking Tool
4. HR Systems API Tool
5. Google Workspace API Tool

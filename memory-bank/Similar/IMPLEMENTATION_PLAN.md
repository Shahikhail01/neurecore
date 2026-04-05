# NeureCore — Competitive Feature Implementation Plan

**Authored**: 2026-04-05  
**Source Analysis**: `similar-concept.md` — Competitive audit against Dust, Relevance AI, StackAI, Viktor, Creatio, Retool  
**Architecture**: NestJS 11 / Next.js 15 / Prisma / LangGraph / pgvector / Neon / Upstash  
**Standards**: Full SOLID compliance · Zero TS/lint errors · No over-engineering

---

## Codebase Audit Summary

### Already Implemented ✅

| Feature                                                 | Location                                        |
| ------------------------------------------------------- | ----------------------------------------------- |
| LangGraph HITL execution with MemorySaver               | `backend/src/modules/agents/langgraph/`         |
| Agent evaluator (LLM + heuristic scoring)               | `agents/services/agent-evaluator.service.ts`    |
| Cost tracking infrastructure (CostRecord, BudgetPolicy) | `modules/costs/`                                |
| Security interceptor (prompt injection, SSRF guards)    | `agents/security/`                              |
| Memory module (SHORT/LONG/EPISODIC + pgvector)          | `modules/memory/`                               |
| Governance rules + Approvals HITL                       | `modules/governance/`                           |
| Multi-tenant tier system (Starter/Pro/Enterprise)       | `modules/tiers/`                                |
| OAuth connectors (Google, HubSpot)                      | `modules/connectors/`                           |
| 50 built-in tools in registry                           | `modules/tools/built-in/`                       |
| Analytics + Observability modules                       | `modules/analytics/`, `modules/observability/`  |
| Workspace provisioning (Google/M365)                    | `modules/workspace-provisioning/`               |
| Routines/Scheduler module (backend)                     | `modules/routines/`                             |
| Projects + Goals module                                 | `modules/projects/`, `modules/goals/`           |
| Finance / Invoices / Expenses                           | `modules/finance/`                              |
| Full 9-step onboarding wizard                           | `modules/onboarding/` + `frontend-tenant`       |
| OpenTelemetry + LangSmith tracing                       | `modules/ai-gateway/`                           |
| Chat module (conversational AI)                         | `modules/chat/`                                 |
| OpenClaw webhook adapter                                | `modules/ai-gateway/openclaw-adapter.module.ts` |

### Missing / Priority Gaps ❌ (from similar-concept.md)

| #   | Feature                                             | Priority             | Effort |
| --- | --------------------------------------------------- | -------------------- | ------ |
| 1   | Agent Version Control + Rollback                    | **P0 — critical**    | M      |
| 2   | PII Detection + Masking Middleware                  | **P0 — compliance**  | M      |
| 3   | Per-agent Cost Dashboard (UI)                       | **P0 — trust**       | S      |
| 4   | Agent Staging Environment + Eval Runs               | **P1**               | L      |
| 5   | Visual Workflow Canvas (drag-and-drop)              | **P1 — UX flagship** | L      |
| 6   | Supervisor-Worker Agent Orchestration               | **P1**               | M      |
| 7   | Department-Scoped Knowledge Spaces                  | **P1**               | M      |
| 8   | Tenant Maturity Indicator (L1→L4 roadmap)           | **P2**               | S      |
| 9   | Rich Artifact Outputs (PDF / CSV / Chart)           | **P2**               | M      |
| 10  | Proactive/Scheduled Runs — Frontend Wiring          | **P2**               | S      |
| 11  | Industry-Specific Agent Packs (GTM/Support/Finance) | **P2**               | M      |
| 12  | SCIM Provisioning + Enterprise SSO                  | **P3**               | L      |
| 13  | Natural Language → Admin UI Generator               | **P3**               | XL     |

---

## Implementation Phases

```
Phase 1 (P0 — Foundation & Trust)      → Items 1, 2, 3
Phase 2 (P1 — Execution & UX Flagship) → Items 4, 5, 6, 7
Phase 3 (P2 — Enterprise Experience)   → Items 8, 9, 10, 11
Phase 4 (P3 — Enterprise Sales Unlock) → Items 12, 13
```

Each phase is independently deployable. All implementation follows:

- **S**RP — each class/service has one reason to change
- **O**CP — new behaviour via extension (interfaces + DI tokens), not mutation
- **L**SP — all concrete classes fully satisfy their interface contracts
- **I**SP — fine-grained interfaces, no fat contracts
- **D**IP — services depend on abstractions; concrete classes injected via DI

---

## PHASE 1 — Foundation & Trust

### Feature 1.1 — Agent Version Control + Rollback

**Why now**: Immediate trust signal. Enterprise buyers demand audit trails and safe rollback.

#### 1.1.1 — Prisma Schema

Add to `backend/prisma/schema.prisma`:

```prisma
// ─── Agent Version ──────────────────────────────────────────────────────────

model AgentVersion {
  id           String   @id @default(uuid())
  agentId      String
  agent        Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  versionNumber Int     // auto-incremented per agent
  label        String?  // human-readable label e.g. "v3 — Added budget constraint"
  configSnapshot Json   // full snapshot: { name, model, systemPrompt, instructions, permissions, config }
  changedBy    String   // userId
  changeNote   String?  @db.Text
  isActive     Boolean  @default(false) // the currently deployed version

  createdAt    DateTime @default(now())

  @@unique([agentId, versionNumber])
  @@index([agentId])
  @@index([tenantId])
  @@map("agent_versions")
}
```

Also add back-relation on `Agent`:

```prisma
versions      AgentVersion[]
```

And back-relation on `Tenant`:

```prisma
agentVersions AgentVersion[]
```

**Migration SQL** (`backend/prisma/migrations/20260405_agent_versions/migration.sql`):

```sql
CREATE TABLE IF NOT EXISTS "agent_versions" (
  "id"             TEXT          NOT NULL PRIMARY KEY,
  "agentId"        TEXT          NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "tenantId"       TEXT          NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "versionNumber"  INTEGER       NOT NULL,
  "label"          TEXT,
  "configSnapshot" JSONB         NOT NULL DEFAULT '{}',
  "changedBy"      TEXT          NOT NULL,
  "changeNote"     TEXT,
  "isActive"       BOOLEAN       NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_versions_agentId_versionNumber_key" UNIQUE ("agentId","versionNumber")
);
CREATE INDEX "agent_versions_agentId_idx" ON "agent_versions"("agentId");
CREATE INDEX "agent_versions_tenantId_idx" ON "agent_versions"("tenantId");
```

Run via Neon SQL console (DB has no `migrate dev` flow — apply raw SQL, then `pnpm prisma generate`).

#### 1.1.2 — Interface (DIP)

File: `backend/src/modules/agents/interfaces/agent-version.interface.ts`

```typescript
export interface IAgentVersionRepository {
  create(input: CreateAgentVersionInput): Promise<AgentVersionDto>;
  findByAgentId(agentId: string, tenantId: string): Promise<AgentVersionDto[]>;
  findActive(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto | null>;
  rollback(
    agentId: string,
    tenantId: string,
    versionNumber: number,
  ): Promise<AgentVersionDto>;
}

export interface CreateAgentVersionInput {
  agentId: string;
  tenantId: string;
  label?: string;
  configSnapshot: Record<string, unknown>;
  changedBy: string;
  changeNote?: string;
}

export interface AgentVersionDto {
  id: string;
  agentId: string;
  versionNumber: number;
  label?: string | null;
  configSnapshot: Record<string, unknown>;
  changedBy: string;
  changeNote?: string | null;
  isActive: boolean;
  createdAt: Date;
}
```

#### 1.1.3 — Repository (SRP + DIP)

File: `backend/src/modules/agents/repositories/prisma-agent-version.repository.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import type {
  IAgentVersionRepository,
  CreateAgentVersionInput,
  AgentVersionDto,
} from "../interfaces/agent-version.interface";

@Injectable()
export class PrismaAgentVersionRepository implements IAgentVersionRepository {
  private readonly logger = new Logger(PrismaAgentVersionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAgentVersionInput): Promise<AgentVersionDto> {
    // Determine next version number in a transaction to avoid race conditions
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.agentVersion.findFirst({
        where: { agentId: input.agentId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const versionNumber = (last?.versionNumber ?? 0) + 1;

      return tx.agentVersion.create({
        data: {
          agentId: input.agentId,
          tenantId: input.tenantId,
          versionNumber,
          label: input.label,
          configSnapshot: input.configSnapshot,
          changedBy: input.changedBy,
          changeNote: input.changeNote,
          isActive: true,
        },
      }) as unknown as AgentVersionDto;
    });
  }

  async findByAgentId(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto[]> {
    return this.prisma.agentVersion.findMany({
      where: { agentId, tenantId },
      orderBy: { versionNumber: "desc" },
    }) as unknown as AgentVersionDto[];
  }

  async findActive(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto | null> {
    return this.prisma.agentVersion.findFirst({
      where: { agentId, tenantId, isActive: true },
      orderBy: { versionNumber: "desc" },
    }) as unknown as AgentVersionDto | null;
  }

  async rollback(
    agentId: string,
    tenantId: string,
    versionNumber: number,
  ): Promise<AgentVersionDto> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.agentVersion.findFirstOrThrow({
        where: { agentId, tenantId, versionNumber },
      });

      // Deactivate all versions for this agent
      await tx.agentVersion.updateMany({
        where: { agentId, tenantId },
        data: { isActive: false },
      });

      // Apply snapshot to agent record
      const snapshot = target.configSnapshot as Record<string, unknown>;
      await tx.agent.update({
        where: { id: agentId },
        data: {
          name: snapshot["name"] as string | undefined,
          model: snapshot["model"] as string | undefined,
          systemPrompt: snapshot["systemPrompt"] as string | undefined,
          instructions: snapshot["instructions"] as string | undefined,
          permissions: snapshot["permissions"] as string | undefined,
          config: snapshot["config"] as string | undefined,
        },
      });

      // Mark target as active
      return tx.agentVersion.update({
        where: { id: target.id },
        data: { isActive: true },
      }) as unknown as AgentVersionDto;
    });
  }
}
```

#### 1.1.4 — Service (SRP)

File: `backend/src/modules/agents/services/agent-version.service.ts`

```typescript
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaAgentVersionRepository } from "../repositories/prisma-agent-version.repository";
import type {
  AgentVersionDto,
  CreateAgentVersionInput,
} from "../interfaces/agent-version.interface";

/**
 * AgentVersionService
 * SRP: Only manages version snapshots — does NOT modify agent config directly.
 * Rollback delegates config application to PrismaAgentVersionRepository.
 */
@Injectable()
export class AgentVersionService {
  private readonly logger = new Logger(AgentVersionService.name);

  constructor(private readonly versionRepo: PrismaAgentVersionRepository) {}

  async snapshotAgent(
    input: CreateAgentVersionInput,
  ): Promise<AgentVersionDto> {
    this.logger.log(
      `Snapshotting agent ${input.agentId} v?+1 by ${input.changedBy}`,
    );
    return this.versionRepo.create(input);
  }

  async listVersions(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto[]> {
    return this.versionRepo.findByAgentId(agentId, tenantId);
  }

  async rollback(
    agentId: string,
    tenantId: string,
    versionNumber: number,
  ): Promise<AgentVersionDto> {
    this.logger.log(`Rolling back agent ${agentId} to v${versionNumber}`);
    const versions = await this.versionRepo.findByAgentId(agentId, tenantId);
    const target = versions.find((v) => v.versionNumber === versionNumber);
    if (!target) {
      throw new NotFoundException(
        `Version ${versionNumber} not found for agent ${agentId}`,
      );
    }
    return this.versionRepo.rollback(agentId, tenantId, versionNumber);
  }
}
```

#### 1.1.5 — DTOs

File: `backend/src/modules/agents/dto/agent-version.dto.ts`

```typescript
import { IsString, IsOptional, IsInt, Min } from "class-validator";

export class CreateAgentVersionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  changeNote?: string;
}

export class RollbackAgentVersionDto {
  @IsInt()
  @Min(1)
  versionNumber!: number;
}
```

#### 1.1.6 — Controller endpoints (added to existing `agents.controller.ts`)

```typescript
// Add to AgentsController — additional endpoints:

@Get(':id/versions')
async listVersions(
  @Param('id') id: string,
  @Request() req: AuthenticatedRequest,
): Promise<AgentVersionDto[]> {
  this.validateTenant(req.user);
  return this.agentVersionService.listVersions(id, req.user.tenantId!);
}

@Post(':id/versions')
async snapshotVersion(
  @Param('id') id: string,
  @Body() dto: CreateAgentVersionDto,
  @Request() req: AuthenticatedRequest,
): Promise<AgentVersionDto> {
  this.validateTenant(req.user);
  const agent = await this.agentsService.findOne(id, req.user.tenantId!);
  return this.agentVersionService.snapshotAgent({
    agentId: id,
    tenantId: req.user.tenantId!,
    label: dto.label,
    changeNote: dto.changeNote,
    changedBy: req.user.id,
    configSnapshot: {
      name: (agent as Record<string, unknown>)['name'],
      model: (agent as Record<string, unknown>)['model'],
      systemPrompt: (agent as Record<string, unknown>)['systemPrompt'],
      instructions: (agent as Record<string, unknown>)['instructions'],
      permissions: (agent as Record<string, unknown>)['permissions'],
      config: (agent as Record<string, unknown>)['config'],
    },
  });
}

@Post(':id/rollback')
async rollbackVersion(
  @Param('id') id: string,
  @Body() dto: RollbackAgentVersionDto,
  @Request() req: AuthenticatedRequest,
): Promise<AgentVersionDto> {
  this.validateTenant(req.user);
  return this.agentVersionService.rollback(id, req.user.tenantId!, dto.versionNumber);
}
```

**Auto-snapshot hook**: In `AgentsService.update()`, after successfully updating an agent, call `agentVersionService.snapshotAgent(...)` so every save creates a new version automatically.

#### 1.1.7 — Frontend (tenant): Agent Version History Panel

File: `frontend-tenant/src/app/(app)/agents/[id]/versions/page.tsx`

```tsx
// Renders a Versions tab in the agent detail page
// Columns: Version #, Label, Changed By, Date, Active badge, Rollback button
// "Roll back to this version" opens confirmation modal → POST /agents/{id}/rollback
// Uses existing `api` service pattern: res.data?.data?.data ?? res.data?.data ?? res.data
```

Key component structure:

- `AgentVersionsPage` — fetches `GET /agents/:id/versions` → renders table
- `RollbackConfirmModal` — controlled dialog, calls `POST /agents/:id/rollback`
- Types: `AgentVersionItem { id, versionNumber, label, changedBy, isActive, createdAt, changeNote }`

**Auto-snapshot on save**: When agent settings form is saved → after successful PATCH → call `POST /agents/:id/versions` with auto-label `"Auto-save: ${new Date().toISOString()}"`.

---

### Feature 1.2 — PII Detection + Masking Middleware

**Why now**: Compliance requirement. Prevents sensitive data from leaking into LLM via tool inputs/outputs.

#### 1.2.1 — Interface (ISP + DIP)

File: `backend/src/modules/agents/security/interfaces/pii.interfaces.ts`

```typescript
export interface IPiiDetector {
  /** Returns detected PII entities from text. Pure detection, no mutation. */
  detect(text: string): PiiEntity[];
}

export interface IPiiMasker {
  /** Returns text with PII masked. Deterministic: same entity → same mask token. */
  mask(text: string, entities: PiiEntity[]): string;
}

export interface PiiEntity {
  type: PiiEntityType;
  value: string;
  start: number;
  end: number;
}

export type PiiEntityType =
  | "EMAIL"
  | "PHONE"
  | "SSN"
  | "CREDIT_CARD"
  | "IP_ADDRESS"
  | "DATE_OF_BIRTH"
  | "FULL_NAME"
  | "PASSPORT"
  | "BANK_ACCOUNT";
```

#### 1.2.2 — RegEx-based PII Detector (OCP — replaceable with ML-based detector later)

File: `backend/src/modules/agents/security/providers/regex-pii-detector.service.ts`

```typescript
import { Injectable } from "@nestjs/common";
import type { IPiiDetector, PiiEntity } from "../interfaces/pii.interfaces";

/**
 * RegexPiiDetector
 * SRP: Only pattern-matches PII. Zero side effects.
 * OCP: Additional patterns added by extending PATTERNS without modifying detection logic.
 */
@Injectable()
export class RegexPiiDetector implements IPiiDetector {
  private static readonly PATTERNS: Array<{
    type: PiiEntity["type"];
    regex: RegExp;
  }> = [
    {
      type: "EMAIL",
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    },
    { type: "PHONE", regex: /\b(\+?\d[\d\s\-().]{7,}\d)\b/g },
    { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { type: "CREDIT_CARD", regex: /\b(?:\d[ -]?){13,16}\b/g },
    { type: "IP_ADDRESS", regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g },
  ];

  detect(text: string): PiiEntity[] {
    const entities: PiiEntity[] = [];
    for (const { type, regex } of RegexPiiDetector.PATTERNS) {
      const re = new RegExp(regex.source, regex.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        entities.push({
          type,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
    return entities;
  }
}
```

#### 1.2.3 — PII Masker

File: `backend/src/modules/agents/security/providers/pii-masker.service.ts`

```typescript
import { Injectable } from "@nestjs/common";
import type { IPiiMasker, PiiEntity } from "../interfaces/pii.interfaces";

@Injectable()
export class PiiMaskerService implements IPiiMasker {
  mask(text: string, entities: PiiEntity[]): string {
    // Process from end → start to preserve indices
    const sorted = [...entities].sort((a, b) => b.start - a.start);
    let result = text;
    for (const entity of sorted) {
      const token = `[REDACTED:${entity.type}]`;
      result = result.slice(0, entity.start) + token + result.slice(entity.end);
    }
    return result;
  }
}
```

#### 1.2.4 — PII Middleware Service (integration point with SecurityInterceptorService)

File: `backend/src/modules/agents/security/pii-middleware.service.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { RegexPiiDetector } from "./providers/regex-pii-detector.service";
import { PiiMaskerService } from "./providers/pii-masker.service";

/**
 * PiiMiddlewareService
 * SRP: Orchestrates PII detection + masking for a given string.
 *      Called from SecurityInterceptorService before/after tool execution.
 * OCP: Detector/Masker implementations are swappable via DI tokens.
 */
@Injectable()
export class PiiMiddlewareService {
  private readonly logger = new Logger(PiiMiddlewareService.name);

  constructor(
    private readonly detector: RegexPiiDetector,
    private readonly masker: PiiMaskerService,
  ) {}

  sanitizeInput(input: string): { sanitized: string; piiFound: boolean } {
    const entities = this.detector.detect(input);
    if (entities.length === 0) return { sanitized: input, piiFound: false };
    this.logger.warn(
      `PII detected in tool input: ${entities.map((e) => e.type).join(", ")}`,
    );
    return { sanitized: this.masker.mask(input, entities), piiFound: true };
  }

  sanitizeOutput(output: string): string {
    const entities = this.detector.detect(output);
    if (entities.length === 0) return output;
    return this.masker.mask(output, entities);
  }
}
```

#### 1.2.5 — Integration into SecurityInterceptorService

In `security-interceptor.service.ts`, inject `PiiMiddlewareService` and call it inside `validateToolCall()`:

```typescript
// Before tool execution — sanitize stringified input
const inputStr = JSON.stringify(toolCall.input);
const { sanitized, piiFound } = this.piiMiddleware.sanitizeInput(inputStr);
if (piiFound) {
  // Replace tool call input with sanitized version
  toolCall = {
    ...toolCall,
    input: JSON.parse(sanitized) as Record<string, unknown>,
  };
}
```

And after tool execution, sanitize the output string before it flows back to the LLM.

#### 1.2.6 — DI Registration

In `security.module.ts`, add `RegexPiiDetector`, `PiiMaskerService`, `PiiMiddlewareService` to providers array. Expose `PiiMiddlewareService` as a DI token `'IPiiMiddleware'` for OCP.

---

### Feature 1.3 — Per-Agent Cost Dashboard UI

**Why now**: Infrastructure already exists (`CostRecord`, `BudgetPolicy`). Just needs wiring to frontend.

#### 1.3.1 — Backend: Cost by Agent endpoint (already in CostsService — expose via controller)

Check `costs.controller.ts` for `GET /costs/by-agent/:agentId`. If missing, add:

```typescript
@Get('by-agent/:agentId')
async getCostByAgent(
  @Param('agentId') agentId: string,
  @Query('from') from: string,
  @Query('to') to: string,
  @Request() req: AuthenticatedRequest,
) {
  this.validateTenant(req.user);
  return this.costsService.getCostByAgent(
    req.user.tenantId!,
    agentId,
    new Date(from),
    new Date(to),
  );
}
```

#### 1.3.2 — Frontend Page

File: `frontend-tenant/src/app/(app)/costs/page.tsx`

```tsx
// Cost Dashboard — shows:
// 1. Tenant total spend (current month) — CostSummary from GET /costs/summary
// 2. Per-agent breakdown table — agentName | tokens | cost | trend
// 3. Budget bar — budget used vs policy limit
// 4. Line chart (Recharts) — daily spend trend last 30 days
// All data from: GET /costs/summary?from=...&to=...
```

Component breakdown:

- `CostSummaryCard` — total $, token count, model breakdowns
- `AgentCostTable` — sortable by cost desc, badge for over-budget agents
- `BudgetPolicyPanel` — lists active policies, CTA to create/edit
- `SpendTrendChart` — `<ResponsiveContainer width="100%" height={200}>` with `<AreaChart>`

Service additions in `frontend-tenant/src/services/costs.service.ts`:

```typescript
getSummary(from: Date, to: Date): Promise<CostSummary>
getByAgent(agentId: string, from: Date, to: Date): Promise<CostSummary>
listBudgetPolicies(): Promise<BudgetPolicy[]>
```

---

## PHASE 2 — Execution Excellence & UX Flagship

### Feature 2.1 — Agent Staging Environment + Evaluation Runs

**Why now**: Enables safe iteration before production. High trust signal for enterprise.

#### 2.1.1 — Concept

Agents exist in two modes:

- **PRODUCTION** — live, serving real tasks
- **STAGING** — isolated, test-only, uses `stagingTenantId` namespace for memory

Each Agent gets a `deploymentMode: 'PRODUCTION' | 'STAGING'` field.

#### 2.1.2 — Prisma Schema addition

```prisma
enum DeploymentMode {
  PRODUCTION
  STAGING
}
```

On `Agent` model, add:

```prisma
deploymentMode DeploymentMode @default(PRODUCTION)
stagingParentId String?  // if STAGING, points to the PRODUCTION agent being tested
```

Migration SQL:

```sql
DO $$ BEGIN
  CREATE TYPE "DeploymentMode" AS ENUM ('PRODUCTION', 'STAGING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "deploymentMode" "DeploymentMode" NOT NULL DEFAULT 'PRODUCTION',
  ADD COLUMN IF NOT EXISTS "stagingParentId" TEXT REFERENCES "agents"("id") ON DELETE SET NULL;
```

#### 2.1.3 — EvaluationRun model (new)

```prisma
model EvaluationRun {
  id           String   @id @default(uuid())
  agentId      String
  agent        Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  status       EvaluationStatus @default(PENDING)
  testCases    Json     // Array<{ input: string; expectedOutput?: string }>
  results      Json     @default("[]") // Array<{ input; actualOutput; score; passed; latencyMs }>
  averageScore Decimal? @db.Decimal(5, 4)
  passRate     Decimal? @db.Decimal(5, 4)
  triggeredBy  String   // userId
  completedAt  DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([agentId])
  @@index([tenantId])
  @@map("evaluation_runs")
}

enum EvaluationStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

#### 2.1.4 — EvaluationService (SRP)

File: `backend/src/modules/agents/services/evaluation.service.ts`

```typescript
/**
 * EvaluationService
 * SRP: Runs a set of test cases against a staging agent and records scores.
 * Uses AgentExecutorService to invoke the agent — same production path.
 * OCP: Scoring strategy injectable (LLM-based vs regex-based via IEvaluationScorer token).
 */
@Injectable()
export class EvaluationService {
  async runEvaluation(
    agentId: string,
    tenantId: string,
    testCases: Array<{ input: string; expectedOutput?: string }>,
    triggeredBy: string,
  ): Promise<EvaluationRun>;

  async getEvaluationRuns(
    agentId: string,
    tenantId: string,
  ): Promise<EvaluationRun[]>;
  async promoteToProduction(
    stagingAgentId: string,
    tenantId: string,
  ): Promise<Agent>;
}
```

`promoteToProduction()`:

1. Check staging agent exists and `deploymentMode === 'STAGING'`
2. Snapshot current production agent (calls `AgentVersionService.snapshotAgent`)
3. Copy staging config onto production agent via `AgentsService.update()`
4. Mark staging agent as deleted (soft delete)
5. Return updated production agent

#### 2.1.5 — Controller endpoints

```
POST /agents/:id/clone-to-staging      → creates a STAGING copy of a PRODUCTION agent
POST /agents/:id/evaluation-runs       → starts a new eval run
GET  /agents/:id/evaluation-runs       → lists all eval runs
GET  /agents/:id/evaluation-runs/:rid  → single eval run with results
POST /agents/:id/promote               → promotes staging → production (with auto-version snapshot)
```

#### 2.1.6 — Frontend

File: `frontend-tenant/src/app/(app)/agents/[id]/page.tsx` — add tabs:

- **Config** (existing form)
- **Versions** (Phase 1.1 feature)
- **Staging** — Create/clone staging copy, run evaluations, promote

`EvalRunForm` component:

```tsx
// Textarea for test cases (one per line: "Input >> Expected Output")
// Start Evaluation button → POST /agents/:id/evaluation-runs
// Results table: input | actual output | score | pass/fail | latency
// "Promote to Production" button (disabled until passRate >= 80%)
```

---

### Feature 2.2 — Visual Workflow Canvas

**Why now**: Highest-visibility UX feature. Direct competitive differentiator vs simple form-based creation.

#### 2.2.1 — Dependencies

```bash
# frontend-tenant
pnpm add @xyflow/react   # React Flow — MIT license, 50k+ stars, TypeScript native
```

No new backend dependencies needed — existing `POST /workflows` endpoint accepts `steps` array.

#### 2.2.2 — Node Types

File: `frontend-tenant/src/components/workflow-canvas/node-types.ts`

```typescript
export type WorkflowNodeType =
  | "trigger"
  | "agent_task"
  | "condition"
  | "parallel"
  | "done";

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  agentId?: string;
  agentName?: string;
  taskDescription?: string;
  conditionExpression?: string;
  isConfigured: boolean;
}
```

#### 2.2.3 — Canvas Component Architecture

```
WorkflowCanvasPage                        ← route: /workflows/new (replaces existing form)
├── WorkflowCanvas                        ← @xyflow/react <ReactFlow>
│   ├── TriggerNode                       ← entry point (manual / scheduled / webhook)
│   ├── AgentTaskNode                     ← selects agent + enters task description
│   ├── ConditionNode                     ← if/else routing with expression
│   ├── ParallelNode                      ← fan-out to multiple branches
│   └── DoneNode                          ← terminal
├── NodeConfigPanel (right sidebar)       ← slides in on node click
│   ├── TriggerConfigForm
│   ├── AgentTaskConfigForm               ← agent dropdown + task description textarea
│   └── ConditionConfigForm
├── WorkflowToolbar                       ← Add Node menu, Validate, Save, Run
└── WorkflowMetaForm                      ← name + description inputs at top
```

**SOLID application**:

- **SRP**: Each node component renders its own visual only. Config is in `NodeConfigPanel`.
- **OCP**: New node types added by registering in `nodeTypes` map — no `WorkflowCanvas` changes.
- **DIP**: `WorkflowCanvasPage` depends on `IWorkflowService` interface, not direct `api.post`.

#### 2.2.4 — Serialization to backend

On save, canvas state is serialized:

```typescript
const workflowPayload = {
  name: meta.name,
  description: meta.description,
  steps: nodes
    .filter((n) => n.data.nodeType === "agent_task")
    .map((n, idx) => ({
      name: n.data.label,
      agentRole: n.data.agentName ?? "",
      agentId: n.data.agentId,
      taskDescription: n.data.taskDescription,
      order: idx,
    })),
  canvasState: { nodes, edges }, // raw canvas state stored in workflow.config JSON
};
await api.post("/workflows", workflowPayload);
```

The existing `POST /workflows` endpoint stores `canvasState` inside the `config: Json` field of the Workflow model — no schema change needed.

**View mode**: `GET /workflows/:id` fetches `config.canvasState` and re-hydrates `<ReactFlow initialNodes={...} initialEdges={...} />`.

---

### Feature 2.3 — Supervisor-Worker Agent Orchestration

**Why now**: Unlocks multi-agent workflows. Core competitive feature vs single-agent execution.

#### 2.3.1 — Concept

A **Supervisor** agent orchestrates a team of **Worker** agents:

1. User assigns a high-level goal to the Supervisor
2. Supervisor's LangGraph `planner_node` decomposes into sub-tasks
3. Each sub-task is dispatched as a `Task` to a Worker agent
4. Worker executes and returns result to Supervisor
5. Supervisor aggregates and produces the final output

#### 2.3.2 — Schema addition

```prisma
// On existing Agent model, add:
supervisorId String?  // if set, this agent is a worker under supervisorId agent
supervisor   Agent?  @relation("SupervisorWorkers", fields: [supervisorId], references: [id])
workers      Agent[] @relation("SupervisorWorkers")
```

Migration SQL:

```sql
ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "supervisorId" TEXT REFERENCES "agents"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "agents_supervisorId_idx" ON "agents"("supervisorId");
```

#### 2.3.3 — Multi-Agent Orchestrator Service (SRP + OCP)

File: `backend/src/modules/orchestration/services/multi-agent-orchestrator.service.ts`

```typescript
/**
 * MultiAgentOrchestratorService
 *
 * SRP: Coordinates task decomposition + dispatch to worker agents.
 *      Does NOT execute tasks itself — delegates to AgentExecutorService.
 * OCP: Sub-task routing strategy is injectable via IWorkerSelectionStrategy token.
 * DIP: Depends on abstractions (IAgentService, ITaskService, AgentExecutorService interface).
 */
@Injectable()
export class MultiAgentOrchestratorService {
  async runSupervisedGoal(
    supervisorAgentId: string,
    tenantId: string,
    goal: string,
    userId: string,
  ): Promise<OrchestrationResult>;

  private async decomposeGoal(
    supervisorAgent: Agent,
    goal: string,
  ): Promise<SubTask[]>;

  private async dispatchSubTask(
    workerAgentId: string,
    subTask: SubTask,
    tenantId: string,
    userId: string,
  ): Promise<TaskResult>;
}
```

#### 2.3.4 — Frontend: Agent Team Builder

In agent detail page, add **"Team" tab**:

- Shows current workers assigned to this agent
- "Assign Worker" button → opens modal to select from tenant agents
- "Run as Supervisor" button → opens goal input → dispatches via `POST /orchestration/supervised`

---

### Feature 2.4 — Department-Scoped Knowledge Spaces

**Why now**: Dust's core differentiator. Ensures agents only see data relevant to their department.

#### 2.4.1 — Schema additions

```prisma
model KnowledgeSpace {
  id           String     @id @default(uuid())
  tenantId     String
  tenant       Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  departmentId String?    // null = shared across all departments
  department   Department? @relation(fields: [departmentId], references: [id])
  name         String
  description  String?
  isPublic     Boolean    @default(false)
  sourceType   KnowledgeSourceType @default(MANUAL)
  config       Json       @default("{}")

  documents    KnowledgeDocument[]
  agentAccess  AgentKnowledgeAccess[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([tenantId])
  @@index([departmentId])
  @@map("knowledge_spaces")
}

model KnowledgeDocument {
  id             String   @id @default(uuid())
  spaceId        String
  space          KnowledgeSpace @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  title          String
  content        String   @db.Text
  embedding      Unsupported("vector(1536)")?
  sourceUrl      String?
  metadata       Json     @default("{}")

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([spaceId])
  @@map("knowledge_documents")
}

model AgentKnowledgeAccess {
  agentId  String
  spaceId  String
  agent    Agent          @relation(fields: [agentId], references: [id], onDelete: Cascade)
  space    KnowledgeSpace @relation(fields: [spaceId], references: [id], onDelete: Cascade)

  @@id([agentId, spaceId])
  @@map("agent_knowledge_access")
}

enum KnowledgeSourceType {
  MANUAL
  GOOGLE_DRIVE
  NOTION
  CONFLUENCE
  GITHUB
  SLACK
}
```

#### 2.4.2 — KnowledgeService (SRP)

File: `backend/src/modules/memory/knowledge.service.ts`

```typescript
/**
 * KnowledgeService
 * SRP: CRUD for knowledge spaces + vector-based document retrieval.
 *      Separate from MemoryService which handles agent episodic memory.
 * OCP: New source types (Notion, GitHub) add a new source adapter without touching this service.
 * DIP: Depends on IPrismaService, IVectorSearchProvider.
 */
@Injectable()
export class KnowledgeService {
  createSpace(input: CreateKnowledgeSpaceInput): Promise<KnowledgeSpace>;
  addDocument(
    spaceId: string,
    doc: AddDocumentInput,
  ): Promise<KnowledgeDocument>;
  searchDocuments(
    query: string,
    agentId: string,
    tenantId: string,
    limit?: number,
  ): Promise<KnowledgeDocument[]>;
  grantAgentAccess(agentId: string, spaceId: string): Promise<void>;
  revokeAgentAccess(agentId: string, spaceId: string): Promise<void>;
}
```

`searchDocuments()` — uses pgvector cosine search restricted to spaces the agent has access to:

```sql
SELECT kd.*, kd.embedding <=> $1::vector AS distance
FROM knowledge_documents kd
JOIN agent_knowledge_access aka ON aka."spaceId" = kd."spaceId"
WHERE aka."agentId" = $2
ORDER BY distance ASC
LIMIT $3
```

#### 2.4.3 — Integration with tool call path

In `knowledge-base.tool.ts`, replace any placeholder logic with a call to `KnowledgeService.searchDocuments()` using the tenant-scoped agent context.

---

## PHASE 3 — Enterprise Experience

### Feature 3.1 — Tenant Maturity Indicator (L1→L4 Adoption Roadmap)

**Why now**: Quick win. Increases adoption and user engagement.

#### 3.1.1 — Levels Definition

```
L1 — Deployed  : ≥1 active agent, wizard complete, ≥1 task run
L2 — Automated : ≥1 workflow active, ≥3 tasks completed
L3 — Integrated : ≥1 connector active, ≥1 department with agents
L4 — Optimized : ≥1 eval run with passRate ≥ 80%, ≥1 budget policy set
```

#### 3.1.2 — Backend: MaturityService (SRP)

File: `backend/src/modules/analytics/services/maturity.service.ts`

```typescript
/**
 * MaturityService
 * SRP: Computes current maturity level from tenant metrics.
 * OCP: Level thresholds defined as `MATURITY_LEVELS` config array — add L5 without changing logic.
 */
@Injectable()
export class MaturityService {
  async computeMaturity(tenantId: string): Promise<MaturityResult> {
    const [
      agentCount,
      taskCount,
      workflowCount,
      connectorCount,
      evalCount,
      budgetCount,
    ] = await Promise.all([
      this.prisma.agent.count({ where: { tenantId, status: "IDLE" } }),
      this.prisma.task.count({ where: { tenantId, status: "COMPLETED" } }),
      this.prisma.workflow.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.crmConnector.count({ where: { tenantId } }),
      // evaluation_runs count
      // budget_policies count
    ]);
    // Returns: { level: 1|2|3|4, nextLevelRequirements: string[], progressPct: number }
  }
}
```

Endpoint: `GET /analytics/maturity` → consumed by dashboard.

#### 3.1.3 — Frontend: Maturity Card on Dashboard

Renders above the KPI bar on `dashboard/page.tsx`:

```tsx
<MaturityCard
  level={maturity.level} // 1–4
  progressPct={maturity.progressPct}
  nextSteps={maturity.nextLevelRequirements}
/>
```

Visual: 4 connected dots (L1→L2→L3→L4) with current level highlighted, progress bar, "What to do next" checklist.

---

### Feature 3.2 — Rich Artifact Outputs (PDF / CSV / Chart Image)

**Why now**: Business users expect tangible deliverables, not just text.

#### 3.2.1 — PDF Export Tool (enhancement of existing `pdf-generation.tool.ts`)

The tool already exists. It needs to:

1. Accept JSON data + a template string
2. Use `puppeteer-core` (or `@sparticuz/chromium` for serverless) to render HTML → PDF
3. Upload to a temp storage bucket or return as base64

Alternatively use `pdfkit` (no Chromium dependency):

```bash
pnpm add pdfkit @types/pdfkit
```

Update `pdf-generation.tool.ts` to use `pdfkit` for structured reports:

```typescript
// Input: { title, sections: [{heading, body}][], tableData?: {headers, rows}[] }
// Output: { pdfBase64: string, filename: string }
```

#### 3.2.2 — CSV Export Service

File: `backend/src/shared/services/csv-export.service.ts`

```typescript
/**
 * CsvExportService
 * SRP: Serializes data arrays to CSV format.
 * Used by: tasks, analytics, cost reports.
 */
@Injectable()
export class CsvExportService {
  toCsv(headers: string[], rows: Array<Record<string, unknown>>): string;
}
```

Controller endpoints to add to existing relevant controllers:

```
GET /tasks/export?format=csv      → Content-Disposition: attachment; filename="tasks.csv"
GET /costs/export?format=csv      → cost records as CSV
GET /analytics/export?format=csv  → analytics summary
```

#### 3.2.3 — Frontend: Artifact Viewer Component

File: `frontend-tenant/src/components/artifacts/ArtifactViewer.tsx`

```tsx
// Renders agent output based on detected MIME type:
// - text/* → markdown renderer (react-markdown)
// - application/pdf → <embed src={blobUrl} type="application/pdf" />
// - text/csv → inline table preview with pagination
// - image/* → <img>
// - application/json → syntax-highlighted code block
```

Used in task detail page to render `task.output` field.

---

### Feature 3.3 — Proactive/Scheduled Agent Runs (Frontend Wiring)

**Why now**: Routines backend is complete. Frontend has no UI for it.

#### 3.3.1 — Audit existing Routines module

Check `backend/src/modules/routines/` for existing endpoints:

- `POST /routines` — create a routine
- `GET /routines` — list routines
- `PATCH /routines/:id` — update
- `DELETE /routines/:id` — delete

If cron scheduling is not wired in `RoutineExecutionService`, add `@nestjs/schedule`:

```bash
pnpm add @nestjs/schedule
```

Register `ScheduleModule.forRoot()` in `app.module.ts`.

In `RoutineExecutionService`, add `@Cron()` decorators driven by the `schedule` field on `Routine` model. Use `CronExpression` for type-safe patterns.

#### 3.3.2 — Frontend: Routines Page

File: `frontend-tenant/src/app/(app)/routines/page.tsx`

```tsx
// Three modes: Manual (fire now), Scheduled (cron expression), Event-based (webhook trigger)
// Form: name, description, targetAgentId (dropdown), goal/task description, schedule (cron picker UI), isActive toggle
// Table: shows existing routines with last run status, next run time, toggle active
// "Run Now" button → POST /routines/:id/run
```

Component tree:

```
RoutinesPage
├── RoutinesList     ← table with status badges + run/pause actions
├── CreateRoutineModal
│   ├── ScheduleModeSelector  ← Manual | Cron | Webhook
│   ├── CronPickerInput       ← human-readable cron builder (min/hour/day/weekday)
│   └── AgentDropdown         ← fetches from GET /agents
└── RoutineRunHistoryDrawer   ← shows last N runs for a routine
```

---

### Feature 3.4 — Industry-Specific Agent Packs

**Why now**: Accelerates time-to-value. Direct competitive answer to Creatio and Relevance AI.

#### 3.4.1 — Pack Definition Format

File: `backend/src/modules/agent-templates/interfaces/agent-pack.interface.ts`

```typescript
export interface AgentPack {
  id: string;
  name: string;
  industry: string; // 'GTM' | 'SUPPORT' | 'FINANCE' | 'HR' | 'ENGINEERING'
  description: string;
  agents: AgentPackEntry[];
  recommendedWorkflows: WorkflowTemplate[];
  tools: string[]; // tool IDs required
}

export interface AgentPackEntry {
  templateId: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
}
```

#### 3.4.2 — Three starter packs (seeded via `seed-platform-templates.cjs`)

**GTM Pack** (Go-to-Market):

- SDR Agent (prospecting, CRM sync)
- Content Agent (blog posts, social media)
- Analytics Agent (campaign performance)
- Forecasting Agent (pipeline analysis)

**Support Pack**:

- Triage Agent (classify and route tickets)
- FAQ Agent (knowledge-base lookup)
- Escalation Agent (sentiment + escalation detection)
- SLA Monitor Agent (tracks open tickets)

**Finance Pack**:

- Invoice Agent (generate, issue, track)
- Expense Agent (categorize, policy check)
- Budget Agent (monitor, alert on overspend)
- Report Agent (monthly financial summaries)

#### 3.4.3 — Backend endpoint

```
GET /agent-packs              → list all packs
GET /agent-packs/:id          → single pack with agents + workflows
POST /agent-packs/:id/deploy  → creates all agents from pack for tenant
```

`deployPack()` service method:

```typescript
// For each AgentPackEntry:
//   1. Check agentTemplate exists (by templateId)
//   2. Create Agent for tenant using template config
//   3. Create Workflow records for recommendedWorkflows
// Returns: { agents: Agent[], workflows: Workflow[] }
```

#### 3.4.4 — Frontend: Agent Packs Marketplace

File: `frontend-tenant/src/app/(app)/agents/packs/page.tsx`

```tsx
// 3-column grid of pack cards — icon, name, description, agent count
// Filter by industry (pill tabs: All | GTM | Support | Finance | Engineering | HR)
// Pack card → click → opens PackDetailModal
//   Shows agent roster with roles + model
//   "Deploy Pack" button → POST /agent-packs/:id/deploy → refreshes agents page
```

---

## PHASE 4 — Enterprise Sales Unlock

### Feature 4.1 — SCIM Provisioning

**Why now**: Required for enterprise SSO deals. Enables auto user/group sync from IdP.

#### 4.1.1 — SCIM 2.0 Core Endpoints

File: `backend/src/modules/auth/scim/scim.controller.ts`

```
GET    /scim/v2/Users              → list users
POST   /scim/v2/Users              → provision user
GET    /scim/v2/Users/:id          → get user
PUT    /scim/v2/Users/:id          → replace user
PATCH  /scim/v2/Users/:id          → update user
DELETE /scim/v2/Users/:id          → deprovision (deactivate user)
GET    /scim/v2/Groups             → list groups (maps to departments)
POST   /scim/v2/Groups             → create group → create department
PATCH  /scim/v2/Groups/:id         → update members
DELETE /scim/v2/Groups/:id         → archive department
```

SCIM uses its own auth token (`X-SCIM-Token` bearer) stored in `ApiKey` table with `type: 'SCIM'`.

#### 4.1.2 — ScimService (SRP)

```typescript
/**
 * ScimService
 * SRP: Translates between SCIM 2.0 protocol format and internal User/Department models.
 * OCP: Response serializers for User/Group are separate. Adding a new SCIM resource
 *      (e.g. Entitlements) requires only a new serializer + route, not changing ScimService.
 */
@Injectable()
export class ScimService {
  listUsers(
    tenantId: string,
    filter?: string,
  ): Promise<ScimListResponse<ScimUser>>;
  createUser(tenantId: string, data: ScimUser): Promise<ScimUser>;
  updateUser(
    tenantId: string,
    userId: string,
    data: Partial<ScimUser>,
  ): Promise<ScimUser>;
  deactivateUser(tenantId: string, userId: string): Promise<void>;
  listGroups(tenantId: string): Promise<ScimListResponse<ScimGroup>>;
  createGroup(tenantId: string, data: ScimGroup): Promise<ScimGroup>;
  updateGroupMembers(
    tenantId: string,
    groupId: string,
    operations: ScimPatchOp[],
  ): Promise<ScimGroup>;
}
```

#### 4.1.3 — SSO (SAML 2.0 / OIDC)

Integration via `passport-saml` for SAML 2.0 and `passport-openidconnect` for OIDC.

Backend endpoints:

```
GET  /auth/sso/config           → get tenant SSO config
POST /auth/sso/config           → save SSO config (entityId, cert, entryPoint)
GET  /auth/sso/saml/metadata    → SAML SP metadata XML
POST /auth/sso/saml/callback    → SAML ACS endpoint
GET  /auth/sso/oidc/authorize   → OIDC redirect
GET  /auth/sso/oidc/callback    → OIDC callback
```

SSOConfig stored in new model:

```prisma
model SsoConfig {
  id          String  @id @default(uuid())
  tenantId    String  @unique
  tenant      Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  provider    SsoProvider  // SAML | OIDC
  isActive    Boolean @default(false)
  config      Json    // { entityId, cert, entryPoint } | { clientId, clientSecret, discoveryUrl }
  allowedDomains String[] // email domain whitelist

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("sso_configs")
}

enum SsoProvider {
  SAML
  OIDC
}
```

---

### Feature 4.2 — Natural Language → Admin UI Generator

**Why now**: Highest-impact long-term differentiator. Analogous to Retool's AppGen.

This is the most complex feature. Implement in sub-phases:

**Sub-phase A (MVP)**: NL → Report Definition

- User describes a report in natural language: "Show me all failed tasks by agent for the last 30 days"
- LLM generates a `ReportDefinition` JSON: `{ entity, filters, groupBy, sortBy, chartType }`
- Report rendered as table + chart from existing analytics APIs

**Sub-phase B**: NL → Filter Builder

- User types "show agents that cost more than $100 this month"
- LLM generates filter expression applied to `GET /agents` with query params

**Sub-phase C**: Full Admin Panel Generator (LangGraph multi-step)

- NL prompt → LLM generates React component TSX (restricted to safe primitives)
- Sandboxed preview via iframe with `postMessage` bridge
- If approved, saved as a "Custom View" in tenant settings

---

## Engineering Standards & Conventions

### TypeScript Quality Standards

All new files must pass:

```bash
cd backend && npx tsc --noEmit --skipLibCheck
cd frontend-tenant && npx tsc --noEmit --skipLibCheck
cd frontend-admin && npx tsc --noEmit --skipLibCheck
```

Rules:

1. **No `any`** — use `unknown` with type guards or explicit union types
2. **No non-null assertion (`!`)** — use optional chaining and `?? fallback`
3. **DTOs must use class-validator decorators** — `@IsString()`, `@IsOptional()`, etc.
4. **All Prisma raw JSON casts** — cast via `as unknown as TargetType` pattern (Prisma Json fields)
5. **Event payloads strongly typed** — all `EventsGateway.emit()` calls use typed payload interfaces
6. **Frontend API responses** — always use triple-fallback: `res.data?.data?.data ?? res.data?.data ?? res.data`
7. **No direct `Array.prototype` calls without `Array.isArray()` guard** on API payloads

### SOLID Compliance Checklist

For every new module:

- [ ] **SRP**: Service file only has one primary responsibility. No mixed concerns.
- [ ] **OCP**: Strategy/behaviour variants injected via DI token, not conditionals in service core
- [ ] **LSP**: If implementing an interface, ALL interface methods must be implemented fully (no `throw new Error('not implemented')` in production paths)
- [ ] **ISP**: Interface files are in `interfaces/` directory. Interfaces split by consumer role (read vs write vs execute)
- [ ] **DIP**: Controllers depend on Service classes. Services depend on repository interfaces. No `new SomeClass()` inside service constructors.

### NestJS Module Structure Template

Every new module follows this layout:

```
modules/{feature}/
├── dto/
│   ├── create-{feature}.dto.ts    ← @IsString, @IsOptional etc.
│   └── update-{feature}.dto.ts    ← PartialType(Create...)
├── interfaces/
│   └── {feature}.interface.ts      ← IRepository, IService types
├── repositories/
│   └── prisma-{feature}.repository.ts  ← implements I*Repository
├── services/
│   └── {feature}.service.ts        ← implements I*Service, uses repository
├── {feature}.controller.ts         ← HTTP transport only, no business logic
└── {feature}.module.ts             ← DI wiring
```

### Frontend Component Template (Next.js 15 / TSX)

```tsx
"use client";
// 1. External imports (react, next, lucide, etc.)
// 2. Internal service imports
// 3. Store imports
// 4. Type-only imports at the end

// Interface definitions at top of file
interface Props { ... }

// Named component export (not default anonymous)
export function FeatureComponent({ ...props }: Props) {
  // State at top
  // Effects after state
  // Handlers after effects
  // Render at bottom
}

// Default export if needed for Next.js routing
export default FeatureComponent;
```

No inline styles. All styling via Tailwind classes. CSS variables for theme tokens (`--surface-border`, `--text-primary`, etc.).

---

## Implementation Sequence & Acceptance Criteria

### Phase 1 Sprint Targets (2 weeks)

| Task                                            | Owner    | Done When                                           |
| ----------------------------------------------- | -------- | --------------------------------------------------- |
| 1.1 — Agent Versions schema + migration         | Backend  | Migration applied, `pnpm prisma generate` passes    |
| 1.1 — AgentVersionRepository + Service          | Backend  | `tsc --noEmit` passes, unit tests pass              |
| 1.1 — Controller endpoints + auto-snapshot hook | Backend  | `GET /agents/:id/versions` returns 200              |
| 1.1 — Frontend versions page                    | Frontend | Versions tab shows history, rollback modal works    |
| 1.2 — PII interfaces + RegexPiiDetector         | Backend  | `detect()` unit tests pass for email/phone/SSN      |
| 1.2 — PiiMiddlewareService integration          | Backend  | Tool inputs with PII are sanitized before LLM call  |
| 1.3 — Cost dashboard page                       | Frontend | `/costs` page shows spend summary + per-agent table |

### Phase 2 Sprint Targets (3 weeks)

| Task                                  | Done When                                                   |
| ------------------------------------- | ----------------------------------------------------------- |
| 2.1 — EvaluationRun schema + service  | `POST /agents/:id/evaluation-runs` returns runs with scores |
| 2.1 — Frontend staging + eval tab     | Pass rate ≥ 80% flow works end-to-end                       |
| 2.2 — React Flow canvas setup         | Canvas renders with drag + node config panel                |
| 2.2 — Serialization + save            | Created workflow appears in `/workflows` list               |
| 2.3 — Supervisor-worker schema        | `supervisorId` relationship persists                        |
| 2.3 — MultiAgentOrchestratorService   | Supervisor dispatches sub-tasks to workers                  |
| 2.4 — KnowledgeSpace schema + service | `searchDocuments()` returns pgvector results                |

### Phase 3 Sprint Targets (2 weeks)

| Task                                   | Done When                                     |
| -------------------------------------- | --------------------------------------------- |
| 3.1 — MaturityService                  | `GET /analytics/maturity` returns level 1–4   |
| 3.1 — Frontend maturity card           | Dashboard shows L1–L4 indicator               |
| 3.2 — PDF tool enhancement             | Tool returns base64 PDF for structured data   |
| 3.2 — CSV export endpoints             | `/tasks/export` returns downloadable CSV      |
| 3.3 — Routines frontend page           | User can create/manage scheduled runs         |
| 3.4 — Agent pack seed data             | 3 packs seeded (GTM, Support, Finance)        |
| 3.4 — Pack deployment + marketplace UI | `POST /agent-packs/:id/deploy` creates agents |

### Phase 4 Sprint Targets (4 weeks)

| Task                             | Done When                                         |
| -------------------------------- | ------------------------------------------------- |
| 4.1 — SCIM endpoints scaffold    | SCIM User CRUD returns SCIM 2.0 compliant JSON    |
| 4.1 — SSO config + SAML callback | SAML login flow works with test IdP (Okta, Auth0) |
| 4.2 Sub-A — NL → Report          | Report definition JSON generates, chart renders   |

---

## Known Risks & Mitigations

| Risk                                                  | Mitigation                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| pgvector not enabled for KnowledgeDocument embeddings | Apply `CREATE EXTENSION vector;` migration — same as existing MemoryEntry vector       |
| ReactFlow bundle size (+~200KB gzip)                  | Code-split: `dynamic(() => import('./WorkflowCanvas'), { ssr: false })`                |
| PII regex false positives on legitimate data          | Add per-tenant PII policy config (`piiEnabled: boolean` in `tenant.settings` JSON)     |
| EvaluationRun LLM costs for scoring                   | Score with heuristic by default; opt-in LLM scoring per evaluation run                 |
| SCIM token security                                   | Store SCIM token as bcrypt hash in ApiKey table; plaintext only shown once on creation |
| Multi-agent task fan-out causing DB write storms      | Use BullMQ job queue for sub-task dispatch (already a dep candidate)                   |

---

## Environment Variables Required

| Variable                   | Phase | Purpose                                                                                    |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| `PII_MASKING_ENABLED`      | 1.2   | Toggle PII masking globally (default: `true`)                                              |
| `EVAL_MAX_CONCURRENT_RUNS` | 2.1   | Max parallel eval runs per tenant (default: `2`)                                           |
| `AGENT_PACK_SEED_VERSION`  | 3.4   | Re-seed trigger version (increment to re-seed)                                             |
| `SCIM_TOKEN_LENGTH`        | 4.1   | SCIM API token byte length (default: `32`)                                                 |
| `SSO_SAML_CALLBACK_URL`    | 4.1   | Public URL for SAML ACS (e.g. `https://brain.neurecore.com/api/v1/auth/sso/saml/callback`) |

---

## File: Implementation Plan

```
memory-bank/Similar/IMPLEMENTATION_PLAN.md  ← this file
```

Related files:

- `memory-bank/Similar/similar-concept.md` — source competitive analysis
- `memory-bank/Similar/systemPatterns.md` — existing system patterns reference
- `memories/repo/neurecore_fixes_and_todo.md` — running dev log

---

_End of Implementation Plan — NeureCore Competitive Feature Roadmap_

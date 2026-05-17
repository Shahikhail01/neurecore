# Tier Agent Pool — SOLID Implementation Plan

**Date:** 2026-05-17
**Status:** Draft
**Principle:** 100% SOLID (SRP · OCP · LSP · ISP · DIP)

---

## 1. Problem Statement

Current tier system has `maxAgents` as a numeric limit only. There is:
- No concept of **pre-selected / locked agents** that a tenant cannot remove
- No concept of **flexible choice agents** the tenant CAN add/remove
- No enforcement — ADMIN can create any number of agents up to `maxAgents`
- No visual distinction between platform-mandated vs tenant-chosen agents

---

## 2. New Architecture

### 2.1 Core Concept

Each **Tier** (Starter / Growth / Pro / Enterprise) has:

| Slot Type | Count | Who Controls | Can Tenant Remove? |
|-----------|-------|-------------|-------------------|
| **Fixed Agents** | N (set per tier by SuperAdmin) | SuperAdmin only | ❌ No — locked |
| **Choice Agents** | M (set per tier by SuperAdmin) | Tenant freely | ✅ Yes — can add/remove |
| **Total** | N + M | — | — |

**Example — Growth Tier:**
- 3 Fixed agents (e.g., Support Agent, Sales Agent, Onboarding Agent)
- 2 Choice agents (tenant picks from agent template library)
- Tenant sees 5 agents total but can only manage the 2 choice slots

**Example — Enterprise Tier:**
- 5 Fixed agents
- 5 Choice agents
- Tenant sees all 10 but CANNOT remove the 5 fixed ones

### 2.2 Database Schema Changes

**`TierAgentPool` (existing, enhanced):**

```prisma
model TierAgentPool {
  id         String   @id @default(uuid())
  tierId     String
  tier       Tier     @relation(fields: [tierId], references: [id], onDelete: Cascade)
  templateId String
  template   AgentTemplate @relation(fields: [templateId], references: [id])

  slot       Int      @default(1)          // position
  isRequired Boolean  @default(false)       // TRUE = fixed (tenant cannot remove)
  isDefaultSelected Boolean @default(true)  // pre-selected on tenant creation

  // Tier-specific overrides
  defaultBudgetPerDay Decimal? @db.Decimal(10, 4)
  defaultModel        String?

  // Slot type: 'FIXED' | 'CHOICE'
  slotType  String   @default("CHOICE")    // 'FIXED' or 'CHOICE'

  createdAt DateTime @default(now())
}
```

**`Agent` (new field):**

```prisma
model Agent {
  // ... existing fields ...

  // New: tracks which TierAgentPool slot this was created from
  poolEntryId  String?
  poolEntry    TierAgentPool? @relation(fields: [poolEntryId], references: [id])

  // New: TRUE if this agent was auto-provisioned from a FIXED pool slot
  isFixed      Boolean  @default(false)
}
```

**`Tenant` (no changes needed)**

---

## 3. Backend — SOLID Implementation

### 3.1 Module Structure

```
src/modules/tiers/
├── tiers.module.ts
├── tiers.controller.ts          # unchanged (CRUD for tiers)
├── tiers.service.ts             # unchanged (tier CRUD)
├── interfaces/
│   ├── tier.interface.ts         # unchanged
│   └── pool-slot.interface.ts   # NEW — PoolSlot abstraction
├── services/
│   ├── pool-provisioning.service.ts   # NEW — provisions agents from tier pool
│   └── tier-enforcement.service.ts    # NEW — enforces slot limits
├── guards/
│   └── pool-slot.guard.ts       # NEW — prevents removal of FIXED agents
└── dto/
    └── pool-provisioning.dto.ts  # NEW — ProvisionAgentDto, BulkProvisionDto
```

### 3.2 Interfaces (ISP — focused contracts)

**`pool-slot.interface.ts`:**

```typescript
export interface PoolSlot {
  id: string;
  templateId: string;
  templateName: string;
  slotType: 'FIXED' | 'CHOICE';
  isRequired: boolean;
  isDefaultSelected: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  agentId?: string;       // filled when tenant agent is created from this slot
  agentName?: string;     // filled when tenant agent is created from this slot
  agentStatus?: string;   // filled when tenant agent is created from this slot
}

export interface ITierPoolService {
  getSlotsForTier(tierId: string): Promise<PoolSlot[]>;
  getSlotsForTenant(tenantId: string): Promise<PoolSlot[]>;
  provisionAgent(tenantId: string, slotId: string): Promise<Agent>;
  bulkProvision(tenantId: string, slotIds: string[]): Promise<Agent[]>;
  releaseSlot(tenantId: string, slotId: string): Promise<void>;  // removes choice agent
  canAddMoreChoiceAgents(tenantId: string): Promise<boolean>;
}

export interface ITierEnforcementService {
  getTenantLimits(tenantId: string): Promise<{
    fixedCount: number;
    choiceCount: number;
    choiceUsed: number;
    choiceRemaining: number;
  }>;
  enforceMaxAgents(tenantId: string): Promise<void>;  // throws if at limit
  enforceApiAccess(tenantId: string): Promise<void>;
  enforceAuditExport(tenantId: string): Promise<void>;
}
```

### 3.3 TierEnforcementService (SRP — one reason to change)

Handles ALL tier limit checks in one place:
- `enforceMaxAgents()` — throws `ForbiddenException` with "Your [PLAN] tier allows [N] agents. Contact your administrator."
- `enforceApiAccess()` — throws for API key creation if `allowApiAccess = false`
- `enforceAuditExport()` — throws if `allowAuditExport = false`

### 3.4 PoolProvisioningService (SRP — one reason to change)

Handles ALL agent provisioning from pool slots:
- `provisionAgent()` — creates agent from a pool entry; sets `isFixed = true` if slot is FIXED
- `bulkProvision()` — provisions multiple slots at once (used when tenant is created)
- `releaseSlot()` — removes an agent created from a CHOICE slot (must NOT be called for FIXED slots)

### 3.5 PoolSlotGuard (SRP — prevents fixed agent deletion)

Applied to DELETE `/agents/:id`:
- Looks up the agent's `poolEntry`
- If `poolEntry.isRequired === true`, throw `ForbiddenException("Cannot remove a platform-required agent. Contact your administrator.")`
- Otherwise allow

### 3.6 AgentsController Changes

```
POST /agents           → use TierEnforcementService.enforceMaxAgents() + PoolProvisioningService.provisionAgent()
DELETE /agents/:id     → use PoolSlotGuard to block FIXED removal
GET  /agents           → returns agents with poolEntry info (so frontend knows which are fixed)
GET  /agents/templates → unchanged (shows all available templates for choice slots)
```

---

## 4. Admin Portal — SUPERADMIN Only

### 4.1 Pages

**`/tier-templates/[id]/pool`** (new page — manages agent pool for a tier)

This page supersedes the simple `TierTemplatesPage` for agents:
- Shows all pool slots for the tier (grouped FIXED vs CHOICE)
- SUPERADMIN can add/remove/reorder pool slots
- SUPERADMIN can designate any slot as FIXED or CHOICE
- SUPERADMIN sets `defaultModel`, `defaultBudgetPerDay`, `isDefaultSelected`

**`/tiers`** (new page — list all tiers with quick stats)

**`/tiers/[id]`** (existing — enhanced with pool management tab)

**`/tenants/[id]/agents`** (existing — shows tenant's agents with locked indicators)

### 4.2 Tier Pool Management UI

```
┌─ Tier: Enterprise ──────────────────────────────────────────────────┐
│ Slug: enterprise  │  Fixed: 5  │  Choice: 5  │  Total: 10 agents  │
└───────────────────────────────────────────────────────────────────┘

FIXED SLOTS (Tenant cannot remove these)
┌─────────────────────────────────────────────────────────────────────┐
│ #1  Support Agent        │ gpt-4o    │ $50/day   │ [🔒 Locked]      │
│ #2  Sales Agent          │ gpt-4o    │ $50/day   │ [🔒 Locked]      │
│ #3  Onboarding Agent     │ gpt-4o    │ $30/day   │ [🔒 Locked]      │
│ #4  Billing Agent        │ gpt-4o    │ $30/day   │ [🔒 Locked]      │
│ #5  Security Monitor     │ gpt-4o    │ $100/day  │ [🔒 Locked]      │
└─────────────────────────────────────────────────────────────────────┘

CHOICE SLOTS (Tenant can add/remove freely)
┌─────────────────────────────────────────────────────────────────────┐
│ #6  Custom Agent A       │ gpt-4o    │ $20/day   │ [➕ Add]         │
│ #7  Custom Agent B       │ gpt-4o    │ $20/day   │ [➕ Add]         │
│                                                         [+ Add Slot] │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tenant Portal

### 5.1 Pages

**`/agents`** (existing — enhanced with lock indicators)

- Fixed agents shown with 🔒 lock icon and tooltip "Platform-required agent"
- Choice agents shown with ➕ indicator
- "Add Agent" button only works if `choiceRemaining > 0`
- If at limit: modal explains "Your [PLAN] tier includes [N] choice agents. Contact your administrator to add more."

**`/agents/new`** (existing — reworked as slot picker for choice agents)

Instead of free-form agent creation, shows:
- Available choice slots with their pre-configured templates
- Tenant picks from template library for each empty choice slot
- Already-filled slots show the agent with edit capability

### 5.2 Agent Card Changes

```
┌──────────────────────────────────────────────────┐
│ 🔒 Support Agent           [RUNNING]  ⟨EDIT⟩   │
│ Platform-required · Slot 1 of 3 fixed agents    │
│ Model: GPT-4o · Budget: $50/day                 │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ ➕ Custom Agent A         [IDLE]     ⟨EDIT⟩ [✕] │
│ Choice Agent · Slot 1 of 2                      │
│ Model: GPT-4o-mini · Budget: $20/day           │
└──────────────────────────────────────────────────┘
```

---

## 6. Backend Endpoints (REST)

### 6.1 New Endpoints

| Method | Endpoint | Who | Description |
|--------|----------|-----|-------------|
| GET | `/tiers/:id/pool` | SUPER_ADMIN | Get pool slots for a tier |
| POST | `/tiers/:id/pool/slots` | SUPER_ADMIN | Add pool slot to tier |
| PATCH | `/tiers/:id/pool/slots/:slotId` | SUPER_ADMIN | Update pool slot |
| DELETE | `/tiers/:id/pool/slots/:slotId` | SUPER_ADMIN | Remove pool slot (not allowed if agents already created from it) |
| POST | `/tiers/:id/pool/provision` | SUPER_ADMIN | Bulk-provision all pool slots to a tenant |
| GET | `/tenants/:id/pool` | SUPER_ADMIN, PLATFORM_ADMIN | Get tenant's provisioned pool (which slots are filled) |
| GET | `/agents/pool-status` | ADMIN, SUPER_ADMIN | Get current tenant's pool status (filled slots, remaining) |

### 6.2 Modified Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| POST `/agents` | Now uses `pool-slot.guard` + `TierEnforcementService` |
| DELETE `/agents/:id` | `PoolSlotGuard` blocks deletion of FIXED agents |
| GET `/agents` | Response includes `isFixed` and `poolEntryId` fields |
| GET `/tenants/me` | Response includes `tier.poolSlots` summary |

---

## 7. Implementation Order (Topological Sort)

### Phase 1: Schema + Core Backend (SRP)
1. **Prisma schema migration** — add `slotType`, `isFixed` fields
2. **PoolSlot interface** — define contract
3. **TierEnforcementService** — enforce limits
4. **PoolProvisioningService** — agent provisioning from pool
5. **PoolSlotGuard** — block FIXED agent deletion

### Phase 2: API Endpoints (SRP)
6. **TierPoolController** — CRUD for tier pool slots (SUPER_ADMIN only)
7. **AgentsController updates** — enforce + guard integration
8. **TenantsController updates** — `/tenants/:id/pool` endpoint

### Phase 3: Admin Portal (OCP — open for extension)
9. **TierPoolPage component** — pool management for SUPER_ADMIN
10. **Tenants/[id]/agents tab** — show locked indicators
11. **TierTemplatesPage** — link to new pool management

### Phase 4: Tenant Portal (OCP)
12. **Agents page** — lock icons on FIXED agents, limit enforcement UI
13. **Agent creation wizard** — slot picker instead of free-form
14. **Settings page** — show tier pool summary

### Phase 5: Testing + Migration
15. **Write unit tests** for `TierEnforcementService`, `PoolProvisioningService`
16. **Write e2e tests** for happy path + blocked paths
17. **Migration script** — assign `isFixed=true` to all existing agents (migration from old `maxAgents` model)

---

## 8. Key Files to Create/Modify

### New Files
```
backend/src/modules/tiers/interfaces/pool-slot.interface.ts
backend/src/modules/tiers/services/tier-enforcement.service.ts
backend/src/modules/tiers/services/pool-provisioning.service.ts
backend/src/modules/tiers/guards/pool-slot.guard.ts
backend/src/modules/tiers/dto/pool-provisioning.dto.ts
backend/src/modules/tiers/tier-pool.controller.ts
frontend-admin/src/app/tier-templates/[id]/pool/page.tsx
frontend-admin/src/app/tiers/page.tsx
frontend-tenant/src/app/agents/components/PoolStatusBar.tsx
frontend-tenant/src/app/agents/components/AgentCardPool.tsx
```

### Modified Files
```
backend/prisma/schema.prisma                        (+ slotType, isFixed fields)
backend/src/modules/agents/agents.controller.ts      (add guard + enforcement)
backend/src/modules/agents/agents.service.ts        (provision from pool)
backend/src/modules/tenants/tenants.service.ts      (include pool in findOne)
backend/src/modules/tiers/tiers.module.ts          (register new services)
frontend-admin/src/types/api.types.ts               (+ PoolSlot, TenantPoolStatus)
frontend-tenant/src/app/agents/page.tsx             (pool-aware agent list)
frontend-tenant/src/app/agents/new/page.tsx         (slot picker)
```

---

## 9. Success Criteria

- [ ] SUPER_ADMIN can set FIXED vs CHOICE slots per tier
- [ ] Tenant ADMIN sees 🔒 lock on FIXED agents, cannot delete them
- [ ] Tenant ADMIN can freely add/remove CHOICE agents up to tier limit
- [ ] `POST /agents` fails with clear message when tenant has no choice slots remaining
- [ ] Agent creation from pool sets correct `isFixed` flag and `poolEntryId`
- [ ] All existing agents get `isFixed: false` via migration (backwards compatible)
- [ ] Admin portal shows pool visualization per tier and per tenant
- [ ] All new services have unit tests (Vitest)
- [ ] Zero breaking changes to existing authenticated endpoints

---

## 10. SOLID Compliance Checklist

| Principle | How Achieved |
|-----------|-------------|
| **SRP** | Each service does one thing: `TierEnforcementService` = limits, `PoolProvisioningService` = pool provisioning, `PoolSlotGuard` = fixed agent protection |
| **OCP** | `TierPoolController` extended via new methods, not modified existing ones; pool slot type is open for new types |
| **LSP** | `PoolSlot` interface has `slotType: 'FIXED' \| 'CHOICE'` — both subtypes are interchangeable in the guard |
| **ISP** | Separate interfaces: `ITierEnforcementService`, `ITierPoolService`, `IPoolSlotGuard` — no fat interfaces |
| **DIP** | Controllers depend on `ITierEnforcementService` and `ITierPoolService` abstractions, not concretions |
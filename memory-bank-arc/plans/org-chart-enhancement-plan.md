# Org Chart Enhancement & Fix Plan

**Date:** 2026-07-20
**Status:** ✅ COMPLETED (2026-07-20 PKT)
**Target:** Full hierarchical org chart with drag-drop persistence, agent cards, and search

---

## 0. Implementation Summary (2026-07-20)

### What was built (4 deploys to Contabo)

A brand-new org chart visualization was built and deployed to `hq.neurecore.com/departments?tab=org-chart`:

| Component | File | Purpose |
|---|---|---|
| `OrgChartView.tsx` | `features/org-chart/components/` | Top-to-bottom tree renderer with CSS connector lines |
| `DeptCard.tsx` | `features/org-chart/components/` | Per-department card with expand/collapse, agent grid |
| `EmployeeCard.tsx` | `features/org-chart/components/` | Agent sub-card with name, designation, date joined, workload, success rate |
| `useOrgChart.ts` | `features/org-chart/hooks/` | `tenantTree` with phantom tenant root node + `buildHierarchy()` |
| `dept-colors.ts` | `features/org-chart/utils/` | 12-color deterministic palette per department |
| `OrgChartPanel.tsx` | `features/org-chart/components/` | Rewritten to use `OrgChartView` instead of old `TreeView` |
| `departments/page.tsx` | `app/departments/` | Removed local `Department`/`AgentLite` shadows, imports from domain.types |

### Key decisions
- Tree returns `OrgNode[]` for backward compat + `tenantTree: OrgNode` (single root with phantom tenant node) for `OrgChartView`
- Color assignment is deterministic via `hashString(deptId) % PALETTE.length` — stable across re-renders
- Department cards use `max-w-[220px]` on agent cards which causes truncation of long names/designations — **layout fix pending**

### Pending: Layout issues (in progress as of 2026-07-20)
- Large empty padding on right/left inside the container
- Employee Name & Designation getting cut off due to `max-w-[220px]` on `EmployeeCard`

### Disaster recovery snapshots taken
- `20260720-123951-pre-orgchart-deploy` — before any org chart changes
- `20260720-125808-pre-orgchart-viz` — before new visualization components
- `20260720-131158-pre-orgchart-colors` — before dept-colors utility

---

## 1. Architecture Overview

### Current Problems
```
departments/page.tsx
└── OrgChartTab
    └── inline TreeView (departments only, no agents, no drag-drop, no search)
        └── buildTree() — client-side flat→tree, no parent→child edges shown visually

features/org-chart/
├── useOrgChart.ts          ← moveAgent() only mutates local state (NO API call)
├── OrgChartSidebar.tsx     ← FULLY implemented but NEVER imported anywhere (DEAD CODE)
└── OrgChartNode.tsx        ← Agent cards + Dept headers, used only by OrgChartSidebar
```

### After Fix
```
departments/page.tsx
└── OrgChartTab
    └── <OrgChartSidebar />  ← replaces inline TreeView entirely
        └── useOrgChart.ts   ← moveAgent() calls agentRepository.update()
            └── AgentRepository.update() → PATCH /agents/:id { departmentId }
```

### SOLID Principles Applied
- **SRP**: Each module has one reason to change
  - `useOrgChart.ts`: pure data orchestration (tree building, search, DnD state, API calls)
  - `OrgChartSidebar.tsx`: layout + interaction wiring only
  - `OrgChartNode.tsx`: pure presentational nodes (AgentNode + DeptNode)
  - `agentStore.ts`: client-side cache + `moveAgent` action
- **OCP**: `OrgChartNode` uses data-driven maps for status/mood — extend without modifying
- **DIP**: `useOrgChart` depends on `useAgentStore`/`useDepartmentStore` abstractions, not direct API calls
- **ISP**: `useOrgChart` return interface is focused (not bloated)
- **LSP**: `OrgNode` is a proper data structure substitutable anywhere the tree is consumed

---

## 2. Tasks

### Task 1 — Fix `Department` Domain Type
**File:** `frontend-tenant/src/shared/types/domain.types.ts`

The shared `Department` type is missing fields that the Prisma schema and API provide:
- `parentId?: string | null` — for hierarchy
- `status?: DepartmentStatus` — ACTIVE | INACTIVE
- `headAgentId?: string` — department head
- `_count?: { agents: number }` — agent count (added by Prisma include)

**Action:**
```typescript
export type DepartmentStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Department {
  id: EntityId;
  name: string;
  description?: string;
  tenantId: EntityId;
  parentId?: string | null;
  status?: DepartmentStatus;
  headAgentId?: string | null;
  _count?: { agents: number };
  agentCount: number;
  activeAgentCount: number;
  completedTasksToday: number;
  harmonyScore: number;
  createdAt: ISODateString;
}
```

**Notes:**
- `DepartmentStatus` must be added as a new type (not imported from backend)
- Keep all existing fields intact
- Import `DepartmentStatus` type from `@prisma/client` in a types file if needed, but since this is frontend-only, define as a local union type

---

### Task 2 — Add `moveAgent` to Agent Store + Repository
**Files:**
- `frontend-tenant/src/stores/agentStore.ts`
- `frontend-tenant/src/core/repositories/AgentRepository.ts`
- `frontend-tenant/src/shared/constants/api-endpoints.ts`

**Problem:** `moveAgent()` in `useOrgChart.ts` only mutates local `overrides` state. The API call to persist the department reassignment is missing.

**Analysis:**
- Backend `PATCH /agents/:id` accepts `departmentId` in `UpdateAgentDto` ✅ (line 68 of `update-agent.dto.ts`)
- Backend `AgentsService.update()` handles `departmentId` ✅ (line 266-268 of `agents.service.ts`)
- `AgentRepository.update()` already calls `PATCH /agents/:id` ✅ (line 69 of `AgentRepository.ts`)
- BUT: `departmentId` is NOT in `UpdateAgentDto`'s type being sent — `UpdateAgentDto` in `AgentRepository.ts` line 22 does NOT include `departmentId`

**Action:**

1. **Add `moveAgent` to `agentStore.ts`:**
```typescript
interface AgentState {
  // ... existing fields
  moveAgent: (agentId: string, departmentId: string) => Promise<void>;
}
```

```typescript
moveAgent: async (agentId, departmentId) => {
  set((state) => ({
    agents: state.agents.map((a) =>
      a.id === agentId ? { ...a, departmentId } : a,
    ),
  }));
  try {
    await agentRepository.update(agentId, { departmentId });
  } catch (err) {
    // Rollback on failure
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, departmentId: a.departmentId } : a,
      ),
    }));
    throw err;
  }
},
```

2. **Verify `AgentRepository.UpdateAgentDto`** already accepts `departmentId` — confirm `UpdateAgentDto` in `AgentRepository.ts` line 22 extends to include it (it does not currently — `UpdateAgentDto` has `isActive`, `status`, `name`, etc. but NOT `departmentId`).

**Fix `AgentRepository.ts`:**
```typescript
export type UpdateAgentDto = Partial<CreateAgentDto> & {
  isActive?: boolean;
  status?: string;
  departmentId?: string | null;  // ADD THIS
};
```

---

### Task 3 — Wire `moveAgent` in `useOrgChart.ts` to Store
**File:** `frontend-tenant/src/features/org-chart/hooks/useOrgChart.ts`

**Problem:** `moveAgent` at line 137 only calls `setOverrides`. The store's `moveAgent` is never called.

**Action:**
```typescript
import { useAgentStore } from '@/stores/agentStore'; // already imported

// Replace the existing moveAgent callback with:
const moveAgent = useCallback(async (agentId: string, toDeptId: string) => {
  // Optimistic local update
  setOverrides((prev) => ({ ...prev, [agentId]: toDeptId }));
  setExpanded((prev) => new Set([...prev, toDeptId]));

  // Persist to backend
  try {
    await useAgentStore.getState().moveAgent(agentId, toDeptId);
  } catch {
    // Revert optimistic update on failure
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
  }
}, []);
```

**Notes:**
- The `moveAgent` return type must change from `void` to `Promise<void>` in `UseOrgChartReturn`
- `useCallback` deps are `[]` — store is accessed via `getState()` to avoid stale closure issues

---

### Task 4 — Remove Inline `Department` Interface from `departments/page.tsx`
**File:** `frontend-tenant/src/app/departments/page.tsx`

**Problem:** Lines 62–73 define a local `Department` interface that shadows the shared domain type. This causes `parentId`, `status`, `_count` to exist in the local interface but the shared `domain.types.ts` `Department` doesn't have them yet.

**Action:**
- Delete the local `interface Department` at lines 62–73
- Delete the local `interface AgentLite` at lines 75–80 (if `Agent` from domain.types covers it — it does: `Agent` has `id`, `name`, `status`, `departmentId`)
- Import `Department` and `Agent` from `@/shared/types/domain.types`
- Add `_count` to the domain `Department` type (Task 1 handles this)

**After fix, the page.tsx should import:**
```typescript
import type { Department, Agent } from '@/shared/types/domain.types';
```

And remove the local `Department` and `AgentLite` interfaces.

---

### Task 5 — Replace `OrgChartTab` TreeView with `OrgChartSidebar`
**File:** `frontend-tenant/src/app/departments/page.tsx`

**Problem:** `OrgChartTab` (lines 464–502) uses a custom inline `TreeView` that only shows departments, no agents, no drag-drop, no search. `OrgChartSidebar.tsx` has everything but is dead code.

**Action:**
1. Import `OrgChartSidebar` in `departments/page.tsx`
2. Replace the `OrgChartTab` body with an inline sidebar panel that wraps `OrgChartSidebar`

**However**, `OrgChartSidebar` is designed as a slide-in panel (`isOpen`/`onClose`). For the tab, we need it always visible.

**Solution:** Create a new component `OrgChartPanel` (in `features/org-chart/components/`) that:
- Renders `OrgChartSidebar` content directly (no animation wrapper, no conditional `isOpen`)
- Is a self-contained panel layout (header + search + tree)
- Shares the same `useOrgChart` hook

**New file:** `frontend-tenant/src/features/org-chart/components/OrgChartPanel.tsx`
```typescript
// ─── OrgChartPanel.tsx ───────────────────────────────────────────────────────
// SRP: Full org chart panel for the OrgChartTab — replaces inline TreeView.
// OCP: Node rendering delegated to OrgChartNode components.
// DIP: Data from useOrgChart hook (not direct API calls).

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrgChart } from '@/features/org-chart/hooks/useOrgChart';
import { AgentNode, DeptNode } from '@/features/org-chart/components/OrgChartNode';
import { GitBranch } from 'lucide-react';

export function OrgChartPanel() {
  const {
    filteredTree,
    query,
    selectedId,
    draggingId,
    isLoading,
    setQuery,
    select,
    setDragging,
    moveAgent,
    expandedDepts,
    toggleDept,
  } = useOrgChart();

  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState<{
    agentId: string; agentName: string; toDeptId: string; toDeptName: string;
  } | null>(null);

  const handleDragOver = (e: React.DragEvent, deptId: string) => {
    e.preventDefault();
    setDragOverDeptId(deptId);
  };

  const handleDragLeave = () => setDragOverDeptId(null);

  const handleDrop = (e: React.DragEvent, deptId: string, deptName: string) => {
    e.preventDefault();
    const agentId = e.dataTransfer.getData('agentId');
    if (!agentId || agentId === deptId) {
      setDragOverDeptId(null);
      return;
    }
    const agentNode = filteredTree
      .flatMap((d) => d.children ?? [])
      .find((a) => a.id === agentId);
    if (agentNode) {
      setConfirmMove({ agentId, agentName: agentNode.name, toDeptId: deptId, toDeptName: deptName });
    }
    setDragOverDeptId(null);
    setDragging(null);
  };

  const confirmMoveAction = async () => {
    if (!confirmMove) return;
    await moveAgent(confirmMove.agentId, confirmMove.toDeptId);
    setConfirmMove(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-status-strategy" />
        Organization chart
      </h2>

      <div className="card-surface">
        {/* Search bar */}
        <div className="p-4 border-b border-surface-border">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">🔍</span>
            <input
              type="search"
              placeholder="Search agents or departments…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-overlay py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-accent-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tree */}
        <nav className="p-4 max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-surface-raised animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && filteredTree.length === 0 && (
            <p className="text-center text-sm text-zinc-500 py-8">
              {query ? 'No results found.' : 'No departments yet.'}
            </p>
          )}

          {filteredTree.map((dept) => {
            const isExpanded = expandedDepts.has(dept.id);
            return (
              <div key={dept.id} className="mb-1">
                <DeptNode
                  node={dept}
                  isExpanded={isExpanded}
                  isDragOver={dragOverDeptId === dept.id}
                  onToggle={() => toggleDept(dept.id)}
                  onDragOver={(e) => handleDragOver(e, dept.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dept.id, dept.name)}
                />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-6 pr-2 mt-1 space-y-1"
                    >
                      {(dept.children ?? []).length === 0 ? (
                        <p className="py-2 text-center text-xs text-zinc-600">No agents</p>
                      ) : (
                        dept.children!.map((agent) => (
                          <AgentNode
                            key={agent.id}
                            node={agent}
                            isSelected={selectedId === agent.id}
                            isDragging={draggingId === agent.id}
                            onSelect={select}
                            onDragStart={setDragging}
                            onDragEnd={() => setDragging(null)}
                          />
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Hint */}
        <div className="px-4 py-3 border-t border-surface-border">
          <p className="text-xs text-zinc-600">
            Drag agents between departments to reorganize • Click department to expand
          </p>
        </div>
      </div>

      {/* Confirm move dialog */}
      <AnimatePresence>
        {confirmMove && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmMove(null)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-[60] w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-sm font-semibold text-zinc-100">Confirm Restructure</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Move <strong className="text-zinc-200">{confirmMove.agentName}</strong> to{' '}
                <strong className="text-zinc-200">{confirmMove.toDeptName}</strong>?
              </p>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmMove(null)}
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMoveAction}
                  className="rounded-lg bg-accent-500 px-4 py-1.5 text-sm text-white hover:bg-accent-600 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Then update `OrgChartTab`:**
```typescript
function OrgChartTab() {
  return (
    <div className="space-y-4">
      <OrgChartPanel />
    </div>
  );
}
```

**`OrgChartSidebar.tsx` decision:** Keep it as-is. It is used by the drawer/sidebar navigation pattern and remains the canonical drag-drop+search org chart component. `OrgChartPanel` duplicates its logic but in a different layout context (tab panel vs. slide-in sidebar). Both share `useOrgChart` hook.

> **Note on duplication:** The render logic in `OrgChartPanel` and `OrgChartSidebar` overlaps ~80%. To strictly avoid duplication (OCP), `OrgChartPanel` could accept a `layout` prop ('tab' | 'sidebar') and render differently. However, the sidebar has `AnimatePresence` + width animation that doesn't apply to the tab layout. The duplication is layout-specific, not logical, so it's acceptable. If it bothers future maintainers, extract a third `OrgChartTree` component that handles the tree rendering only, with `OrgChartPanel` and `OrgChartSidebar` as thin wrappers.

---

### Task 6 — Fix `OrgTree` Sidebar Component (Optional Cleanup)
**File:** `frontend-tenant/src/components/sidebar/OrgTree.tsx`

**Issues:**
- Direct API calls instead of using `departmentRepository` / `agentRepository`
- Ignores `parentId` hierarchy (flattens to just dept→agent)
- `limit=50` for departments may miss orgs with more

**Action:**
- Refactor to use `departmentRepository.findAll()` and `agentRepository.findAll()` instead of raw `api.get()`
- Add `parentId` awareness for hierarchical display in the drawer

```typescript
import { departmentRepository } from '@/core/repositories/DepartmentRepository';
import { agentRepository } from '@/core/repositories/AgentRepository';

// In useEffect:
const [deptResult, agentResult] = await Promise.all([
  departmentRepository.findAll({ limit: 100 }),
  agentRepository.findAll({ limit: 200 }),
]);
const depts = deptResult.items;
const agents = agentResult.items;
```

This is **lower priority** — the drawer tree works and is a secondary view. Can be done in a follow-up.

---

### Task 7 — Add `GET /departments/tree` Backend Endpoint (Optional)
**Files:**
- `backend/src/modules/departments/departments.controller.ts`
- `backend/src/modules/departments/services/departments.service.ts`
- `frontend-tenant/src/core/repositories/DepartmentRepository.ts`
- `frontend-tenant/src/shared/constants/api-endpoints.ts`

**Problem:** Frontend reconstructs the tree from flat API response client-side. A nested tree endpoint would be more efficient.

**Analysis:** The current `findAll` already returns `children: true` via Prisma `include`. The tree can be built client-side efficiently. This is a performance optimization, not a bug. **Defer to a future iteration.**

---

## 3. Implementation Order

| Order | Task | Reason |
|-------|------|--------|
| 1 | Task 1 — Fix `Department` type | All other tasks depend on correct types |
| 2 | Task 2 — Add `moveAgent` to store+repo | Critical bug fix; unblocks everything |
| 3 | Task 3 — Wire `moveAgent` in hook | Critical bug fix continuation |
| 4 | Task 4 — Remove local shadow interfaces | Cleanup; prevents future type confusion |
| 5 | Task 5 — Replace TreeView with OrgChartPanel | Main feature enhancement |
| 6 | Task 6 — Fix OrgTree sidebar (optional) | Nice-to-have cleanup |

---

## 4. File Changes Summary

### Backend (no changes needed for core fix)
The backend `PATCH /agents/:id` with `departmentId` is already fully implemented:
- `update-agent.dto.ts:68` — `departmentId?: string | null` ✅
- `agents.service.ts:266-268` — handles `departmentId` in update ✅
- `departments.service.ts:19-27` — `findAll` includes `children` ✅

### Frontend Files Modified

| File | Change |
|------|--------|
| `shared/types/domain.types.ts` | Add `parentId`, `status`, `headAgentId`, `_count` to `Department` |
| `stores/agentStore.ts` | Add `moveAgent` action |
| `core/repositories/AgentRepository.ts` | Add `departmentId` to `UpdateAgentDto` |
| `features/org-chart/hooks/useOrgChart.ts` | Wire `moveAgent` → `agentStore.moveAgent()`; update return type |
| `app/departments/page.tsx` | Remove local `Department`/`AgentLite`; replace `OrgChartTab` with `OrgChartPanel` |
| `features/org-chart/components/OrgChartPanel.tsx` | **NEW** — full org chart panel for tab |

### Frontend Files Reviewed (no changes)

| File | Reason |
|------|--------|
| `features/org-chart/components/OrgChartSidebar.tsx` | Dead code but keep — used by sidebar drawer |
| `features/org-chart/components/OrgChartNode.tsx` | No changes needed |
| `components/sidebar/OrgTree.tsx` | Works; refactor in follow-up if needed |
| `shared/constants/api-endpoints.ts` | No changes needed |
| `core/repositories/DepartmentRepository.ts` | Already correct |

---

## 5. Verification Plan

After implementation, verify:

1. **`/departments?tab=org-chart`** renders a proper hierarchical tree with:
   - Top-to-bottom department hierarchy (parent → children → agents)
   - Agent cards under each department (avatar, name, status dot, mood emoji, workload bar)
   - Expand/collapse per department
   - Search filters both departments and agents

2. **Drag-and-drop**:
   - Drag an agent card onto a different department header
   - Confirm dialog appears
   - After confirm, agent moves to new department
   - On page refresh, agent is still in the new department (API persisted)

3. **No regressions**:
   - Departments tab still works (cards + KPIs)
   - Sidebar drawer OrgTree still works
   - All other tabs (Tasks, Workflows, etc.) unchanged

4. **TypeScript**: `npm run typecheck` passes with no errors in `frontend-tenant/`

5. **Build**: `npm run build` completes without errors

---

## 6. Implementation Notes (2026-07-20)

### Tasks 1–6: ALL COMPLETED ✅

All 6 tasks from the plan were implemented and deployed to Contabo (4 deploys total):

| Task | Status | Notes |
|---|---|---|
| Task 1 — Fix `Department` domain type | ✅ | `parentId`, `status`, `headAgentId`, `_count` added to `Department` |
| Task 2 — `moveAgent` to store + repo | ✅ | Optimistic update in `agentStore.ts` + `departmentId` added to `UpdateAgentDto` |
| Task 3 — Wire `moveAgent` in hook | ✅ | `useOrgChart.ts` now calls `agentStore.moveAgent()` with rollback |
| Task 4 — Remove local shadow interfaces | ✅ | `departments/page.tsx` imports from `domain.types` |
| Task 5 — Replace TreeView with OrgChartPanel | ✅ | New `OrgChartView` + `DeptCard` + `EmployeeCard` + `dept-colors` |
| Task 6 — Fix OrgTree sidebar | ✅ | Refactored to use repositories instead of raw `api.get()` |

### LAYOUT ISSUES: IN PROGRESS 🟡

As of 2026-07-20, the following layout issues are being addressed:
- Excessive empty padding on right/left inside the container
- Employee Name & Designation text getting cut off due to `max-w-[220px]` on `EmployeeCard`

Files involved:
- `frontend-tenant/src/features/org-chart/components/EmployeeCard.tsx` — `max-w-[220px]` truncating name/designation
- `frontend-tenant/src/features/org-chart/components/DeptCard.tsx` — `w-64` fixed width
- `frontend-tenant/src/features/org-chart/components/OrgChartView.tsx` — outer wrapper
- `frontend-tenant/src/features/org-chart/components/OrgChartPanel.tsx` — outer container padding

# NeureCore Projects — Full Concept (v2)

**Workspaces, Not Task Containers: An Architecture for AI-Operated Professional Services**

---

## 1. Vision

A Project in NeureCore is not a task list with a client name attached. It is a **living workspace** — the full digital operating environment for one client engagement, containing everyone (human and AI) working on it, everything decided, everything known, everything produced, and everything spent.

```
Customer
  └── Project
        └── Workspace
             ├── Humans
             ├── AI Employees
             ├── Goals
             ├── Conversation / Threads
             ├── Project Memory
             ├── Decision Registry
             ├── Knowledge
             ├── Documents
             ├── Deliverables
             ├── Timeline
             ├── Financials
             ├── Tasks
             └── Analytics
```

**Architectural note:** Workspace is a logical/UI concept, not a separate database entity. Every item above hangs directly off `projectId` — Workspace is the operational *view* that presents them together, not another layer to model, migrate, or query through. This avoids an unnecessary indirection layer; "Workspace" should appear in the UI and in documentation, not as a table.

Tasks are one component inside the workspace — not the center of it. The center is the **Goal**: everything else exists to move a goal forward, produce evidence of a decision, or leave a record that the next person (or agent, or future project) can learn from.

---

## 2. Customer — The Persistent Relationship

Unchanged from prior design, restated for completeness.

- `name`, `industry`, `primaryContacts[]`, `billingInfo`, `relationshipStartDate`, `lifetimeValue` (derived), `tags`, `status`
- One Customer → many Projects across time and departments
- Lightweight tenants can create a Project directly; a minimal Customer is auto-generated behind the scenes

---

## 3. Project — The Engagement Container

**Core fields:** `customerId`, `name`, `projectTypeId`, `industry`, contact fields, `targetDate`, `priority`, `budget`, `budgetType`, `description`, `departmentId`, `tags[]`

**Relationships:** `parentProjectId` (sub-projects), `clonedFromProjectId` (renewals inherit structure), `linkedProjectIds[]` (dependencies)

**Status lifecycle (branching):**
```
Lead → Proposal Sent → Won / Lost
Won  → Active ⇄ On Hold → Review → Completed → Archived
Lost → Archived (lostReason captured)
```

**Financials:** `budgetType` (Fixed Fee / Hourly / Retainer), time tracking, cost tracking, `InvoiceMilestone[]`, derived profitability (budget vs. time × rate + expenses + agent compute cost)

---

## 4. ProjectType — Industry Templates, Tenant-Customized

```
ProjectType (id, tenantId, name, industry, version)
ProjectTypeVersion (id, projectTypeId, version, fieldSchema jsonb,
                    stageTemplate jsonb, approvalChainTemplate jsonb,
                    goalTemplate jsonb, roleTemplate jsonb) — immutable
Project (..., projectTypeId, projectTypeVersion, customFieldValues jsonb)
```

Versioned so editing a tenant's template never retroactively changes a Project already in flight. `goalTemplate` and `roleTemplate` are new in v2 — a Tax engagement preset now ships with its standard goals ("File return by deadline," "Zero penalty exposure") and its standard org roles (Preparer, Reviewer, Partner) pre-wired, the same way it already ships stages and fields.

---

## 5. Goals — What Tasks Are Actually For

```
Goal
 ├── projectId
 ├── statement — a business outcome, not an activity
 │     ("Win UNICEF Contract", not "Create Proposal")
 ├── measurable criteria — how success is verified
 ├── targetDate
 ├── status: NOT_STARTED → IN_PROGRESS → AT_RISK → ACHIEVED → MISSED
 └── linkedTaskIds[] / linkedDeliverableIds[]
```

Hierarchy is now:

```
Project → Goals → Tasks → Deliverables
```

**Design rule (explicit, not implied):** a Goal must represent a business outcome, never an activity. "Win UNICEF Contract" is a Goal. "Build Proposal" and "Submit Proposal" are Tasks (or Deliverables) that serve it. If a proposed Goal reads like something that could be marked "done" in an afternoon by completing one action, it isn't a Goal — this should be enforced at creation time (validation or UI guidance), not left to convention, or tenants will drift toward creating task-like goals and the rollup in §5 stops meaning anything.

Goal progress is a **derived rollup** of its linked tasks and deliverables — never a manually-typed percentage. If nothing under a goal has moved in N days, that's a health signal (see §11), not a silent stall.

---

## 6. Task — The Atomic Unit AI Employees Execute

```
Task
 ├── projectId, stageId, goalId
 ├── assignedAgent (AI Employee) or assignedHuman
 ├── acceptanceCriteria
 ├── inputContext — prior task outputs + relevant Project Memory,
 │                  auto-chained, not re-entered
 ├── expectedOutput — {type, schema}
 ├── capabilityTags[]
 ├── status: QUEUED → IN_PROGRESS → NEEDS_REVIEW → APPROVED / REJECTED
 └── executionLog[]
```

Decomposition is either template-driven (from `stageTemplate`) or dynamic (a Planner agent reading the Goal and generating a task list on the fly).

---

## 7. Deliverable — First-Class, Not a Task Byproduct

A deliverable is the actual thing handed to the client — a Tax Return, a Proposal, a Contract, a Report, a Website, a Training Manual. It deserves its own lifecycle independent of whichever task produced its first draft, because a deliverable typically survives multiple tasks, multiple revisions, and multiple approvers.

```
Deliverable
 ├── projectId, goalId
 ├── type (Proposal / Report / Contract / ...)
 ├── owner
 ├── versions[] — every draft retained, never overwritten
 ├── approvals[] — see §9
 ├── comments[]
 ├── status: DRAFT → INTERNAL_REVIEW → CLIENT_REVIEW → SIGNED/PUBLISHED → ARCHIVED
 └── publicationRecord — where/when it was sent or filed
```

Tasks *contribute to* a Deliverable's versions; the Deliverable, not the Task, is what the client actually sees and what compliance later cares about.

---

## 8. Project Memory — The Shared Intelligence Layer

This was the sharpest gap in the prior design. Agent Memory belongs to one AI Employee and dies with context resets or reassignment. **Project Memory belongs to the engagement itself** — any human or agent working the project can read and write it, and it persists for the life of the Project (and can be seeded into a renewal via `clonedFromProjectId`).

```
ProjectMemory
 ├── projectId
 ├── entryType: ASSUMPTION | PREFERENCE | STYLE_NOTE | REJECTED_IDEA |
 │              MEETING_SUMMARY | LESSON_LEARNED
 ├── content
 ├── source — who/what created it (human, agent, meeting transcript)
 ├── confidence — how certain this is still true
 └── supersededBy — link to a newer entry if this was later overturned
```

Example: a UNICEF proposal engagement accumulates the client's writing-style preference, a rejected budget structure, and a lesson learned from a stalled review cycle — all queryable by any agent picking up work six weeks later, without re-reading every prior thread.

**Memory is living knowledge, not permanent fact.** A preference recorded in 2025 ("client prefers Word") may be false by 2028 ("client only accepts Google Docs"). Entries carry `confidence` and `supersededBy` precisely because memory ages — an agent reading a memory entry should treat older, unconfirmed entries with appropriately lower weight, and the Knowledge Manager role (§12) should periodically review high-use, aging entries rather than assuming anything written once stays true for the life of the engagement.

**Boundary with Agent Memory:** Agent Memory = "what this agent has learned about doing its job generally." Project Memory = "what this specific engagement has taught anyone working on it." An agent should read both when starting a task; it should only ever write durable, engagement-specific facts to Project Memory.

---

## 9. Approval — The Trust Layer

```
Approval
 ├── taskId / deliverableId
 ├── requestedBy (AI Employee)
 ├── approverRole
 ├── approvalType: INTERNAL | CLIENT_FACING | DUAL (sequential)
 ├── status: PENDING → APPROVED | REJECTED | CHANGES_REQUESTED
 ├── feedback — becomes the agent's next inputContext on rejection
 └── slaDeadline
```

**Risk-tiered chains**, defined per ProjectType:

| Risk tier | Example | Requirement |
|---|---|---|
| Low | Internal research summary | Auto-approved, logged |
| Medium | Draft client email | Single internal reviewer |
| High | Filed tax return, signed contract | Dual approval + audit trail |
| Critical | Anything with legal/financial liability | Human-only — AI cannot self-approve |

---

## 10. Decision Registry — Institutional Memory of Choices

Distinct from the Execution Log by design. **Execution Log records what happened. Decision Registry records why a choice was made** — including decisions that produced no task activity at all (e.g., "we decided not to pursue the upsell").

```
Decision
 ├── projectId
 ├── statement — "Increase budget by 15%"
 ├── reasoning
 ├── evidence[] — can cite Execution Log entries, Memory entries, documents
 ├── alternativesConsidered[]
 ├── createdBy — Human | AI | System, plus actor identity
 ├── approvedBy — optional; required when createdBy = AI and risk tier warrants it
 ├── confidence
 └── outcome — filled in later: did this decision work out
```

**Ownership rule:** any of Human, AI, or System automation can *create* a Decision entry — an AI Employee proposing "we should increase the budget" is itself worth recording, even before anyone signs off. But `approvedBy` is what makes a Decision **authoritative**: an AI-created decision with no `approvedBy` is a proposal, not a settled fact, and should be visually/semantically distinguished as such wherever Decisions are surfaced (Timeline, Digital Twin, BI). This mirrors the risk-tiered Approval logic in §9 rather than inventing a second authority model.

A Decision can *cite* log entries as evidence; a log entry never implies a decision was made. This is what lets someone answer "why did we increase the budget?" months later without re-reading chat history — and, over time via `outcome`, lets the system learn which kinds of decisions tend to pay off.

---

## 11. Execution Log — Immutable Audit Trail

Unchanged in principle from v1: append-only, no UPDATE/DELETE grant on the app's DB role, records every AI action, tool call, and human decision with a timestamp and a reasoning trace. Deliverable versions (§7) are the durable artifacts; the Execution Log is the durable *proof* of how each version came to exist.

---

## 12. AI Employees — Capability, Autonomy, and Organizational Roles

**Capability registry (unchanged from v1):** `capabilityTags[]`, `tools[]`, `industryModules[]`, per-capability `autonomyLevel` (SUGGEST_ONLY / DRAFT / ACT_WITH_APPROVAL / ACT_AUTONOMOUSLY), `performanceStats`.

**Extended organizational roles per project** — this is what makes a NeureCore project behave like a staffed team rather than a pile of independent bots:

| Role | Responsibility |
|---|---|
| Project Director | Overall accountability for the engagement |
| Project Manager | Day-to-day coordination, sequencing, deadlines |
| Research Lead | Gathers and synthesizes information |
| Quality Lead | Owns acceptance criteria enforcement |
| Reviewer | Internal sign-off before client sees anything |
| Compliance Officer | Owns risk-tier classification and audit posture |
| Client Liaison | Client-facing communication |
| Documentation Lead | Keeps Knowledge and Deliverables organized |
| Knowledge Manager | Curates and prunes Project Memory |

Roles are assigned per project (from `roleTemplate`), not hardcoded per agent — the same AI Employee might be Reviewer on one engagement and Research Lead on another.

---

## 13. Chief of Staff — The Default Project-Facing Coordinator

Every Project automatically gets one Chief of Staff agent. Its job is not to *do* the work — it's to watch everything else happening in the workspace and be the primary surface a human talks to.

**Responsibilities:** watches all agent activity, coordinates handoffs between roles, summarizes status on request or on schedule, detects blockers before they become escalations, reminds humans of pending approvals, prepares meeting briefs, generates client-ready reports, keeps stakeholders updated.

**Design decision this forces (flagged, not yet resolved):** if Chief of Staff is the default conversational surface, is it the *only* one? Two options:
- **Routed** — humans always talk to Chief of Staff, which delegates internally and reports back. Simpler mental model, but adds a hop for anyone who wants to talk to a specific specialist directly.
- **Open** — humans can talk to Chief of Staff *or* any individual agent directly; Chief of Staff is the default/summary view, not a mandatory gateway.

Recommendation: start Open. Force-routing everything through one agent is a bigger behavioral commitment than the rest of this architecture requires, and it's reversible later if usage data shows people want the simpler routed experience.

---

## 14. Activity Timeline — Git-Style Project History

Not the raw Execution Log (too granular, agent-facing) — a human-readable narrative feed, and the natural default homepage for a project:

```
Research completed
   ↓
Finance approved
   ↓
Client uploaded files
   ↓
Proposal regenerated
   ↓
Legal approved
   ↓
Version 8 delivered
```

Built as a curated view *over* the Execution Log, Decision Registry, and Deliverable version history — not a separate write path, to avoid a second source of truth drifting out of sync with the underlying records.

---

## 15. Health Score — Predictive, Not Just Budget/Timeline

Extends the original three signals (budget burn, timeline, activity) with the qualitative ones that actually predict trouble earlier:

- Communication slowdown (thread response time trending up)
- Approval delays (time-in-queue trending up)
- Agent confidence (self-reported confidence trending down on a task type)
- Rework frequency (rejection/revision rate trending up)
- Dependency failures (linked/blocking projects slipping)
- Knowledge gaps (tasks stalling on missing Project Memory or documents)
- Client sentiment (derived from thread tone, response cadence)
- Meeting frequency (unusual drop or spike)
- Risk accumulation (Decision Registry entries flagged high-risk with no resolution)

Health becomes a composite, weighted score rather than a single rule — genuinely AI-scored, not a fixed formula, since these signals interact (e.g., low agent confidence *plus* approval delay is a much stronger risk signal than either alone).

---

## 16. Digital Twin — Ask the Project What's Happening

**Important architectural note:** this is a *query and synthesis layer*, not a new data store. Building it as its own write path would let it drift out of sync with Memory, Decisions, Deliverables, Financials, and Timeline. It should be built last, as retrieval-augmented synthesis over everything above:

> "What's happening?" → Digital Twin reads current Goals, open blockers, pending Approvals, recent Decisions, Health Score, and Timeline, and answers in one paragraph.

Because it's a read layer, it can ship incrementally — start with a summary over just Timeline + Health, then widen its retrieval scope as the underlying stores mature.

---

## 17. Cross-Project Intelligence — The Long-Term Moat

The system stops managing work and starts learning from it:

> "This project resembles 17 previous engagements. Average completion: 28 days. Common risk: client review delay. Suggested template: Healthcare Proposal v4. Expected margin: 42%."

**Reality check on sequencing:** this requires *volume* — enough completed, well-tagged projects for pattern-matching to beat noise. It should be architected for now (every Project, ProjectType, Decision, and Health outcome tagged with enough structured metadata to be comparable later) but the matching/recommendation engine itself is a later-stage build, gated on having enough completed engagements in the system to learn from.

---

## 18. Business Intelligence

Unchanged in principle — the payoff of the structured data above, computed as rollups rather than new instrumentation.

| Audience | Key views |
|---|---|
| Owner/Partner | Revenue by customer/industry, pipeline value, win rate, margin per project type, agent ROI |
| Ops Manager | At-risk projects, SLA breaches, approval backlog, agent utilization |
| Team Lead | Task throughput per agent, rejection/revision rates, bottleneck stages |
| Client (portal) | Their own project status, upcoming deliverables, invoices |

Chief of Staff (§13) is the natural agent to generate the AI narrative digests version of this, on schedule, per project.

---

## 19. Full Feature Map (v2)

| Layer | Feature | Purpose |
|---|---|---|
| Customer | Persistent relationship record | Recurring clients, lifetime value |
| Project | Branching lifecycle, parent/child, clone/renewal | Real engagement relationships, not flat containers |
| ProjectType | Versioned schema, stage, approval, goal, role templates | Fast onboarding per industry, safe evolution |
| Goal | Business outcome, measurable, drives Tasks | Tasks trace to something that matters, not just activity |
| Task | Acceptance criteria, structured input context | Defines "done," routes to the right agent |
| Deliverable | First-class, versioned, approved, published | What the client actually receives, independent of task churn |
| Project Memory | Shared, engagement-scoped, queryable by any agent | Institutional knowledge that survives reassignment |
| Decision Registry | Why choices were made, evidence-linked | Answers "why did we..." without re-reading chat history |
| Approval | Risk-tiered chains, feedback loop | Trust gate for AI-produced client work |
| Execution Log | Immutable, reasoning trace | Compliance-grade proof of what happened |
| Agent Roles | Director/Manager/Reviewer/Compliance/etc. per project | Behaves like a staffed team, not a pile of bots |
| Chief of Staff | Default project-facing coordinator | Single point of visibility without hiding specialists |
| Health Score | Predictive, multi-signal, AI-weighted | Catches risk before budget/timeline alone would show it |
| Activity Timeline | Git-style narrative feed | Human-readable project homepage |
| Digital Twin | Query/synthesis layer over everything | "What's happening?" answered in one place |
| Cross-Project Intelligence | Pattern-matching across completed engagements | Long-term moat — needs volume to pay off |
| Business Intelligence | Role-based dashboards + narrative digests | Revenue, margin, agent ROI, bottlenecks |
| Client Portal | Scoped external view | Product surface, not just internal tool |
| Template Marketplace | Installable industry presets | Distribution and stickiness, later-stage |

---

## 20. What This Changes About Build Order

The core sequencing from the prior version still holds (Customer/Project split → ProjectType → Task → Approval/Execution Log). This revision adds three things that are cheap to stub now and expensive to retrofit later:

1. **`Goal` table and `Task.goalId`** — add alongside the Task model in Phase 1, even before Goal-rollup logic is built. Retrofitting "which goal did this task serve" onto thousands of historical tasks is painful; the FK costs nothing today.
2. **`ProjectMemory` table** — a flat, simple entryType/content/source table can exist from day one, written to manually or by agents, with no retrieval intelligence built on top of it yet. The value compounds the earlier it starts capturing entries.
3. **`Decision` table, separate from Execution Log** — same logic. Cheap to add now; expensive to reconstruct from log history later.

Digital Twin and Cross-Project Intelligence remain correctly sequenced last — they're synthesis and pattern-matching layers that need the stores above to be populated and stable before they can produce anything trustworthy.

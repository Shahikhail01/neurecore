# Frozen Scope — Autonomous Work Layer Reconstruction

**Document:** NC-AWL-IMP-1 Phase 0
**Date:** 2026-07-26
**Status:** ACTIVE — In effect until G0 passes

---

## Prohibited Until G0 Passes

The following are **frozen** and **must not be committed** until G0 gate approval:

### Expansion Prohibited
- Additional industries or sub-industries beyond current 16
- New AI employee templates unrelated to the golden path (accounting/bookkeeping scenario)
- New dashboards, navigation areas, or workspace variants
- Additional autonomy modes beyond L1 governed draft execution
- Multi-agent collaboration beyond what the golden path requires
- Cosmetic redesign unrelated to usability blockers
- Broad marketplace expansion
- New orchestration frameworks (no new LangGraph concepts)
- New infrastructure products without approved architectural need

### Refactoring Prohibited
- Unrelated refactors that do not enable, protect, or reduce risk in the golden path
- Repository-wide refactors not named in the Phase 0 findings
- Blind replacement of legacy Prisma mutations without Phase 0 evidence
- Introduction of Redis/BullMQ without G0 queue durability decision

### Code Changes Prohibited
- Modifying enterprise initiation, project creation, or task execution flows (until Phase 0 complete)
- Changing AI employee template resolution or spawning logic
- Altering the Hermes tool registration without Phase 0 forensics
- Introducing new module boundaries or NestJS dependency changes

---

## Preserved (Safe to Maintain)

The following are **explicitly preserved** and must not be broken:

### Core Platform
- Authentication, authorization, tenant isolation (JWT, guards, decorators)
- Customers, departments, projects, industry configuration
- Existing frontend shell and workspace patterns
- Prisma/PostgreSQL persistence where validated
- AI employee templates and deployment concepts (Agent, AgentTemplate)
- Approval, audit, observability, policy concepts
- LangGraph where it serves governed orchestration (OfficialAgentGraph)
- Existing in-process and database-polling mechanisms (temporary)

### Ongoing Maintenance Safe
- Bug fixes in existing stable modules
- Performance optimizations
- Security hardening
- Database migrations for existing schemas
-枯edenant isolated feature flags already deployed
- Documentation updates

---

## Emergency Exceptions

Any exception to this freeze requires:
1. Written approval from Architecture Owner
2. Named issue linking to golden path blocker
3. Characterization tests proving no regression
4. Expiry date (maximum 5 business days)

---

## Verification

Before any golden path work, verify:
```bash
# Check for any modified mutation entry points
git diff --name-only origin/main -- 'src/modules/**/services/*.ts' | head -20
```

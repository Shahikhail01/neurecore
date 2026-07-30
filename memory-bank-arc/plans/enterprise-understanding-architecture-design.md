# AI-Native Enterprise Understanding — Architectural Design & Migration Strategy

**Version:** 2.2 (Design only — no code) — **ARCHITECTURE FROZEN 2026-07-14**
**Supersedes:** v2.1 (added Decision stage, promoted Understanding to a foundation phase, froze architecture); v2.0; v1.0
**Date:** 2026-07-14
**Status:** FROZEN — ADR-011/012/013/014 ratified; Enterprise Understanding is a Phase 5 foundation capability; ready for Phase 2
**Grounded in:** `NeuroCore Architectural Constitution` (v1.0 + Amendment 1), `enterprise-integration-remediation-plan.md`, `phase-0-adrs-and-contracts.md` (ADR-001–014), `hermes-unification-plan.md`, Phase 1/1.1 EIE outcomes.

**v2.2 refinements (this revision):**
1. **Enterprise Decision stage added (ADR-014).** A distinct third cognitive stage between Recommendation and Governed Action, defining *who chooses among competing recommendations*: prioritization, composition, conflict resolution, human/AI authority, and multi-action execution planning. Closes the "who decides?" gap.
2. **Enterprise Understanding promoted to a foundation capability.** Moved from near-final Phase 10.5 to the **new Phase 5** (immediately after Work Runtime), so downstream capabilities (Finance, Google Workspace, UI, NESP) *build on* the cognitive layer instead of being retrofitted to it.
3. **Architecture frozen.** With ADR-011–014 ratified and the Constitution amended, the architecture is frozen: **no further redesign unless a constitutional contradiction or critical implementation issue is discovered.**

**v2.1 refinements (retained):**
1. Two→three distinct cognitive stages — *Understanding* ("what is happening?"), *Recommendation* ("what could we do?"), *Decision* ("what will we do?").
2. **Enterprise Understanding Layer (EUL)** (renamed from EIL) — outcome over mechanism.
3. Enterprise Understanding is the top-level capability; **Enterprise Initiation is one consumer.**

---

## 0. What changed across revisions (and why)

v1.0 was accepted for preserving the investment (EIE, Capability Packs, Question Packs, Continuous Discovery, Project Types) and hiding them behind a simpler experience, via a layer that owns no business logic. Refinements followed:

**v2.0 refinements**
1. **De-project-centered.** v1.0 resolved almost everything to `Intent → Project Type → Project`. "Hire a Country Director" is an **HR case**; "vendor sent an invoice" is an **invoice/AP** event; "vehicle broke down" is an **incident/asset** event. v2.0 made the layer **entity-agnostic**.
2. **Hermes decoupled.** v1.0 made Hermes the interpretation gateway. v2.0 separated **Enterprise Intake** and interpretation from Hermes; Hermes consumes understanding as *one channel* among many.
3. **Recommendation inserted.** v1.0 collapsed understanding into a project proposal; v2.0 added a recommendation stage.

**v2.1 refinements (this revision)**
1. **Two distinct cognitive stages, made explicit and separate.**
   - **Enterprise Understanding** answers *"What is happening?"* — and produces **understanding only, never actions.**
   - **Enterprise Recommendation** answers *"What should the organization do?"* — proposing organizational actions the operator (or authorized AI) may enact.
   Collapsing these two is the subtle source of project-centrism: if the only thing you can *produce* is a proposal, understanding silently becomes "propose a project." Separating them makes the system genuinely entity-agnostic.
2. **EIL → Enterprise Understanding Layer (EUL).** The name reflects the organizational outcome, not the software mechanism. Interpretation/normalization/inference/confidence remain internal to the EUL.
3. **Enterprise Understanding is the top-level capability; Enterprise Initiation is one consumer.** Understanding fans out to many consumers:
   ```
   Enterprise Understanding
        ├── Project Initiation          (one consumer, not the capability)
        ├── HR Case
        ├── Procurement
        ├── Legal Matter
        ├── Customer
        ├── Vendor
        ├── Opportunity
        ├── Incident
        ├── Contract
        ├── Risk
        └── Organizational Knowledge (record only)
   ```

**Worked example that only v2.1 handles cleanly — "Our office internet has been down since 9 AM."**
- **Enterprise Understanding** (what is happening): `INCIDENT` · `INFRASTRUCTURE` · `OFFICE_OPERATIONS`. No action implied.
- **Enterprise Recommendation** (what to do): *Create IT incident* · *Notify Infrastructure AI Employee* · *Escalate if unresolved in 30 min (SLA timer)* · *Inform affected department*.
- **No project involved.** Understanding stood on its own; recommendation proposed the actions; the operator/governance enacts.

Everything preserved across versions is still preserved. The machinery is unchanged; its framing is now complete.

---

## 1. The Core Reframe (Thesis)

> **The user — or any system — brings an intent or an input. NeuroCore turns it into enterprise understanding, recommends organizational action, and (under governance) acts.**

The pipeline has **six stages**, with **Understanding, Recommendation, and Decision as distinct stages**:

```
Enterprise Input            (from ANY channel)
      ↓
Enterprise Intake           (channel-agnostic normalization + provenance)
      ↓
Enterprise Interpretation   (internal to the EUL: normalize, infer, score)
      ↓
ENTERPRISE UNDERSTANDING    ← Stage 1 of cognition: "WHAT IS HAPPENING?"
                              structured, entity-agnostic, multi-subject.
                              Produces understanding ONLY. No actions.
      ↓
ENTERPRISE RECOMMENDATION   ← Stage 2 of cognition: "WHAT COULD WE DO?"
                              ranked, explainable candidate actions. Proposals.
      ↓
ENTERPRISE DECISION         ← Stage 3 of cognition: "WHAT WILL WE DO, BY WHOM,
                              IN WHAT ORDER?" prioritizes, composes, resolves
                              conflicts, resolves human/AI authority. A governed
                              plan — not execution. (ADR-014)
      ↓
Governed Action(s)          Project · Customer · Vendor · Contract · HR Case ·
                            Incident · Procurement · Asset · Invoice · Risk ·
                            Opportunity · Board Decision · Policy · Audit ·
                            Legal Matter · assign work · request approval ·
                            update existing entity · record knowledge · nothing
```

**Why three distinct cognitive stages:** *Understanding* describes reality ("a supplier submitted an invoice"). *Recommendation* proposes candidate responses ("record invoice; match PO; route to Finance"). *Decision* resolves *which* candidates execute, in what order, under whose authority, handling conflicts and composition (ADR-014). Fusing Understanding+Recommendation re-introduces project-centrism; omitting Decision leaves "who chooses among competing recommendations?" undefined and silently pushes decision logic into the UI or Hermes. Keeping all three separate lets the same understanding fan out to *any* consumer under governed decision — **Enterprise Initiation is one such consumer, not the capability itself.**

Project Types, Capability Packs, Question Packs, and the EIE remain the constitutional backbone — internal resolution mechanisms for *one family of outcomes among many*. The user's primary experience is: *"Tell me what's happening, or show me what you have, and I'll help the organization understand it and decide what to do."*

This fulfils Articles that the current type-first UI under-delivers:

| Constitution already says | v2.0 delivers |
|---|---|
| Art. II: capabilities belong to the Enterprise, consumed by **every** entity (Projects, Customers, Vendors, Risks, Contracts, Assets, Meetings, Policies…) | Understanding targets any entity, not just projects |
| Art. V: "Discovery is **not a wizard**… a continuous organizational process" | Understanding is ambient interpretation of any input |
| Art. VIII: "Users interact with the **organization, not merely with software screens**" | Understanding + recommendation is the organization responding |
| Art. XVIII: "The interface shall **adapt to the user**… business logic remains identical" | Many intake channels, one interpretation capability, one enterprise model |
| Art. XIX: "**Observe → Acquire Information → Reason → Decide → Execute**" | The loop now literally starts at Observe (an input), Reason (understanding), Decide (recommendation) |
| Art. XXV: "Complex internal capabilities → simple external experiences" | Types/Packs/EIE hidden behind understanding + recommendation |

---

## 2. Design Principles

1. **Input-first and channel-agnostic.** Understanding is triggered by an input from *any* channel; no channel is privileged, and no entity type is assumed.
2. **Entity-agnostic understanding.** Interpretation resolves *what kind of enterprise thing(s)* an input concerns — possibly several at once — before any single entity is created.
3. **Understand → Recommend → Act, as distinct stages.** The organization forms understanding, then proposes actions, then (under governance) executes. Each stage is a separate, inspectable artifact.
4. **Understanding is a capability, not Hermes.** Enterprise Intake and the Enterprise Understanding Layer are enterprise capabilities (Art. XVI) consumed by *all* channels including Hermes. Hermes is a conversational channel, not the brain. (The EUL performs interpretation internally; its externally-meaningful output is understanding.)
5. **Everything is a proposal until governed confirmation.** Understanding and Recommendation are drafts with provenance + confidence; Governance (Art. XIII) decides what may auto-commit.
6. **Provenance & confidence are mandatory** on every inferred fact and every recommended action (Art. XII, Art. V Information Sources).
7. **The EIE remains the single source of truth for "what we still need to know"** — for *whatever* entity is chosen. Interpretation pre-fills Information Responses; the EIE computes completeness and drives Continuous Discovery. No parallel information store.
8. **No mechanism is deleted.** Project Types → generalized to Entity Types; Capability/Question Packs, EIE, Adaptive Questioning, Continuous Discovery all remain and are strengthened.
9. **Reversibility.** Any understanding, recommendation, or action is inspectable, correctable, and reversible; the explicit type-first path always remains available.

---

## 3. Target Architecture — Three Capabilities + One Interface

### 3.1 Layered view (Hermes decoupled)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  CHANNELS (peers — none is privileged)                                           │
│  Hermes conversation · Email (Gmail) · WhatsApp · Teams · Slack · Zoom ·         │
│  Voice · Document upload · API · Scheduled jobs · IoT · ERP/CRM webhooks         │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ raw enterprise input(s)
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  ENTERPRISE INTAKE  ← NEW capability (channel-agnostic)                           │
│  Normalizes any input → NormalizedInput (+ durable InformationSource, Art. V)     │
│  Owns transport/format concerns ONLY. No business meaning.                        │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ NormalizedInput
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  ENTERPRISE UNDERSTANDING LAYER (EUL)  ← entity-agnostic cognition                 │
│  (internally: interpretation, normalization, inference, confidence scoring)       │
│  1. Intent & subject recognition   → what is this about? (may be several things)  │
│  2. Entity-kind resolution          → Project? Customer? Vendor? HR Case? …        │
│  3. For each candidate entity kind: consult the EIE for its Information            │
│     Requirements, and pre-resolve them from the input (with provenance/confidence)│
│  4. Relationship inference          → links to existing entities (Art. XI graph)  │
│  ── Produces ENTERPRISE UNDERSTANDING (Stage 1: "what is happening?") ──           │
│  Understanding is descriptive ONLY. Owns NO entity business logic — it CONSUMES.  │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ EnterpriseUnderstanding (entity-agnostic, multi-subject, no actions)
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  ENTERPRISE RECOMMENDATION  ← Stage 2 of cognition: "what should we do?"           │
│  Turns understanding into ranked, explainable ORGANIZATIONAL ACTIONS:             │
│    create/update entity · assign work · request approval · record knowledge ·     │
│    escalate · do nothing. Each action carries rationale + confidence + governance │
│    requirement. Recommends, does not execute.                                     │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ RecommendedAction[] (proposals)
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  GOVERNED EXECUTION — CONSUMERS OF UNDERSTANDING (existing capabilities)           │
│  Enterprise Initiation (Projects) is ONE consumer, alongside:                     │
│  Customers · Vendors · Contracts · HR · Incidents · Procurement · Assets ·        │
│  Finance · Risks · Approvals · Work Runtime · Memory · EIE                        │
│  Each action commits THROUGH the owning capability's existing API + governance.   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Why Intake, the EUL, and Hermes are three separate things

- **Enterprise Intake** owns *how an input arrives* (parse an email, transcribe a call, accept an API payload). It has **no business meaning**. It exists so that adding WhatsApp or Zoom later is an intake adapter, not a change to cognition.
- **Enterprise Understanding Layer (EUL)** owns *what an input means* to the enterprise. It is **entity-agnostic** and reused by every channel. Internally it performs interpretation, normalization, inference, and confidence scoring — but its *output* is understanding, not action.
- **Hermes** is **one channel** that (a) can submit inputs to Intake, and (b) can render Understanding + Recommendations conversationally and take the user's decision. Hermes **consumes** Understanding; it does not produce it. This keeps Hermes the *organizational interface* (Art. VIII) and prevents it from becoming the *enterprise brain*.

This answers the Hermes concern: an email arriving via Gmail intake produces the same Enterprise Understanding whether or not Hermes is ever involved.

### 3.3 Entity-agnostic domain concepts (bounded context: `enterprise-understanding`)

| Concept | Definition | Owner |
|---|---|---|
| `NormalizedInput` | Any input reduced to structured text + metadata + attachments + durable `InformationSource` | Intake |
| `InterpretationSession` | Stateful, resumable interpretation of one or more inputs | EUL |
| `SubjectHypothesis` | "This input concerns a **new Customer**" / "a **Procurement opportunity**" / "a **Legal review**" — ranked, with confidence + rationale. An input may yield **several**. | EUL |
| `EntityKind` | The generalized target: `PROJECT | CUSTOMER | VENDOR | CONTRACT | HR_CASE | INCIDENT | PROCUREMENT | ASSET | INVOICE | RISK | OPPORTUNITY | BOARD_DECISION | POLICY | AUDIT | LEGAL_MATTER | KNOWLEDGE_ONLY` (extensible) | EUL |
| `ProposedResponse` | A pre-filled Information Response (for whichever entity kind) with source + confidence, not yet committed | EUL → EIE |
| `EnterpriseUnderstanding` | Stage 1 output. The entity-agnostic, descriptive model: subjects, candidate entity kinds, inferred facts (as ProposedResponses), relationships to existing entities, and preview completeness per candidate. **Contains no actions.** | EUL |
| `RecommendedAction` | Stage 2 output. A proposed organizational action (create/update/assign/approve/record/escalate/none) with rationale, confidence, and governance requirement | Recommendation |
| `ActionDecision` | Human/authorized-AI confirm / modify / reject of a recommended action | Recommendation + Governance |

**Critical constraint (unchanged from v1.0, now generalized):** `ProposedResponse`/`EnterpriseUnderstanding`/`RecommendedAction` are **staging** concepts. On confirmation, each action commits **through the owning capability's existing API** (e.g., project creation via Projects; a customer via Customers; information via the EIE Response API from Phase 1.1). Never a parallel store. This preserves Art. IV and Art. XVI and the SOLID boundary you valued.

### 3.4 Generalizing "Project Type" → "Entity Type"

Project Types are one family of Entity Types. The EIE (Art. IV) is *already* defined as entity-agnostic ("Every entity in NeuroCore may consume this capability… Projects, Customers, Vendors, Employees, Departments, Grants, Risks, Contracts, Assets, Meetings, Policies"). Two internal mechanisms must generalize (as internal work, hidden from users):
- **Type registry** generalizes from `ProjectType` to `EntityType` (Project remains one kind). The current `ProjectType → ProjectTypePacks → QuestionPack` linkage generalizes to `EntityType → CapabilityPacks → QuestionPacks`.
- **Requirement resolution** (`resolveApplicable`, Phase 1.1) already keys on an `entityType`/`entityId` pair — it is not project-specific by design. It generalizes cleanly.

This generalization is an **internal mechanism evolution**, scheduled (not done now), and does not alter the user experience or the Constitution's intent.

---

## 4. The Pipeline (generalized, entity-agnostic, with worked examples)

```
INPUT → NormalizedInput → Understanding(subjects, entity-kinds, pre-fills, relationships)
      → Recommendation(actions[]) → Decision → Governed commit (per action) → Continuous Discovery
```

**Example A — "I need to hire a Country Director." (no project)**
- Understanding: subject = staffing need; entity kind = `HR_CASE` (recruitment); relationships = Department (Country Ops).
- Recommendation: *Open HR Case (Recruitment)* · *Draft job description (knowledge)* · *Request hiring approval (approval)* · *Assign to HR AI Employee (work)*.
- No project created. Completeness/Continuous Discovery now run against the **HR Case** entity.

**Example B — "Vendor sent an invoice." (no project)**
- Understanding: entity kinds = `INVOICE` + possibly `VENDOR` (if unknown) ; relationships = existing Vendor, maybe a Contract.
- Recommendation: *Record Invoice* · *Match to PO/Contract* · *Route to Finance approval* · (if vendor unknown) *Create Vendor*.
- No project. Finance capability owns commit.

**Example C — "Our vehicle broke down." (no project)**
- Understanding: entity kinds = `INCIDENT` + `ASSET` (the vehicle).
- Recommendation: *Log Incident* · *Update Asset status* · *Create maintenance task/work* · maybe *Raise Risk* if safety-related.

**Example D — Uploaded tender document (multi-subject, understand before acting)**
- Understanding (multiple subjects at once): *new Customer* ✓ · *Procurement/Bid opportunity* ✓ · *Legal review required* ✓ · *bid deadline* ✓ · *Finance review* ✓ · *Compliance review* ✓.
- Recommendation (ranked, none auto-executed): *Create Customer?* · *Create Opportunity?* · *Assign Legal?* · *Assign Finance?* · *Prepare Bid (Project)?* · *Record deadline (Calendar/Timeline)?*
- **Notice: no project yet.** The organization understands first; the human (or authorized AI) chooses which actions to take. A bid *may* become a project — but only as one selected action.

**Example E — "FinanceHub wants us to run their Q3 regulatory exam." (a project — still supported)**
- Understanding: entity kind = `PROJECT` (candidate type: Regulatory Examination) + relationship to existing Customer FinanceHub.
- Recommendation: *Create Regulatory Examination project* (pre-filled budget/dates from input) · *Confirm 2 gaps*.
- This is v1.0's flow — now correctly a *special case* of the general model, not the whole model.

**After commit, nothing changes:** the chosen entity's EIE completeness, supersession, appliesWhen, and Continuous Discovery behave exactly as Phase 1/1.1 proved.

---

## 5. Required Constitutional Changes

The Constitution is **preserved**; changes are additive/clarifying (Art. XXVI). v2.0 revises the amendment set from v1.0.

### 5.1 New foundational principle — elevate "intent or input"
Add to the **Preamble / The NeuroCore Principle** (the sentence you flagged as constitutional):
> *"An organization is operated through understanding, not through forms. **The user — or any system — brings an intent or an input.** NeuroCore's task is to understand it, recommend organizational action, and execute under governance. Understanding precedes action; action is governed; knowledge is the residue of both."*

### 5.2 New Article XXVIII — Enterprise Understanding (replaces v1.0's "Enterprise Initiation")
> *"NeuroCore shall accept enterprise inputs in their natural form — conversation, email, meeting, voice, document, sensor, or system event — through channel-agnostic intake, and interpret them into **entity-agnostic Enterprise Understanding**: candidate subjects, candidate entity kinds, inferred information (with source and confidence), and relationships to the enterprise graph. From understanding, NeuroCore shall produce **Enterprise Recommendations** — one or more proposed organizational actions, which may create or update any enterprise entity, assign work, request approvals, or simply record knowledge, or recommend no action. Understanding and recommendation shall be explainable, reversible, and governed before commitment. Interpretation is an enterprise capability, not the property of any single interface."*

The last sentence constitutionally forbids Hermes (or any channel) from owning interpretation — answering Concern 2 at the constitutional level.

### 5.3 Clarify Article IV (EIE) — entity-agnostic mechanism, not a surface
> *"The Enterprise Information Engine is an internal capability serving **every** entity kind. Users and entities need not interact with Information Requirements, Question Packs, or Entity Types directly. Higher-level capabilities (Enterprise Understanding) may present a simpler experience while consuming the EIE underneath. The EIE remains the single source of truth for information completeness for whichever entity is chosen, regardless of how information was acquired."*

### 5.4 Clarify Article V (Continuous Discovery) — interpretation is an acquisition mode
> *"Information may also be acquired by **interpreting unstructured enterprise inputs** into pre-filled Information Responses (with source and confidence) for whichever entity the input concerns. Interpretation is a step of discovery, not a replacement for it; completeness and gaps continue to be governed by the Enterprise Information Engine."*

### 5.5 Reaffirm Article VIII (Hermes) — interface, not brain
No text change required, but the design record must state: *Hermes consumes Enterprise Understanding as one channel; it does not own intake or interpretation.* (Art. XXVIII §5.2 makes this binding.)

### 5.6 What must NOT change
- Art. II, XVI (capabilities belong to the Enterprise; entities never duplicate capability logic) — Intake, Interpretation, Recommendation are capabilities.
- Art. XIII (Governance before automation) — recommended actions commit only under governance.
- Art. IV ownership — the EIE stays the information source of truth.

---

## 6. Required Changes to the Integration Roadmap

**v2.1 reordering (per architecture review):** Enterprise Understanding is **not a UI feature** — it is the enterprise's **cognitive layer**, sitting above almost everything (Google Workspace, email, Projects, HR, Procurement, Finance, Legal, Risk, Memory, AI Employees). It is therefore **promoted from Phase 10.5 to a foundation capability at the new Phase 5**, immediately after Work Runtime. Downstream capabilities then *build on* Understanding rather than being retrofitted to it. The ratified 12-phase roadmap is preserved and re-sequenced; nothing is removed.

### 6.1 Revised roadmap

| Phase | Change |
|---|---|
| 0 | **Add 4 ADRs** (see §6.2) — ADR-011/012/013/014, before Phase 2, because they add event/contract surface. **RATIFIED.** |
| 1 / 1.1 | ✅ Done. `resolveApplicable`/reactive completeness are entity-keyed — the cognitive layer builds on them |
| 2 | Event Fabric — **reserve** entity-agnostic intake/understanding/recommendation/decision/action event types (7 reserved) |
| 3 | Context Plane — must expose context for **all** entity kinds (customers, vendors, assets, HR, prior decisions) so Understanding can infer relationships (Art. XI) |
| 4 | Work Runtime — decided actions of kind "assign work" route here |
| **NEW 5 — Enterprise Cognitive Layer (foundation)** | **Enterprise Intake** (channel-agnostic normalization + provenance) + **Enterprise Understanding Layer (EUL)** (entity-agnostic understanding, consuming EIE + Entity-Type registry) + **Enterprise Recommendation** (understanding → ranked actions) + **Enterprise Decision** (prioritization/composition/conflict/authority/multi-action planning — ADR-014). Built as capabilities behind a flag; downstream phases consume them. |
| 6 (was 5) | Enterprise Work Transport & A2A — work handoffs may originate from decided "assign work" actions |
| 7 (was 6) | Governance & Approval Integration — **Approval Port is the commit gate for decided actions**; auto-commit per ADR-012 |
| 8 (was 7) | Project & Tenant Finance — invoice/AP outcomes flow from Understanding→Decision (a non-project consumer) |
| 9 (was 8) | Organizational Memory — ingests understanding, recommendations, decisions, and human corrections (learning signal, Art. XIX) |
| 10 (was 9) | Google Workspace — reframed as **one Enterprise Intake channel** (Gmail/Drive/Calendar), consuming the Phase 5 cognitive layer |
| 11 (was 10) | Browser Workflow Completion — **expand** to the cognitive surface (composer, Understanding panel, Recommendation cards, Decision plan view); type-first wizard becomes fallback |
| 12 (was 11) | NESP re-execution — **amend** to start from a real input via intake, produce understanding → recommendation → decision, and prove **both a project and a non-project outcome** end-to-end |

**Net effect:** the roadmap grows from 12 to 13 phases; Enterprise Understanding moves from near-final (10.5) to foundational (5). Phases formerly 5–11 shift by one.

### 6.2 Four ADRs ratified in Phase 0 (before Phase 2) — DONE
- **ADR-011 — Enterprise Understanding contract.** `NormalizedInput`, `EnterpriseUnderstanding`, `EntityKind` registry, EUL↔EIE contract (proposals commit via each capability's existing API). Entity-agnostic. Understanding is descriptive only.
- **ADR-012 — Provenance & Confidence model.** Uniform `Provenance` on every inferred fact and action; auto-commit thresholds gated by the Approval Port (Art. XIII).
- **ADR-013 — Enterprise Recommendation & Action contract.** `RecommendedAction`, `EntityKind` → owning-capability commit API, governance per action kind; keeps Recommendation from owning entity logic.
- **ADR-014 — Enterprise Decision contract.** The cognition→execution bridge: prioritization, composition, conflict resolution, human/AI authority, and multi-action execution planning (`DecisionPlan`/`DecisionStep`/`DecisionAuthority`). Consumes the Approval Port + `IGovernanceEvaluator`; owns no entity/governance logic.

**Why now:** the Event Fabric (Phase 2) and Approval Port (Phase 7) must reserve entity-agnostic understanding/recommendation/decision/action events and auto-commit approvals. Ratifying these in Phase 0 avoids a contract-breaking retrofit.

### 6.3 Dependency order
```
Phase 1.1 (EIE, entity-keyed) ─┐
Phase 2 (Event Fabric) ────────┤
Phase 3 (Context Plane, all entities) ─┼─► Phase 5 COGNITIVE LAYER ─────────────────► downstream phases
Phase 4 (Work Runtime) ────────┤        (Intake → Understanding → Recommendation      (6–11 consume it)
Phase 7 (Approvals = commit gate)┘         → Decision)                                 → Phase 12 NESP
```
The cognitive layer requires Events (2), Context (3), and Work Runtime (4) to exist first, then everything downstream (Finance, Google WS, UI, NESP) consumes it.

---

## 7. Required Changes to the UI

### 7.1 Reposition the type-first wizard (unchanged from v1.0)
The 3-step project wizard becomes the **fallback / power-user path** and a **confirmation surface** for the specific case where the chosen action is "create a project."

### 7.2 New primary surfaces (generalized)
| Surface | Behaviour |
|---|---|
| **"What's happening?" composer** (Home + global ⌘K) | Free text or dropped input → Intake → EUL → shows an **Understanding** panel, then **Recommendation** cards |
| **Enterprise Understanding panel** | "I understand this as: *new Customer* (92%), *Procurement opportunity* (88%), *Legal review needed* (81%). Pre-filled *n* facts from your *tender.pdf*." Each subject + fact shows a provenance chip |
| **Recommendation cards** | Ranked actions: *Create Customer* · *Create Opportunity* · *Assign Legal* · *Prepare Bid (Project)* · *Record deadline* · *Do nothing* — each with rationale, confidence, and "requires approval" badge where governance applies. Multi-select; the user chooses which to enact |
| **Gap-only Discovery** (per chosen entity) | Only after an action creates/updates an entity; shows only unresolved required questions for **that entity kind** (Phase 1.1 completeness) |
| **Intake inbox** | Inputs from email/WhatsApp/API/etc. appear as pending understandings to review and act on |

### 7.3 Explainability (Art. XII) and reversibility
- Every inferred fact and every recommended action carries a **provenance + confidence chip** and an expandable rationale ("why we think this is a Procurement opportunity").
- "Not this" reclassifies a subject; "Change entity kind" re-resolves; the explicit type-first path is always available ("Start a project manually").

### 7.4 Non-goals
- Not a generic wizard framework.
- Entity-Type/Pack management stays in the admin portal (configuration, not user vocabulary).

---

## 8. Required Changes to Hermes

Hermes is the conversational **channel** (Art. VIII), the single execution engine per the Hermes Unification Plan — **not** the interpreter.

### 8.1 Hermes consumes Understanding; it does not produce it
- A user can tell Hermes "FinanceHub wants a Q3 exam" → Hermes submits the utterance to **Enterprise Intake**, receives **Enterprise Understanding** + **Recommendations** back, and renders them conversationally.
- Hermes calls Intake/Interpretation as **capabilities/tools**; it holds no interpretation logic. (Reinforces Art. XVI and the integration audit's ownership discipline.)

### 8.2 Hermes is one of many channels
- The identical Understanding is produced when input arrives via Gmail intake with no Hermes involvement. Hermes has no privileged position in the pipeline.

### 8.3 Hermes renders recommendations and captures decisions
- Hermes presents recommended actions conversationally and records the human's `ActionDecision`. Execution then flows through the owning capability + governance — Hermes does not bypass Approvals or the EIE.

### 8.4 AI Employees may interpret inbound work (Art. VI, VII, XX)
- An intake event (e.g., email) can trigger an Intake/Interpretation run via the Work Runtime (Phase 4); an Intake AI Employee produces *proposed* recommendations for human confirmation — "Human governs → AI executes within boundaries."

---

## 9. Required Changes to Enterprise Workflows

### 9.1 Understanding is event-driven (Art. XVII) — entity-agnostic events
Reserved in Phase 2 (contracted in ADR-011/013):
- `enterprise.input.received` (any channel)
- `enterprise.understanding.formed` (subjects + entity-kinds + pre-fills + relationships)
- `enterprise.recommendation.proposed` (ranked actions)
- `enterprise.action.decided` (confirm/modify/reject, per action)
- On enact → the **owning capability's existing event** fires (`enterprise.project.created`, or a customer-created / invoice-recorded / hr-case-opened event). No change downstream.

### 9.2 Recommended actions commit under governance (Art. XIII, Phase 6)
- Each `RecommendedAction` declares its governance requirement. Auto-commit is allowed only above a confidence threshold **and** below a risk tier (ADR-012); everything else awaits confirmation. Segregation of duties (Art. XIII) and progressive autonomy (Art. XIV) apply: an AI Employee may *recommend*; a human or higher-autonomy AI *enacts*.

### 9.3 The primary enterprise chain (verification protocol) becomes input-driven and multi-outcome
- New chain start: **inbound input (email/doc/utterance) → intake → understanding → recommendation → operator selects action(s) → owning capability commits → EIE completeness (for created entities) → Continuous Discovery → work → …**
- The Phase 11 NESP is amended to exercise **at least one non-project outcome** (e.g., an invoice or HR case) alongside a project outcome, proving the model is genuinely entity-agnostic.

### 9.4 Understanding, recommendation, and correction are organizational memory (Art. X, XIX)
- Every understanding, the recommendations shown, and the human's choice/correction persist via Phase 8 Organizational Memory. Corrections ("this wasn't a project, it was an incident") are high-value learning signal feeding the Enterprise Learning Loop (Art. XIX).

---

## 10. Migration Strategy (additive, zero-regression — Art. XXVI)

### Stage A — Contracts (in Phase 0, before Phase 2)
- Author ADR-011 (Understanding), ADR-012 (provenance/confidence + auto-commit), ADR-013 (Recommendation & Action).
- Reserve entity-agnostic intake/understanding/recommendation/action events in the Event Fabric taxonomy.
- Amend the Constitution: Preamble principle (§5.1), new Art. XXVIII Enterprise Understanding (§5.2), clarify Art. IV & V, reaffirm Art. VIII. Preserve original text; append dated amendments.

### Stage B — Foundations (Phases 2–9 as planned)
- No Understanding code yet. Ensure Event Fabric, Context Plane (all entity kinds), Work Runtime, Approvals, and Google WS *intake* expose the hooks the new capabilities need.

### Stage C — Intake + Interpretation + Recommendation behind a flag (Phases 10.4–10.6)
- Implement as three capabilities consuming EIE + Entity-Type registry + owning capabilities. **Feature-flagged OFF** (mirrors the Hermes Unification `HERMES_ENABLED` pattern: service-first, backward-compatible).
- Start entity-agnostic from day one (support at least Project, Customer, Vendor, HR Case, Incident, Invoice) to avoid re-introducing project bias.

### Stage D — UI (Phase 10 expansion)
- Ship the composer + Understanding panel + Recommendation cards **alongside** the existing wizard. Wizard remains reachable. Gap-only Discovery reuses Phase 1.1 completeness per entity.
- Progressive rollout on the mock tenant; measure understanding accuracy, recommendation acceptance, and correction rate per entity kind.

### Stage E — Flip the default (post-validation)
- Make the composer the default entry once accuracy + governance are proven. No capability removed; type-first wizard remains the explicit fallback.

### Stage F — Verify (Phase 11 NESP, amended)
- Re-run the simulation initiating from a real email and a real document, proving input → understanding → recommendation → **both a project and a non-project outcome** end-to-end in the browser.

### Rollback
- The feature flag is the rollback: OFF returns the platform to the proven type-first path with zero data loss (understanding/recommendation are staging artifacts; commits always went through existing capability APIs).

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Interpretation mis-classifies entity kind | Understanding is multi-subject + ranked; recommendations are proposals; human enacts; corrections feed learning; provenance/confidence always shown |
| Re-introducing project bias | Entity-agnostic from Stage C; NESP must prove a non-project outcome; `EntityKind` registry is first-class, not project-derived |
| EUL/Recommendation becomes a monolith owning entity logic | Capability boundary (Art. XVI): they only *consume*; commits go through each owning capability's API; ADR-011/013 make this a contract |
| Hermes becomes the enterprise brain | Constitution Art. XXVIII forbids interface-owned interpretation; Intake + Interpretation are separate capabilities; Hermes calls them as tools |
| Parallel information store forks the EIE | Hard rule: ProposedResponses persist only on enact, through the EIE Response API (Phase 1.1) |
| Auto-commit erodes governance | ADR-012 thresholds gated by Approval Port (Art. XIII); default is human-enact |
| Who chooses among competing recommendations? | ADR-014 Enterprise Decision: prioritization, composition, conflict resolution, human/AI authority, multi-action planning — a governed plan, owned by neither UI nor Hermes |
| Scope creep after freeze | Architecture FROZEN 2026-07-14; only a constitutional contradiction or critical implementation issue may reopen it |

---

## 12. What Changes vs What Stays

**Stays (preserved):**
- Entire Constitution (Preamble principle + 1 new article + 2 clarifications, all additive — Amendment 1)
- Project Types (as one Entity Type), Capability Packs, Question Packs, EIE, Adaptive Questioning, Continuous Discovery
- Phase 1/1.1 reactive completeness (entity-keyed — the cognitive layer builds on it)
- The ratified roadmap (re-sequenced from 12 to 13 phases, nothing removed)
- The type-first wizard (repositioned as fallback + project-confirmation)
- Hermes Unification model (Agent/HermesAgent/HermesRuntime)

**Changes (v2.0 → v2.2, now frozen):**
- **Three distinct cognitive stages**: *Understanding* ("what is happening?", descriptive), *Recommendation* ("what could we do?", candidate actions), *Decision* ("what will we do, by whom, in what order?", governed plan — ADR-014)
- **Enterprise Understanding is the top-level capability; Enterprise Initiation (Projects) is one consumer**, alongside HR Case, Procurement, Legal, Customer, Vendor, Opportunity, Incident, Contract, Risk, Knowledge-only
- **Renamed**: Enterprise Interpretation Layer (EIL) → **Enterprise Understanding Layer (EUL)**
- **Entity-agnostic**: `EnterpriseUnderstanding` targets any `EntityKind`, not predominantly projects
- **Hermes decoupled**: new **Enterprise Intake** capability; Hermes is one channel consuming the cognitive layer, not the interpreter/brain
- Project Type → generalized Entity-Type registry (internal mechanism)
- **4 ADRs ratified (011–014)**; event taxonomy + Approval Port reserve entity-agnostic understanding/recommendation/decision/action
- **Enterprise Understanding promoted to Phase 5 foundation** (was 10.5); roadmap re-sequenced 12→13 phases; Google WS reframed as a channel; final NESP proves a non-project outcome
- Constitution: new Preamble principle, new Art. XXVIII (Enterprise Understanding + Recommendation + Decision), clarified Art. IV & V, reaffirmed Art. VIII
- **Architecture FROZEN 2026-07-14**

---

## 13. Readiness Gate (before Phase 2) — SATISFIED

All four ratified (no code):
1. ✅ **Constitution amendments** — Preamble principle ("the user — or any system — brings an intent or an input"), new Art. XXVIII (Understanding + Recommendation + Decision), clarified Art. IV & V, reaffirmed Art. VIII. (Applied to `NeuroCore Architectural Constitution`, Amendment 1.)
2. ✅ **ADR-011 (Understanding), ADR-012 (Provenance/Confidence + auto-commit), ADR-013 (Recommendation & Action), ADR-014 (Enterprise Decision)** — ratified in `phase-0-adrs-and-contracts.md`.
3. ✅ **Event Fabric taxonomy (Phase 2)** to reserve 7 entity-agnostic events: `enterprise.input.received`, `.understanding.formed`, `.recommendation.proposed`, `.decision.planned`, `.plan.decided`, `.action.decided`, plus owning-capability create/update.
4. ✅ **Roadmap re-sequenced** (12→13): Enterprise Understanding promoted to **Phase 5** foundation; Google WS = a channel (Phase 10); final NESP (Phase 12) proves a non-project outcome.

**Architecture freeze rule (in effect 2026-07-14):**
> No further architectural redesign unless a **constitutional contradiction** or a **critical implementation issue** is discovered. Effort now shifts from inventing the platform to **building** it. Ready to proceed with **Phase 2 — Enterprise Event Fabric**.

**This document is design + migration strategy only. No code, schema, or production change is proposed here.**

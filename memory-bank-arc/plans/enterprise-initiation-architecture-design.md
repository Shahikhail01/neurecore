# AI-Native Enterprise Initiation — Architectural Design & Migration Strategy

**Version:** 1.0 (Design only — no code)
**Date:** 2026-07-13
**Status:** PROPOSED — for review before Phase 2 begins
**Grounded in:** `NeuroCore Architectural Constitution` (v1.0), `enterprise-integration-remediation-plan.md` (Phases 0–11), `phase-0-adrs-and-contracts.md`, `hermes-unification-plan.md`, `onboarding-progressive-wizard.md`, Phase 1/1.1 EIE outcomes.

---

## 0. The Core Reframe (Thesis)

Today a user *initiates work* by choosing a **Project Type**, which links **Capability Packs**, which resolve **Question Packs** through the **EIE**, which drives a **Discovery wizard**. The user experiences the *implementation mechanism* directly: they must know that their engagement is a "Wealth Management Account (CLIENT_ENGAGEMENT)" and then answer a form.

**This design inverts the experience without replacing the machinery.**

> The user brings an **intent or an input** — a sentence to Hermes, a forwarded email, an uploaded proposal, a meeting transcript, a scanned contract. NeuroCore **interprets** that input into enterprise understanding: it *infers* the likely Project Type(s), *pre-answers* Information Requirements from the input's content with provenance and confidence, *surfaces only the genuine gaps*, and *proposes* an initiation the human confirms or corrects.

Project Types, Capability Packs, and the EIE remain the constitutional backbone — but they become **internal resolution mechanisms**, not the primary surface. The primary surface becomes **Enterprise Initiation**: *"Tell me what's happening, or show me what you have, and I'll organize it into the enterprise."*

This is not a new idea grafted onto NeuroCore — it is the **literal fulfilment of five existing Articles** that the current wizard-first UI under-delivers:

| Constitution already says | Current reality | This design |
|---|---|---|
| Art. V: "Discovery is **not a wizard**. Discovery is a continuous organizational process." | Discovery *is* a wizard | Discovery becomes ambient interpretation + continuous gap-filling |
| Art. VIII: "Users should interact with the **organization, not merely with software screens**." | Users fill a typed form | Users converse / drop inputs; Hermes organizes |
| Art. XVIII: "The interface shall **adapt to the user** … Users choose interfaces. Business logic remains identical." | One form-first path | Multi-modal initiation over identical EIE logic |
| Art. XXV: "**Complex internal capabilities should produce simple external experiences.**" | Internal complexity is the external experience | Project Types/Packs/EIE hidden behind interpretation |
| Art. XIX: "Enterprise Learning Loop: **Observe → Acquire Information → Reason → Decide → Execute…**" | Loop starts at "Acquire via form" | Loop starts at "Observe an input" |

**Conclusion:** the Constitution does **not** need to be rewritten. It needs a small number of **clarifying amendments** that make explicit what is currently implicit, plus one genuinely new capability (the Enterprise Interpretation Layer) that is fully consistent with Articles IV, V, and XVI.

---

## 1. Design Principles for Enterprise Initiation

1. **Input-first, not type-first.** The user is never *required* to name a Project Type. They may, but the default path is "give NeuroCore something to understand."
2. **Interpretation is a capability, not a feature.** It is consumed by any entity that can be initiated (Project, Customer, Vendor, Grant, Contract…), exactly as the EIE is (Art. IV, XVI).
3. **Everything is a proposal until a human (or authorized AI) confirms.** Interpretation produces a *draft understanding* with provenance and confidence; governance (Art. XIII) decides what may auto-commit.
4. **Provenance is mandatory.** Every inferred fact records its source (email, doc, transcript, utterance), extraction method, and confidence (Art. XII Explainability, Art. V Information Sources).
5. **The EIE is the single source of truth for "what we still need to know."** Interpretation *pre-fills* Information Responses; the EIE still computes completeness and drives Continuous Discovery. No parallel information store.
6. **No mechanism is deleted.** Project Types, Capability Packs, Question Packs, EIE, Adaptive Questioning all remain and are strengthened; they move *behind* the interpretation layer.
7. **Reversibility.** A user can always fall back to explicit Type selection + form (the current path), and can always inspect/override any interpretation.

---

## 2. Target Architecture — The Enterprise Interpretation Layer (EIL)

### 2.1 Where it sits

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ENTERPRISE INITIATION SURFACE                       │
│   Hermes conversation · Email intake · Document drop · Meeting transcript   │
│   Voice · "Start something" quick action · API · (fallback) Type picker     │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │ raw enterprise input(s)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                ENTERPRISE INTERPRETATION LAYER (EIL)  ← NEW capability       │
│                                                                            │
│  1. Ingestion & Normalization   — turn any input into a NormalizedInput     │
│  2. Intent & Entity Recognition — "this is an engagement / a customer /…"   │
│  3. Type Inference              — rank candidate Project Types (+ confidence)│
│  4. Requirement Pre-Resolution  — map input content → Information Responses  │
│  5. Gap Synthesis               — ask EIE: given pre-fills, what's missing?  │
│  6. Initiation Proposal         — a reviewable draft understanding          │
│                                                                            │
│  Produces provenance + confidence for every inferred fact.                  │
│  Owns NO business logic of Projects/Types/EIE — it CONSUMES them.           │
└───────┬───────────────────────────────────────────────┬────────────────────┘
        │ consumes (read/resolve)                        │ writes (as proposals)
        ▼                                                ▼
┌───────────────────────────┐              ┌────────────────────────────────┐
│  INTERNAL MECHANISMS       │              │   EIE (unchanged ownership)     │
│  (now hidden from user)    │              │   - Information Requirements    │
│  - Project Types           │◄────────────►│   - Question Packs (Capability) │
│  - Capability Packs        │  type→packs  │   - Information Responses       │
│  - ProjectTypePacks link   │  →questions  │   - Information Sources         │
│                            │              │   - Entity Completeness         │
│                            │              │   - Adaptive Questioning        │
│                            │              │   - Continuous Discovery        │
└───────────────────────────┘              └────────────────────────────────┘
```

### 2.2 The EIL is a capability (Art. XVI), consumed like the EIE

The EIL does not own Projects, Types, or the EIE. It orchestrates them:
- It **asks** the Type registry to rank candidate types for a normalized input.
- It **asks** the EIE to resolve the applicable Information Requirements for a candidate type.
- It **proposes** Information Responses (with `sourceType`, `sourceLabel`, `confidence`) that the EIE records exactly as any other response — so Phase 1.1's reactive completeness, supersession, and Continuous Discovery all apply unchanged.
- It **emits** enterprise events (Art. XVII) for every interpretation, proposal, and confirmation.

### 2.3 New domain concepts (bounded context: `enterprise-initiation`)

| Concept | Definition | Owner |
|---|---|---|
| `NormalizedInput` | Any enterprise input reduced to structured text + metadata + attachments + provenance handle | EIL |
| `InterpretationSession` | A stateful, resumable interpretation of one or more inputs toward an initiation | EIL |
| `EntityCandidate` | A ranked hypothesis: "this is a Project of Type X" / "this is a new Customer" (+ confidence, + rationale) | EIL |
| `ProposedResponse` | A pre-filled Information Response with source + confidence, not yet committed | EIL → EIE |
| `InitiationProposal` | The reviewable draft: chosen entity kind, chosen type, pre-filled responses, remaining gaps, completeness preview | EIL |
| `InitiationDecision` | Human/authorized-AI confirm / correct / reject of a proposal | EIL + Governance |

**Critical constraint:** `ProposedResponse` and `InitiationProposal` are *staging* concepts. On confirmation, they are written **through the EIE's existing Response API** (Phase 1.1 `ProjectCompletenessService` path) — never into a parallel table. This preserves Art. IV ("Information shall never belong exclusively to Projects") and avoids the capability-duplication failure the integration audit flagged.

---

## 3. The Interpretation Pipeline (behavioural, not code)

```
INPUT → NormalizedInput → Intent → Type Candidates → Requirement Pre-fill
      → Gap Synthesis (EIE) → Initiation Proposal → Human/AI Decision
      → Commit (via EIE + Projects) → Continuous Discovery takes over
```

1. **Ingestion & Normalization.** Email/doc/transcript/utterance → `NormalizedInput` with a durable `InformationSource` reference (Art. V). Attachments preserved. This reuses the existing Document Extraction and Interview channels the EIE already defines as valid acquisition modes.

2. **Intent & Entity Recognition.** Classify: is the user initiating a *project*, registering a *customer*, logging a *risk*, capturing a *meeting decision*? The EIL supports multiple target entity kinds (Art. II — capabilities belong to the Enterprise, consumed by many entities).

3. **Type Inference.** For a project intent, rank candidate `ProjectType`s using the type registry's metadata (industry, classification, keywords) against the normalized input. Output: top-N candidates with confidence + human-readable rationale ("mentions 'audit', 'regulator', 'Q3 filing' → Regulatory Examination"). The **user never had to know these types exist**; they see "This looks like a Regulatory Examination — is that right?" with alternatives one click away.

4. **Requirement Pre-Resolution.** For the leading candidate, the EIL asks the EIE to resolve applicable Information Requirements (the Phase 1.1 `resolveApplicable` path), then maps input content onto them as `ProposedResponse`s with provenance + confidence. Example: the email's signature → `customerContact`; the attached SOW's date → `startDate`.

5. **Gap Synthesis.** The EIL commits nothing yet, but computes a *preview* completeness and asks the Adaptive Questioning engine: "given these pre-fills, what are the highest-value missing required questions?" The user is shown **only the genuine gaps**, not the whole form.

6. **Initiation Proposal.** A single reviewable artifact: "I'll create a *Regulatory Examination* project for *FinanceHub*, budget *$75k* (from the SOW), starting *Aug 1*. I still need: examination scope, regulator contact. Confirm / edit / not a project."

7. **Decision & Commit.** On confirm, the EIL creates the entity through the **existing Projects creation path** and records the `ProposedResponse`s through the **existing EIE Response API**. Governance (Art. XIII) decides whether any of this can auto-commit (e.g., high-confidence, low-risk fields) or must be human-approved. From here, Phase 1.1 reactive completeness + Continuous Discovery own the lifecycle exactly as today.

**Nothing after step 7 changes.** The entire downstream (completeness, supersession, appliesWhen, Continuous Discovery, project lifecycle) is the machinery already proven in Phase 1/1.1.

---

## 4. Required Constitutional Changes

The Constitution is **preserved**. It requires **clarifying amendments**, not rewrites. Per Art. XXVI (Long-Term Compatibility), amendments are additive.

### 4.1 Amend Article V (Continuous Discovery) — add Interpretation as an acquisition mode
Current Art. V already lists acquisition via Forms, Hermes interviews, Voice, Documents, APIs, AI inference. **Add an explicit clause:** *"Information may also be acquired by **interpreting unstructured enterprise inputs** (conversations, emails, meetings, documents) into pre-filled Information Responses with source and confidence. Interpretation is a first step of discovery, not a replacement for it; completeness and gaps continue to be governed by the Enterprise Information Engine."* This makes the EIL constitutionally native rather than a bolt-on.

### 4.2 Amend Article IV (EIE) — clarify EIE is a mechanism, not a surface
**Add:** *"The Enterprise Information Engine is an internal capability. Entities and users need not interact with Information Requirements, Question Packs, or Project Types directly. Higher-level capabilities (e.g., Enterprise Initiation) may present a simpler experience while consuming the EIE underneath. The EIE remains the single source of truth for information completeness regardless of how information was acquired."*

### 4.3 New Article XXVIII — Enterprise Initiation & Interpretation
A new **additive** article (does not alter existing ones):
> *"An organization is initiated through understanding, not through forms. NeuroCore shall accept enterprise inputs in their natural form — conversation, email, meeting, document, voice — and interpret them into structured enterprise understanding: candidate entities, inferred classifications, pre-filled information, and identified gaps. Interpretation shall always be explainable (source, method, confidence), always reversible, and always subject to governance before commitment. Project Types, Capability Packs, and the Information Engine are implementation mechanisms of interpretation, not the user's required vocabulary."*

### 4.4 Reaffirm (no change) Articles that already mandate this
Art. VIII, XVIII, XXV, XIX, XII, XIII, XVII are cited as the constitutional basis; no edits needed. The design is explicitly a *fulfilment* of them.

### 4.5 What must NOT change
- Art. II (Enterprise before features), Art. XVI (Capability-based) — the EIL must be a capability, never a monolith.
- Art. XIII (Governance before automation) — auto-commit of interpreted facts is gated.
- Art. IV ownership — the EIE stays the information source of truth; the EIL never forks it.

---

## 5. Required Changes to the Integration Roadmap

The ratified 12-phase roadmap (Phase 0–11) is **preserved and reordered/extended**, not discarded. The EIL depends on capabilities Phases 2–4 deliver, so it slots *after* them.

### 5.1 Roadmap positioning

| Phase | Current | Change |
|---|---|---|
| 0 | Architectural Decisions & Contracts | **Add 2 ADRs** (see §5.2) — do this now, before Phase 2, since they shape event contracts |
| 1 / 1.1 | EIE Runtime + Reactive Completeness | ✅ Done — the EIL's step 4–5 depend on this |
| 2 | Enterprise Event Fabric | **Unchanged.** Add EIL event contracts to the taxonomy (interpretation.requested/completed, initiation.proposed/confirmed) |
| 3 | Organizational Context Plane | **Unchanged.** EIL reads context (existing customers, prior projects) to improve inference |
| 4 | AI Employee Work Runtime | **Unchanged.** Interpretation of an email may *trigger* a Work Request (Hermes interprets → proposes) |
| 5–9 | Work transport, governance, finance, memory, Google WS | **Unchanged.** Google WS (Phase 9) is a *primary EIL input source* (Gmail intake, Drive docs) — strengthen its scope to feed the EIL |
| 10 | Browser Workflow Completion | **Expand** to include the Enterprise Initiation surface (see §6) |
| **NEW 10.5** | **Enterprise Interpretation Layer** | **New phase** after Context Plane + Work Runtime + Google WS, before final NESP |
| 11 | Full NESP Re-Execution | **Amend** the simulation to initiate via interpretation (email → project), not via the type picker |

### 5.2 Two new ADRs required in Phase 0 (before Phase 2)
- **ADR-011 — Enterprise Interpretation Layer contract.** Defines `NormalizedInput`, `InterpretationSession`, `InitiationProposal`, the EIL↔EIE contract (proposals commit through the EIE Response API), and the EIL↔Type-registry contract (read-only inference). Must be defined now because it adds event types to the Phase 2 Event Fabric taxonomy.
- **ADR-012 — Interpretation Provenance & Confidence model.** Standard shape for `{sourceType, sourceRef, extractionMethod, confidence, reviewedBy}` on every inferred fact, and the governance rule for auto-commit thresholds (ties to Art. XIII / Phase 6 Approval Port).

**Why now:** the Event Fabric (Phase 2) and Approval Port (Phase 6) contracts must reserve space for interpretation/initiation events and auto-commit approvals. Defining ADR-011/012 in Phase 0 avoids a contract-breaking retrofit — the exact mistake the integration audit warned against.

### 5.3 Dependency summary
```
Phase 1.1 (EIE reactive) ─┐
Phase 2 (Event Fabric) ───┤
Phase 3 (Context Plane) ──┼──► Phase 10.5 (EIL) ──► Phase 11 (NESP via interpretation)
Phase 4 (Work Runtime) ───┤
Phase 9 (Google WS intake)┘
```
The EIL is **not** implementable before Phases 2–4 exist — it needs durable events, organizational context for inference, and the Work Runtime to route AI interpretation work. This ordering is mandatory.

---

## 6. Required Changes to the UI

### 6.1 Reposition — do not delete — the Type-first wizard
- The current 3-step wizard (Essentials → Discovery → Review) becomes the **fallback / power-user path** and the **confirmation surface**, not the default entry.
- The default project-creation entry becomes an **Initiation composer**: a single input that accepts text, a dropped file, a pasted email, or "connect from Gmail."

### 6.2 New primary surfaces
| Surface | Behaviour |
|---|---|
| **"Start anything" composer** (Home + global ⌘K) | Free text or drop input → EIL runs → shows an Initiation Proposal card |
| **Initiation Proposal card** | "This looks like *X* for *Y*. Pre-filled *n* fields from your *email/doc*. *m* gaps remain. [Confirm] [Change type] [Edit fields] [Not a project]" — each pre-filled field shows a provenance chip (hover: source + confidence) |
| **Gap-only Discovery** | The existing Discovery UI, but rendered showing **only the unresolved required questions** (Phase 1.1 completeness already computes these); pre-filled answers appear as confirmable chips, not empty inputs |
| **Email/Doc intake inbox** | Forwarded emails / uploaded docs appear as pending interpretations the user can promote to initiations |

### 6.3 Explainability in the UI (Art. XII)
Every interpreted value carries a **provenance chip**: source type icon, source label, confidence %, and "why this type" rationale expandable. This is a hard requirement, not decoration — it is how the design satisfies Art. XII and keeps interpretation *trustworthy*.

### 6.4 Reversibility
- "Change type" re-runs pre-resolution against a different candidate without losing entered data.
- "Not a project" reclassifies (e.g., into a Customer, or a Meeting note) — the same normalized input, different target entity.
- The explicit Type picker is always one click away ("Start manually instead").

### 6.5 Non-goals for UI
- Do **not** build a generic wizard framework (consistent with the onboarding plan's non-goals).
- Do **not** hide the mechanism entirely for admins — Type/Pack management remains in the admin portal (it's configuration, not user vocabulary).

---

## 7. Required Changes to Hermes

Hermes is the constitutional organizational interface (Art. VIII) and, per the Hermes Unification Plan, the single execution engine (Agent = business entity, HermesAgent = execution profile). The EIL makes Hermes the **primary initiation channel**.

### 7.1 Hermes becomes an interpretation front-door
- A user can say to Hermes: *"FinanceHub wants us to run their Q3 regulatory exam, budget around 75k, kickoff in August"* → Hermes invokes the **EIL as a capability/tool**, returns an Initiation Proposal in-conversation, and commits on confirmation.
- Hermes does **not** own interpretation logic (Art. XVI, and the audit's warning against making Hermes a hidden orchestrator). It **calls** the EIL capability, exactly as it calls other tools.

### 7.2 Hermes context assembly must include initiation context
- Phase 3's Organizational Context Plane must expose an **initiation/interpretation context provider** so Hermes can answer "what have we started recently?", "what's pending interpretation?", and improve inference using existing customers/projects.

### 7.3 AI Employees interpret inbound work (Art. VI, XX)
- When an email arrives (Phase 9 Gmail intake), a Sales/Intake AI Employee (via Phase 4 Work Runtime) can run interpretation and produce a *proposed* initiation for human confirmation — the constitutional "Human governs → AI executes within boundaries" (Art. VII) applied to initiation.
- This is where the EIL, Work Runtime, Event Fabric, and Google Workspace integration compose into the "primary enterprise chain" the verification protocol demands.

### 7.4 Hermes must never bypass the EIE
- Interpreted answers Hermes gathers in conversation are recorded through the **EIE Response API** (Phase 1.1 path), so completeness and Continuous Discovery stay authoritative. Hermes is a channel (Art. VIII, XVIII), not a second information store.

---

## 8. Required Changes to Enterprise Workflows

### 8.1 Initiation becomes event-driven (Art. XVII)
New enterprise events (added to Phase 2 taxonomy, contracted in ADR-011):
- `enterprise.input.received` (email/doc/transcript/utterance ingested)
- `enterprise.interpretation.completed` (candidates + pre-fills + gaps ready)
- `enterprise.initiation.proposed` (proposal surfaced to a human/AI)
- `enterprise.initiation.confirmed` / `.rejected` / `.reclassified`
- On confirm → existing `enterprise.project.created` fires (no change downstream)

### 8.2 Governance workflow for interpreted facts (Art. XIII, Phase 6)
- Auto-commit policy: fields above a confidence threshold **and** below a risk tier may commit without human review; everything else stays a proposal until confirmed. This is a Governance/Approval-Port rule (ADR-012), not EIL logic.
- Segregation of duties: an AI Employee may *propose* an initiation but a human (or higher-autonomy AI, per Art. XIV) *confirms* it, unless policy grants autonomy.

### 8.3 The primary enterprise chain (verification protocol) is rewired to start from input
Old chain start: "user selects Project Type." New chain start (matches the verification protocol's "real inbound customer communication" step): **customer email → interpretation → proposed initiation → human confirm → project created → EIE completeness → Continuous Discovery → work → …** This makes the Phase 11 NESP re-execution *actually* exercise the AI-native initiation, closing the gap the RUN A/B simulation exposed.

### 8.4 Memory & learning loop (Art. X, XIX)
- Every interpretation (input → understanding → correction) is organizational memory. Human corrections to inferences are high-value training signal: "we mis-typed this as X, it was Y" improves future inference. This feeds the Enterprise Learning Loop (Art. XIX) and must be persisted via Phase 8 Organizational Memory ingestion.

---

## 9. Migration Strategy (additive, zero-regression — Art. XXVI)

### Stage A — Contracts (in Phase 0, before Phase 2)
- Author ADR-011 (EIL contract) and ADR-012 (provenance/confidence + auto-commit governance).
- Amend the Event Fabric taxonomy (Phase 2 scope) to include interpretation/initiation events.
- Amend the Constitution (Art. V clarification, Art. IV clarification, new Art. XXVIII). Preserve original text; append amendments with dates.

### Stage B — Foundations (Phases 2–4, 9 as planned)
- No EIL code yet. Ensure Event Fabric, Context Plane, Work Runtime, and Google WS intake expose the hooks the EIL needs (context provider, event types, work triggers, Gmail/Drive sources).

### Stage C — EIL behind a flag (new Phase 10.5)
- Implement the EIL as a capability consuming EIE + Type registry. **Feature-flagged OFF** (mirrors the Hermes Unification pattern: `HERMES_ENABLED` flag, service-first, backward-compatible).
- The Type-first wizard remains the default while the flag is off. Internal dogfooding validates inference quality.

### Stage D — UI reposition (Phase 10 expansion)
- Ship the "Start anything" composer and Initiation Proposal card **alongside** the existing wizard. The wizard stays reachable ("Start manually"). Gap-only Discovery reuses Phase 1.1 completeness.
- Progressive rollout: enable interpretation for one tenant (the mock enterprise), measure inference accuracy + correction rate, then widen.

### Stage E — Flip the default (post-validation)
- Once inference accuracy and provenance/governance are proven, make the composer the default initiation entry; the wizard becomes the explicit fallback. No capability removed.

### Stage F — Verify (Phase 11 NESP, amended)
- Re-run the enterprise simulation initiating from a real email, proving input → understanding → confirmed project → completeness → Continuous Discovery end-to-end in the browser.

### Rollback
- The feature flag is the rollback: OFF returns the platform to the proven Type-first path with zero data loss (interpretations are staging artifacts; committed data always went through the existing EIE/Projects APIs).

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Inference is wrong → bad initiations | Everything is a *proposal*; human confirms; corrections feed learning; confidence + provenance always shown (Art. XII) |
| EIL becomes a monolith owning EIE/Type logic | Enforce capability boundary (Art. XVI): EIL only *consumes*; proposals commit via EIE Response API; ADR-011 makes this a contract |
| Parallel information store forks the EIE | Hard rule: `ProposedResponse` never persists as truth; on confirm it's written through the EIE (Phase 1.1 path) |
| Auto-commit erodes governance | ADR-012 confidence/risk thresholds gated by Approval Port (Art. XIII); default is human-confirm |
| Hermes becomes hidden orchestrator | Hermes calls EIL as a tool; EIL is a separate bounded context (repeats the integration-audit ownership discipline) |
| Scope creep before Phase 2 | Only ADRs + Constitution amendments happen now; EIL implementation is Phase 10.5, after its dependencies |
| Simulation success-bias | Phase 11 NESP amended to start from interpretation; verdicts stay evidence-based (per the amendment directive) |

---

## 11. What Changes vs What Stays (Summary)

**Stays (preserved):**
- Entire Constitution (with 3 additive/clarifying amendments)
- Project Types, Capability Packs, Question Packs, EIE, Adaptive Questioning, Continuous Discovery
- Phase 1/1.1 reactive completeness machinery (the EIL depends on it)
- The 12-phase roadmap (extended, not replaced)
- The Type-first wizard (repositioned as fallback + confirmation)
- Hermes Unification model (Agent/HermesAgent/HermesRuntime)

**Changes (repositioned/added):**
- New capability: Enterprise Interpretation Layer (`enterprise-initiation` bounded context)
- New primary UX: input-first initiation composer + proposal card + gap-only Discovery
- Project Types/Packs/EIE become internal mechanisms, not user vocabulary
- 2 new ADRs (011, 012); event taxonomy + Approval Port reserve interpretation/initiation
- New roadmap Phase 10.5; Phase 9 (Google WS) strengthened as an intake source; Phase 11 NESP amended to initiate from a real input
- Constitution: Art. IV & V clarified, new Art. XXVIII

---

## 12. Readiness Gate (before Phase 2)

Before Phase 2 begins, the following **design artifacts** (no code) should be ratified:
1. Constitution amendments (Art. IV clarify, Art. V clarify, new Art. XXVIII) — reviewed and appended.
2. ADR-011 (EIL contract) and ADR-012 (provenance/confidence + auto-commit governance) — drafted and reviewed.
3. Event Fabric taxonomy (Phase 2) updated to reserve interpretation/initiation events.
4. Roadmap updated to insert Phase 10.5 and amend Phases 9 & 11.

If these four are ratified, Phase 2 (Enterprise Event Fabric) can proceed with the correct event contracts in place, and the EIL can be built on solid foundations at Phase 10.5 without contract-breaking retrofits.

**This document is design + migration strategy only. No code, schema, or production change is proposed here.**

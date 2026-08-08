# NeureCore AI — User Capabilities Guide

**Audience:** anyone using NeureCore — sales reps, service agents, marketers, ops, admins, and tenant owners.
**Purpose:** one place that answers *what can I do with NeureCore's AI, when should I use it, how do I invoke it, and what should I expect back?*
**Scope:** all capabilities shipped live to Contabo (backend `brain.neurecore.com`, tenant `hq.neurecore.com`, admin `cc.neurecore.com`) as of 2026-08-08. Capability matrix tracks the 65-row Creatio AI parity baseline (`memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml`).
**Companion docs:**
- `memory-bank-arc/harness/PHASES-0-10-STATUS-AND-BACKLOG.md` — engineering status (what's certified vs. in progress).
- `memory-bank-arc/harness/IMPLEMENTATION-PLAN-PARITY-COMPLETION.md` — the P22–P30 plan to close remaining gaps.

> **Honest scope reminder.** 44 of 65 parity capabilities are CERTIFIED (real, gate-tested, no functional gap). 20 are IN_PROGRESS (real implementation, but a documented functional gap — see the "Known limitations" section at the end of each capability below, or the master list in the appendix). This guide flags every IN_PROGRESS item inline so you know what to expect.

---

## How to read this guide

Each capability section follows the same shape:

- **What it is** — one paragraph in plain language.
- **When to use it** — the trigger / situation.
- **How to use it** — the concrete action (chat command, button, slash command, ⌘K shortcut, screen).
- **What to expect** — the actual result, including where it lands in the CRM, latency, and any caveats.
- **Known limitations** — only present if the capability is IN_PROGRESS.

The capabilities are grouped into **14 domains** (the same domains used in the parity baseline):

| # | Domain | What it covers |
|---|---|---|
| 1 | Core assistant | The chat panel itself |
| 2 | Generative productivity | Summarize, rewrite, translate, extract, draft |
| 3 | Files | Upload, parse, retention, file-aware context |
| 4 | Knowledge | Tenant KB ingestion, grounded answers, gaps |
| 5 | Meetings | Transcripts, summaries, action items |
| 6 | Agents | Universal + 5 domain agents |
| 7 | Skills | Typed skills, visual composer, NL drafting |
| 8 | Sales | Lead score, opportunity, forecast, NBA, pipeline |
| 9 | Marketing | Segmentation, campaign brief, bounce |
| 10 | Service | Case triage, resolution, escalation |
| 11 | Predictive | Model lifecycle, abstention, model cards |
| 12 | Channels | Web, Gmail, Outlook, Teams, Slack, mobile |
| 13 | Command center | Inventory, quality, latency/cost, model health, kill switches |
| 14 | Platform | RBAC, privacy, audit, accessibility, resilience |

---

## 1. Core assistant

### 1.1 Persistent assistant panel (CERTIFIED — CR-AI-0001)

**What it is.** An always-available floating chat panel that lives across every screen in NeureCore. It carries your identity, your tenant scope, the page you are on, and your conversation history.

**When to use it.** Anytime you need an assistant with you — drafting a customer reply, asking "what changed on this account?", or asking a CRM question without leaving the page.

**How to use it.**
- Click the chat bubble on any screen, or press the global chat shortcut.
- Type or paste; the panel streams the answer in.
- The panel already knows what page you are on (it reads the record type + ID from your browser URL and re-authorizes the answer server-side — your role is never trusted from the client).

**What to expect.**
- Streaming response, mid-stream cancel, retry, thumbs up/down feedback.
- The panel reads page context automatically (e.g. open a Customer → ask "summarize recent activity" → it pulls that customer's events).
- Attachments supported (see §3).
- Multilingual input accepted; output language follows your user locale (see §1.4).

### 1.2 Page context awareness (CERTIFIED — CR-AI-0002)

**What it is.** When you ask a question in the chat panel, NeureCore knows *which* record you're looking at — but it never trusts the client to claim authority. The server re-checks your permissions before composing the answer.

**When to use it.** Whenever you're on a record page and want context-aware help ("summarize", "what's blocking this?", "draft a reply to the latest note").

**How to use it.** Just ask in the chat panel while you're on a record page. No special command needed.

**What to expect.** Answers cite the record (Customer name, Project name, etc.) and pull only fields you are authorized to see. If the record belongs to a tenant you can't access, the answer is blocked at the server, not the client.

### 1.3 Conversation history with export/delete/audit (IN_PROGRESS — CR-AI-0003)

**What it is.** Conversations persist across sessions and are fully audited; you can list, delete, and (via admin) export them.

**When to use it.** Compliance review, customer-data-subject-request (DSR) handling, or just cleaning up old threads.

**How to use it.**
- **In-product:** open the panel → history list → select a conversation.
- **Export:** admins use `GET /admin/chat/:conversationId/export?format=csv|md|json` (deployment-guarded route).
- **Delete:** available in the panel; deletion is audited.

**What to expect.** Audit row written for every create/delete/download (append-only). Tenant-foreign conversations return 404.

**Known limitations.** The byte-download admin route is wired but the in-product "Download" button is the integration point that lands with P22 — until then the route works for admins via API only.

### 1.4 Multilingual input/output (IN_PROGRESS — CR-AI-0004)

**What it is.** NeureCore speaks and writes in 16 locales.

**When to use it.** Anytime your tenant operates across languages.

**How to use it.** Set your per-user locale (TopBar avatar → Locale). The assistant accepts your input language and answers in the same language. Entities, dates, and currency are preserved verbatim.

**What to expect.** Locale negotiation via the existing localizer; a typed multilingual handler on the response path. If the model locale is unsupported, you get an explicit fallback rather than a silent mis-translation.

**Known limitations.** Multilingual model handling is localizer-based today; the typed model-instruction envelope (preserve entities/dates/currency across `en|es|fr|…`) is finishing in P22.

---

## 2. Generative productivity

The chat panel ships with seven productivity skills. Each one is also a slash command and a ⌘K "AI Action".

| Slash | ⌘K label | What it does |
|---|---|---|
| `/summarize` | "Summarize record" | Summarizes the current record, thread, or document |
| `/rewrite` | "Rewrite / change tone" | Rewrites text with tone/shorten/expand controls |
| `/translate` | "Translate" | Translates to a target language |
| `/extract` | "Extract structured fields" | Pulls structured fields out of free text |
| `/compare` | "Compare records / files" | Side-by-side diff of two records or files |
| `/draft-report` | "Draft report" | Produces a long-form report draft |
| `/draft-email` | "Draft email" | Drafts an email from a prompt |

### 2.1 Summarize record / thread / document (CERTIFIED — CR-AI-0101)

**When to use it.** A 200-line activity thread on a customer. A 30-page PDF contract. A long internal note.

**How to use it.** Open the chat panel on the record/thread/document and type `/summarize`. You can also click the per-row "AI" button on the Customers list, or the "AI: Summarize" button on a Project.

**What to expect.** A concise summary (length controlled by you), key bullets, and a list of citations. The summary lives in the chat history; you can copy it into a note or send it to a downstream skill (e.g. `/draft-email`).

### 2.2 Rewrite / change tone / shorten / expand (CERTIFIED — CR-AI-0102)

**When to use it.** Polish a draft, soften an apology, shorten a rambling reply, expand a one-liner into a paragraph.

**How to use it.** Select text in the chat input, hit ⌘K → "Rewrite / change tone", or type `/rewrite` and follow the prompts (tone: formal/friendly/concise/direct; length: shorter/same/longer).

**What to expect.** A new draft. The original is preserved; you accept or discard.

### 2.3 Translate (CERTIFIED — CR-AI-0103)

**When to use it.** Inbound message in another language; outbound campaign copy that needs to ship in 8 markets.

**How to use it.** `/translate` → target language, or ⌘K → "Translate".

**What to expect.** Translation in your output language (or the chosen target). Proper nouns, currency, dates, and entity IDs preserved.

### 2.4 Extract structured fields (CERTIFIED — CR-AI-0104)

**When to use it.** Inbound email with order details. Customer call transcript with the next billing date. Web form dump you need to import.

**How to use it.** Paste the text → `/extract` → tell it the schema (or pick a saved schema: "Customer profile", "Quote line items", "Case attributes").

**What to expect.** A typed object you can drop into a Customer or Quote record. The schema is validated; missing required fields are flagged.

### 2.5 Compare records / files (CERTIFIED — CR-AI-0105)

**When to use it.** Two quote versions before sending a revised quote. Two contract drafts before approval. Two customer profiles during a merge review.

**How to use it.** Open both records/files in tabs → ask in chat `/compare` (the panel sees both URLs) or paste content directly.

**What to expect.** A diff with semantic grouping (terms vs. amounts vs. dates), not a raw line-by-line.

### 2.6 Draft report (CERTIFIED — CR-AI-0106)

**When to use it.** Weekly pipeline summary. Monthly service-desk health report. QBR prep for a top account.

**How to use it.** `/draft-report` → choose a template (or describe the audience) → ask the panel to pull from the relevant records.

**What to expect.** A long-form draft with cited sources. Editable inline; exportable to PDF/MD once P22 lands.

### 2.7 Email drafting (CERTIFIED — CR-AI-0107)

**When to use it.** Follow-up after a discovery call. Renewal nudge. Customer-success check-in.

**How to use it.** `/draft-email` → recipient (a record or an address) → tone/length. Or open a Customer → click "AI" → "Draft follow-up".

**What to expect.** A draft email. **Sending is approval-gated** — the email does not leave until a human approves (the Approval port, §6).

---

## 3. Files

### 3.1 File upload with validation, scan, parse (CERTIFIED — CR-AI-0201)

**When to use it.** Attaching a contract PDF to a Customer. Pasting a CSV of leads to import. Sending a screenshot of an error to a case.

**How to use it.** Drag-drop onto the chat panel, or click the attachment icon. Allowed: PDF, DOCX, TXT, CSV/XLSX, PPTX, email (.eml), images.

**What to expect.**
- Validation: type/size checks at upload time.
- Scan: malware scan via the file pipeline (quarantines on fail).
- Parse: text + structure extracted; the panel becomes "file-aware" for the rest of the conversation.

### 3.2 Parsers for PDF, DOCX, TXT, CSV/XLSX, PPTX, email, images (CERTIFIED — CR-AI-0202)

**When to use it.** You uploaded a PDF and want to ask questions about it. You uploaded a CSV and want to chart it. You pasted an email and want to extract the action items.

**How to use it.** The chat panel becomes file-aware automatically after upload. Ask in natural language ("What's the renewal date in this contract?"). Images: OCR is automatic; you can ask "what does this screenshot show?".

**What to expect.** Cited answers referencing page/section when the source has structure.

### 3.3 File retention, deletion, legal hold (CERTIFIED — CR-AI-0203)

**When to use it.** GDPR data-subject deletion requests. Litigation hold. Standard retention expiry.

**How to use it.**
- **Admins:** the Compliance / Governance app surfaces per-file retention rules and legal-hold status.
- **End users:** "Delete this upload" from the panel's attachment menu.

**What to expect.** Soft-delete with audit; legal hold blocks deletion and is visible in the governance console.

### 3.4 File-aware context in chat (CERTIFIED — CR-AI-0204)

**When to use it.** You have a 40-page contract open in chat and want to ask "what's the SLA clause?".

**How to use it.** Just ask. The panel auto-detaches which files belong to the conversation and references them in answers.

**What to expect.** Inline citations (filename + section/page). Removing a file from the conversation removes it from context.

---

## 4. Knowledge

### 4.1 Tenant knowledge ingestion, indexing, permission-aware retrieval (CERTIFIED — CR-AI-0301)

**What it is.** Every tenant has its own knowledge base. Articles, runbooks, FAQs, policies. The assistant only retrieves what *your* role can see.

**When to use it.** Asking "what's our standard refund policy?" — the answer comes from your KB, not from the model's general knowledge.

**How to use it.**
- **Admins/owners:** upload documents in the Knowledge app, or connect a source (Confluence, SharePoint, Drive).
- **Anyone:** ask in chat; the assistant retrieves from your tenant's KB.

**What to expect.** Cited answers with the article title, section, and last-updated date. Cross-tenant documents are never retrievable (regression-tested by the G9 suite).

### 4.2 Grounded-answer contract with abstention (CERTIFIED — CR-AI-0302)

**What it is.** The assistant is forbidden from making up an answer when your KB doesn't have one. It explicitly abstains.

**When to use it.** Anytime accuracy matters — compliance questions, finance policy, security procedures.

**How to use it.** Just ask.

**What to expect.**
- Grounded answer with citations when the KB covers it.
- Explicit "I don't have a verified answer for this in the KB" when it doesn't.
- Every abstention is logged and surfaced in the Command Center → Quality view (§13.2).

### 4.3 Article drafting from prompt or resolved case (CERTIFIED — CR-AI-0303)

**When to use it.** Support team has resolved the same issue 12 times this month. Service manager wants to write a KB article.

**How to use it.** Knowledge app → "Draft article" → describe the topic OR attach a resolved case thread.

**What to expect.** A draft article seeded from the resolved case (questions asked, steps taken, citation links). Knowledge admin reviews and publishes.

### 4.4 Gap / duplicate / conflict detection (CERTIFIED — CR-AI-0304)

**When to use it.** Quarterly KB hygiene. After a major product release.

**How to use it.** Knowledge app → "Health" → run the scan.

**What to expect.** A list of (a) KB topics where you have many cases but no article (gaps), (b) duplicate articles, (c) conflicting statements across articles. Each row links to the suggested action (create / merge / reconcile).

---

## 5. Meetings

### 5.1 Meeting transcript ingestion with consent (CERTIFIED — CR-AI-0401)

**What it is.** Transcripts from meetings land in NeureCore — but only when the meeting has explicit consent.

**When to use it.** Sales discovery calls. Customer-success QBRs. Service escalations on a call.

**How to use it.** Connect a channel (Outlook, Teams, Zoom — see §12). Consent is enforced at the channel-adapter level: bots only join meetings where the host has approved the consent prompt.

**What to expect.** Transcript appears in the linked Customer / Opportunity / Case record. Every ingestion is consent-audited.

**Known limitations.** Live transcript ingestion from the call graph (Outlook / Teams) is being cut over as part of P25. Until then transcripts arrive via file upload or via the live channel adapter where it is configured.

### 5.2 Summary templates (decisions, actions, risks, sentiment) (CERTIFIED — CR-AI-0402)

**When to use it.** A 60-minute call transcript you don't want to re-read.

**How to use it.** Open the transcript in the linked record → "Summarize" → choose template (Default / Decisions / Actions / Risks / Sentiment).

**What to expect.** A structured summary with the chosen sections filled and citations to the transcript lines.

### 5.3 Action items with owner/due/confidence (CERTIFIED — CR-AI-0403)

**When to use it.** After every meeting. Before every renewal.

**How to use it.** Open a summary → "Extract action items". The skill proposes owner, due date, and a confidence score.

**What to expect.** A list of action items. You accept/reject each. Accepted items create Tasks (approval-gated if they trigger downstream writes).

### 5.4 CRM linkage + governed follow-up writes (IN_PROGRESS — CR-AI-0404)

**What it is.** Meeting artifacts stay linked to the right CRM record, and follow-ups write back through approval.

**When to use it.** A discovery call lands → transcript links to the Opportunity → AI proposes creating a follow-up Task → you approve.

**How to use it.** Linkage is automatic (channel-aware). Follow-up writes are explicit; the approval port §6 shows what to expect.

**What to expect.** Linked transcript, decisions, action items; new Tasks/Notes only after approval.

**Known limitations.** Live Outlook / Teams transcript ingestion is in P25 (see §5.1).

---

## 6. Agents

NeureCore ships six agents. The **registry and template surface** is fully wired and certified; the **runtime that executes an agent request** is being finalized in P23.

| Agent | What it does |
|---|---|
| **Universal** | Routes an ambiguous ask to the right skill or domain agent; asks clarifying questions; never bypasses permissions |
| **Productivity** | Wraps the 7 generative skills (summarize, rewrite, …) |
| **Sales** | Lead research, qualification, NBA, forecast |
| **Marketing** | Audience segmentation, campaign brief, bounce analysis |
| **Service** | Case resolution, response draft, escalation |
| **Knowledge** | KB health, gap detection, article drafting |

### 6.1 Universal agent (IN_PROGRESS — CR-AI-0501)

**When to use it.** You have an ambiguous request and don't know which skill/agent to invoke.

**How to use it.** Just type in the chat panel — the universal agent routes. If the request is ambiguous, it asks a clarifying question (typed; no guessing).

**What to expect.** The agent picks the right downstream skill or domain agent; you can see the routing decision in the panel's "thinking" trail. **It never bypasses your permissions** — every step is re-authorized against your tenant scope.

**Known limitations.** The full agent runtime (graph execution, persistence, evidence chain) lands in P23.

### 6.2 Productivity agent (IN_PROGRESS — CR-AI-0502)

**When to use it.** "Summarize this thread, then translate it, then draft a follow-up email." A pipeline of generative skills.

**How to use it.** Describe the pipeline in natural language or use ⌘K to chain.

**What to expect.** Each step is auditable; intermediate results stay in the chat; you can edit any step before continuing.

**Known limitations.** Runtime execution lands in P23.

### 6.3 Sales agent (IN_PROGRESS — CR-AI-0503)

**When to use it.** "Research Acme Corp, qualify the lead, draft an outreach, and forecast if we close."

**How to use it.** Sales agent → ask.

**What to expect.** The agent calls research → qualification → NBA → forecast skills; mutating steps (e.g. creating an outreach) require approval.

**Known limitations.** Runtime lands in P23. Until then, invoke individual sales skills (§8) directly.

### 6.4 Marketing agent (IN_PROGRESS — CR-AI-0504)

**When to use it.** "Build a target segment for Q4 and draft a campaign brief."

**How to use it.** Marketing agent → ask.

**What to expect.** Segmentation + brief draft, both approval-gated.

**Known limitations.** Runtime lands in P23.

### 6.5 Service agent (IN_PROGRESS — CR-AI-0505)

**When to use it.** "Triage this case, draft a response, recommend escalation if needed."

**How to use it.** Service agent → ask.

**What to expect.** Triage + draft + escalation recommendation; response sending requires approval.

**Known limitations.** Runtime lands in P23.

### 6.6 Knowledge agent (IN_PROGRESS — CR-AI-0506)

**When to use it.** "What's missing from our KB given the cases this month?"

**How to use it.** Knowledge agent → ask.

**What to expect.** A gap list with proposed articles; article creation is approval-gated.

**Known limitations.** Runtime lands in P23.

---

## 7. Skills

### 7.1 Skill definition with typed inputs/outputs (CERTIFIED — CR-AI-0601)

**What it is.** Every skill is a typed contract (`I<I,O>`), not a stringly-typed prompt. Inputs and outputs are validated.

**When to use it.** You're a developer or a power-user building automations.

**How to use it.** `GET /skills` lists all skills with their typed I/O. Trigger via the API or via the chat panel (slash commands).

**What to expect.** Predictable, schema-validated outputs. Errors are typed (no generic `Error("...")`) — e.g. `SkillAbstainedError`, `SkillAuthorizationError`, `LlmOptedOutError`.

### 7.2 Visual skill composer (IN_PROGRESS — CR-AI-0602)

**What it is.** A node-and-edge editor for composing skills into workflows without writing code.

**When to use it.** "Every Monday at 9am, summarize this week's new cases and email me the digest."

**How to use it.** Marketplace → Composer → drag skill nodes onto the canvas → wire edges → save. Live preview is non-mutating (it runs through the approval-gated path).

**What to expect.** A typed skill graph; saves are validated; loaded graphs restore layout.

**Known limitations.** The visual editor is finishing in P24 (long pole). Today you can save/load a typed skill graph via the existing backend; the canvas ships with P24.

### 7.3 NL workflow drafting (no direct activation) (CERTIFIED — CR-AI-0603)

**What it is.** Describe a workflow in natural language; NeureCore produces a typed graph draft. It does **not** auto-activate.

**When to use it.** "Every Monday at 9am, summarize this week's new cases and email me the digest" → you get a draft graph you can review.

**How to use it.** Marketplace → Composer → "Draft from description".

**What to expect.** A typed graph you must explicitly activate. Activation is approval-gated.

---

## 8. Sales

### 8.1 Lead qualification + scoring (CERTIFIED — CR-AI-0701)

**When to use it.** A new inbound lead lands. You want to know if it's worth a call today.

**How to use it.** `/score-lead` in chat, or click the "AI" button on a Lead row. The score uses the in-process deterministic model runner; it has a calibration gate before going live.

**What to expect.**
- Score 0–100 with confidence.
- Top contributing signals (engagement, fit, intent).
- Recommendation: prioritize / nurture / deprioritize.
- Calibration gate: the score is held back from automation until calibration passes.

### 8.2 Opportunity win probability + close-date risk (CERTIFIED — CR-AI-0702)

**When to use it.** Forecasting calls. Pipeline review.

**How to use it.** Open the Opportunity → "AI: Win probability".

**What to expect.** Probability + close-date risk + the signals that move it (e.g. champion engaged, legal redlines open, last touchpoint stale).

### 8.3 Forecast with interval + backtesting (IN_PROGRESS — CR-AI-0703)

**When to use it.** Quarterly forecast. Board prep.

**How to use it.** `/forecast-pipeline` in chat, or Forecasts tab.

**What to expect.** A forecast with a low/base/high interval, plus backtested accuracy against prior periods.

**Known limitations.** Today the forecast aggregates from the `Quote` table (no `Deal` model yet). Adding a Deal model + weighted pipeline forecast is P26.

### 8.4 Next-best-action (sales) (CERTIFIED — CR-AI-0704)

**When to use it.** "What should I do on this account today?"

**How to use it.** `/next-best-step` in chat, or the per-row "AI" button on Opportunities.

**What to expect.** One concrete next action with reasoning and a confidence score. Mutating actions (send email, schedule meeting) require approval.

### 8.5 Pipeline analysis / risk / inactivity / churn (CERTIFIED — CR-AI-0705)

**When to use it.** Monday pipeline review.

**How to use it.** Pipeline → "AI: Analyze".

**What to expect.** Buckets: at-risk, going-stale, churn-risk. Each row links to the suggested action.

---

## 9. Marketing

### 9.1 Audience segmentation (CERTIFIED — CR-AI-0801)

**When to use it.** Planning a campaign. Picking the audience for a new product launch.

**How to use it.** Marketing → "New segment" → describe the audience in natural language OR pick saved criteria.

**What to expect.** A proposed segment with size, overlap, and estimated conversion (when calibration data exists). Approval-gated to activate.

### 9.2 Campaign brief / brand compliance / email draft (CERTIFIED — CR-AI-0802)

**When to use it.** Kicking off a new campaign.

**How to use it.** Marketing → "New campaign brief" → describe the goal + audience.

**What to expect.** A campaign brief (objective, audience, channels, KPIs), brand-compliance check, and an email draft. Sending requires approval.

### 9.3 Bounce analysis + remediation (CERTIFIED — CR-AI-0803)

**When to use it.** A campaign's bounce rate spikes.

**How to use it.** Marketing → open the campaign → "AI: Analyze bounce".

**What to expect.** Categorized bounces (hard vs. soft, by domain), likely root causes (reputation, list hygiene, content), and a remediation list.

---

## 10. Service

### 10.1 Case classification + sentiment + urgency + SLA risk (CERTIFIED — CR-AI-0901)

**When to use it.** A new case lands. The triage queue is 50 deep.

**How to use it.** Auto-triage on inbound; or click "AI: Triage" on a case.

**What to expect.** Classification (category/subcategory), sentiment, urgency, SLA-risk. Auto-routes to the right queue based on triage rules.

### 10.2 Cited knowledge resolution recommendation (CERTIFIED — CR-AI-0902)

**When to use it.** A case looks like a known issue.

**How to use it.** Open the case → "AI: Suggest resolution".

**What to expect.** A grounded recommendation with KB citations; confidence score; "I don't have a verified answer" if the KB doesn't cover it.

### 10.3 Response draft + escalation recommendation (CERTIFIED — CR-AI-0903)

**When to use it.** You want a draft to send, or you want to know if you should escalate.

**How to use it.** Open the case → "AI: Draft response" / "AI: Should I escalate?".

**What to expect.** A draft response (sending requires approval) and an escalation recommendation with reasoning.

---

## 11. Predictive

### 11.1 Model lifecycle (CERTIFIED — CR-AI-1001)

**What it is.** Every model goes through a typed lifecycle: problem → calibration → shadow → gated → monitor → rollback. There is no path to production that skips gates.

**When to use it.** As a data scientist or admin, when you onboard a new model.

**How to use it.** Admin → Models → "New model".

**What to expect.** A wizard with each gate visible. Models that fail a gate don't advance; rollback is one click.

### 11.2 Abstention + deterministic-rule baseline (CERTIFIED — CR-AI-1002)

**What it is.** When a model isn't confident, it abstains rather than guesses. There's always a deterministic rule baseline you can fall back to.

**When to use it.** Anywhere a model would otherwise produce a low-confidence answer.

**How to use it.** Implicit. Look for the explicit "abstained" indicator in the answer; admins can switch any tenant to "rule-only" mode.

**What to expect.** Explicit abstention + the deterministic fallback output. Abstentions are logged (§13.2).

### 11.3 Model cards + explanation validation (CERTIFIED — CR-AI-1003)

**When to use it.** Auditing a model. Onboarding a new region. Customer due-diligence.

**How to use it.** Admin → Models → open a model → "Model card".

**What to expect.** A model card: intended use, training data summary, metrics, fairness notes, known limits. Explanations can be validated against an XAI module.

---

## 12. Channels

### 12.1 Web assistant (CERTIFIED — CR-AI-1101)

**What it is.** The chat panel you already use. Always available, page-aware, tenant-scoped.

### 12.2 Gmail / Google Calendar (CERTIFIED — CR-AI-1102)

**When to use it.** Reps who live in Gmail. Calendar-aware scheduling.

**How to use it.** Integrations → Gmail → connect your account.

**What to expect.** Email-aware context in the chat panel; scheduling suggestions; outbound email drafts (approval-gated).

### 12.3 Outlook email + calendar (IN_PROGRESS — CR-AI-1103)

**Same as Gmail** but for Microsoft 365 tenants.

**Known limitations.** Live OAuth + upstream adapter wiring is part of P27. Until then, the channel adapter is in the catalog but not live for all tenants.

### 12.4 Microsoft Teams (chat + meeting summary) (IN_PROGRESS — CR-AI-1104)

**When to use it.** Teams-based sales calls. Channel-based approvals.

**How to use it.** Integrations → Teams → connect.

**What to expect.** Teams chat with the assistant; transcript ingestion for meetings (§5).

**Known limitations.** Live OAuth cutover is part of P27.

### 12.5 Slack (OUT_OF_SCOPE — CR-AI-1105)

Slack is intentionally out of scope for this release (product decision — see parity baseline). Use Teams for an in-channel assistant.

### 12.6 CRM/commerce event-triggered workflow skills (IN_PROGRESS — CR-AI-1106)

**When to use it.** "When a Quote is marked Accepted in Salesforce, summarize it and notify the CSM in Teams."

**How to use it.** Marketplace → Workflow skills → pick a trigger → pick actions.

**What to expect.** A typed workflow. HubSpot / Salesforce live wiring is part of P27.

### 12.7 Mobile (responsive assistant + declared backend-only actions) (IN_PROGRESS — CR-AI-1107)

**When to use it.** You're on the road; you want to ask the assistant from your phone.

**How to use it.** Open `hq.neurecore.com` on mobile.

**What to expect.** A responsive chat panel. Backend-only actions (anything that would write data) are explicitly declared and require approval.

**Known limitations.** Full mobile FE integration is P28.

---

## 13. Command center (admin)

The Command Center is the admin's mission control. Seven panels.

### 13.1 Inventory (CERTIFIED — CR-AI-1201)

Agents, skills, models, knowledge sources, channels — what's deployed, what's enabled, who's using it.

### 13.2 Quality + feedback + corrections + abstentions (CERTIFIED — CR-AI-1202)

- Feedback (thumbs up/down) by skill and by agent.
- Corrections (you rejected a draft, here are the patterns).
- Abstentions (the model refused to answer; where, why, how often).

### 13.3 Latency / cost / budgets / rate limits (CERTIFIED — CR-AI-1203)

Per-tenant dashboards. Budgets are hard ceilings; rate limits are enforced.

### 13.4 Model health / drift / realized outcomes (CERTIFIED — CR-AI-1204)

Drift observability + realized-outcome tracking (how often the model's prediction matched reality).

### 13.5 Channel status / delivery receipts / queue health (CERTIFIED — CR-AI-1205)

Channel-by-channel delivery success, retries, queue depth.

### 13.6 Security denials + injection/DLP/malware events (CERTIFIED — CR-AI-1206)

Every denied action, prompt-injection attempt, DLP trigger, malware detection — all logged.

### 13.7 Per-process, tenant, capability, agent, skill, model, channel kill switches (CERTIFIED — CR-AI-1207)

Granular kill switches at every level. Turn off a single skill for one tenant without affecting anyone else.

---

## 14. Platform

### 14.1 RBAC + ABAC + tenant isolation (CERTIFIED — CR-AI-1301)

Per-tenant RBAC; ABAC for attribute-based rules (e.g. "only deal owners can mark a deal Won"). Every read and write re-checks tenant scope at the Prisma layer.

### 14.2 Privacy + retention + deletion + legal hold (CERTIFIED — CR-AI-1302)

Per-tenant retention rules. GDPR DSR workflow (right to access, right to delete, right to export). Legal hold blocks deletion and is visible to compliance.

### 14.3 Audit + evidence + observability (CERTIFIED — CR-AI-1303)

Append-only audit on every mutation. Evidence chains tie AI outputs → skills used → decisions made. The P9 certification suite gates every release.

### 14.4 Accessibility WCAG 2.2 AA + localization (IN_PROGRESS — CR-AI-1304)

16 locales. WCAG 2.2 AA audit is finishing in P29.

### 14.5 Resilience + rate/cost controls (IN_PROGRESS — CR-AI-1305)

Per-tenant cost ceiling + resilience dashboard are landing in P30.

---

## 15. Approval port (the human-in-the-loop seam)

**What it is.** Every AI capability that would write data goes through the unified approval port. The AI proposes; you approve.

**When to use it.** Anytime the chat panel offers a mutating action — sending email, creating a record, updating a quote, etc.

**How to use it.** Review the proposed action in the panel or in the Approvals app. Approve / reject / request-changes.

**What to expect.**
- Approve → the action runs and is audit-logged.
- Reject → the action is dropped; the rejection is recorded as a correction (used by the learning loop, §13.2).
- Request-changes → the assistant revises.

**Honest status (SIM-04, 2026-07-28).** The current end-to-end FE-first walkthrough found open defects:
- NC-SIM04-002 — FE customer form blocked by modal backdrop (z-index).
- NC-SIM04-005 — Chat didn't create a project after 4 natural-language turns.
- Missing FE controls for S6 (Execute), S11 (Complete), and the REVIEW state pill in S10.
These are tracked for the next sprint before SIM-04 can be re-run end-to-end.

---

## Appendix A — Live services

| Service | URL | What lives there |
|---|---|---|
| Backend | `brain.neurecore.com/api/v1/health` | All backend modules |
| Admin | `cc.neurecore.com/admin/login` | Command center, models, governance, harness |
| Tenant | `hq.neurecore.com/login` | Chat panel, customers, projects, AI Twin, KB |

## Appendix B — Full capability matrix (65 rows)

Legend: ✅ CERTIFIED (44) · 🟡 IN_PROGRESS (20) · 🚫 OUT_OF_SCOPE (1)

| ID | Domain | Capability | Status |
|---|---|---|---|
| CR-AI-0001 | core_assistant | Persistent assistant panel | ✅ |
| CR-AI-0002 | core_assistant | Page context awareness | ✅ |
| CR-AI-0003 | core_assistant | Conversation history with export/delete/audit | 🟡 |
| CR-AI-0004 | core_assistant | Multilingual input/output | 🟡 |
| CR-AI-0101 | generative_productivity | Summarize record/thread/document | ✅ |
| CR-AI-0102 | generative_productivity | Rewrite / change tone / shorten / expand | ✅ |
| CR-AI-0103 | generative_productivity | Translate | ✅ |
| CR-AI-0104 | generative_productivity | Extract structured fields | ✅ |
| CR-AI-0105 | generative_productivity | Compare records/files | ✅ |
| CR-AI-0106 | generative_productivity | Draft report | ✅ |
| CR-AI-0107 | generative_productivity | Email drafting | ✅ |
| CR-AI-0201 | files | File upload with validation, scan, parse | ✅ |
| CR-AI-0202 | files | Parsers for PDF/DOCX/TXT/CSV/XLSX/PPTX/email/images | ✅ |
| CR-AI-0203 | files | File retention, deletion, legal hold | ✅ |
| CR-AI-0204 | files | File-aware context in chat | ✅ |
| CR-AI-0301 | knowledge | Tenant knowledge ingestion, indexing, permission-aware retrieval | ✅ |
| CR-AI-0302 | knowledge | Grounded-answer contract with abstention | ✅ |
| CR-AI-0303 | knowledge | Article drafting from prompt/resolved case | ✅ |
| CR-AI-0304 | knowledge | Gap / duplicate / conflict detection | ✅ |
| CR-AI-0401 | meetings | Meeting transcript ingestion with consent | ✅ |
| CR-AI-0402 | meetings | Summary templates (decisions, actions, risks, sentiment) | ✅ |
| CR-AI-0403 | meetings | Action items with owner/due/confidence | ✅ |
| CR-AI-0404 | meetings | CRM linkage + governed follow-up writes | 🟡 |
| CR-AI-0501 | agents | Universal agent (route, clarify, never bypass permissions) | 🟡 |
| CR-AI-0502 | agents | Productivity agent | 🟡 |
| CR-AI-0503 | agents | Sales agent | 🟡 |
| CR-AI-0504 | agents | Marketing agent | 🟡 |
| CR-AI-0505 | agents | Service agent | 🟡 |
| CR-AI-0506 | agents | Knowledge agent | 🟡 |
| CR-AI-0601 | skills | Skill definition with typed inputs/outputs | ✅ |
| CR-AI-0602 | skills | Visual skill composer (workflow + chat mode) | 🟡 |
| CR-AI-0603 | skills | NL workflow drafting (no direct activation) | ✅ |
| CR-AI-0701 | sales | Lead qualification + scoring | ✅ |
| CR-AI-0702 | sales | Opportunity win probability + close-date risk | ✅ |
| CR-AI-0703 | sales | Forecast with interval + backtesting | 🟡 |
| CR-AI-0704 | sales | Next-best-action (sales) | ✅ |
| CR-AI-0705 | sales | Pipeline analysis / risk / inactivity / churn | ✅ |
| CR-AI-0801 | marketing | Audience segmentation | ✅ |
| CR-AI-0802 | marketing | Campaign brief / brand compliance / email draft | ✅ |
| CR-AI-0803 | marketing | Bounce analysis + remediation | ✅ |
| CR-AI-0901 | service | Case classification + sentiment + urgency + SLA risk | ✅ |
| CR-AI-0902 | service | Cited knowledge resolution recommendation | ✅ |
| CR-AI-0903 | service | Response draft + escalation recommendation | ✅ |
| CR-AI-1001 | predictive | Model lifecycle (problem → calibration → shadow → gated → monitor → rollback) | ✅ |
| CR-AI-1002 | predictive | Abstention + deterministic-rule baseline | ✅ |
| CR-AI-1003 | predictive | Model cards + explanation validation | ✅ |
| CR-AI-1101 | channels | Web assistant | ✅ |
| CR-AI-1102 | channels | Gmail / Google Calendar | ✅ |
| CR-AI-1103 | channels | Outlook email + calendar | 🟡 |
| CR-AI-1104 | channels | Microsoft Teams (chat + meeting summary) | 🟡 |
| CR-AI-1105 | channels | Slack | 🚫 |
| CR-AI-1106 | channels | CRM/commerce event-triggered workflow skills | 🟡 |
| CR-AI-1107 | channels | Mobile (responsive assistant + declared backend-only actions) | 🟡 |
| CR-AI-1201 | command_center | Inventory (agents, skills, models, knowledge, channels) | ✅ |
| CR-AI-1202 | command_center | Quality + feedback + corrections + abstentions | ✅ |
| CR-AI-1203 | command_center | Latency / cost / budgets / rate limits | ✅ |
| CR-AI-1204 | command_center | Model health / drift / realized outcomes | ✅ |
| CR-AI-1205 | command_center | Channel status / delivery receipts / queue health | ✅ |
| CR-AI-1206 | command_center | Security denials + injection/DLP/malware events | ✅ |
| CR-AI-1207 | command_center | Per-process, tenant, capability, agent, skill, model, channel kill switches | ✅ |
| CR-AI-1301 | platform | RBAC + ABAC + tenant isolation | ✅ |
| CR-AI-1302 | platform | Privacy + retention + deletion + legal hold | ✅ |
| CR-AI-1303 | platform | Audit + evidence + observability | ✅ |
| CR-AI-1304 | platform | Accessibility WCAG 2.2 AA + localization | 🟡 |
| CR-AI-1305 | platform | Resilience + rate/cost controls | 🟡 |

**Totals:** 44 CERTIFIED / 20 IN_PROGRESS / 1 OUT_OF_SCOPE = 65 capabilities.

## Appendix C — Roadmap (the path to 65/65 shipped-live)

| Phase | Caps | Headline outcome | Status |
|---|---|---|---|
| **P22** | CR-AI-0003, CR-AI-0004 | Chat export byte-download + full multilingual model handling | Planned |
| **P23** | CR-AI-0501..0506 | Real agent runtime execution (route / clarify / never-bypass-permissions) — long pole | Planned |
| **P24** | CR-AI-0602 | Visual node-and-edge skill composer — long pole | Planned |
| **P25** | CR-AI-0401..0404 | Live call-graph ingestion + write-back | Planned |
| **P26** | CR-AI-0703 | Deal model + weighted pipeline forecast | Planned |
| **P27** | CR-AI-1103/1104/1106 | Live Outlook / Teams / HubSpot / Salesforce wiring | Planned |
| **P28** | CR-AI-1107 | Full mobile FE integration | Planned |
| **P29** | CR-AI-1304 | WCAG 2.2 AA audit | Planned |
| **P30** | CR-AI-1305 | Per-tenant cost ceiling + resilience dashboard | Planned |

See `memory-bank-arc/harness/IMPLEMENTATION-PLAN-PARITY-COMPLETION.md` for the engineering detail, dependency graph, and SOLID design behind each phase.

## Appendix D — Glossary

- **Tenant** — a NeureCore customer (your company or org unit). All data is scoped to your tenant.
- **Skill** — a typed AI capability (`I<I, O>`). Inputs and outputs are validated.
- **Agent** — a coordinated set of skills (e.g. the Sales agent composes research + qualification + NBA + forecast skills).
- **Approval port** — the unified human-in-the-loop seam; every mutating AI action requires human approval.
- **Abstention** — when the model explicitly declines to answer because it cannot ground the answer in the tenant's KB.
- **Calibration gate** — a quality gate a model must pass before its outputs can drive automation.
- **P9 / G9** — the certification suite that gates every release (105 scenarios; cross-tenant denial = 100%).
- **CERTIFIED vs. IN_PROGRESS** — `CERTIFIED` = real impl + gate-tested + no functional gap. `IN_PROGRESS` = real impl but a documented functional gap remains.

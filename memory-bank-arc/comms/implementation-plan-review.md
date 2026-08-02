# Implementation Plan Review — Service Gateway + Response Envelope

**Document under review:** `comms/implementation-plan-service-gateway-envelope.md` v1.0 (752 lines)
**Reviewer:** Kilo
**Review date:** 2026-08-01
**Method:** Cross-reference every plan claim against the actual source code in `backend/src/` and `frontend-tenant/src/` (read first-hand during the previous session).

---

## Severity Legend

- **🔴 Critical** — wrong claim, incorrect code, or broken invariant; must fix before implementation.
- **🟡 Significant** — gap or unsafe assumption; blocks safe rollout.
- **🟠 Minor** — wording/precision issue; correct in spirit, sloppy in execution.

---

## 1. Architectural / Logic Errors

### 1.1 🔴 `MessageEnvelopeParser.parse()` is incompatible with `IJsonExtractor.extract()`

**Location:** plan §4.2, lines 472–498.

**What the plan claims:** "`MessageEnvelopeParser` ... extracts brace-balanced JSON from the content (reuses `BraceBalancedJsonExtractor` pattern)".

**Reality (`frontend-tenant/src/core/services/chat/fallback/BraceBalancedJsonExtractor.ts:11–28` and `frontend-tenant/src/core/services/interfaces/IChatService.ts:34–35`):**

```ts
// IJsonExtractor contract
extract(text: string): { cleaned: string; chartType?: string; chartData?: unknown[] } | null;

// BraceBalancedJsonExtractor returns null UNLESS the JSON contains "chartType"
if (!jsonStr || !/"chartType"\s*:/.test(jsonStr)) return null;
```

The `IJsonExtractor` is **chart-data-only**. It returns `null` for any JSON without `"chartType"`. The plan's `MessageEnvelopeParser.parse()` then does:

```ts
const extracted = this.jsonExtractor.extract(content);  // null if not chart JSON
if (!extracted) return { text: content };
const enriched = extracted as unknown as Record<string, unknown>;
if (enriched.components && Array.isArray(enriched.components)) { ... }
```

For an envelope-shaped payload `{ "text": "...", "components": [...] }` (no `"chartType"`), `extract()` returns `null`, and the parser falls through to plain text. **The plan silently fails on every envelope that does not contain `"chartType"`.**

**Fix:** either (a) generalize `IJsonExtractor` to return arbitrary balanced JSON `{ cleaned, json }`, or (b) introduce a new `BraceBalancedEnvelopeExtractor` that filters on `"components"` and returns `{ cleaned, json }`. Option (b) is safer (no breakage in existing `chart` rendering). The plan must use the new extractor.

### 1.2 🔴 `.strict()` is silently dropped by `BaseStructuredTool.coerceAndParse`

**Location:** plan §3.2, line 198 and §2 SOLID table.

**What the plan claims:** `.strict()` "mitigates Risk 1 from queryTenantData design" — unknown keys rejected.

**Reality (`backend/src/modules/tools/structured-tool.base.ts:127–177`):**

```ts
private coerceAndParse(input: unknown): z.infer<this['inputSchema']> {
  const coerced = this.getCoercedSchema(this.inputSchema as z.ZodType);
  return coerced.parse(input);
}
...
return z.object(newShape).passthrough();  // line 150 — always wraps with .passthrough()
```

`coerceAndParse` re-wraps the entire ZodObject with `.passthrough()`. When the tool calls `tool.execute(input, context)`, `executeImpl` receives an input that has been validated against a **passthrough** schema. Any `.strict()` declared on the tool's `inputSchema` is **silently discarded at the coerce layer**.

**However** — `tool.validate(input)` (line 189–202) parses the **original** schema (with `.strict()` intact). The tool registry's runtime path uses `coerceAndParse` (inside `execute`), not `validate`. So `.strict()` is dead code at runtime.

**Fix:** either (a) modify `BaseStructuredTool.coerceAndParse` to preserve strictness (preserve source shape and add `.strict()` semantics on the inner object), or (b) implement a custom whitelist check inside `ServiceGatewayTool.executeImpl()` that explicitly rejects keys not in `cap.paramsSchema.shape`. Option (b) is what the plan must commit to, with an inline unit test asserting it.

### 1.3 🟡 Dynamic-method call `service[cap.method]` is unchecked

**Location:** plan §3.2, line 217.

```ts
const result = await service[cap.method](context.tenantId, input.params ?? {});
```

Two issues:
1. TypeScript cannot prove `service[cap.method]` exists; the dynamic index returns `any`.
2. If `cap.method` is misspelled in `CAPABILITY_MAP`, runtime throws `TypeError: service.<method> is not a function` — the exception escapes through the LLM loop (FIX-052 history shows this is exactly the kind of bug that breaks streams).

**Fix:** add a runtime guard `typeof service[cap.method] === 'function'` and a unit test that injects a `CAPABILITY_MAP` entry with a bogus method name and asserts the tool returns `{ success: false, error: ... }` rather than crashing.

### 1.4 🟠 Service method signatures don't all match `(tenantId, paramsObject)`

**Location:** plan §3.2, line 217.

The plan assumes every service method has signature `(tenantId: string, params?: Record<string, unknown>) → Promise<Result>`. Reality: NestJS services vary — `findAll(tenantId, options)` (typed options object), `create(tenantId, dto, user)` (multiple positional args), `getSummary()` (no args), etc. Passing `input.params ?? {}` where a typed `options` argument is expected fails TypeScript and at runtime produces subtle bugs (e.g. extra unknown keys merged).

**Fix:** add a per-capability adapter signature:

```ts
{
  capability: 'listProjects',
  serviceToken: 'ProjectsService',
  method: 'findAll',
  paramsSchema: z.object({ includeRelations: z.boolean().optional(), status: z.enum(['ACTIVE','ARCHIVED']).optional() }).strict(),
  adapter: (service, tenantId, params) => service.findAll(tenantId, params),
  readOnly: true,
}
```

The plan's gateway would then call `cap.adapter(service, context.tenantId, parsedParams)` instead of `service[cap.method](...)`. This both enforces strict params per capability AND gives each capability its exact signature.

---

## 2. Wire-Format / SSE Gaps

### 2.1 🔴 The SSE wire-format change is never specified

**Location:** plan §3.4, lines 385–406.

**The plan contradicts itself:**
- Line 399: "The `text` field now optionally includes the envelope inline."
- Line 403: "**The `content` field is unchanged** — the envelope is carried in the SSE delta's `text` JSON alongside the message."
- Line 405: "**zero SSE protocol changes, zero frontend service changes**."

Then the example wire format (line 387–395) shows the envelope as a **sibling top-level field**, not inside `text`:

```json
{
  "text": "Successfully executed 1 tool(s): listProjects",
  "envelope": { "text": "(20 total)", "components": [...] }
}
```

How does `envelope` get on the wire? The existing `chat-sse.service.ts` writes `data: {"text":"..."}` only (per `chat-sse.service.ts` reads in prior session). To add `envelope` requires editing `chat-sse.service.ts` and `ChatService.sendMessageStream()` on the frontend — contradicting the "zero SSE protocol changes, zero frontend service changes" claim.

**Three possibilities to disambiguate:**
1. Envelope travels in `chat-sse.service.ts`'s `data` field by extending the JSON schema. ⇒ Real SSE change.
2. Envelope is appended to `text` (stringified). ⇒ Frontend parser interprets stringified-envelope-JSON-as-substring of `text`. Inelegant.
3. Envelope only exists in the persisted message's `metadata`, not on the wire. ⇒ Components appear only at `event: done`, not streaming.

**Fix:** explicitly choose one of the three and update the plan + `chat-sse.service.ts` accordingly. Option 1 (extend SSE delta shape) is the cleanest; option 3 is the simplest non-streaming approach (recommended for the action-intent path, which is buffered non-stream anyway).

### 2.2 🟠 Streaming-vs-buffered mismatch on action intents

**Location:** chat.service.ts:921–948 (read verbatim) vs plan §3.4.

**Reality:** `chat.service.ts`'s action-intent path calls `agentGraph.run()` (non-streaming, returns the full assembled `result`), then yields the reply as a **single** `delta` + done. There is no streaming inside the action path.

**The plan implicitly assumes** that the envelope can ride along during streaming. Since the action path doesn't stream, the envelope only exists at done. Streaming envelopes would only be relevant for the conversation/query path, which has **no tool calling** today — see §3.1 below.

**Fix:** explicitly call out that the action path is buffered, and that envelope rendering happens only at end-of-stream for action intents. Spinning up streaming envelopes is a separate (and harder) workstream.

---

## 3. Path / Coverage Gaps

### 3.1 🔴 Plan does not enable tool calling on the conversation/query path

**Location:** plan §3.5, lines 432–437.

**Plan claim:** "The query path (LLM conversation) can also produce structured outputs. If the LLM returns JSON conforming to the envelope schema, `sanitizeReply()` extracts it via the brace-balanced JSON approach that already exists."

**Reality:** the query path calls `aiGateway.stream({capability:'conversation'})`. `ai-gateway.service.ts` capability='conversation' has no tool calling. The LLM is invoked with a plain prompt + chat history. **It has zero tool access**. The LLM cannot produce structured envelope content because it has no data — it only sees what the system prompt already included (which is a one-time fetch of `liveData` summaries, line 230: `fetchTenantSnapshot(tenantId)`).

So the "if the LLM returns JSON" claim is false for any question that needs data the LLM wasn't given in the system prompt. To make the query path productive, it would need either:
- A tool-calling round-trip at the query layer (re-issue through `agentGraph.run` with capability='tools' when query needs data), or
- A separate tool-calling branch in `ai-gateway.stream` for non-action prompts.

**Fix:** explicitly mark "query-path envelopes" as out of scope for v1, and concentrate the envelope system on the action path. Document this as a future workstream (W2+ in the rollout already covers only action-integration).

### 3.2 🟡 Hermes-type descriptor must explicitly include `service.gateway`

**Location:** plan §5 line 608 ("If CUSTOM Hermes type gate needed; else skip").

**Reality:** `ToolGatewayService.validate()` (tool-gateway.service.ts:14–55) is **fail-closed**: any tool without a Hermes-type descriptor entry is denied. Chat uses `agentId: 'ai-assistant'` (chat.service.ts:305: `agentId: 'ai-assistant'`). The ai-assistant Hermes type defaults to `HERMES_TOOL_SETS.CUSTOM` (hermes-tools.ts:309: `HERMES_TOOL_SETS[type] ?? HERMES_TOOL_SETS['CUSTOM']`).

`HERMES_TOOL_SETS.CUSTOM` (hermes-tools.ts:297–304) lists `email`, `documents`, `query`, `sheets`, `calendar` — **not** `service.gateway`. So adding `service.gateway` to `CAPABILITY_MAP` AND to `SecurityPolicyProvider.ai-assistant.allowedTools` is **not sufficient** — `ToolGatewayService` will reject the call at the Hermes-type gate.

**Fix:** add to `HERMES_TOOL_SETS.CUSTOM` (or to a dedicated type if you want granularity):
```ts
CUSTOM: [
  ...existing,
  { name: 'service.gateway', description: 'Invoke any tenant-scoped backend capability', permission: ToolPermissionLevel.ALLOW },
],
```
The plan marks this as `+0..3` LOC optional; it is required, not optional.

### 3.3 🟠 Capability-set exposure to the LLM is not specified

**Location:** plan §3.5 line 422, §3.2 CAPABILITY_MAP.

**Problem:** When `resolveChatAllowedTools()` returns `['service.gateway']`, the LLM only sees one tool with a generic description and a generic `z.record(z.unknown())` params schema. It has no way to know which capabilities exist. Quoting `Hermes-tools.md` (2026-07-28) directly: "LLM refuses tool / picks wrong tool" failures are caused by **insufficient context**, not insufficient tools.

**Fix:** the tool's description (or a docstring reach via a `describeCapabilities` companion tool) must enumerate the available capabilities for the LLM:
```ts
readonly description = `
  service.gateway: invoke a tenant-scoped backend capability.
  Available capabilities:
${Object.values(CAPABILITY_MAP).map((c) => `  - ${c.capability} (read-only: ${c.readOnly})`).join('\n')}
  Format: { capability: '<name>', params: {...} }.
`;
```
The description is regenerated from `CAPABILITY_MAP`. Add `describeCapabilities()` as a unit test that asserts the description includes all keys.

### 3.4 🟡 W1–W2 rollout breaks write intents

**Location:** plan §7 rollout Week 1–2.

In W1, `resolveChatAllowedTools()` returns `['service.gateway']` for ALL messages (plan §3.5 line 422). But the W1 `CAPABILITY_MAP` only registers read capabilities (plan §3.2 example). So a user message "create a project for Acme" produces an `Unknown capability` error from the gateway's strict check.

The plan does add write entries in W3, but during W1–W2, **write-intent users see a regression** versus the old per-entity allowlists (which DID include write tools).

**Fix:** feature-flag the simplification:
```ts
private resolveChatAllowedTools(message: string): string[] | null {
  if (process.env.CHAT_USE_SERVICE_GATEWAY === 'true') {
    return ['service.gateway'];
  }
  return /* old per-intent allowlist */;
}
```
Default `false` in W1. Enable per-tenant via Settings only after W3. Roll out gradually with telemetry on `Unknown capability` errors.

### 3.5 🟠 Plan doesn't address the unresolved stale-dist precondition

**Location:** plan §8 line 727 ("This plan requires a clean `nest build` on Contabo").

`fixes.md` FIX-051/052 document that the live `dist/` predates the source and `nest build` has been failing since at least Jul 31 (multiple audit notes per the prior session). The plan treats this as a precondition but doesn't include it as a step. If the team proceeds straight to W1, they're forced to hot-patch `dist/` again — which is exactly the pattern that has been breaking (FIX-051/052 in the previous session).

**Fix:** add an explicit pre-W1 step "Resolve source/dist drift; produce a clean `nest build` on Contabo" as a tracked prerequisite, with verification (`grep -c "zod_1.z.string().optional()$" dist/.../http-llm.transport.js | grep ^0$` should return 0 if FIX-051 is real fix; verify all 3 dist hot-patches in `fixes.md` are now in source + clean dist).

---

## 4. Frontend Issues

### 4.1 🟠 `EnveloperRenderer` switch is missing `suggestions` and `list` cases

**Location:** plan §4.3, lines 514–525; interface §3.3 line 271.

`IEnvelopeComponent.type` lists `'chart' | 'table' | 'metrics' | 'suggestions' | 'list'`. The `EnvelopeRenderer` switch only handles `chart | table | metrics` — `suggestions` and `list` fall to the `default` `null` branch.

**Fix:** either (a) add the cases, or (b) tighten the type union to the implemented cases: `'chart' | 'table' | 'metrics'`. Option (b) is faster.

### 4.2 🟠 `MessageEnvelopeParser.parse()` has no memoization

**Location:** plan §4.4, lines 539–545.

```ts
useEffect(() => {
  if (message.content) {
    setParsed(envelopeParser.parse(message.content));
  }
}, [message.content]);
```

`parse()` runs on every `message.content` change, including every streaming delta. For a long message (e.g. a full project list, ~5 KB), this is re-parsed dozens of times during streaming. No `useMemo` on the parsed result.

**Fix:** wrap with `useMemo` or memoize inside `MessageEnvelopeParser` keyed on `(content.length, content hash)`. Better still: only parse when the delta says "done" or when delta length crosses a threshold.

### 4.3 🟠 Type assertions in `MessageEnvelopeParser.parse()`

**Location:** plan §4.2 lines 484, 487.

```ts
text: (enriched.text as string) ?? extracted.cleaned ?? content,
envelope: { text: enriched.text as string | undefined, components: enriched.components as EnvelopeComponent[] },
```

`as string` is unchecked. If `enriched.text` is an object or number, the rendered React tree shows `[object Object]` instead of failing cleanly.

**Fix:** validate type before casting:
```ts
const text = typeof enriched.text === 'string' ? enriched.text : undefined;
const components = Array.isArray(enriched.components) ? enriched.components : undefined;
```
Add unit tests.

### 4.4 🟠 `MessageEnvelopeParser` has no try/catch around brace-balance failure

**Location:** plan §4.2 line 472–498.

`jsonExtractor.extract()` returns `null` for unbalanced/non-matching input but the parser assumes the `enriched` object has stable shape. If a user's message contains natural prose with `{...}` braces (e.g. "Show me costs {this month}"), the parser may extract a non-JSON string and `JSON.parse` inside `extract` throws (already caught by `extract`'s try/catch which returns null). So `extracted` is `null` and we fall through to `{ text: content }`. OK.

But there's a subtler issue: `extracted` returned shape is `{cleaned, chartType?, chartData?}`. After the fix in §1.1 (new extractor returning `{cleaned, json}`), `extracted.json` is `Record<string, unknown>`. The plan must update for this.

### 4.5 🟠 Unnecessary `useState` + `useEffect` for envelope parsing

The plan uses `useState` + `useEffect` (lines 539–545) to compute `parsed` per render cycle. This is antipattern — use `useMemo`:

```ts
const parsed = useMemo(
  () => (message.content ? envelopeParser.parse(message.content) : null),
  [message.content, envelopeParser],
);
```

Add `useMemo` to the import block; remove `useState` + `useEffect`.

### 4.6 🟠 🟠 Path errors in the SOLID table

**Location:** plan §2, lines 80–84.

The plan lists these files under `backend/src/modules/chat/responses/`:

- `chart-renderer.tsx`
- `table-renderer.tsx`
- `metrics-renderer.tsx`

These have `.tsx` extension (frontend); the path prefix is `backend/` (backend). Either:

- The table is mislabeled — these belong in `frontend-tenant/src/...`, or
- The plan intends to refactor `UnifiedChatMessage.tsx` to extract its inline renderers to separate backend files, which doesn't make sense (backend doesn't render React).

Per §4.3 of the plan ("`MiniChart, MetricsRenderer, TableRenderer` are extracted to this new file (or remain in `UnifiedChatMessage` and imported)"), the correct location is `frontend-tenant/src/shared/components/chat/renderers/{chart,table,metrics}.tsx`. Update the table to reflect this.

---

## 5. Tests / Verification

### 5.1 🟠 Service-method resolution has no concrete test plan

The plan (§6.1) lists `capability-map.spec.ts` as "every serviceToken resolves in NestJS DI; every service has the declared method". Implement via `TestingModule.create()` and reflectively assert `typeof service[mapEntry.method] === 'function'`.

This is fine, but the plan should also add: "every adapter signature matches the declared paramsSchema" — i.e., for each entry, mock the service method, verify the adapter calls it with the right args.

### 5.2 🟠 No test for chat-stream action-intent envelope flow end-to-end

The plan's `chat/stream` integration test (§6.2) lists "SSE delta carries envelope JSON in text field" — but per §2.1 above, it's unclear whether the envelope is in the SSE delta's `text` field, a sibling field, or only in persisted metadata. Write the test once the wire format is fixed.

### 5.3 🟠 Cross-tenant rejection test needs JWT-level faking

The plan's "Cross-tenant rejection" test mentions `Service gateway with tenantId=tnt-1 never returns records from tnt-2`. To test this, the test must:
1. Mock the JWT to inject `tenantId='tnt-1'`.
2. Seed two tenants' worth of data in the integration DB.
3. Invoke the tool.
4. Assert the response contains only `tnt-1` rows.

The plan doesn't include the JWT mocking step. `super.test(e2e)` with `supertest` is typically the path, but the seeding fixture and JWT override need to be specified.

---

## 6. Constitutional / Process

### 6.1 🟠 "Phase 9 / G9 / G8 certification" is missing

The codebase has `phase8-tenant-isolation.spec.ts`, `phase9 tenant isolation`, and a certification run gate. The plan adds a new tool (`service.gateway`) that touches every tenant entity. Per `certification-runner.ts` (per prior reads), all isolation scenarios should re-run. Add to §6 testing:

```
- pnpm certify:phase9 — all 105 scenarios PASS with service.gateway in scope
- pnpm jest --config jest.config.js --testPathPatterns="certs/phase8-tenant-isolation"
```

### 6.2 🟠 Fix-051/052 lessons not referenced

The plan's risk table mentions the stale-dist issue but doesn't cite `fixes.md FIX-051/052` explicitly. Add a Done Definition item: "Verify Contabo `dist/` includes the three hot-patch fixes from FIX-051/052 AND clean source rebuild — no leftover hot-patches after rebuild."

### 6.3 🟡 Conversation path's existing `'conversation'` capability has MiniMax-only fallback

Per the prior session and `capabilities.ts`, the conversation fallback chain defaults to MiniMax models. With MiniMax disabled (system-state shows `MiniMax isActive=false`), the conversation capability's hardcoded chain returns 0 entries, but the catalog fallback adds `deepseek-v4-flash, deepseek-chat`. **This is the resolver's behavior** — fine. The plan doesn't acknowledge that `service.gateway` may also be available from the `conversation` capability's catalog fallback if added to model defaults. (Unlikely to be a real issue; flag for clarity.)

---

## 7. Numerical / LOC Errors

### 7.1 🟠 LOC totals don't add up

| File | Plan | Re-count |
|------|------|---------|
| `response-envelope.interface.ts` | ~20 | 20 |
| `service-gateway.interface.ts` | ~15 | 15 |
| `capability-map.ts` | ~50 | 50 |
| `service-gateway.tool.ts` | ~80 | 80 |
| `response-envelope.builder.ts` | ~100 | 100 |
| `response-envelope.builder.spec.ts` | ~60 | 60 |
| **Backend sub-total** | ~510 | **~325** |

The plan's backend total of ~510 is ~185 LOC inflated. Use the table from the §5 file tables and add up. Frontend total of ~185 is correct.

### 7.2 🟠 "Lines 188–212" alignment

The plan claims the existing inline chart/metrics/table blocks are at lines 188–212 of `UnifiedChatMessage.tsx`. Read-back confirms:
- 188–190: chart
- 192–195: MetricsRenderer
- 197–203: TableRenderer
- 205–212: SuggestionRenderer

SuggestionRenderer is also at 205–212 but the plan only mentions chart/metrics/table. If EnvelopeRenderer replaces all blocks including suggestions, behaviour changes — be explicit about which blocks are replaced.

---

## Summary of Required Fixes (must do before implementation)

| # | Issue | Fix |
|---|-------|-----|
| 1.1 | `MessageEnvelopeParser` calls a chart-only extractor | Create `BraceBalancedEnvelopeExtractor` returning `{ cleaned, json }`; use it in the parser |
| 1.2 | `.strict()` is dropped by `coerceAndParse` | Inline key whitelist check inside `ServiceGatewayTool.executeImpl` |
| 1.3 | `service[cap.method]` is unchecked | Add `typeof === 'function'` guard; cover in tests |
| 1.4 | Service signatures vary | Per-capability `paramsSchema` + adapter function |
| 2.1 | Wire-format ambiguous | Choose: envelope in SSE delta's `data` (extend), or only in persisted metadata; update `chat-sse.service.ts` accordingly |
| 2.2 | Action path is buffered | Acknowledge; envelope renders only at done for action path |
| 3.1 | No tool calling on query path | Mark out-of-scope for v1; deferred workstream |
| 3.2 | Hermes-type gate will reject `service.gateway` | Add to `HERMES_TOOL_SETS.CUSTOM` (required, not optional) |
| 3.3 | LLM can't know capabilities | Tool description enumerates capability list from `CAPABILITY_MAP` |
| 3.4 | W1–W2 write-intent regression | Feature-flag the simplification; default off until W3 |
| 3.5 | Stale-dist precondition missing | Add W0 step: resolve source/dist drift, then `nest build` cleanly |
| 4.1 | `suggestions`/`list` types declared but unrendered | Tighten type union to implemented cases |
| 4.2/4.5 | No memoization for parser | Replace `useState`/`useEffect` with `useMemo` |
| 4.3 | Unchecked `as string` casts | Validate types before casting |
| 4.6 | Frontend files listed under `backend/` paths | Fix the SOLID table paths |
| 6.1 | No certification re-run step | Add `pnpm certify:phase9` to Done Definition |

## Required Plan Updates (before implementation)

After applying these fixes, also update the LOC table (§5) with the corrected backend total (~325 LOC created, not ~510), and update the §1 Executive Summary "56% of tools fail" claim to reference `Hermes-tools.md` more precisely — it reported 31/71 worked in a specific scenario, not a global 56%.

---

*Review complete. Plan is sound in direction; the issues above are correctness-level blockers that must be addressed before coding begins.*

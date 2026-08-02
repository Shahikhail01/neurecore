# Common Patterns

> Recipes + conventions every new dev follows. Last refreshed: 2026-07-31.

This doc is for **new developers** to ramp up quickly on the patterns the
codebase uses over and over. Each section is "how to do X correctly".

---

## 1. Add a new Nest module

1. Pick the cluster: see `data-model-tour.md §1` and check if a sibling
   module already exists for the cluster.
2. Create the folder `backend/src/modules/<name>/` with:
   - `<name>.module.ts`
   - `controllers/<name>.controller.ts`
   - `services/<name>.service.ts`
   - `dto/` for request/response DTOs
   - `interfaces/` for TS contracts
   - `__tests__/<name>.service.spec.ts`
3. Wire into `AppModule.imports` at `backend/src/app.module.ts`.
4. Add a tag + base path: `@Controller({ path: '<name>', version: '1' })`.
5. Declare roles + guards (`UseGuards(JwtAuthGuard, RolesGuard)`,
   `@Roles(...)`).
6. Add a tenant-context guard acceptance: `TenantContextGuard` runs
   automatically as an `APP_GUARD`.
7. If you persist data, use the `Command` pattern (see §6).
8. Write the integration test under `*.integration-spec.ts`.
9. Add the path to `api-reference-quickmap.md`.

## 2. Add a new Prisma model

1. Edit `backend/prisma/schema.prisma`.
2. Run `pnpm prisma format` + `pnpm prisma validate`.
3. `pnpm prisma migrate dev --name <descriptive-name>` — this creates the
   SQL migration + regenerates Prisma client.
4. Commit both the schema edit and the migration folder.
5. **Tenant scoping:** most domain models must carry `tenantId`. The
   Postgres `@@unique` index should include `(tenantId, <naturalKey>)`.
6. **Repository helpers:** wire into the relevant Nest module
   (`projects/`, `tasks/`, etc.) — never query Prisma directly from
   controllers; go through a service.
7. **Update this doc** if it's a notable model.

## 3. Add a new seed script

1. Create `backend/prisma/seed-<name>.cjs`.
2. Use `PrismaClient` directly (CommonJS) — `cjs` keeps parity with the
   existing seeds.
3. Add a script to `backend/package.json`:
   ```json
   "seed:<name>": "node prisma/seed-<name>.cjs",
   "seed:<name>:check": "node prisma/seed-<name>.cjs --check"
   ```
4. The `--check` flag re-verifies that DB state matches expectations
   without writing — pattern used by `seed-industry-templates` etc.
5. Add an idempotency test: `pnpm test:seed:<name>` (see
   `scripts/test-seed-idempotency.mjs`).

## 4. Add a new seed catalogue (e.g. new industry)

1. Copy the closest seed script
   (`seed-business-technology-templates.cjs`) as the starting point.
2. Edit the data; keep the shape idempotent
   (`upsert` keyed on natural IDs, not `create`).
3. Add a script in `package.json` under
   `seed:<industry>-templates` / `seed:<industry>-templates:check`.
4. Wire into the aggregate `seed:industry-templates:all`:
   ```bash
   pnpm seed:industry-templates:all
   ```
5. Add a `frontend-tenant/src/lib/<industry>s.ts` data file.
6. Update `frontend-tenant/src/lib/industryNavigation.ts`.
7. If a package ships with it, write `seed-<industry>-packages.cjs`.

## 5. Add a new AI tool

1. Decide permission: `ALLOW | READ_ONLY | APPROVAL_REQUIRED | DENY`
   (`backend/src/modules/tools/built-in/hermes-tools.ts`).
2. Add the descriptor to the right `HermesAgentType` table in
   `hermes-tools.ts`.
3. Implement the `StructuredTool` provider in
   `built-in/neurecore-tools.ts` (NestJS-injectable: inject Prisma,
   `TenantContextService`, etc.).
4. Register the provider in `tools.module.ts`.
5. If `APPROVAL_REQUIRED`, add an entry to the approval port
   (`modules/approval-port/`).
6. Add a unit test (`*.spec.ts`) covering the happy path + tenant
   isolation.
7. Update `comms/hermes-tools.md` with the new row.

## 6. Use the Command pattern

Any business mutation that must be transactional with its outbox event
goes through the Command pattern.

Skeleton:
```ts
// backend/src/common/commands/ <command-name>.command.ts
import { Command } from './command';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export class CreateProjectCommand extends Command<CreateProjectResult> {
  static readonly type = 'CreateProject';
  constructor(
    private readonly input: CreateProjectInput,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) { super(); }

  async execute(): Promise<CreateProjectResult> {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data: this.input });
      await this.outbox.append(tx, {
        type: 'project.created',
        aggregateId: project.id,
        tenantId: this.input.tenantId,
      });
      return { projectId: project.id };
    });
  }
}
```

Consumers:
- `IdempotencyInterceptor` dedups based on `Idempotency-Key` header.
- `OutboxWorker.bootstrap()` (started in `AppModule.onApplicationBootstrap`)
  picks up and dispatches.
- `FailureInjectionBus` lets tests exercise failure paths.

For audit + tracing, see `correlation/correlation.module.ts`.

## 7. Add a new chat-issued command (FE palette or natural-language)

1. **Palette action:** add an entry to
   `frontend-tenant/src/services/register-commands.ts`. **Never** edit the
   `CommandPalette.tsx` component itself.
2. **Natural-language binding:** today this lives in
   `chat/chat.service.ts` (LLM-side graph). See NC-SIM04-005 in
   `pending-tasks.md`.
3. After the command hits the right handler, the service should still
   call the right backend REST endpoint through `services/api.ts` (or
   `authHttpClient.ts`).

## 8. Add a new FE service module

1. Create `frontend-tenant/src/services/<name>.service.ts`.
2. Use `axios.create({ baseURL: '/api/v1' })` if a new instance is
   needed; otherwise import the shared `api` instance.
3. Bake in CSRF: read `__Host-nc_csrf` cookie and echo as
   `X-CSRF-Token` header for mutating methods. The shared `api.ts`
   interceptor already does this.
4. Bake in 401 refresh + `authService.reportAuthFailure` (never a hard
   redirect, FIX-020). Use the shared client.
5. Unwrap the response envelope with `unwrap.ts`.

## 9. Add a new FE page

1. Pick a folder under `frontend-tenant/src/app/` (or `frontend-admin/`).
2. Default to **React Server Component**. Add `'use client'` only at the
   boundary that needs state.
3. For pages behind auth, wrap with `useRequireAuth()` (or rely on the
   admin `middleware.ts`).
4. For forms, prefer `useToast()` for success/failure messages instead of
   `alert()`.
5. Use the shared error handler: `errorHandler.handle(...)`.

## 10. Add a new marketplace tab

1. Add a new public aggregation function in
   `backend/src/modules/marketplace/services/marketplace.service.ts`.
2. Add the tab name to the tab list returned by `GET /marketplace/tabs`.
3. Wire `GET /marketplace/items?tab=<new>` to call the new aggregation.
4. Add the corresponding FE card on the tenant portal
   `frontend-tenant/src/app/marketplace/`.
5. Update `solutions-and-marketplace.md §5`.

## 11. Add a new Migration / Migration safety

1. `pnpm prisma migrate dev --name <feature>` creates the migration.
2. Migrations run as part of the **atomic deploy** —
   `scripts/deploy/neurecore-deploy.sh` phases 5–7 do this with bounded
   retry.
3. Never edit a committed migration. If you need to fix it, add a new
   one.
4. Destructive SQL must include a verified rollback. The atomic deploy
   only reverts the app, not the DB schema.
5. Avoid `REFERENCES` to **future** migration tables in the same deploy
   (Prisma is fine; raw SQL might fail).

## 12. Add a new certification scenario

1. Decide scenario type. If new, add to `ScenarioType` at
   `backend/src/test/certification/certification-runner.ts:36-43`.
2. Define expected outcomes + idempotency key.
3. Implement the scenario executor
   (`backend/src/test/certification/scenarios/`).
4. Wire into the runner's matrix at
   `backend/src/test/certification/certification-runner.ts`.
5. Add a unit spec.
6. Re-run `pnpm certify:phase9:all`. If your new scenario lowers a
   threshold, justify in `pending-tasks.md`.

## 13. Logging + correlation

- **Always** log structured JSON via pino (`Logger` from `@nestjs/common`
  is fine; pino is configured globally).
- Read correlation via `LoggingService` (it surfaces the
  `X-Correlation-ID`).
- Slow requests (>1500ms) auto-elevate to `warn` via `pino-http`
  (`main.ts:65-72`).
- Don't log `req.headers.authorization` or `req.headers.cookie`;
  redacted by `main.ts:74-77`.

## 14. CSRF + cookie auth — the rules

- **All mutating endpoints** must carry `X-CSRF-Token` (unless in
  `CsrfProtectionMiddleware.EXEMPT_PATHS`).
- The CSRF token is the contents of the `__Host-nc_csrf` cookie.
- Backend rejects mismatched or missing tokens with `403 CSRF_TOKEN_*`.
- HMAC-signed sidecar endpoints (Hermes adapter) are also exempt
  (`HMAC_SERVICE_PATHS` at `csrf.middleware.ts:52-55`).
- For dev on `http://localhost`, set `USE_HTTPONLY_AUTH=false` (legacy
  bearer still works).

## 15. RBAC

| Role | Scope | Auth surface |
|---|---|---|
| `SUPER_ADMIN` | platform | admin portal (`frontend-admin`) |
| `PLATFORM_ADMIN` | platform ops | admin portal |
| `OWNER` | tenant | tenant portal |
| `ADMIN` | tenant | tenant portal |
| `USER` | tenant | tenant portal |
| `AGENT` | service identity | service JWT |
| `AUDITOR` | read-only | tenant portal |
| `SUPPORT` | limited write | admin portal |

Declare per-endpoint:
```ts
@Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN')
```

## 16. Idempotency

Always include an `Idempotency-Key: <uuid>` header on POST/PUT/PATCH.
`IdempotencyInterceptor` (`backend/src/common/idempotency/`) dedups
transport-side; `IdempotencyService` (`enterprise-events/idempotency/`)
dedups effect-side.

## 17. Feature flags

- **Tenant-scoped:** set via
  `TenantFeatureFlagOverride` (admin API). Read via
  `TenantFlagsService` (`@Global`).
- **Global kill-switches:** set via `FeatureFlagModule`. Read via
  `FeatureFlagService`.
- **Bake:** guard the route or branch in the service:
  ```ts
  if (await this.flags.isEnabled('foo', tenantId)) { ... }
  ```

## 18. SSE streaming

- `ChatSseService` — the canonical SSE writer for chat
  (`backend/src/modules/chat/chat-sse.service.ts`).
- `AgentStreamingController` — for agent responses
  (`backend/src/modules/agents/streaming/agent-streaming.controller.ts`).
- The CORS proxy at `scripts/contabo/cors-proxy.js` accepts the
  `?EIO=4&transport=polling` upgrade path.

## 19. Markdown + agent-descriptor conventions

When editing tool descriptors (in `hermes-tools.ts`):
- `ALLOW` → no `conditions`.
- `READ_ONLY` → no `conditions`.
- `APPROVAL_REQUIRED` → set `approvalType` (`FIRE | VENDOR_PAYMENT |
  BUDGET | CUSTOM`) and (if relevant) `minApprovers` + `thresholdUsd`
  + `maxDiscountPct`.

## 20. PR conventions

- Branch names use `feat/`, `fix/`, `chore/`, `docs/`, `test/`.
- Commit messages reference any ADR boundary they enforce:
  `feat(approval-port): wire Work-Runtime approval (ADR-006)`.
- Pre-PR: run `pnpm verify` (backend + frontend per-app).
- Don't merge if a sim went ❌; resolve first.
- After merge: update the relevant doc in `memory-bank/` with file:line
  references.

---

## Source pointers

- `backend/package.json` scripts (verify, test, certify).
- `backend/src/main.ts` (bootstrap order, CSRF/CORS, access log).
- `backend/src/app.module.ts` (module wiring).
- `backend/src/common/*` (commands, outbox, idempotency,
  correlation).
- `backend/src/modules/*/controllers/*.controller.ts` (endpoint shape).
- `frontend-tenant/src/services/register-commands.ts` (command palette).
- `frontend-tenant/src/services/api.ts` (CSRF + refresh).
- `scripts/deploy/neurecore-deploy.sh` (atomic deploy).
- `memory-bank/auth.md` (cookie + CSRF rules).
- `memory-bank/backend.md` (overall architecture).
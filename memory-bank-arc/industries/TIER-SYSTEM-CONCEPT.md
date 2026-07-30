# NeureCore — Tier System: Refactored Concept

**Status:** 📋 Draft for review — 4 Logical Tiers proposed
**Date:** 2026-07-21
**Owner:** Platform team
**Related docs:**
- [INDUSTRY-GROUPS-CONCEPT.md](./INDUSTRY-GROUPS-CONCEPT.md) — Industry side
- [pools-taxonomy.md §4](../pools-taxonomy.md#4-tiers-pool) — current TierTemplate pool
- [left-rail-icon.md](../left-rail-icon.md) — navigation that Tier constrains
- [system-state.md](../system-state.md) — current production state

---

## 1. The Problem

The codebase has **three competing tier systems** that have drifted apart:

| Source | What it is | Rows | Status |
|---|---|---|---|
| **`Tier` table** (schema.prisma:335) | The actual DB table tenants reference | 4 rows per `system-state.md` | Canonical for tenant FK |
| **`TierTemplate` table** (schema.prisma:3889) | The commercial-offering pool | 4 rows: `starter`, `professional`, `enterprise`, `government` | Anchors `Package` rows |
| **`settings.service.ts DEFAULT_TIERS`** | File-backed JSON config | 3 rows: `free`, `starter`, `pro` | Out of date, file-based, not DB |

**Specific conflicts found:**

1. `Tier` table says 4 tiers exist (Starter/Growth/Pro/Enterprise per system-state); `TierTemplate` seeder says Starter/Professional/Enterprise/Government. **Growth vs Professional naming conflict** — unclear which is on prod.
2. `settings.service.ts` has `free` and `pro` but no `growth`, `enterprise`, `government`.
3. `FREE` is reachable via `tenants.service.ts:136` `findFirst({ where: { isDefault: true } })` but no DB `Tier` row matches.
4. `TierTemplate.government` exists but `Tier` table has no government row. Tenants can't be assigned to it.
5. `Package` rows anchor to `TierTemplate` (4 slugs), but `Tenant.tierId` FK goes to `Tier` (different set of slugs). The two never directly match.
6. `seed-package-catalogue.cjs` notes "pool Business → our professional" mapping (per `pools-taxonomy.md` §6.3) — a 5th tier (Business) that exists in the upstream pool spec but nowhere else.
7. Feature gating logic (`action-authorization.guard.ts:203`) reads `tenant.tier.slug.toUpperCase()` — works but only because of permissive casting; no central tier-resolution table.
8. Pricing lives in 3 places: `Tier.monthlyPrice` (DB), `TierTemplate` (no price), `settings.service.ts tiers` (file JSON). Which is the billable truth?

**Result:** Super admin cannot edit Tiers from `cc.neurecore.com` in a single, complete way. Editing tier limits (max agents, max storage, allowSso, etc.) requires touching 3 different code paths. Billing integration unclear.

---

## 2. Goal of the Refactor

**One Tier system. One source of truth. Fully editable from `cc.neurecore.com`.**

| Requirement | How met |
|---|---|
| Single source of truth for tier attributes | One `Tier` table, no `TierTemplate` table |
| Super admin can edit all tier fields from admin UI | New `/admin/tiers` page using existing `tiers.controller.ts` endpoints |
| Tenant billing uses Tier's price | `Tier.monthlyPrice` is the billable field; `BillingService` reads from it |
| Tier constrains runtime behaviour | All limit/feature checks go through `TierResolver` service |
| Tier × Industry matrix works | `Tier` table is the single anchor for both Package composition and tenant FK |
| Removes free vs paid ambiguity | Free is just another Tier row, not a special case |

---

## 3. Decisions Locked In

| # | Decision | Rationale |
|---|---|---|
| **D1** | **One Tier table**, no `TierTemplate` | Eliminates the dual-table confusion. `TierTemplate` becomes an alias or is dropped. |
| **D2** | **4 canonical Tiers**: Basic (free), Business, Professional, Enterprise | Covers trial → small team → scaling → mission-critical. No "Starter" / "Growth" / "Government" / "Pro" variants. |
| **D3** | Basic is a real Tier row (not a special case) — replaces "Free" naming | Tenants on trial land here. Same code path as paid tiers. |
| **D4** | Industry Group "Government & Public Sector" stays in the Industry model, NOT a Tier | Public-sector deployment is an Industry choice with separate billing terms negotiated manually. |
| **D5** | All tier attributes editable in admin UI | Name, slug, description, pricing (monthly + yearly), limits (users/agents/departments/storage/api calls/file size), feature flags (branding/api/sso/audit-export), agent pool composition |
| **D6** | Tier ordering is `sortOrder` int | No enum. Admin reorders via drag. |
| **D7** | Exactly one Tier has `isDefault = true` | `tenants.service.ts:136` `findFirst({ where: { isDefault: true } })` resolves to Basic (trial) |
| **D8** | `Tier` is never deleted once it has tenants referencing it | Soft delete via `isActive = false`. Preserves audit trail. |
| **D9** | Tier change triggers agent/feature re-evaluation | `TierUpgradeService` listens for `TenantTierChanged` event, activates/deactivates agents + features per new tier limits |
| **D10** | Industry × Tier package composition stays in `Package` table | No change to Package model. Just `tierTemplateId` FK becomes `tierId` FK (renamed) |

---

## 4. The 4 Logical Tiers (Proposed)

### 4.1 Basic (Free)

| Attribute | Value |
|---|---|
| **Slug** | `basic` |
| **Name** | Basic |
| **Tagline** | Try NeureCore with no commitment |
| **sortOrder** | 10 |
| **isDefault** | true |
| **monthlyPrice** | $0 |
| **yearlyPrice** | $0 |
| **Currency** | USD |
| **Trial duration** | 14 days (then read-only grace period until user explicitly upgrades) |
| **maxUsers** | 2 |
| **maxAgents** | 3 |
| **maxDepartments** | 1 |
| **maxStorageGB** | 1 |
| **maxApiCalls** | 1,000/month |
| **maxConversationMessages** | 500 |
| **maxFileSizeMB** | 10 |
| **allowCustomBranding** | ✗ |
| **allowApiAccess** | ✗ |
| **allowSso** | ✗ |
| **allowAuditExport** | ✗ |
| **Available agents** | Generic only — no industry-specialised agents |
| **Available packages** | Trial bundle (read-only, previews only) |
| **Approval-chain depth** | 1 stage max |
| **Analytics** | Basic KPIs only |
| **Storage warning** | Banner at 80% usage: "Upgrade to Business for 10 GB" |
| **Auto-convert to** | None — user must explicitly pick a paid tier at trial end |

### 4.2 Business

| Attribute | Value |
|---|---|
| **Slug** | `business` |
| **Name** | Business |
| **Tagline** | For small teams getting started |
| **sortOrder** | 20 |
| **isDefault** | false |
| **monthlyPrice** | $29 |
| **yearlyPrice** | $290 (2 months free) |
| **maxUsers** | 10 |
| **maxAgents** | 10 |
| **maxDepartments** | 3 |
| **maxStorageGB** | 10 |
| **maxApiCalls** | 10,000/month |
| **maxConversationMessages** | 5,000 |
| **maxFileSizeMB** | 50 |
| **allowCustomBranding** | ✗ |
| **allowApiAccess** | ✓ |
| **allowSso** | ✗ |
| **allowAuditExport** | ✓ |
| **Available agents** | Industry-specialised top-priority agents (3-5 per Industry) |
| **Available packages** | Business-tier packages per Industry (4 per Industry per `pools-taxonomy.md` §6.5) |
| **Approval-chain depth** | 2 stages max |
| **Integrations** | QuickBooks (Financial), Square (Retail), MS365 / Google Workspace |
| **Analytics** | Basic + custom reports |

### 4.3 Professional

| Attribute | Value |
|---|---|
| **Slug** | `professional` |
| **Name** | Professional |
| **Tagline** | Scale up with advanced capabilities |
| **sortOrder** | 30 |
| **isDefault** | false |
| **monthlyPrice** | $99 |
| **yearlyPrice** | $990 (2 months free) |
| **maxUsers** | 50 |
| **maxAgents** | 50 |
| **maxDepartments** | 10 |
| **maxStorageGB** | 100 |
| **maxApiCalls** | 100,000/month |
| **maxConversationMessages** | 50,000 |
| **maxFileSizeMB** | 200 |
| **allowCustomBranding** | ✓ |
| **allowApiAccess** | ✓ |
| **allowSso** | ✓ |
| **allowAuditExport** | ✓ |
| **Available agents** | All industry-specialised agents (15-20 per Industry) |
| **Available packages** | Business + Professional tier packages (per `pools-taxonomy.md` §6.5 mapping: pool "Business" → our "Professional") |
| **Approval-chain depth** | 3 stages max |
| **Integrations** | + Xero, Sage, Salesforce, HubSpot, ERP connectors |
| **Analytics** | + Predictive analytics, custom dashboards |
| **Workflows** | Multi-step workflows, conditional logic |

### 4.4 Enterprise

| Attribute | Value |
|---|---|
| **Slug** | `enterprise` |
| **Name** | Enterprise |
| **Tagline** | Mission-critical scale and support |
| **sortOrder** | 40 |
| **isDefault** | false |
| **monthlyPrice** | $499 |
| **yearlyPrice** | $4,990 (2 months free) |
| **maxUsers** | Unlimited (recommended up to 5000) |
| **maxAgents** | Unlimited |
| **maxDepartments** | Unlimited |
| **maxStorageGB** | 1,000 |
| **maxApiCalls** | 1,000,000/month |
| **maxConversationMessages** | Unlimited |
| **maxFileSizeMB** | 1,000 |
| **allowCustomBranding** | ✓ |
| **allowApiAccess** | ✓ |
| **allowSso** | ✓ |
| **allowAuditExport** | ✓ |
| **Available agents** | All agents + custom-trained industry specialists |
| **Available packages** | All tiers + Enterprise-only packages (multi-office, custom workflows) |
| **Approval-chain depth** | 4+ stages |
| **Integrations** | + Custom ERP via API, on-prem connectors, dedicated VPC |
| **Analytics** | + Full BI suite, data warehouse export, custom data lakes |
| **Support SLA** | 99.9% uptime, 4-hour response, dedicated CSM |
| **Compliance** | SOC 2 Type II, HIPAA, custom DPA |

---

## 5. Visual Tier Comparison

```
┌──────────────┬──────────┬──────────┬─────────────┬─────────────┐
│              │  Basic   │ Business │ Professional│ Enterprise  │
├──────────────┼──────────┼──────────┼─────────────┼─────────────┤
│ Price/mo     │ $0       │ $29      │ $99         │ $499        │
│ Users        │ 2        │ 10       │ 50          │ Unlimited   │
│ Agents       │ 3        │ 10       │ 50          │ Unlimited   │
│ Departments  │ 1        │ 3        │ 10          │ Unlimited   │
│ Storage      │ 1 GB     │ 10 GB    │ 100 GB      │ 1 TB        │
│ API calls/mo │ 1,000    │ 10,000   │ 100,000     │ 1M          │
│ Approvals    │ 1 stage  │ 2 stage  │ 3 stage     │ 4+ stage    │
│ Branding     │ ✗        │ ✗        │ ✓           │ ✓           │
│ API access   │ ✗        │ ✓        │ ✓           │ ✓           │
│ SSO          │ ✗        │ ✗        │ ✓           │ ✓           │
│ Audit export │ ✗        │ ✓        │ ✓           │ ✓           │
└──────────────┴──────────┴──────────┴─────────────┴─────────────┘
```

---

## 6. Data Model (Refactored)

### 6.1 `Tier` table — the single source of truth

```prisma
model Tier {
  id          String  @id @default(uuid())
  slug        String  @unique // 'free' | 'starter' | 'growth' | 'enterprise'
  name        String // 'Free' | 'Starter' | 'Growth' | 'Enterprise'
  tagline     String?
  description String?        @db.Text
  icon        String?
  isActive    Boolean @default(true)
  isDefault   Boolean @default(false) // exactly one row has true
  sortOrder   Int     @default(0)

  // Pricing
  monthlyPrice Decimal @default(0) @db.Decimal(10, 2)
  yearlyPrice  Decimal @default(0) @db.Decimal(10, 2)
  currency     String  @default("USD")

  // Limits
  maxUsers                Int @default(2)
  maxAgents               Int @default(3)
  maxDepartments          Int @default(1)
  maxStorageGB            Int @default(1)
  maxApiCalls             Int @default(1000)
  maxConversationMessages Int @default(500)
  maxFileSizeMB           Int @default(10)

  // Feature flags
  allowCustomBranding Boolean @default(false)
  allowApiAccess      Boolean @default(false)
  allowSso            Boolean @default(false)
  allowAuditExport    Boolean @default(false)

  // Trial / billing
  trialDays           Int?     // null for paid tiers; 14 for Free
  autoDowngradeTierId String?  // if trial expires, downgrade to this tier
  billingCycle        String   @default("monthly") // 'monthly' | 'yearly'

  // Relations
  tierAgentPools     TierAgentPool[]
  tenants            Tenant[]
  packageAnchors     Package[]  // renamed from Package.tierTemplateId

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isDefault])
  @@index([isActive, sortOrder])
  @@map("tiers")
}
```

### 6.2 Changes to related tables

| Table | Change |
|---|---|
| `TierTemplate` | **Dropped**. Migrate `tierTemplateId` FK in `Package` table to `tierId` FK pointing at `Tier`. After migration, drop the table. |
| `Tenant.tierId` | **No change** — already FK to `Tier` |
| `Package.tierTemplateId` | Rename to `Package.tierId` |
| `TierAgentPool` | **No change** — already FK to `Tier` |
| `Feature` | No change. Tier gates via Tier × Industry matrix, not direct FK |

### 6.3 New tables

```prisma
model TierAuditLog {
  id        String   @id @default(uuid())
  tierId    String
  tier      Tier     @relation(fields: [tierId], references: [id])
  changedBy String   // userId of super admin
  action    String   // 'create' | 'update' | 'activate' | 'deactivate' | 'delete'
  beforeJson Json?   // snapshot of tier attributes before change
  afterJson  Json?   // snapshot after change
  reason    String?
  createdAt DateTime @default(now())

  @@index([tierId, createdAt])
  @@map("tier_audit_logs")
}

model TierChangeRequest {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  fromTierId  String
  toTierId    String
  requestedBy String   // userId
  approvedBy  String?
  status      String   @default("PENDING") // PENDING | APPROVED | REJECTED | COMPLETED
  effectiveAt DateTime?
  createdAt   DateTime @default(now())

  @@index([tenantId, status])
  @@map("tier_change_requests")
}
```

---

## 7. Admin UI: `/admin/tiers`

### 7.1 List page

Table view of all Tiers:
- Name | Slug | Price | Users | Agents | Storage | isDefault | isActive | Actions
- "Add Tier" button (top right) — opens creation modal
- Row click → edit page
- Toggle `isActive` inline (with confirmation)
- Set as Default (only one allowed)

### 7.2 Edit page (`/admin/tiers/[slug]`)

Tabbed editor:

| Tab | Fields |
|---|---|
| **Identity** | Name, Slug, Tagline, Description, Icon, Sort Order |
| **Pricing** | Monthly Price, Yearly Price, Currency, Billing Cycle, Trial Days (Free only), Auto-downgrade Tier |
| **Limits** | Max Users, Max Agents, Max Departments, Max Storage (GB), Max API Calls/month, Max Conversation Messages, Max File Size (MB) |
| **Features** | Toggle: allowCustomBranding, allowApiAccess, allowSso, allowAuditExport |
| **Agent Pool** | List of agent templates available at this tier; drag-drop to reorder; toggle per-agent `isDefaultSelected` |
| **Audit Log** | Read-only list of changes to this tier |

Save → diff modal showing changes → confirm → writes to `TierAuditLog`.

### 7.3 Capabilities matrix view (`/admin/tiers/matrix`)

Side-by-side comparison of all Tiers across all attributes. Useful for sales conversations and pricing reviews.

```
              Free    Starter   Growth    Enterprise
Price         $0      $29       $99       $499
Users         2       10        50        ∞
Agents        3       10        50        ∞
...
```

---

## 8. Tenant-Facing Impact

### 8.1 Onboarding tier-selector

Currently `selectTier()` in `onboarding.service.ts:109` lets new tenants pick a Tier at onboarding. With the refactor:

- **Default assigned:** Basic (trial)
- **Trial countdown:** banner shows "13 days remaining in trial"
- **Day 14 options:** "Upgrade to Business" (with payment) or "Choose Basic permanently" (limits apply)
- **No silent auto-convert** to Business — user must explicitly choose

### 8.2 In-app Tier badge

Top-right of `TenantShell.tsx` shows current Tier with hover details:
```
┌──────────────────────┐
│ 🟢 Professional      │
│ 50 agents · 23 used  │
│ 100 GB · 47 GB used  │
│ Next billing: Aug 1  │
└──────────────────────┘
```

Click → opens billing + upgrade modal.

### 8.3 Upgrade/downgrade flow

| Action | Flow |
|---|---|
| Upgrade (Professional → Enterprise) | Immediate. New limits + features activate. Pro-rated billing for current month. |
| Downgrade (Professional → Business) | Creates `TierChangeRequest` PENDING. Admin reviews, approves, schedules effective date (end of billing cycle). Warn about data loss if new limits would be violated. |
| Same-tier change (e.g. update limits by admin) | No tenant action; new limits apply immediately. |

---

## 9. Migration Plan

### 9.1 Pre-migration audit

Before any code change:
1. Export current DB Tier rows: `prisma db execute --stdin <<<'SELECT * FROM tiers;'`
2. Export current TierTemplate rows
3. Export current `Package.tierTemplateId` values
4. Identify which `Tenant.tierId` values reference which slugs
5. Resolve "Growth vs Professional" naming conflict (default to `growth` if production data shows it)

### 9.2 Migration steps

```bash
# Step 1: Add new columns to Tier (nullable)
psql: ALTER TABLE tiers ADD COLUMN "tagline" VARCHAR(255);
psql: ALTER TABLE tiers ADD COLUMN "icon" VARCHAR(100);
psql: ALTER TABLE tiers ADD COLUMN "trialDays" INT;
psql: ALTER TABLE tiers ADD COLUMN "autoDowngradeTierId" VARCHAR(36);
psql: ALTER TABLE tiers ADD COLUMN "billingCycle" VARCHAR(20) DEFAULT 'monthly';

# Step 2: Add TierAuditLog and TierChangeRequest tables (new migration)
psql: <generated from prisma migrate dev>

# Step 3: Migrate Package.tierTemplateId → Package.tierId
# Map TierTemplate.slug → Tier.slug (e.g. 'professional' → 'growth')
node prisma/migrate-package-tier-fks.cjs
#   - Reads each Package row
#   - Resolves the tierTemplateId to its TierTemplate.slug
#   - Finds the matching Tier row by slug
#   - Writes Package.tierId
#   - Leaves tierTemplateId intact for now (deprecate later)

# Step 4: Add Package.tierId (nullable first)
psql: ALTER TABLE packages ADD COLUMN "tierId" VARCHAR(36);

# Step 5: Backfill tierId (run script)
node prisma/backfill-package-tier-id.cjs

# Step 6: Verify zero packages have null tierId before making NOT NULL
psql: SELECT COUNT(*) FROM packages WHERE "tierId" IS NULL;
# Expected: 0

# Step 7: Make tierId NOT NULL
psql: ALTER TABLE packages ALTER COLUMN "tierId" SET NOT NULL;

# Step 8: Drop tierTemplateId from Package (after deprecation period)
# Deprecation period: 2 weeks (during which both columns exist)

# Step 9: Drop TierTemplate table (after Package migration verified)
psql: DROP TABLE tier_templates;

# Step 10: Rename Package.tierId index
psql: ALTER INDEX packages_tier_template_id_idx RENAME TO packages_tier_id_idx;
```

### 9.3 Backwards compatibility

During the 2-week deprecation:
- Code reads `Package.tierId` if present, falls back to `Package.tierTemplateId`
- Admin UI shows warning banner: "TierTemplate is being deprecated"
- New admin pages (Industry Groups + Tiers v2) live side-by-side with old `/admin/tier-templates`

### 9.4 Rollback plan

If migration fails at any step:
- Restore from `pg_dump` snapshot taken before migration
- Drop the new columns/tables added so far
- Tier rows unchanged (additive only — never modified during migration)
- Re-run from failed step

---

## 10. Implementation Sequence

| # | Task | Touches | Estimate |
|---|---|---|---|
| 1 | Pre-migration audit script | DB | 0.5 day |
| 2 | Resolve "Growth vs Professional" naming | All seed files | 0.5 day |
| 3 | Schema additions: `Tier` new cols, `TierAuditLog`, `TierChangeRequest`, `Package.tierId` | Prisma | 1 day |
| 4 | Migration scripts (additive columns, backfill, NOT NULL) | DB | 1 day |
| 5 | Update `seed-business-composition.cjs` — drop TierTemplate seeding, seed Tier with all 4 rows | Seeder | 0.5 day |
| 6 | Update `seed-package-catalogue.cjs` — write to `Package.tierId` | Seeder | 0.5 day |
| 7 | Backend: `TierResolver` service (single source for limit/feature checks) | NestJS | 1.5 days |
| 8 | Backend: `TierChangeService` (handles upgrade/downgrade flows) | NestJS | 2 days |
| 9 | Backend: deprecation shim (read tierId, fall back to tierTemplateId) | NestJS | 0.5 day |
| 10 | Admin UI: new `/admin/tiers` list page | FE | 1.5 days |
| 11 | Admin UI: `/admin/tiers/[slug]` edit page (5 tabs) | FE | 2 days |
| 12 | Admin UI: capabilities matrix view | FE | 0.5 day |
| 13 | Tenant UI: tier badge in TopBar | FE | 1 day |
| 14 | Tenant UI: upgrade/downgrade modal | FE | 1.5 days |
| 15 | Update `industry-groups-concept.md` §9.5 to reflect new Tier names (Growth not Professional) | Doc | 0.5 day |
| 16 | Update `RailCustomizeModal` to show tier-gated items as locked/unlocked | FE | 0.5 day |
| 17 | End-to-end test: new tenant on Free → upgrade to Growth → agent activation | QA | 1.5 days |
| 18 | Migration runbook + DR plan | Doc | 0.5 day |
| **Total** | | | **~17 days** |

---

## 11. What this refactor DELETES

| File / Module | Why |
|---|---|
| `backend/src/modules/tier-templates/` | Module replaced by consolidated `tiers/` module |
| `TierTemplate` Prisma model | One tier system only |
| `frontend-admin/src/app/tier-templates/` | Replaced by `/admin/tiers` |
| `seed-tier-templates` references in seeders | All moved to Tier |
| `settings.service.ts DEFAULT_TIERS` constant | File-backed config replaced by DB |

---

## 12. Success Criteria

- [ ] Single `Tier` table is the only tier definition
- [ ] Super admin can edit every Tier attribute from `/admin/tiers/[slug]`
- [ ] All Tier changes written to `TierAuditLog`
- [ ] Billing service reads price from `Tier.monthlyPrice` (no hardcoded values anywhere)
- [ ] Tenants assigned to one of the 4 Tiers: Basic, Business, Professional, Enterprise
- [ ] TierTemplate table dropped, no code references it
- [ ] All 68 `Package` rows have non-null `tierId`
- [ ] Tier × Industry matrix from `INDUSTRY-GROUPS-CONCEPT.md` §9.5 works against the new Tier table
- [ ] Upgrade/downgrade flow tested with Basic→Business→Professional→Enterprise→Business (downgrade with grace period)
- [ ] No console errors after migration; `mali@live.com` tenant unchanged
- [ ] Old `/admin/tier-templates` URL redirects to `/admin/tiers`

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Migration breaks existing Package FKs | Migration is additive-first; verify zero nulls before NOT NULL; pg_dump before run |
| "Growth" vs "Professional" naming wrong | Audit production before migration; pick whatever's actually in the Tier table |
| Basic tier → Business auto-conversion loses data | No auto-conversion; user must explicitly choose. 14-day trial banner counts down |
| Downgrade loses data (Professional → Business, user has 60 agents, Business allows 10) | Block downgrade; surface conflict; archive excess agents (not delete) |
| Super admin sets bad limits (maxUsers = 0) | Server-side validation: every limit > 0; every feature flag required; defaults enforced |
| Pricing change breaks billing for current subscribers | Tier price changes apply to new billing cycle only; existing subscribers keep their rate for current cycle |
| TierAgentPool entries orphaned after tier limit reduction | Existing agents stay active (warning banner); new instantiation blocked until count drops |
| Tenant stuck on Free trial with critical data when trial ends | Read-only mode for 30-day grace period after trial expiry; banner says "Export your data or upgrade" |

---

## 14. Open Questions

1. Should Enterprise Tier have unlimited limits or a hard ceiling (e.g. 5000 users)? — **Recommendation:** soft unlimited (no hard cap), Enterprise pricing per negotiation above 500 users
2. Should Free tier require a credit card to start? — **Recommendation:** no credit card; 14-day trial; banner prompts at day 7
3. Should billing cycle be per-tier (Enterprise could be annual-only)? — **Recommendation:** yes, `billingCycle` field allows per-tier override
4. Should there be a "Custom" tier for negotiated contracts? — **Recommendation:** yes, but as Enterprise with overridden limits/pricing, not a 5th tier
5. What happens to `mali@live.com` tenant during migration? — **Recommendation:** preserve current tier assignment; audit before/after; manual remap if needed
6. Should we keep TierTemplate data for historical reference? — **Recommendation:** soft-delete via `isActive = false`, archive table not deleted

---

## 15. Related Files

| Concern | Path |
|---|---|
| Current Tier model | `neurecore/backend/prisma/schema.prisma:335` |
| Current TierTemplate model | `neurecore/backend/prisma/schema.prisma:3889` |
| Billing Tier file config | `neurecore/backend/src/modules/settings/settings.service.ts:148` |
| Tier controller (canonical) | `neurecore/backend/src/modules/tiers/tiers.controller.ts` |
| Tier service (canonical) | `neurecore/backend/src/modules/tiers/tiers.service.ts` |
| Tier pool seeder | `neurecore/backend/prisma/seed-business-composition.cjs:38` |
| TierAgentPool model | `neurecore/backend/prisma/schema.prisma:377` |
| Package tierTemplate FK | `neurecore/backend/prisma/schema.prisma:3950` |
| Tenant tierId FK | `neurecore/backend/prisma/schema.prisma:457` |
| Auth service tier resolution | `neurecore/backend/src/modules/auth/services/auth.service.ts:120` |
| Action authorization guard | `neurecore/backend/src/modules/ai-actions/guards/action-authorization.guard.ts:203` |
| Onboarding tier selector | `neurecore/backend/src/modules/onboarding/onboarding.service.ts:109` |
| Industry Groups doc | `neurecore/memory-bank-new/industries/INDUSTRY-GROUPS-CONCEPT.md` |
| Pools taxonomy | `neurecore/memory-bank-new/pools-taxonomy.md` |

---

## 16. Change Log

| Date | Change | Author |
|---|---|---|
| 2026-07-21 | Initial draft — 4 Logical Tiers proposed (Free/Starter/Growth/Enterprise), full refactor plan | Kilo |
| 2026-07-21 | Renamed tiers per user: **Basic** (free) / **Business** / **Professional** / **Enterprise** | Kilo |

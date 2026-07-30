# SIM-04 Accounting Project Full Flow

Phase 3 certification runs the approved SIM-04 prompt through the tenant
frontend and writes auditable artifacts for each attempt. Certification must
use 20 freshly provisioned tenants/users. Reusing a previous tenant, previous
login, or one shared production account is not a valid SIM-04 certification.

```bash
# 1. Provision a fresh 20-tenant cohort against the target database.
cd neurecore
node simulations/SIM-04-Accounting-Project-Full-Flow/provision-sim04-tenants.cjs \
  --count=20 \
  --prefix=sim04-clean-20260730

# 2. Run the browser certification with the generated manifest.
SIM04_TENANT_MANIFEST=simulations/SIM-04-Accounting-Project-Full-Flow/certification/sim04-clean-tenants-2026-07-30.json \
pnpm certify:sim04 --runs=20

# 3. Capture per-tenant duplicate-record evidence after the browser run.
SIM04_TENANT_MANIFEST=simulations/SIM-04-Accounting-Project-Full-Flow/certification/sim04-clean-tenants-2026-07-30.json \
node simulations/SIM-04-Accounting-Project-Full-Flow/capture-sim04-duplicate-evidence.cjs \
  --environment="Contabo production / neurecore_prod"

# 4. Re-run/finalize with SIM04_DUPLICATE_RECORDS_EVIDENCE pointing at
#    the captured JSON. The gate fails closed if the evidence is absent.
```

Required environment:

- `PLAYWRIGHT_BASE_URL` - tenant frontend URL, for example `https://hq.neurecore.com`
- `SIM04_TENANT_MANIFEST` - JSON manifest from `provision-sim04-tenants.cjs`

Optional environment:

- `SIM04_HEADLESS=false` to watch the browser
- `SIM04_ARTIFACT_DIR` to override `runs/<timestamp>`
- `SIM04_DUPLICATE_RECORDS_EVIDENCE` - path to a tracked JSON evidence file
  containing post-run duplicate query results for every tenant in the manifest.
  The gate fails closed when this is absent, invalid, aggregate-only, or missing
  any tenant.
- `SIM04_TENANT_PASSWORD_SALT` - optional salt used when generating deterministic
  cohort passwords.

The runner performs all business mutations through the browser chat and inline
approval cards. It uses backend responses only as read evidence for gate
classification.

Clean-tenant requirements enforced by the runner:

- The manifest must contain at least `--runs` tenant entries.
- Each run must use a unique `tenantId`, `tenantSlug`, user id, and email.
- Each tenant must have `preRunDuplicateCounts` equal to zero.
- Duplicate-record evidence must include a `perTenant` row for every manifest
  tenant and every row must have zero duplicate customer/project/goal counts.

The final 2026-07-29 composite certification is tracked under
`certification/`. Raw browser artifacts under `runs/` remain reproducible and
gitignored because they contain screenshots and large response captures.

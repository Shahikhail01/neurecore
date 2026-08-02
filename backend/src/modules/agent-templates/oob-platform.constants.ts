/**
 * OOB platform-host tenant constant.
 *
 * The `AgentTemplateVersion` model in the Prisma schema requires a
 * non-null `tenantId`. The OOB seed cannot use `tenantId = null` for
 * these rows, so a deterministic, dedicated, non-customer host tenant
 * is provisioned by `seed-oob-agents.cjs` and used as the owner of
 * every seeded OOB `AgentTemplateVersion` row.
 *
 * This tenant:
 *   - is reserved — no user is ever signed in against it;
 *   - is required by the schema's `Tenant` FK on AgentTemplateVersion;
 *   - is named "oob-platform" so it is visually distinct from any
 *     normal tenant in audits and logs;
 *   - tenant-id is a deterministic UUID so the same row is found on
 *     every seed run.
 *
 * It is NOT a tenant execution context — the agents-pool, templates,
 * and marketplace code paths read OOB rows via the existing
 * `tenantVisibleTemplateWhere` filter on `AgentTemplate` (which the
 * public-template ownership continues to enforce) and resolve the
 * version through `agentTemplateId + version`, not by tenant scoping.
 */

export const OOB_PLATFORM_TENANT_ID = 'oob00000-0000-4000-8000-00000000oobb';
export const OOB_PLATFORM_TENANT_SLUG = 'oob-platform';
export const OOB_PLATFORM_TENANT_NAME = 'OOB Platform Seed';

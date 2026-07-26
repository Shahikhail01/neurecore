# AWL Environment Variables

The Autonomous Work Layer uses the following environment variables. None are required for the new modules - all features have sensible defaults.

## Outbox Worker (Phase 3)

| Variable | Default | Description |
|----------|---------|-------------|
| `OUTBOX_POLL_INTERVAL_MS` | `1000` | Worker polling interval (ms) |
| `OUTBOX_BATCH_SIZE` | `10` | Max events per tick |
| `OUTBOX_LEASE_MS` | `30000` | Lease duration (ms) |
| `OUTBOX_MAX_RETRIES` | `3` | Max attempts before dead letter |
| `OUTBOX_BACKOFF_BASE_MS` | `1000` | Base for exponential backoff |
| `OUTBOX_CIRCUIT_THRESHOLD` | `5` | Failures before circuit opens |
| `OUTBOX_CIRCUIT_RESET_MS` | `30000` | Time before half-open retry |

## Tenant Flags (Phase 1)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWL_DEFAULT_FLAG_CANONICAL_INITIATION` | `false` | Default for new tenants |
| `AWL_DEFAULT_FLAG_DURABLE_AUTOMATION` | `false` | Default for new tenants |
| `AWL_DEFAULT_FLAG_AUTO_ASSIGNMENT` | `false` | Default for new tenants |
| `AWL_DEFAULT_FLAG_AUTONOMOUS_EXECUTION` | `false` | Default for new tenants |
| `AWL_DEFAULT_FLAG_HUMAN_REVIEW_WORKFLOW` | `false` | Default for new tenants |
| `AWL_DEFAULT_FLAG_NEW_LIFECYCLE_GUARDS` | `false` | Default for new tenants |
| `AWL_DEFAULT_FLAG_NEW_TIMELINE` | `false` | Default for new tenants |

## Execution Runtime (Phase 5)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWL_EXECUTION_TIMEOUT_MS` | `300000` | Max execution time (ms) |
| `AWL_EXECUTION_MAX_TOKENS` | `100000` | Max tokens per attempt |
| `AWL_EXECUTION_MAX_COST_CENTS` | `1000` | Max cost per attempt |
| `AWL_EXECUTION_MAX_TOOL_CALLS` | `50` | Max tool invocations per attempt |
| `AWL_EXECUTION_HEARTBEAT_MS` | `30000` | Worker heartbeat interval |
| `AWL_EXECUTION_STALE_MS` | `120000` | Stale run detection threshold |

## Assignment (Phase 4)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWL_ASSIGNMENT_DEFAULT_GENERATION` | `1` | Starting assignment generation |
| `AWL_ASSIGNMENT_CACHE_TTL_MS` | `30000` | Eligibility cache TTL |

## Idempotency (Phase 1)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWL_IDEMPOTENCY_TTL_SECONDS` | `86400` | Default key TTL (24h) |
| `AWL_IDEMPOTENCY_MAX_ATTEMPTS` | `3` | Max failed attempts before giving up |

## Feature Flag Overrides

Per-tenant overrides are stored in the database. Use the API:
```
POST /tenant-flags/:flag
{ "enabled": true }
```

## How to Set

Add to your `.env` file:
```bash
OUTBOX_POLL_INTERVAL_MS=2000
OUTBOX_BATCH_SIZE=20
AWL_DEFAULT_FLAG_CANONICAL_INITIATION=true
```

Or set via environment:
```bash
export AWL_DEFAULT_FLAG_CANONICAL_INITIATION=true
```

## No Hard Requirements

All variables have defaults. The new modules will work without any configuration. To customize behavior, override the relevant variables.

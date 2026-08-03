# ADR-005: Command Boundary

**Document ID:** NC-HARNESS-ADR-005
**Status:** PROPOSED — non-required Phase 0 ADR (preserved from earlier draft)
**Type:** Architecture Decision
**Authors:** Architecture Team
**Date:** 2026-08-02

---

## 1. Context

Business mutations in NeureCore must have a single authoritative entry point to ensure:
- Idempotency is guaranteed
- Tenant isolation is enforced
- Audit trail is complete
- Failure is recoverable
- Deterministic replay is possible

Currently, mutations can occur through multiple paths:
- Controller endpoints (direct)
- Hermes tool calls
- Prisma direct mutations (in some cases)
- Event handlers
- Queue processors

This lack of single ownership makes it impossible to guarantee the above properties.

---

## 2. Decision

All business mutations MUST go through typed Application Commands following this path:

```
UI/Tools/System Trigger
        ↓
Application Command (ICommand interface)
        ↓
Authorization Guard
        ↓
Validation
        ↓
Domain Service
        ↓
Database Transaction + Outbox Event
        ↓
Durable Worker (if async)
        ↓
Projection/Audit/Notification
```

**Rules:**
1. Every mutation has exactly one named command owner
2. Commands are typed with input/output schemas
3. Commands receive explicit tenant/actor context
4. Commands execute within a transaction
5. Commands emit outbox events for async processing
6. Direct Prisma mutations are prohibited except in approved adapters

---

## 3. Command Interface

```typescript
// Command interface (ISP - Interface Segregation Principle)
export interface ICommand<TRESULT = void> {
  readonly commandType: string;
  readonly version: string;
  execute(metadata: CommandMetadata): Promise<CommandResult<TRESULT>>;
}

// Command metadata (explicit context)
export interface CommandMetadata {
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  occurredAt: string;
  schemaVersion: number;
}

// Command result
export interface CommandResult<TRESULT> {
  success: boolean;
  data?: TRESULT;
  error?: CommandError;
  correlationId: string;
  occurredAt: string;
}
```

---

## 4. Consequences

### 4.1 Positive Consequences

- **Idempotency guaranteed:** Commands are idempotent by design
- **Tenant isolation enforced:** Every command receives explicit tenant context
- **Audit trail complete:** Every command creates audit events
- **Failure recoverable:** Failed commands can be replayed
- **Deterministic:** Same command with same metadata produces same result

### 4.2 Negative Consequences

- **Migration effort:** Existing tool handlers must be rewritten
- **Performance overhead:** Command pattern adds indirection
- **Learning curve:** Teams must learn command patterns

### 4.3 Mitigation

- Provide migration guide for existing code
- Benchmark performance impact
- Provide training and examples

---

## 5. Migration Plan

### Phase 1 (G1 Gate):
1. Define command interface
2. Migrate critical path mutations (project creation, task assignment)
3. Add ESLint rules to detect direct Prisma mutations

### Phase 2 (G2 Gate):
1. Migrate remaining business mutations
2. Deprecate direct mutation paths
3. Update tooling to enforce command boundary

### Phase 3+:
1. Remove deprecated mutation paths
2. Monitor for new mutation paths
3. Continuous enforcement

---

## 6. Exceptions

The following are approved exceptions to the command boundary:

| Exception | Justification | Review Date |
|-----------|---------------|-------------|
| Test fixtures | Testing only, never production | N/A |
| Seed scripts | One-time setup, not mutations | N/A |
| Emergency operator commands | Last resort, heavily audited | Quarterly |
| Legacy module migrations | Temporary, time-limited | Per migration |

---

## 7. Enforcement

### 7.1 ESLint Rules

```javascript
// No direct Prisma business mutations in non-adapter modules
{
  "rules": {
    "no-restricted-imports": {
      "paths": ["@prisma/client"],
      "patterns": ["**/commands/**", "**/domain/**", "**/services/**"]
    }
  }
}
```

### 7.2 Architecture Tests

```typescript
// Verify no business logic in controllers
test('controllers do not contain business logic', () => {
  // AST analysis of controller files
  // Fail if mutations found outside commands
});
```

---

## 8. Related Documents

- `harness-capability-inventory.yaml` - Command catalog will be part of EL-007
- `harness-control-matrix.yaml` - AUTHZ-001, AUTHZ-002 enforce authorization
- `harness-migration-map.md` - Migration paths for existing mutations

---

## 9. Review History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-08-02 | 1.0 | Initial draft | Architecture |

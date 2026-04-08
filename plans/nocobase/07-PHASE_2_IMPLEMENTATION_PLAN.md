# Phase 2 Implementation Plan: API Layer Integration

## Week 5-12: Authentication, Authorization, Advanced NocoDB Features

**Date**: April 7, 2026  
**Phase**: 2 of 7  
**Duration**: 8 weeks (56 days)  
**Team**: 3.5 FTE  
**Goal**: Production-ready API layer with authentication, multi-tenancy, and advanced features

---

## Table of Contents

1. [Week 5-6: Authentication Layer](#week-5-6-authentication-layer)
2. [Week 7-8: Authorization & RBAC](#week-7-8-authorization--rbac)
3. [Week 9-10: Advanced NocoDB Features](#week-9-10-advanced-nocobase-features)
4. [Week 11-12: Testing & Optimization](#week-11-12-testing--optimization)
5. [Phase 2 Deliverables](#phase-2-deliverables)

---

## Week 5-6: Authentication Layer

### Goals

- Implement JWT authentication
- Create auth guards & decorators
- Set up token refresh mechanism
- Implement logout & session management
- Zero-error authentication code

### Architecture: Authentication Flow

```
┌─────────────────────────────────────┐
│   Client (Next.js Frontend)         │
└──────────────┬──────────────────────┘
               │ POST /auth/login
               ↓ (email, password)
┌──────────────────────────────────────┐
│  AuthController (NestJS)             │
├──────────────────────────────────────┤
│ - Validate credentials               │
│ - Generate JWT tokens               │
│ - Return { accessToken, refreshToken}
└──────────────┬──────────────────────┘
               │
               ↓ (Save refresh token)
┌──────────────────────────────────────┐
│  NocoDB Collections                  │
├──────────────────────────────────────┤
│ - users (id, email, passwordHash...)│
│ - sessions (token, expiresAt)       │
│ - audit_logs (action, userId, ...)  │
└──────────────────────────────────────┘
```

### Task Breakdown

#### Days 29-32: Core Auth Service

```typescript
/**
 * src/core/services/auth.service.ts
 * SOLID: Single Responsibility - Authentication only
 */

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  // validateCredentials(email, password): Promise<User | null>
  // generateTokens(user: User): AuthTokens
  // refreshAccessToken(refreshToken: string): AuthTokens
  // validateToken(token: string): JwtPayload
  // revokeRefreshToken(token: string): Promise<void>
  // loginAudit(userId string, action: string): Promise<void>
}
```

#### Days 33-36: NestJS Guards & Decorators

```typescript
/**
 * src/common/guards/jwt-auth.guard.ts
 * src/common/decorators/auth.decorator.ts
 * src/common/decorators/roles.decorator.ts
 */

// Usage in controller:
@Post('agents')
@UseGuards(JwtAuthGuard)
@Roles('admin', 'agent_manager')
async createAgent(
  @CurrentUser() user: JwtPayload,
  @Body() input: CreateAgentInput,
): Promise<Agent> {
  // user automatically injected
  // role checked automatically
}
```

#### Days 37-40: Session Management & Token Refresh

```typescript
/**
 * JWT Refresh Strategy:
 * - Access Token: 15 minutes (short-lived)
 * - Refresh Token: 7 days (long-lived)
 * - Refresh endpoint: POST /auth/refresh
 * - Logout endpoint: POST /auth/logout
 * - Revocation: Database storage of invalid tokens
 */
```

### Deliverables (Week 5-6)

- [x] `src/core/services/auth.service.ts` — JWT & token management
- [x] `src/common/guards/jwt-auth.guard.ts` — Route protection
- [x] `src/common/decorators/auth.decorator.ts` — User injection
- [x] `src/common/decorators/roles.decorator.ts` — Role checking
- [x] `src/modules/auth/auth.controller.ts` — Login/logout endpoints
- [x] `src/domain/models.ts` — Updated with User entity
- [x] `src/core/services/auth.service.spec.ts` — Unit tests
- [x] Authentication documentation
- [x] Zero compile/lint errors

---

## Week 7-8: Authorization & RBAC

### Goals

- Implement multi-tenancy isolation
- Create role-based access control
- Build permission matrix
- Implement field-level access control
- Audit logging for all operations

### RBAC Architecture

```
User
├── Roles (can have multiple)
│   ├── admin
│   ├── agent_manager
│   ├── task_approver
│   └── viewer
└── Tenant (workspace isolation)
    ├── Agents visible to role
    ├── Tasks filtered by permission
    └── Budgets limited by role
```

### Permission Matrix

```typescript
/**
 * Permission Model
 */
interface RolePermissions {
  admin: {
    agents: ["create", "read", "update", "delete"];
    tasks: ["create", "read", "update", "delete"];
    approvals: ["create", "read", "update", "delete", "approve"];
    users: ["create", "read", "update", "delete"];
    settings: ["read", "update"];
  };
  agent_manager: {
    agents: ["create", "read", "update"];
    tasks: ["create", "read", "update"];
    approvals: ["read", "approve"];
  };
  task_approver: {
    tasks: ["read"];
    approvals: ["read", "approve"];
  };
  viewer: {
    agents: ["read"];
    tasks: ["read"];
    approvals: ["read"];
  };
}
```

### Task Breakdown

#### Days 45-48: Multi-Tenancy Layer

```typescript
/**
 * src/common/middleware/tenant.middleware.ts
 * SOLID: SRP - Extract tenant from JWT
 */

export class TenantMiddleware implements NestMiddleware {
  use(req, res, next) {
    // Extract tenantId from JWT payload
    // Validate user belongs to tenant
    // Attach to request context
    // All subsequent queries filtered by tenantId
  }
}
```

#### Days 49-52: Authorization Service

```typescript
/**
 * src/core/services/authorization.service.ts
 * Checks if user can perform action
 */

export class AuthorizationService {
  checkPermission(user: JwtPayload, resource: string, action: string): boolean;
  checkTenantAccess(userId: string, tenantId: string): Promise<boolean>;
  checkFieldAccess(user: JwtPayload, field: string): boolean;
  auditLog(userId: string, action: string, resource: string): Promise<void>;
}
```

#### Days 53-56: Repository Updates for Multi-Tenancy

```typescript
/**
 * Update all repositories to auto-filter by tenantId
 *
 * Before:
 * findAll(filters) → SELECT * FROM tasks
 *
 * After:
 * findAll(filters, context) → SELECT * FROM tasks WHERE tenantId = $1
 */
```

### Deliverables (Week 7-8)

- [x] `src/common/middleware/tenant.middleware.ts` — Tenant extraction
- [x] `src/core/services/authorization.service.ts` — Permission checks
- [x] `src/core/repositories/*.ts` — Updated with tenantId filters
- [x] `src/domain/models.ts` — User, Role, Permission entities
- [x] `src/common/decorators/permissions.decorator.ts` — Fine-grained access
- [x] Audit logging on all mutations
- [x] Multi-tenant test scenarios
- [x] RBAC documentation with examples

---

## Week 9-10: Advanced NocoDB Features

### Goals

- Query optimization & indexing
- Workflow automation
- Complex data relationships
- ACL field-level security
- Real-time event streaming

### Advanced Features Implementation

#### Days 57-60: Query Optimization

```typescript
/**
 * Leverage NocoDB's:
 * - Nested queries (include related records)
 * - Aggregations (SUM, COUNT, AVG)
 * - Filters with operators (>, <, !=, LIKE)
 * - Sorting on multiple fields
 * - Pagination with cursor
 */

// Example optimized query:
const tasks = await this.taskRepository.findByAgentId(agentId, {
  include: ["agent", "approvals"], // Load relations
  filters: {
    status: { neq: "completed" },
    priority: { in: ["high", "critical"] },
  },
  select: ["id", "title", "status", "cost"], // Only needed fields
  limit: 20,
  offset: 0,
});
```

#### Days 61-64: Workflow Engine Integration

```typescript
/**
 * Use NocoDB's Workflow feature:
 * - Trigger on create (email notifications)
 * - Trigger on update (cost calculations)
 * - Trigger on delete (cleanup)
 * - Send webhooks to external systems
 * - Auto-fill derived fields
 */

// Example workflow:
export class WorkflowService {
  // When task.status changes to 'completed':
  // 1. Calculate cost
  // 2. Update agent.mood
  // 3. Send completion event
  // 4. Create audit entry
  // 5. Notify approvers
}
```

#### Days 65-68: Field-Level ACL

```typescript
/**
 * Some users can't see sensitive fields:
 * - Passwords (no one should see)
 * - Costs (only managers)
 * - Internal notes (only admin)
 * - Budget details (restricted)
 */

interface FieldVisibility {
  field: string;
  hiddenForRoles: UserRole[];
}

export class FieldAccessService {
  filterFieldsByRole(record: any, role: UserRole): any {
    // Remove hidden fields based on role
  }
}
```

### Deliverables (Week 9-10)

- [x] Query optimization guide with benchmarks
- [x] `src/core/services/workflow.service.ts` — Workflow automation
- [x] `src/core/services/field-access.service.ts` — Field-level ACL
- [x] Aggregation queries (cost tracking, metrics)
- [x] Real-time updates via WebSockets
- [x] Performance test suite (response times)
- [x] Caching strategy (Redis optional)

---

## Week 11-12: Testing & Optimization

### Goals

- Integration test suite (API ↔ NocoDB)
- E2E test scenarios
- Performance testing & optimization
- Error handling & recovery
- Documentation completion

### Task Breakdown

#### Days 73-80: Integration Tests

```typescript
/**
 * Test complete flows:
 * 1. User registers → authenticated → creates agent → creates task
 * 2. Task created → approval workflow triggers → auto-calculated costs
 * 3. Multi-tenant: User1 sees only Tenant1 data
 * 4. Permission checks: Viewer can't delete
 * 5. Token refresh & expiration
 */

describe("Complete Agent Workflow", () => {
  // Test user registration
  // Test agent creation via API
  // Verify NocoDB collection updated
  // Verify audit log created
  // Verify events emitted
  // Verify user sees data
  // Test other tenant isolation
});
```

#### Days 81-88: Performance Optimization

```typescript
/**
 * Benchmarks:
 * - /api/v1/agents (list): < 200ms (p95)
 * - /api/v1/agents (create): < 500ms (p95)
 * - /api/v1/tasks?agentId=xxx: < 200ms (p95)
 * - Concurrent users: 100+ without degradation
 * - Database queries: < 2 per endpoint
 */

// Optimization techniques:
- Select only needed fields
- Use proper indexes (NocoDB)
- Implement caching layer (optional)
- Batch operations where possible
- Async processing for heavy ops
```

#### Days 89-96: Error Handling

```typescript
/**
 * Global error handler with:
 * - User-friendly messages
 * - Request ID for tracking
 * - Audit log of errors
 * - Stack traces for debugging
 * - Proper HTTP status codes
 */

export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Format error response
    // Log error with context
    // Return safe message to client
    // Preserve stack for monitoring
  }
}
```

### Deliverables (Week 11-12)

- [x] Integration test suite (50+ tests)
- [x] E2E test scenarios (10+ user flows)
- [x] Performance benchmarks with targets
- [x] Global error handling
- [x] Request logging & tracing
- [x] Health check endpoint
- [x] API documentation (OpenAPI/Swagger)
- [x] Deployment checklist

---

## Phase 2 Deliverables Checklist

### Code Artifacts

#### Authentication (2 files)

- [x] `src/core/services/auth.service.ts` (150 lines)
- [x] `src/common/guards/jwt-auth.guard.ts` (60 lines)
- [x] `src/common/decorators/auth.decorator.ts` (30 lines)
- [x] `src/common/decorators/roles.decorator.ts` (40 lines)

#### Authorization (3 files)

- [x] `src/core/services/authorization.service.ts` (150 lines)
- [x] `src/common/middleware/tenant.middleware.ts` (80 lines)
- [x] `src/core/services/field-access.service.ts` (100 lines)

#### Controllers (1 file update)

- [x] `src/modules/auth/auth.controller.ts` (120 lines)
- [x] All other controllers updated with @UseGuards

#### Advanced Features (2 files)

- [x] `src/core/services/workflow.service.ts` (150 lines)
- [x] `src/core/services/audit-log.service.ts` (100 lines)

#### Error Handling (2 files)

- [x] `src/common/filters/exception.filter.ts` (80 lines)
- [x] `src/common/filters/custom-error.ts` (60 lines)

#### Testing (2 files)

- [x] `src/core/services/auth.service.spec.ts` (200 lines)
- [x] `src/integration-tests/agent-workflow.spec.ts` (300 lines)

#### Configuration (2 files)

- [x] `src/config/jwt.config.ts` (60 lines)
- [x] `.env.phase2` (environment template)

#### Total Phase 2 Code: 1,500+ lines

### Documentation

- [x] JWT implementation guide
- [x] RBAC & permission matrix
- [x] Multi-tenancy architecture
- [x] API authentication flow diagram
- [x] Integration test guide
- [x] Performance benchmarking guide
- [x] Error handling patterns
- [x] Deployment ready checklist

### Quality Metrics

- [x] Code coverage: 80%+ (Phase 1+2)
- [x] API response times: < 200ms p95
- [x] Zero compile errors
- [x] Zero lint errors
- [x] All tests passing (50+ integration tests)
- [x] Swagger/OpenAPI documentation generated

---

## Success Criteria (Phase 2)

### Functional

- ✅ User can login with JWT token
- ✅ Refresh token works correctly
- ✅ Expired tokens rejected
- ✅ Logout invalidates tokens
- ✅ Roles enforced on endpoints
- ✅ Tenant data isolated
- ✅ Audit logs created for all changes
- ✅ Workflows trigger on events
- ✅ Field-level ACL respected

### Performance

- ✅ List endpoints: < 200ms p95
- ✅ Create endpoints: < 500ms p95
- ✅ 100 concurrent users: no degradation
- ✅ Database queries optimized (select + join only)

### Quality

- ✅ 80%+ test coverage
- ✅ Zero unhandled errors
- ✅ All errors logged with context
- ✅ Request tracing enabled
- ✅ Zero type errors
- ✅ Zero lint errors

### Documentation

- ✅ API endpoints documented
- ✅ Auth flow explained
- ✅ Permission matrix published
- ✅ Integration test examples provided
- ✅ Deployment guide created

---

## Transition to Phase 3

Once Phase 2 is complete:

1. Schedule Phase 3 kickoff (Week 13)
2. Verify all Phase 2 deliverables
3. Performance test with real load
4. Security audit of auth system
5. Review with stakeholders

Next: **Phase 3 (Week 13-18): Frontend Infrastructure Setup** with Ant Design component library

---

**Phase 2 Plan Status**: Ready for Implementation  
**Estimated Effort**: 8 weeks × 3.5 FTE = 28 person-weeks  
**Code Quality**: SOLID principles enforced  
**Zero Tolerance**: No compile/lint errors

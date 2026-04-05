# System Patterns — Architecture & Design Principles

## NeureCore Gold Rules (from .clinerules)

### Architecture & SOLID

- **NestJS 11:** Strictly follow Single Responsibility. **Services must be injected, never instantiated manually.**
- **No Shared Code:** Frontends (Portals) must mirror types from the Backend DTOs; do not attempt to import backend files into frontend directories.
- **Tenant Isolation:** Every Prisma query in `modules/` MUST include a `tenantId` filter. Cross-tenant access is a critical security failure.

### Infrastructure

- **Prisma & Postgres:** Always verify if a migration (`npx prisma migrate dev`) is needed before changing `schema.prisma`.
- **Redis:** Use `RedisService` for auth blacklisting and caching.
- **Docker:** Assume Postgres 16 and Redis 7 are running via `docker compose`.

### Memory Bank Protocol

- **Check First:** Before starting any task, read `memory-bank/activeContext.md`.
- **Update Last:** After completing a feature (e.g., a new Auth endpoint), sync `progress.md` and `activeContext.md`.

### Environment

- **Zorin OS / Linux:** Provide bash commands for terminal tasks.
- **Resource Management:** Optimize for a 12GB RAM environment—avoid suggesting memory-heavy local background processes.

---

## NestJS Build & SWC Watch Mode (discovered April 4, 2026)

`nest start --watch` (SWC mode) compiles to `dist/` (flat, no `src/` prefix).
`start:prod` / `node dist/src/main.js` uses the **production build path** `dist/src/`.

These are **different output directories** — watch mode does NOT feed `start:prod`.

**Reliable local dev startup pattern:**

```bash
# After code changes: rebuild production path
cd backend && pnpm run build     # compiles to dist/src/
node dist/src/main.js &          # or: node dist/main.js (SWC flat output)

# Check logs
tail -f /tmp/nodetest.log
```

**Rule**: If a new module is added and the running backend can't find it, kill the process, run `pnpm run build`, and restart with `node dist/src/main.js`.

---

## SOLID Principles Implementation

### Single Responsibility Principle (SRP)

**Rule**: Each class has one reason to change.

**CRITICAL RULE: Services must be injected, never instantiated manually.**

```typescript
// ❌ WRONG: Never instantiate services manually
class SomeController {
  async someMethod() {
    const userService = new UsersService(); // ❌ FORBIDDEN
    const tokenService = new TokenService(); // ❌ FORBIDDEN
  }
}

// ✅ CORRECT: Always inject via constructor
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService, // ✅ Injected
    private readonly tokenService: TokenService, // ✅ Injected
  ) {}
}
```

**Examples in NeureCore**:

- `AuthService`: Handles authentication logic only
- `TokenService`: Manages JWT token lifecycle
- `PasswordService`: Handles password hashing/comparison
- `PrismaService`: Database connection/pool management
- `RedisService`: Cache operations only

**Anti-pattern** (Don't do this):

```typescript
// ❌ WRONG: AuthService doing too much
class AuthService {
  register() { ... }        // Auth responsibility
  validateEmail() { ... }   // Email validation
  logEvent() { ... }        // Logging responsibility
  cacheToken() { ... }      // Cache responsibility
}

// ✅ CORRECT: Separated concerns
class AuthService {
  constructor(
    private tokenService: TokenService,
    private passwordService: PasswordService,
    private logger: LoggerService,
  ) {}

  async register(dto: RegisterDto) {
    // Only orchestrate, don't implement details
  }
}
```

### Open/Closed Principle (OCP)

**Rule**: Open for extension, closed for modification.

**Examples in NeureCore**:

- Role-based guards: Add new roles without modifying existing guards
- Auth strategies: Add new passport strategies (OAuth, SAML) without touching JWT strategy
- Module exports: Services exported via providers array, extendable

**Pattern**:

```typescript
// ✅ Extend with new roles via enum
enum UserRole {
  SUPER_ADMIN,      // Can add without changing existing code
  PLATFORM_ADMIN,
  OWNER,
  ADMIN,
  USER,             // New role here
}

// Guards automatically support it
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
async getDashboard() { ... }
```

### Liskov Substitution Principle (LSP)

**Rule**: Derived classes must be substitutable for base classes.

**Examples in NeureCore**:

- All Passport strategies implement Strategy interface
- All services follow consistent interface patterns
- Database service abstractions

**Pattern**:

```typescript
// ✅ Both can be used interchangeably
interface AuthStrategy {
  validate(payload: any): Promise<User>;
}

class JwtStrategy implements AuthStrategy { ... }
class LocalStrategy implements AuthStrategy { ... }
class OAuth2Strategy implements AuthStrategy { ... }

// In PassportModule: can switch strategies without knowing implementation
```

### Interface Segregation Principle (ISP)

**Rule**: Many client-specific interfaces beat one general-purpose interface.

**Examples in NeureCore**:

```typescript
// ❌ WRONG: Force all unrelated methods on one interface
interface UserService {
  create();
  update();
  delete();
  authenticate(); // Auth is separate concern!
  authorizeAction(); // Authorization is separate!
  logActivity(); // Logging is separate!
}

// ✅ CORRECT: Segregated interfaces
interface IUserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

interface IAuthService {
  authenticate(credentials): Promise<AuthResult>;
  authorizeAction(user: User, action: string): boolean;
}

interface ILogger {
  log(message: string, context?: string): void;
}
```

### Dependency Inversion Principle (DIP)

**Rule**: Depend on abstractions, not concrete implementations.

**NeureCore Pattern**:

```typescript
// ✅ CORRECT: Inject abstractions
@Injectable()
class AuthService {
  constructor(
    private readonly usersService: UsersService,       // Abstract service
    private readonly tokenService: TokenService,
    private readonly redisService: CacheService,       // Cache abstraction
  ) {}
}

// In module providers:
@Module({
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    {
      provide: 'CacheService',               // Token-based injection
      useClass: RedisService,                // Can swap implementation
    },
  ],
})
```

---

## Multi-Tenant Isolation Strategy

### Core Rule: tenantId on Every Query

**Principle**: Every database query must filter by `tenantId`. This is NOT a permission system; it's a data isolation boundary.

### Implementation Pattern

**1. Database Level** (schema enforces it):

```prisma
model User {
  id        String @id @default(uuid())
  tenantId  String
  email     String

  @@unique([tenantId, email])      // Unique per tenant
  @@index([tenantId])               // Fast tenant-scoped queries
}

model Tenant {
  id    String @id @default(uuid())
  name  String
  users User[]
}
```

**2. Service Layer** (every query includes tenantId):

```typescript
@Injectable()
class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(tenantId: string, userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id_tenantId: { id: userId, tenantId }, // ✅ Tenant filter
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId }, // ✅ Tenant filter
    });
  }

  async create(tenantId: string, dto: CreateUserDto) {
    return this.prisma.user.create({
      data: { ...dto, tenantId }, // ✅ Tenant association
    });
  }
}
```

**3. Request Context** (tenant extracted from JWT):

```typescript
@Injectable()
export class TenantIdDecorator {
  static getTenantId(request: Request): string {
    // Extract from JWT payload (set by JwtStrategy)
    return request.user.tenantId;
  }
}

@Controller("users")
export class UsersController {
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: Request) {
    const tenantId = req.user.tenantId; // ✅ From JWT
    return this.usersService.findAll(tenantId);
  }
}
```

### Enforcement Checklist

- [ ] Every `findMany`, `findUnique`, `update`, `delete` includes `tenantId` filter
- [ ] No queries without tenant context
- [ ] Database indexes on tenantId for performance
- [ ] Unique constraints include tenantId (e.g., `@@unique([tenantId, email])`)
- [ ] Tests verify isolation: User A cannot access User B's data

---

## Authentication & Authorization

### JWT + Redis Blacklist Pattern

**Why**: Stateless tokens (JWT) can't be revoked immediately. Redis blacklist allows instant revocation for logout, password reset, permission changes.

**Architecture**:

```
User Login
  ↓
[AuthService] signs JWT with payload { userId, tenantId, role }
  ↓
Token returned to client
  ↓
Client includes in Authorization: Bearer <token> header
  ↓
[JwtStrategy] validates signature against JWT_SECRET
  ↓
[Request] request.user = decoded payload
  ↓
[RolesGuard] checks request.user.role against @Roles(...)
  ↓
Handler executes with authenticated context
```

**Logout Flow**:

```
User Logout
  ↓
[AuthService] extracts token from header
  ↓
[RedisService] caches token in blacklist with expiry = token.exp
  ↓
[JwtStrategy] checks blacklist before accepting token
  ↓
Subsequent requests with old token rejected
  ↓
Token expires from Redis after TTL (matches token expiry)
```

### Token Structure

```typescript
// JWT Payload (HS256 signed)
{
  sub: string; // User ID (subject)
  tenantId: string; // Tenant association
  role: UserRole; // Authorization level
  email: string; // User email
  iat: number; // Issued at
  exp: number; // Expiration (15m for access, 7d for refresh)
}
```

### Role-Based Access Control (RBAC)

**Guard Implementation**:

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = Reflect.getMetadata(ROLES_KEY, context.getHandler());
    if (!requiredRoles) return true;  // No roles required = public

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}

// Usage
@Controller('tenants')
export class TenantsController {
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)  // ✅ Only SA/PA
  async list() { ... }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)  // ✅ Only Owner/Admin
  async getOne() { ... }
}
```

---

## No Shared Code Rule

### Principle

Backend and frontend are **completely independent**. No importing from backend into frontend.

### Why This Matters

1. **Technology Freedom**: Frontend can use React/Vue/Angular; backend doesn't dictate
2. **Independent Deployment**: Deploy frontend & backend on different schedules
3. **Scaling**: Each can scale independently
4. **Team Autonomy**: Frontend team doesn't depend on backend structure
5. **Monorepo Prevention**: Avoids monorepo complexity

### Correct Structure

```
❌ WRONG:
frontend/
├── src/
│   └── types.ts ← Importing from backend
└── import { User } from '../backend/src/types'

✅ CORRECT:
backend/                          frontend/
├── src/                          ├── src/
│   ├── types/ (internal)         │   ├── types/ (mirrored locally)
│   └── services/                 │   └── services/
└── API Contract                  └── Consumes API

// Frontend types.ts (independent copy)
export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: 'ADMIN' | 'USER' | ...;
}

// Generated from OpenAPI/API documentation, not shared code
```

### Type Mirroring Strategy

1. Backend exposes API types via OpenAPI/Swagger
2. Frontend generates or manually mirrors types from API docs
3. Use JSON Schema or OpenAPI code generators for consistency
4. Version API types in docs alongside backend release notes

---

## Module Structure Pattern

**Standard NestJS Module Layout**:

```
modules/auth/
├── auth.module.ts          # Module definition
├── controllers/
│   └── auth.controller.ts   # Route handlers
├── services/
│   ├── auth.service.ts      # Business logic
│   ├── token.service.ts
│   └── password.service.ts
├── strategies/
│   ├── jwt.strategy.ts      # Passport JWT
│   └── local.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── roles.guard.ts
├── dto/
│   ├── login.dto.ts
│   └── register.dto.ts
└── interfaces/
    └── jwt-payload.interface.ts
```

---

## Error Handling Pattern

```typescript
// ✅ Consistent error response
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.getResponse(),
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Testing Pattern

```typescript
// ✅ Module-level testing with dependency injection
describe("AuthService", () => {
  let service: AuthService;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    mockTokenService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should authenticate user", async () => {
    const result = await service.authenticate(loginDto);
    expect(result).toHaveProperty("accessToken");
  });
});
```

---

## TypeScript Coding Standards

### Type Safety Rules

**1. Never use `any` for Prisma queries**:

```typescript
// ❌ WRONG: Using any for Prisma where clause
const where: any = { id: userId };
if (tenantId) where.tenantId = tenantId;

// ✅ CORRECT: Use proper Prisma types
import { Prisma } from "@prisma/client";
const where: Prisma.UserWhereInput = { id: userId };
if (tenantId) where.tenantId = tenantId;
```

**2. Use proper types for update vs query operations**:

```typescript
// ❌ WRONG: Using UserWhereInput for update (needs unique input)
const where: Prisma.UserWhereInput = { id: userId };
return this.prisma.user.update({ where, data: dto });

// ✅ CORRECT: Use UserWhereUniqueInput for update/delete
const where: Prisma.UserWhereUniqueInput = { id: userId };
return this.prisma.user.update({ where, data: dto });
```

**3. Always type authenticated user properly**:

```typescript
// ❌ WRONG: Using any for current user
findAll(@CurrentUser() user: any) { ... }

// ✅ CORRECT: Use the proper type from auth interfaces
import { ValidatedUser } from '../auth/interfaces/auth.interface';
type AuthenticatedUser = ValidatedUser & { sub: string; jti: string };
findAll(@CurrentUser() user: AuthenticatedUser) { ... }
```

**4. Import CurrentUser from correct location**:

```typescript
// ❌ WRONG: Importing from roles.decorator
import { Roles, CurrentUser } from "../../common/decorators/roles.decorator";

// ✅ CORRECT: CurrentUser is in its own decorator file
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
```

### Prisma Type Imports

Always use types from `@prisma/client`:

```typescript
import { UserRole, Prisma } from "@prisma/client";

// Common types needed:
-Prisma.UserWhereInput - // For WHERE clauses in findMany/findFirst
  Prisma.UserWhereUniqueInput - // For WHERE clauses in findUnique/update/delete
  Prisma.UserCreateInput - // For create operations
  Prisma.UserUpdateInput; // For update operations
```

### ESLint Compliance Checklist

Before committing code:

- [ ] No `any` types in Prisma queries
- [ ] No unsafe member access on `any` values
- [ ] All decorators properly imported from correct files
- [ ] Controller methods use proper types for `@CurrentUser()`
- [ ] Check Problems tab in VSCode for errors

---

## Admin ↔ Tenant Isolation Pattern

### Connection Model

```
Admin Frontend (port 3002)       Tenant Frontend (port 3001)
        │                                 │
   localStorage                     tokenManager
   admin_accessToken               hq_accessToken
        │                                 │
        └──────────► NestJS Backend ◄─────┘
                        (port 3000)
                    brain.neurecore.com/api/v1
                            │
                    Role-based guards
                 SUPER_ADMIN vs TENANT roles
```

### Key Design Points

- **No cross-frontend calls** — all control flows through shared backend
- **Admin creates resources tenants consume**: Tier caps limit `maxAgents`/`maxUsers`; Platform agent templates are the only source for wizard AGENTS step
- **Admin can deploy directly**: `/deploy/tenants/{id}/dept-template` and `/deploy/tenants/{id}/agents` bypass tenant wizard
- **Tenant isolation**: Every backend query in tenant context includes `tenantId` filter
- **Role enforcement**: `@Roles(UserRole.SUPER_ADMIN)` guard on all admin endpoints; tenants cannot call admin routes

### Admin→Tenant Control Surface

| Admin Action                   | Backend Endpoint                          | Tenant Effect                             |
| ------------------------------ | ----------------------------------------- | ----------------------------------------- |
| Create/edit Tier               | `POST/PATCH /tiers`                       | Caps maxAgents, maxUsers, features        |
| Toggle Tier active             | `PATCH /tiers/{id}/toggle`                | Tenant can/cannot subscribe               |
| Create Platform Agent Template | `POST /agent-templates/platform`          | Appears in wizard AGENTS step             |
| Deploy Dept Template           | `POST /deploy/tenants/{id}/dept-template` | Creates Department in tenant DB           |
| Deploy Agents directly         | `POST /deploy/tenants/{id}/agents`        | Creates agents in tenant, bypasses wizard |
| Update Platform Settings       | `PATCH /platform/security` etc.           | Global policy applied system-wide         |

---

## Onboarding Wizard Session Pattern

### Session Lifecycle

1. `POST /onboarding/start-authenticated` (JWT required) → creates Redis key `wizard:{wizardId}`, returns `wizardId`
2. All 9 step endpoints accept `wizardId` in body, are `@Public()` (no JWT needed)
3. `POST /onboarding/complete` → deploys all state from Redis to DB, clears session
4. After completion: `GET /onboarding/progress` returns 401 (session gone — correct)

### Security Model

- `wizardId` is a UUID — acts as bearer token for the wizard session
- Redis TTL: 24 hours
- No JWT on steps → prevents auth chicken-and-egg (tenant not yet created)
- Only start-authenticated requires JWT to establish which user owns the wizard

### Idempotency

- `completeWizard` deploys everything from wizard state — even if individual step API calls failed during wizard
- Agent/invitation/integration creation is safe to re-run (upsert patterns)

### DTO Optional Fields

- `InvitationInputDto.departmentId`: `@IsOptional()` — service assigns dept after tenant is created
- `AgentConfigInputDto.departmentId`: `@IsOptional()` — same reason

---

## Onboarding Wizard Correct HTTP Methods

| Step            | Method | Endpoint                          | response                  |
| --------------- | ------ | --------------------------------- | ------------------------- |
| Start           | POST   | `/onboarding/start-authenticated` | 201                       |
| Organization    | PUT    | `/onboarding/organization`        | 200                       |
| Admin           | PUT    | `/onboarding/admin`               | 200                       |
| Get Plans       | GET    | `/onboarding/plans`               | 200                       |
| Select Plan     | PUT    | `/onboarding/plan`                | 200                       |
| Add Department  | POST   | `/onboarding/departments`         | 201                       |
| Add Invitation  | POST   | `/onboarding/invitations`         | 201                       |
| Add Integration | POST   | `/onboarding/integrations`        | 201 (one per integration) |
| Get Templates   | GET    | `/onboarding/agent-templates`     | 200                       |
| Add Agent       | POST   | `/onboarding/agents`              | 201                       |
| Security        | PUT    | `/onboarding/security`            | 200                       |
| Complete        | POST   | `/onboarding/complete`            | 200                       |

---

## Wizard State — Store Type Strings, Not Record IDs

When the wizard accumulates items across steps (e.g. integration types), store the **type/enum string** in wizard state, not the database record ID. `completeWizard` uses wizard state values as lookup keys for idempotency checks — if IDs are stored instead, the idempotency check (`findFirst({ provider: id })`) will never match and duplicates will be created.

```ts
// ❌ Wrong — stores the created record's UUID
integrations.push(integration.id);

// ✅ Correct — stores the type string completeWizard expects
integrations.push(dto.type); // e.g. 'CRM_SALESFORCE'
```

## Post-Wizard JWT Note

The initial registration JWT has `role: USER, tenantId: null`. After `completeWizard`, the user is updated to `role: ADMIN, tenantId: <id>`. The old token is still valid but lacks the correct claims — the user must re-login (or the app must refresh the token) before calling any tenant-scoped endpoint.

# Phase 0 — CI/CD and Enforcement Gap Assessment

**Date:** 2026-07-26
**Document:** NC-AWL-IMP-1 Phase 0

---

## 1. Current CI/CD State

### 1.1 Existing Test Infrastructure

**Test Scripts (from package.json):**
```json
{
  "test": "jest --config jest.config.js",
  "test:watch": "jest --config jest.config.js --watch",
  "test:cov": "jest --config jest.js --coverage",
  "test:e2e": "jest --config test/jest-e2e.json"
}
```

### 1.2 GitHub Workflows

**Status:** No `.github/workflows/` found
- No CI pipeline configured
- No architectural enforcement in CI
- No dependency rule checks

### 1.3 ESLint Configuration

**Status:** Unknown
- Basic ESLint likely configured
- No architecture-specific rules observed
- No `no-restricted-imports` for Prisma

---

## 2. Identified Gaps

### 2.1 Architectural Enforcement Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| No ESLint `no-restricted-imports` for Prisma | CRITICAL | Tools can import Prisma directly |
| No Dependency Cruiser / architecture tests in CI | HIGH | Import violations undetected |
| No CI gate on architecture tests | HIGH | violations merged to main |
| No banned pattern detection for direct mutations | CRITICAL | Tools bypass command pattern |

### 2.2 Testing Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| No architecture tests in CI | HIGH | violations undetected |
| No integration test suite | HIGH | cannot verify end-to-end |
| No test tenant infrastructure | HIGH | cannot run deterministic tests |
| No evidence capture framework | MEDIUM | certification incomplete |

### 2.3 Deployment Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| No feature flag audit trail | MEDIUM | flag changes untracked |
| No multi-instance cache invalidation | MEDIUM | flag staleness |
| No emergency kill-switch verification | MEDIUM | kill-switch untested |

---

## 3. Required Enforcement Mechanisms

### 3.1 ESLint Rules (Phase 1)

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Prevent Prisma imports outside approved directories
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@prisma/client'],
            message: 'Prisma imports are restricted. Use repository interfaces instead.',
            caseSensitive: true,
          }
        ]
      }
    ],
  }
};
```

**Approved Prisma Import Locations:**
```typescript
// Only these patterns are allowed:
/repositories\//           // Repository implementations
/infrastructure\//        // Infrastructure layer
/interfaces\//repositories // Repository interfaces
/testing\//              // Test fixtures
/seeds?\//               // Database seeds
```

### 3.2 Dependency Rules (Phase 1)

```typescript
// src/common/enterprise/architecture-rules.ts
export const ARCHITECTURE_RULES = {
  layers: ['domain', 'application', 'adapters', 'composition'],

  allowedDependencyPaths: [
    ['application', 'domain'],
    ['adapters', 'application'],
    ['adapters', 'domain'],
    ['composition', 'adapters'],
    ['composition', 'application'],
    ['composition', 'domain'],
    // Tools are adapters - can depend on application/domain
    ['tools', 'domain'],      // Tools may use domain
    ['tools', 'application'], // Tools may use application
  ],

  forbiddenDependencyPaths: [
    ['domain', 'application'],
    ['domain', 'adapters'],
    ['domain', 'tools'],
    ['application', 'adapters'],
    ['tools', 'infrastructure'],  // Tools cannot bypass to infra
    ['hermes', 'tools'],         // Hermes cannot import concrete tools
  ],
};
```

### 3.3 Architecture Test Example

```typescript
// src/modules/enterprise-events/architecture.spec.ts (EXISTING)
it('Hermes does not import the concrete EnterpriseEventTransport', () => {
  const src = readFileSync('./src/modules/hermes/services/tool-gateway.service.ts', 'utf8');
  expect(src).not.toMatch(/new EnterpriseEventTransport\(/);
  expect(src).not.toMatch(/from.*enterprise-events.*transport/);
});
```

### 3.4 Tool Bypass Detection (Phase 1)

```typescript
// src/test/architecture/tool-bypass.spec.ts
it('tools module must not contain direct Prisma mutations', () => {
  const toolsDir = './src/modules/tools/built-in/';
  const files = glob.sync(`${toolsDir}**/*.ts`);

  for (const file of files) {
    const content = readFileSync(file, 'utf8');

    // Check for direct Prisma calls
    const prismaMutationMatch = content.match(/prisma\.(create|update|delete)/g);

    if (prismaMutationMatch) {
      // Filter out findUnique, findFirst, etc.
      const actualMutations = prismaMutationMatch.filter(m =>
        !m.includes('findUnique') &&
        !m.includes('findFirst') &&
        !m.includes('findMany') &&
        !m.includes('count') &&
        !m.includes('aggregate') &&
        !m.includes('groupBy')
      );

      expect(actualMutations).toHaveLength(0);
    }
  }
});
```

---

## 4. CI Pipeline Requirements

### 4.1 Phase 1 CI Gates

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run ESLint
        run: npm run lint

      - name: Run Architecture Tests
        run: npm run test:architecture

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Unit Tests
        run: npm run test -- --coverage

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v3
      - name: Run Integration Tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
```

### 4.2 Required NPM Scripts

```json
{
  "lint": "eslint src --ext .ts",
  "test:architecture": "jest --testPathPattern=architecture",
  "test:integration": "jest --config=jest-integration.config.js",
  "test:certification": "jest --testPathPattern=certification",
  "depcheck": "dependency-cruiser src --config .dependency-cruiser.json"
}
```

---

## 5. Enforcement Summary

### 5.1 Current State

| Enforcement | Status |
|-------------|--------|
| ESLint with restricted imports | ❌ NOT IMPLEMENTED |
| Dependency Cruiser | ❌ NOT IMPLEMENTED |
| Architecture tests in CI | ❌ NOT IMPLEMENTED |
| Tool bypass detection | ❌ NOT IMPLEMENTED |
| Feature flag audit trail | ❌ NOT IMPLEMENTED |
| Test tenant provisioning | ❌ NOT IMPLEMENTED |

### 5.2 Phase 1 Requirements

| Enforcement | Deliverable |
|-------------|-------------|
| ESLint rules | `no-restricted-imports` for Prisma |
| Architecture rules file | `src/common/enterprise/architecture-rules.ts` |
| Tool bypass test | `src/test/architecture/tool-bypass.spec.ts` |
| Dependency test | `src/test/architecture/dependency-rules.spec.ts` |
| CI gate | GitHub Actions workflow with architecture tests |

### 5.3 Phase 2+ Requirements

| Enforcement | Phase |
|-------------|-------|
| Integration test suite | Phase 2 |
| Certification test suite | Phase 3 |
| Feature flag audit trail | Phase 4 |
| Evidence capture CI | Phase 9 |

---

**End of CI/CD Gap Assessment**

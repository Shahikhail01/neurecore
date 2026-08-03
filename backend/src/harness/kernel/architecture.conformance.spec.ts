/**
 * Harness Architecture Boundary Tests
 * Phase 1: Verifies §5.1 SOLID rules and module separation
 *
 * Per §5.1:
 *   - Runner, evaluator, evidence writer, gate engine, adapters, and UI are separate components
 *   - Orchestration depends on ports; Prisma, Playwright, Redis, queues, LLM SDKs, and storage are adapters
 *   - Import-boundary lint/architecture tests
 *
 * Per §6.2:
 *   - harness-contracts: schemas and narrow ports only; no framework dependencies
 *   - harness-catalog: versioned capabilities, scenarios, suites, ownership, tags, and dependencies
 *   - harness-orchestrator: lifecycle, cancellation, timeout, retry, concurrency, and cleanup
 *   - harness-evidence: append-only event and artifact metadata; content-addressed checksums
 *   - harness-policy: risk classification, required suites, thresholds, waivers, expiry
 *   - harness-certification: independent verdicts, scope, provenance, expiry, revocation
 *   - harness-adapters: Jest, Playwright, provider, Prisma verification, queue, storage, telemetry, and load tools
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const HARNESS_ROOT = path.join(__dirname, '..');

function readModuleFile(modulePath: string): string {
  const fullPath = path.join(HARNESS_ROOT, modulePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
}

function getAllModuleFiles(): string[] {
  const modules = ['contracts', 'catalog', 'orchestrator', 'evidence', 'adapters', 'kernel'];
  const files: string[] = [];
  for (const m of modules) {
    const indexPath = path.join(HARNESS_ROOT, m, 'index.ts');
    if (fs.existsSync(indexPath)) {
      files.push(path.join(m, 'index.ts'));
    }
  }
  return files;
}

describe('Harness Architecture Boundaries (§5.1 SOLID)', () => {
  describe('harness-contracts: no framework dependencies', () => {
    it('contracts module does not import framework adapters', () => {
      const content = readModuleFile('contracts/index.ts');
      expect(content).not.toMatch(/from\s+['"]@nestjs\//);
      expect(content).not.toMatch(/from\s+['"]express/);
      expect(content).not.toMatch(/from\s+['"]react/);
      expect(content).not.toMatch(/from\s+['"]@playwright/);
      expect(content).not.toMatch(/from\s+['"]prisma/);
      expect(content).not.toMatch(/from\s+['"]ioredis/);
    });

    it('contracts module only depends on zod', () => {
      const content = readModuleFile('contracts/index.ts');
      const externalImports = content.match(/from\s+['"]([^./@][^'"]+)['"]/g) ?? [];
      const allowedDeps = ['zod'];
      for (const imp of externalImports) {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (match) {
          expect(allowedDeps.some((d) => match[1] === d || match[1].startsWith(d + '/'))).toBe(true);
        }
      }
    });
  });

  describe('harness-catalog: versioned capabilities, scenarios, suites', () => {
    it('catalog exports capability registry', () => {
      const content = readModuleFile('catalog/index.ts');
      expect(content).toMatch(/CapabilityRecordSchema/);
      expect(content).toMatch(/ScenarioRecordSchema/);
      expect(content).toMatch(/SuiteRecordSchema/);
    });

    it('catalog has CATALOG_VERSION constant', () => {
      const content = readModuleFile('catalog/index.ts');
      expect(content).toMatch(/CATALOG_VERSION/);
    });
  });

  describe('harness-orchestrator: lifecycle, cancellation, timeout, retry, cleanup', () => {
    it('orchestrator implements full lifecycle state machine', () => {
      const content = readModuleFile('orchestrator/index.ts');
      expect(content).toMatch(/createRun/);
      expect(content).toMatch(/transitionTo/);
      expect(content).toMatch(/requestCancellation/);
      expect(content).toMatch(/startTimeout/);
      expect(content).toMatch(/scheduleRetry/);
      expect(content).toMatch(/finalizeCleanup/);
    });

    it('orchestrator does not import catalog directly', () => {
      const content = readModuleFile('orchestrator/index.ts');
      expect(content).not.toMatch(/from\s+['"]\.\.\/catalog/);
    });
  });

  describe('harness-evidence: append-only, content-addressed', () => {
    it('evidence module implements append-only evidence store', () => {
      const content = readModuleFile('evidence/index.ts');
      expect(content).toMatch(/append/);
      expect(content).toMatch(/computeSha256/);
      expect(content).toMatch(/EvidenceEnvelopeSchema/);
    });

    it('evidence module has redaction capability', () => {
      const content = readModuleFile('evidence/index.ts');
      expect(content).toMatch(/redactObject/);
      expect(content).toMatch(/DEFAULT_REDACTION_RULES/);
    });
  });

  describe('harness-adapters: Jest, Playwright, provider, storage', () => {
    it('adapters module defines ITestAdapter interface', () => {
      const content = readModuleFile('adapters/index.ts');
      expect(content).toMatch(/ITestAdapter/);
      expect(content).toMatch(/JestTestAdapter/);
      expect(content).toMatch(/PlaywrightTestAdapter/);
      expect(content).toMatch(/CertificationTestAdapter/);
      expect(content).toMatch(/SimulationTestAdapter/);
    });

    it('adapters module has AdapterRegistry', () => {
      const content = readModuleFile('adapters/index.ts');
      expect(content).toMatch(/AdapterRegistry/);
      expect(content).toMatch(/createAdapter/);
    });
  });

  describe('harness-kernel: orchestrates catalog, orchestrator, evidence, adapters', () => {
    it('kernel imports all four sub-modules', () => {
      const content = readModuleFile('kernel/index.ts');
      expect(content).toMatch(/from\s+['"]\.\.\/contracts/);
      expect(content).toMatch(/from\s+['"]\.\.\/orchestrator/);
      expect(content).toMatch(/from\s+['"]\.\.\/evidence/);
      expect(content).toMatch(/from\s+['"]\.\.\/adapters/);
      expect(content).toMatch(/from\s+['"]\.\.\/catalog/);
    });

    it('kernel exposes executeScenario API', () => {
      const content = readModuleFile('kernel/index.ts');
      expect(content).toMatch(/executeScenario/);
      expect(content).toMatch(/HarnessKernel/);
    });

    it('kernel has crash recovery and idempotency methods', () => {
      const content = readModuleFile('kernel/index.ts');
      expect(content).toMatch(/recoverFromCrash/);
      expect(content).toMatch(/cleanupCrashedRuns/);
      expect(content).toMatch(/isIdempotent/);
      expect(content).toMatch(/getRunIdForIdempotencyKey/);
    });
  });

  describe('Module Separation (§5.1 Single Responsibility)', () => {
    it('each harness module is a separate directory', () => {
      const dirs = ['contracts', 'catalog', 'orchestrator', 'evidence', 'adapters', 'kernel'];
      for (const dir of dirs) {
        const indexPath = path.join(HARNESS_ROOT, dir, 'index.ts');
        expect(fs.existsSync(indexPath)).toBe(true);
      }
    });

    it('contracts has no knowledge of adapters', () => {
      const content = readModuleFile('contracts/index.ts');
      expect(content).not.toMatch(/from\s+['"]\.\.\/adapters/);
    });

    it('catalog has no knowledge of adapters', () => {
      const content = readModuleFile('catalog/index.ts');
      expect(content).not.toMatch(/from\s+['"]\.\.\/adapters/);
    });

    it('evidence has no knowledge of adapters', () => {
      const content = readModuleFile('evidence/index.ts');
      expect(content).not.toMatch(/from\s+['"]\.\.\/adapters/);
    });
  });

  describe('Open/Closed Principle (§5.1)', () => {
    it('adapter conformance kit is registered via factory', () => {
      const content = readModuleFile('adapters/index.ts');
      expect(content).toMatch(/createAdapter/);
      expect(content).toMatch(/AdapterType\.(JEST|PLAYWRIGHT|CERTIFICATION|SIMULATION)/);
    });

    it('adapter registry allows registration without modifying core', () => {
      const content = readModuleFile('adapters/index.ts');
      expect(content).toMatch(/class AdapterRegistry/);
      expect(content).toMatch(/register\(name/);
    });
  });

  describe('Dependency Inversion (§5.1)', () => {
    it('orchestrator depends on contracts (not adapters directly)', () => {
      const content = readModuleFile('orchestrator/index.ts');
      expect(content).toMatch(/from\s+['"]\.\.\/contracts/);
      expect(content).not.toMatch(/from\s+['"]\.\.\/adapters/);
    });

    it('kernel orchestrates via ports (interfaces)', () => {
      const content = readModuleFile('kernel/index.ts');
      expect(content).toMatch(/ITestAdapter/);
      expect(content).toMatch(/InMemoryCatalog/);
      expect(content).toMatch(/HarnessOrchestrator/);
      expect(content).toMatch(/EvidenceStore/);
    });
  });

  describe('Versioning (§6.3 + ADR-001)', () => {
    it('contracts module declares version', () => {
      const content = readModuleFile('contracts/index.ts');
      expect(content).toMatch(/CONTRACTS_VERSION/);
    });

    it('catalog module declares version', () => {
      const content = readModuleFile('catalog/index.ts');
      expect(content).toMatch(/CATALOG_VERSION/);
    });

    it('kernel module declares version', () => {
      const content = readModuleFile('kernel/index.ts');
      expect(content).toMatch(/version:/);
      expect(content).toMatch(/DEFAULT_KERNEL_CONFIG/);
    });
  });
});
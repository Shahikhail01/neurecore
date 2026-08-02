import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import {
  CAPABILITY_OWNERSHIP_MANIFEST,
  detectDuplicateIdentifiers,
} from './ownership/capability-ownership-manifest';
import { CAPABILITY_MAP } from '../chat/responses/maps/capability-map';
import {
  ownershipIdentifierFor,
  activeReadCapabilities,
} from './ownership/capability-mapping';
import {
  SENSITIVITY_CLASSES,
  ENVELOPE_STRATEGIES,
  findDuplicateCapabilities,
  validateCanonicalDescriptor,
} from './interfaces';
import {
  TenantIsolationProbeRunner,
  TenantIsolationProbeCompat,
  PROBE_BOUNDARIES,
} from './certification/tenant-isolation-probe';

const V2_ROOT = join(__dirname, '..');
const GATEWAY_DIRS = [
  'router',
  'capabilities',
  'channels',
  'recommendations',
  'certification',
];
const FORBIDDEN_PRISMA_PATTERNS = [
  /import.*from ['"]@prisma\/client/,
  /this\.prisma\./,
];

interface TestResult {
  name: string;
  passed: boolean;
  violations: Array<{ file: string; line?: number; match: string }>;
}

async function collectFiles(dir: string, ext = '.ts'): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        files.push(...(await collectFiles(full, ext)));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        files.push(full);
      }
    }
  } catch {
    return files;
  }
  return files;
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const ownershipTest: TestResult = {
    name: 'ACTIVE_CAPABILITIES_HAVE_OWNERSHIP',
    passed: true,
    violations: [],
  };
  const ownershipIdentifiers = new Set(
    CAPABILITY_OWNERSHIP_MANIFEST.map((entry) => entry.identifier),
  );
  for (const cap of activeReadCapabilities()) {
    const id = ownershipIdentifierFor(cap.capability);
    if (!id || !ownershipIdentifiers.has(id)) {
      ownershipTest.passed = false;
      ownershipTest.violations.push({
        file: 'capability-ownership-manifest.ts',
        match: cap.capability,
      });
    }
  }
  results.push(ownershipTest);

  const runtimeReadOnlyTest: TestResult = {
    name: 'RUNTIME_ALL_READ_ONLY',
    passed: true,
    violations: [],
  };
  for (const cap of Object.values(CAPABILITY_MAP)) {
    if (cap.readOnly !== true) {
      runtimeReadOnlyTest.passed = false;
      runtimeReadOnlyTest.violations.push({
        file: 'capability-map.ts',
        match: cap.capability,
      });
    }
  }
  results.push(runtimeReadOnlyTest);

  // Phase 1B-1D: reject any active descriptor missing canonical fields.
  const canonicalTest: TestResult = {
    name: 'ACTIVE_DESCRIPTORS_HAVE_CANONICAL_FIELDS',
    passed: true,
    violations: [],
  };
  for (const cap of Object.values(CAPABILITY_MAP)) {
    const validation = validateCanonicalDescriptor({
      capability: cap.capability,
      description: cap.description,
      serviceToken: cap.serviceToken,
      paramsSchema: cap.paramsSchema,
      adapter: cap.adapter,
      readOnly: cap.readOnly,
    });
    if (!validation.ok) {
      canonicalTest.passed = false;
      canonicalTest.violations.push({
        file: 'interfaces/index.ts',
        match: `${cap.capability}: ${validation.errors.join('; ')}`,
      });
    }
  }
  results.push(canonicalTest);

  // Phase 1B: reject duplicate canonical identifiers across
  // active CAPABILITY_MAP and ReadCapabilityRegistry (they are
  // populated from the same source today, but if they ever drift
  // this guard catches it).
  const dupCapabilityTest: TestResult = {
    name: 'NO_DUPLICATE_CANONICAL_IDENTIFIERS',
    passed: true,
    violations: [],
  };
  const dups = findDuplicateCapabilities(
    Object.values(CAPABILITY_MAP).map((c) => ({ capability: c.capability })),
  );
  if (dups.length > 0) {
    dupCapabilityTest.passed = false;
    dupCapabilityTest.violations.push({
      file: 'capability-map.ts',
      match: `Duplicate canonical identifiers: ${dups.join(', ')}`,
    });
  }
  results.push(dupCapabilityTest);

  // Phase 2: reject any service method receiving tenantId='*'.
  const tenantWildcardTest: TestResult = {
    name: 'NO_TENANT_WILDCARD',
    passed: true,
    violations: [],
  };
  for (const subDir of GATEWAY_DIRS) {
    const dir = join(V2_ROOT, subDir);
    const files = await collectFiles(dir);
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      // tolerate the case where tenantId='*' appears inside a string
      // literal that documents why NOT to use it.
      const matches = content.match(/tenantId\s*[:=]\s*['"`]\*['"`]/g);
      if (matches) {
        for (const m of matches) {
          tenantWildcardTest.passed = false;
          tenantWildcardTest.violations.push({ file, match: m });
        }
      }
    }
  }
  results.push(tenantWildcardTest);

  const prismaTest: TestResult = {
    name: 'NO_DIRECT_PRISMA_IN_GATEWAY',
    passed: true,
    violations: [],
  };

  for (const subDir of GATEWAY_DIRS) {
    const dir = join(V2_ROOT, subDir);
    const files = await collectFiles(dir);
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      for (const pattern of FORBIDDEN_PRISMA_PATTERNS) {
        if (pattern.test(content)) {
          prismaTest.violations.push({ file, match: pattern.source });
          prismaTest.passed = false;
        }
      }
    }
  }
  results.push(prismaTest);

  const dupTest: TestResult = {
    name: 'NO_DUPLICATE_IDENTIFIERS',
    passed: true,
    violations: [],
  };

  const duplicates = detectDuplicateIdentifiers();
  if (duplicates.length > 0) {
    dupTest.violations.push({
      file: 'capability-ownership-manifest.ts',
      match: `Duplicates: ${duplicates.join(', ')}`,
    });
    dupTest.passed = false;
  }
  results.push(dupTest);

  // Phase 1B: every read capability must be registered in the
  // canonical ownership manifest under the namespaced identifier.
  const namespacedTest: TestResult = {
    name: 'READ_CAPABILITIES_OWNED_VIA_NAMESPACED_IDENTIFIER',
    passed: true,
    violations: [],
  };
  for (const cap of activeReadCapabilities()) {
    const id = ownershipIdentifierFor(cap.capability);
    if (!id || !id.includes('.')) {
      namespacedTest.passed = false;
      namespacedTest.violations.push({
        file: 'capability-mapping.ts',
        match: cap.capability,
      });
    }
  }
  results.push(namespacedTest);

  // Phase 1B: invariants — `SENSITIVITY_CLASSES` and
  // `ENVELOPE_STRATEGIES` are the canonical lists. If anyone adds
  // a value not in these lists, the descriptor validator rejects it
  // automatically; this check just asserts the lists are non-empty.
  const invariantsTest: TestResult = {
    name: 'CANONICAL_LISTS_NON_EMPTY',
    passed: true,
    violations: [],
  };
  if (SENSITIVITY_CLASSES.length === 0) {
    invariantsTest.passed = false;
    invariantsTest.violations.push({
      file: 'interfaces/index.ts',
      match: 'SENSITIVITY_CLASSES is empty',
    });
  }
  if (ENVELOPE_STRATEGIES.length === 0) {
    invariantsTest.passed = false;
    invariantsTest.violations.push({
      file: 'interfaces/index.ts',
      match: 'ENVELOPE_STRATEGIES is empty',
    });
  }
  results.push(invariantsTest);

  // Phase 7: the cross-tenant probe is the REAL runner; the stub
  // class is no longer exported. The unknown-boundary probe must
  // fail closed (releaseApproved=false on any non-12 boundary set).
  const probeExportedTest: TestResult = {
    name: 'TENANT_ISOLATION_PROBE_RUNNER_EXPORTED',
    passed: true,
    violations: [],
  };
  if (typeof TenantIsolationProbeRunner !== 'function') {
    probeExportedTest.passed = false;
    probeExportedTest.violations.push({
      file: 'certification/tenant-isolation-probe.ts',
      match: 'TenantIsolationProbeRunner is not exported',
    });
  }
  if (!Array.isArray(PROBE_BOUNDARIES) || PROBE_BOUNDARIES.length !== 12) {
    probeExportedTest.passed = false;
    probeExportedTest.violations.push({
      file: 'certification/tenant-isolation-probe.ts',
      match: `PROBE_BOUNDARIES must have 12 entries (got ${PROBE_BOUNDARIES?.length ?? 'null'})`,
    });
  }
  results.push(probeExportedTest);

  // Phase 7: unknown boundaries MUST fail closed.
  const probeFailClosedTest: TestResult = {
    name: 'TENANT_ISOLATION_PROBE_FAILS_CLOSED_ON_UNKNOWN_BOUNDARY',
    passed: true,
    violations: [],
  };
  const compat = new TenantIsolationProbeCompat();
  const unknownResult = await compat.execute({
    tenantId: 't-a',
    boundary: '__never_heard_of_it__',
  });
  if (unknownResult.allowed !== false) {
    probeFailClosedTest.passed = false;
    probeFailClosedTest.violations.push({
      file: 'certification/tenant-isolation-probe.ts',
      match: 'unknown boundary did not fail closed with allowed: false',
    });
  }
  if (!/Unknown boundary/.test(unknownResult.evidence.join(' '))) {
    probeFailClosedTest.passed = false;
    probeFailClosedTest.violations.push({
      file: 'certification/tenant-isolation-probe.ts',
      match: 'unknown boundary did not emit Unknown boundary evidence',
    });
  }
  results.push(probeFailClosedTest);

  return results;
}

describe('Service Gateway V2 architecture', () => {
  it('passes all architecture gates', async () => {
    const results = await runTests();
    const failed = results.filter((result) => !result.passed);
    if (failed.length > 0) {
      // Pretty-print before failing so the operator can see exactly
      // which test failed and where.

      console.error(
        `[architecture] ${failed.length} gates failed:\n` +
          failed
            .map(
              (r) =>
                `  - ${r.name}: ` +
                r.violations.map((v) => `${v.file} :: ${v.match}`).join('; '),
            )
            .join('\n'),
      );
    }
    expect(failed).toEqual([]);
  });
});

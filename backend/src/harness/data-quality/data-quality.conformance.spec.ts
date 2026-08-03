/**
 * Phase 3 — Data Quality Module Conformance
 *
 * Validates:
 *   - Schema validation (NOT_NULL, TYPE_MISMATCH)
 *   - Referential integrity (target contract + target field)
 *   - Semantic invariants (basic DSL)
 *   - Drift detection (volume, freshness, value)
 *   - Lineage impact mapping
 *   - DataQualityGate composes validation + drift + lineage
 */

import {
  InMemoryDataContractStore,
  SchemaReferentialValidator,
  SchemaDriftDetector,
  LineageBuilder,
  DataQualityGate,
  DataContractSchema,
  DataContractVersionSchema,
  DriftThresholdsSchema,
  requireAuth,
  type DataContract,
} from './index';
import { Sha256ChecksumSchema } from '../contracts';

const baseContract = (overrides: Partial<DataContract> = {}): DataContract =>
  DataContractSchema.parse({
    contractId: 'customer',
    name: 'Customer Contract',
    kind: 'SCHEMA',
    version: '1.0.0',
    owner: 'data-platform',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, pii: false },
      { name: 'email', type: 'email', nullable: false, pii: true },
      { name: 'createdAt', type: 'iso-datetime', nullable: false, pii: false },
    ],
    references: [],
    invariants: [],
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    checksum: Sha256ChecksumSchema.parse('sha256:' + 'a'.repeat(64)),
    ...overrides,
  });

describe('harness/data-quality — SchemaReferentialValidator', () => {
  it('flags missing required fields', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    const v = new SchemaReferentialValidator(store, { now: () => new Date() });
    const report = v.validate('customer', [
      { id: '11111111-1111-1111-1111-111111111111' }, // missing email and createdAt
    ]);
    expect(report.passed).toBe(false);
    expect(
      report.issues.some((i) => i.rule === 'NOT_NULL' && i.field === 'email'),
    ).toBe(true);
  });

  it('flags type mismatches', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    const v = new SchemaReferentialValidator(store, { now: () => new Date() });
    const report = v.validate('customer', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'not-an-email',
        createdAt: '2026-08-02T00:00:00.000Z',
      },
    ]);
    expect(report.passed).toBe(false);
    expect(
      report.issues.some(
        (i) => i.rule === 'TYPE_MISMATCH' && i.field === 'email',
      ),
    ).toBe(true);
  });

  it('passes valid rows', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    const v = new SchemaReferentialValidator(store, { now: () => new Date() });
    const report = v.validate('customer', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'a@example.com',
        createdAt: '2026-08-02T00:00:00.000Z',
      },
    ]);
    expect(report.passed).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('throws when validating an unknown contract', () => {
    const store = new InMemoryDataContractStore();
    const v = new SchemaReferentialValidator(store, { now: () => new Date() });
    expect(() => v.validate('does-not-exist', [])).toThrow(/not found/);
  });

  it('validates referential integrity against another contract', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    store.upsert(
      baseContract({
        contractId: 'project',
        name: 'Project Contract',
        kind: 'REFERENTIAL',
        fields: [
          { name: 'customerId', type: 'uuid', nullable: false, pii: false },
        ],
        references: [
          {
            field: 'customerId',
            targetContractId: 'customer',
            targetField: 'id',
          },
        ],
      }),
    );
    const v = new SchemaReferentialValidator(store, { now: () => new Date() });
    const report = v.validate('project', [
      { customerId: '22222222-2222-2222-2222-222222222222' },
    ]);
    expect(report.passed).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('flags referential issues when target contract is missing', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(
      baseContract({
        contractId: 'project',
        kind: 'REFERENTIAL',
        fields: [{ name: 'customerId', type: 'uuid', nullable: false, pii: false }],
        references: [
          {
            field: 'customerId',
            targetContractId: 'missing',
            targetField: 'id',
          },
        ],
      }),
    );
    const v = new SchemaReferentialValidator(store, { now: () => new Date() });
    const report = v.validate('project', [
      { customerId: '22222222-2222-2222-2222-222222222222' },
    ]);
    expect(report.passed).toBe(false);
    expect(
      report.issues.some((i) => i.rule === 'MISSING_TARGET_CONTRACT'),
    ).toBe(true);
  });

  it('evaluates simple semantic invariants', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(
      baseContract({
        contractId: 'transaction',
        kind: 'SEMANTIC',
        fields: [
          { name: 'status', type: 'string', nullable: false, pii: false },
          { name: 'amount', type: 'number', nullable: false, pii: false },
        ],
        invariants: ['status in [ACTIVE, COMPLETED]', 'amount >= 0'],
      }),
    );
    const v = new SchemaReferentialValidator(store, { now: () => new Date() });
    const pass = v.validate('transaction', [{ status: 'ACTIVE', amount: 10 }]);
    expect(pass.passed).toBe(true);
    const fail = v.validate('transaction', [{ status: 'WAT', amount: -1 }]);
    expect(fail.passed).toBe(false);
  });
});

describe('harness/data-quality — SchemaDriftDetector', () => {
  const baseline = {
    rowCount: 100,
    freshnessSeconds: 60,
    numericFields: { amount: 1000 },
  };
  const current = {
    rowCount: 80,
    freshnessSeconds: 60,
    numericFields: { amount: 1000 },
  };
  const thresholds = DriftThresholdsSchema.parse({ maxVolumeDriftRatio: 0.1 });

  it('detects volume drift', () => {
    const d = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const report = d.detect('customer', current, baseline, thresholds);
    expect(report.signals.some((s) => s.kind === 'VOLUME_DRIFT')).toBe(true);
  });

  it('detects freshness drift', () => {
    const d = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const report = d.detect(
      'customer',
      { rowCount: 100, freshnessSeconds: 7200, numericFields: {} },
      baseline,
      DriftThresholdsSchema.parse({ maxFreshnessSeconds: 3600 }),
    );
    expect(report.signals.some((s) => s.kind === 'FRESHNESS_DRIFT')).toBe(true);
  });

  it('detects value drift per numeric field', () => {
    const d = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const report = d.detect(
      'customer',
      { rowCount: 100, freshnessSeconds: 60, numericFields: { amount: 2000 } },
      baseline,
    );
    expect(report.signals.some((s) => s.kind === 'VALUE_DRIFT')).toBe(true);
  });

  it('returns no signals when within thresholds', () => {
    const d = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const report = d.detect('customer', baseline, baseline);
    expect(report.signals).toHaveLength(0);
    expect(report.highestSeverity).toBe('INFO');
  });

  it('quarantines on CRITICAL drift', () => {
    const d = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const report = d.detect(
      'customer',
      { rowCount: 100, freshnessSeconds: 7200, numericFields: {} },
      baseline,
      DriftThresholdsSchema.parse({ maxFreshnessSeconds: 60 }),
    );
    expect(report.highestSeverity).toBe('CRITICAL');
    expect(report.quarantined).toBe(true);
  });
});

describe('harness/data-quality — Lineage', () => {
  it('reports downstream impact', () => {
    const lineage = new LineageBuilder();
    lineage
      .addNode({
        nodeId: 'src-customer',
        kind: 'SOURCE',
        name: 'Customer Source',
        contractId: 'customer',
      })
      .addNode({
        nodeId: 'transformed-customer',
        kind: 'TRANSFORM',
        name: 'Transform',
        contractId: 'customer',
      })
      .addNode({ nodeId: 'reporting', kind: 'CONSUMER', name: 'Reporting' });
    lineage
      .addEdge({ from: 'src-customer', to: 'transformed-customer' })
      .addEdge({ from: 'transformed-customer', to: 'reporting' });
    const impact = lineage.impactOf('src-customer');
    expect(impact.map((n) => n.nodeId).sort()).toEqual([
      'reporting',
      'transformed-customer',
    ]);
  });
});

describe('harness/data-quality — DataQualityGate', () => {
  it('returns PASS when validation passes and drift is in INFO', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    const validator = new SchemaReferentialValidator(store, {
      now: () => new Date(),
    });
    const drift = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const gate = new DataQualityGate(validator, drift, undefined, {
      now: () => new Date(),
    });
    const v = gate.evaluate({
      contractId: 'customer',
      rows: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'a@example.com',
          createdAt: '2026-08-02T00:00:00.000Z',
        },
      ],
      current: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
      baseline: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
    });
    expect(v.verdict).toBe('PASS');
  });

  it('returns FAIL when validation fails', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    const validator = new SchemaReferentialValidator(store, {
      now: () => new Date(),
    });
    const drift = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const gate = new DataQualityGate(validator, drift, undefined, {
      now: () => new Date(),
    });
    const v = gate.evaluate({
      contractId: 'customer',
      rows: [{}], // missing required fields
      current: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
      baseline: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
    });
    expect(v.verdict).toBe('FAIL');
  });

  it('returns FAIL on CRITICAL drift', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    const validator = new SchemaReferentialValidator(store, {
      now: () => new Date(),
    });
    const drift = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const gate = new DataQualityGate(validator, drift, undefined, {
      now: () => new Date(),
    });
    const v = gate.evaluate({
      contractId: 'customer',
      rows: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'a@example.com',
          createdAt: '2026-08-02T00:00:00.000Z',
        },
      ],
      current: { rowCount: 100, freshnessSeconds: 8000, numericFields: {} },
      baseline: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
    });
    expect(v.verdict).toBe('FAIL');
  });

  it('includes affected scenarios when lineage is provided', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    const validator = new SchemaReferentialValidator(store, {
      now: () => new Date(),
    });
    const drift = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const lineage = new LineageBuilder();
    lineage
      .addNode({ nodeId: 'customer', kind: 'SOURCE', contractId: 'customer' })
      .addNode({
        nodeId: 'report',
        kind: 'CONSUMER',
        contractId: 'customer-report',
      });
    lineage.addEdge({ from: 'customer', to: 'report' });
    const gate = new DataQualityGate(validator, drift, lineage, {
      now: () => new Date(),
    });
    const v = gate.evaluate({
      contractId: 'customer',
      rows: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'a@example.com',
          createdAt: '2026-08-02T00:00:00.000Z',
        },
      ],
      current: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
      baseline: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
    });
    expect(v.affectedScenarios).toContain('customer-report');
  });
});

describe('harness/data-quality — Contract versioning', () => {
  it('records an immutable version chain', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract());
    store.addVersion(
      DataContractVersionSchema.parse({
        contractId: 'customer',
        version: '1.1.0',
        changes: 'added phone field',
        changedBy: 'data-platform',
        changedAt: '2026-08-02T00:00:00.000Z',
        checksum: Sha256ChecksumSchema.parse('sha256:' + 'b'.repeat(64)),
        supersedes: 'sha256:' + 'a'.repeat(64),
      }),
    );
    const versions = store.versions('customer');
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('1.1.0');
  });
});

describe('harness/data-quality — requireAuth', () => {
  it('rejects when context is missing', () => {
    expect(() => requireAuth(undefined, 'evaluate')).toThrow(
      /Missing authorization/,
    );
  });

  it('rejects when tenantId is missing', () => {
    expect(() =>
      requireAuth(
        {
          actorId: 'a',
          actorType: 'SYSTEM',
          actorRoles: ['SYSTEM'],
          correlationId: 'corr-1',
          permissions: ['evidence:read'],
          tenantId: '',
        },
        'evaluate',
      ),
    ).toThrow(/must include tenantId/);
  });
});

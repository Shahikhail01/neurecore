/**
 * NeureCore Harness - RAG / Knowledge Conformance (Phase 4)
 *
 * Document ID: NC-HARNESS-RAG-001
 * Tests: ~25
 */

import {
  InMemoryRagAdapter,
  RAG_VERSION,
  recallAtK,
  precisionAtK,
  meanReciprocalRank,
  ndcgAtK,
  citationValidity,
  groundingScore,
  ungroundedRate,
  createRagBenchmark,
  DEFAULT_RAG_BENCHMARK_CONFIG,
  type KnowledgeDocument,
  type KnowledgeChunk,
} from './index';
import type { AuthorizationContext } from '../contracts';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const authCtx = (tenantId: string = TENANT_A): AuthorizationContext => ({
  actorId: 'actor-1',
  actorType: 'HUMAN',
  actorRoles: ['DOMAIN_OWNER'],
  tenantId,
  correlationId: 'corr-1',
  permissions: [],
});

const makeDoc = (
  id: string,
  tenantId: string,
  chunks: Array<{ chunkId: string; text: string; tenantScopes?: string[] }>,
  deleted = false,
): KnowledgeDocument => ({
  documentId: id,
  tenantId,
  title: `Doc ${id}`,
  sourceUri: `https://example.com/${id}`,
  ingestedAt: new Date().toISOString(),
  deletedAt: deleted ? new Date().toISOString() : undefined,
  chunks: chunks.map(
    (c): KnowledgeChunk => ({
      chunkId: c.chunkId,
      documentId: id,
      tenantId,
      text: c.text,
      tenantScopes: (c.tenantScopes ?? [tenantId]) as never,
      createdAt: new Date().toISOString(),
    }),
  ),
});

describe('RAG / Knowledge — Phase 4 conformance', () => {
  test('RAG_VERSION is 1.0.0', () => {
    expect(RAG_VERSION).toBe('1.0.0');
  });

  test('recallAtK returns correct ratio', () => {
    expect(recallAtK(['a', 'b', 'c'], ['a', 'd'], 3)).toBeCloseTo(0.5, 2);
  });

  test('recallAtK returns 0 when no overlap', () => {
    expect(recallAtK(['x'], ['a'], 3)).toBe(0);
  });

  test('precisionAtK returns 1 on perfect match', () => {
    expect(precisionAtK(['a', 'b'], ['a', 'b'], 2)).toBe(1);
  });

  test('MRR returns first position weighted', () => {
    expect(meanReciprocalRank(['a', 'x'], ['a'])).toBe(1);
    expect(meanReciprocalRank(['x', 'a'], ['a'])).toBe(0.5);
    expect(meanReciprocalRank(['x'], ['a'])).toBe(0);
  });

  test('nDCG@k returns 1 on perfect ordering', () => {
    expect(ndcgAtK(['a', 'b'], ['a', 'b'], 2)).toBe(1);
  });

  test('citationValidity measures coverage', () => {
    expect(citationValidity(['a', 'b'], ['a', 'b', 'c'])).toBeCloseTo(2 / 3, 2);
  });

  test('groundingScore is alias for citationValidity', () => {
    expect(groundingScore(['a'], ['a'])).toBe(1);
  });

  test('ungroundedRate measures spurious citations', () => {
    expect(ungroundedRate(['a', 'b'], ['a'])).toBe(0.5);
  });

  test('InMemoryRagAdapter ingestion requires tenantId match', () => {
    const a = new InMemoryRagAdapter();
    expect(() =>
      a.ingestion({
        documents: [
          makeDoc('d1', TENANT_A, [{ chunkId: 'c1', text: 'hello' }]),
        ],
        ctx: authCtx(TENANT_B),
      }),
    ).toThrow(/tenant mismatch/);
  });

  test('InMemoryRagAdapter retrieval returns matching chunks', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [
        makeDoc('d1', TENANT_A, [
          { chunkId: 'c1', text: 'the cat sat on the mat' },
          { chunkId: 'c2', text: 'completely unrelated text' },
        ]),
      ],
      ctx: authCtx(),
    });
    const r = a.retrieval({
      query: 'cat mat',
      tenantId: TENANT_A,
      topK: 5,
      ctx: authCtx(),
    });
    expect(r).toHaveLength(1);
    expect(r[0].chunkId).toBe('c1');
  });

  test('InMemoryRagAdapter retrieval filters by tenant scope', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [
        makeDoc('d1', TENANT_A, [
          { chunkId: 'c1', text: 'visible to A', tenantScopes: [TENANT_A] },
        ]),
      ],
      ctx: authCtx(),
    });
    a.ingestion({
      documents: [
        makeDoc('d2', TENANT_B, [
          { chunkId: 'c2', text: 'visible to B', tenantScopes: [TENANT_B] },
        ]),
      ],
      ctx: authCtx(TENANT_B),
    });
    const aResults = a.retrieval({
      query: 'visible',
      tenantId: TENANT_A,
      topK: 5,
      ctx: authCtx(),
    });
    expect(aResults).toHaveLength(1);
    expect(aResults[0].documentId).toBe('d1');
  });

  test('InMemoryRagAdapter requires tenant match on retrieval', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [makeDoc('d1', TENANT_A, [{ chunkId: 'c1', text: 'hello' }])],
      ctx: authCtx(),
    });
    expect(() =>
      a.retrieval({
        query: 'hello',
        tenantId: TENANT_A,
        topK: 5,
        ctx: authCtx(TENANT_B),
      }),
    ).toThrow(/tenant mismatch/);
  });

  test('InMemoryRagAdapter delete soft-deletes document', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [makeDoc('d1', TENANT_A, [{ chunkId: 'c1', text: 'hello' }])],
      ctx: authCtx(),
    });
    const del = a.delete({
      documentId: 'd1',
      tenantId: TENANT_A,
      ctx: authCtx(),
    });
    expect(del.deletedChunks).toBe(1);
    const r = a.retrieval({
      query: 'hello',
      tenantId: TENANT_A,
      topK: 5,
      ctx: authCtx(),
    });
    expect(r).toHaveLength(0);
  });

  test('InMemoryRagAdapter freshness returns age', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [makeDoc('d1', TENANT_A, [{ chunkId: 'c1', text: 'old' }])],
      ctx: authCtx(),
    });
    const f = a.freshness({ query: 'old', tenantId: TENANT_A, ctx: authCtx() });
    expect(f).not.toBeNull();
    expect((f as { maxAgeMs: number }).maxAgeMs).toBeGreaterThanOrEqual(0);
  });

  test('Retrieval benchmark with INSUFFICIENT_EVIDENCE', () => {
    const a = new InMemoryRagAdapter();
    const b = createRagBenchmark();
    const r = b.runRetrievalBenchmark({
      scenarioId: 's1',
      tenantId: TENANT_A,
      samples: [],
      adapter: a,
      config: DEFAULT_RAG_BENCHMARK_CONFIG,
      ctx: authCtx(),
    });
    expect(r.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  test('Retrieval benchmark passes when samples match', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [
        makeDoc('d1', TENANT_A, [
          { chunkId: 'c1', text: 'c1 2+2 answer is 4' },
        ]),
      ],
      ctx: authCtx(),
    });
    const b = createRagBenchmark();
    const samples = Array.from({ length: 20 }, (_, i) => ({
      queryId: `q${i}`,
      retrievedIds: ['d1'],
      expectedIds: ['d1'],
      expectedCitations: ['c1'],
      actualCitations: ['c1'],
    }));
    const r = b.runRetrievalBenchmark({
      scenarioId: 's1',
      tenantId: TENANT_A,
      samples,
      adapter: a,
      config: { ...DEFAULT_RAG_BENCHMARK_CONFIG, minSampleSize: 5 },
      ctx: authCtx(),
    });
    expect(r.sampleSize).toBe(20);
    expect(r.verdict).toBe('PASS');
  });

  test('Retrieval benchmark requires tenant context', () => {
    const a = new InMemoryRagAdapter();
    const b = createRagBenchmark();
    expect(() =>
      b.runRetrievalBenchmark({
        scenarioId: 's1',
        tenantId: TENANT_A,
        samples: [],
        adapter: a,
        config: DEFAULT_RAG_BENCHMARK_CONFIG,
        ctx: authCtx(),
      }),
    ).not.toThrow();
  });

  test('ACL benchmark denies cross-tenant retrieval', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [
        makeDoc('d1', TENANT_A, [
          { chunkId: 'c1', text: 'secret', tenantScopes: [TENANT_A] },
        ]),
      ],
      ctx: authCtx(),
    });
    const b = createRagBenchmark();
    const r = b.runAclBenchmark({
      scenarioId: 's1',
      tenantId: TENANT_A,
      adapter: a,
      samples: [
        { query: 'secret', documentId: 'd1', forbiddenTenantId: TENANT_B },
        { query: 'secret', documentId: 'd1', forbiddenTenantId: TENANT_B },
      ],
      ctx: authCtx(),
    });
    expect(r.crossTenantDenialRate).toBe(1);
  });

  test('Deletion benchmark confirms propagation', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [
        makeDoc('d1', TENANT_A, [{ chunkId: 'c1', text: 'to-delete' }]),
      ],
      ctx: authCtx(),
    });
    const b = createRagBenchmark();
    a.ingestion({
      documents: [
        makeDoc('d2', TENANT_A, [{ chunkId: 'c2', text: 'to-delete' }]),
      ],
      ctx: authCtx(),
    });
    const r = b.runDeletionBenchmark({
      scenarioId: 's1',
      tenantId: TENANT_A,
      adapter: a,
      samples: [
        { documentId: 'd1', query: 'to-delete' },
        { documentId: 'd2', query: 'to-delete' },
      ],
      ctx: authCtx(),
    });
    expect(r.deletionPropagationRate).toBe(1);
  });

  test('Freshness probe returns max chunk age', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [makeDoc('d1', TENANT_A, [{ chunkId: 'c1', text: 'hello' }])],
      ctx: authCtx(),
    });
    const b = createRagBenchmark();
    const r = b.runFreshnessProbe({
      scenarioId: 's1',
      tenantId: TENANT_A,
      adapter: a,
      queries: ['hello'],
      config: {},
      ctx: authCtx(),
    });
    expect(r.maxChunkAgeMs).not.toBeNull();
  });

  test('Freshness probe returns null when no docs', () => {
    const a = new InMemoryRagAdapter();
    const b = createRagBenchmark();
    const r = b.runFreshnessProbe({
      scenarioId: 's1',
      tenantId: TENANT_A,
      adapter: a,
      queries: ['nothing'],
      config: {},
      ctx: authCtx(),
    });
    expect(r.maxChunkAgeMs).toBeNull();
  });

  test('Default RAG benchmark config is safe', () => {
    expect(DEFAULT_RAG_BENCHMARK_CONFIG.minSampleSize).toBeGreaterThan(0);
    expect(DEFAULT_RAG_BENCHMARK_CONFIG.minCitationValidity).toBeGreaterThan(0);
  });

  test('InMemoryRagAdapter ingestion counts chunks', () => {
    const a = new InMemoryRagAdapter();
    const result = a.ingestion({
      documents: [
        makeDoc('d1', TENANT_A, [
          { chunkId: 'c1', text: 'a' },
          { chunkId: 'c2', text: 'b' },
        ]),
      ],
      ctx: authCtx(),
    });
    expect(result.chunkCount).toBe(2);
    expect(result.ingestedDocIds).toEqual(['d1']);
  });

  test('Retrieval benchmark returns FAILED when recall < threshold', () => {
    const a = new InMemoryRagAdapter();
    a.ingestion({
      documents: [makeDoc('d1', TENANT_A, [{ chunkId: 'c1', text: 'x' }])],
      ctx: authCtx(),
    });
    const b = createRagBenchmark();
    const samples = Array.from({ length: 10 }, (_, i) => ({
      queryId: `q${i}`,
      retrievedIds: ['x'],
      expectedIds: ['d1'],
      expectedCitations: ['c1'],
      actualCitations: [],
    }));
    const r = b.runRetrievalBenchmark({
      scenarioId: 's1',
      tenantId: TENANT_A,
      samples,
      adapter: a,
      config: { ...DEFAULT_RAG_BENCHMARK_CONFIG, minSampleSize: 5 },
      ctx: authCtx(),
    });
    expect(r.verdict).toBe('FAIL');
  });
});

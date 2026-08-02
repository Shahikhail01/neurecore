/**
 * Unit tests for MerkleRootScheduler and BeancountSnapshotScheduler.
 */

import { MerkleRootScheduler } from './merkle-root.scheduler';
import { OutboxMerkleRootService } from './outbox-merkle-root.service';
import { BeancountSnapshotService } from './beancount-snapshot.service';
import { BeancountSnapshotScheduler } from './beancount-snapshot.scheduler';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MiniCronService } from '../../information-engine/cron/mini-cron.service';

function buildMockPrisma() {
  const $queryRaw = jest.fn();
  const findFirst = jest.fn();
  const count = jest.fn();
  return {
    $queryRaw,
    outboxMerkleRoot: { findFirst },
    enterpriseEventOutbox: { count },
  } as unknown as PrismaService;
}

const fakeRootSummary = {
  tenantId: 't1',
  rootHash: 'abc',
  prevRootHash: null,
  leafCount: 1,
  firstEventId: 'e1',
  lastEventId: 'e1',
  periodStart: new Date(),
  periodEnd: new Date(),
};

function buildMockMerkle(): OutboxMerkleRootService {
  return {
    computeForPeriod: jest.fn(async () => fakeRootSummary),
  } as unknown as OutboxMerkleRootService;
}

function buildMockSnapshots(): BeancountSnapshotService {
  return {
    enqueue: jest.fn(async () => undefined),
  } as unknown as BeancountSnapshotService;
}

function makeFakeCron() {
  const fakeCron: Partial<MiniCronService> = {
    registerCron: jest.fn(),
    tickForTest: jest.fn(),
    listJobs: jest.fn(() => []),
  };
  return fakeCron as MiniCronService;
}

describe('MerkleRootScheduler', () => {
  let sched: MerkleRootScheduler;
  let fakeCron: ReturnType<typeof makeFakeCron>;
  let prisma: ReturnType<typeof buildMockPrisma>;
  let merkle: ReturnType<typeof buildMockMerkle>;

  beforeEach(async () => {
    fakeCron = makeFakeCron();
    prisma = buildMockPrisma();
    merkle = buildMockMerkle();
    sched = new MerkleRootScheduler(fakeCron as unknown as MiniCronService, merkle, prisma);
    (sched as any).started = true;
  });

  it('registers itself with MiniCron on bootstrap', () => {
    (sched as any).started = false;
    sched.startCron();
    expect(fakeCron.registerCron).toHaveBeenCalled();
    const [expr, name] = (fakeCron.registerCron as jest.Mock).mock.calls[0];
    expect(name).toBe('accounting.merkleRoot');
    expect(typeof expr).toBe('string');
    expect(expr.split(/\s+/)).toHaveLength(5);
  });

  it('tick() computes Merkle for tenants with new events', async () => {
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValueOnce([
      { tenantId: 't1' }, { tenantId: 't2' },
    ]);
    (prisma.outboxMerkleRoot.findFirst as unknown as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ periodEnd: new Date(0) });
    (prisma.enterpriseEventOutbox.count as unknown as jest.Mock).mockResolvedValueOnce(5);

    const result = await sched.tick();
    expect(result.tenants).toBe(2);
    expect(result.roots).toBe(2);
    expect((merkle.computeForPeriod as jest.Mock)).toHaveBeenCalledTimes(2);
  });

  it('tick() skips tenants with no new events since last root', async () => {
    // last.periodEnd = now means newer = count(createdAt > now) = 0 → skip
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValueOnce([{ tenantId: 't1' }]);
    (prisma.outboxMerkleRoot.findFirst as unknown as jest.Mock).mockResolvedValueOnce({ periodEnd: new Date() });
    (prisma.enterpriseEventOutbox.count as unknown as jest.Mock).mockResolvedValueOnce(0);

    const result = await sched.tick();
    expect(result.tenants).toBe(0);  // discovered 1 candidate but skipped
    expect(result.roots).toBe(0);
    expect(merkle.computeForPeriod as jest.Mock).not.toHaveBeenCalled();
  });

  it('tick() processes tenants with new events since last root', async () => {
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValueOnce([{ tenantId: 't1' }]);
    (prisma.outboxMerkleRoot.findFirst as unknown as jest.Mock).mockResolvedValueOnce({ periodEnd: new Date(0) });
    (prisma.enterpriseEventOutbox.count as unknown as jest.Mock).mockResolvedValueOnce(5);

    const result = await sched.tick();
    expect(result.tenants).toBe(1);
    expect(result.roots).toBe(1);
    expect(merkle.computeForPeriod as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('tick() continues past per-tenant errors', async () => {
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValueOnce([
      { tenantId: 't1' }, { tenantId: 't2' },
    ]);
    (prisma.outboxMerkleRoot.findFirst as unknown as jest.Mock).mockResolvedValue(null);
    (merkle.computeForPeriod as jest.Mock)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(fakeRootSummary);

    const result = await sched.tick();
    expect(result.tenants).toBe(2);
    expect(result.roots).toBe(1);
  });
});

describe('BeancountSnapshotScheduler', () => {
  let sched: BeancountSnapshotScheduler;
  let fakeCron: ReturnType<typeof makeFakeCron>;
  let prisma: ReturnType<typeof buildMockPrisma>;
  let snapshots: ReturnType<typeof buildMockSnapshots>;

  beforeEach(async () => {
    fakeCron = makeFakeCron();
    prisma = buildMockPrisma();
    snapshots = buildMockSnapshots();
    sched = new BeancountSnapshotScheduler(fakeCron as unknown as MiniCronService, snapshots, prisma);
    (sched as any).started = true;
  });

  it('registers itself with MiniCron on bootstrap', () => {
    (sched as any).started = false;
    sched.startCron();
    expect(fakeCron.registerCron).toHaveBeenCalledWith(
      expect.any(String), 'accounting.beancountSnapshot', expect.any(Function),
    );
  });

  it('tick() enqueues every tenant with ledger activity', async () => {
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValueOnce([
      { tenantId: 't1' }, { tenantId: 't2' },
    ]);
    const result = await sched.tick();
    expect(result.tenants).toBe(2);
    expect(result.regenerated).toBe(2);
    expect((snapshots.enqueue as jest.Mock)).toHaveBeenCalledTimes(2);
    expect((snapshots.enqueue as jest.Mock)).toHaveBeenCalledWith('t1');
    expect((snapshots.enqueue as jest.Mock)).toHaveBeenCalledWith('t2');
  });

  it('tick() continues past per-tenant errors', async () => {
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValueOnce([
      { tenantId: 't1' }, { tenantId: 't2' },
    ]);
    (snapshots.enqueue as jest.Mock)
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(undefined);
    const result = await sched.tick();
    expect(result.tenants).toBe(2);
    expect(result.regenerated).toBe(1);
  });
});
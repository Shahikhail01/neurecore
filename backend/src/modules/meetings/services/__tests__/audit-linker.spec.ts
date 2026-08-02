/**
 * Phase P3 — Meeting audit + CRM linker unit tests.
 */
import { MeetingAuditService } from '../meeting-audit.service';
import { CrmLinkerService } from '../crm-linker.service';
import type { MeetingTranscript } from '../../schemas/meeting.types';

describe('MeetingAuditService', () => {
  it('records corrections and increments version on regenerate', async () => {
    const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new MeetingAuditService(auditMock as never);

    const c1 = await svc.recordCorrection({
      tenantId: 't1',
      actorId: 'u1',
      meetingId: 'm1',
      field: 'actionItem',
      targetId: 'a1',
      before: { text: 'old' },
      after: { text: 'new' },
      reason: 'typo fix',
    });
    expect(c1.id).toBeDefined();
    expect(svc.listCorrections('t1', 'm1')).toHaveLength(1);

    const r1 = await svc.regenerate('t1', 'u1', 'm1');
    expect(r1.version).toBe(1);
    expect(svc.currentVersion('t1', 'm1')).toBe(1);
  });

  it('requires a correction reason', async () => {
    const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new MeetingAuditService(auditMock as never);
    await expect(
      svc.recordCorrection({
        tenantId: 't1',
        actorId: 'u1',
        meetingId: 'm1',
        field: 'actionItem',
        targetId: 'a1',
        before: {},
        after: {},
        reason: '   ',
      }),
    ).rejects.toThrow(/reason required/);
  });
});

describe('CrmLinkerService.resolveEntity', () => {
  it('rejects unknown entity types', async () => {
    const prismaMock = {};
    const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const runtime = { createRun: jest.fn() };
    const svc = new CrmLinkerService(
      prismaMock as never,
      auditMock as never,
      runtime as never,
    );
    await expect(
      svc.resolveEntity('t1', 'unknown' as never, 'x'),
    ).rejects.toThrow(/not allowed/);
  });

  it('returns 404 for entities in another tenant (no information leakage)', async () => {
    const customerTable = {
      findFirst: jest.fn().mockResolvedValue(null), // entity not found in tenant
    };
    const prismaMock = { customer: customerTable };
    const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const runtime = { createRun: jest.fn() };
    const svc = new CrmLinkerService(
      prismaMock as never,
      auditMock as never,
      runtime as never,
    );
    await expect(
      svc.resolveEntity('t1', 'account', 'foreign-id'),
    ).rejects.toThrow(/not found/);
    expect(customerTable.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'foreign-id', tenantId: 't1' }),
      }),
    );
  });

  it('dispatches a WorkRun when linking', async () => {
    const customerTable = {
      findFirst: jest.fn().mockResolvedValue({ id: 'cust-1' }),
    };
    const prismaMock = { customer: customerTable };
    const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const runtime = { createRun: jest.fn().mockResolvedValue({ id: 'wr-1' }) };
    const svc = new CrmLinkerService(
      prismaMock as never,
      auditMock as never,
      runtime as never,
    );
    const transcript: MeetingTranscript = {
      id: 'm1',
      tenantId: 't1',
      provider: 'STANDALONE',
      externalId: 'e1',
      title: 'X',
      startedAt: '2026-08-02T10:00:00.000Z',
      endedAt: '2026-08-02T11:00:00.000Z',
      consent: {
        tenantId: 't1',
        userId: 'u1',
        scope: 'TRANSCRIPT_INGEST',
        grantedAt: '2026-08-02T09:00:00.000Z',
        jurisdiction: 'GDPR',
      },
      participants: [],
      utterances: [],
    };
    const out = await svc.link('t1', 'u1', transcript, [
      { entityType: 'account', entityId: 'cust-1' },
    ]);
    expect(out.workRunId).toBe('wr-1');
    expect(runtime.createRun).toHaveBeenCalled();
  });
});

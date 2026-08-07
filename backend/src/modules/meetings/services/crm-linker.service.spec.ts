/**
 * Phase 16 — CrmLinkerService tests.
 */

import {
  CrmLinkerService,
  CrmLinkerForbiddenError,
} from './crm-linker.service';

function makePrisma(opts: {
  transcripts?: Array<{ id: string; tenantId: string } | null>;
  customers?: Array<{ id: string; tenantId: string } | null>;
  contacts?: Array<{ id: string } | null>;
  deals?: Array<{ id: string; tenantId: string; deletedAt: Date | null } | null>;
  update?: () => Promise<unknown>;
  actionCreate?: () => Promise<{ id: string }>;
}) {
  const update = opts.update ?? (async () => ({}));
  return {
    prisma: {
      meetingTranscript: {
        findFirst: jest.fn(async () => opts.transcripts?.[0] ?? null),
        update: jest.fn(update),
      },
      customer: {
        findFirst: jest.fn(async () => opts.customers?.[0] ?? null),
      },
      customerContact: {
        findFirst: jest.fn(async () => opts.contacts?.[0] ?? null),
      },
      deal: {
        findFirst: jest.fn(async () => opts.deals?.[0] ?? null),
      },
      meetingActionItem: {
        create: jest.fn(opts.actionCreate ?? (async () => ({ id: 'a-1' }))),
      },
    },
  };
}

describe('Phase 16 — CrmLinkerService', () => {
  it('refuses wildcard tenantId', async () => {
    const svc = new CrmLinkerService(makePrisma({}).prisma as never);
    await expect(
      svc.link({
        tenantId: '*',
        transcriptId: 'mt-1',
        recordType: 'account',
        recordId: 'c-1',
      }),
    ).rejects.toBeInstanceOf(CrmLinkerForbiddenError);
  });

  it('rejects unsupported record types', async () => {
    const svc = new CrmLinkerService(makePrisma({}).prisma as never);
    await expect(
      svc.link({
        tenantId: 't',
        transcriptId: 'mt-1',
        recordType: 'unknown' as never,
        recordId: 'x-1',
      }),
    ).rejects.toBeInstanceOf(CrmLinkerForbiddenError);
  });

  it('refuses to link when the transcript does not belong to the tenant', async () => {
    const svc = new CrmLinkerService(makePrisma({ transcripts: [null] }).prisma as never);
    await expect(
      svc.link({
        tenantId: 't',
        transcriptId: 'mt-1',
        recordType: 'account',
        recordId: 'c-1',
      }),
    ).rejects.toThrow(/not found/);
  });

  it('refuses to link to a record outside the tenant', async () => {
    const svc = new CrmLinkerService(
      makePrisma({
        transcripts: [{ id: 'mt-1', tenantId: 't' }],
        customers: [null],
      }).prisma as never,
    );
    await expect(
      svc.link({
        tenantId: 't',
        transcriptId: 'mt-1',
        recordType: 'account',
        recordId: 'c-1',
      }),
    ).rejects.toBeInstanceOf(CrmLinkerForbiddenError);
  });

  it('links successfully when both sides belong to the tenant', async () => {
    const update = jest.fn(async () => ({}));
    const svc = new CrmLinkerService(
      makePrisma({
        transcripts: [{ id: 'mt-1', tenantId: 't' }],
        customers: [{ id: 'c-1', tenantId: 't' }],
        update,
      }).prisma as never,
    );
    const out = await svc.link({
      tenantId: 't',
      transcriptId: 'mt-1',
      recordType: 'account',
      recordId: 'c-1',
    });
    expect(out.transcriptId).toBe('mt-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mt-1' },
        data: expect.objectContaining({ linkedRecordType: 'account' }),
      }),
    );
  });

  it('persistActionItems writes one row per item', async () => {
    const svc = new CrmLinkerService(makePrisma({}).prisma as never);
    const out = await svc.persistActionItems({
      tenantId: 't',
      transcriptId: 'mt-1',
      items: [
        { description: 'd1', confidencePercent: 80, ownerUserId: null, ownerHint: null, dueDate: null, ambiguousOwner: false },
        { description: 'd2', confidencePercent: 75, ownerUserId: null, ownerHint: null, dueDate: null, ambiguousOwner: true },
      ],
    });
    expect(out.writtenIds).toHaveLength(2);
  });

  it('persistActionItems short-circuits empty input', async () => {
    const svc = new CrmLinkerService(makePrisma({}).prisma as never);
    const out = await svc.persistActionItems({
      tenantId: 't',
      transcriptId: 'mt-1',
      items: [],
    });
    expect(out.writtenIds).toEqual([]);
  });
});

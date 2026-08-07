import {
  BounceAnalyzerService,
  BounceCategory,
} from './bounce-analyzer.service';

function makePrisma() {
  return { prisma: {} as never };
}

describe('Phase 19 — BounceAnalyzerService', () => {
  it('refuses wildcard tenantId', async () => {
    const svc = new BounceAnalyzerService(makePrisma().prisma);
    await expect(
      svc.classify({
        tenantId: '*',
        recipientEmail: 'a@b.com',
      }),
    ).rejects.toThrow(/tenantId/);
  });

  it('classifies HARD_BOUNCE on 5xx', async () => {
    const svc = new BounceAnalyzerService(makePrisma().prisma);
    const out = await svc.classify({
      tenantId: 't',
      recipientEmail: 'a@b.com',
      smtpStatus: 550,
      smtpDiagnostic: 'mailbox does not exist',
    });
    expect(out.category).toBe<BounceCategory>('HARD_BOUNCE');
    expect(out.confidencePercent).toBe(90);
  });

  it('classifies SOFT_BOUNCE on quota', async () => {
    const svc = new BounceAnalyzerService(makePrisma().prisma);
    const out = await svc.classify({
      tenantId: 't',
      recipientEmail: 'a@b.com',
      smtpStatus: 452,
      smtpDiagnostic: 'mailbox full',
    });
    expect(out.category).toBe<BounceCategory>('SOFT_BOUNCE');
  });

  it('classifies COMPLAINT on spam complaint', async () => {
    const svc = new BounceAnalyzerService(makePrisma().prisma);
    const out = await svc.classify({
      tenantId: 't',
      recipientEmail: 'a@b.com',
      reason: 'spam complaint',
    });
    expect(out.category).toBe<BounceCategory>('COMPLAINT');
  });

  it('classifies BLOCK on TLS issues', async () => {
    const svc = new BounceAnalyzerService(makePrisma().prisma);
    const out = await svc.classify({
      tenantId: 't',
      recipientEmail: 'a@b.com',
      smtpStatus: 421,
      smtpDiagnostic: 'TLS required',
    });
    expect(out.category).toBe<BounceCategory>('BLOCK');
  });

  it('falls back to OTHER with low confidence when nothing matches', async () => {
    const svc = new BounceAnalyzerService(makePrisma().prisma);
    const out = await svc.classify({
      tenantId: 't',
      recipientEmail: 'a@b.com',
    });
    expect(out.category).toBe<BounceCategory>('OTHER');
    expect(out.confidencePercent).toBeLessThan(80);
  });
});

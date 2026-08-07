import { CrmEventTriggerService } from './crm-event-trigger.service';

function makePrisma(opts: { tenantFound?: boolean } = {}) {
  return {
    prisma: {
      tenant: {
        findFirst: jest.fn(async () =>
          opts.tenantFound === false
            ? null
            : { id: 'tenant-A' },
        ),
      },
    },
  };
}

const baseEnvelope = {
  tenantId: 'tenant-A',
  source: 'hubspot' as const,
  eventType: 'lead.created',
  payload: { id: 'lead-1', email: 'a@b.com' },
  receivedAt: new Date().toISOString(),
};

describe('Phase 20 — CrmEventTriggerService (CR-AI-1106)', () => {
  it('refuses wildcard tenantId', async () => {
    const svc = new CrmEventTriggerService(makePrisma().prisma as never);
    await expect(
      svc.ingest({ ...baseEnvelope, tenantId: '*' }),
    ).rejects.toThrow(/tenantId/);
  });

  it('refuses unsupported source', async () => {
    const svc = new CrmEventTriggerService(makePrisma().prisma as never);
    await expect(
      svc.ingest({ ...baseEnvelope, source: 'jira' as never }),
    ).rejects.toThrow(/unsupported/);
  });

  it('refuses when the tenant is not active', async () => {
    const svc = new CrmEventTriggerService(makePrisma({ tenantFound: false }).prisma as never);
    await expect(svc.ingest(baseEnvelope)).rejects.toThrow(/not active/);
  });

  it('lead.created surfaces route_to_sales + score-lead follow-up', async () => {
    const svc = new CrmEventTriggerService(makePrisma().prisma as never);
    const out = await svc.ingest(baseEnvelope);
    expect(out.actionsTaken).toContain('route_to_sales');
    expect(out.followUpTasks).toContain('create-task:score-lead');
    expect(out.eventId).toMatch(/^evt_hubspot_/);
  });

  it('deal.stage_changed surfaces update_pipeline + refresh-forecast', async () => {
    const svc = new CrmEventTriggerService(makePrisma().prisma as never);
    const out = await svc.ingest({
      ...baseEnvelope,
      eventType: 'deal.stage_changed',
    });
    expect(out.actionsTaken).toContain('update_pipeline');
    expect(out.followUpTasks).toContain('create-task:refresh-forecast');
  });

  it('contact.* surfaces update_contact_record', async () => {
    const svc = new CrmEventTriggerService(makePrisma().prisma as never);
    const out = await svc.ingest({
      ...baseEnvelope,
      eventType: 'contact.updated',
    });
    expect(out.actionsTaken).toContain('update_contact_record');
  });

  it('idempotent — same envelope yields same eventId on replay', async () => {
    const svc = new CrmEventTriggerService(makePrisma().prisma as never);
    const a = await svc.ingest(baseEnvelope);
    const b = await svc.ingest(baseEnvelope);
    expect(a.eventId).toBe(b.eventId);
  });
});

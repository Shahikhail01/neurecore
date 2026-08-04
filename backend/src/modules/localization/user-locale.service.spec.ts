/**
 * User Locale — unit tests.
 */

import { UserLocaleService } from './user-locale.service';

function mockPrisma() {
  return {
    userLocalePreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  } as any;
}

describe('UserLocaleService', () => {
  let svc: UserLocaleService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new UserLocaleService(prisma);
  });

  it('resolve: returns the user preference when set', async () => {
    prisma.userLocalePreference.findUnique.mockResolvedValue({
      userId: 'u1',
      tenantId: 'tenant-a',
      localeId: 'ja-JP',
    });
    const out = await svc.resolve({ userId: 'u1', tenantId: 'tenant-a' });
    expect(out.id).toBe('ja-JP');
  });

  it('resolve: falls back to tenant preference', async () => {
    prisma.userLocalePreference.findUnique.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue({ locale: 'de-DE' });
    const out = await svc.resolve({ userId: 'u1', tenantId: 'tenant-a' });
    expect(out.id).toBe('de-DE');
  });

  it('resolve: falls back to en-US default', async () => {
    prisma.userLocalePreference.findUnique.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue({ locale: null });
    const out = await svc.resolve({ userId: 'u1', tenantId: 'tenant-a' });
    expect(out.id).toBe('en-US');
  });

  it('setUserLocale rejects unknown locale', async () => {
    await expect(
      svc.setUserLocale({
        userId: 'u1',
        tenantId: 'tenant-a',
        localeId: 'xx-YY',
      }),
    ).rejects.toThrow(/unknown locale/);
  });

  it('setUserLocale refuses wildcard', async () => {
    await expect(
      svc.setUserLocale({ userId: 'u1', tenantId: '*', localeId: 'en-US' }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });

  it('clearUserLocale removes the row', async () => {
    prisma.userLocalePreference.deleteMany.mockResolvedValue({ count: 1 });
    await svc.clearUserLocale({ userId: 'u1', tenantId: 'tenant-a' });
    expect(prisma.userLocalePreference.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', tenantId: 'tenant-a' },
    });
  });
});

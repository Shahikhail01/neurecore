/**
 * Localization — Service unit tests.
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LocalizationService } from './localization.service';
import { OOB_LOCALES } from './locale.registry';

describe('LocalizationService', () => {
  let svc: LocalizationService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    svc = new LocalizationService(prisma);
  });

  it('ships exactly 16 OOB locales', () => {
    expect(OOB_LOCALES.length).toBe(16);
  });

  it('every locale has all required fields', () => {
    for (const l of OOB_LOCALES) {
      expect(l.id).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(l.displayName.length).toBeGreaterThan(0);
      expect(typeof l.rtl).toBe('boolean');
      expect(l.bcp47).toBe(l.id);
      expect(l.currency.length).toBe(3);
    }
  });

  it('exactly 2 locales are RTL (ar, he)', () => {
    const rtl = OOB_LOCALES.filter((l) => l.rtl);
    expect(rtl.length).toBe(2);
    expect(rtl.map((l) => l.id).sort()).toEqual(['ar-SA', 'he-IL']);
  });

  it('resolveTenantLocale returns en-US by default', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ locale: null });
    const out = await svc.resolveTenantLocale('tenant-a');
    expect(out.id).toBe('en-US');
  });

  it('resolveTenantLocale honours tenant preference', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ locale: 'de-DE' });
    const out = await svc.resolveTenantLocale('tenant-a');
    expect(out.id).toBe('de-DE');
    expect(out.currency).toBe('EUR');
  });

  it('resolveTenantLocale refuses wildcard', async () => {
    await expect(svc.resolveTenantLocale('*')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('setTenantLocale refuses unknown locale', async () => {
    await expect(
      svc.setTenantLocale('tenant-a', 'xx-YY'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setTenantLocale updates the tenant row', async () => {
    prisma.tenant.update.mockResolvedValue({ locale: 'ja-JP' });
    const out = await svc.setTenantLocale('tenant-a', 'ja-JP');
    expect(out.id).toBe('ja-JP');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-a' },
      data: { locale: 'ja-JP' },
    });
  });

  it('setTenantLocale refuses wildcard', async () => {
    await expect(svc.setTenantLocale('*', 'en-US')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

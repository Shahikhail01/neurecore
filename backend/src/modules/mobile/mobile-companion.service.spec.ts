/**
 * Mobile Companion — Service unit tests.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MobileCompanionService } from './mobile-companion.service';

describe('MobileCompanionService', () => {
  let svc: MobileCompanionService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      channelConnection: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    svc = new MobileCompanionService(prisma);
  });

  it('registerDevice refuses wildcard tenant', async () => {
    await expect(
      svc.registerDevice({
        tenantId: '*',
        userId: 'u1',
        platform: 'ios',
        pushToken: 'apns-token-1234',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('registerDevice refuses missing pushToken', async () => {
    await expect(
      svc.registerDevice({
        tenantId: 'tenant-a',
        userId: 'u1',
        platform: 'ios',
        pushToken: '',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('registerDevice creates an MCP channel connection', async () => {
    prisma.channelConnection.create.mockResolvedValue({ id: 'd1' });
    const out = await svc.registerDevice({
      tenantId: 'tenant-a',
      userId: 'u1',
      platform: 'ios',
      pushToken: 'apns-token-1234',
      deviceModel: 'iPhone15,2',
      osVersion: '17.4',
      appVersion: '1.0.0',
    });
    expect(out.id).toBe('d1');
    expect(prisma.channelConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          kind: 'MCP',
          displayName: 'mobile:u1:ios',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('listDevices filters by tenant + user', async () => {
    prisma.channelConnection.findMany.mockResolvedValue([]);
    await svc.listDevices('tenant-a', 'u1');
    expect(prisma.channelConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          kind: 'MCP',
          displayName: { startsWith: 'mobile:u1:' },
        }),
      }),
    );
  });

  it('deregisterDevice refuses cross-tenant', async () => {
    prisma.channelConnection.findUnique.mockResolvedValue({
      id: 'd1',
      tenantId: 'tenant-b',
    });
    await expect(svc.deregisterDevice('tenant-a', 'd1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('deregisterDevice throws NotFound when missing', async () => {
    prisma.channelConnection.findUnique.mockResolvedValue(null);
    await expect(svc.deregisterDevice('tenant-a', 'd1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deregisterDevice disables the connection', async () => {
    prisma.channelConnection.findUnique.mockResolvedValue({
      id: 'd1',
      tenantId: 'tenant-a',
    });
    await svc.deregisterDevice('tenant-a', 'd1');
    expect(prisma.channelConnection.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'DISABLED' },
    });
  });
});

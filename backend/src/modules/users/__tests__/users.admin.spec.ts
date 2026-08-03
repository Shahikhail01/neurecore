/**
 * UsersService — platform-admin actions (SUPER_ADMIN).
 *
 * Covers:
 *   - adminResetPassword: rejects self, generates a strong temp password,
 *     hashes + persists, returns plaintext + reset timestamp
 *   - adminDeleteUser: rejects self, refuses to delete the last SUPER_ADMIN,
 *     deletes on a valid target
 *   - findTenantOwnerId: returns the earliest-created OWNER for a tenant
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { PasswordService } from '../../auth/services/password.service';
import { UserRole } from '@prisma/client';

interface MockUser {
  id: string;
  email: string;
  role: UserRole;
  passwordHash?: string | null;
}

function makeMockService(opts: {
  user?: MockUser | null;
  superAdminCount?: number;
  ownerForTenant?: string | null;
} = {}) {
  const user = opts.user ?? null;
  const superAdminCount = opts.superAdminCount ?? 1;
  const ownerForTenant = opts.ownerForTenant ?? null;

  const updateCalls: Array<{ id: string; data: Record<string, unknown> }> = [];
  const deleteCalls: string[] = [];

  const prismaMock = {
    user: {
      findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        if (user && args.where.id === user.id) return Promise.resolve(user);
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation(() => {
        if (ownerForTenant) return Promise.resolve({ id: ownerForTenant });
        return Promise.resolve(null);
      }),
      count: jest.fn().mockResolvedValue(superAdminCount),
      update: jest.fn().mockImplementation(
        (args: { where: { id: string }; data: Record<string, unknown> }) => {
          updateCalls.push({ id: args.where.id, data: args.data });
          return Promise.resolve({ id: args.where.id, ...args.data });
        },
      ),
      delete: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        deleteCalls.push(args.where.id);
        return Promise.resolve({ id: args.where.id });
      }),
    },
  };

  const passwordServiceMock = {
    hash: jest
      .fn()
      .mockImplementation(async (plain: string) => `hashed:${plain}`),
    compare: jest.fn().mockResolvedValue(true),
  } as unknown as PasswordService;

  const service = new UsersService(prismaMock as never, passwordServiceMock);

  return { service, prismaMock, updateCalls, deleteCalls };
}

describe('UsersService — admin reset password', () => {
  it('refuses to reset the requesting admin own password', async () => {
    const { service } = makeMockService({
      user: { id: 'self', email: 'self@x.io', role: UserRole.SUPER_ADMIN },
    });
    await expect(
      service.adminResetPassword('self', 'self'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound if the target user does not exist', async () => {
    const { service } = makeMockService({ user: null });
    await expect(
      service.adminResetPassword('missing', 'admin'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('generates a temp password, hashes it, persists, returns plaintext once', async () => {
    const { service, prismaMock, updateCalls } = makeMockService({
      user: { id: 'target', email: 'target@x.io', role: UserRole.OWNER },
    });
    const result = await service.adminResetPassword('target', 'admin');

    expect(result.userId).toBe('target');
    expect(result.email).toBe('target@x.io');
    expect(typeof result.temporaryPassword).toBe('string');
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(16);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].id).toBe('target');
    expect(updateCalls[0].data.passwordHash).toBe(
      `hashed:${result.temporaryPassword}`,
    );
    expect(updateCalls[0].data.passwordChangedAt).toBeInstanceOf(Date);

    // Each call must produce a fresh password.
    const r2 = await service.adminResetPassword('target', 'admin');
    expect(r2.temporaryPassword).not.toBe(result.temporaryPassword);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
  });
});

describe('UsersService — admin delete user', () => {
  it('refuses to delete self', async () => {
    const { service } = makeMockService({
      user: { id: 'self', email: 'self@x.io', role: UserRole.SUPER_ADMIN },
    });
    await expect(
      service.adminDeleteUser('self', 'self'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to delete the last remaining SUPER_ADMIN', async () => {
    const { service } = makeMockService({
      user: { id: 'only-admin', email: 'a@x.io', role: UserRole.SUPER_ADMIN },
      superAdminCount: 1,
    });
    await expect(
      service.adminDeleteUser('only-admin', 'other'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows deleting a non-SUPER_ADMIN', async () => {
    const { service, deleteCalls } = makeMockService({
      user: { id: 'u1', email: 'u1@x.io', role: UserRole.OWNER },
    });
    await service.adminDeleteUser('u1', 'admin');
    expect(deleteCalls).toEqual(['u1']);
  });

  it('allows deleting a SUPER_ADMIN when another super admin exists', async () => {
    const { service, deleteCalls } = makeMockService({
      user: { id: 'a1', email: 'a1@x.io', role: UserRole.SUPER_ADMIN },
      superAdminCount: 2,
    });
    await service.adminDeleteUser('a1', 'a2');
    expect(deleteCalls).toEqual(['a1']);
  });
});

describe('UsersService — findTenantOwnerId', () => {
  it('returns null when the tenant has no OWNER', async () => {
    const { service } = makeMockService({ ownerForTenant: null });
    expect(await service.findTenantOwnerId('t1')).toBeNull();
  });

  it('returns the OWNER id when one exists', async () => {
    const { service } = makeMockService({ ownerForTenant: 'owner-1' });
    expect(await service.findTenantOwnerId('t1')).toBe('owner-1');
  });
});

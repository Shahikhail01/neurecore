import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersController } from '../../src/modules/users/users.controller';

const mockUsersService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  changePassword: jest.fn(),
  deactivate: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UsersController(mockUsersService as any);
  });

  it('forces tenant-scoped user creation into the caller tenant with a non-platform role', async () => {
    mockUsersService.create.mockResolvedValue({ id: 'user-1' });

    await controller.create(
      {
        email: 'user@example.com',
        password: 'password123',
        firstName: 'Tenant',
        lastName: 'User',
      },
      {
        id: 'owner-1',
        sub: 'owner-1',
        jti: 'token-1',
        role: UserRole.OWNER,
        tenantId: 'tenant-1',
      } as any,
    );

    expect(mockUsersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        role: UserRole.USER,
      }),
    );
  });

  it('rejects tenant-scoped admins creating users for another tenant', async () => {
    expect(() =>
      controller.create(
        {
          email: 'user@example.com',
          password: 'password123',
          firstName: 'Tenant',
          lastName: 'User',
          tenantId: 'tenant-2',
        },
        {
          id: 'owner-1',
          sub: 'owner-1',
          jti: 'token-1',
          role: UserRole.OWNER,
          tenantId: 'tenant-1',
        } as any,
      ),
    ).toThrow(ForbiddenException);
    expect(mockUsersService.create).not.toHaveBeenCalled();
  });

  it('rejects tenant-scoped admins assigning platform roles', async () => {
    expect(() =>
      controller.create(
        {
          email: 'user@example.com',
          password: 'password123',
          firstName: 'Tenant',
          lastName: 'User',
          role: UserRole.PLATFORM_ADMIN,
        },
        {
          id: 'owner-1',
          sub: 'owner-1',
          jti: 'token-1',
          role: UserRole.OWNER,
          tenantId: 'tenant-1',
        } as any,
      ),
    ).toThrow(ForbiddenException);
    expect(mockUsersService.create).not.toHaveBeenCalled();
  });

  it('rejects non-admin users changing roles or activation state', async () => {
    expect(() =>
      controller.update('user-1', { role: UserRole.OWNER }, {
        id: 'user-1',
        sub: 'user-1',
        jti: 'token-1',
        role: UserRole.USER,
        tenantId: 'tenant-1',
      } as any),
    ).toThrow(ForbiddenException);
    expect(mockUsersService.update).not.toHaveBeenCalled();
  });

  it('preserves platform-wide tenant selection for platform auditors', async () => {
    mockUsersService.findAll.mockResolvedValue({ items: [], total: 0 });

    await controller.findAll(
      {
        id: 'security-1',
        sub: 'security-1',
        jti: 'token-1',
        role: UserRole.SECURITY_OFFICER,
        tenantId: null,
      } as any,
      'tenant-9',
      'alice',
      2,
      25,
    );

    expect(mockUsersService.findAll).toHaveBeenCalledWith(
      'tenant-9',
      2,
      25,
      'alice',
    );
  });
});

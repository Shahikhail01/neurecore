/**
 * MeProfileController — GET / PATCH /api/v1/me/profile
 * Verifies the self-service controller wires to User columns.
 */

import { MeProfileController } from '../me-profile.controller';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

describe('MeProfileController', () => {
  let controller: MeProfileController;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    controller = new MeProfileController(prismaMock);
  });

  const user: JwtPayload = {
    sub: 'user-1',
    email: 'jane@acme.com',
    role: 'OWNER' as never,
    tenantId: 'tenant-1',
    jti: 'token-1',
  };

  describe('GET /', () => {
    it('returns the user profile with notificationPrefs mapped', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@acme.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'OWNER',
        tenantId: 'tenant-1',
        departmentId: 'dept-X',
        phone: '+1-555-1234',
        jobTitle: 'CEO',
        timezone: 'UTC',
        locale: 'en-US',
        language: 'en',
        theme: 'dark',
        defaultLanding: '/home',
        railCollapsedDefault: false,
        notificationPrefsJson: { digestCadence: 'daily' },
        avatarUrl: null,
        isActive: true,
      });

      const result = await controller.get(user);
      expect(result).not.toBeNull();
      expect(result!.phone).toBe('+1-555-1234');
      expect(result!.primaryDepartmentId).toBe('dept-X');
      expect(result!.notificationPrefs).toEqual({ digestCadence: 'daily' });
    });

    it('returns null for unknown user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      const result = await controller.get(user);
      expect(result).toBeNull();
    });
  });

  describe('PATCH /', () => {
    it('maps primaryDepartmentId → departmentId column', async () => {
      prismaMock.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'jane@acme.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'OWNER',
        tenantId: 'tenant-1',
        departmentId: 'dept-Y',
        phone: null,
        jobTitle: 'CTO',
        timezone: null,
        locale: null,
        language: 'en',
        theme: 'dark',
        defaultLanding: '/home',
        railCollapsedDefault: false,
        notificationPrefsJson: null,
        avatarUrl: null,
      });

      await controller.update(
        {
          jobTitle: 'CTO',
          primaryDepartmentId: 'dept-Y',
        },
        user,
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            jobTitle: 'CTO',
            departmentId: 'dept-Y',
          }),
        }),
      );
    });

    it('persists notificationPrefs to notificationPrefsJson column', async () => {
      prismaMock.user.update.mockResolvedValue({
        id: 'user-1',
        departmentId: null,
        notificationPrefsJson: { digestCadence: 'weekly', theme: 'light' },
      });

      await controller.update(
        {
          notificationPrefs: {
            digestCadence: 'weekly',
            theme: 'light',
          },
        },
        user,
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notificationPrefsJson: { digestCadence: 'weekly', theme: 'light' },
          }),
        }),
      );
    });

    it('clears primaryDepartmentId when null is sent', async () => {
      prismaMock.user.update.mockResolvedValue({
        departmentId: null,
      });

      await controller.update(
        {
          primaryDepartmentId: null,
        },
        user,
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ departmentId: null }),
        }),
      );
    });
  });
});

import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PasswordService } from '../auth/services/password.service';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
} from './dto/user.dto';
import { UserRole, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async findAll(
    tenantId?: string,
    page = 1,
    limit = 20,
    search?: string,
    departmentId?: string,
  ) {
    const skip = (page - 1) * limit;

    const searchFilter: Prisma.UserWhereInput | undefined = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const where: Prisma.UserWhereInput = {};
    if (tenantId) where.tenantId = tenantId;
    if (departmentId) where.departmentId = departmentId;
    if (searchFilter) where.AND = [searchFilter];

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tenantId: true,
          departmentId: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string, tenantId?: string) {
    // CRITICAL: Filter by tenantId for tenant-level access
    const where: Prisma.UserWhereInput = { id };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    // CRITICAL: Check email per tenant (tenant isolation)
    const whereClause: Prisma.UserWhereInput = { email: dto.email };
    if (dto.tenantId) {
      whereClause.tenantId = dto.tenantId;
    } else {
      // For platform-level users, check globally
      whereClause.tenantId = null;
    }

    const existing = await this.prisma.user.findFirst({
      where: whereClause,
    });
    if (existing)
      throw new ConflictException('Email already registered in this tenant');

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role ?? UserRole.USER,
        tenantId: dto.tenantId ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
      },
    });

    this.logger.log(`User created: ${user.email}`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto, tenantId?: string) {
    // First verify the user exists with proper tenant isolation
    await this.findOne(id, tenantId);

    // Persist JSON fields as separate columns — DTO uses .notificationPrefs
    // but the underlying schema has notificationPrefsJson.
    const { notificationPrefs, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (notificationPrefs !== undefined) {
      data.notificationPrefsJson = notificationPrefs as never;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
        phone: true,
        jobTitle: true,
        timezone: true,
        locale: true,
        language: true,
        theme: true,
        defaultLanding: true,
        railCollapsedDefault: true,
        notificationPrefsJson: true,
      },
    });
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

const valid = await this.passwordService.compare(
      dto.currentPassword,
      user.passwordHash ?? '',
    );
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    this.logger.log(`Password changed for user: ${id}`);
    return { message: 'Password updated successfully' };
  }

async deactivate(id: string, tenantId?: string) {
    // First verify the user exists with proper tenant isolation
    await this.findOne(id, tenantId);

    // Build unique where clause
    const where: { id: string } = { id };

    return this.prisma.user.update({
      where,
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }

  /**
   * Phase 2 — assign a user to a department (tenant-scoped).
   * Verifies user belongs to tenant AND department belongs to same tenant.
   */
  async assignToDepartment(userId: string, departmentId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found in tenant`);

    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: { id: true },
    });
    if (!dept) throw new NotFoundException(`Department ${departmentId} not found in tenant`);

    return this.prisma.user.update({
      where: { id: userId },
      data: { departmentId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
      },
    });
  }

  /**
   * Phase 2 — unassign user from their current department.
   */
  async unassignFromDepartment(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found in tenant`);

    return this.prisma.user.update({
      where: { id: userId },
      data: { departmentId: null },
      select: { id: true, departmentId: true },
    });
  }

  // ─── Platform-admin actions (SUPER_ADMIN) ─────────────────────────────────

  /**
   * Generate a new random password, hash it, persist it, and return the
   * plaintext once. Refuses to target the requesting admin.
   */
  async adminResetPassword(
    userId: string,
    requestingUserId: string,
  ): Promise<{
    userId: string;
    email: string;
    temporaryPassword: string;
    resetAt: string;
  }> {
    if (userId === requestingUserId) {
      throw new BadRequestException(
        'Use the change-password endpoint to update your own password',
      );
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!target) throw new NotFoundException(`User ${userId} not found`);

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.passwordService.hash(temporaryPassword);
    const resetAt = new Date();

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: resetAt },
    });

    this.logger.warn(
      `SUPER_ADMIN password reset applied to user ${target.email} (${userId})`,
    );

    return {
      userId: target.id,
      email: target.email,
      temporaryPassword,
      resetAt: resetAt.toISOString(),
    };
  }

  /**
   * Hard-delete a user. Refuses to delete self and refuses to delete the
   * last remaining SUPER_ADMIN.
   */
  async adminDeleteUser(userId: string, requestingUserId: string): Promise<void> {
    if (userId === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!target) throw new NotFoundException(`User ${userId} not found`);

    if (target.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot delete the last remaining SUPER_ADMIN',
        );
      }
    }

    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.warn(
      `SUPER_ADMIN deleted user ${target.email} (${userId})`,
    );
  }

  /**
   * Read-only: Resolve the OWNER of a tenant (used by the admin tenant
   * drawer to support "reset tenant owner password" without a round-trip
   * to the FE).
   */
  async findTenantOwnerId(tenantId: string): Promise<string | null> {
    const owner = await this.prisma.user.findFirst({
      where: { tenantId, role: UserRole.OWNER },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return owner?.id ?? null;
  }

  private generateTemporaryPassword(): string {
    // 16 chars, URL-safe, no ambiguous chars (0/O, 1/l/I).
    const alphabet =
      'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = new Uint8Array(16);
    // crypto is available in Node 18+; safe-read from globalThis.
    const cryptoSrc =
      (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
        .crypto;
    if (cryptoSrc?.getRandomValues) {
      cryptoSrc.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }
}

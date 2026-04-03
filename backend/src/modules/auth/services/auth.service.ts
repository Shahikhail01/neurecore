import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import {
  IAuthService,
  RegisterInput,
  AuthResult,
  ValidatedUser,
  RequestMeta,
} from '../interfaces/auth.interface';
import { TokenPair } from '../interfaces/token.interface';
import { UserRole } from '@prisma/client';

// Single Responsibility: orchestrate registration, login and logout flows.
// Dependency Inversion: depends on abstractions (PrismaService, PasswordService, TokenService).
@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<ValidatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;

    const valid = await this.passwordService.compare(
      password,
      user.passwordHash,
    );
    if (!valid) return null;

    return this.toValidatedUser(user);
  }

  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    if (data.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: data.tenantId },
      });
      if (!tenant) throw new ForbiddenException('Tenant not found');
      if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
        throw new ForbiddenException('Tenant is not active');
      }
    }

    const passwordHash = await this.passwordService.hash(data.password);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName ?? '',
        role: data.role ?? UserRole.USER,
        tenantId: data.tenantId ?? null,
      },
    });

    const validated = this.toValidatedUser(user);
    const tokens = await this.tokenService.issueTokenPair(validated);

    this.logger.log(`User registered: ${user.email} role=${user.role}`);
    return { user: validated, tokens };
  }

  async login(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const validated = await this.validateUser(email, password);
    if (!validated) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.tokenService.issueTokenPair(validated);

    // Create session record
    await this.prisma.session.create({
      data: {
        userId: validated.id,
        tenantId: validated.tenantId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    });

    this.logger.log(`User logged in: ${email}`);
    return { user: validated, tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const validated = this.toValidatedUser(user);
    return this.tokenService.rotateRefreshToken(refreshToken, validated);
  }

  async logout(userId: string, jti: string): Promise<void> {
    // Blacklist current access token JTI so it cannot be reused
    await this.tokenService.revokeAccessToken(jti, 15 * 60); // 15 min safety window
    await this.tokenService.revokeAllRefreshTokens(userId);
    this.logger.log(`User logged out: ${userId}`);
  }

  private toValidatedUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string | null;
    isActive: boolean;
  }): ValidatedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive,
    };
  }
}

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  Get,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ValidatedUser } from '../interfaces/auth.interface';
import type { JwtPayload } from '../interfaces/token.interface';
import type { Request } from 'express';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      tenantId: dto.tenantId,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    this.logger.debug(`Login attempt: ${JSON.stringify(dto)}`);
    return this.authService.login(dto.email, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: ValidatedUser & { jti?: string }) {
    await this.authService.logout(user.id, user.jti ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: ValidatedUser) {
    // Enrich with tenant data so the frontend can display company name/logo
    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          industry: true,
          tier: {
            select: {
              id: true,
              name: true,
              slug: true,
              maxAgents: true,
              maxUsers: true,
            },
          },
        },
      });
      if (tenant) {
        return { ...user, tenant };
      }
    }
    return user;
  }

  /** Alias for /me — satisfies spec requirement for GET /auth/profile */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async profile(@CurrentUser() user: ValidatedUser) {
    return this.me(user);
  }
}

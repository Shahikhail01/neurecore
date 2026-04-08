import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { SecretProviderService } from '../../security/providers/secret.provider';
import { JwtPayload } from '../interfaces/token.interface';
import { ValidatedUser } from '../interfaces/auth.interface';

// Single Responsibility: validate JWT access tokens only.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly secrets: SecretProviderService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const secret = secrets.getJwtSecret(); // Throws if missing

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<ValidatedUser & Pick<JwtPayload, 'sub' | 'jti'>> {
    // Check token blacklist (logout/revocation)
    if (await this.redis.isTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Token revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Note: request.user is the merged “principal + token context”.
    // Controllers can use user.id OR user.sub interchangeably.
    return {
      sub: payload.sub,
      jti: payload.jti,
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

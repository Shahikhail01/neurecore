import { Module, Logger } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './controllers/auth.controller';
import { SsoController } from './controllers/sso.controller';
import { ScimController } from './controllers/scim.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { SsoConfigService } from './services/sso-config.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SecretProviderService } from '../security/providers/secret.provider';

const logger = new Logger('AuthModule');

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService, SecretProviderService],
      useFactory: (
        config: ConfigService,
        secrets: SecretProviderService,
      ): JwtModuleOptions => {
        const secret = secrets.getJwtSecret();

        // Validate JWT_SECRET is set and of sufficient length
        if (!secret || secret.length < 32) {
          const error = new Error(
            'CRITICAL: JWT_SECRET is missing or too short (minimum 32 characters). ' +
              'Please set JWT_SECRET in your environment file.',
          );
          logger.error(error.message);
          throw error;
        }

        return {
          secret,
          signOptions: {
            expiresIn: config.get<string>('JWT_ACCESS_EXPIRES', '15m') as any,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, SsoController, ScimController],
  providers: [
    AuthService,
    TokenService,
    SecretProviderService,
    PasswordService,
    SsoConfigService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}

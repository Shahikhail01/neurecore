/**
 * Onboarding Module
 * Provides tenant onboarding wizard functionality
 * Following SOLID principles with single responsibility per component
 */

import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { WorkspaceProvisioningModule } from '../workspace-provisioning/workspace-provisioning.module';
import { SecretProviderService } from '../security/providers/secret.provider';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (
        configService: ConfigService,
        secrets: SecretProviderService,
      ) => {
        const secret = secrets.getJwtSecret(); // Throws if JWT_SECRET is missing
        return {
          secret,
          signOptions: { expiresIn: '24h' },
        };
      },
      inject: [ConfigService, SecretProviderService],
    }),
    WorkspaceProvisioningModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}

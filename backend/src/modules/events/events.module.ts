import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { SecretProviderService } from '../security/providers/secret.provider';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService, SecretProviderService],
      useFactory: (config: ConfigService, secrets: SecretProviderService) => {
        const secret = secrets.getJwtSecret(); // Throws if JWT_SECRET is missing
        return {
          secret,
        };
      },
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}

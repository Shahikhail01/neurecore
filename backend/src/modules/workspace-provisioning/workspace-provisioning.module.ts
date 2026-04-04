/**
 * WorkspaceProvisioningModule
 * Wires all providers, services, and controller for workspace auto-provisioning.
 *
 * SOLID — Open/Closed:
 * Adding a new provider only requires updating the PROVISIONING_PROVIDERS factory;
 * zero changes to the orchestrator or any other existing class.
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PROVISIONING_PROVIDERS } from './provisioning.tokens';
import { GoogleWorkspaceProvider } from './providers/google-workspace.provider';
import { Microsoft365Provider } from './providers/microsoft-365.provider';
import { ProvisioningJobService } from './services/provisioning-job.service';
import { ProvisioningOrchestratorService } from './services/provisioning-orchestrator.service';
import { WorkspaceProvisioningController } from './controllers/workspace-provisioning.controller';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [WorkspaceProvisioningController],
  providers: [
    // Individual provider classes — injectable so ConfigService works inside them
    GoogleWorkspaceProvider,
    Microsoft365Provider,

    // Array token — orchestrator receives all providers without knowing their types
    {
      provide: PROVISIONING_PROVIDERS,
      inject: [GoogleWorkspaceProvider, Microsoft365Provider, ConfigService],
      useFactory: (
        google: GoogleWorkspaceProvider,
        microsoft: Microsoft365Provider,
      ) => [google, microsoft],
    },

    ProvisioningJobService,
    ProvisioningOrchestratorService,
  ],
  exports: [ProvisioningJobService, ProvisioningOrchestratorService],
})
export class WorkspaceProvisioningModule {}

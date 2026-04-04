/**
 * ProvisioningOrchestratorService — Open/Closed + Dependency Inversion.
 * Depends on IProvisioningProvider[] injected via the PROVISIONING_PROVIDERS token.
 * Adding a new provider (e.g. Okta) requires zero changes here — just register it
 * in the module factory and implement IProvisioningProvider.
 */
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PROVISIONING_PROVIDERS } from '../provisioning.tokens';
import { IProvisioningProvider } from '../interfaces/provisioning-provider.interface';
import { ProvisioningJobService } from './provisioning-job.service';
import type { ProvisioningConfig } from '@prisma/client';

@Injectable()
export class ProvisioningOrchestratorService {
  private readonly logger = new Logger(ProvisioningOrchestratorService.name);

  constructor(
    @Inject(PROVISIONING_PROVIDERS)
    private readonly providers: IProvisioningProvider[],
    private readonly jobService: ProvisioningJobService,
    private readonly config: ConfigService,
  ) {}

  // ─── Provider resolution ─────────────────────────────────────────────────

  getProvider(providerId: string): IProvisioningProvider {
    const provider = this.providers.find((p) => p.providerId === providerId);
    if (!provider) {
      throw new NotFoundException(
        `Provisioning provider not found: ${providerId}`,
      );
    }
    return provider;
  }

  // ─── Auth URL generation ─────────────────────────────────────────────────

  getAuthUrl(providerId: string, tenantId: string): string {
    const provider = this.getProvider(providerId);
    const redirectUri = this.buildRedirectUri(providerId);
    return provider.generateAuthUrl(tenantId, redirectUri);
  }

  // ─── OAuth callback ───────────────────────────────────────────────────────

  async handleOAuthCallback(
    providerId: string,
    tenantId: string,
    code: string,
  ): Promise<ProvisioningConfig> {
    const provider = this.getProvider(providerId);
    const redirectUri = this.buildRedirectUri(providerId);
    const tokens = await provider.exchangeCodeForTokens(code, redirectUri);
    return this.jobService.updateConfigOAuth(tenantId, tokens);
  }

  // ─── Provisioning trigger ─────────────────────────────────────────────────

  async triggerProvisioning(tenantId: string): Promise<{ queued: number }> {
    const configRecord = await this.jobService.getConfigByTenantId(tenantId);
    if (!configRecord) {
      throw new NotFoundException('No provisioning config found for tenant');
    }
    if (configRecord.status !== 'CONNECTED') {
      throw new BadRequestException(
        'Admin account not yet connected. Complete OAuth setup first.',
      );
    }

    const pendingJobs = await this.jobService.getPendingJobs(configRecord.id);
    if (pendingJobs.length === 0) {
      return { queued: 0 };
    }

    const provider = this.getProvider(configRecord.provider);
    const tokens = {
      accessToken: configRecord.oauthAccessToken ?? '',
      refreshToken: configRecord.oauthRefreshToken ?? '',
      expiresAt: configRecord.oauthExpiresAt ?? new Date(Date.now() + 3600_000),
    };

    // Update status to IN_PROGRESS
    await this.jobService.updateConfigStatus(configRecord.id, 'IN_PROGRESS');

    let _completedCount = 0;

    // Process each job sequentially to avoid rate-limit issues
    for (const job of pendingJobs) {
      try {
        const result = await provider.provisionUser(tokens, {
          firstName: job.inviteeFirstName,
          lastName: job.inviteeLastName,
          emailDomain: configRecord.emailDomain,
          emailPattern: configRecord.emailPattern,
          folderStructure: configRecord.folderStructure,
          departmentName: job.departmentName ?? undefined,
        });
        await this.jobService.markJobComplete(
          job.id,
          result.corporateEmail,
          result.folderId,
        );
        _completedCount++;
        this.logger.log(
          `Provisioned user ${result.corporateEmail} (job: ${job.id})`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await this.jobService.markJobFailed(job.id, message);
        this.logger.error(`Failed to provision job ${job.id}: ${message}`);
      }
    }

    // Mark config completed if all jobs finished
    const remaining = await this.jobService.getPendingJobs(configRecord.id);
    if (remaining.length === 0) {
      await this.jobService.updateConfigStatus(configRecord.id, 'COMPLETED');
    } else {
      await this.jobService.updateConfigStatus(configRecord.id, 'CONNECTED');
    }

    return { queued: pendingJobs.length };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private buildRedirectUri(providerId: string): string {
    const baseUrl =
      this.config.get<string>('API_BASE_URL') ?? 'http://localhost:3000';
    const slug = providerId === 'GOOGLE_WORKSPACE' ? 'google' : 'microsoft';
    return `${baseUrl}/api/v1/workspace-provisioning/oauth/${slug}/callback`;
  }
}

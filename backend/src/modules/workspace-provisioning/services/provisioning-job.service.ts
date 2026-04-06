/**
 * ProvisioningJobService — Single Responsibility.
 * Owns all CRUD operations for ProvisioningConfig and ProvisioningJob records.
 * No business logic about which provider to use — that lives in the orchestrator.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ProvisioningConfig, ProvisioningJob } from '@prisma/client';

export interface CreateProvisioningConfigInput {
  tenantId: string;
  provider: string;
  emailDomain: string;
  emailPattern: string;
  folderStructure: string;
}

export interface CreateProvisioningJobInput {
  configId: string;
  inviteeEmail: string;
  inviteeFirstName: string;
  inviteeLastName: string;
  departmentName?: string;
}

export interface ProvisioningStatusDto {
  hasPendingSetup: boolean;
  provider: string | null;
  status: string | null;
  pendingCount: number;
}

@Injectable()
export class ProvisioningJobService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Config ───────────────────────────────────────────────────────────────

  async upsertConfig(
    input: CreateProvisioningConfigInput,
  ): Promise<ProvisioningConfig> {
    return this.prisma.provisioningConfig.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        provider: input.provider as never,
        emailDomain: input.emailDomain,
        emailPattern: input.emailPattern as never,
        folderStructure: input.folderStructure as never,
        status: 'PENDING_CONNECT',
      },
      update: {
        provider: input.provider as never,
        emailDomain: input.emailDomain,
        emailPattern: input.emailPattern as never,
        folderStructure: input.folderStructure as never,
      },
    });
  }

  async getConfigByTenantId(
    tenantId: string,
  ): Promise<ProvisioningConfig | null> {
    return this.prisma.provisioningConfig.findUnique({
      where: { tenantId },
    });
  }

  async updateConfigOAuth(
    tenantId: string,
    tokens: { accessToken: string; refreshToken: string; expiresAt: Date },
  ): Promise<ProvisioningConfig> {
    const config = await this.getConfigByTenantId(tenantId);
    if (!config) throw new NotFoundException('Provisioning config not found');

    return this.prisma.provisioningConfig.update({
      where: { id: config.id },
      data: {
        // TODO(security): encrypt with AES-256-GCM using ENCRYPTION_KEY env var before production
        oauthAccessToken: tokens.accessToken,
        oauthRefreshToken: tokens.refreshToken,
        oauthExpiresAt: tokens.expiresAt,
        status: 'CONNECTED',
      },
    });
  }

  async updateConfigStatus(
    id: string,
    status: string,
  ): Promise<ProvisioningConfig> {
    return this.prisma.provisioningConfig.update({
      where: { id },
      data: { status: status as never },
    });
  }

  async getPendingStatus(tenantId: string): Promise<ProvisioningStatusDto> {
    const config = await this.getConfigByTenantId(tenantId);
    if (!config) {
      return {
        hasPendingSetup: false,
        provider: null,
        status: null,
        pendingCount: 0,
      };
    }

    const pendingCount = await this.prisma.provisioningJob.count({
      where: { configId: config.id, status: 'PENDING' },
    });

    const hasPendingSetup =
      config.status === 'PENDING_CONNECT' || config.status === 'CONNECTED';

    return {
      hasPendingSetup,
      provider: config.provider,
      status: config.status,
      pendingCount,
    };
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────────

  async createManyJobs(inputs: CreateProvisioningJobInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.prisma.provisioningJob.createMany({
      data: inputs as never,
      skipDuplicates: true,
    });
  }

  async listJobs(tenantId: string): Promise<ProvisioningJob[]> {
    const config = await this.getConfigByTenantId(tenantId);
    if (!config) return [];
    return this.prisma.provisioningJob.findMany({
      where: { configId: config.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPendingJobs(configId: string): Promise<ProvisioningJob[]> {
    return this.prisma.provisioningJob.findMany({
      where: { configId, status: 'PENDING' },
    });
  }

  async markJobComplete(
    id: string,
    provisionedEmail: string,
    provisionedFolderId: string,
  ): Promise<void> {
    await this.prisma.provisioningJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        provisionedEmail,
        provisionedFolderId,
        provisionedAt: new Date(),
      },
    });
  }

  async markJobFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.provisioningJob.update({
      where: { id },
      data: { status: 'FAILED', errorMessage },
    });
  }

  // ─── OAuth disconnect ──────────────────────────────────────────────────────

  /**
   * Clears stored OAuth tokens and resets status to PENDING_CONNECT.
   * The provisioning config itself is preserved so it can be re-connected.
   */
  async disconnectOAuth(tenantId: string): Promise<void> {
    const config = await this.getConfigByTenantId(tenantId);
    if (!config) return;
    await this.prisma.provisioningConfig.update({
      where: { id: config.id },
      data: {
        oauthAccessToken: null,
        oauthRefreshToken: null,
        oauthExpiresAt: null,
        status: 'PENDING_CONNECT',
      },
    });
  }
}

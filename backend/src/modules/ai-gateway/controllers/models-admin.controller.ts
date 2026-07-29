/**
 * Admin Models Controller
 *
 * CRUD over the AI Gateway catalog (`ModelProvider`, `AiModel`,
 * `TenantModelOverride`) for SuperAdmin. Every mutation writes a
 * `ModelCatalogAudit` row and invalidates `AiModelRepository` so the
 * changes propagate to running gateway calls within the cache TTL.
 *
 * SOLID: SRP — this controller is a thin HTTP layer over the Prisma
 * client. All business rules live in the services it delegates to.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AiModelRepository } from '../selection/ai-model.repository';
import { CryptoService } from '../../connectors/services/crypto.service';

interface CreateProviderBody {
  slug: string;
  name: string;
  apiBaseUrl: string;
  apiKeyEnv: string;
  encryptedKey?: string;
  isActive?: boolean;
}

interface CreateModelBody {
  providerId: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow?: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  priority?: number;
  isDefault?: boolean;
  isAvailable?: boolean;
}

interface ToggleModelBody {
  isAvailable?: boolean;
  isDefault?: boolean;
  capabilities?: string[];
}

interface UpsertOverrideBody {
  capability: string;
  aiModelId: string;
  priority?: number;
}

@Controller({ path: 'admin/models', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class ModelsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AiModelRepository,
    private readonly crypto: CryptoService,
  ) {}

  @Get('providers')
  async listProviders() {
    const rows = await this.prisma.modelProvider.findMany({
      orderBy: { name: 'asc' },
      include: { models: { select: { id: true, modelId: true } } },
    });
    return rows.map((r) => ({
      ...r,
      encryptedKey: r.encryptedKey ? '[redacted]' : null,
      hasKey: !!r.encryptedKey,
    }));
  }

  @Post('providers')
  async createProvider(
    @Body() body: CreateProviderBody,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.prisma.modelProvider.create({
      data: {
        slug: body.slug,
        name: body.name,
        apiBaseUrl: body.apiBaseUrl,
        apiKeyEnv: body.apiKeyEnv,
        encryptedKey: body.encryptedKey ? this.crypto.encrypt(body.encryptedKey) : null,
        isActive: body.isActive ?? true,
      },
    });
    await this.writeAudit(
      user.id,
      'create',
      'ModelProvider',
      created.id,
      null,
      { ...created, encryptedKey: created.encryptedKey ? '[redacted]' : null },
    );
    this.repo.invalidate();
    return { ...created, encryptedKey: created.encryptedKey ? '[redacted]' : null };
  }

  @Patch('providers/:id')
  async updateProvider(
    @Param('id') id: string,
    @Body() body: Partial<CreateProviderBody>,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.modelProvider.findUnique({
      where: { id },
    });
    const data = this.pickUpdatable(body);
    if (body.encryptedKey === '') {
      (data as Prisma.ModelProviderUpdateInput).encryptedKey = null;
    } else if (body.encryptedKey) {
      (data as Prisma.ModelProviderUpdateInput).encryptedKey = this.crypto.encrypt(body.encryptedKey);
    }
    const updated = await this.prisma.modelProvider.update({
      where: { id },
      data,
    });
    await this.writeAudit(
      user.id,
      'update',
      'ModelProvider',
      id,
      { ...before, encryptedKey: before?.encryptedKey ? '[redacted]' : null },
      { ...updated, encryptedKey: updated.encryptedKey ? '[redacted]' : null },
    );
    this.repo.invalidate();
    return { ...updated, encryptedKey: updated.encryptedKey ? '[redacted]' : null };
  }

  @Get()
  async listModels() {
    return this.prisma.aiModel.findMany({
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
      include: { provider: { select: { id: true, slug: true, name: true } } },
    });
  }

  @Post()
  async createModel(
    @Body() body: CreateModelBody,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.prisma.aiModel.create({
      data: {
        providerId: body.providerId,
        modelId: body.modelId,
        displayName: body.displayName,
        capabilities: body.capabilities,
        contextWindow: body.contextWindow ?? 8192,
        costPer1kInput: new Prisma.Decimal(body.costPer1kInput ?? 0),
        costPer1kOutput: new Prisma.Decimal(body.costPer1kOutput ?? 0),
        priority: body.priority ?? 100,
        isDefault: body.isDefault ?? false,
        isAvailable: body.isAvailable ?? true,
      },
    });
    await this.writeAudit(
      user.id,
      'create',
      'AiModel',
      created.id,
      null,
      created,
    );
    this.repo.invalidate();
    return created;
  }

  @Patch(':id')
  async updateModel(
    @Param('id') id: string,
    @Body() body: ToggleModelBody,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.aiModel.findUnique({ where: { id } });
    const updated = await this.prisma.aiModel.update({
      where: { id },
      data: {
        ...(body.isAvailable !== undefined
          ? { isAvailable: body.isAvailable }
          : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        ...(body.capabilities ? { capabilities: body.capabilities } : {}),
      },
    });
    await this.writeAudit(user.id, 'update', 'AiModel', id, before, updated);
    this.repo.invalidate();
    return updated;
  }

  @Post('tenants/:tenantId/overrides')
  async upsertOverride(
    @Param('tenantId') tenantId: string,
    @Body() body: UpsertOverrideBody,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.tenantModelOverride.findUnique({
      where: { tenantId_capability: { tenantId, capability: body.capability } },
    });
    const override = await this.prisma.tenantModelOverride.upsert({
      where: { tenantId_capability: { tenantId, capability: body.capability } },
      create: {
        tenantId,
        capability: body.capability,
        aiModelId: body.aiModelId,
        priority: body.priority ?? 100,
      },
      update: {
        aiModelId: body.aiModelId,
        priority: body.priority ?? 100,
      },
    });
    await this.writeAudit(
      user.id,
      before ? 'update' : 'create',
      'TenantModelOverride',
      override.id,
      before,
      override,
    );
    this.repo.invalidate();
    return override;
  }

  @Delete('tenants/:tenantId/overrides/:id')
  async deleteOverride(
    @Param('tenantId') _tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.tenantModelOverride.findUnique({
      where: { id },
    });
    await this.prisma.tenantModelOverride.delete({ where: { id } });
    await this.writeAudit(
      user.id,
      'delete',
      'TenantModelOverride',
      id,
      before,
      null,
    );
    this.repo.invalidate();
    return { ok: true, tenantId: _tenantId };
  }

  private pickUpdatable(
    body: Partial<CreateProviderBody>,
  ): Prisma.ModelProviderUpdateInput {
    return {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.apiBaseUrl !== undefined ? { apiBaseUrl: body.apiBaseUrl } : {}),
      ...(body.apiKeyEnv !== undefined ? { apiKeyEnv: body.apiKeyEnv } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    };
  }

  private async writeAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const sanitise = (v: unknown): Prisma.InputJsonValue => {
      if (v === null || v === undefined) return undefined as unknown as Prisma.InputJsonValue;
      return JSON.parse(JSON.stringify(v));
    };
    await this.prisma.modelCatalogAudit.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        before: sanitise(before),
        after: sanitise(after),
      },
    });
  }
}

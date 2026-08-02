// src/modules/tenant-flags/tenant-flags.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export enum FeatureFlag {
  CANONICAL_INITIATION = 'CANONICAL_INITIATION',
  DURABLE_AUTOMATION = 'DURABLE_AUTOMATION',
  AUTO_ASSIGNMENT = 'AUTO_ASSIGNMENT',
  AUTONOMOUS_EXECUTION = 'AUTONOMOUS_EXECUTION',
  HUMAN_REVIEW_WORKFLOW = 'HUMAN_REVIEW_WORKFLOW',
  NEW_LIFECYCLE_GUARDS = 'NEW_LIFECYCLE_GUARDS',
  NEW_TIMELINE = 'NEW_TIMELINE',
  SERVICE_GATEWAY = 'SERVICE_GATEWAY',
}

interface FlagConfig {
  key: FeatureFlag;
  defaultValue: boolean;
  killSwitch: boolean;
}

@Injectable()
export class TenantFlagsService {
  private readonly logger = new Logger(TenantFlagsService.name);
  private readonly flags: Record<FeatureFlag, FlagConfig> = {
    [FeatureFlag.CANONICAL_INITIATION]: {
      key: FeatureFlag.CANONICAL_INITIATION,
      defaultValue: false,
      killSwitch: false,
    },
    [FeatureFlag.DURABLE_AUTOMATION]: {
      key: FeatureFlag.DURABLE_AUTOMATION,
      defaultValue: false,
      killSwitch: false,
    },
    [FeatureFlag.AUTO_ASSIGNMENT]: {
      key: FeatureFlag.AUTO_ASSIGNMENT,
      defaultValue: false,
      killSwitch: false,
    },
    [FeatureFlag.AUTONOMOUS_EXECUTION]: {
      key: FeatureFlag.AUTONOMOUS_EXECUTION,
      defaultValue: false,
      killSwitch: false,
    },
    [FeatureFlag.HUMAN_REVIEW_WORKFLOW]: {
      key: FeatureFlag.HUMAN_REVIEW_WORKFLOW,
      defaultValue: false,
      killSwitch: false,
    },
    [FeatureFlag.NEW_LIFECYCLE_GUARDS]: {
      key: FeatureFlag.NEW_LIFECYCLE_GUARDS,
      defaultValue: false,
      killSwitch: false,
    },
    [FeatureFlag.NEW_TIMELINE]: {
      key: FeatureFlag.NEW_TIMELINE,
      defaultValue: false,
      killSwitch: false,
    },
    [FeatureFlag.SERVICE_GATEWAY]: {
      key: FeatureFlag.SERVICE_GATEWAY,
      defaultValue: false,
      killSwitch: false,
    },
  };

  private cache: Map<string, { value: boolean; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 30000;

  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(flag: FeatureFlag, tenantId: string): Promise<boolean> {
    if (this.flags[flag].killSwitch) {
      return false;
    }

    const cacheKey = `${tenantId}:${flag}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const override = await this.prisma.tenantFeatureFlagOverride.findUnique({
      where: {
        tenantId_flagKey: {
          tenantId,
          flagKey: flag,
        },
      },
    });

    const result = override?.enabled ?? this.flags[flag].defaultValue;
    this.cache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
    return result;
  }

  async setOverride(
    flag: FeatureFlag,
    tenantId: string,
    enabled: boolean,
    actorId: string,
  ): Promise<void> {
    const existing = await this.prisma.tenantFeatureFlagOverride.findUnique({
      where: {
        tenantId_flagKey: {
          tenantId,
          flagKey: flag,
        },
      },
    });

    const oldValue = existing?.enabled ?? null;

    await this.prisma.tenantFeatureFlagOverride.upsert({
      where: {
        tenantId_flagKey: {
          tenantId,
          flagKey: flag,
        },
      },
      create: {
        tenantId,
        flagKey: flag,
        enabled,
        setByActorId: actorId,
        version: 1,
      },
      update: {
        enabled,
        setByActorId: actorId,
        version: { increment: 1 },
      },
    });

    await this.prisma.featureFlagAuditLog.create({
      data: {
        tenantId,
        flagKey: flag,
        action: existing ? 'OVERRIDE_UPDATED' : 'OVERRIDE_CREATED',
        actorId,
        oldValue,
        newValue: enabled,
      },
    });

    this.cache.delete(`${tenantId}:${flag}`);
  }

  async invalidateCache(tenantId?: string): Promise<void> {
    if (tenantId) {
      for (const flag of Object.values(FeatureFlag)) {
        this.cache.delete(`${tenantId}:${flag}`);
      }
    } else {
      this.cache.clear();
    }
  }

  getDefinedFlags(): FeatureFlag[] {
    return Object.values(FeatureFlag);
  }
}

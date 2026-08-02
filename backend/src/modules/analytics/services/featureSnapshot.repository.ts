import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface RecordSnapshotInput {
  tenantId: string;
  subjectType: string;
  subjectId: string;
  featuresJson: Record<string, unknown>;
  modelId?: string | null;
  modelVersion?: string | null;
}

export interface FeatureSnapshotRow {
  id: string;
  tenantId: string;
  subjectType: string;
  subjectId: string;
  featuresJson: Record<string, unknown>;
  modelId: string | null;
  modelVersion: string | null;
  snapshotHash: string;
  recordedAt: Date;
}

@Injectable()
export class FeatureSnapshotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordSnapshot(
    input: RecordSnapshotInput,
  ): Promise<FeatureSnapshotRow> {
    const snapshotHash = this.hash(input.featuresJson);
    const row = await this.prisma.featureSnapshot.create({
      data: {
        tenantId: input.tenantId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        featuresJson: input.featuresJson as Prisma.InputJsonValue,
        modelId: input.modelId ?? null,
        modelVersion: input.modelVersion ?? null,
        snapshotHash,
      },
    });
    return this.toRow(row);
  }

  async listRecent(
    tenantId: string,
    subjectType: string,
    subjectId: string,
    limit = 10,
  ): Promise<FeatureSnapshotRow[]> {
    const rows = await this.prisma.featureSnapshot.findMany({
      where: { tenantId, subjectType, subjectId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => this.toRow(r));
  }

  async getLatest(
    tenantId: string,
    subjectType: string,
    subjectId: string,
  ): Promise<FeatureSnapshotRow | null> {
    const row = await this.prisma.featureSnapshot.findFirst({
      where: { tenantId, subjectType, subjectId },
      orderBy: { recordedAt: 'desc' },
    });
    return row ? this.toRow(row) : null;
  }

  private toRow(r: {
    id: string;
    tenantId: string;
    subjectType: string;
    subjectId: string;
    featuresJson: unknown;
    modelId: string | null;
    modelVersion: string | null;
    snapshotHash: string;
    recordedAt: Date;
  }): FeatureSnapshotRow {
    return {
      id: r.id,
      tenantId: r.tenantId,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      featuresJson: (r.featuresJson ?? {}) as Record<string, unknown>,
      modelId: r.modelId,
      modelVersion: r.modelVersion,
      snapshotHash: r.snapshotHash,
      recordedAt: r.recordedAt,
    };
  }

  private hash(features: Record<string, unknown>): string {
    const canonical = JSON.stringify(features, Object.keys(features).sort());
    let h = 5381;
    for (let i = 0; i < canonical.length; i++) {
      h = ((h << 5) + h) ^ canonical.charCodeAt(i);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

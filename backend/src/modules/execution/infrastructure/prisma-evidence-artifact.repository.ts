/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CreateEvidenceArtifactInput {
  tenantId: string;
  taskId: string;
  executionAttemptId: string;
  artifactType: 'DRAFT' | 'REPORT' | 'DOCUMENT' | 'DATA' | 'OUTPUT';
  storageRef: string;
  mimeType: string;
  checksum: string;
  source: 'AI_GENERATED' | 'HUMAN_PROVIDED' | 'SYSTEM_DERIVED';
  createdByActorId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PrismaEvidenceArtifactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateEvidenceArtifactInput,
    tx?: PrismaService | Prisma.TransactionClient,
  ) {
    const client = (tx ?? this.prisma) as PrismaClient;
    return client.evidenceArtifact.create({
      data: {
        ...input,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}

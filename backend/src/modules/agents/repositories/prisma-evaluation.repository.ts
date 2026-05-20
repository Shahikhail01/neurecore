import { Injectable } from '@nestjs/common';
import { EvaluationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IEvaluationRepository,
  CreateEvaluationInput,
  EvaluationRunRecord,
  TestResult,
} from '../interfaces/evaluation.interface';

/**
 * PrismaEvaluationRepository
 * SRP: persistence only — no business logic.
 * DIP: bound via interface IEvaluationRepository.
 */
@Injectable()
export class PrismaEvaluationRepository implements IEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateEvaluationInput): Promise<EvaluationRunRecord> {
    const record = await this.prisma.evaluationRun.create({
      data: {
        agentId: input.agentId,
        tenantId: input.tenantId,
        testCases: input.testCases as object[],
        runBy: input.runBy,
        notes: input.notes,
      },
    });
    return this.toRecord(record);
  }

  async findById(id: string): Promise<EvaluationRunRecord | null> {
    const record = await this.prisma.evaluationRun.findUnique({
      where: { id },
    });
    return record ? this.toRecord(record) : null;
  }

  async findByIdAndTenant(
    id: string,
    tenantId: string,
  ): Promise<EvaluationRunRecord | null> {
    const record = await this.prisma.evaluationRun.findFirst({
      where: { id, tenantId },
    });
    return record ? this.toRecord(record) : null;
  }

  async findByAgent(
    agentId: string,
    tenantId: string,
  ): Promise<EvaluationRunRecord[]> {
    const records = await this.prisma.evaluationRun.findMany({
      where: { agentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toRecord(r));
  }

  async updateStatus(
    id: string,
    status: EvaluationStatus,
    results: TestResult[],
    scoreOverall: number,
  ): Promise<EvaluationRunRecord> {
    const record = await this.prisma.evaluationRun.update({
      where: { id },
      data: {
        status,
        results: results as object[],
        scoreOverall,
      },
    });
    return this.toRecord(record);
  }

  private toRecord(raw: {
    id: string;
    agentId: string;
    tenantId: string;
    status: EvaluationStatus;
    testCases: unknown;
    results: unknown;
    scoreOverall: unknown;
    runBy: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): EvaluationRunRecord {
    return {
      id: raw.id,
      agentId: raw.agentId,
      tenantId: raw.tenantId,
      status: raw.status,
      testCases: (raw.testCases as EvaluationRunRecord['testCases']) ?? [],
      results: raw.results as EvaluationRunRecord['results'],
      scoreOverall: raw.scoreOverall ? Number(raw.scoreOverall) : null,
      runBy: raw.runBy,
      notes: raw.notes,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}

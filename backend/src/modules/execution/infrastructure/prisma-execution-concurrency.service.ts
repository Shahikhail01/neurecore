/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExecutionAttemptEntity } from '../domain/ports/execution-attempt-repository.port';

@Injectable()
export class ExecutionConcurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(
    tenantId: string,
    agentId: string,
    attemptId: string,
    leaseMs: number,
    tenantLimit = 5,
    agentLimit = 1,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.executionConcurrencyReservation.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      const [tenantCount, agentCount] = await Promise.all([
        tx.executionConcurrencyReservation.count({ where: { tenantId } }),
        tx.executionConcurrencyReservation.count({
          where: { tenantId, agentId },
        }),
      ]);
      if (tenantCount >= tenantLimit)
        throw new Error('TENANT_CONCURRENCY_LIMIT');
      if (agentCount >= agentLimit) throw new Error('AGENT_CONCURRENCY_LIMIT');
      await tx.executionConcurrencyReservation.upsert({
        where: { attemptId },
        create: {
          tenantId,
          agentId,
          attemptId,
          expiresAt: new Date(now.getTime() + leaseMs),
        },
        update: { expiresAt: new Date(now.getTime() + leaseMs) },
      });
    });
  }

  async renew(attemptId: string, leaseMs: number): Promise<void> {
    await this.prisma.executionConcurrencyReservation.update({
      where: { attemptId },
      data: { expiresAt: new Date(Date.now() + leaseMs) },
    });
  }

  async release(attemptId: string): Promise<void> {
    await this.prisma.executionConcurrencyReservation.deleteMany({
      where: { attemptId },
    });
  }

  async releaseForAttempts(attempts: ExecutionAttemptEntity[]): Promise<void> {
    const ids = attempts.map((a) => a.id);
    if (ids.length > 0) {
      await this.prisma.executionConcurrencyReservation.deleteMany({
        where: { attemptId: { in: ids } },
      });
    }
  }
}

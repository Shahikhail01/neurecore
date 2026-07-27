/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IExecutionAttemptRepository } from '../domain/ports/execution-attempt-repository.port';
import { EXECUTION_ATTEMPT_REPOSITORY } from '../domain/ports/execution-attempt-repository.port';
import { ExecutionConcurrencyService } from './prisma-execution-concurrency.service';

@Injectable()
export class ExecutionSweeper {
  private readonly logger = new Logger(ExecutionSweeper.name);
  private readonly staleThresholdMs = 120000;
  private readonly sweepIntervalMs = 60000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(EXECUTION_ATTEMPT_REPOSITORY)
    private readonly attemptRepo: IExecutionAttemptRepository,
    private readonly concurrency: ExecutionConcurrencyService,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.sweep().catch((error: unknown) =>
        this.logger.error(
          `Execution sweeper failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }, this.sweepIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async sweep(): Promise<number> {
    const cutoff = new Date(Date.now() - this.staleThresholdMs);
    const stale = await this.attemptRepo.findStaleAttempts(cutoff);
    if (stale.length === 0) return 0;
    let recovered = 0;
    for (const attempt of stale) {
      const ok = await this.attemptRepo.reclaimOrphan(
        attempt.tenantId,
        attempt.id,
        attempt.fencingToken,
        'FAILED_RETRYABLE',
        'STALE_LEASE_RECOVERED_BY_SWEEPER',
      );
      if (ok) {
        await this.concurrency.release(attempt.id);
        recovered += 1;
      }
    }
    return recovered;
  }
}

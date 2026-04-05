import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface SupervisedWorkflowResult {
  supervisorId: string;
  workerIds: string[];
  goalDescription: string;
  status: 'started';
  message: string;
}

/**
 * MultiAgentOrchestratorService
 * SRP: coordinates supervisor → worker agent delegation only.
 * OCP: worker execution strategy can be swapped by extending, not modifying.
 */
@Injectable()
export class MultiAgentOrchestratorService {
  private readonly logger = new Logger(MultiAgentOrchestratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Launch a supervised multi-agent workflow:
   * 1. Validate supervisor and all workers belong to the tenant.
   * 2. Assign supervisorId to each worker agent.
   * 3. Return the assembled team descriptor — actual task execution is
   *    dispatched via the agents module (fire-and-forget extension point).
   */
  async startSupervisedWorkflow(
    supervisorId: string,
    workerIds: string[],
    goalDescription: string,
    tenantId: string,
  ): Promise<SupervisedWorkflowResult> {
    // 1. Validate supervisor
    const supervisor = await this.prisma.agent.findFirst({
      where: { id: supervisorId, tenantId, isActive: true },
    });
    if (!supervisor) {
      throw new NotFoundException(`Supervisor agent ${supervisorId} not found`);
    }

    // 2. Validate workers
    const workers = await this.prisma.agent.findMany({
      where: { id: { in: workerIds }, tenantId, isActive: true },
    });
    if (workers.length !== workerIds.length) {
      const foundIds = new Set(workers.map((w) => w.id));
      const missing = workerIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Worker agents not found or inactive: ${missing.join(', ')}`,
      );
    }

    // 3. Persist supervisor-worker relationships
    await Promise.all(
      workerIds.map((workerId) =>
        this.prisma.agent.update({
          where: { id: workerId },
          data: { supervisorId },
        }),
      ),
    );

    this.logger.log(
      `Supervised workflow started: supervisor=${supervisorId}, workers=[${workerIds.join(',')}], goal="${goalDescription}"`,
    );

    return {
      supervisorId,
      workerIds,
      goalDescription,
      status: 'started',
      message: `Supervised workflow initialised with ${workers.length} worker(s)`,
    };
  }

  /** Return all workers currently reporting to a supervisor. */
  async getWorkers(supervisorId: string, tenantId: string) {
    return this.prisma.agent.findMany({
      where: { supervisorId, tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        model: true,
      },
    });
  }
}

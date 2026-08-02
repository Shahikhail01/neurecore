/**
 * MutationDispatcher — Phase 3
 *
 * Routes mutations through the governed Work Runtime.
 * All conversational mutations enter via IWorkRuntime.createRun().
 * Never writes directly to services.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  IMutationDispatcher,
  MutationRequest,
  WorkRunView,
} from '../interfaces';
import { WORK_RUNTIME } from '../../work-runtime/contracts/work-runtime.interface';
import type { IWorkRuntime } from '../../work-runtime/contracts/work-runtime.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

@Injectable()
export class MutationDispatcher implements IMutationDispatcher {
  private readonly logger = new Logger(MutationDispatcher.name);

  constructor(
    @Inject(WORK_RUNTIME) private readonly workRuntime: IWorkRuntime,
    private readonly tenantContext: TenantContextService,
  ) {}

  async createGovernedRun(input: MutationRequest): Promise<WorkRunView> {
    const authenticated = this.tenantContext.get();
    this.logger.log('Creating governed work run from authenticated context');

    const run = await this.workRuntime.createRun({
      tenantId: authenticated.tenantId,
      actorId: authenticated.actorUserId,
      actorType: 'HUMAN',
      request: input.request,
      scope: input.scope,
    });

    this.logger.log(`Governed run created: ${run.id} status=${run.status}`);
    return run;
  }
}

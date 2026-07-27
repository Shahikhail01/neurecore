// src/modules/reviews/reviews.module.ts
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { CommandRegistry } from '../../common/commands/command.registry';
import { ReviewService } from './application/review.service';
import { DecideTaskReviewHandler } from './application/decide-task-review.handler';
import { AdvanceProjectStageHandler } from './application/advance-project-stage.handler';
import { LifecycleGuardService } from './application/lifecycle-guard.service';
import { ReviewController } from './review.controller';
import { LifecycleController } from './lifecycle.controller';
import { PrismaReviewRepository } from './infrastructure/prisma-review.repository';
import { PrismaLifecycleWaiverRepository } from './infrastructure/prisma-lifecycle-waiver.repository';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { REVIEW_REPOSITORY } from './domain/ports/review-repository.port';
import { LIFECYCLE_WAIVER_REPOSITORY } from './domain/ports/lifecycle-waiver-repository.port';
import {
  createDecideTaskReviewDefinition,
  DECIDE_TASK_REVIEW_COMMAND,
  DECIDE_TASK_REVIEW_VERSION,
} from './commands/decide-task-review.command';
import {
  createAdvanceProjectStageDefinition,
  ADVANCE_PROJECT_STAGE_COMMAND,
  ADVANCE_PROJECT_STAGE_VERSION,
} from './commands/advance-project-stage.command';

@Module({
  imports: [PersistenceModule],
  controllers: [ReviewController, LifecycleController],
  providers: [
    ReviewService,
    DecideTaskReviewHandler,
    AdvanceProjectStageHandler,
    LifecycleGuardService,
    PrismaReviewRepository,
    PrismaLifecycleWaiverRepository,
    {
      provide: REVIEW_REPOSITORY,
      useExisting: PrismaReviewRepository,
    },
    {
      provide: LIFECYCLE_WAIVER_REPOSITORY,
      useExisting: PrismaLifecycleWaiverRepository,
    },
  ],
  exports: [
    ReviewService,
    REVIEW_REPOSITORY,
    LIFECYCLE_WAIVER_REPOSITORY,
    PrismaReviewRepository,
    PrismaLifecycleWaiverRepository,
    LifecycleGuardService,
    DecideTaskReviewHandler,
    AdvanceProjectStageHandler,
  ],
})
export class ReviewsModule implements OnApplicationBootstrap {
  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly decideHandler: DecideTaskReviewHandler,
    private readonly advanceHandler: AdvanceProjectStageHandler,
  ) {}

  onApplicationBootstrap(): void {
    this.commandRegistry.register(
      createDecideTaskReviewDefinition((input, metadata) =>
        this.decideHandler.handle(input, metadata),
      ),
    );

    this.commandRegistry.register(
      createAdvanceProjectStageDefinition((input, metadata) =>
        this.advanceHandler.handle(input, metadata),
      ),
    );

    // Surface the registered command types in logs for visibility.
    if (
      this.commandRegistry.hasCommand(
        DECIDE_TASK_REVIEW_COMMAND,
        DECIDE_TASK_REVIEW_VERSION,
      )
    ) {
      // eslint-disable-next-line no-console
      console.log(
        `[reviews] Registered command ${DECIDE_TASK_REVIEW_COMMAND}:${DECIDE_TASK_REVIEW_VERSION}`,
      );
    }
    if (
      this.commandRegistry.hasCommand(
        ADVANCE_PROJECT_STAGE_COMMAND,
        ADVANCE_PROJECT_STAGE_VERSION,
      )
    ) {
      // eslint-disable-next-line no-console
      console.log(
        `[reviews] Registered command ${ADVANCE_PROJECT_STAGE_COMMAND}:${ADVANCE_PROJECT_STAGE_VERSION}`,
      );
    }
  }
}

// src/modules/reviews/reviews.module.ts
import { Module } from '@nestjs/common';
import { ReviewService } from './application/review.service';
import { ReviewController } from './review.controller';
import { PrismaReviewRepository } from './infrastructure/prisma-review.repository';
import { PrismaTaskRepository } from '../../common/persistence/prisma-task.repository';
import { REVIEW_REPOSITORY } from './domain/ports/review-repository.port';
import { TASK_REPOSITORY } from '../../common/ports/task-repository.port';

@Module({
  controllers: [ReviewController],
  providers: [
    ReviewService,
    PrismaReviewRepository,
    {
      provide: REVIEW_REPOSITORY,
      useExisting: PrismaReviewRepository,
    },
    {
      provide: TASK_REPOSITORY,
      useExisting: PrismaTaskRepository,
    },
  ],
  exports: [ReviewService],
})
export class ReviewsModule {}

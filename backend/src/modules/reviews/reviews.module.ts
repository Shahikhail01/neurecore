// src/modules/reviews/reviews.module.ts
import { Module } from '@nestjs/common';
import { ReviewService } from './application/review.service';
import { ReviewController } from './review.controller';
import { PrismaReviewRepository } from './infrastructure/prisma-review.repository';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { REVIEW_REPOSITORY } from './domain/ports/review-repository.port';

@Module({
  imports: [PersistenceModule],
  controllers: [ReviewController],
  providers: [
    ReviewService,
    PrismaReviewRepository,
    {
      provide: REVIEW_REPOSITORY,
      useExisting: PrismaReviewRepository,
    },
  ],
  exports: [ReviewService],
})
export class ReviewsModule {}

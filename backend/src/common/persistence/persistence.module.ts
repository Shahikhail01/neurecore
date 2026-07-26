// src/common/persistence/persistence.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PrismaUnitOfWork } from './prisma-unit-of-work';
import { PrismaIdempotencyRepository } from './prisma-idempotency.repository';
import { PrismaAuditRepository } from './prisma-audit.repository';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import { PrismaTaskRepository } from './prisma-task.repository';
import { PrismaInitiationRepository } from '../../modules/enterprise-initiation/infrastructure/prisma-initiation.repository';
import { PrismaProjectRepository } from '../../modules/projects/infrastructure/prisma-project.repository';
import {
  UNIT_OF_WORK,
  IDEMPOTENCY_REPOSITORY,
  AUDIT_REPOSITORY,
  OUTBOX_REPOSITORY,
  TASK_REPOSITORY,
} from '../ports/di-tokens';
import { INITIATION_REPOSITORY } from '../../modules/enterprise-initiation/domain/ports/initiation-repository.port';
import { PROJECT_REPOSITORY } from '../../modules/projects/domain/ports/project-repository.port';

@Global()
@Module({
  providers: [
    PrismaService,
    PrismaUnitOfWork,
    PrismaIdempotencyRepository,
    PrismaAuditRepository,
    PrismaOutboxRepository,
    PrismaTaskRepository,
    PrismaInitiationRepository,
    PrismaProjectRepository,
    { provide: UNIT_OF_WORK, useExisting: PrismaUnitOfWork },
    { provide: IDEMPOTENCY_REPOSITORY, useExisting: PrismaIdempotencyRepository },
    { provide: AUDIT_REPOSITORY, useExisting: PrismaAuditRepository },
    { provide: OUTBOX_REPOSITORY, useExisting: PrismaOutboxRepository },
    { provide: TASK_REPOSITORY, useExisting: PrismaTaskRepository },
    { provide: INITIATION_REPOSITORY, useExisting: PrismaInitiationRepository },
    { provide: PROJECT_REPOSITORY, useExisting: PrismaProjectRepository },
  ],
  exports: [
    UNIT_OF_WORK,
    IDEMPOTENCY_REPOSITORY,
    AUDIT_REPOSITORY,
    OUTBOX_REPOSITORY,
    TASK_REPOSITORY,
    INITIATION_REPOSITORY,
    PROJECT_REPOSITORY,
  ],
})
export class PersistenceModule {}

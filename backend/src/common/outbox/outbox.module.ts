// src/common/outbox/outbox.module.ts
import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';
import { OUTBOX_REPOSITORY } from './outbox-repository.port';
import { PrismaOutboxRepository } from '../persistence/prisma-outbox.repository';

@Global()
@Module({
  providers: [
    PrismaOutboxRepository,
    { provide: OUTBOX_REPOSITORY, useExisting: PrismaOutboxRepository },
    OutboxService,
    OutboxWorker,
  ],
  exports: [OutboxService, OutboxWorker, OUTBOX_REPOSITORY],
})
export class OutboxModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    OutboxWorker.setModuleRef(this.moduleRef);
  }
}

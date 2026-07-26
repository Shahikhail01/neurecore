// src/common/persistence/prisma-unit-of-work.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { IUnitOfWork, ITransactionalClient } from '../ports/transaction.interface';

/**
 * PrismaUnitOfWork — adapter that implements IUnitOfWork against Prisma.
 *
 * Application use cases depend on IUnitOfWork (the port).
 * This class is the persistence adapter. Domain/application code
 * must not import this class directly; inject IUnitOfWork instead.
 */
@Injectable()
export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(work: (tx: ITransactionalClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (prismaTx) => {
        // Wrap the prisma transaction client in a typed transactional client
        const tx = prismaTx as unknown as ITransactionalClient;
        return work(tx);
      },
      {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}

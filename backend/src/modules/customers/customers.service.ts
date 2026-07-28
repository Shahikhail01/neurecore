/**
 * Customers Module — Business Logic Service
 *
 * Following SOLID:
 * - SRP: only customer business logic (validation + orchestration).
 * - DIP: depends on ICustomerRepository abstraction.
 */

import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type {
  ICustomerRepository,
  Customer,
  CustomerContact,
  CustomerLifecycleStage,
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersOptions,
} from './interfaces/customer.interface';
import { CUSTOMER_REPOSITORY } from './interfaces/customer.interface';
import { TimelineService } from '../timeline/timeline.service';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repository: ICustomerRepository,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  async create(
    input: CreateCustomerInput,
    tenantId: string,
  ): Promise<Customer> {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Customer name is required');
    }
    return this.repository.create(
      { ...input, name: input.name.trim() },
      tenantId,
    );
  }

  async findById(id: string, tenantId: string): Promise<Customer> {
    const found = await this.repository.findById(id, tenantId);
    if (!found) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return found;
  }

  async findAll(
    tenantId: string,
    options: ListCustomersOptions = {},
  ): Promise<{ data: Customer[]; total: number }> {
    return this.repository.findAll(options, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateCustomerInput,
  ): Promise<Customer> {
    await this.findById(id, tenantId);
    return this.repository.update(id, tenantId, input);
  }

  async archive(id: string, tenantId: string): Promise<Customer> {
    await this.findById(id, tenantId);
    return this.repository.archive(id, tenantId);
  }

  async unarchive(id: string, tenantId: string): Promise<Customer> {
    await this.findById(id, tenantId);
    return this.repository.update(id, tenantId, { status: 'ACTIVE' });
  }

  /**
   * SIM-04 G-07 — explicit lifecycle-stage transition.
   *
   * Bumps lifecycleUpdatedAt, emits a customer:lifecycle-changed timeline
   * event (via TimelineService.record, lazy-resolved through ModuleRef to
   * avoid a circular import), and returns the updated customer row.
   *
   * Idempotent: a no-op transition (toStage === current) returns the
   * existing row without emitting a duplicate timeline event.
   *
   * @param actorId - the user id of the operator performing the move
   *                  (recorded on the timeline event for audit).
   */
  async moveLifecycleStage(
    id: string,
    tenantId: string,
    toStage: CustomerLifecycleStage,
    reason: string | undefined,
    actorId: string | undefined,
  ): Promise<Customer> {
    const existing = await this.findById(id, tenantId);
    if (existing.lifecycleStage === toStage) {
      this.logger.log(
        `Customer ${id} lifecycle move is a no-op (already at ${toStage})`,
      );
      return existing;
    }
    const updated = await this.repository.update(id, tenantId, {
      lifecycleStage: toStage,
      lifecycleUpdatedAt: new Date(),
    });

    // Timeline recording is best-effort — never block the transition on a
    // timeline failure (mirrors the ProjectsService pattern).
    if (this.moduleRef) {
      try {
        const timeline = this.moduleRef.get<
          InstanceType<typeof TimelineService>
        >(TimelineService, { strict: false });
        if (timeline) {
          await timeline.record({
            tenantId,
            customerId: id,
            occurredAt: new Date(),
            category: 'OPERATIONAL',
            severity: 'LOW',
            sourceType: 'HUMAN',
            sourceId: actorId ?? 'system',
            title: `Customer lifecycle: ${existing.lifecycleStage ?? 'NULL'} → ${toStage}`,
            description: reason
              ? `Customer moved from ${existing.lifecycleStage ?? 'NULL'} to ${toStage}. Reason: ${reason}.`
              : `Customer moved from ${existing.lifecycleStage ?? 'NULL'} to ${toStage}.`,
            relatedEntityType: 'Customer',
            relatedEntityId: id,
            correlationId: `customer.lifecycle.${id}.${Date.now()}`,
            metadata: {
              from: existing.lifecycleStage ?? null,
              to: toStage,
              reason: reason ?? null,
              actorId: actorId ?? null,
            },
          });
        }
      } catch (err) {
        this.logger.warn(
          `Failed to record customer lifecycle timeline event (${existing.lifecycleStage ?? 'NULL'} → ${toStage} for ${id}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return updated;
  }

  async addContact(
    customerId: string,
    tenantId: string,
    dto: {
      name: string;
      email: string;
      phone?: string;
      role?: string;
      isPrimary?: boolean;
    },
  ): Promise<CustomerContact> {
    await this.findById(customerId, tenantId);
    return this.repository.addContact(customerId, dto);
  }

  async listContacts(
    customerId: string,
    tenantId: string,
  ): Promise<CustomerContact[]> {
    await this.findById(customerId, tenantId);
    return this.repository.listContacts(customerId);
  }
}

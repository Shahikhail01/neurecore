/**
 * Approval Service - Business logic for approval workflows
 * SOLID: Single Responsibility - Only approval logic
 * SOLID: Open/Closed - Extensible via strategy pattern
 * Location: src/core/services/approval.service.ts
 */

import { Injectable } from '@nestjs/common';
import {
  Approval,
  ApprovalStatus,
  Priority,
  CreateApprovalInput,
  UpdateApprovalInput,
  ApprovalFilters,
} from '../domain/models';
import { IApprovalRepository, IEventBus, ILogger } from '../domain/interfaces';

/**
 * SOLID: Open/Closed - Strategy for different approval types
 */
export interface ApprovalStrategy {
  canApprove(approval: Approval, userId: string): Promise<boolean>;
  process(approval: Approval): Promise<ApprovalResult>;
}

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
}

@Injectable()
export class ApprovalService {
  private strategies = new Map<Priority, ApprovalStrategy>();

  constructor(
    private approvalRepository: IApprovalRepository,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * Register approval strategy
   * SOLID: Open/Closed - Add new strategies without modifying this class
   */
  registerStrategy(priority: Priority, strategy: ApprovalStrategy): void {
    this.strategies.set(priority, strategy);
  }

  /**
   * Create approval request
   */
  async createApproval(input: CreateApprovalInput): Promise<Approval> {
    this.logger.info('Creating approval', { input });

    const approval = await this.approvalRepository.create(input);

    await this.eventBus.emit('approval.created', {
      approvalId: approval.id,
      priority: approval.priority,
      timestamp: new Date().toISOString(),
    });

    return approval;
  }

  /**
   * Approve an approval request
   */
  async approveApproval(approvalId: string): Promise<Approval> {
    return this.updateApprovalStatus(approvalId, ApprovalStatus.APPROVED);
  }

  /**
   * Reject an approval request
   */
  async rejectApproval(approvalId: string): Promise<Approval> {
    return this.updateApprovalStatus(approvalId, ApprovalStatus.REJECTED);
  }

  /**
   * Update approval status
   */
  private async updateApprovalStatus(
    approvalId: string,
    status: ApprovalStatus,
  ): Promise<Approval> {
    this.logger.info('Updating approval status', { approvalId, status });

    const approval = await this.approvalRepository.update(approvalId, {
      status,
    });

    await this.eventBus.emit('approval.status_changed', {
      approvalId,
      newStatus: status,
      timestamp: new Date().toISOString(),
    });

    return approval;
  }

  /**
   * Get approval by ID
   */
  async getApprovalById(id: string): Promise<Approval | null> {
    return this.approvalRepository.findById(id);
  }

  /**
   * List approvals with filters
   */
  async listApprovals(filters: ApprovalFilters): Promise<Approval[]> {
    return this.approvalRepository.findAll(filters);
  }

  /**
   * Get expired approvals
   */
  async getExpiredApprovals(): Promise<Approval[]> {
    return this.approvalRepository.findExpiredApprovals();
  }

  /**
   * Process approval via strategy
   * SOLID: Liskov Substitution - Any strategy implementation works
   */
  async processApprovalWithStrategy(
    approvalId: string,
    userId: string,
  ): Promise<ApprovalResult> {
    const approval = await this.approvalRepository.findById(approvalId);
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    const strategy = this.strategies.get(approval.priority);
    if (!strategy) {
      throw new Error(
        `No strategy registered for priority ${approval.priority}`,
      );
    }

    const canApprove = await strategy.canApprove(approval, userId);
    if (!canApprove) {
      return { approved: false, reason: 'User not authorized' };
    }

    return strategy.process(approval);
  }
}

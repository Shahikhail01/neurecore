/**
 * Inbox Service
 *
 * Main service for unified inbox functionality
 * Following SOLID: Single Responsibility, Dependency Inversion
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaInboxRepository } from './repositories/prisma-inbox.repository';
import type { IInboxNotifier } from './interfaces/inbox.interface';
import type {
  InboxItemInput,
  FindInboxOptions,
  InboxKind,
  InboxStatus,
} from './interfaces/inbox.interface';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly repository: PrismaInboxRepository,
    @Inject('INBOX_NOTIFIERS') private readonly notifiers: IInboxNotifier[],
  ) {}

  /**
   * Get all inbox items for a user
   */
  async getInbox(
    tenantId: string,
    userId: string,
    options?: {
      status?: 'UNREAD' | 'READ' | 'ARCHIVED';
      kind?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<unknown[]> {
    // Convert string kind to InboxKind if provided
    const repoOptions: FindInboxOptions | undefined = options
      ? {
          status: options.status as InboxStatus,
          kind: options.kind as InboxKind,
          limit: options.limit,
          offset: options.offset,
        }
      : undefined;
    return this.repository.findByUser(tenantId, userId, repoOptions);
  }

  /**
   * Get inbox summary with counts
   */
  async getInboxSummary(tenantId: string, userId: string) {
    const [unread, total] = await Promise.all([
      this.repository.getUnreadCount(tenantId, userId),
      this.repository.findByUser(tenantId, userId, { limit: 1 }),
    ]);

    return {
      unreadCount: unread,
      totalCount: Array.isArray(total) ? total.length : 0,
    };
  }

  /**
   * Create and send a new inbox notification
   */
  async sendNotification(
    tenantId: string,
    userId: string,
    input: InboxItemInput,
  ) {
    // Store in repository
    const item = await this.repository.create(tenantId, userId, input);

    // Send via all registered notifiers (best-effort)
    try {
      await Promise.allSettled(this.notifiers.map((n) => n.notify(userId, input)));
    } catch (err) {
      this.logger.error('One or more notifiers failed', err as any);
    }

    return item;
  }

  /**
   * Send notification to multiple users
   */
  async broadcastNotification(
    tenantId: string,
    userIds: string[],
    input: InboxItemInput,
  ) {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.sendNotification(tenantId, userId, input)),
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    this.logger.log(
      `Broadcast notification sent to ${successCount}/${userIds.length} users`,
    );

    return { successCount, totalCount: userIds.length };
  }

  /**
   * Mark an item as read
   */
  async markRead(id: string, userId: string) {
    await this.repository.markRead(id, userId);
    return { success: true };
  }

  /**
   * Mark an item as archived
   */
  async markArchived(id: string, userId: string) {
    await this.repository.markArchived(id, userId);
    return { success: true };
  }

  /**
   * Mark all items as read
   */
  async markAllRead(tenantId: string, userId: string) {
    await this.repository.markAllRead(tenantId, userId);
    return { success: true };
  }

  /**
   * Get single inbox item
   */
  async getInboxItem(id: string) {
    return this.repository.findById(id);
  }

  /**
   * Cleanup old archived items
   */
  async cleanupOldItems(olderThanDays = 30) {
    const count = await this.repository.cleanupOldItems(olderThanDays);
    this.logger.log(`Cleaned up ${count} old inbox items`);
    return { deletedCount: count };
  }

  /**
   * Convenience method for sending approval requests
   */
  async sendApprovalNotification(
    tenantId: string,
    approverUserId: string,
    approvalId: string,
    title: string,
    requestedByName?: string,
  ) {
    return this.sendNotification(tenantId, approverUserId, {
      kind: 'APPROVAL',
      title: `Approval Required: ${title}`,
      body: requestedByName
        ? `${requestedByName} is waiting for your approval`
        : 'An approval request requires your attention',
      priority: 'HIGH',
      entityType: 'ApprovalRequest',
      entityId: approvalId,
      actionUrl: `/approvals/${approvalId}`,
    });
  }

  /**
   * Convenience method for budget alerts
   */
  async sendBudgetAlert(
    tenantId: string,
    adminUserId: string,
    policyName: string,
    threshold: number,
    currentSpend: number,
    limit: number,
  ) {
    return this.sendNotification(tenantId, adminUserId, {
      kind: 'BUDGET_ALERT',
      title: `Budget Alert: ${policyName}`,
      body: `Spending has reached ${threshold}% of limit ($${currentSpend.toFixed(2)} / $${limit.toFixed(2)})`,
      priority: threshold >= 90 ? 'URGENT' : 'HIGH',
      entityType: 'BudgetPolicy',
      entityId: policyName,
      actionUrl: `/costs/budgets`,
    });
  }

  /**
   * Convenience method for failed task alerts
   */
  async sendFailedTaskNotification(
    tenantId: string,
    userId: string,
    taskId: string,
    taskTitle: string,
    errorMessage?: string,
  ) {
    return this.sendNotification(tenantId, userId, {
      kind: 'FAILED_TASK',
      title: `Task Failed: ${taskTitle}`,
      body: errorMessage ?? 'A task failed to complete successfully',
      priority: 'HIGH',
      entityType: 'Task',
      entityId: taskId,
      actionUrl: `/tasks/${taskId}`,
    });
  }
}

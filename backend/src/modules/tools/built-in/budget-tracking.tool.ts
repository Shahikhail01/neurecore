/**
 * Budget Tracking Tool - P0-3 of remaining tools
 * Enables AI agents to create, track, and manage budgets for Finance
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for budget operations
 * - OCP: Extensible via budget storage providers
 * - DIP: Depends on abstractions for notifications
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

export const BudgetActionEnum = z.enum([
  'create_budget',
  'list_budgets',
  'get_budget',
  'update_budget',
  'track_spending',
  'check_thresholds',
  'get_summary',
  'delete_budget',
]);

export type BudgetAction = z.infer<typeof BudgetActionEnum>;

export const BudgetInputSchema = z.object({
  action: BudgetActionEnum.describe('The budget action to perform'),
  budgetId: z
    .string()
    .optional()
    .describe('Budget ID for get/update/delete operations'),
  name: z.string().optional().describe('Budget name for create/update'),
  description: z.string().optional().describe('Budget description'),
  totalAmount: z.number().positive().optional().describe('Total budget amount'),
  period: z
    .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .optional()
    .describe('Budget period'),
  startDate: z.string().optional().describe('Budget start date (ISO)'),
  endDate: z.string().optional().describe('Budget end date (ISO)'),
  categories: z
    .array(
      z.object({
        name: z.string(),
        allocated: z.number(),
        spent: z.number().default(0),
      }),
    )
    .optional()
    .describe('Budget categories'),
  alertThreshold: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Alert threshold percentage'),
  alertChannel: z
    .enum(['email', 'slack', 'sms'])
    .optional()
    .describe('Alert notification channel'),
  newAmount: z.number().optional().describe('New amount for update'),
});

export type BudgetInput = z.infer<typeof BudgetInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

export const BudgetCategorySchema = z.object({
  name: z.string(),
  allocated: z.number(),
  spent: z.number(),
  remaining: z.number(),
  percentUsed: z.number(),
});

export const BudgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  totalAmount: z.number(),
  period: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  categories: z.array(BudgetCategorySchema),
  totalSpent: z.number(),
  totalRemaining: z.number(),
  percentUsed: z.number(),
  alertThreshold: z.number(),
  status: z.enum(['active', 'closed', 'exceeded']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const BudgetSummarySchema = z.object({
  totalBudgets: z.number(),
  totalAllocated: z.number(),
  totalSpent: z.number(),
  totalRemaining: z.number(),
  budgetsAtRisk: z.number(),
  budgetsExceeded: z.number(),
});

export const BudgetOutputSchema = z.object({
  action: z.string(),
  budget: BudgetSchema.optional(),
  budgets: z.array(BudgetSchema).optional(),
  summary: BudgetSummarySchema.optional(),
  alerts: z.array(z.string()).optional(),
  message: z.string().optional(),
});

export type BudgetOutput = z.infer<typeof BudgetOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

interface IBudgetStorage {
  create(
    budget: z.infer<typeof BudgetSchema>,
  ): Promise<z.infer<typeof BudgetSchema>>;
  list(): Promise<z.infer<typeof BudgetSchema>[]>;
  get(id: string): Promise<z.infer<typeof BudgetSchema>>;
  update(
    id: string,
    data: Partial<z.infer<typeof BudgetSchema>>,
  ): Promise<z.infer<typeof BudgetSchema>>;
  delete(id: string): Promise<void>;
}

interface IAlertProvider {
  sendAlert(message: string, channel: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Implementations
// ─────────────────────────────────────────────────────────────

@Injectable()
class LocalBudgetStorage implements IBudgetStorage {
  private budgets: Map<string, z.infer<typeof BudgetSchema>> = new Map();
  private budgetCounter = 100;

  private generateId(): string {
    return `budget_${++this.budgetCounter}_${Date.now().toString(36)}`;
  }

  private calculateCategoryStats(
    categories: z.infer<typeof BudgetCategorySchema>[],
  ) {
    let totalSpent = 0;
    let totalAllocated = 0;
    const updated = categories.map((cat) => {
      totalSpent += cat.spent;
      totalAllocated += cat.allocated;
      return {
        ...cat,
        remaining: cat.allocated - cat.spent,
        percentUsed: cat.allocated > 0 ? (cat.spent / cat.allocated) * 100 : 0,
      };
    });
    return {
      categories: updated,
      totalSpent,
      totalAllocated,
      totalRemaining: totalAllocated - totalSpent,
      percentUsed: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
    };
  }

  async create(
    budget: z.infer<typeof BudgetSchema>,
  ): Promise<z.infer<typeof BudgetSchema>> {
    const id = this.generateId();
    const stats = this.calculateCategoryStats(budget.categories || []);
    const newBudget: z.infer<typeof BudgetSchema> = {
      ...budget,
      id,
      categories: stats.categories,
      totalSpent: stats.totalSpent,
      totalRemaining: stats.totalRemaining,
      percentUsed: stats.percentUsed,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.budgets.set(id, newBudget);
    return newBudget;
  }

  async list(): Promise<z.infer<typeof BudgetSchema>[]> {
    return Array.from(this.budgets.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async get(id: string): Promise<z.infer<typeof BudgetSchema>> {
    const budget = this.budgets.get(id);
    if (!budget) {
      throw new Error(`Budget not found: ${id}`);
    }
    return budget;
  }

  async update(
    id: string,
    data: Partial<z.infer<typeof BudgetSchema>>,
  ): Promise<z.infer<typeof BudgetSchema>> {
    const budget = await this.get(id);
    const stats = this.calculateCategoryStats(budget.categories || []);
    const updated: z.infer<typeof BudgetSchema> = {
      ...budget,
      ...data,
      categories: data.categories
        ? this.calculateCategoryStats(data.categories).categories
        : budget.categories,
      totalSpent: data.categories
        ? this.calculateCategoryStats(data.categories).totalSpent
        : budget.totalSpent,
      totalRemaining: data.categories
        ? this.calculateCategoryStats(data.categories).totalRemaining
        : budget.totalRemaining,
      percentUsed: data.categories
        ? this.calculateCategoryStats(data.categories).percentUsed
        : budget.percentUsed,
      updatedAt: new Date(),
    };
    this.budgets.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.budgets.has(id)) {
      throw new Error(`Budget not found: ${id}`);
    }
    this.budgets.delete(id);
  }
}

@Injectable()
class MockAlertProvider implements IAlertProvider {
  async sendAlert(message: string, channel: string): Promise<void> {
    console.log(`[Alert] ${channel.toUpperCase()}: ${message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Main Tool
// ─────────────────────────────────────────────────────────────

@Injectable()
export class BudgetTrackingTool extends BaseStructuredTool {
  readonly name = 'budget_tracking';
  readonly description =
    'Create, track, and manage budgets for Finance departments. Use for budget planning, spending tracking, threshold alerts, and financial summaries.';
  readonly category = ToolCategory.FINANCE;
  readonly inputSchema = BudgetInputSchema;

  private readonly storage: IBudgetStorage;
  private readonly alertProvider: IAlertProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.storage = new LocalBudgetStorage();
    this.alertProvider = new MockAlertProvider();
  }

  protected async executeImpl(
    input: BudgetInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<unknown>> {
    const startTime = Date.now();
    const { action } = input;

    try {
      switch (action) {
        case 'create_budget':
          return await this.handleCreateBudget(input, startTime);
        case 'list_budgets':
          return await this.handleListBudgets(startTime);
        case 'get_budget':
          return await this.handleGetBudget(input, startTime);
        case 'update_budget':
          return await this.handleUpdateBudget(input, startTime);
        case 'track_spending':
          return await this.handleTrackSpending(input, startTime);
        case 'check_thresholds':
          return await this.handleCheckThresholds(input, startTime);
        case 'get_summary':
          return await this.handleGetSummary(startTime);
        case 'delete_budget':
          return await this.handleDeleteBudget(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(`Budget action ${action} failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private async handleCreateBudget(
    input: BudgetInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const {
      name,
      description,
      totalAmount,
      period,
      startDate,
      endDate,
      categories,
      alertThreshold,
    } = input;

    if (!name || !totalAmount || !period) {
      return {
        success: false,
        error: 'name, totalAmount, and period are required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const budgetData: z.infer<typeof BudgetSchema> = {
      id: '',
      name,
      description: description || '',
      totalAmount,
      period,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate
        ? new Date(endDate)
        : new Date(Date.now() + 30 * 86400000),
      categories: (categories || []).map((c) => ({
        name: c.name,
        allocated: c.allocated,
        spent: c.spent,
        remaining: c.allocated - c.spent,
        percentUsed: c.allocated > 0 ? (c.spent / c.allocated) * 100 : 0,
      })),
      totalSpent: 0,
      totalRemaining: totalAmount,
      percentUsed: 0,
      alertThreshold: alertThreshold || 80,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const budget = await this.storage.create(budgetData);

    return {
      success: true,
      data: {
        action: 'create_budget',
        budget,
        message: `Budget "${name}" created successfully`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleListBudgets(
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const budgets = await this.storage.list();

    return {
      success: true,
      data: {
        action: 'list_budgets',
        budgets,
        message: `Retrieved ${budgets.length} budgets`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleGetBudget(
    input: BudgetInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { budgetId } = input;

    if (!budgetId) {
      return {
        success: false,
        error: 'budgetId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const budget = await this.storage.get(budgetId);

    return {
      success: true,
      data: {
        action: 'get_budget',
        budget,
        message: `Retrieved budget: ${budget.name}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleUpdateBudget(
    input: BudgetInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { budgetId, name, description, newAmount, alertThreshold } = input;

    if (!budgetId) {
      return {
        success: false,
        error: 'budgetId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const updateData: Partial<z.infer<typeof BudgetSchema>> = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (newAmount) updateData.totalAmount = newAmount;
    if (alertThreshold) updateData.alertThreshold = alertThreshold;

    const budget = await this.storage.update(budgetId, updateData);

    return {
      success: true,
      data: {
        action: 'update_budget',
        budget,
        message: `Budget "${budget.name}" updated`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleTrackSpending(
    input: BudgetInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { budgetId, categories } = input;

    if (!budgetId || !categories || categories.length === 0) {
      return {
        success: false,
        error: 'budgetId and categories are required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const budget = await this.storage.get(budgetId);

    // Convert input categories to full category schema with computed fields
    const updatedCategories = categories.map((c) => ({
      name: c.name,
      allocated: c.allocated,
      spent: c.spent,
      remaining: c.allocated - c.spent,
      percentUsed: c.allocated > 0 ? (c.spent / c.allocated) * 100 : 0,
    }));

    const updated = await this.storage.update(budgetId, {
      categories: updatedCategories,
    });

    // Check thresholds and send alerts
    if (updated.percentUsed >= updated.alertThreshold) {
      await this.alertProvider.sendAlert(
        `Budget "${updated.name}" has used ${updated.percentUsed.toFixed(1)}% of allocated funds`,
        'email',
      );
    }

    return {
      success: true,
      data: {
        action: 'track_spending',
        budget: updated,
        message: `Spending tracked for budget "${updated.name}"`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleCheckThresholds(
    input: BudgetInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const budgets = await this.storage.list();
    const alerts: string[] = [];

    for (const budget of budgets) {
      if (budget.percentUsed >= budget.alertThreshold) {
        alerts.push(
          `${budget.name}: ${budget.percentUsed.toFixed(1)}% used (threshold: ${budget.alertThreshold}%)`,
        );
      }
    }

    return {
      success: true,
      data: {
        action: 'check_thresholds',
        alerts,
        message:
          alerts.length > 0
            ? `Found ${alerts.length} budgets at risk`
            : 'All budgets within thresholds',
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleGetSummary(
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const budgets = await this.storage.list();

    const summary: z.infer<typeof BudgetSummarySchema> = {
      totalBudgets: budgets.length,
      totalAllocated: budgets.reduce((sum, b) => sum + b.totalAmount, 0),
      totalSpent: budgets.reduce((sum, b) => sum + b.totalSpent, 0),
      totalRemaining: budgets.reduce((sum, b) => sum + b.totalRemaining, 0),
      budgetsAtRisk: budgets.filter((b) => b.percentUsed >= b.alertThreshold)
        .length,
      budgetsExceeded: budgets.filter((b) => b.percentUsed > 100).length,
    };

    return {
      success: true,
      data: {
        action: 'get_summary',
        summary,
        message: `Budget summary: ${summary.totalBudgets} budgets, ${summary.totalSpent} spent`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleDeleteBudget(
    input: BudgetInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { budgetId } = input;

    if (!budgetId) {
      return {
        success: false,
        error: 'budgetId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    await this.storage.delete(budgetId);

    return {
      success: true,
      data: {
        action: 'delete_budget',
        message: `Budget ${budgetId} deleted`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}

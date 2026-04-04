/**
 * Expense Tracking Tool - P1-14 of remaining tools
 * Enables AI agents to track expenses, manage expense reports
 * For Finance, Procurement agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for expense tracking operations
 * - OCP: Extensible via expense provider interfaces
 * - DIP: Depends on abstractions for expense providers
 */

import { Injectable, Logger } from '@nestjs/common';
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

export const ExpenseTrackingActionEnum = z.enum([
  'create_expense',
  'update_expense',
  'get_expense',
  'list_expenses',
  'submit_expense_report',
  'approve_expense',
  'get_expense_summary',
]);

export type ExpenseTrackingAction = z.infer<typeof ExpenseTrackingActionEnum>;

export const ExpenseTrackingInputSchema = z.object({
  action: ExpenseTrackingActionEnum.describe(
    'The expense tracking action to perform',
  ),
  expenseId: z.string().optional().describe('Expense ID'),
  amount: z.number().positive().optional().describe('Expense amount'),
  currency: z.string().optional().default('USD').describe('Currency code'),
  category: z
    .enum([
      'travel',
      'meals',
      'accommodation',
      'transportation',
      'supplies',
      'equipment',
      'software',
      'services',
      'other',
    ])
    .optional()
    .describe('Expense category'),
  description: z.string().optional().describe('Expense description'),
  date: z.string().optional().describe('Expense date (ISO format)'),
  receiptUrl: z.string().url().optional().describe('Receipt URL'),
  vendor: z.string().optional().describe('Vendor name'),
  reportId: z.string().optional().describe('Expense report ID'),
  status: z
    .enum(['pending', 'approved', 'rejected', 'reimbursed'])
    .optional()
    .describe('Expense status'),
  filters: z
    .object({
      category: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type ExpenseTrackingInput = z.infer<typeof ExpenseTrackingInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type Expense = {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  receiptUrl?: string;
  vendor?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ExpenseReport = {
  id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  totalAmount: number;
  currency: string;
  expenses: string[];
  submittedAt?: string;
  createdAt: string;
};

type ExpenseSummary = {
  totalAmount: number;
  totalCount: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IExpenseProvider {
  createExpense(expense: {
    amount: number;
    currency: string;
    category: string;
    description?: string;
    date?: string;
    receiptUrl?: string;
    vendor?: string;
  }): Promise<Expense>;

  updateExpense(
    id: string,
    updates: Partial<{
      amount: number;
      category: string;
      description: string;
      date: string;
      status: string;
    }>,
  ): Promise<Expense>;

  getExpense(id: string): Promise<Expense>;

  listExpenses(
    page: number,
    limit: number,
    filters?: {
      category?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
  ): Promise<{ expenses: Expense[]; total: number }>;

  submitExpenseReport(
    reportId: string,
    expenseIds: string[],
  ): Promise<ExpenseReport>;

  approveExpense(expenseId: string, approved: boolean): Promise<Expense>;

  getExpenseSummary(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ExpenseSummary>;
}

// ─────────────────────────────────────────────────────────────
// Mock Expense Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockExpenseProvider implements IExpenseProvider {
  private readonly logger = new Logger(MockExpenseProvider.name);
  private readonly expenses = new Map<string, Expense>();
  private expenseIdCounter = 1;

  private generateId(): string {
    return 'exp_' + this.expenseIdCounter++;
  }

  async createExpense(expense: {
    amount: number;
    currency: string;
    category: string;
    description?: string;
    date?: string;
    receiptUrl?: string;
    vendor?: string;
  }): Promise<Expense> {
    this.logger.log(
      'Creating expense: ' + expense.amount + ' ' + expense.currency,
    );
    const id = this.generateId();
    const now = new Date().toISOString();

    const newExpense: Expense = {
      id,
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      description: expense.description || '',
      date: expense.date || now,
      receiptUrl: expense.receiptUrl,
      vendor: expense.vendor,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.expenses.set(id, newExpense);
    return newExpense;
  }

  async updateExpense(
    id: string,
    updates: Partial<{
      amount: number;
      category: string;
      description: string;
      date: string;
      status: string;
    }>,
  ): Promise<Expense> {
    this.logger.log('Updating expense: ' + id);
    const expense = this.expenses.get(id);

    if (!expense) {
      throw new Error('Expense not found: ' + id);
    }

    const updated: Expense = {
      ...expense,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.expenses.set(id, updated);
    return updated;
  }

  async getExpense(id: string): Promise<Expense> {
    this.logger.log('Getting expense: ' + id);
    const expense = this.expenses.get(id);

    if (!expense) {
      throw new Error('Expense not found: ' + id);
    }

    return expense;
  }

  async listExpenses(
    page: number,
    limit: number,
    filters?: {
      category?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
  ): Promise<{ expenses: Expense[]; total: number }> {
    this.logger.log('Listing expenses');
    let all = Array.from(this.expenses.values());

    if (filters?.category) {
      all = all.filter((e) => e.category === filters.category);
    }
    if (filters?.status) {
      all = all.filter((e) => e.status === filters.status);
    }
    if (filters?.startDate) {
      all = all.filter((e) => e.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      all = all.filter((e) => e.date <= filters.endDate!);
    }

    // Sort by date descending
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const start = (page - 1) * limit;
    const expenses = all.slice(start, start + limit);

    return { expenses, total: all.length };
  }

  async submitExpenseReport(
    reportId: string,
    expenseIds: string[],
  ): Promise<ExpenseReport> {
    this.logger.log('Submitting expense report: ' + reportId);

    let totalAmount = 0;
    const validExpenses: string[] = [];

    for (const id of expenseIds) {
      const expense = this.expenses.get(id);
      if (expense) {
        totalAmount += expense.amount;
        validExpenses.push(id);
        // Update expense status
        expense.status = 'pending';
      }
    }

    return {
      id: reportId,
      status: 'submitted',
      totalAmount,
      currency: 'USD',
      expenses: validExpenses,
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  async approveExpense(expenseId: string, approved: boolean): Promise<Expense> {
    this.logger.log('Approving expense: ' + expenseId + ' = ' + approved);
    const expense = this.expenses.get(expenseId);

    if (!expense) {
      throw new Error('Expense not found: ' + expenseId);
    }

    expense.status = approved ? 'approved' : 'rejected';
    expense.updatedAt = new Date().toISOString();

    return expense;
  }

  async getExpenseSummary(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ExpenseSummary> {
    this.logger.log('Getting expense summary');
    let all = Array.from(this.expenses.values());

    if (filters?.startDate) {
      all = all.filter((e) => e.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      all = all.filter((e) => e.date <= filters.endDate!);
    }

    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalAmount = 0;

    for (const expense of all) {
      totalAmount += expense.amount;
      byCategory[expense.category] = (byCategory[expense.category] || 0) + 1;
      byStatus[expense.status] = (byStatus[expense.status] || 0) + 1;
    }

    return {
      totalAmount,
      totalCount: all.length,
      byCategory,
      byStatus,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class ExpenseTrackingTool extends BaseStructuredTool {
  readonly name = 'expense_tracking';
  readonly description =
    'Track expenses, manage expense reports, handle approvals and summaries';
  readonly category = ToolCategory.FINANCE;
  readonly inputSchema = ExpenseTrackingInputSchema;

  private readonly log = new Logger(ExpenseTrackingTool.name);
  private readonly provider: IExpenseProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockExpenseProvider();
  }

  protected async executeImpl(
    input: ExpenseTrackingInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Expense Tracking action: ' + input.action);

    try {
      switch (input.action) {
        case 'create_expense':
          return await this.handleCreateExpense(input);
        case 'update_expense':
          return await this.handleUpdateExpense(input);
        case 'get_expense':
          return await this.handleGetExpense(input);
        case 'list_expenses':
          return await this.handleListExpenses(input);
        case 'submit_expense_report':
          return await this.handleSubmitExpenseReport(input);
        case 'approve_expense':
          return await this.handleApproveExpense(input);
        case 'get_expense_summary':
          return await this.handleGetExpenseSummary(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        'Expense Tracking action failed: ' + err.message,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  private async handleCreateExpense(
    input: ExpenseTrackingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.amount || !input.category) {
      throw new Error(
        'amount and category are required for create_expense action',
      );
    }

    const result = await this.provider.createExpense({
      amount: input.amount,
      currency: input.currency || 'USD',
      category: input.category,
      description: input.description,
      date: input.date,
      receiptUrl: input.receiptUrl,
      vendor: input.vendor,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleUpdateExpense(
    input: ExpenseTrackingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.expenseId) {
      throw new Error('expenseId is required for update_expense action');
    }

    const result = await this.provider.updateExpense(input.expenseId, {
      amount: input.amount,
      category: input.category,
      description: input.description,
      date: input.date,
      status: input.status,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetExpense(
    input: ExpenseTrackingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.expenseId) {
      throw new Error('expenseId is required for get_expense action');
    }

    const result = await this.provider.getExpense(input.expenseId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListExpenses(
    input: ExpenseTrackingInput,
  ): Promise<StructuredToolResult<unknown>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.listExpenses(page, limit, {
      category: input.filters?.category,
      startDate: input.filters?.startDate,
      endDate: input.filters?.endDate,
      status: input.status,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleSubmitExpenseReport(
    input: ExpenseTrackingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.reportId) {
      throw new Error('reportId is required for submit_expense_report action');
    }

    // This would need expense IDs - using mock for now
    const result = await this.provider.submitExpenseReport(input.reportId, []);

    return {
      success: true,
      data: result,
    };
  }

  private async handleApproveExpense(
    input: ExpenseTrackingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.expenseId) {
      throw new Error('expenseId is required for approve_expense action');
    }

    const result = await this.provider.approveExpense(input.expenseId, true);

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetExpenseSummary(
    input: ExpenseTrackingInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.getExpenseSummary({
      startDate: input.filters?.startDate,
      endDate: input.filters?.endDate,
    });

    return {
      success: true,
      data: result,
    };
  }
}

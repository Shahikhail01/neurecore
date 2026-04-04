/**
 * Banking Tool - Tool 11 of 12
 * Enables AI agents to perform banking operations
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for banking operations
 * - OCP: Extensible via banking providers
 * - DIP: Depends on abstractions for financial services
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

export const BankingActionEnum = z.enum([
  'balance',
  'transactions',
  'transfer',
  'history',
]);

export type BankingAction = z.infer<typeof BankingActionEnum>;

export const BankingInputSchema = z.object({
  action: BankingActionEnum.describe('The banking action to perform'),
  accountId: z.string().optional().describe('Account ID'),
  toAccount: z.string().optional().describe('Destination account for transfer'),
  amount: z.number().positive().optional().describe('Amount'),
  currency: z.string().optional().describe('Currency code'),
  startDate: z.string().optional().describe('Start date for transactions'),
  endDate: z.string().optional().describe('End date for transactions'),
  limit: z.number().optional().describe('Number of transactions'),
});

export type BankingInput = z.infer<typeof BankingInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

export const BankingOutputSchema = z.object({
  accountId: z.string().optional(),
  balance: z.number().optional(),
  currency: z.string().optional(),
  transactions: z
    .array(
      z.object({
        id: z.string(),
        date: z.date(),
        description: z.string(),
        amount: z.number(),
        type: z.string(),
      }),
    )
    .optional(),
  message: z.string().optional(),
});

export type BankingOutput = z.infer<typeof BankingOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Banking Tool
// ─────────────────────────────────────────────────────────────

@Injectable()
export class BankingTool extends BaseStructuredTool {
  readonly name = 'banking';
  readonly description =
    'Perform banking operations including balance checks, transaction history, and transfers';
  readonly category = ToolCategory.FINANCE;
  readonly inputSchema = BankingInputSchema;
  readonly outputSchema = BankingOutputSchema;
  readonly version = '1.0.0';

  private readonly accounts: Map<
    string,
    {
      id: string;
      balance: number;
      currency: string;
    }
  > = new Map();

  private readonly transactions: Map<
    string,
    {
      id: string;
      accountId: string;
      date: Date;
      description: string;
      amount: number;
      type: string;
    }
  > = new Map();

  constructor(private readonly config: ConfigService) {
    super();
    // Initialize with demo account
    this.accounts.set('acc_demo', {
      id: 'acc_demo',
      balance: 10000,
      currency: 'USD',
    });
  }

  private generateId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  protected async executeImpl(
    input: BankingInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<BankingOutput>> {
    const startTime = Date.now();

    try {
      switch (input.action) {
        case 'balance':
          return await this.handleBalance(input, startTime);
        case 'transactions':
          return await this.handleTransactions(input, startTime);
        case 'transfer':
          return await this.handleTransfer(input, startTime);
        case 'history':
          return await this.handleHistory(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Banking operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private async handleBalance(
    input: BankingInput,
    startTime: number,
  ): Promise<StructuredToolResult<BankingOutput>> {
    const accountId = input.accountId || 'acc_demo';
    const account = this.accounts.get(accountId);

    if (!account) {
      return {
        success: false,
        error: `Account ${accountId} not found`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    return {
      success: true,
      data: {
        accountId: account.id,
        balance: account.balance,
        currency: account.currency,
        message: `Balance: ${account.currency} ${account.balance.toFixed(2)}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleTransactions(
    input: BankingInput,
    startTime: number,
  ): Promise<StructuredToolResult<BankingOutput>> {
    const accountId = input.accountId || 'acc_demo';
    const limit = input.limit || 10;

    const transactions = Array.from(this.transactions.values())
      .filter((t) => t.accountId === accountId)
      .slice(0, limit);

    return {
      success: true,
      data: {
        accountId,
        transactions,
        message: `Found ${transactions.length} transaction(s)`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleTransfer(
    input: BankingInput,
    startTime: number,
  ): Promise<StructuredToolResult<BankingOutput>> {
    const {
      accountId = 'acc_demo',
      toAccount,
      amount,
      currency = 'USD',
    } = input;

    if (!toAccount || !amount) {
      return {
        success: false,
        error: 'toAccount and amount are required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const account = this.accounts.get(accountId);
    if (!account) {
      return {
        success: false,
        error: `Account ${accountId} not found`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    if (account.balance < amount) {
      return {
        success: false,
        error: 'Insufficient balance',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    // Deduct from source
    account.balance -= amount;

    // Add transaction
    const txnId = this.generateId();
    this.transactions.set(txnId, {
      id: txnId,
      accountId,
      date: new Date(),
      description: `Transfer to ${toAccount}`,
      amount: -amount,
      type: 'debit',
    });

    return {
      success: true,
      data: {
        accountId,
        balance: account.balance,
        currency,
        message: `Transferred ${currency} ${amount} to ${toAccount}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleHistory(
    input: BankingInput,
    startTime: number,
  ): Promise<StructuredToolResult<BankingOutput>> {
    const accountId = input.accountId || 'acc_demo';
    const limit = input.limit || 20;

    const transactions = Array.from(this.transactions.values())
      .filter((t) => t.accountId === accountId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);

    return {
      success: true,
      data: {
        accountId,
        transactions,
        message: `Retrieved ${transactions.length} transaction(s)`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}

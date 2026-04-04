/**
 * Payment Processing Tool - P1-13 of remaining tools
 * Enables AI agents to process payments, manage transactions
 * For Finance, Treasury agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for payment operations
 * - OCP: Extensible via payment provider interfaces
 * - DIP: Depends on abstractions for payment providers
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

export const PaymentProcessingActionEnum = z.enum([
  'process_payment',
  'refund_payment',
  'get_payment_status',
  'list_transactions',
  'create_payment_intent',
  'validate_payment_method',
]);

export type PaymentProcessingAction = z.infer<
  typeof PaymentProcessingActionEnum
>;

export const PaymentProcessingInputSchema = z.object({
  action: PaymentProcessingActionEnum.describe('The payment action to perform'),
  amount: z.number().positive().optional().describe('Payment amount'),
  currency: z.string().optional().default('USD').describe('Currency code'),
  paymentMethodId: z.string().optional().describe('Payment method ID'),
  paymentIntentId: z.string().optional().describe('Payment intent ID'),
  transactionId: z.string().optional().describe('Transaction ID'),
  customerId: z.string().optional().describe('Customer ID'),
  metadata: z.record(z.unknown()).optional().describe('Payment metadata'),
  reason: z.string().optional().describe('Reason for refund'),
  options: z
    .object({
      capture: z.boolean().optional().default(true),
      receiptEmail: z.string().email().optional(),
      description: z.string().optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type PaymentProcessingInput = z.infer<
  typeof PaymentProcessingInputSchema
>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type PaymentResult = {
  id: string;
  status: 'succeeded' | 'pending' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  paymentIntentId: string;
  receiptUrl?: string;
  createdAt: string;
};

type RefundResult = {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  reason?: string;
  createdAt: string;
};

type Transaction = {
  id: string;
  type: 'payment' | 'refund' | 'chargeback';
  amount: number;
  currency: string;
  status: string;
  customerId?: string;
  description?: string;
  createdAt: string;
};

type PaymentIntent = {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IPaymentProvider {
  processPayment(
    amount: number,
    currency: string,
    paymentMethodId: string,
    options?: {
      capture?: boolean;
      receiptEmail?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PaymentResult>;

  refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundResult>;

  getPaymentStatus(paymentIntentId: string): Promise<PaymentResult>;

  listTransactions(
    page: number,
    limit: number,
    filters?: { customerId?: string; status?: string },
  ): Promise<{ transactions: Transaction[]; total: number }>;

  createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
  ): Promise<PaymentIntent>;

  validatePaymentMethod(paymentMethodId: string): Promise<ValidationResult>;
}

// ─────────────────────────────────────────────────────────────
// Mock Payment Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);
  private readonly payments = new Map<string, PaymentResult>();
  private readonly transactions = new Map<string, Transaction>();

  async processPayment(
    amount: number,
    currency: string,
    paymentMethodId: string,
    options?: {
      capture?: boolean;
      receiptEmail?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PaymentResult> {
    this.logger.log('Processing payment: ' + amount + ' ' + currency);
    const id = 'pay_' + Date.now();

    // Mock processing
    const result: PaymentResult = {
      id,
      status: 'succeeded',
      amount,
      currency,
      paymentIntentId: id,
      receiptUrl: 'https://receipts.example.com/' + id,
      createdAt: new Date().toISOString(),
    };

    this.payments.set(id, result);

    // Add transaction
    const transaction: Transaction = {
      id: 'txn_' + Date.now(),
      type: 'payment',
      amount,
      currency,
      status: 'succeeded',
      description: options?.description,
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(transaction.id, transaction);

    return result;
  }

  async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundResult> {
    this.logger.log('Refunding payment: ' + paymentIntentId);
    const payment = this.payments.get(paymentIntentId);

    if (!payment) {
      throw new Error('Payment not found: ' + paymentIntentId);
    }

    const refundAmount = amount || payment.amount;
    const id = 'ref_' + Date.now();

    const result: RefundResult = {
      id,
      status: 'succeeded',
      amount: refundAmount,
      reason,
      createdAt: new Date().toISOString(),
    };

    // Add refund transaction
    const transaction: Transaction = {
      id: 'txn_' + Date.now(),
      type: 'refund',
      amount: -refundAmount,
      currency: payment.currency,
      status: 'succeeded',
      description: reason,
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(transaction.id, transaction);

    return result;
  }

  async getPaymentStatus(paymentIntentId: string): Promise<PaymentResult> {
    this.logger.log('Getting payment status: ' + paymentIntentId);
    const payment = this.payments.get(paymentIntentId);

    if (!payment) {
      return {
        id: paymentIntentId,
        status: 'pending',
        amount: 0,
        currency: 'USD',
        paymentIntentId,
        createdAt: new Date().toISOString(),
      };
    }

    return payment;
  }

  async listTransactions(
    page: number,
    limit: number,
    filters?: { customerId?: string; status?: string },
  ): Promise<{ transactions: Transaction[]; total: number }> {
    this.logger.log('Listing transactions');
    let all = Array.from(this.transactions.values());

    if (filters?.status) {
      all = all.filter((t) => t.status === filters.status);
    }

    const start = (page - 1) * limit;
    const transactions = all.slice(start, start + limit);

    return { transactions, total: all.length };
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
  ): Promise<PaymentIntent> {
    this.logger.log('Creating payment intent: ' + amount + ' ' + currency);
    const id = 'pi_' + Date.now();

    return {
      id,
      clientSecret:
        'pi_' + id + '_secret_' + Math.random().toString(36).substring(7),
      amount,
      currency,
      status: 'requires_payment_method',
      createdAt: new Date().toISOString(),
    };
  }

  async validatePaymentMethod(
    paymentMethodId: string,
  ): Promise<ValidationResult> {
    this.logger.log('Validating payment method: ' + paymentMethodId);

    // Mock validation
    const isValid = paymentMethodId.startsWith('pm_');

    return {
      valid: isValid,
      errors: isValid ? [] : ['Invalid payment method ID format'],
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class PaymentProcessingTool extends BaseStructuredTool {
  readonly name = 'payment_processing';
  readonly description =
    'Process payments, manage transactions, handle refunds and payment validation';
  readonly category = ToolCategory.FINANCE;
  readonly inputSchema = PaymentProcessingInputSchema;

  private readonly log = new Logger(PaymentProcessingTool.name);
  private readonly provider: IPaymentProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockPaymentProvider();
  }

  protected async executeImpl(
    input: PaymentProcessingInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Payment action: ' + input.action);

    try {
      switch (input.action) {
        case 'process_payment':
          return await this.handleProcessPayment(input);
        case 'refund_payment':
          return await this.handleRefundPayment(input);
        case 'get_payment_status':
          return await this.handleGetPaymentStatus(input);
        case 'list_transactions':
          return await this.handleListTransactions(input);
        case 'create_payment_intent':
          return await this.handleCreatePaymentIntent(input);
        case 'validate_payment_method':
          return await this.handleValidatePaymentMethod(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('Payment action failed: ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleProcessPayment(
    input: PaymentProcessingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.amount || !input.paymentMethodId) {
      throw new Error(
        'amount and paymentMethodId are required for process_payment action',
      );
    }

    const result = await this.provider.processPayment(
      input.amount,
      input.currency || 'USD',
      input.paymentMethodId,
      {
        capture: input.options?.capture,
        receiptEmail: input.options?.receiptEmail,
        description: input.options?.description,
        metadata: input.metadata,
      },
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleRefundPayment(
    input: PaymentProcessingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.paymentIntentId) {
      throw new Error('paymentIntentId is required for refund_payment action');
    }

    const result = await this.provider.refundPayment(
      input.paymentIntentId,
      input.amount,
      input.reason,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetPaymentStatus(
    input: PaymentProcessingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.paymentIntentId) {
      throw new Error(
        'paymentIntentId is required for get_payment_status action',
      );
    }

    const result = await this.provider.getPaymentStatus(input.paymentIntentId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListTransactions(
    input: PaymentProcessingInput,
  ): Promise<StructuredToolResult<unknown>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.listTransactions(page, limit, {
      customerId: input.customerId,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleCreatePaymentIntent(
    input: PaymentProcessingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.amount) {
      throw new Error('amount is required for create_payment_intent action');
    }

    const result = await this.provider.createPaymentIntent(
      input.amount,
      input.currency || 'USD',
      input.customerId,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleValidatePaymentMethod(
    input: PaymentProcessingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.paymentMethodId) {
      throw new Error(
        'paymentMethodId is required for validate_payment_method action',
      );
    }

    const result = await this.provider.validatePaymentMethod(
      input.paymentMethodId,
    );

    return {
      success: true,
      data: result,
    };
  }
}

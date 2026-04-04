/**
 * Invoice Generation Tool - P0-2 of remaining tools
 * Enables AI agents to create, manage, and send invoices for Finance (AP/AR)
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for invoice operations
 * - OCP: Extensible via invoice storage providers
 * - DIP: Depends on abstractions for payment gateways
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

export const InvoiceActionEnum = z.enum([
  'create_invoice',
  'list_invoices',
  'get_invoice',
  'update_invoice',
  'send_invoice',
  'mark_paid',
  'delete_invoice',
]);

export type InvoiceAction = z.infer<typeof InvoiceActionEnum>;

export const InvoiceItemSchema = z.object({
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export const InvoiceInputSchema = z.object({
  action: InvoiceActionEnum.describe('The invoice action to perform'),
  invoiceId: z
    .string()
    .optional()
    .describe('Invoice ID for get/update/send/mark_paid/delete'),
  customerId: z.string().optional().describe('Customer ID for create'),
  customerName: z.string().optional().describe('Customer name'),
  customerEmail: z.string().email().optional().describe('Customer email'),
  customerAddress: z.string().optional().describe('Customer billing address'),
  dueDate: z.string().optional().describe('Invoice due date (ISO)'),
  items: z.array(InvoiceItemSchema).optional().describe('Invoice line items'),
  notes: z.string().optional().describe('Invoice notes'),
  taxRate: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Tax rate percentage'),
  status: z
    .enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
    .optional()
    .describe('Invoice status for update'),
  paymentMethod: z
    .enum(['bank_transfer', 'credit_card', 'paypal', 'check'])
    .optional()
    .describe('Payment method for mark_paid'),
});

export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

export const InvoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  customerAddress: z.string().optional(),
  items: z.array(InvoiceItemSchema),
  subtotal: z.number(),
  taxAmount: z.number(),
  total: z.number(),
  dueDate: z.date(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  notes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  paidAt: z.date().optional(),
  sentAt: z.date().optional(),
});

export const InvoiceOutputSchema = z.object({
  action: z.string(),
  invoice: InvoiceSchema.optional(),
  invoices: z.array(InvoiceSchema).optional(),
  invoiceId: z.string().optional(),
  message: z.string().optional(),
});

export type InvoiceOutput = z.infer<typeof InvoiceOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

interface IInvoiceStorage {
  create(
    invoice: z.infer<typeof InvoiceSchema>,
  ): Promise<z.infer<typeof InvoiceSchema>>;
  list(): Promise<z.infer<typeof InvoiceSchema>[]>;
  get(id: string): Promise<z.infer<typeof InvoiceSchema>>;
  update(
    id: string,
    data: Partial<z.infer<typeof InvoiceSchema>>,
  ): Promise<z.infer<typeof InvoiceSchema>>;
  delete(id: string): Promise<void>;
}

interface IPaymentGateway {
  sendInvoice(
    invoice: z.infer<typeof InvoiceSchema>,
  ): Promise<{ success: boolean; message: string }>;
  processPayment(
    invoiceId: string,
    method: string,
  ): Promise<{ success: boolean; transactionId: string }>;
}

// ─────────────────────────────────────────────────────────────
// Implementations
// ─────────────────────────────────────────────────────────────

@Injectable()
class LocalInvoiceStorage implements IInvoiceStorage {
  private invoices: Map<string, z.infer<typeof InvoiceSchema>> = new Map();
  private invoiceCounter = 1000;

  private generateId(): string {
    return `INV_${++this.invoiceCounter}_${Date.now().toString(36)}`;
  }

  async create(
    invoice: z.infer<typeof InvoiceSchema>,
  ): Promise<z.infer<typeof InvoiceSchema>> {
    const id = this.generateId();
    const newInvoice = {
      ...invoice,
      id,
      invoiceNumber: `INV-${this.invoiceCounter.toString().padStart(5, '0')}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.invoices.set(id, newInvoice);
    return newInvoice;
  }

  async list(): Promise<z.infer<typeof InvoiceSchema>[]> {
    return Array.from(this.invoices.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async get(id: string): Promise<z.infer<typeof InvoiceSchema>> {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      throw new Error(`Invoice not found: ${id}`);
    }
    return invoice;
  }

  async update(
    id: string,
    data: Partial<z.infer<typeof InvoiceSchema>>,
  ): Promise<z.infer<typeof InvoiceSchema>> {
    const invoice = await this.get(id);
    const updated = {
      ...invoice,
      ...data,
      updatedAt: new Date(),
    };
    this.invoices.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.invoices.has(id)) {
      throw new Error(`Invoice not found: ${id}`);
    }
    this.invoices.delete(id);
  }
}

@Injectable()
class MockPaymentGateway implements IPaymentGateway {
  async sendInvoice(
    invoice: z.infer<typeof InvoiceSchema>,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.customerEmail}`,
    };
  }

  async processPayment(
    invoiceId: string,
    method: string,
  ): Promise<{ success: boolean; transactionId: string }> {
    return {
      success: true,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Main Tool
// ─────────────────────────────────────────────────────────────

@Injectable()
export class InvoiceGenerationTool extends BaseStructuredTool {
  readonly name = 'invoice_generation';
  readonly description =
    'Create, manage, and send invoices for Finance departments. Use for Accounts Payable, Accounts Receivable, billing, and payment tracking.';
  readonly category = ToolCategory.FINANCE;
  readonly inputSchema = InvoiceInputSchema;

  private readonly storage: IInvoiceStorage;
  private readonly paymentGateway: IPaymentGateway;

  constructor(private readonly config: ConfigService) {
    super();
    this.storage = new LocalInvoiceStorage();
    this.paymentGateway = new MockPaymentGateway();
  }

  protected async executeImpl(
    input: InvoiceInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<unknown>> {
    const startTime = Date.now();
    const { action } = input;

    try {
      switch (action) {
        case 'create_invoice':
          return await this.handleCreateInvoice(input, startTime);
        case 'list_invoices':
          return await this.handleListInvoices(startTime);
        case 'get_invoice':
          return await this.handleGetInvoice(input, startTime);
        case 'update_invoice':
          return await this.handleUpdateInvoice(input, startTime);
        case 'send_invoice':
          return await this.handleSendInvoice(input, startTime);
        case 'mark_paid':
          return await this.handleMarkPaid(input, startTime);
        case 'delete_invoice':
          return await this.handleDeleteInvoice(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(`Invoice action ${action} failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private calculateTotals(
    items: z.infer<typeof InvoiceItemSchema>[],
    taxRate?: number,
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = taxRate ? subtotal * (taxRate / 100) : 0;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }

  private async handleCreateInvoice(
    input: InvoiceInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const {
      customerId,
      customerName,
      customerEmail,
      customerAddress,
      dueDate,
      items,
      notes,
      taxRate,
    } = input;

    if (
      !customerId ||
      !customerName ||
      !customerEmail ||
      !items ||
      items.length === 0
    ) {
      return {
        success: false,
        error:
          'customerId, customerName, customerEmail, and items are required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const { subtotal, taxAmount, total } = this.calculateTotals(items, taxRate);

    const invoiceData: z.infer<typeof InvoiceSchema> = {
      id: '',
      invoiceNumber: '',
      customerId,
      customerName,
      customerEmail,
      customerAddress: customerAddress || '',
      items,
      subtotal,
      taxAmount,
      total,
      dueDate: dueDate
        ? new Date(dueDate)
        : new Date(Date.now() + 30 * 86400000),
      status: 'draft',
      notes: notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const invoice = await this.storage.create(invoiceData);

    return {
      success: true,
      data: {
        action: 'create_invoice',
        invoice,
        message: `Invoice ${invoice.invoiceNumber} created successfully for ${customerName}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleListInvoices(
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const invoices = await this.storage.list();

    return {
      success: true,
      data: {
        action: 'list_invoices',
        invoices,
        message: `Retrieved ${invoices.length} invoices`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleGetInvoice(
    input: InvoiceInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { invoiceId } = input;

    if (!invoiceId) {
      return {
        success: false,
        error: 'invoiceId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const invoice = await this.storage.get(invoiceId);

    return {
      success: true,
      data: {
        action: 'get_invoice',
        invoice,
        message: `Retrieved invoice: ${invoice.invoiceNumber}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleUpdateInvoice(
    input: InvoiceInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { invoiceId, status, notes, dueDate } = input;

    if (!invoiceId) {
      return {
        success: false,
        error: 'invoiceId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const updateData: Partial<z.infer<typeof InvoiceSchema>> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (dueDate) updateData.dueDate = new Date(dueDate);

    const invoice = await this.storage.update(invoiceId, updateData);

    return {
      success: true,
      data: {
        action: 'update_invoice',
        invoice,
        message: `Invoice ${invoice.invoiceNumber} updated`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleSendInvoice(
    input: InvoiceInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { invoiceId } = input;

    if (!invoiceId) {
      return {
        success: false,
        error: 'invoiceId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const invoice = await this.storage.get(invoiceId);
    const result = await this.paymentGateway.sendInvoice(invoice);

    if (result.success) {
      await this.storage.update(invoiceId, {
        status: 'sent',
        sentAt: new Date(),
      });
    }

    return {
      success: result.success,
      data: {
        action: 'send_invoice',
        invoiceId,
        message: result.message,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleMarkPaid(
    input: InvoiceInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { invoiceId, paymentMethod } = input;

    if (!invoiceId) {
      return {
        success: false,
        error: 'invoiceId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const invoice = await this.storage.get(invoiceId);
    const paymentResult = await this.paymentGateway.processPayment(
      invoiceId,
      paymentMethod || 'bank_transfer',
    );

    if (paymentResult.success) {
      await this.storage.update(invoiceId, {
        status: 'paid',
        paidAt: new Date(),
      });
    }

    return {
      success: paymentResult.success,
      data: {
        action: 'mark_paid',
        invoiceId,
        transactionId: paymentResult.transactionId,
        message: `Invoice ${invoice.invoiceNumber} marked as paid`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleDeleteInvoice(
    input: InvoiceInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { invoiceId } = input;

    if (!invoiceId) {
      return {
        success: false,
        error: 'invoiceId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    await this.storage.delete(invoiceId);

    return {
      success: true,
      data: {
        action: 'delete_invoice',
        invoiceId,
        message: `Invoice ${invoiceId} deleted`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BillingEventsService } from './billing-events.service';
import { TaxService } from './tax.service';
import type {
  CreateInvoiceInput,
  IInvoiceService,
  LineItem,
  InvoiceListResult,
  InvoiceWithRelations,
} from '../interfaces/finance.interfaces';
import { Decimal } from '@prisma/client/runtime/library';
import { Invoice } from '@prisma/client';

/**
 * InvoiceService — Phase 4.4
 *
 * SRP: CRUD for invoices + lifecycle transitions. Tax and events are delegated.
 * OCP: New invoice types or PDF generation can extend this via override/decoration.
 * DIP: Depends on injected BillingEventsService & TaxService abstractions.
 */
@Injectable()
export class InvoiceService implements IInvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private invoiceCounter = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingEvents: BillingEventsService,
    private readonly taxService: TaxService,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async nextNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private computeTotals(lineItems: LineItem[], region = 'default') {
    const subtotal = lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const tax = this.taxService.calculate(subtotal, region);
    const total = subtotal + tax.taxAmount;
    return { subtotal, taxAmount: tax.taxAmount, total };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const {
      tenantId,
      currency = 'USD',
      lineItems,
      dueAt,
      notes,
      metadata,
    } = input;

    // Enrich line items with computed amounts
    const enriched: LineItem[] = lineItems.map((li) => ({
      ...li,
      amount: li.qty * li.unitPrice,
    }));

    const { subtotal, taxAmount, total } = this.computeTotals(enriched);
    const number = await this.nextNumber(tenantId);

    const invoice = await this.prisma.invoice.create({
      data: {
        number,
        tenantId,
        currency,
        subtotal: subtotal as unknown as Decimal,
        taxAmount: taxAmount as unknown as Decimal,
        total: total as unknown as Decimal,
        lineItems: enriched as never,
        dueAt: dueAt ?? null,
        notes: notes ?? null,
        metadata: (metadata ?? {}) as never,
      },
    });

    await this.billingEvents.emit(
      tenantId,
      'INVOICE_CREATED',
      { invoiceId: invoice.id, number, total },
      invoice.id,
    );
    this.logger.log(`Invoice ${number} created for tenant ${tenantId}`);
    return invoice;
  }

  async findAll(
    tenantId: string | null,
    page = 1,
    limit = 20,
  ): Promise<InvoiceListResult> {
    const skip = (page - 1) * limit;
    const where = tenantId ? { tenantId } : undefined;
    const data = await this.prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const total = await this.prisma.invoice.count({ where });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { expenses: true, billingEvents: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  async issue(id: string, tenantId: string): Promise<Invoice> {
    const invoice = await this.findOne(id, tenantId);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'ISSUED', issuedAt: new Date() },
    });
    await this.billingEvents.emit(
      tenantId,
      'INVOICE_ISSUED',
      { invoiceId: id },
      id,
    );
    return updated;
  }

  async markPaid(id: string, tenantId: string): Promise<Invoice> {
    await this.findOne(id, tenantId);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await this.billingEvents.emit(
      tenantId,
      'INVOICE_PAID',
      { invoiceId: id },
      id,
    );
    return updated;
  }

  async cancel(id: string, tenantId: string): Promise<Invoice> {
    await this.findOne(id, tenantId);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.billingEvents.emit(
      tenantId,
      'INVOICE_CANCELLED',
      { invoiceId: id },
      id,
    );
    return updated;
  }
}

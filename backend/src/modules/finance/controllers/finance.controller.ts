import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { InvoiceService } from '../services/invoice.service';
import { BillingCalculatorService } from '../services/billing-calculator.service';
import { BillingEventsService } from '../services/billing-events.service';
import { TaxService } from '../services/tax.service';
import { CreateInvoiceDto } from '../dto/invoice.dto';
import { RecordExpenseDto } from '../dto/expense.dto';
import { BillingFilterDto } from '../dto/billing-filter.dto';

function resolveTenantId(user: JwtPayload, explicit?: string): string {
  if (user.role === UserRole.SUPER_ADMIN) {
    if (!explicit) throw new Error('tenantId is required for SUPER_ADMIN');
    return explicit;
  }
  return user.tenantId!;
}

@Controller({ path: 'finance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly calculator: BillingCalculatorService,
    private readonly billingEvents: BillingEventsService,
    private readonly taxService: TaxService,
  ) {}

  // ─── Invoices ─────────────────────────────────────────────────────────────

  @Post('invoices/generate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  async generateInvoice(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInvoiceDto,
  ) {
    const tenantId = resolveTenantId(user, dto.tenantId);
    const lineItems = dto.lineItems.map((li) => ({
      description: li.description,
      qty: li.qty,
      unitPrice: li.unitPrice,
      amount: li.qty * li.unitPrice,
    }));
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    return this.invoiceService.create({ ...dto, tenantId, lineItems, dueAt });
  }

  @Get('invoices')
  async listInvoices(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') qTenantId: string | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // SUPER_ADMIN without explicit tenantId lists all invoices across tenants
    const tenantId =
      user.role === UserRole.SUPER_ADMIN && !qTenantId
        ? null
        : resolveTenantId(user, qTenantId);
    return this.invoiceService.findAll(
      tenantId,
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @Get('invoices/:id')
  async getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('tenantId') qTenantId?: string,
  ) {
    const tenantId = resolveTenantId(user, qTenantId);
    return this.invoiceService.findOne(id, tenantId);
  }

  @Post('invoices/:id/issue')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  async issueInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('tenantId') qTenantId?: string,
  ) {
    const tenantId = resolveTenantId(user, qTenantId);
    return this.invoiceService.issue(id, tenantId);
  }

  @Post('invoices/:id/paid')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  async markPaid(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('tenantId') qTenantId?: string,
  ) {
    const tenantId = resolveTenantId(user, qTenantId);
    return this.invoiceService.markPaid(id, tenantId);
  }

  @Post('invoices/:id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  async cancelInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('tenantId') qTenantId?: string,
  ) {
    const tenantId = resolveTenantId(user, qTenantId);
    return this.invoiceService.cancel(id, tenantId);
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  @Post('expenses')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
  async recordExpense(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordExpenseDto,
  ) {
    const tenantId = resolveTenantId(user, dto.tenantId);
    return this.calculator.recordExpense(
      tenantId,
      dto.category,
      dto.description,
      dto.amountUsd,
      {
        agentId: dto.agentId,
        invoiceId: dto.invoiceId,
        currency: dto.currency,
        metadata: dto.metadata as Record<string, unknown>,
      },
    );
  }

  @Get('expenses')
  async listExpenses(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') qTenantId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = resolveTenantId(user, qTenantId);
    return this.calculator.listExpenses(
      tenantId,
      Number(page ?? 1),
      Number(limit ?? 50),
    );
  }

  // ─── Billing events ───────────────────────────────────────────────────────

  @Get('billing-events')
  async listBillingEvents(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') qTenantId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = resolveTenantId(user, qTenantId);
    return this.billingEvents.findAll(
      tenantId,
      Number(page ?? 1),
      Number(limit ?? 50),
    );
  }

  // ─── Report ───────────────────────────────────────────────────────────────

  @Get('report')
  async billingReport(
    @CurrentUser() user: JwtPayload,
    @Query() filter: BillingFilterDto,
  ) {
    const tenantId = resolveTenantId(user, filter.tenantId);

    if (filter.year && filter.month) {
      return this.calculator.calculateMonthly(
        tenantId,
        Number(filter.year),
        Number(filter.month),
      );
    }

    const from = filter.from
      ? new Date(filter.from)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = filter.to ? new Date(filter.to) : new Date();
    return this.calculator.calculatePeriod(tenantId, from, to);
  }

  // ─── Tax helpers ─────────────────────────────────────────────────────────

  @Get('tax/rate')
  getTaxRate(@Query('region') region: string) {
    return { region, rate: this.taxService.getRate(region ?? 'default') };
  }
}

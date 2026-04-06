/**
 * Costs Controller
 *
 * REST API endpoints for cost tracking and budget management
 * Following SOLID: Single Responsibility - only handles HTTP
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CostsService } from './services/costs.service';
import { CsvExportService } from '../../shared/services/csv-export.service';
import { CreateBudgetPolicyDto, UpdateBudgetPolicyDto } from './dto/cost.dto';

@Controller({ path: 'costs', version: '1' })
@UseGuards(JwtAuthGuard)
export class CostsController {
  constructor(
    private readonly costsService: CostsService,
    private readonly csvExportService: CsvExportService,
  ) {}

  /**
   * Get cost summary for tenant
   * GET /api/v1/costs/summary
   */
  @Get('summary')
  async getCostSummary(
    @Req() req: { user: { tenantId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.user.tenantId;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costsService.getTenantCostSummary(tenantId, start, end);
  }

  /**
   * Get cost breakdown by agent
   * GET /api/v1/costs/by-agent
   */
  @Get('by-agent')
  async getCostByAgent(
    @Req() req: { user: { tenantId: string } },
    @Query('agentId') agentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.user.tenantId;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costsService.getCostByAgent(tenantId, agentId, start, end);
  }

  /**
   * Get cost breakdown by model
   * GET /api/v1/costs/by-model
   */
  @Get('by-model')
  async getCostByModel(
    @Req() req: { user: { tenantId: string } },
    @Query('model') model: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.user.tenantId;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costsService.getCostByModel(tenantId, model, start, end);
  }

  /**
   * Get cost breakdown by provider
   * GET /api/v1/costs/by-provider
   */
  @Get('by-provider')
  async getCostByProvider(
    @Req() req: { user: { tenantId: string } },
    @Query('provider') provider: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.user.tenantId;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costsService.getCostByProvider(tenantId, provider, start, end);
  }

  /**
   * Get cost records list
   * GET /api/v1/costs/records
   */
  @Get('records')
  async getCostRecords(
    @Req() req: { user: { tenantId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('agentId') agentId?: string,
    @Query('provider') provider?: string,
    @Query('model') model?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tenantId = req.user.tenantId;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costsService.getCostRecords(tenantId, start, end, {
      agentId,
      provider,
      model,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ─── Budget Policy Endpoints ───────────────────────────────────────────────

  /**
   * Get all budget policies
   * GET /api/v1/costs/budgets
   */
  @Get('budgets')
  async getBudgetPolicies(@Req() req: { user: { tenantId: string } }) {
    return this.costsService.getBudgetPolicies(req.user.tenantId);
  }

  /**
   * Create a new budget policy
   * POST /api/v1/costs/budgets
   */
  @Post('budgets')
  async createBudgetPolicy(
    @Req() req: { user: { tenantId: string } },
    @Body() dto: CreateBudgetPolicyDto,
  ) {
    return this.costsService.createBudgetPolicy({
      ...dto,
      tenantId: req.user.tenantId,
    });
  }

  /**
   * Update a budget policy
   * PATCH /api/v1/costs/budgets/:id
   */
  @Patch('budgets/:id')
  async updateBudgetPolicy(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetPolicyDto,
  ) {
    return this.costsService.updateBudgetPolicy(id, dto);
  }

  /**
   * Delete a budget policy
   * DELETE /api/v1/costs/budgets/:id
   */
  @Delete('budgets/:id')
  async deleteBudgetPolicy(@Param('id') id: string) {
    await this.costsService.deleteBudgetPolicy(id);
    return { success: true };
  }

  /**
   * Get active budget incidents
   * GET /api/v1/costs/incidents
   */
  @Get('incidents')
  async getActiveIncidents(@Req() req: { user: { tenantId: string } }) {
    return this.costsService.getActiveIncidents(req.user.tenantId);
  }

  /**
   * Acknowledge a budget incident
   * POST /api/v1/costs/incidents/:id/acknowledge
   */
  @Post('incidents/:id/acknowledge')
  async acknowledgeIncident(@Param('id') id: string) {
    await this.costsService.acknowledgeIncident(id);
    return { success: true };
  }

  /**
   * Resolve a budget incident
   * POST /api/v1/costs/incidents/:id/resolve
   */
  @Post('incidents/:id/resolve')
  async resolveIncident(@Param('id') id: string) {
    await this.costsService.resolveIncident(id);
    return { success: true };
  }

  /**
   * Get cost breakdown by agent with names
   * GET /api/v1/costs/breakdown/by-agent
   */
  @Get('breakdown/by-agent')
  async getCostByAgentBreakdown(
    @Req() req: { user: { tenantId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.user.tenantId;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costsService.getCostByAgentBreakdown(tenantId, start, end);
  }

  /**
   * Get cost breakdown by model
   * GET /api/v1/costs/breakdown/by-model
   */
  @Get('breakdown/by-model')
  async getCostByModelBreakdown(
    @Req() req: { user: { tenantId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.user.tenantId;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costsService.getCostByModelBreakdown(tenantId, start, end);
  }

  /**
   * GET /api/v1/costs/export/csv — download cost records as CSV (Phase 3.2)
   */
  @Get('export/csv')
  async exportCsv(
    @Req() req: { user: { tenantId: string } },
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.user.tenantId;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const summary = await this.costsService.getTenantCostSummary(
      tenantId,
      start,
      end,
    );
    const rows = [
      {
        metric: 'totalCost',
        value: String((summary as Record<string, unknown>)['totalCost'] ?? ''),
        start: start.toISOString(),
        end: end.toISOString(),
      },
    ];
    const csv = this.csvExportService.toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="costs-${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }
}

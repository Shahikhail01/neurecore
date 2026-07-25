/**
 * Compliance Controller
 *
 * Stage 2 Phase 2A: REST endpoints for compliance checklist evaluation.
 *
 * All endpoints are tenant-scoped via JWT.
 */

import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { IndustryComplianceService } from './industry-compliance.service';
import type { ComplianceChecklist } from './interfaces/compliance.interface';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller({ path: 'compliance', version: '1' })
export class ComplianceController {
  constructor(
    private readonly complianceService: IndustryComplianceService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('checklist/:industryGroup')
  async getChecklist(
    @Req() req: { user: { tenantId: string } },
    @Param('industryGroup') industryGroup: string,
    @Query('industrySlug') industrySlug?: string,
  ): Promise<ComplianceChecklist> {
    return this.complianceService.getChecklist(
      req.user.tenantId,
      industryGroup,
      industrySlug,
    );
  }

  @Get('checklists')
  async getAllChecklists(
    @Req() req: { user: { tenantId: string } },
  ): Promise<ComplianceChecklist[]> {
    return this.complianceService.getChecklistsForAllGroups(req.user.tenantId);
  }

  @Get('score/:industryGroup')
  async getComplianceScore(
    @Req() req: { user: { tenantId: string } },
    @Param('industryGroup') industryGroup: string,
  ): Promise<{ industryGroup: string; complianceScore: number }> {
    const score = await this.complianceService.evaluateComplianceScore(
      req.user.tenantId,
      industryGroup,
    );
    return { industryGroup, complianceScore: score };
  }

  /**
   * GET /api/v1/compliance/dashboard-metrics?group=<groupSlug>
   * Stage 2: Aggregates metric values needed by the IndustryDashboardRenderer.
   * Returns KPI data, chart data, and list item placeholders keyed by metric name.
   */
  @Get('dashboard-metrics')
  async getDashboardMetrics(
    @Req() req: { user: { tenantId: string } },
    @Query('group') group?: string,
  ): Promise<{
    metricValues: Record<
      string,
      { value: string | number; delta?: number; deltaLabel?: string }
    >;
    complianceScore: number;
  }> {
    const tenantId = req.user.tenantId;

    const [customerStats, complianceScore] = await Promise.all([
      this.prisma.customer.count({ where: { tenantId, status: 'ACTIVE' } }),
      group
        ? this.complianceService.evaluateComplianceScore(tenantId, group)
        : Promise.resolve(0),
    ]);

    const totalCustomers = customerStats;

    return {
      metricValues: {
        totalClients: { value: totalCustomers },
        complianceScore: { value: complianceScore, deltaLabel: 'target: 95%' },
        pipelineValue: { value: '—' },
        activeEngagements: { value: '—' },
        totalPatients: { value: totalCustomers },
        appointmentsToday: { value: '—' },
        noShowRate: { value: '—' },
        bedOccupancy: { value: '—' },
        activeProjects: { value: '—' },
        slaCompliance: { value: '—' },
        ticketResolution: { value: '—' },
        revenueMRR: { value: '—' },
        dailyRevenue: { value: '—' },
        ordersToday: { value: '—' },
        inventoryAccuracy: { value: '—' },
        campaignROI: { value: '—' },
        productionOutput: { value: '—' },
        safetyIncidents: { value: '—' },
        equipmentUptime: { value: '—' },
        workOrdersOpen: { value: '—' },
        activeCases: { value: '—' },
        grantsAwarded: { value: '—' },
        volunteerHours: { value: '—' },
        programCompletion: { value: '—' },
        cropYield: { value: '—' },
        livestockCount: { value: '—' },
        qualityPassRate: { value: '—' },
        waterUsage: { value: '—' },
        totalEntities: { value: '—' },
        portfolioValue: { value: '—' },
        governanceScore: { value: '—' },
        riskScore: { value: '—' },
        kycVerificationRate: { value: '—' },
        fraudAlerts: { value: '—' },
        regulatoryFindings: { value: '—' },
        noShowPrediction: { value: '—' },
        avgWaitTime: { value: '—' },
        hipaaCompliance: { value: '—' },
        clinicalOutcomes: { value: '—' },
        slaBreachRisk: { value: '—' },
        ticketAutoTriageRate: { value: '—' },
        engagementProfitMargin: { value: '—' },
        deploymentFrequency: { value: '—' },
        inventoryTurnover: { value: '—' },
        orderFulfillmentTime: { value: '—' },
        campaignConversionRate: { value: '—' },
        customerLTV: { value: '—' },
        OEE: { value: '—' },
        maintenanceCompliance: { value: '—' },
        downtimeHours: { value: '—' },
        workOrderBacklog: { value: '—' },
        grantUtilizationRate: { value: '—' },
        volunteerRetention: { value: '—' },
        caseResolutionTime: { value: '—' },
        beneficiariesServed: { value: '—' },
        yieldProjection: { value: '—' },
        qualityRejectionRate: { value: '—' },
        distributionEfficiency: { value: '—' },
        inputCostPerAcre: { value: '—' },
        portfolioDiversification: { value: '—' },
        entityPerformance: { value: '—' },
        governanceCompliance: { value: '—' },
        consolidatedCashFlow: { value: '—' },
      },
      complianceScore,
    };
  }
}

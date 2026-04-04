/**
 * Ad Optimization API Tool - P2-2 of remaining tools
 * Enables AI agents to optimize paid advertising campaigns
 * For Marketing, Ad Optimizer agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for ad optimization operations
 * - OCP: Extensible via ad provider interfaces
 * - DIP: Depends on abstractions for ad providers
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

export const AdOptimizationActionEnum = z.enum([
  'get_campaign_performance',
  'optimize_bid',
  'optimize_targeting',
  'get_recommendations',
  'analyze_competitors',
  'manage_budget',
]);

export type AdOptimizationAction = z.infer<typeof AdOptimizationActionEnum>;

export const AdOptimizationInputSchema = z.object({
  action: AdOptimizationActionEnum.describe(
    'The ad optimization action to perform',
  ),
  campaignId: z.string().optional().describe('Campaign ID'),
  adGroupId: z.string().optional().describe('Ad group ID'),
  platform: z
    .enum(['google', 'facebook', 'linkedin', 'twitter', 'tiktok'])
    .optional()
    .describe('Ad platform'),
  keywords: z
    .array(z.string())
    .optional()
    .describe('Keywords for competitor analysis'),
  metrics: z
    .object({
      ctr: z.number().optional(),
      cpc: z.number().optional(),
      conversionRate: z.number().optional(),
      roas: z.number().optional(),
    })
    .optional()
    .describe('Target metrics'),
  options: z
    .object({
      budget: z.number().positive().optional(),
      maxBid: z.number().positive().optional(),
      targetAudience: z.record(z.unknown()).optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type AdOptimizationInput = z.infer<typeof AdOptimizationInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type CampaignPerformance = {
  campaignId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  roas: number;
  dateRange: string;
};

type BidOptimization = {
  suggestedBid: number;
  confidence: number;
  reasoning: string;
  projectedResults: {
    clicks: number;
    conversions: number;
    spend: number;
  };
};

type TargetingOptimization = {
  addedKeywords: string[];
  removedKeywords: string[];
  audienceSegments: string[];
  excludedAudiences: string[];
  recommendations: string[];
};

type AdRecommendations = {
  campaignId: string;
  priority: 'high' | 'medium' | 'low';
  recommendations: Array<{
    type: string;
    description: string;
    impact: string;
    effort: string;
  }>;
};

type CompetitorAnalysis = {
  competitor: string;
  adSpend: number;
  keywords: string[];
  estimatedReach: number;
  topAds: string[];
};

type BudgetManagement = {
  recommendedBudget: number;
  dailySpend: number;
  remainingBudget: number;
  pacing: 'on_track' | 'ahead' | 'behind';
  projections: {
    endOfMonthSpend: number;
    expectedClicks: number;
    expectedConversions: number;
  };
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IAdOptimizationProvider {
  getCampaignPerformance(campaignId: string): Promise<CampaignPerformance>;

  optimizeBid(
    campaignId: string,
    targetMetrics: { ctr?: number; cpc?: number; conversionRate?: number },
  ): Promise<BidOptimization>;

  optimizeTargeting(
    campaignId: string,
    options?: { maxBid?: number; targetAudience?: Record<string, unknown> },
  ): Promise<TargetingOptimization>;

  getRecommendations(campaignId: string): Promise<AdRecommendations[]>;

  analyzeCompetitors(
    platform: string,
    keywords: string[],
  ): Promise<CompetitorAnalysis[]>;

  manageBudget(campaignId: string, budget: number): Promise<BudgetManagement>;
}

// ─────────────────────────────────────────────────────────────
// Mock Ad Optimization Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockAdOptimizationProvider implements IAdOptimizationProvider {
  private readonly logger = new Logger(MockAdOptimizationProvider.name);

  async getCampaignPerformance(
    campaignId: string,
  ): Promise<CampaignPerformance> {
    this.logger.log('Getting campaign performance: ' + campaignId);

    const impressions = Math.floor(Math.random() * 100000) + 10000;
    const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
    const conversions = Math.floor(clicks * (Math.random() * 0.1 + 0.02));
    const spend = Math.random() * 5000 + 500;

    return {
      campaignId,
      impressions,
      clicks,
      conversions,
      spend,
      ctr: (clicks / impressions) * 100,
      cpc: spend / clicks,
      conversionRate: (conversions / clicks) * 100,
      roas: (conversions * 50) / spend,
      dateRange: 'last_30_days',
    };
  }

  async optimizeBid(
    campaignId: string,
    targetMetrics: { ctr?: number; cpc?: number; conversionRate?: number },
  ): Promise<BidOptimization> {
    this.logger.log('Optimizing bid for: ' + campaignId);

    const suggestedBid = Math.random() * 5 + 1;

    return {
      suggestedBid: Number(suggestedBid.toFixed(2)),
      confidence: 0.75 + Math.random() * 0.2,
      reasoning: 'Based on historical performance and target metrics',
      projectedResults: {
        clicks: Math.floor(Math.random() * 1000) + 500,
        conversions: Math.floor(Math.random() * 100) + 20,
        spend: Math.random() * 2000 + 500,
      },
    };
  }

  async optimizeTargeting(
    campaignId: string,
    options?: { maxBid?: number; targetAudience?: Record<string, unknown> },
  ): Promise<TargetingOptimization> {
    this.logger.log('Optimizing targeting for: ' + campaignId);

    return {
      addedKeywords: ['long-tail keyword 1', 'long-tail keyword 2'],
      removedKeywords: ['broad keyword'],
      audienceSegments: ['interest segment A', 'behavior segment B'],
      excludedAudiences: ['competitor audiences'],
      recommendations: [
        'Add lookalike audiences',
        'Exclude converting users',
        'Add negative keywords',
      ],
    };
  }

  async getRecommendations(campaignId: string): Promise<AdRecommendations[]> {
    this.logger.log('Getting recommendations for: ' + campaignId);

    return [
      {
        campaignId,
        priority: 'high',
        recommendations: [
          {
            type: 'Bid Adjustment',
            description: 'Increase bid for high-performing keywords',
            impact: 'Medium',
            effort: 'Low',
          },
          {
            type: 'Ad Copy',
            description: 'A/B test new ad variations',
            impact: 'High',
            effort: 'Medium',
          },
        ],
      },
    ];
  }

  async analyzeCompetitors(
    platform: string,
    keywords: string[],
  ): Promise<CompetitorAnalysis[]> {
    this.logger.log('Analyzing competitors on: ' + platform);

    return keywords.map((keyword) => ({
      competitor: 'Competitor ' + keyword.substring(0, 5),
      adSpend: Math.random() * 50000 + 10000,
      keywords: [keyword, keyword + ' premium', 'best ' + keyword],
      estimatedReach: Math.floor(Math.random() * 1000000) + 100000,
      topAds: ['Ad headline 1', 'Ad headline 2'],
    }));
  }

  async manageBudget(
    campaignId: string,
    budget: number,
  ): Promise<BudgetManagement> {
    this.logger.log('Managing budget for: ' + campaignId);

    const dailySpend = Math.random() * (budget / 30) * 0.8;
    const remaining = budget - dailySpend;

    return {
      recommendedBudget: budget * 1.1,
      dailySpend: Number(dailySpend.toFixed(2)),
      remainingBudget: Number(remaining.toFixed(2)),
      pacing: remaining > budget / 2 ? 'on_track' : 'ahead',
      projections: {
        endOfMonthSpend: budget,
        expectedClicks: Math.floor(budget / 2),
        expectedConversions: Math.floor(budget / 40),
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class AdOptimizationTool extends BaseStructuredTool {
  readonly name = 'ad_optimization';
  readonly description =
    'Optimize ad campaigns, manage bids, budgets, and get performance recommendations';
  readonly category = ToolCategory.MARKETING;
  readonly inputSchema = AdOptimizationInputSchema;

  private readonly log = new Logger(AdOptimizationTool.name);
  private readonly provider: IAdOptimizationProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockAdOptimizationProvider();
  }

  protected async executeImpl(
    input: AdOptimizationInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Ad Optimization action: ' + input.action);

    try {
      switch (input.action) {
        case 'get_campaign_performance':
          return await this.handleGetCampaignPerformance(input);
        case 'optimize_bid':
          return await this.handleOptimizeBid(input);
        case 'optimize_targeting':
          return await this.handleOptimizeTargeting(input);
        case 'get_recommendations':
          return await this.handleGetRecommendations(input);
        case 'analyze_competitors':
          return await this.handleAnalyzeCompetitors(input);
        case 'manage_budget':
          return await this.handleManageBudget(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        'Ad Optimization action failed: ' + err.message,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  private async handleGetCampaignPerformance(
    input: AdOptimizationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.campaignId) {
      throw new Error(
        'campaignId is required for get_campaign_performance action',
      );
    }

    const result = await this.provider.getCampaignPerformance(input.campaignId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleOptimizeBid(
    input: AdOptimizationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.campaignId) {
      throw new Error('campaignId is required for optimize_bid action');
    }

    const result = await this.provider.optimizeBid(
      input.campaignId,
      input.metrics || {},
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleOptimizeTargeting(
    input: AdOptimizationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.campaignId) {
      throw new Error('campaignId is required for optimize_targeting action');
    }

    const result = await this.provider.optimizeTargeting(
      input.campaignId,
      input.options,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetRecommendations(
    input: AdOptimizationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.campaignId) {
      throw new Error('campaignId is required for get_recommendations action');
    }

    const result = await this.provider.getRecommendations(input.campaignId);

    return {
      success: true,
      data: { recommendations: result },
    };
  }

  private async handleAnalyzeCompetitors(
    input: AdOptimizationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.platform) {
      throw new Error('platform is required for analyze_competitors action');
    }

    const result = await this.provider.analyzeCompetitors(
      input.platform,
      input.keywords || [],
    );

    return {
      success: true,
      data: { competitors: result },
    };
  }

  private async handleManageBudget(
    input: AdOptimizationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.campaignId || !input.options?.budget) {
      throw new Error(
        'campaignId and budget are required for manage_budget action',
      );
    }

    const result = await this.provider.manageBudget(
      input.campaignId,
      input.options.budget,
    );

    return {
      success: true,
      data: result,
    };
  }
}

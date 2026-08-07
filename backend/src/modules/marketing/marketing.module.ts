/**
 * Phase 19 — Marketing module.
 *
 * SRP — owns the marketing skills + the BounceAnalyzerService.
 * Three capabilities: CR-AI-0801 (segmentation), CR-AI-0802
 * (campaign brief), CR-AI-0803 (bounce analyzer).
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SegmentSkill } from './skills/segment.skill';
import { CampaignBriefSkill } from './skills/campaign-brief.skill';
import { BounceAnalyzerService } from './services/bounce-analyzer.service';

@Module({
  imports: [DatabaseModule],
  providers: [SegmentSkill, CampaignBriefSkill, BounceAnalyzerService],
  exports: [SegmentSkill, CampaignBriefSkill, BounceAnalyzerService],
})
export class MarketingModule {}

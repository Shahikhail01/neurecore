/**
 * Phase 19 — Service module.
 *
 * Two skills: CR-AI-0902 (case-resolve) + CR-AI-0903 (case-response).
 * CR-AI-0901 (case classify + sentiment + urgency + SLA risk) is
 * already shipped via CaseClassifyProvider in `analytics/providers/`.
 */

import { Module } from '@nestjs/common';
import { CaseResolveSkill } from './skills/case-resolve.skill';
import { CaseResponseSkill } from './skills/case-response.skill';

@Module({
  providers: [CaseResolveSkill, CaseResponseSkill],
  exports: [CaseResolveSkill, CaseResponseSkill],
})
export class ServiceModule {}

/**
 * Phase 18 — Retention module.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §4.
 *
 * Closes CR-AI-1302 — typed RetentionPolicyDSL + chat-history bridge.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RetentionPoliciesService } from './retention-policies.service';

@Module({
  imports: [DatabaseModule],
  providers: [RetentionPoliciesService],
  exports: [RetentionPoliciesService],
})
export class RetentionModule {}

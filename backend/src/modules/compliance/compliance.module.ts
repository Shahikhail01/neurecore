/**
 * Compliance Posture Center — Module.
 */

import { Module } from '@nestjs/common';
import { CompliancePostureService } from './compliance-posture.service';
import { CompliancePostureController } from './compliance-posture.controller';

@Module({
  controllers: [CompliancePostureController],
  providers: [CompliancePostureService],
  exports: [CompliancePostureService],
})
export class ComplianceModule {}

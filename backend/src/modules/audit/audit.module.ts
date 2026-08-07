import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditEvidenceCorrelationService } from './audit-evidence-correlation.service';

/**
 * AuditModule — made @Global so AuditService can be injected anywhere
 * without re-importing the module (e.g. in auth, agents, governance).
 *
 * Phase 18: also exports AuditEvidenceCorrelationService
 * (CR-AI-1303 audit + evidence + observability).
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditEvidenceCorrelationService],
  exports: [AuditService, AuditEvidenceCorrelationService],
})
export class AuditModule {}

import { Module } from '@nestjs/common';
import { TenantTemplatesController } from './tenant-templates.controller';
import { TenantTemplateService } from './tenant-template.service';
import { TenantTemplateSeederService } from './tenant-template-seeder.service';
import { TenantTemplateRuntimeService } from './tenant-template-runtime.service';
import { AgentRoleValidator } from './validators/agent-role.validator';
import { LifecycleValidator } from './validators/lifecycle.validator';
import { RoutineValidator } from './validators/routine.validator';
import { ReportValidator } from './validators/report.validator';
import { TaskValidator } from './validators/task.validator';
import { DepartmentValidator } from './validators/department.validator';
import { ApprovalChainValidator } from './validators/approval-chain.validator';
import { VALIDATORS_TOKEN } from './validators/template-validator.interface';

const VALIDATORS = [
  AgentRoleValidator,
  LifecycleValidator,
  RoutineValidator,
  ReportValidator,
  TaskValidator,
  DepartmentValidator,
  // FIX-DEP-D3 (Round-3 verification, 2026-07-24): paired with the
  // APPROVAL_CHAIN enum value added in migration
  // 20260724_add_approval_chain_template_type.
  ApprovalChainValidator,
];

@Module({
  controllers: [TenantTemplatesController],
  providers: [
    TenantTemplateService,
    TenantTemplateSeederService,
    TenantTemplateRuntimeService,
    ...VALIDATORS,
    {
      provide: VALIDATORS_TOKEN,
      useFactory: (...validators: unknown[]) => validators,
      inject: VALIDATORS,
    },
  ],
  exports: [
    TenantTemplateService,
    TenantTemplateSeederService,
    TenantTemplateRuntimeService,
    ...VALIDATORS,
  ],
})
export class TenantTemplatesModule {}

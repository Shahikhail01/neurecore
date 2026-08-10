/**
 * EnterpriseAutonomyModule (Phase 6) — Governed Autonomous Operations.
 * Consumes Cognition (P5), Work Runtime (P4), Context Plane (P3 @Global),
 * Event Fabric (P2 @Global). Owns NO capability logic; every mutation still
 * flows through the Work Runtime.
 */

import { Module } from '@nestjs/common';
import { EnterpriseCognitionModule } from '../enterprise-cognition/enterprise-cognition.module';
import { AiEmployeeCoreModule } from '../ai-employee-core/ai-employee-core.module';
import {
  AI_EMPLOYEE_MANAGER, AI_DEPARTMENT_MANAGER,
  AUTONOMOUS_WATCHER, KPI_MONITOR, OKR_MONITOR, WORKLOAD_BALANCER,
  AUTONOMOUS_SUPERVISOR, AUTONOMY_GOVERNOR, AUTONOMY_POLICY_ENGINE,
  ENTERPRISE_HEALTH, ENTERPRISE_AUTONOMY,
} from './contracts/enterprise-autonomy.interface';
import { AutonomyRepository } from './repository/autonomy.repository';
import { AiEmployeeManager, AiDepartmentManager, AutonomyPolicyEngine, AutonomyGovernor } from './employees/autonomy-managers.service';
import { ProjectHealthWatcher, BudgetWatcher, ApprovalBottleneckWatcher, KpiMonitor, OkrMonitor, WorkloadBalancer, AutonomousSupervisor, EnterpriseHealthService } from './watchers/watchers.service';
import { EnterpriseAutonomyService } from './enterprise-autonomy.service';
import { EnterpriseAutonomyController } from './enterprise-autonomy.controller';

@Module({
  imports: [EnterpriseCognitionModule, AiEmployeeCoreModule],
  controllers: [EnterpriseAutonomyController],
  providers: [
    AutonomyRepository,
    // Employee / department
    AiEmployeeManager, { provide: AI_EMPLOYEE_MANAGER, useExisting: AiEmployeeManager },
    AiDepartmentManager, { provide: AI_DEPARTMENT_MANAGER, useExisting: AiDepartmentManager },
    // Policy + governor
    AutonomyPolicyEngine, { provide: AUTONOMY_POLICY_ENGINE, useExisting: AutonomyPolicyEngine },
    AutonomyGovernor, { provide: AUTONOMY_GOVERNOR, useExisting: AutonomyGovernor },
    // Watchers (injected explicitly, not via multi-provider)
    ProjectHealthWatcher, BudgetWatcher, ApprovalBottleneckWatcher,
    KpiMonitor, { provide: KPI_MONITOR, useExisting: KpiMonitor },
    OkrMonitor, { provide: OKR_MONITOR, useExisting: OkrMonitor },
    WorkloadBalancer, { provide: WORKLOAD_BALANCER, useExisting: WorkloadBalancer },
    AutonomousSupervisor, { provide: AUTONOMOUS_SUPERVISOR, useExisting: AutonomousSupervisor },
    EnterpriseHealthService, { provide: ENTERPRISE_HEALTH, useExisting: EnterpriseHealthService },
    // Orchestrator
    EnterpriseAutonomyService, { provide: ENTERPRISE_AUTONOMY, useExisting: EnterpriseAutonomyService },
  ],
  exports: [ENTERPRISE_AUTONOMY],
})
export class EnterpriseAutonomyModule {}

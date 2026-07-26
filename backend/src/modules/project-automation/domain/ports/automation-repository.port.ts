// src/modules/project-automation/domain/ports/automation-repository.port.ts
import { AutomationEventType, AutomationStatus } from '@prisma/client';

export const AUTOMATION_LOG_REPOSITORY = Symbol('AUTOMATION_LOG_REPOSITORY');

export interface AutomationLogEntry {
  id: string;
  projectId: string;
  event: AutomationEventType;
  status: AutomationStatus;
  triggeredBy: string;
  error?: string | null;
  createdAt: Date;
}

export interface CreateAutomationLogInput {
  projectId: string;
  event: AutomationEventType;
  status: AutomationStatus;
  triggeredBy: string;
  error?: string;
}

export interface IAutomationLogRepository {
  findCompletedForProject(
    tenantId: string,
    projectId: string,
    event: AutomationEventType,
  ): Promise<AutomationLogEntry | null>;

  create(
    input: CreateAutomationLogInput,
    tx?: any,
  ): Promise<AutomationLogEntry>;
}

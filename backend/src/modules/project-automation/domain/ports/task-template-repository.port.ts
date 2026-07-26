// src/modules/project-automation/domain/ports/task-template-repository.port.ts
export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');

export interface TaskTemplateItem {
  templateKey: string;
  title: string;
  requiredRole: string;
  requiredCapabilities: string[];
}

export interface TaskUpsertInput {
  tenantId: string;
  projectId: string;
  automationVersion: number;
  templateKey: string;
  title: string;
  goalId: string;
  requiredRole: string;
  requiredCapabilities: string[];
}

export interface ITaskRepository {
  upsertByTemplateKey(input: TaskUpsertInput, tx?: any): Promise<void>;
}

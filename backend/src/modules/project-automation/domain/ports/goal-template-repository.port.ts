// src/modules/project-automation/domain/ports/goal-template-repository.port.ts
export const GOAL_REPOSITORY = Symbol('GOAL_REPOSITORY');

export interface GoalTemplateItem {
  templateKey: string;
  title: string;
  description?: string;
}

export interface GoalUpsertInput {
  tenantId: string;
  projectId: string;
  automationVersion: number;
  templateKey: string;
  title: string;
  description?: string;
}

export interface GoalEntity {
  id: string;
  tenantId: string;
  projectId: string;
  templateKey: string | null;
  title: string;
}

export interface IGoalRepository {
  upsertByTemplateKey(input: GoalUpsertInput, tx?: any): Promise<GoalEntity>;

  findByProject(tenantId: string, projectId: string, tx?: any): Promise<GoalEntity[]>;
}

// src/modules/projects/migrations/automation-state-backfill.ts
export interface AutomationStateBackfill {
  projectId: string;
  classification: 'complete' | 'eligible_for_initialization' | 'needs_manual_review' | 'legacy_no_automation';
  recommendedAction?: string;
}

export const BACKFILL_CLASSIFICATION = {
  complete: 'Has goals, tasks, and assignments with evidence',
  eligible_for_initialization: 'Has project but no automation; eligible for setup',
  needs_manual_review: 'Partially automated; needs human assessment',
  legacy_no_automation: 'Created before automation system; requires migration',
};

export async function classifyProjectForBackfill(
  project: {
    id: string;
    goals: any[];
    tasks: any[];
    assignments: any[];
    evidence: any[];
  },
): Promise<AutomationStateBackfill> {
  const hasGoals = project.goals.length > 0;
  const hasTasks = project.tasks.length > 0;
  const hasAssignments = project.assignments.length > 0;
  const hasEvidence = project.evidence.length > 0;

  if (hasGoals && hasTasks && hasAssignments && hasEvidence) {
    return { projectId: project.id, classification: 'complete' };
  }

  if (hasGoals && hasTasks && hasAssignments && !hasEvidence) {
    return {
      projectId: project.id,
      classification: 'needs_manual_review',
      recommendedAction: 'Verify evidence exists in legacy system',
    };
  }

  if (hasGoals || hasTasks) {
    return {
      projectId: project.id,
      classification: 'eligible_for_initialization',
      recommendedAction: 'Run canonical automation to complete',
    };
  }

  return {
    projectId: project.id,
    classification: 'legacy_no_automation',
    recommendedAction: 'Run full automation setup',
  };
}

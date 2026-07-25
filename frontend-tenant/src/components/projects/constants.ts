import type { ProjectStatus, ProjectRole } from '@/services/projects.service';

export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  LEAD: ['PROPOSAL_SENT'],
  PROPOSAL_SENT: ['WON', 'LOST'],
  WON: ['ACTIVE'],
  LOST: ['ARCHIVED'],
  ACTIVE: ['ON_HOLD', 'REVIEW', 'COMPLETED'],
  ON_HOLD: ['ACTIVE'],
  REVIEW: ['ACTIVE', 'COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

export const PROJECT_ROLES: ProjectRole[] = [
  'PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'RESEARCH_LEAD', 'QUALITY_LEAD',
  'REVIEWER', 'COMPLIANCE_OFFICER', 'CLIENT_LIAISON', 'DOCUMENTATION_LEAD',
  'KNOWLEDGE_MANAGER', 'CHIEF_OF_STAFF',
];

export const MEMORY_CATEGORIES = ['NOTE', 'INSIGHT', 'CONSTRAINT', 'RISK', 'OPPORTUNITY', 'LESSON'] as const;

export const CATEGORY_COLORS: Record<(typeof MEMORY_CATEGORIES)[number], string> = {
  NOTE: 'bg-zinc-500/20 text-zinc-400',
  INSIGHT: 'bg-[color:var(--state-info)]/20 text-[color:var(--state-info)]',
  CONSTRAINT: 'bg-orange-500/20 text-orange-400',
  RISK: 'bg-[color:var(--state-danger)]/20 text-[color:var(--state-danger)]',
  OPPORTUNITY: 'bg-[color:var(--state-success)]/20 text-[color:var(--state-success)]',
  LESSON: 'bg-purple-500/20 text-purple-400',
};

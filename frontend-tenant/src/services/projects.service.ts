import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export type ProjectStatus =
  | 'LEAD'
  | 'PROPOSAL_SENT'
  | 'WON'
  | 'LOST'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'REVIEW'
  | 'COMPLETED'
  | 'ARCHIVED';

export type BudgetType = 'FIXED_FEE' | 'HOURLY' | 'RETAINER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Project {
  id: string;
  tenantId?: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  customerId?: string | null;
  initiationId?: string | null;
  customer?: { id: string; name: string } | null;
  projectTypeId?: string | null;
  projectTypeVersion?: number | null;
  budgetType?: BudgetType | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  priority?: Priority | null;
  tags: string[];
  targetDate?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  lostReason?: string | null;
  parentProjectId?: string | null;
  clonedFromProjectId?: string | null;
  goalIds: string[];
  departmentId?: string | null;
  customFieldValues?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type StageStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AT_RISK'
  | 'COMPLETED'
  | 'SKIPPED';

export interface ProjectStage {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  order: number;
  status: StageStatus;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ActorType = 'HUMAN' | 'AI' | 'SYSTEM';
export type ProjectRole =
  | 'PROJECT_DIRECTOR'
  | 'PROJECT_MANAGER'
  | 'RESEARCH_LEAD'
  | 'QUALITY_LEAD'
  | 'REVIEWER'
  | 'COMPLIANCE_OFFICER'
  | 'CLIENT_LIAISON'
  | 'DOCUMENTATION_LEAD'
  | 'KNOWLEDGE_MANAGER'
  | 'CHIEF_OF_STAFF';

export interface ProjectMember {
  id: string;
  projectId: string;
  actorId: string;
  actorType: ActorType;
  role: ProjectRole;
  assignedAt: string;
}

export const projectsService = {
  list: async (
    opts?: {
      status?: ProjectStatus;
      customerId?: string;
      departmentId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: Project[]; total: number }> => {
    const res = await api.get('/projects', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Project[], total: total ?? items.length };
  },

  get: async (id: string): Promise<Project | null> => {
    const res = await api.get(`/projects/${id}`);
    return unwrapItem(res);
  },

  create: async (payload: Partial<Project>): Promise<Project> => {
    const res = await api.post('/projects', payload);
    return unwrapItem(res) as Project;
  },

  update: async (
    id: string,
    payload: Partial<Project>,
  ): Promise<Project> => {
    const res = await api.patch(`/projects/${id}`, payload);
    return unwrapItem(res) as Project;
  },

  transitionStatus: async (
    id: string,
    status: ProjectStatus,
    reason?: string,
  ): Promise<Project> => {
    const res = await api.patch(`/projects/${id}/status`, {
      status,
      reason,
    });
    return unwrapItem(res) as Project;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },

  // Stages
  listStages: async (projectId: string): Promise<ProjectStage[]> => {
    const res = await api.get(`/projects/${projectId}/stages`);
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? data.data : data;
    return Array.isArray(inner) ? (inner as ProjectStage[]) : [];
  },

  createStage: async (
    projectId: string,
    dto: { name: string; description?: string; order: number },
  ): Promise<ProjectStage> => {
    const res = await api.post(`/projects/${projectId}/stages`, dto);
    return unwrapItem(res) as ProjectStage;
  },

  updateStage: async (
    projectId: string,
    stageId: string,
    dto: Partial<ProjectStage>,
  ): Promise<ProjectStage> => {
    const res = await api.patch(
      `/projects/${projectId}/stages/${stageId}`,
      dto,
    );
    return unwrapItem(res) as ProjectStage;
  },

  deleteStage: async (projectId: string, stageId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/stages/${stageId}`);
  },

  reorderStages: async (
    projectId: string,
    orderedIds: string[],
  ): Promise<ProjectStage[]> => {
    const res = await api.patch(`/projects/${projectId}/stages/reorder`, {
      orderedIds,
    });
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? data.data : data;
    return Array.isArray(inner) ? (inner as ProjectStage[]) : [];
  },

  // Members
  listMembers: async (projectId: string): Promise<ProjectMember[]> => {
    const res = await api.get(`/projects/${projectId}/members`);
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? data.data : data;
    return Array.isArray(inner) ? (inner as ProjectMember[]) : [];
  },

  assignMember: async (
    projectId: string,
    dto: { actorId: string; actorType: ActorType; role: ProjectRole },
  ): Promise<ProjectMember> => {
    const res = await api.post(`/projects/${projectId}/members`, dto);
    return unwrapItem(res) as ProjectMember;
  },

  removeMember: async (projectId: string, memberId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/members/${memberId}`);
  },

  reassignMemberRole: async (
    projectId: string,
    memberId: string,
    role: ProjectRole,
  ): Promise<ProjectMember> => {
    const res = await api.patch(
      `/projects/${projectId}/members/${memberId}/role`,
      { role },
    );
    return unwrapItem(res) as ProjectMember;
  },

  autoAssignChiefOfStaff: async (
    projectId: string,
    actorId: string,
  ): Promise<ProjectMember> => {
    const res = await api.post(`/projects/${projectId}/members/chief-of-staff`, {
      actorId,
    });
    return unwrapItem(res) as ProjectMember;
  },
};

/**
 * Agent Version — Domain Interfaces
 *
 * SOLID:
 *   ISP  — IAgentVersionRepository only contains version-related ops
 *   DIP  — Services and controllers depend on this abstraction, not on Prisma directly
 *   SRP  — One interface per role (writer vs reader vs rollback executor)
 */

// ─── Snapshot config shape ────────────────────────────────────────────────

export interface AgentConfigSnapshot {
  name: string;
  description?: string | null;
  model: string;
  systemPrompt?: string | null;
  instructions?: string | null;
  budgetPerDay?: number | string | null;
  permissions: unknown[];
  config: Record<string, unknown>;
}

// ─── DTO returned to callers ──────────────────────────────────────────────

export interface AgentVersionDto {
  id: string;
  agentId: string;
  tenantId: string;
  versionNumber: number;
  label: string | null;
  configSnapshot: AgentConfigSnapshot;
  changedBy: string;
  changeNote: string | null;
  isActive: boolean;
  createdAt: Date;
}

// ─── Input types ──────────────────────────────────────────────────────────

export interface CreateAgentVersionInput {
  agentId: string;
  tenantId: string;
  label?: string;
  configSnapshot: AgentConfigSnapshot;
  changedBy: string;
  changeNote?: string;
}

// ─── Repository interface (DIP) ───────────────────────────────────────────

export interface IAgentVersionRepository {
  /** Snapshot current agent config as next version, mark it active. */
  create(input: CreateAgentVersionInput): Promise<AgentVersionDto>;

  /** List all versions for an agent, newest first. */
  findByAgentId(agentId: string, tenantId: string): Promise<AgentVersionDto[]>;

  /** Return the currently-active version for an agent. */
  findActive(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto | null>;

  /**
   * Apply a specific version's snapshot back to the agent record
   * and mark that version as active.
   */
  rollback(
    agentId: string,
    tenantId: string,
    versionNumber: number,
  ): Promise<AgentVersionDto>;
}

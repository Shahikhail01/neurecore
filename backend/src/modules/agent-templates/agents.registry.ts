/**
 * AgentRegistry — Phase 13 runtime truth for the 6 OOB agents.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-13-14.md §3.
 *
 * Holds a `Map<AgentId, IAgentDefinition>` populated from the
 * canonical `OOB_AGENTS` array at boot. Consumers (`AgentsController`,
 * chat dispatcher, certification runner, integrity guard) depend
 * on the registry, never on the static import.
 *
 * SRP — list/get + boot registration only. Each OOB agent's run()
 * logic stays in its own file.
 *
 * OCP — adding an 8th OOB agent is one new instance file + one
 * import in `instances/index.ts` — zero changes to this class.
 *
 * DIP — depends only on the abstract `IAgentDefinition` interface,
 * never on Prisma. The OOB persistence (AgentTemplate / version
 * rows) is the existing `OobAgentRegistrationService`'s job; this
 * registry is the runtime cache for HTTP reads.
 *
 * Integrity rule (mirrored from `SkillRegistryImplementsFlag`):
 * if `implemented: true` is advertised in the OOB metadata but the
 * module failed to register the runtime instance, the controller
 * surfaces `implemented: false`. This guard fails CI in
 * `agent-registry-integrity.spec.ts`.
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  OOB_AGENTS,
  OOB_AGENT_INDEX,
  type OotbAgentDefinition,
} from './instances';
import { UNIVERSAL_AGENT_ID } from './instances/UNIVERSAL.agent';
import { PRODUCTIVITY_AGENT_ID } from './instances/PRODUCTIVITY.agent';
import { SALES_AGENT_ID } from './instances/SALES.agent';
import { MARKETING_AGENT_ID } from './instances/MARKETING.agent';
import { SERVICE_AGENT_ID } from './instances/SERVICE.agent';
import { KNOWLEDGE_AGENT_ID } from './instances/KNOWLEDGE.agent';

/**
 * Canonical agent id — matches the CR-AI-0501..0506 codes from the
 * baseline. The keys here are the runtime ids; the `name` field
 * below is the lowercase display name.
 */
export type AgentId =
  | typeof UNIVERSAL_AGENT_ID        // 'CR-AI-0501'
  | typeof PRODUCTIVITY_AGENT_ID    // 'CR-AI-0502'
  | typeof SALES_AGENT_ID           // 'CR-AI-0503'
  | typeof MARKETING_AGENT_ID       // 'CR-AI-0504'
  | typeof SERVICE_AGENT_ID         // 'CR-AI-0505'
  | typeof KNOWLEDGE_AGENT_ID;      // 'CR-AI-0506'

export const PHASE_13_OOB_AGENT_IDS = [
  UNIVERSAL_AGENT_ID,
  PRODUCTIVITY_AGENT_ID,
  SALES_AGENT_ID,
  MARKETING_AGENT_ID,
  SERVICE_AGENT_ID,
  KNOWLEDGE_AGENT_ID,
] as const;

/**
 * Public surface used by HTTP controllers + chat dispatcher +
 * certification runner. Narrow, typed, immutable.
 */
export interface IAgentDefinition {
  readonly id: AgentId;
  readonly stableId: string;
  readonly displayName: string;
  readonly description: string;
  readonly version: string;
  readonly certifiedAt: string;
  readonly type: OotbAgentDefinition['type'];
  readonly supportedIntents: ReadonlyArray<string>;
  readonly unsupportedIntents: ReadonlyArray<string>;
  readonly skillKeys: ReadonlyArray<string>;
  readonly channels: ReadonlyArray<string>;
  readonly maxConcurrency: number;
  readonly implemented: boolean;
  readonly sloBudget: string;
}

export class AgentNotRegisteredError extends Error {
  constructor(readonly id: string) {
    super(`agent ${id} is not registered`);
    this.name = 'AgentNotRegisteredError';
  }
}

@Injectable()
export class AgentRegistry implements OnApplicationBootstrap {
  private readonly logger = new Logger(AgentRegistry.name);
  private readonly agents = new Map<AgentId, IAgentDefinition>();
  private booted = false;

  /**
   * Populates the registry from the canonical `OOB_AGENTS` static
   * array. We don't read from the DB here — the DB rows are the
   * version persisted by `OobAgentRegistrationService`; this
   * registry mirrors them in-process for cheap HTTP reads.
   */
  onApplicationBootstrap(): void {
    this.registerAll();
  }

  list(): ReadonlyArray<IAgentDefinition> {
    return Array.from(this.agents.values());
  }

  get(id: AgentId): IAgentDefinition {
    const a = this.agents.get(id);
    if (!a) throw new AgentNotRegisteredError(id);
    return a;
  }

  has(id: AgentId): boolean {
    return this.agents.has(id);
  }

  /**
   * Synchronous boot-time registration. Idempotent — calls after
   * the first do not overwrite. Direct call from tests + tests that
   * don't run the full Nest lifecycle.
   */
  registerAll(): void {
    if (this.booted) return;
    for (const def of OOB_AGENTS) {
      const id = def.stableId as AgentId;
      if (this.agents.has(id)) continue;
      this.agents.set(id, adapt(def));
    }
    this.booted = true;
    this.logger.log(
      `agent-registry: registered ${this.agents.size} OOB agents (${Array.from(this.agents.keys()).join(', ')})`,
    );
  }

  /**
   * For tests only — clears the registry.
   */
  reset(): void {
    this.agents.clear();
    this.booted = false;
  }
}

function adapt(def: OotbAgentDefinition): IAgentDefinition {
  const lowerType = def.type.toLowerCase() as IAgentDefinition['id'];
  return {
    id: lowerType,
    stableId: def.stableId,
    displayName: displayNameFor(def.type),
    description: def.purpose,
    version: def.version ?? '0.1.0',
    certifiedAt: '2026-08-06',
    type: def.type,
    supportedIntents: Object.freeze(def.supportedIntents ?? []),
    unsupportedIntents: Object.freeze(def.unsupportedIntents ?? []),
    skillKeys: Object.freeze(
      (def.skills ?? []).map((s) => s.skillKey).filter(Boolean),
    ),
    channels: Object.freeze((def.channels ?? []).map(String)),
    maxConcurrency: 4,
    implemented: true,
    sloBudget: def.slo ? `p95<${def.slo.p95LatencyMs}ms` : 'monitor-only',
  };
}

function displayNameFor(t: OotbAgentDefinition['type']): string {
  switch (t) {
    case 'UNIVERSAL':
      return 'Universal agent';
    case 'PRODUCTIVITY':
      return 'Productivity agent';
    case 'SALES':
      return 'Sales agent';
    case 'MARKETING':
      return 'Marketing agent';
    case 'SERVICE':
      return 'Service / case agent';
    case 'KNOWLEDGE':
      return 'Knowledge agent';
  }
}

/**
 * Type guard for tests / dispatch — keeps the IAgentDefinition
 * surface narrow.
 */
export function isOobAgentId(s: string): s is AgentId {
  return Boolean(OOB_AGENT_INDEX[s]);
}

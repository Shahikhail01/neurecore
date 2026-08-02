/**
 * OOTB agents registry — the single import surface for every
 * role-based out-of-the-box agent delivered as part of Phase 4 (P4).
 *
 * Registers all six agents:
 *   CR-AI-0501 UNIVERSAL
 *   CR-AI-0502 PRODUCTIVITY
 *   CR-AI-0503 SALES
 *   CR-AI-0504 MARKETING
 *   CR-AI-0505 SERVICE
 *   CR-AI-0506 KNOWLEDGE
 *
 * The registry is intentionally a thin, typed array — no engine or
 * registry of its own is created. Execution, dispatch, governance, and
 * work-runtime ownership all live in their canonical owners.
 */

import {
  UNIVERSAL_AGENT,
  UNIVERSAL_AGENT_ID,
  UNIVERSAL_AGENT_VERSION,
  type OotbAgentDefinition,
} from './UNIVERSAL.agent';
import {
  PRODUCTIVITY_AGENT,
  PRODUCTIVITY_AGENT_ID,
  PRODUCTIVITY_AGENT_VERSION,
} from './PRODUCTIVITY.agent';
import {
  SALES_AGENT,
  SALES_AGENT_ID,
  SALES_AGENT_VERSION,
} from './SALES.agent';
import {
  MARKETING_AGENT,
  MARKETING_AGENT_ID,
  MARKETING_AGENT_VERSION,
} from './MARKETING.agent';
import {
  SERVICE_AGENT,
  SERVICE_AGENT_ID,
  SERVICE_AGENT_VERSION,
} from './SERVICE.agent';
import {
  KNOWLEDGE_AGENT,
  KNOWLEDGE_AGENT_ID,
  KNOWLEDGE_AGENT_VERSION,
} from './KNOWLEDGE.agent';

export const OOB_AGENTS: readonly OotbAgentDefinition[] = Object.freeze([
  UNIVERSAL_AGENT,
  PRODUCTIVITY_AGENT,
  SALES_AGENT,
  MARKETING_AGENT,
  SERVICE_AGENT,
  KNOWLEDGE_AGENT,
]);

export const OOB_AGENT_INDEX: Readonly<Record<string, OotbAgentDefinition>> =
  Object.freeze(
    OOB_AGENTS.reduce<Record<string, OotbAgentDefinition>>((acc, a) => {
      acc[a.stableId] = a;
      return acc;
    }, {}),
  );

export const OOB_AGENT_IDS: readonly string[] = Object.freeze([
  UNIVERSAL_AGENT_ID,
  PRODUCTIVITY_AGENT_ID,
  SALES_AGENT_ID,
  MARKETING_AGENT_ID,
  SERVICE_AGENT_ID,
  KNOWLEDGE_AGENT_ID,
]);

export const OOB_AGENT_VERSIONS: Readonly<Record<string, string>> =
  Object.freeze({
    [UNIVERSAL_AGENT_ID]: UNIVERSAL_AGENT_VERSION,
    [PRODUCTIVITY_AGENT_ID]: PRODUCTIVITY_AGENT_VERSION,
    [SALES_AGENT_ID]: SALES_AGENT_VERSION,
    [MARKETING_AGENT_ID]: MARKETING_AGENT_VERSION,
    [SERVICE_AGENT_ID]: SERVICE_AGENT_VERSION,
    [KNOWLEDGE_AGENT_ID]: KNOWLEDGE_AGENT_VERSION,
  });

export type { OotbAgentDefinition } from './UNIVERSAL.agent';

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AgentType } from '@prisma/client';

export interface AgentPackDefinition {
  role: string;
  description: string;
  type: AgentType;
  model: string;
  systemPrompt: string;
}

export interface AgentPack {
  id: string;
  name: string;
  description: string;
  category: string;
  agents: AgentPackDefinition[];
  tags: string[];
}

/** Static curated agent packs bundled with the platform. */
const BUILT_IN_PACKS: AgentPack[] = [
  {
    id: 'gtm-pack',
    name: 'GTM Launch Pack',
    description:
      'Go-to-market readiness: SDR, content writer, and CRM analyst.',
    category: 'sales',
    tags: ['gtm', 'sales', 'marketing'],
    agents: [
      {
        role: 'SDR',
        description: 'Qualifies inbound leads and books discovery calls.',
        type: 'FUNCTIONAL',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are an expert SDR. Your job is to qualify leads, identify pain points, and schedule discovery calls. Be concise and helpful.',
      },
      {
        role: 'Content Writer',
        description: 'Drafts blog posts, email sequences and social copy.',
        type: 'FUNCTIONAL',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are an expert B2B content writer. Draft compelling, SEO-optimised content that converts.',
      },
      {
        role: 'CRM Analyst',
        description: 'Analyses deal pipeline and surfaces coaching insights.',
        type: 'FUNCTIONAL',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are a CRM analyst. Review deal data, identify stalled opportunities, and recommend next steps.',
      },
    ],
  },
  {
    id: 'support-pack',
    name: 'Customer Support Pack',
    description:
      'Tier-1 triage, knowledge-base lookups, and escalation routing.',
    category: 'support',
    tags: ['support', 'cx', 'helpdesk'],
    agents: [
      {
        role: 'Tier-1 Agent',
        description: 'Handles routine enquiries and FAQs.',
        type: 'FUNCTIONAL',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are a friendly Tier-1 support agent. Resolve common issues, escalate when needed.',
      },
      {
        role: 'Knowledge Base Lookup',
        description: 'Retrieves relevant help articles.',
        type: 'FUNCTIONAL',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are a knowledge retrieval agent. Find the most relevant help articles for customer questions.',
      },
      {
        role: 'Escalation Router',
        description: 'Routes complex tickets to the right team.',
        type: 'EXECUTIVE',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are an escalation router. Assess ticket severity and route to the correct specialist team.',
      },
    ],
  },
  {
    id: 'finance-pack',
    name: 'Finance Ops Pack',
    description: 'Invoice processing, spend analysis, and budget alerting.',
    category: 'finance',
    tags: ['finance', 'accounting', 'ops'],
    agents: [
      {
        role: 'Invoice Processor',
        description: 'Extracts and validates invoice data.',
        type: 'FUNCTIONAL',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are an invoice processing agent. Extract line items, validate totals, and flag anomalies.',
      },
      {
        role: 'Spend Analyst',
        description: 'Categorises spend and surfaces over-budget categories.',
        type: 'FUNCTIONAL',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are a spend analysis agent. Categorise expenses, compare to budget, and highlight variances.',
      },
      {
        role: 'Budget Alert',
        description: 'Sends alerts when spend thresholds are breached.',
        type: 'CORE',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You monitor spending and alert stakeholders when budget thresholds are hit.',
      },
    ],
  },
];

/**
 * AgentPacksService
 * SRP: curated pack catalogue + one-click install.
 * OCP: add packs in BUILT_IN_PACKS without touching service logic.
 */
@Injectable()
export class AgentPacksService {
  constructor(private readonly prisma: PrismaService) {}

  listPacks(): AgentPack[] {
    return BUILT_IN_PACKS;
  }

  getPack(id: string): AgentPack | undefined {
    return BUILT_IN_PACKS.find((p) => p.id === id);
  }

  /**
   * Install all agents from a pack into the tenant.
   * Returns the list of created agent IDs.
   */
  async installPack(
    packId: string,
    tenantId: string,
    createdById: string,
  ): Promise<{ installedCount: number; agentIds: string[] }> {
    const pack = this.getPack(packId);
    if (!pack) throw new Error(`Pack '${packId}' not found`);

    const created = await Promise.all(
      pack.agents.map((def) =>
        this.prisma.agent.create({
          data: {
            name: `[${pack.name}] ${def.role}`,
            description: def.description,
            type: def.type,
            model: def.model,
            systemPrompt: def.systemPrompt,
            tenantId,
            createdById,
            metadata: { packId, packCategory: pack.category },
          },
        }),
      ),
    );

    return {
      installedCount: created.length,
      agentIds: created.map((a) => a.id),
    };
  }
}

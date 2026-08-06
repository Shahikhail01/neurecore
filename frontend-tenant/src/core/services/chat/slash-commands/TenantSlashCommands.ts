// ─── TenantSlashCommands.ts ─────────────────────────────────────────────────────
// SRP: Provides tenant-scoped slash command definitions and suggestion matching.

import type { ISlashCommandProvider } from '@/core/services/interfaces/IChatService';
import type { SlashCommand } from '@/shared/types/chat.types';

export class TenantSlashCommands implements ISlashCommandProvider {
  readonly commands: SlashCommand[] = [
    {
      trigger: '/agents',
      label: 'Agent queries',
      context: 'agent',
      suggestions: [
        'How many agents are running?',
        'Which agents have high workload?',
        'Show me failed agents',
        'Pause all idle agents',
      ],
    },
    {
      trigger: '/tasks',
      label: 'Task queries',
      context: 'task',
      suggestions: [
        'How many tasks completed today?',
        'Which tasks failed this week?',
        'Assign a new task',
        'Show pending tasks',
      ],
    },
    {
      trigger: '/costs',
      label: 'Cost & budget',
      context: 'system',
      suggestions: [
        'What is my cost today?',
        'Which agent costs the most?',
        'Show cost breakdown',
        'Reduce expenses by 10%',
      ],
    },
    {
      trigger: '/workflows',
      label: 'Workflow queries',
      context: 'workflow',
      suggestions: [
        'List active workflows',
        'Which workflows failed?',
        'Show workflow execution history',
      ],
    },
    {
      trigger: '/approvals',
      label: 'Pending approvals',
      context: 'system',
      suggestions: [
        'What is pending approval?',
        'Show urgent approvals',
      ],
    },
    // ── Creatio AI parity — Phase 10.4 chat tools (backend nc.*) ──────
    {
      trigger: '/score-lead',
      label: 'Score a lead',
      context: 'lead',
      suggestions: [
        'Score this lead for propensity to buy',
        'Rank my top 10 leads by score',
        'Explain what drove this lead score',
      ],
    },
    {
      trigger: '/next-step',
      label: 'Next best action',
      context: 'deal',
      suggestions: [
        'What is the next best step for this deal?',
        'Recommend the next action for this contact',
        'Which deal needs my attention today?',
      ],
    },
    {
      trigger: '/forecast',
      label: 'Pipeline forecast',
      context: 'forecast',
      suggestions: [
        'Forecast the pipeline for this quarter',
        'What is our weighted forecast for next month?',
        'Which deals are likely to close this quarter?',
      ],
    },
    {
      trigger: '/quote',
      label: 'Generate a quote',
      context: 'quote',
      suggestions: [
        'Generate a draft quote for this deal',
        'Draft a quote with 3 line items',
        'Apply our standard discount and propose terms',
      ],
    },
    {
      trigger: '/case',
      label: 'Resolve a service case',
      context: 'case',
      suggestions: [
        'Suggest next best action for this case',
        'Classify this case by priority',
        'Draft a reply for this case',
      ],
    },
    {
      trigger: '/summarize',
      label: 'Summarize & knowledge',
      context: 'kb',
      suggestions: [
        'Search the knowledge base for this topic',
        'Summarize recent activity on this customer',
        'Find the article that explains this error',
      ],
    },
    {
      trigger: '/customer-360',
      label: 'Customer 360 view',
      context: 'customer',
      suggestions: [
        'Show me the 360 view of this customer',
        'Summarize all touchpoints with this contact',
        'What is the latest intent signal for this customer?',
      ],
    },
    {
      trigger: '/twin',
      label: 'Run my AI Twin',
      context: 'twin',
      suggestions: [
        'Run my sales twin on this deal',
        'Ask my support twin to draft a reply',
        'Have my twin summarise my week',
      ],
    },
    {
      trigger: '/send',
      label: 'Send via channel',
      context: 'channel',
      suggestions: [
        'Send this via email',
        'Send this via SMS',
        'Post this to the team Teams channel',
      ],
    },
  ];

  getSuggestions(input: string): SlashCommand[] {
    return this.commands.filter((c) => c.trigger.startsWith(input.toLowerCase()));
  }

  getContextForTrigger(input: string): string | undefined {
    return this.commands.find((c) => c.trigger === input.toLowerCase())?.context;
  }
}

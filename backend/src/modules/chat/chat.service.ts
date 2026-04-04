/**
 * ChatService
 *
 * Provides conversational control over the tenant's AI workforce.
 * Queries live agent/task/workflow data and returns structured responses.
 *
 * Architecture:
 *   - No LLM dependency — pure data-driven responses using Prisma queries
 *   - Conversation history stored in Redis (JSON list per user session)
 *   - Context-aware routing: /agents, /tasks, /workflows, /approvals, /costs
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'info' | 'action' | 'error' | 'data';
  timestamp: string;
}

export interface ChatRequest {
  query: string;
  context?: 'agent' | 'task' | 'workflow' | 'system';
  conversationId?: string;
}

export interface ChatResponse {
  id: string;
  type: 'info' | 'action' | 'error' | 'data';
  message: string;
  tokens: { input: number; output: number };
  timestamp: string;
}

@Injectable()
export class ChatService {
  private readonly HISTORY_TTL = 60 * 60 * 24; // 24h
  private readonly MAX_HISTORY = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Send message ─────────────────────────────────────────────────────────

  async sendMessage(
    userId: string,
    tenantId: string,
    req: ChatRequest,
  ): Promise<ChatResponse> {
    const ts = new Date().toISOString();
    const responseId = uuidv4();
    const query = (req.query ?? '').toLowerCase().trim();

    // Persist user message
    await this.appendHistory(userId, {
      id: uuidv4(),
      role: 'user',
      content: req.query,
      timestamp: ts,
    });

    let message = '';
    let type: ChatResponse['type'] = 'info';

    // ─── Context / intent routing ────────────────────────────────────────────
    if (
      this.matches(query, [
        'how many agent',
        'list agent',
        'show agent',
        'agent status',
        'my agent',
        'employee',
        'team',
      ])
    ) {
      const result = await this.queryAgents(tenantId);
      message = result.message;
      type = 'data';
    } else if (
      this.matches(query, [
        'task',
        'pending task',
        'failed task',
        'completed task',
        'assign',
        'overdue',
      ])
    ) {
      const result = await this.queryTasks(tenantId, query);
      message = result.message;
      type = 'data';
    } else if (
      this.matches(query, [
        'workflow',
        'automation',
        'pipeline',
        'active workflow',
        'failed workflow',
      ])
    ) {
      const result = await this.queryWorkflows(tenantId, query);
      message = result.message;
      type = 'data';
    } else if (
      this.matches(query, ['approval', 'pending approval', 'review', 'waiting'])
    ) {
      const result = await this.queryApprovals(tenantId);
      message = result.message;
      type = 'data';
    } else if (
      this.matches(query, [
        'cost',
        'spend',
        'budget',
        'invoice',
        'billing',
        'expense',
      ])
    ) {
      const result = await this.queryCosts(tenantId);
      message = result.message;
      type = 'data';
    } else if (this.matches(query, ['department', 'team structure', 'org'])) {
      const result = await this.queryDepartments(tenantId);
      message = result.message;
      type = 'data';
    } else if (
      this.matches(query, ['help', 'what can', 'commands', 'what do'])
    ) {
      message = this.helpMessage();
      type = 'info';
    } else if (
      this.matches(query, [
        'hello',
        'hi',
        'hey',
        'good morning',
        'good afternoon',
      ])
    ) {
      message = await this.greetingMessage(tenantId);
      type = 'info';
    } else if (
      this.matches(query, [
        'status',
        'overview',
        'summary',
        'dashboard',
        'briefing',
      ])
    ) {
      const result = await this.getDashboardSummary(tenantId);
      message = result.message;
      type = 'data';
    } else {
      message = `I'm not sure about *"${req.query}"*. Try asking about your **agents**, **tasks**, **workflows**, **approvals**, or **costs**. Type \`/help\` for a full command list.`;
      type = 'info';
    }

    const response: ChatResponse = {
      id: responseId,
      type,
      message,
      tokens: {
        input: query.split(' ').length,
        output: message.split(' ').length,
      },
      timestamp: new Date().toISOString(),
    };

    // Persist assistant response
    await this.appendHistory(userId, {
      id: responseId,
      role: 'assistant',
      content: message,
      type,
      timestamp: response.timestamp,
    });

    return response;
  }

  // ─── History ──────────────────────────────────────────────────────────────

  async getHistory(userId: string, limit = 50): Promise<ChatMessageRecord[]> {
    const key = this.historyKey(userId);
    const records = (await this.redis.getJson<ChatMessageRecord[]>(key)) ?? [];
    return records.slice(-limit);
  }

  async clearHistory(userId: string): Promise<void> {
    await this.redis.del(this.historyKey(userId));
  }

  // ─── Suggestions ─────────────────────────────────────────────────────────

  async getSuggestions(tenantId: string, query: string): Promise<string[]> {
    const q = query.toLowerCase();
    if (q.startsWith('/agents') || q.includes('agent')) {
      return [
        'How many agents are running?',
        'Which agents are idle?',
        'Show me all employees',
        'List failed agents',
      ];
    }
    if (q.startsWith('/tasks') || q.includes('task')) {
      return [
        'How many tasks completed today?',
        'Show pending tasks',
        'Which tasks failed this week?',
        'List overdue tasks',
      ];
    }
    if (q.startsWith('/workflows') || q.includes('workflow')) {
      return [
        'List active workflows',
        'Which workflows failed?',
        'Show all automations',
      ];
    }
    if (q.startsWith('/costs') || q.includes('cost')) {
      return [
        'What is my total spend?',
        'Which agent costs the most?',
        'Show budget summary',
      ];
    }
    if (q.startsWith('/approvals') || q.includes('approval')) {
      return ['What is pending approval?', 'Show urgent approvals'];
    }
    // Generic suggestions
    const agentCount = await this.prisma.agent.count({ where: { tenantId } });
    const taskCount = await this.prisma.task.count({
      where: { tenantId, status: 'PENDING' },
    });
    return [
      `You have ${agentCount} AI employees deployed`,
      `${taskCount} tasks pending — want a breakdown?`,
      'Show me the dashboard summary',
      'How are my workflows performing?',
    ];
  }

  // ─── Private query helpers ───────────────────────────────────────────────

  private async queryAgents(tenantId: string) {
    const [all, idle, running, error] = await Promise.all([
      this.prisma.agent.findMany({
        where: { tenantId },
        select: { name: true, status: true, type: true },
      }),
      this.prisma.agent.count({ where: { tenantId, status: 'IDLE' } }),
      this.prisma.agent.count({ where: { tenantId, status: 'RUNNING' } }),
      this.prisma.agent.count({ where: { tenantId, status: 'ERROR' } }),
    ]);
    if (all.length === 0) {
      return {
        message:
          'You have no AI employees deployed yet. Visit the **Team** page to hire from the marketplace.',
      };
    }
    const lines = [`**Your AI Team (${all.length} employees)**\n`];
    lines.push(`- 🟢 Running: **${running}**`);
    lines.push(`- ⚪ Idle: **${idle}**`);
    lines.push(`- 🔴 Error: **${error}**\n`);
    lines.push('**Employees:**');
    all.forEach((a) => lines.push(`- ${a.name} — ${a.status.toLowerCase()}`));
    return { message: lines.join('\n') };
  }

  private async queryTasks(tenantId: string, query: string) {
    const where: Record<string, unknown> = { tenantId };
    if (query.includes('pending')) where.status = 'PENDING';
    else if (query.includes('completed')) where.status = 'COMPLETED';
    else if (query.includes('failed')) where.status = 'FAILED';
    else if (query.includes('in progress') || query.includes('active'))
      where.status = 'RUNNING';

    const [tasks, pending, completed, failed, inProgress] = await Promise.all([
      this.prisma.task.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { title: true, status: true, priority: true },
      }),
      this.prisma.task.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.task.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.task.count({ where: { tenantId, status: 'FAILED' } }),
      this.prisma.task.count({ where: { tenantId, status: 'RUNNING' } }),
    ]);

    const total = pending + completed + failed + inProgress;
    const lines = [`**Task Overview (${total} total)**\n`];
    lines.push(`- ⏳ Pending: **${pending}**`);
    lines.push(`- 🔄 In Progress: **${inProgress}**`);
    lines.push(`- ✅ Completed: **${completed}**`);
    lines.push(`- ❌ Failed: **${failed}**`);

    if (tasks.length > 0) {
      lines.push('\n**Recent Tasks:**');
      tasks.forEach((t) => {
        const icon =
          t.status === 'COMPLETED'
            ? '✅'
            : t.status === 'FAILED'
              ? '❌'
              : t.status === 'RUNNING'
                ? '🔄'
                : '⏳';
        lines.push(`- ${icon} ${t.title} *(${t.priority || 'MEDIUM'})*`);
      });
    } else {
      lines.push(
        '\nNo tasks found. Create your first task from the **Tasks** menu.',
      );
    }
    return { message: lines.join('\n') };
  }

  private async queryWorkflows(tenantId: string, query: string) {
    const [total, active, failed, all] = await Promise.all([
      this.prisma.workflow.count({ where: { tenantId } }),
      this.prisma.workflow.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.workflow.count({ where: { tenantId, status: 'FAILED' } }),
      this.prisma.workflow.findMany({
        where: { tenantId },
        take: 5,
        select: { name: true, status: true },
      }),
    ]);

    if (total === 0) {
      return {
        message:
          'No workflows configured yet. Visit **Workflows** to set up automations for your AI team.',
      };
    }
    const lines = [
      `**Workflows (${total} total)**\n`,
      `- Active: **${active}**`,
      `- Failed: **${failed}**\n`,
      '**Recent:**',
    ];
    all.forEach((w) => lines.push(`- ${w.name} — *${w.status.toLowerCase()}*`));
    return { message: lines.join('\n') };
  }

  private async queryApprovals(tenantId: string) {
    const [total, pending] = await Promise.all([
      this.prisma.approvalRequest.count({ where: { tenantId } }),
      this.prisma.approvalRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
    ]);
    if (total === 0) {
      return {
        message:
          'No approvals pending. Your AI team is operating autonomously.',
      };
    }
    const msg =
      pending > 0
        ? `**${pending} approval(s) pending** — review them in the **Approvals** section to keep your agents unblocked.`
        : `All ${total} approvals have been processed. Nothing pending at this time.`;
    return { message: msg };
  }

  private async queryCosts(tenantId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { name: true, totalSpend: true },
      orderBy: { totalSpend: 'desc' },
      take: 5,
    });
    const totalStr = agents
      .reduce((sum, a) => sum + parseFloat(String(a.totalSpend ?? 0)), 0)
      .toFixed(4);
    const lines = [
      `**Cost Summary**\n`,
      `- Total spend: **$${totalStr}**\n`,
      '**Top spenders:**',
    ];
    agents.forEach((a) =>
      lines.push(
        `- ${a.name}: $${parseFloat(String(a.totalSpend ?? 0)).toFixed(4)}`,
      ),
    );
    lines.push('\n*Note: Connect real provider tokens to track live spend.*');
    return { message: lines.join('\n') };
  }

  private async queryDepartments(tenantId: string) {
    const depts = await this.prisma.department.findMany({
      where: { tenantId },
      select: { name: true, description: true },
    });
    if (depts.length === 0) {
      return {
        message: 'No departments set up. Your agents are currently ungrouped.',
      };
    }
    const lines = [`**Departments (${depts.length})**\n`];
    depts.forEach((d) =>
      lines.push(`- **${d.name}**${d.description ? `: ${d.description}` : ''}`),
    );
    return { message: lines.join('\n') };
  }

  private async getDashboardSummary(tenantId: string) {
    const [agents, tasks, workflows, approvals] = await Promise.all([
      this.prisma.agent.count({ where: { tenantId } }),
      this.prisma.task.count({ where: { tenantId } }),
      this.prisma.workflow.count({ where: { tenantId } }),
      this.prisma.approvalRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
    ]);
    const running = await this.prisma.agent.count({
      where: { tenantId, status: 'RUNNING' },
    });
    const completed = await this.prisma.task.count({
      where: { tenantId, status: 'COMPLETED' },
    });
    const successRate = tasks > 0 ? Math.round((completed / tasks) * 100) : 0;

    const lines = [
      `**Dashboard Summary**\n`,
      `👥 **${agents}** AI employees deployed — ${running} running`,
      `📋 **${tasks}** total tasks — ${successRate}% success rate`,
      `⚡ **${workflows}** workflows configured`,
      `${approvals > 0 ? `⚠️ **${approvals}** pending approvals need attention` : '✅ No pending approvals'}`,
    ];
    return { message: lines.join('\n') };
  }

  private async greetingMessage(tenantId: string): Promise<string> {
    const agents = await this.prisma.agent.count({ where: { tenantId } });
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? 'Good morning'
        : hour < 17
          ? 'Good afternoon'
          : 'Good evening';
    return `${greeting}! 👋 You have **${agents}** AI employees deployed. How can I help you today? Ask about your team's status, pending tasks, or type \`/help\` for a full list of commands.`;
  }

  private helpMessage(): string {
    return [
      '**Available Commands**\n',
      '`/agents` — AI employee status and workload',
      '`/tasks` — Task list with status breakdown',
      '`/workflows` — Automation pipeline status',
      '`/approvals` — Pending approval requests',
      '`/costs` — Spend and budget summary',
      '\n**Natural language examples:**',
      '- "How many tasks are pending?"',
      '- "Show me the dashboard summary"',
      '- "Which agents are idle?"',
      '- "List failed workflows"',
    ].join('\n');
  }

  private matches(query: string, keywords: string[]): boolean {
    return keywords.some((kw) => query.includes(kw));
  }

  private historyKey(userId: string): string {
    return `chat:history:${userId}`;
  }

  private async appendHistory(
    userId: string,
    message: ChatMessageRecord,
  ): Promise<void> {
    const key = this.historyKey(userId);
    const existing = (await this.redis.getJson<ChatMessageRecord[]>(key)) ?? [];
    existing.push(message);
    const trimmed = existing.slice(-this.MAX_HISTORY);
    await this.redis.setJson(key, trimmed, this.HISTORY_TTL);
  }
}

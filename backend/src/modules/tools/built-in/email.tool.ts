/**
 * EmailTool — Phase C
 *
 * Unified email tool exposed to AI agents. Supports four operations:
 *
 *   action='read_inbox'   → list recent inbox messages (Gmail)
 *   action='get_message'  → fetch a single message with body
 *   action='send'         → send via Gmail or Brevo SMTP using the agent's email alias
 *   action='flag'         → apply Gmail labels (URGENT / IMPORTANT / STARRED) for priority
 *
 * Provider resolution (for sending):
 *   1. If tenant has Google connected AND agent.emailProvider === 'gmail' → use Gmail
 *   2. Else if Brevo is connected → use Brevo with agent.emailAlias as sender
 *   3. Else → fail with clear error message
 *
 * The agent's emailAlias comes from `Agent.emailAlias` (Phase C column). When not set,
 * a default alias is constructed: `<agent-name>-agent@<tenant-domain>`.
 *
 * Priority flagging is a hybrid:
 *   - Tool can apply Gmail labels (mechanical)
 *   - Agent's own LLM reasoning decides which messages are urgent based on the
 *     message content + the agent's system prompt. The tool just makes it persistent.
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { ToolDataAccessService } from '../tool-data-access.service';
import { GoogleGmailService } from '../../integrations/google/google-gmail.service';
import { EmailProviderFactory } from '../../integrations/email/email-provider.factory';
import { withGoogleRetry } from '../../integrations/google/gmail-rate-limiter';

export const EmailInputSchema = z.object({
  action: z
    .enum(['read_inbox', 'get_message', 'send', 'flag'])
    .describe('Email operation to perform'),

  // read_inbox
  maxResults: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe('Max inbox messages to return (read_inbox, default 10)'),
  q: z.string().optional().describe('Gmail search query (read_inbox)'),
  labelIds: z
    .array(z.string())
    .optional()
    .describe('Gmail label IDs filter (read_inbox, default INBOX)'),

  // get_message
  messageId: z.string().optional().describe('Gmail message ID (get_message / flag)'),

  // send
  to: z.string().optional().describe('Recipient email address (send)'),
  cc: z.string().optional().describe('CC recipients, comma-separated (send)'),
  bcc: z.string().optional().describe('BCC recipients, comma-separated (send)'),
  subject: z.string().optional().describe('Email subject (send)'),
  body: z.string().optional().describe('Email body (plain text, send)'),
  html: z
    .boolean()
    .optional()
    .describe('Whether body is HTML (send, default false)'),
  provider: z
    .enum(['auto', 'gmail', 'brevo'])
    .optional()
    .describe("Override provider selection (send, default 'auto')"),

  // flag
  priority: z
    .enum(['urgent', 'important', 'starred', 'clear'])
    .optional()
    .describe('Priority level to apply (flag)'),
  threadId: z.string().optional().describe('Gmail thread ID (flag, applies labels to thread)'),
});
export type EmailInput = z.infer<typeof EmailInputSchema>;

export const EmailOutputSchema = z.object({
  action: z.string(),
  provider: z.string().optional(),
  count: z.number().optional(),
  messageId: z.string().optional(),
  threadId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        threadId: z.string(),
        from: z.string(),
        to: z.string(),
        subject: z.string(),
        snippet: z.string(),
        date: z.string(),
        isUnread: z.boolean(),
        labels: z.array(z.string()),
      }),
    )
    .optional(),
  body: z.string().optional(),
  appliedLabels: z.array(z.string()).optional(),
});
export type EmailOutput = z.infer<typeof EmailOutputSchema>;

@Injectable()
export class EmailTool extends BaseStructuredTool {
  readonly name = 'email';
  readonly description =
    'Email operations for the agent. ' +
    "action='read_inbox' lists recent Gmail messages with sender/subject/snippet. " +
    "action='get_message' retrieves a full message body. " +
    "action='send' sends an email via Gmail or Brevo using the agent's email alias (sales-agent@company.com). " +
    "action='flag' applies priority labels (urgent/important/starred) to a message so the agent can mark follow-ups. " +
    'Use read_inbox to scan for new mail, get_message to read a specific thread, send to reply or reach out, flag to mark urgent items.';
  readonly category = ToolCategory.COMMUNICATION;
  readonly inputSchema = EmailInputSchema;
  readonly outputSchema = EmailOutputSchema;
  readonly requiredPermissions = ['email:read', 'email:send'];

  constructor(
    private readonly data: ToolDataAccessService,
    private readonly gmail: GoogleGmailService,
    private readonly providerFactory: EmailProviderFactory,
  ) {
    super();
  }

  protected async executeImpl(
    input: EmailInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<EmailOutput>> {
    const tenantId = context?.tenantId;
    if (!tenantId) {
      return { success: false, error: 'Tenant context required for email operations' };
    }

    try {
      switch (input.action) {
        case 'read_inbox':
          return await this.readInbox(tenantId, input);
        case 'get_message':
          return await this.getMessage(tenantId, input);
        case 'send':
          return await this.send(tenantId, input, context);
        case 'flag':
          return await this.flag(tenantId, input);
        default:
          return { success: false, error: `Unknown action: ${String(input.action)}` };
      }
    } catch (error) {
      this.logger.error(`EmailTool [${input.action}] failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email operation failed',
      };
    }
  }

  // ─── read_inbox ────────────────────────────────────────────────────────

  private async readInbox(
    tenantId: string,
    input: EmailInput,
  ): Promise<StructuredToolResult<EmailOutput>> {
    const result = await this.gmail.listInbox(tenantId, {
      maxResults: input.maxResults ?? 10,
      labelIds: input.labelIds ?? ['INBOX'],
      q: input.q,
    });
    return {
      success: true,
      data: {
        action: 'read_inbox',
        provider: 'gmail',
        count: result.messages.length,
        messages: result.messages,
      },
      metadata: { model: 'email-tool-v1' },
    };
  }

  // ─── get_message ───────────────────────────────────────────────────────

  private async getMessage(
    tenantId: string,
    input: EmailInput,
  ): Promise<StructuredToolResult<EmailOutput>> {
    if (!input.messageId) {
      return { success: false, error: 'messageId is required for get_message' };
    }
    const meta = await this.gmail.getMessage(
      tenantId,
      input.messageId,
      input.threadId,
    );
    const body = await this.gmail.getMessageBody(input.messageId, tenantId);
    return {
      success: true,
      data: {
        action: 'get_message',
        provider: 'gmail',
        messageId: meta.id,
        threadId: meta.threadId,
        from: meta.from,
        to: meta.to,
        subject: meta.subject,
        body: body.plainText || body.html,
        messages: [meta],
      },
      metadata: { model: 'email-tool-v1' },
    };
  }

  // ─── send ──────────────────────────────────────────────────────────────

  private async send(
    tenantId: string,
    input: EmailInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<EmailOutput>> {
    if (!input.to || !input.subject || input.body === undefined) {
      return {
        success: false,
        error: 'send requires to, subject, and body fields',
      };
    }

    const agentId = context?.agentId;
    const sender = await this.resolveSender(tenantId, agentId, input.provider ?? 'auto');
    const provider = await this.providerFactory.forSend(
      tenantId,
      sender.provider,
      input.provider ?? 'auto',
    );

    const result = await provider.send({
      tenantId,
      from: sender.email,
      fromName: sender.displayName,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      body: input.body,
      html: input.html ?? false,
      signature: sender.signature,
    });

    return {
      success: true,
      data: {
        action: 'send',
        provider: result.provider,
        messageId: result.messageId,
        threadId: result.threadId,
        from: sender.email,
        to: input.to,
        subject: input.subject,
      },
      metadata: { model: 'email-tool-v1' },
    };
  }

  // ─── flag (priority) ───────────────────────────────────────────────────

  private async flag(
    tenantId: string,
    input: EmailInput,
  ): Promise<StructuredToolResult<EmailOutput>> {
    if (!input.messageId) {
      return { success: false, error: 'messageId is required for flag' };
    }
    const labelsToAdd: string[] = [];
    const labelsToRemove: string[] = [];

    switch (input.priority) {
      case 'urgent':
        labelsToAdd.push('IMPORTANT', 'STARRED');
        break;
      case 'important':
        labelsToAdd.push('IMPORTANT');
        labelsToRemove.push('STARRED');
        break;
      case 'starred':
        labelsToAdd.push('STARRED');
        break;
      case 'clear':
        labelsToRemove.push('IMPORTANT', 'STARRED');
        break;
      default:
        return {
          success: false,
          error: 'priority is required for flag (urgent|important|starred|clear)',
        };
    }

    const accessToken = await this.gmail.getAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'Google is not connected for this tenant' };
    }

    try {
      await withGoogleRetry(
        () =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${input.messageId}/modify`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                addLabelIds: labelsToAdd,
                removeLabelIds: labelsToRemove,
              }),
            },
          ),
        async (res) => {
          if (!res.ok) {
            const err = await res.text().catch(() => 'unknown');
            throw new Error(`Failed to flag message: ${res.status} ${err}`);
          }
          return res;
        },
      );
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to flag message',
      };
    }

    return {
      success: true,
      data: {
        action: 'flag',
        provider: 'gmail',
        messageId: input.messageId,
        appliedLabels: labelsToAdd.length > 0 ? labelsToAdd : labelsToRemove,
      },
      metadata: { model: 'email-tool-v1' },
    };
  }

  // ─── helpers ──────────────────────────────────────────────────────────

  /**
   * Resolve which sender identity and provider to use.
   * Returns null-equivalent (throws) when neither Gmail nor Brevo is configured.
   */
  private async resolveSender(
    tenantId: string,
    agentId: string | undefined,
    _requested: 'auto' | 'gmail' | 'brevo',
  ): Promise<{
    provider: 'gmail' | 'brevo';
    email: string;
    displayName?: string;
    signature?: string;
  }> {
    const agent = agentId
      ? await this.data.agent.findUnique({ where: { id: agentId } })
      : null;

    const preferred = (agent?.emailProvider as 'gmail' | 'brevo') ?? 'brevo';
    const alias = agent?.emailAlias ?? this.defaultAlias(agent);
    const displayName = agent?.emailDisplayName ?? agent?.name ?? undefined;
    const signature = agent?.emailSignature ?? undefined;

    if (!alias) {
      throw new Error(
        `Agent has no email alias configured. Set emailAlias on the agent or connect Brevo/Google first.`,
      );
    }

    return { provider: preferred, email: alias, displayName, signature };
  }

  private defaultAlias(agent: { id: string; name: string } | null): string | null {
    if (!agent) return null;
    const slug = agent.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${slug || 'agent'}-agent@neurecore.app`;
  }
}

/**
 * EmailSendTool
 *
 * Sends plain-text email via SMTP using Nodemailer.
 *
 * Security:
 *   - Rate limit: max 10 emails per tenant per hour (in-memory token bucket).
 *   - Plain text only: HTML is not allowed to prevent XSS via email body.
 *   - Subject/body length limits to prevent abuse.
 *   - SMTP credentials sourced from ConfigService (never hardcoded or logged).
 *   - Recipient address validated by Zod z.string().email().
 *   - No CC/BCC to restrict blast radius.
 *
 * SOLID:
 *   SRP  — email delivery only; content generation is the caller's concern.
 *   DIP  — depends on ConfigService abstraction; Nodemailer loaded dynamically.
 *   OCP  — transport can be swapped by providing SMTP env vars.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

const EmailSendInputSchema = z.object({
  to: z.string().email().describe('Recipient email address'),
  subject: z.string().min(1).max(200).describe('Email subject (max 200 chars)'),
  body: z
    .string()
    .min(1)
    .max(5000)
    .describe('Plain-text email body (max 5 000 chars)'),
});

type EmailSendInput = z.infer<typeof EmailSendInputSchema>;

interface RateBucket {
  count: number;
  windowStart: number;
}

const RATE_LIMIT = 10; // max emails per window
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class EmailSendTool extends BaseStructuredTool {
  readonly name = 'email_send';
  readonly description =
    'Send a plain-text email to a single recipient via SMTP. ' +
    'Rate-limited to 10 emails per tenant per hour.';
  readonly category = ToolCategory.COMMUNICATION;
  readonly inputSchema = EmailSendInputSchema;

  private readonly rateBuckets = new Map<string, RateBucket>();

  constructor(private readonly config: ConfigService) {
    super();
  }

  protected async executeImpl(
    input: EmailSendInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<{ messageId: string }>> {
    // ── Rate limiting ──────────────────────────────────────────────────────
    const tenantId = context.tenantId ?? 'global';
    if (!this.checkAndConsume(tenantId)) {
      return {
        success: false,
        error: 'Email rate limit exceeded (10 per hour per tenant)',
      };
    }

    // ── SMTP config ────────────────────────────────────────────────────────
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const portStr = this.config.get<string>('SMTP_PORT') ?? '465';
    const smtpPort = parseInt(portStr, 10);
    const from = this.config.get<string>('SMTP_FROM') ?? user;

    if (!host || !user || !pass) {
      return {
        success: false,
        error:
          'Email is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing)',
      };
    }

    try {
      // Dynamic import to keep nodemailer out of the module parse-time bundle
      const nodemailer = await import('nodemailer');
      // Explicitly use SMTPTransport options to guide TypeScript overload resolution
      const smtpOptions: import('nodemailer/lib/smtp-transport').Options = {
        host,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user, pass },
      };
      const transporter = nodemailer.createTransport(smtpOptions);

      const info = await transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        // plain text only; no html property
        text: input.body,
      });

      transporter.close();

      this.logger.log(
        `[EmailSendTool] Email sent: tenantId=${tenantId} messageId=${String(info.messageId)}`,
      );

      return { success: true, data: { messageId: String(info.messageId) } };
    } catch {
      // Never log SMTP credentials or raw error (may contain server banners)
      this.logger.error('[EmailSendTool] Email delivery failed');
      return { success: false, error: 'Email delivery failed' };
    }
  }

  /** Simple sliding-window counter per tenant (in-memory) */
  private checkAndConsume(tenantId: string): boolean {
    const now = Date.now();
    let bucket = this.rateBuckets.get(tenantId);

    if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
      bucket = { count: 0, windowStart: now };
    }

    if (bucket.count >= RATE_LIMIT) return false;
    bucket.count++;
    this.rateBuckets.set(tenantId, bucket);
    return true;
  }
}

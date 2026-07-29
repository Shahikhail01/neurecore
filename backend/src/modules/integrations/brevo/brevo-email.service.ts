import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider } from '@prisma/client';
import { PrismaIntegrationCredentialStore } from '../services/integration-credential.store';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BrevoUsageService } from './brevo-usage.service';
import { BrevoSuppressionService } from './brevo-suppression.service';
import type { BrevoConfig } from '../../../config/env.loader';

export interface SendEmailDto {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  signature?: string;
  tags?: string[];
}

export interface SendBatchItem {
  to: string;
  /** Per-recipient substitutions; injected as variables in subject/body. */
  variables?: Record<string, string>;
}

export interface SendBatchResult {
  total: number;
  accepted: number;
  failed: number;
  suppressed: number;
  messageIds: string[];
  errors: {
    to: string;
    status: number;
    message: string;
    suppressed?: boolean;
  }[];
}

export interface TenantBrevoIdentity {
  senderEmail: string;
  senderName: string;
  replyToEmail: string | null;
  source: 'tenant' | 'env';
}

interface BrevoSendResponse {
  messageId?: string;
  messageIds?: string[];
}

interface BrevoErrorPayload {
  code?: string;
  message?: string;
}

const API_KEY_CACHE_TTL_MS = 5 * 60 * 1000;
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000;
export const BREVO_BATCH_LIMIT = 50;
type ApiKeySource = 'tenant' | 'master';

@Injectable()
export class BrevoEmailService {
  private readonly logger = new Logger(BrevoEmailService.name);
  private readonly credentialCache = new Map<
    string,
    { source: ApiKeySource; key: string; expiresAt: number }
  >();
  private readonly accountCache = new Map<
    string,
    { expiresAt: number; account: Record<string, unknown> }
  >();
  private readonly tenantIdentityCache = new Map<
    string,
    { identity: TenantBrevoIdentity; expiresAt: number }
  >();

  constructor(
    private readonly credentialStore: PrismaIntegrationCredentialStore,
    private readonly usage: BrevoUsageService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly suppressions: BrevoSuppressionService,
  ) {}

  private get brevoConfig(): BrevoConfig {
    return {
      masterApiKey: this.config.get<string>('BREVO_MASTER_API_KEY') || null,
      fromAddress: this.config.get<string>('EMAIL_FROM_ADDRESS') || '',
      fromName: this.config.get<string>('EMAIL_FROM_NAME') || 'NeureCore',
      replyTo: this.config.get<string>('EMAIL_REPLY_TO') || null,
      dailyLimit: this.config.get<number>('BREVO_DAILY_LIMIT') || 300,
      apiBaseUrl:
        this.config.get<string>('BREVO_API_BASE_URL') ||
        'https://api.brevo.com/v3',
    };
  }

  /**
   * Resolve the API key for a tenant.
   *
   * Resolution order:
   *   1. Per-tenant credential stored in Prisma (preferred; lets each tenant
   *      send under their own sender identity).
   *   2. Platform master key (`BREVO_MASTER_API_KEY`) — used so a brand-new
   *      tenant can send email day-1 without manual setup.
   *
   * Result is cached in-memory for 5 minutes per tenant.
   */
  private async getApiKey(tenantId: string): Promise<{
    key: string;
    source: ApiKeySource;
  } | null> {
    const cached = this.credentialCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return { key: cached.key, source: cached.source };
    }

    let resolved: { key: string; source: ApiKeySource } | null = null;

    const tenantCreds = await this.credentialStore
      .get(tenantId, IntegrationProvider.BREVO)
      .catch(() => null);
    if (tenantCreds && 'apiKey' in tenantCreds && tenantCreds.apiKey) {
      resolved = { key: tenantCreds.apiKey, source: 'tenant' };
    } else {
      const masterKey = this.brevoConfig.masterApiKey;
      if (masterKey) {
        resolved = { key: masterKey, source: 'master' };
      }
    }

    if (resolved) {
      this.credentialCache.set(tenantId, {
        key: resolved.key,
        source: resolved.source,
        expiresAt: Date.now() + API_KEY_CACHE_TTL_MS,
      });
    }
    return resolved;
  }

  /** Public helper for health checks / dashboard. */
  async hasApiKey(tenantId: string): Promise<boolean> {
    return (await this.getApiKey(tenantId)) !== null;
  }

  /** Public helper so factory / controller can show which source is in use. */
  async getApiKeySource(tenantId: string): Promise<ApiKeySource | null> {
    const r = await this.getApiKey(tenantId);
    return r ? r.source : null;
  }

  /**
   * Resolve the tenant's sender identity for outbound emails.
   *
   * Order:
   *   1. Per-tenant `brevoSenderEmail` / `brevoSenderName` / `brevoReplyToEmail`
   *      (set via `PUT /integrations/brevo/sender`).
   *   2. Global env (`EMAIL_FROM_ADDRESS` / `EMAIL_FROM_NAME` /
   *      `EMAIL_REPLY_TO`).
   *
   * `source: 'tenant'` lets the UI badge which row was used. Result is
   * cached in-memory for 5 min per tenant.
   */
  async getTenantIdentity(
    tenantId: string,
  ): Promise<TenantBrevoIdentity | null> {
    const cached = this.tenantIdentityCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.identity;

    const row = await this.prisma.tenant
      .findUnique({
        where: { id: tenantId },
        select: {
          brevoSenderEmail: true,
          brevoSenderName: true,
          brevoReplyToEmail: true,
        },
      })
      .catch(() => null);

    const fromEnv = this.brevoConfig;
    let identity: TenantBrevoIdentity | null;

    if (row?.brevoSenderEmail) {
      identity = {
        senderEmail: row.brevoSenderEmail,
        senderName: row.brevoSenderName || fromEnv.fromName,
        replyToEmail: row.brevoReplyToEmail || fromEnv.replyTo || null,
        source: 'tenant',
      };
    } else if (fromEnv.fromAddress) {
      identity = {
        senderEmail: fromEnv.fromAddress,
        senderName: fromEnv.fromName,
        replyToEmail: fromEnv.replyTo || null,
        source: 'env',
      };
    } else {
      identity = null;
    }

    if (identity) {
      this.tenantIdentityCache.set(tenantId, {
        identity,
        expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
      });
    }
    return identity;
  }

  /** Drop the cached identity — call after `PUT /integrations/brevo/sender`. */
  invalidateIdentity(tenantId: string): void {
    this.tenantIdentityCache.delete(tenantId);
  }

  /**
   * Send a transactional email.
   *
   * Throws BadRequestException if no API key is configured.
   * Throws BadRequestException for parameter problems (bad recipient, sender
   * not verified, etc).
   * Throws ServiceUnavailableException for upstream failures (Brevo 5xx,
   * network errors, quota exhaustion).
   */
  async sendEmail(
    tenantId: string,
    dto: SendEmailDto,
  ): Promise<{ messageId: string; source: ApiKeySource }> {
    const apiKeyInfo = await this.getApiKey(tenantId);
    if (!apiKeyInfo) {
      throw new BadRequestException(
        'Brevo is not configured. Set BREVO_MASTER_API_KEY in the environment or connect Brevo in Settings → Integrations.',
      );
    }

    // Suppression check — silently no-op if the recipient is in the
    // platform-wide or per-tenant suppression list. We return a fake
    // messageId so the caller can log success without retrying.
    const suppressed = await this.suppressions.isSuppressed(tenantId, dto.to);
    if (suppressed) {
      this.logger.warn(
        `Refusing to send to ${dto.to} (tenant=${tenantId}) — address is on the suppression list.`,
      );
      return { messageId: 'suppressed', source: apiKeyInfo.source };
    }

    await this.usage.checkLimit(tenantId);

    const finalHtml = dto.signature
      ? `${dto.htmlContent}<br><br><div class="signature">${escapeHtml(dto.signature)}</div>`
      : dto.htmlContent;

    const identity = await this.getTenantIdentity(tenantId);
    const fromAddress = dto.from || identity?.senderEmail || '';
    const fromName = dto.fromName || identity?.senderName || '';
    const replyTo = dto.replyTo || identity?.replyToEmail || undefined;

    if (!fromAddress) {
      throw new BadRequestException(
        'No Brevo sender configured. Set EMAIL_FROM_ADDRESS in the environment, or PUT /integrations/brevo/sender for this tenant.',
      );
    }

    const body: Record<string, unknown> = {
      to: [{ email: dto.to }],
      sender: { email: fromAddress, ...(fromName ? { name: fromName } : {}) },
      subject: dto.subject,
      htmlContent: finalHtml,
    };
    if (replyTo) body.replyTo = { email: replyTo };
    if (dto.tags && dto.tags.length > 0) body.tags = dto.tags;

    const url = `${this.brevoConfig.apiBaseUrl}/smtp/email`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'api-key': apiKeyInfo.key,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(
        `Brevo network error for tenant ${tenantId}: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Failed to reach Brevo API. Please retry shortly.',
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      const parsed = tryParseJson(text) as BrevoErrorPayload | null;
      this.logger.error(
        `Brevo send failed [tenant=${tenantId} source=${apiKeyInfo.source} status=${res.status}]: ${text}`,
      );
      const msg = parsed?.message || `Brevo returned HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) {
        const brevoMsg = parsed?.message || `Brevo returned HTTP ${res.status}`;
        throw new BadRequestException(
          `Brevo authentication failed (${res.status}): ${brevoMsg}. Verify BREVO_MASTER_API_KEY or reconnect Brevo in Settings → Integrations.`,
        );
      }
      if (res.status === 429) {
        throw new ServiceUnavailableException(
          'Brevo rate limit reached. Try again later.',
        );
      }
      if (res.status >= 500) {
        throw new ServiceUnavailableException(
          `Brevo upstream error (${res.status}): ${msg}`,
        );
      }
      throw new BadRequestException(`Brevo error (${res.status}): ${msg}`);
    }

    const data = (await res.json()) as BrevoSendResponse;
    const messageId = data.messageId ?? 'unknown';

    await this.usage.recordSend(tenantId);
    this.logger.log(
      `Email sent for tenant ${tenantId} via ${apiKeyInfo.source}: ${messageId}`,
    );
    return { messageId, source: apiKeyInfo.source };
  }

  /**
   * Validate the API key (tenant or master) by hitting Brevo's account
   * endpoint. Result is cached for 5 minutes.
   */
  async validateApiKey(tenantId: string): Promise<{
    valid: boolean;
    source: ApiKeySource | null;
    account?: Record<string, unknown>;
    error?: string;
  }> {
    const cached = this.accountCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return { valid: true, source: 'tenant', account: cached.account };
    }
    const apiKeyInfo = await this.getApiKey(tenantId);
    if (!apiKeyInfo) {
      return { valid: false, source: null, error: 'No API key configured' };
    }
    try {
      const res = await fetch(`${this.brevoConfig.apiBaseUrl}/account`, {
        headers: { 'api-key': apiKeyInfo.key, Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          valid: false,
          source: apiKeyInfo.source,
          error: `Brevo HTTP ${res.status}: ${text.slice(0, 200)}`,
        };
      }
      const account = (await res.json()) as Record<string, unknown>;
      this.accountCache.set(tenantId, {
        expiresAt: Date.now() + API_KEY_CACHE_TTL_MS,
        account,
      });
      return { valid: true, source: apiKeyInfo.source, account };
    } catch (err) {
      return {
        valid: false,
        source: apiKeyInfo.source,
        error: (err as Error).message,
      };
    }
  }

  /** Invalidate caches (useful after `disconnect`). */
  invalidate(tenantId: string): void {
    this.credentialCache.delete(tenantId);
    this.accountCache.delete(tenantId);
  }

  /** Legacy method retained for backwards compatibility. */
  async getAccountInfo(tenantId: string): Promise<Record<string, unknown>> {
    const result = await this.validateApiKey(tenantId);
    if (!result.valid || !result.account) {
      throw new BadRequestException(
        result.error || 'Failed to fetch Brevo account info',
      );
    }
    return result.account;
  }

  /**
   * Send a single transactional email to up to 50 recipients using Brevo's
   * `messageVersions` API. Recipient-specific variables enable basic
   * per-recipient personalization without separate API calls.
   *
   * Throws if `recipients` exceeds BREVO_BATCH_LIMIT.
   * On partial failure, returns `{accepted, failed, messageIds, errors}` —
   * does NOT throw on per-recipient Brevo 4xx errors so the caller can act
   * on the result list.
   */
  async sendBatch(
    tenantId: string,
    dto: {
      recipients: SendBatchItem[];
      subject: string;
      htmlContent: string;
      textContent?: string;
      from?: string;
      fromName?: string;
      replyTo?: string;
      signature?: string;
      tags?: string[];
    },
  ): Promise<SendBatchResult> {
    const recipients = dto.recipients;
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new BadRequestException('recipients must be a non-empty array');
    }
    if (recipients.length > BREVO_BATCH_LIMIT) {
      throw new BadRequestException(
        `Batch size ${recipients.length} exceeds Brevo limit (${BREVO_BATCH_LIMIT}). Split the call.`,
      );
    }

    const apiKeyInfo = await this.getApiKey(tenantId);
    if (!apiKeyInfo) {
      throw new BadRequestException(
        'Brevo is not configured. Set BREVO_MASTER_API_KEY in the environment or connect Brevo in Settings → Integrations.',
      );
    }

    // Pre-filter suppressed recipients in one query.
    const suppressed = await this.suppressions.filterSuppressed(
      tenantId,
      recipients.map((r) => r.to),
    );

    await this.usage.checkLimitFor(
      tenantId,
      recipients.length - suppressed.size,
    );

    const identity = await this.getTenantIdentity(tenantId);
    const fromAddress = dto.from || identity?.senderEmail || '';
    const fromName = dto.fromName || identity?.senderName || '';
    const replyTo = dto.replyTo || identity?.replyToEmail || undefined;

    if (!fromAddress) {
      throw new BadRequestException(
        'No Brevo sender configured. Set EMAIL_FROM_ADDRESS in the environment, or PUT /integrations/brevo/sender for this tenant.',
      );
    }

    const result: SendBatchResult = {
      total: recipients.length,
      accepted: 0,
      failed: 0,
      suppressed: 0,
      messageIds: [],
      errors: [],
    };

    for (const r of recipients) {
      if (!r.to || !/.+@.+\..+/.test(r.to)) {
        result.failed += 1;
        result.errors.push({
          to: r.to ?? '',
          status: 0,
          message: 'Invalid email address',
        });
        continue;
      }
      if (suppressed.has(r.to.toLowerCase().trim())) {
        result.suppressed += 1;
        result.errors.push({
          to: r.to,
          status: 0,
          message: 'Recipient is on the suppression list',
          suppressed: true,
        });
        continue;
      }
      const html = renderHtml(dto.htmlContent, dto.signature);
      const body: Record<string, unknown> = {
        to: [{ email: r.to }],
        sender: { email: fromAddress, ...(fromName ? { name: fromName } : {}) },
        subject: dto.subject,
        htmlContent: html,
        ...(Object.keys(r.variables ?? {}).length > 0
          ? { params: r.variables }
          : {}),
      };
      if (replyTo) body.replyTo = { email: replyTo };
      if (dto.tags && dto.tags.length > 0) body.tags = dto.tags;

      try {
        const res = await fetch(`${this.brevoConfig.apiBaseUrl}/smtp/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'api-key': apiKeyInfo.key,
          },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = (await res.json()) as BrevoSendResponse;
          const mid = data.messageId ?? 'unknown';
          result.accepted += 1;
          result.messageIds.push(mid);
          this.logger.log(
            `Batch email sent tenant=${tenantId} to=${r.to} via ${apiKeyInfo.source}: ${mid}`,
          );
        } else {
          const text = await res.text().catch(() => 'unknown');
          result.failed += 1;
          result.errors.push({
            to: r.to,
            status: res.status,
            message: text.slice(0, 200),
          });
        }
      } catch (err) {
        result.failed += 1;
        result.errors.push({
          to: r.to,
          status: 0,
          message: (err as Error).message,
        });
      }
    }

    if (result.accepted > 0) {
      await this.usage.recordSendBatch(tenantId, result.accepted);
    }
    return result;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function renderHtml(htmlContent: string, signature?: string): string {
  if (!signature) return htmlContent;
  return `${htmlContent}<br><br><div class="signature">${escapeHtml(signature)}</div>`;
}

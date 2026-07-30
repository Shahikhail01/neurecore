/**
 * HermesAdapterService — proxies execution requests to the sidecar.
 *
 * Plan ref: NC-AWL-IMP-2 §1.3
 *
 * The service is the ONLY place that does outbound HTTP to the sidecar.
 * Each public method:
 *   1. Mints a fresh scoped token (≤15 min TTL) bound to the executionId.
 *   2. Calls the sidecar over the internal network with the token.
 *   3. Translates the sidecar's response (or error) into the gateway's
 *      contract.
 *
 * The controller (hermes-adapter.controller.ts) sits above this service and
 * handles the NeureCore concerns: JWT auth, RBAC, audit logging. The
 * service is purely about the sidecar boundary.
 *
 * **HTTP client:** Node 18+'s built-in `fetch`. We intentionally avoid
 *   `@nestjs/axios` and `axios` because the backend's package.json does
 *   not currently include them, and we don't want to add a new dependency
 *   just for outbound HTTP to one internal service. If the sidecar call
 *   volume grows, swap this for `@nestjs/axios` (which is the
 *   standard NestJS HTTP client).
 *
 * **What this service is NOT:**
 *   - It does NOT call any NeureCore domain API. Phase 2 adds the tool
 *     gateway that does those.
 *   - It does NOT persist execution state. The sidecar persists, and the
 *     gateway reads from the sidecar on demand.
 *   - It does NOT do RBAC. The controller enforces "is this tenant allowed
 *     to call this endpoint" before invoking this service.
 */

import { Injectable, Logger, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HermesTokenService } from './token.service';

export interface StartExecutionInput {
  executionId: string;
  tenantId: string;
  userId: string;
  projectId?: string;
  workspacePath: string;
  allowedTools: string[];
  initialMessage: string;
  approvalThreshold?: 'NONE' | 'STANDARD' | 'HIGH';
}

export interface ApprovalDecisionInput {
  executionId: string;
  tenantId: string;
  userId: string;
  approvalId: string;
  decision: 'approve' | 'reject';
  reason?: string;
}

export interface SidecarExecutionState {
  executionId: string;
  status:
    | 'PENDING'
    | 'RUNNING'
    | 'WAITING_APPROVAL'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';
  startedAt: number;
  updatedAt: number;
  events: SidecarEvent[];
  pendingApproval: SidecarPendingApproval | null;
  completedAt: number | null;
  failureReason: string | null;
}

export interface SidecarEvent {
  type: string;
  ts: number;
  payload: Record<string, unknown>;
}

export interface SidecarPendingApproval {
  approvalId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  requestedAt: number;
  reason: string;
}

/**
 * Minimal HTTP client interface. We type against this so the adapter
 * service is testable without a real HTTP client. The default
 * implementation (`FetchSidecarHttpClient`) uses Node 18+'s built-in fetch.
 *
 * Test code can pass a fake implementation that returns mock responses.
 */
export interface SidecarHttpClient {
  get<T>(url: string, headers: Record<string, string>): Promise<{
    status: number;
    data: T;
  }>;
  post<T>(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{ status: number; data: T }>;
}

export class FetchSidecarHttpClient implements SidecarHttpClient {
  constructor(
    private readonly timeoutMs: number,
    private readonly logger?: Logger,
  ) {}

  async get<T>(url: string, headers: Record<string, string>): Promise<{ status: number; data: T }> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      const data = (await response.json()) as T;
      return { status: response.status, data };
    } finally {
      clearTimeout(t);
    }
  }

  async post<T>(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{ status: number; data: T }> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await response.json()) as T;
      return { status: response.status, data };
    } finally {
      clearTimeout(t);
    }
  }
}

@Injectable()
export class HermesAdapterService {
  private readonly logger = new Logger(HermesAdapterService.name);
  private readonly sidecarUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly httpClient: SidecarHttpClient;

  constructor(
    config: ConfigService,
    private readonly tokenService: HermesTokenService,
    @Optional() httpClient?: SidecarHttpClient,
  ) {
    const url = config.get<string>('HERMES_SIDECAR_URL');
    if (!url) {
      throw new Error(
        'HERMES_SIDECAR_URL is not configured. Set it to the sidecar\'s internal address (e.g. http://127.0.0.1:8080).',
      );
    }
    this.sidecarUrl = url.replace(/\/+$/, '');
    const timeoutEnv = config.get<string>('HERMES_SIDECAR_TIMEOUT_MS');
    const configuredTimeout = timeoutEnv ? Number.parseInt(timeoutEnv, 10) : 120_000;
    this.requestTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 120_000;
    this.httpClient = httpClient ?? new FetchSidecarHttpClient(this.requestTimeoutMs, this.logger);
  }

  // ─── Public API (5 endpoints from the integration plan) ────

  async startExecution(input: StartExecutionInput): Promise<SidecarExecutionState> {
    this.validateExecutionId(input.executionId);
    this.validateTenantId(input.tenantId);
    const token = this.tokenService.mint({
      sub: input.userId,
      tenantId: input.tenantId,
      executionId: input.executionId,
      workspacePath: input.workspacePath,
      allowedTools: input.allowedTools,
      approvalThreshold: input.approvalThreshold ?? 'STANDARD',
    });
    await this.post<SidecarExecutionState>(
      '/v1/executions',
      token,
      {
        executionId: input.executionId,
        tenantId: input.tenantId,
        projectId: input.projectId,
        allowedTools: input.allowedTools,
        initialMessage: input.initialMessage,
        workspaceSpec: {
          threeLayer: true,
          template: '/opt/neurecore/hermes/template',
          persistent: input.workspacePath,
          ephemeral: `${input.workspacePath}/tmp`,
        },
      },
    );
    return this.get<SidecarExecutionState>(
      `/v1/executions/${encodeURIComponent(input.executionId)}`,
      token,
    );
  }

  async getExecutionStatus(
    executionId: string,
    tenantId: string,
    userId: string,
  ): Promise<SidecarExecutionState> {
    this.validateExecutionId(executionId);
    const token = this.tokenService.mint({
      sub: userId,
      tenantId,
      executionId,
      workspacePath: `/var/lib/neurecore/hermes/tenants/${tenantId}/`,
      allowedTools: [],
      approvalThreshold: 'NONE',
    });
    return this.get<SidecarExecutionState>(
      `/v1/executions/${encodeURIComponent(executionId)}`,
      token,
    );
  }

  async resumeExecution(
    executionId: string,
    tenantId: string,
    userId: string,
  ): Promise<SidecarExecutionState> {
    this.validateExecutionId(executionId);
    const token = this.tokenService.mint({
      sub: userId,
      tenantId,
      executionId,
      workspacePath: `/var/lib/neurecore/hermes/tenants/${tenantId}/`,
      allowedTools: [],
      approvalThreshold: 'NONE',
    });
    return this.post<SidecarExecutionState>(
      `/v1/executions/${encodeURIComponent(executionId)}/resume`,
      token,
      {},
    );
  }

  async cancelExecution(
    executionId: string,
    tenantId: string,
    userId: string,
  ): Promise<SidecarExecutionState> {
    this.validateExecutionId(executionId);
    const token = this.tokenService.mint({
      sub: userId,
      tenantId,
      executionId,
      workspacePath: `/var/lib/neurecore/hermes/tenants/${tenantId}/`,
      allowedTools: [],
      approvalThreshold: 'NONE',
    });
    return this.post<SidecarExecutionState>(
      `/v1/executions/${encodeURIComponent(executionId)}/cancel`,
      token,
      {},
    );
  }

  async submitApprovalDecision(
    input: ApprovalDecisionInput,
  ): Promise<SidecarExecutionState> {
    this.validateExecutionId(input.executionId);
    const current = await this.getExecutionStatus(
      input.executionId,
      input.tenantId,
      input.userId,
    );
    const pendingTool = current.pendingApproval?.toolName;
    const token = this.tokenService.mint({
      sub: input.userId,
      tenantId: input.tenantId,
      executionId: input.executionId,
      workspacePath: `/var/lib/neurecore/hermes/tenants/${input.tenantId}/`,
      allowedTools: pendingTool ? [pendingTool] : [],
      approvalThreshold: 'NONE',
    });
    return this.post<SidecarExecutionState>(
      `/v1/executions/${encodeURIComponent(input.executionId)}/approvals/${encodeURIComponent(input.approvalId)}`,
      token,
      {
        decision: input.decision,
        reason: input.reason ?? '',
      },
    );
  }

  // ─── HTTP plumbing ────────────────────────────────────────

  private async get<T>(path: string, token: string): Promise<T> {
    try {
      const response = await this.httpClient.get<T>(
        `${this.sidecarUrl}${path}`,
        this.authHeaders(token),
      );
      if (response.status >= 400) {
        throw this.translateError(response.status, response.data);
      }
      return response.data;
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      throw this.translateTransportError(e);
    }
  }

  private async post<T>(path: string, token: string, body: unknown): Promise<T> {
    try {
      const response = await this.httpClient.post<T>(
        `${this.sidecarUrl}${path}`,
        body,
        this.authHeaders(token),
      );
      if (response.status >= 400) {
        throw this.translateError(response.status, response.data);
      }
      return response.data;
    } catch (e) {
      // Re-throw if it's already an HttpException (from translateError).
      // Otherwise translate as a transport error.
      if (e instanceof HttpException) {
        throw e;
      }
      throw this.translateTransportError(e);
    }
  }

  private authHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private translateError(status: number, body: unknown): HttpException {
    this.logger.warn(
      `Sidecar returned HTTP ${status}: ${JSON.stringify(body)}`,
    );
    return new HttpException(
      body ?? { error: 'sidecar_error', code: 'unknown' },
      status as HttpStatus,
    );
  }

  private translateTransportError(e: unknown): HttpException {
    if (e instanceof Error) {
      this.logger.error(`Sidecar transport error: ${e.message}`);
    }
    return new HttpException(
      {
        error: 'sidecar_unreachable',
        code: 'transport_error',
        retriable: true,
        message: e instanceof Error ? e.message : 'unknown',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  // ─── Input validation ─────────────────────────────────────

  private validateExecutionId(id: string): void {
    if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
      throw new HttpException(
        { error: 'invalid_execution_id', code: 'bad_request', retriable: false },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private validateTenantId(id: string): void {
    if (!id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      throw new HttpException(
        { error: 'invalid_tenant_id', code: 'bad_request', retriable: false },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

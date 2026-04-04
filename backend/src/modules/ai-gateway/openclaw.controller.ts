/**
 * OpenClaw Inbound Webhook Controller
 *
 * Implements the Channel Adapter pattern for OpenClaw.
 *
 * Architecture rule (LOCKED):
 *   OpenClaw is ONLY a channel. It carries messages in and out.
 *   ALL AI reasoning happens inside LangGraph — never inside this controller.
 *
 * Security:
 *   - @Public(): JWT guard skipped; security is via HMAC-SHA256 signature.
 *   - X-OpenClaw-Signature must match HMAC-SHA256(rawBody, OPENCLAW_WEBHOOK_SECRET).
 *   - Uses timingSafeEqual to prevent timing-oracle attacks.
 *   - Tenant and Agent are verified against the DB before task creation.
 *   - Raw body is required for signature verification (main.ts rawBody: true).
 *
 * SOLID:
 *   SRP  — controller only handles channel-boundary concerns.
 *   DIP  — depends on AgentExecutorService abstraction, not graph directly.
 *   OCP  — adding new channels only requires new controllers; no existing code changes.
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  RawBody,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AgentExecutorService } from '../agents/services/agent-executor.service';
import { Public } from '../../common/decorators/roles.decorator';
import { TaskStatus, TaskPriority } from '@prisma/client';

class InboundMessageDto {
  @IsString()
  agentId!: string;

  @IsString()
  tenantId!: string;

  @IsString()
  userMessage!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@Public()
@Controller({ path: 'openclaw', version: '1' })
export class OpenClawWebhookController {
  private readonly logger = new Logger(OpenClawWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly executorService: AgentExecutorService,
  ) {}

  /**
   * POST /api/v1/openclaw/message
   *
   * Receives an inbound message from OpenClaw, validates HMAC signature,
   * verifies tenant/agent ownership, creates a Task, and dispatches it to
   * the LangGraph pipeline (fire-and-forget).
   *
   * Returns {taskId} immediately — client tracks progress via WebSocket.
   */
  @Post('message')
  @HttpCode(HttpStatus.ACCEPTED)
  async receiveMessage(
    @Headers('x-openclaw-signature') signature: string | undefined,
    @RawBody() rawBody: Buffer,
    @Body() body: InboundMessageDto,
  ): Promise<{ taskId: string; status: string }> {
    // ─── 1. HMAC-SHA256 signature validation ───────────────────────────────
    const secret = this.configService.get<string>('OPENCLAW_WEBHOOK_SECRET');
    if (!secret) {
      // Fail closed: if the secret is not configured, reject all inbound requests
      this.logger.error(
        '[Security] OPENCLAW_WEBHOOK_SECRET is not set — rejecting inbound webhook',
      );
      throw new UnauthorizedException('Webhook not configured');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing X-OpenClaw-Signature header');
    }

    if (!this.verifySignature(rawBody, signature, secret)) {
      this.logger.warn(
        `[Security] Invalid OpenClaw signature for tenantId=${body.tenantId}`,
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // ─── 2. Validate tenant and agent exist and belong together ────────────
    const { agentId, tenantId, userMessage, sessionId, metadata } = body;

    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
      select: { id: true, tenantId: true, name: true },
    });

    if (!agent) {
      throw new BadRequestException(
        'Agent not found or does not belong to the specified tenant',
      );
    }

    // ─── 3. Create Task with channel context stored in input JSON ──────────
    const task = await this.prisma.task.create({
      data: {
        title: `OpenClaw: ${userMessage.slice(0, 100)}`,
        description: userMessage,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        input: {
          channelSource: 'openclaw',
          channelContext: {
            // OpenClaw's own agent/session reference — used for outbound relay
            openClawAgentId: agentId,
            sessionId: sessionId ?? null,
            metadata: metadata ?? {},
          },
          userMessage,
        } as never,
        agentId,
        tenantId,
      },
    });

    this.logger.log(
      `[AUDIT] OpenClaw inbound message accepted: taskId=${task.id} agentId=${agentId} tenantId=${tenantId}`,
    );

    // ─── 4. Fire-and-forget — LangGraph pipeline handles all AI reasoning ──
    void this.executorService.executeTask(task.id, agentId, tenantId);

    return { taskId: task.id, status: 'queued' };
  }

  /**
   * Constant-time HMAC-SHA256 signature verification.
   * Accepts both 'sha256=<hex>' and raw hex formats.
   *
   * SECURITY: uses timingSafeEqual to prevent timing-oracle attacks.
   */
  private verifySignature(
    rawBody: Buffer,
    receivedSignature: string,
    secret: string,
  ): boolean {
    try {
      const expected = createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      // Strip optional 'sha256=' prefix
      const received = receivedSignature.startsWith('sha256=')
        ? receivedSignature.slice(7)
        : receivedSignature;

      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(received, 'hex');

      if (expectedBuf.length !== receivedBuf.length) return false;
      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }
}

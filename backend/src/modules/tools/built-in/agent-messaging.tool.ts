/**
 * AgentMessagingTool
 *
 * Sends a real-time message from one agent to another agent within the same
 * tenant, emitted as a WebSocket event via EventsGateway.
 *
 * Security:
 *   - Tenant isolation: the target agent is verified to belong to the same
 *     tenantId as the executing context before any event is emitted.
 *   - Message length capped at 1 000 characters to prevent abuse.
 *   - Agent UUID validated by Zod z.string().uuid().
 *
 * SOLID:
 *   SRP  — message routing only; no content generation or state mutation.
 *   DIP  — depends on PrismaService and EventsGateway abstractions.
 */
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';

const AgentMessagingInputSchema = z.object({
  targetAgentId: z.string().uuid().describe('UUID of the target agent'),
  message: z
    .string()
    .min(1)
    .max(1000)
    .describe('Message to send to the target agent (max 1 000 chars)'),
});

type AgentMessagingInput = z.infer<typeof AgentMessagingInputSchema>;

@Injectable()
export class AgentMessagingTool extends BaseStructuredTool {
  readonly name = 'agent_messaging';
  readonly description =
    'Send a real-time message to another agent within the same tenant. ' +
    'The target agent must belong to the same tenant. ' +
    'Delivers the message via WebSocket event "agent:message".';
  readonly category = ToolCategory.AI;
  readonly inputSchema = AgentMessagingInputSchema;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {
    super();
  }

  protected async executeImpl(
    input: AgentMessagingInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<{ delivered: boolean }>> {
    const tenantId = context.tenantId;

    if (!tenantId) {
      return { success: false, error: 'Tenant context is required' };
    }

    // ── Security: verify target agent belongs to the caller's tenant ───────
    const targetAgent = await this.prisma.agent.findFirst({
      where: { id: input.targetAgentId, tenantId },
      select: { id: true, name: true },
    });

    if (!targetAgent) {
      return {
        success: false,
        error:
          'Target agent not found or does not belong to the current tenant',
      };
    }

    // ── Deliver via WebSocket ──────────────────────────────────────────────
    this.events.emitToTenant(tenantId, 'agent:message', {
      toAgentId: input.targetAgentId,
      fromAgentId: context.agentId ?? null,
      message: input.message,
      timestamp: Date.now(),
    });

    this.logger.log(
      `[AgentMessagingTool] Message delivered to agent=${input.targetAgentId} tenant=${tenantId}`,
    );

    return { success: true, data: { delivered: true } };
  }
}

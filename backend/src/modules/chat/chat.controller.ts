import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { SendChatMessageDto } from './dto/chat.dto';
import { ChatService } from './chat.service';
import { ChatSseService } from './chat-sse.service';
import { ChatHistoryService } from './chat-history.service';
import type { Response } from 'express';

interface JwtPayload {
  sub: string;
  tenantId?: string;
  role: string;
}

interface AuthedRequest {
  user: JwtPayload;
}

/**
 * Chat Controller
 *
 * Single canonical chat surface:
 *   - POST /api/v1/chat/messages  — non-streaming query/action reply
 *   - POST /api/v1/chat/stream    — SSE streaming reply
 *   - GET  /api/v1/chat/history   — paginated message history (persisted)
 *   - DELETE /api/v1/chat/history — clear conversation history
 *   - POST /api/v1/chat/suggestions — stub (slash commands handled client-side)
 *
 * Both `/chat/messages` and `/chat/stream` return the same shape:
 * { reply, conversationId, tokens, model, provider, liveData }.
 *
 * The caller's tenantId is taken from the JWT (set by JwtAuthGuard) so the
 * LLM is grounded in real tenant data instead of hallucinating.
 */
@Controller({ version: '1' })
@ApiCommon('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly chatSse: ChatSseService,
    private readonly chatHistory: ChatHistoryService,
  ) {}

  /** Command Center "Ask AI" entry point (non-streaming) */
  @Post('chat/messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Body() dto: SendChatMessageDto,
    @Req() req: AuthedRequest,
  ) {
    return this.chat.send(dto, req.user?.tenantId, req.user?.sub);
  }

  /**
   * SSE streaming endpoint — streams AI response tokens as Server-Sent Events.
   * Used by the frontend chat panel for real-time token-by-token rendering.
   *
   * Phase 3.2: action requests now route through the agent graph
   * inside the stream path too (previously only the non-streaming
   * `send()` path did this). The action result is yielded as a
   * single delta followed by `done`.
   */
  @Post('chat/stream')
  async chatStream(
    @Body() dto: SendChatMessageDto,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatSse.stream(dto, req.user?.tenantId, req.user?.sub, res);
  }

  /**
   * History endpoint — returns persisted messages for a conversation
   * (or all conversations for the tenant when no conversationId supplied).
   */
  @Get('chat/history')
  @HttpCode(HttpStatus.OK)
  async history(
    @Query('conversationId') conversationId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { data: [], total: 0 };
    return this.chatHistory.getHistory({
      tenantId,
      userId: req.user?.sub,
      conversationId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * FIX-DEP-D6 (Round-3 verification, 2026-07-24): list the current
   * tenant+user's chat conversations so the FE can render a sidebar of
   * previous threads. Returns session metadata only; full message bodies
   * are still loaded via /chat/history.
   */
  @Get('chat/conversations')
  @HttpCode(HttpStatus.OK)
  async conversations(
    @Query('limit') limit: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { data: [], total: 0 };
    return this.chatHistory.listConversations({
      tenantId,
      userId: req.user?.sub,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** Clear history for a conversation (or all messages for the user if no id) */
  @Delete('chat/history')
  @HttpCode(HttpStatus.OK)
  async clearHistory(
    @Query('conversationId') conversationId: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { deleted: 0 };
    return this.chatHistory.clearHistory({
      tenantId,
      userId: req.user?.sub,
      conversationId,
    });
  }

  /** Stub suggestions endpoint (slash commands handled client-side) */
  @Post('chat/suggestions')
  @HttpCode(HttpStatus.OK)
  suggestions(@Body() _body: { query?: string }) {
    return { suggestions: [] };
  }

  /**
   * SIM-04 G-08 — list AI agents the current tenant can route chat messages
   * to. The chat composer on the FE wants to know which agents are
   * available before the user starts a thread. We return the same agent
   * shape the `/agents` endpoint exposes (id, name, roleKey, department,
   * availability) so the picker can render without a second round-trip.
   *
   * Tenant-scoped by construction; archived agents are filtered out so
   * the FE never offers a dead handle. Limit clamped to [1, 200].
   */
  @Get('chat/agents')
  @HttpCode(HttpStatus.OK)
  async chatAgents(
    @Query('limit') limit: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { data: [], total: 0 };
    const take = Math.min(Math.max(limit ? Number(limit) : 50, 1), 200);
    // We can't import PrismaService here (SRP — controller stays thin),
    // so this endpoint delegates to ChatService which already owns
    // tenant context. Implemented as a thin pass-through below.
    return this.chat.listChatAgents(tenantId, take);
  }
}

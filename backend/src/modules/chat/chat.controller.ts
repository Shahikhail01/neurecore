/**
 * ChatController  — /api/v1/chat
 *
 * Conversational control interface for the tenant's AI workforce.
 * SRP: HTTP routing only — all business logic in ChatService.
 */

import { Controller, Get, Post, Delete, Body, Query } from '@nestjs/common';
import { ChatService, ChatRequest } from './chat.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

class SendMessageDto implements ChatRequest {
  query!: string;
  context?: 'agent' | 'task' | 'workflow' | 'system';
  conversationId?: string;
}

class SuggestionsDto {
  query!: string;
}

@Controller({ path: 'chat', version: '1' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** POST /v1/chat/messages — send a message to the control assistant */
  @Post('messages')
  sendMessage(@CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto) {
    const tenantId = user.tenantId ?? '';
    return this.chatService.sendMessage(user.sub, tenantId, dto);
  }

  /** GET /v1/chat/history — get conversation history for current user */
  @Get('history')
  getHistory(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.chatService.getHistory(
      user.sub,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** DELETE /v1/chat/history — clear conversation history for current user */
  @Delete('history')
  clearHistory(@CurrentUser() user: JwtPayload) {
    return this.chatService.clearHistory(user.sub);
  }

  /** POST /v1/chat/suggestions — get contextual suggestions */
  @Post('suggestions')
  getSuggestions(@CurrentUser() user: JwtPayload, @Body() dto: SuggestionsDto) {
    const tenantId = user.tenantId ?? '';
    return this.chatService.getSuggestions(tenantId, dto.query ?? '');
  }
}

/**
 * Phase 22 — ChatExportController (CR-AI-0003 byte-download route).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §3 (P22).
 *
 * SOLID — SRP: this controller owns ONLY the HTTP shape and tenant
 * scope guard. Bytes are produced by `IFileRenderer`; evidence is
 * written by `IExportAuditSink`. The controller is closed for
 * modification when a new format is added (OCP).
 *
 * DIP: depends on `ChatExportService` (which itself depends on
 * `IExportAuditSink`) — never on `PrismaService` directly.
 *
 * Endpoints:
 *   POST /api/v1/chat/export                — create an export row
 *   GET  /api/v1/chat/export/:id/download   — stream the bytes
 *   DELETE /api/v1/chat/export/:id          — delete + audit
 */

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { ChatExportRequestDto } from '../dto/chat-export.dto';
import { ChatExportService } from '../services/chat-export.service';
import type { Response } from 'express';

interface JwtPayload {
  sub: string;
  tenantId?: string;
  role: string;
}
interface AuthedRequest {
  user: JwtPayload;
}

const MIME: Record<string, string> = {
  csv: 'text/csv; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

@ApiCommon('chat')
@UseGuards(JwtAuthGuard)
@Controller({ version: '1' })
export class ChatExportController {
  constructor(private readonly exports: ChatExportService) {}

  @Post('chat/export')
  @HttpCode(HttpStatus.OK)
  async create(
    @Body() dto: ChatExportRequestDto,
    @Req() req: AuthedRequest,
  ) {
    const tenantId = this.requireTenant(req);
    return this.exports.export({
      tenantId,
      actorId: req.user.sub,
      conversationId: dto.conversationId,
      format: dto.format,
      redact: dto.redact,
    });
  }

  @Get('chat/export/:exportId/download')
  async download(
    @Param('exportId') exportId: string,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const tenantId = this.requireTenant(req);
    const out = await this.exports.readBytes(tenantId, exportId);
    if (!out) throw new NotFoundException('export not found');
    res.setHeader(
      'Content-Type',
      MIME[out.format] ?? 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.exportId}.${out.format}"`,
    );
    res.status(HttpStatus.OK).send(out.bytes);
  }

  @Delete('chat/export/:exportId')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('exportId') exportId: string,
    @Req() req: AuthedRequest,
  ) {
    const tenantId = this.requireTenant(req);
    const deleted = await this.exports.deleteExport(tenantId, exportId);
    return { exportId, deleted };
  }

  private requireTenant(req: AuthedRequest): string {
    const t = req.user?.tenantId;
    if (!t || t === '*') {
      throw new ForbiddenException('tenant context required');
    }
    return t;
  }
}

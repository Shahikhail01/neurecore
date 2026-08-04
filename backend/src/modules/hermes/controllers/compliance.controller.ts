import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import type { Request } from 'express';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

// Phase 0.5 collision-resolution:
// Previously this Hermes controller was mounted at `@Controller({ path:
// 'compliance', version: '1' })` which collided with the canonical
// `modules/compliance/compliance.controller.ts` on the same prefix. Although
// the two controllers owned disjoint sub-paths (`/compliance/checklist/*`
// vs `/compliance/export/*`), sharing the prefix is fragile and violates the
// SOLID rule "one canonical owner per route prefix". We moved Hermes's audit
// exports under `hermes-compliance/*` so the boundary is explicit.
// See neurecore/memory-bank-arc/comms/route-duplication-report.yaml.
@Controller({ path: 'hermes-compliance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.OWNER)
export class ComplianceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('export/thread/:threadId')
  async exportThread(
    @Param('threadId') threadId: string,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const tenantId = req.user?.tenantId ?? '';
    const messages = await this.prisma.hermesMessage.findMany({
      where: {
        threadId,
        session: { tenantId },
      },
      orderBy: { createdAt: 'asc' },
    });
    const csv = formatMessagesAsCsv(messages);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="thread-${threadId}.csv"`,
    );
    res.send(csv);
  }

  @Get('export/decisions')
  async exportDecisions(
    @Req() req: AuthedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const tenantId = req.user?.tenantId ?? '';
    const logs = await this.prisma.hermesAuditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { status: 'success', data: { decisions: logs, format: 'json' } };
  }
}

function formatMessagesAsCsv(
  messages: Array<{
    id: string;
    sessionId: string;
    role: string;
    content: string;
    createdAt: Date;
  }>,
): string {
  const header = 'id,sessionId,role,createdAt,content\n';
  const rows = messages
    .map((m) => {
      const safe = m.content.replace(/"/g, '""').replace(/\n/g, ' ');
      return `${m.id},${m.sessionId},${m.role},${m.createdAt.toISOString()},"${safe}"`;
    })
    .join('\n');
  return header + rows;
}

import {
  Controller,
  Get,
  Query,
  ForbiddenException,
  Header,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { ObservabilityService } from './services/observability.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  OUTBOX_REPOSITORY,
  type IOutboxRepository,
} from '../../common/outbox/outbox-repository.port';

@Controller({ path: 'observability', version: '1' })
@ApiCommon('observability')
export class ObservabilityController {
  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepo: IOutboxRepository,
  ) {}

  /** Tenant KPI summary */
  @Get('kpis')
  getTenantKpis(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getTenantKpis(user.tenantId);
  }

  /** Execution logs for the tenant */
  @Get('logs')
  getExecutionLogs(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('agentId') agentId?: string,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getExecutionLogs(user.tenantId, {
      page: Number(page),
      limit: Number(limit),
      agentId,
    });
  }

  /** Metrics time-series */
  @Get('metrics')
  getMetrics(
    @CurrentUser() user: JwtPayload,
    @Query('name') name?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit = '100',
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getMetrics(user.tenantId, {
      name,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: Number(limit),
    });
  }

  /**
   * GET /observability/traces — grouped step-by-step execution traces per task.
   */
  @Get('traces')
  getTraces(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('agentId') agentId?: string,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getTraces(user.tenantId, {
      page: Number(page),
      limit: Number(limit),
      agentId,
    });
  }

  /**
   * GET /observability/costs — token/cost breakdown by agent.
   */
  @Get('costs')
  getCosts(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getCosts(user.tenantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /**
   * GET /observability/prometheus — Prometheus text-format metrics scrape endpoint.
   * Tenant-scoped for regular users; platform-wide for Super Admin.
   */
  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getPrometheus(@CurrentUser() user: JwtPayload): Promise<string> {
    const tenantId = ['SUPER_ADMIN', 'PLATFORM_ADMIN'].includes(user.role ?? '')
      ? undefined
      : (user.tenantId ?? undefined);
    return this.observabilityService.getPrometheusMetrics(tenantId);
  }

  /** Platform-wide summary — Super Admin only */
  @Get('platform')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  getPlatformSummary() {
    return this.observabilityService.getPlatformSummary();
  }

  /**
   * SIM-04 G-01 — outbox health snapshot for the caller's tenant.
   * Returns counts per status, dead-letter totals, and the age of the
   * oldest pending event so an operator can confirm the worker is
   * draining the backlog. Tenant-scoped by construction.
   */
  @Get('outbox/health')
  async outboxHealth(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    const [backlog, deadLetters, totalPublished] = await Promise.all([
      this.outboxRepo.getBacklogSummary(user.tenantId),
      this.outboxRepo.listDeadLetters(user.tenantId, 25),
      this.prisma.enterpriseEventOutbox.count({
        where: { tenantId: user.tenantId },
      }),
    ]);
    return {
      tenantId: user.tenantId,
      legacyOutbox: {
        pending: backlog.pending,
        processing: backlog.processing,
        processed: backlog.processed,
        deadLetter: backlog.deadLetter,
        oldestPendingAt: backlog.oldestPendingAt,
        oldestStuckAt: backlog.oldestStuckAt,
        oldestPendingAgeMs: backlog.oldestPendingAt
          ? Date.now() - backlog.oldestPendingAt.getTime()
          : 0,
      },
      enterpriseEventOutbox: {
        published: totalPublished,
        deadLetters: deadLetters.length,
      },
      sampleDeadLetters: deadLetters.slice(0, 5).map((d) => ({
        id: d.id,
        eventType: d.eventType,
        lastError: d.lastError,
        createdAt: d.createdAt,
      })),
      observedAt: new Date().toISOString(),
    };
  }

  /**
   * SIM-04 G-01 — Enterprise Event Fabric (Phase 2 §15) health snapshot.
   * Counts per outbox/inbox status for the caller's tenant.
   * Tenant-scoped by construction.
   */
  @Get('enterprise-events/health')
  async enterpriseEventsHealth(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    const [
      outboxTotal,
      outboxPending,
      inboxPending,
      inboxProcessing,
      inboxProcessed,
      inboxFailed,
      inboxDeadLettered,
      oldestOutbox,
    ] = await Promise.all([
      this.prisma.enterpriseEventOutbox.count({
        where: { tenantId: user.tenantId },
      }),
      this.prisma.enterpriseEventOutbox.count({
        where: { tenantId: user.tenantId, status: 'PENDING' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId: user.tenantId, status: 'PENDING' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId: user.tenantId, status: 'PROCESSING' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId: user.tenantId, status: 'PROCESSED' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId: user.tenantId, status: 'FAILED' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId: user.tenantId, status: 'DEAD_LETTER' },
      }),
      this.prisma.enterpriseEventOutbox.findFirst({
        where: { tenantId: user.tenantId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    return {
      tenantId: user.tenantId,
      outbox: {
        total: outboxTotal,
        pending: outboxPending,
        oldestPendingAgeMs: oldestOutbox
          ? Date.now() - oldestOutbox.createdAt.getTime()
          : 0,
      },
      inbox: {
        pending: inboxPending,
        processing: inboxProcessing,
        processed: inboxProcessed,
        failed: inboxFailed,
        deadLettered: inboxDeadLettered,
      },
      observedAt: new Date().toISOString(),
    };
  }

  /**
   * SIM-04 G-03 — calendar surface. Returns tasks whose due date falls
   * in [from, to] (default: now..+30d). `dueOverride` takes precedence
   * over `dueDate`. Tasks without a date are excluded. Tenant-scoped by
   * construction.
   *
   * Shape per row: { id, title, status, priority, dueAt, projectId,
   * projectName, projectTargetDate, isOverdue, daysUntilDue }.
   */
  @Get('calendar/tasks')
  async calendarTasks(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    const now = new Date();
    const defaultTo = new Date(now);
    defaultTo.setUTCDate(defaultTo.getUTCDate() + 30);
    const fromDate = from ? new Date(from) : now;
    const toDate = to ? new Date(to) : defaultTo;
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid from/to ISO timestamp');
    }
    const take = Math.min(Math.max(limit ? Number(limit) : 200, 1), 500);

    // We filter on tenantId + projectId at the SQL layer, then
    // filter by due date in-process because Prisma can't OR two
    // nullable columns cleanly. Date range is bounded so this is cheap.
    const rows = await this.prisma.task.findMany({
      where: {
        tenantId: user.tenantId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ createdAt: 'asc' }],
      take,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        dueOverride: true,
        projectId: true,
        project: { select: { id: true, name: true, targetDate: true } },
      },
    });

    const items = rows
      .map((t) => ({
        t,
        dueAt: t.dueOverride ?? t.dueDate ?? null,
      }))
      .filter(({ dueAt }) => dueAt != null)
      .filter(({ dueAt }) => {
        const d = dueAt as Date;
        return d >= fromDate && d <= toDate;
      })
      .map(({ t, dueAt }) => {
        const d = dueAt as Date;
        const daysUntilDue = Math.ceil(
          (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueAt,
          projectId: t.projectId,
          projectName: t.project?.name ?? null,
          projectTargetDate: t.project?.targetDate ?? null,
          isOverdue:
            d < now && t.status !== 'COMPLETED' && t.status !== 'APPROVED',
          daysUntilDue,
        };
      });

    return {
      tenantId: user.tenantId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      count: items.length,
      items,
      observedAt: new Date().toISOString(),
    };
  }
}

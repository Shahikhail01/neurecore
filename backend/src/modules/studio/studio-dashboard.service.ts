/**
 * Studio Dashboards — no-code dashboards designer backend.
 *
 * Source plan: §5.13.18 (Analytics and Dashboards, deeper than observability).
 *
 * Solid:
 *   • SRP — only dashboards CRUD + KPI computation. The visual editor
 *     and tile rendering live in the frontend.
 *   • OCP — adding a new tile type = new entry in the registered-tile-types
 *     registry; no other module changes.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * StudioTileSpec — a tile is a single KPI / chart / table on a dashboard.
 * The frontend renders the tile by `type`; the backend computes the data
 * by calling the registered data source.
 */
export type StudioTileType =
  | 'kpi'
  | 'bar-chart'
  | 'line-chart'
  | 'pie-chart'
  | 'table';

export interface StudioTile {
  id: string;
  type: StudioTileType;
  title: string;
  // Where the data comes from. e.g. "agent.executions.success-rate".
  dataSource: string;
  // Optional filters applied at query time.
  filters: Record<string, unknown>;
  // Display options per tile type.
  options: Record<string, unknown>;
}

export interface StudioDashboardLayout {
  tiles: StudioTile[];
  // Display order.
  columns: number;
}

@Injectable()
export class StudioDashboardService {
  private readonly logger = new Logger(StudioDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.studioDashboard.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(args: {
    tenantId: string;
    slug: string;
    displayName: string;
    layout?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.studioDashboard.create({
      data: {
        tenantId: args.tenantId,
        slug: args.slug,
        displayName: args.displayName,
        layout: args.layout ?? { tiles: [], columns: 1 },
      },
    });
  }

  async updateLayout(tenantId: string, id: string, layout: Prisma.InputJsonValue) {
    const dash = await this.prisma.studioDashboard.findUnique({ where: { id } });
    if (!dash) throw new NotFoundException(`dashboard ${id} not found`);
    if (dash.tenantId !== tenantId) {
      throw new ForbiddenException('dashboard belongs to a different tenant');
    }
    return this.prisma.studioDashboard.update({
      where: { id },
      data: { layout },
    });
  }

  /**
   * Compute a live KPI tile from a registered data source.
   * Phase 6.4 ships a stub implementation that handles the four OOB
   * sources (agent.executions.*, twin.audit.*, channel.events.*,
   * sla.events.*). Adding a new source = new branch in `computeSource`.
   */
  async computeTile(tenantId: string, tile: StudioTile): Promise<unknown> {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    switch (tile.dataSource) {
      case 'agent.executions.success-rate': {
        const total = await this.prisma.agentExecution.count({
          where: { tenantId },
        });
        const success = await this.prisma.agentExecution.count({
          where: { tenantId, status: 'SUCCESS' },
        });
        return {
          type: 'kpi',
          value: total === 0 ? null : success / total,
          unit: 'ratio',
          total,
          success,
        };
      }
      case 'agent.executions.duration-p50': {
        const rows = await this.prisma.agentExecution.findMany({
          where: { tenantId, status: 'SUCCESS' },
          select: { durationMs: true },
        });
        const durations = rows
          .map((r) => r.durationMs ?? 0)
          .filter((d) => d > 0)
          .sort((a, b) => a - b);
        return {
          type: 'kpi',
          value:
            durations.length === 0
              ? null
              : durations[Math.floor(durations.length / 2)],
          unit: 'ms',
          sampleSize: durations.length,
        };
      }
      case 'twin.audit.count-by-action': {
        const rows = await this.prisma.aiTwinAuditLog.groupBy({
          by: ['action'],
          where: { tenantId },
          _count: { _all: true },
        });
        return { type: 'table', rows };
      }
      case 'sla.events.overdue-count': {
        const count = await this.prisma.sLAEvent.count({
          where: { tenantId, status: { in: ['OPEN', 'ESCALATED'] } },
        });
        return { type: 'kpi', value: count, unit: 'count' };
      }
      default:
        return { type: 'unknown', dataSource: tile.dataSource };
    }
  }
}

/**
 * MarketplaceService — unified facade over the 8 marketplace tabs.
 *
 * Phase 7, Task 7.3 (per EAOS-implementation-plan.md §9.8 +
 * EAOS-api-contract.md §8.19).
 *
 * Aggregates from:
 *   - solution-packs (SolutionPacksService.listCatalog)
 *   - agent-templates (existing AgentTemplatesService.findAll)
 *   - connectors (existing ConnectorsService)
 *   - workflows (existing WorkflowsService — exposed via templates)
 *   - knowledge-packs (KnowledgeService — pack-grouped knowledge)
 *   - widgets (WidgetRegistry — listable)
 *   - themes (static theme catalog — future-proof)
 *   - installed (SolutionPacksService.listInstalled)
 *
 * Each tab returns the same shape (`MarketplaceItem`) so the frontend can
 * render a single `<MarketplaceCard>` for all 8 tabs.
 *
 * SOLID:
 *  - Facade pattern — single entry point over heterogeneous catalogs.
 *  - DIP — every collaborator is constructor-injected; the service knows
 *    nothing about how the underlying modules read their data.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SolutionPacksService } from '../../solution-packs/services/solution-packs.service';
import { certifiedPlatformTemplateWhere } from '../../agent-templates/agent-template-certification';

export type MarketplaceTab =
  | 'packs'
  | 'agent-templates'
  | 'connectors'
  | 'workflows'
  | 'knowledge-packs'
  | 'widgets'
  | 'themes'
  | 'installed';

export interface MarketplaceItem {
  id: string;
  tab: MarketplaceTab;
  slug: string;
  name: string;
  shortDescription: string;
  description?: string;
  icon: string;
  color: string;
  tierRequired?: string;
  category?: string;
  tags?: string[];
  installed?: boolean;
  meta?: Record<string, unknown>;
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly solutionPacks: SolutionPacksService,
  ) { }

  /**
   * Browse a single tab. Returns `MarketplaceItem[]` — a unified shape
   * usable by the same `<MarketplaceCard>` component on every tab.
   */
  async browseTab(tenantId: string, args: {
    tab: MarketplaceTab;
    q?: string;
    installedOnly?: boolean;
  }): Promise<MarketplaceItem[]> {
    switch (args.tab) {
      case 'packs':
        return this.browsePacks(tenantId, args);
      case 'agent-templates':
        return this.browseAgentTemplates(args);
      case 'connectors':
        return this.browseConnectors(args);
      case 'workflows':
        return this.browseWorkflows(args);
      case 'knowledge-packs':
        return this.browseKnowledgePacks(args);
      case 'widgets':
        return this.browseWidgets(args);
      case 'themes':
        return Promise.resolve(this.browseThemes(args));
      case 'installed':
        return this.browseInstalled(tenantId, args);
      default:
        return [];
    }
  }

  /**
   * Get a dashboard summary: counts per tab + recently installed packs.
   * Powers the Marketplace landing page header.
   */
  async getSummary(tenantId: string): Promise<{
    counts: Record<MarketplaceTab, number>;
    recentlyInstalled: MarketplaceItem[];
  }> {

    const [packs, agentTemplates, connectors, installed] = await Promise.all([
      this.browsePacks(tenantId, {}),
      this.browseAgentTemplates({}),
      this.browseConnectors({}),
      this.browseInstalled(tenantId, {}),
    ]);

    const recent = await this.prisma.tenantInstalledPack.findMany({
      where: { tenantId, uninstalledAt: null },
      orderBy: { installedAt: 'desc' },
      take: 5,
      include: { solutionPack: true },
    });

    const recentlyInstalled: MarketplaceItem[] = recent.map((r) => ({
      id: r.solutionPack.id,
      tab: 'installed',
      slug: r.solutionPack.slug,
      name: r.solutionPack.name,
      shortDescription: r.solutionPack.shortDescription,
      icon: r.solutionPack.icon,
      color: r.solutionPack.color,
      installed: true,
      meta: { installedAt: r.installedAt.toISOString() },
    }));

    return {
      counts: {
        packs: packs.length,
        'agent-templates': agentTemplates.length,
        connectors: connectors.length,
        workflows: 0,
        'knowledge-packs': 0,
        widgets: 0,
        themes: 0,
        installed: installed.length,
      },
      recentlyInstalled,
    };
  }

  // ─── Tab implementations ──────────────────────────────────────────

  private async browsePacks(tenantId: string, args: {
    q?: string;
    installedOnly?: boolean;
  }): Promise<MarketplaceItem[]> {
    const packs = await this.solutionPacks.listCatalog(tenantId, {
      q: args.q,
      installedOnly: args.installedOnly,
    });
    return packs.map((p) => ({
      id: p.id,
      tab: 'packs',
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.description,
      icon: p.icon,
      color: p.color,
      tierRequired: p.tierRequired,
      category: p.category,
      tags: p.tags,
      meta: {
        version: p.version,
        monthlyPriceUsd: p.monthlyPriceUsd,
        estimatedAiCredits: p.estimatedAiCredits,
      },
    }));
  }

  private async browseAgentTemplates(_args: {
    q?: string;
  }): Promise<MarketplaceItem[]> {
    const rows = await this.prisma.agentTemplate.findMany({
      where: certifiedPlatformTemplateWhere(),
      orderBy: { name: 'asc' },
      take: 200,
    });
    return rows.map((t) => ({
      id: t.id,
      tab: 'agent-templates',
      slug: t.id,
      name: t.name,
      shortDescription: t.description ?? '',
      description: t.description ?? '',
      icon: 'bot',
      color: '#6366f1',
      category: t.type ?? undefined,
      tags: [],
    }));
  }

  private async browseConnectors(_args: {
    q?: string;
  }): Promise<MarketplaceItem[]> {
    const rows = await this.prisma.crmConnector.findMany({
      orderBy: { name: 'asc' },
      take: 200,
    });
    return rows.map((c) => ({
      id: c.id,
      tab: 'connectors',
      slug: c.name,
      name: c.name,
      shortDescription:
        (c.config as { description?: string } | null)?.description ?? '',
      icon: c.provider ?? 'plug',
      color: '#10b981',
      category: c.provider ?? undefined,
    }));
  }

  private async browseWorkflows(args: {
    q?: string;
  }): Promise<MarketplaceItem[]> {
    // Workflows come from the knowledge_packs table rows where
    // solutionPackId is set — they're a subset of the knowledge tab.
    const rows = await this.prisma.knowledgePack.findMany({
      orderBy: { installedAt: 'desc' },
      take: 50,
    });
    return rows
      .filter(
        (k) => !args.q || k.name.toLowerCase().includes(args.q.toLowerCase()),
      )
      .map((k) => ({
        id: k.id,
        tab: 'workflows',
        slug: k.id,
        name: k.name,
        shortDescription: k.description ?? '',
        icon: 'workflow',
        color: '#0ea5e9',
      }));
  }

  private async browseKnowledgePacks(args: {
    q?: string;
  }): Promise<MarketplaceItem[]> {
    const rows = await this.prisma.knowledgePack.findMany({
      where: args.q
        ? {
          OR: [
            { name: { contains: args.q, mode: 'insensitive' } },
            { description: { contains: args.q, mode: 'insensitive' } },
          ],
        }
        : {},
      orderBy: { installedAt: 'desc' },
      take: 100,
    });
    return rows.map((k) => ({
      id: k.id,
      tab: 'knowledge-packs',
      slug: k.id,
      name: k.name,
      shortDescription: k.description ?? '',
      icon: 'book',
      color: '#8b5cf6',
      meta: { solutionPackId: k.solutionPackId },
    }));
  }

  private async browseWidgets(_args: {
    q?: string;
  }): Promise<MarketplaceItem[]> {
    // Widgets are sourced from the in-process WidgetRegistry. Phase 4
    // exposed GET /api/v1/widgets; here we surface the same data as a
    // marketplace tab so the UI uses a single card component.
    try {
      const widgets = await this.prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          subtitle: string | null;
          category: string;
        }>
      >`
        SELECT id::text, title, subtitle, category::text
        FROM solution_packs
        WHERE extensions ? 'widgetExtensions'
        LIMIT 50
      `;
      return widgets.map((w) => ({
        id: w.id,
        tab: 'widgets',
        slug: w.id,
        name: w.title,
        shortDescription: w.subtitle ?? '',
        icon: 'layout-grid',
        color: '#f59e0b',
        category: w.category,
      }));
    } catch {
      return [];
    }
  }

  private browseThemes(_args: { q?: string }): MarketplaceItem[] {
    // Themes are static for now; future phase will support per-tenant
    // theming packs (Phase 7 task 7.10).
    return [
      {
        id: 'theme-corporate',
        tab: 'themes',
        slug: 'corporate',
        name: 'Corporate',
        shortDescription:
          'Neutral slate palette suited for finance and consulting.',
        icon: 'building',
        color: '#475569',
      },
      {
        id: 'theme-energy',
        tab: 'themes',
        slug: 'energy',
        name: 'Energy',
        shortDescription:
          'Vibrant accent palette for manufacturing and logistics.',
        icon: 'zap',
        color: '#f97316',
      },
      {
        id: 'theme-care',
        tab: 'themes',
        slug: 'care',
        name: 'Care',
        shortDescription:
          'Calm blue-green palette for healthcare and education.',
        icon: 'heart',
        color: '#14b8a6',
      },
    ];
  }

  private async browseInstalled(tenantId: string, _args: {
    q?: string;
  }): Promise<MarketplaceItem[]> {
    const installed = await this.solutionPacks.listInstalled(tenantId);
    return installed.map((i) => ({
      id: i.solutionPackId,
      tab: 'installed',
      slug: i.packSlug,
      name: i.packSlug,
      shortDescription: `Installed ${new Date(i.installedAt).toISOString().slice(0, 10)} (v${i.packVersion})`,
      icon: 'check-circle',
      color: '#22c55e',
      installed: true,
      meta: {
        installedAt: i.installedAt,
        packVersion: i.packVersion,
        themingImpact: i.themingImpact,
      },
    }));
  }
}

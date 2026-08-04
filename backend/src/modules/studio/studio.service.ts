/**
 * Business Studio — Service.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.13.
 *
 * Owns the App / Page / Process / DataModel / Report / Component /
 * Deployment lifecycle. Single canonical implementation — every
 * "Studio app" NeureCore ships comes from this service.
 *
 * Solid:
 *   • SRP — Business Studio business rules only.
 *   • DIP — depends on PrismaService directly with typed rows.
 *
 * Per v3 P-1 rule §11: every tenant-scoped method refuses wildcard
 * tenant id with ForbiddenException.
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StudioAppStatus,
  StudioComponentOrigin,
  StudioDeploymentKind,
  StudioDeploymentStatus,
  StudioPageKind,
  StudioProcessKind,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Apps ──────────────────────────────────────────────────────────

  createApp(args: {
    tenantId: string;
    slug: string;
    displayName: string;
    description?: string;
    manifest?: Prisma.InputJsonValue;
  }) {
    this.assertRealTenant(args.tenantId);
    this.assertValidSlug(args.slug);
    return this.prisma.studioApp.create({
      data: {
        tenantId: args.tenantId,
        slug: args.slug,
        displayName: args.displayName,
        description: args.description,
        manifest: args.manifest ?? {},
      },
    });
  }

  listApps(tenantId: string) {
    this.assertRealTenant(tenantId);
    return this.prisma.studioApp.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findApp(tenantId: string, id: string) {
    this.assertRealTenant(tenantId);
    const app = await this.prisma.studioApp.findUnique({ where: { id } });
    if (!app) throw new NotFoundException(`app ${id} not found`);
    if (app.tenantId !== tenantId) {
      throw new ForbiddenException('app belongs to a different tenant');
    }
    return app;
  }

  updateAppManifest(args: { tenantId: string; id: string; manifest: Prisma.InputJsonValue }) {
    return this.findApp(args.tenantId, args.id).then(() =>
      this.prisma.studioApp.update({
        where: { id: args.id },
        data: { manifest: args.manifest },
      }),
    );
  }

  publishApp(tenantId: string, id: string) {
    return this.findApp(tenantId, id).then(() =>
      this.prisma.studioApp.update({
        where: { id },
        data: { status: StudioAppStatus.ACTIVE, publishedAt: new Date() },
      }),
    );
  }

  // ─── Pages ────────────────────────────────────────────────────────

  createPage(args: {
    tenantId: string;
    appId: string;
    slug: string;
    displayName: string;
    kind: StudioPageKind;
    layout?: Prisma.InputJsonValue;
    componentIds?: string[];
  }) {
    this.assertRealTenant(args.tenantId);
    return this.findApp(args.tenantId, args.appId).then(() =>
      this.prisma.studioPage.create({
        data: {
          tenantId: args.tenantId,
          appId: args.appId,
          slug: args.slug,
          displayName: args.displayName,
          kind: args.kind,
          layout: args.layout ?? {},
          componentIds: args.componentIds ?? [],
        },
      }),
    );
  }

  listPages(tenantId: string, appId: string) {
    return this.findApp(tenantId, appId).then(() =>
      this.prisma.studioPage.findMany({
        where: { appId },
        orderBy: { displayName: 'asc' },
      }),
    );
  }

  // ─── Processes ──────────────────────────────────────────────────

  createProcess(args: {
    tenantId: string;
    appId: string;
    slug: string;
    displayName: string;
    kind: StudioProcessKind;
    definition?: Prisma.InputJsonValue;
  }) {
    this.assertRealTenant(args.tenantId);
    return this.findApp(args.tenantId, args.appId).then(() =>
      this.prisma.studioProcess.create({
        data: {
          tenantId: args.tenantId,
          appId: args.appId,
          slug: args.slug,
          displayName: args.displayName,
          kind: args.kind,
          definition: args.definition ?? {},
        },
      }),
    );
  }

  // ─── Data models ───────────────────────────────────────────────

  createDataModel(args: {
    tenantId: string;
    appId: string;
    slug: string;
    displayName: string;
    fields?: Prisma.InputJsonValue;
  }) {
    this.assertRealTenant(args.tenantId);
    return this.findApp(args.tenantId, args.appId).then(() =>
      this.prisma.studioDataModel.create({
        data: {
          tenantId: args.tenantId,
          appId: args.appId,
          slug: args.slug,
          displayName: args.displayName,
          fields: args.fields ?? [],
        },
      }),
    );
  }

  // ─── Reports ───────────────────────────────────────────────────

  createReport(args: {
    tenantId: string;
    appId: string;
    slug: string;
    displayName: string;
    layout?: Prisma.InputJsonValue;
  }) {
    this.assertRealTenant(args.tenantId);
    return this.findApp(args.tenantId, args.appId).then(() =>
      this.prisma.studioReport.create({
        data: {
          tenantId: args.tenantId,
          appId: args.appId,
          slug: args.slug,
          displayName: args.displayName,
          layout: args.layout ?? {},
        },
      }),
    );
  }

  // ─── Components (composable library) ────────────────────────────

  createComponent(args: {
    tenantId: string | null;
    slug: string;
    displayName: string;
    description: string;
    origin?: StudioComponentOrigin;
    schema?: Prisma.InputJsonValue;
    previewUrl?: string;
  }) {
    // tenantId can be null for PREDEFINED components.
    this.assertValidSlug(args.slug);
    return this.prisma.studioComponent.create({
      data: {
        tenantId: args.tenantId,
        slug: args.slug,
        displayName: args.displayName,
        description: args.description,
        origin: args.origin ?? StudioComponentOrigin.TENANT,
        schema: args.schema ?? {},
        previewUrl: args.previewUrl,
      },
    });
  }

  listComponents(args: { tenantId?: string; origin?: StudioComponentOrigin }) {
    return this.prisma.studioComponent.findMany({
      where: {
        ...(args.tenantId
          ? { OR: [{ tenantId: args.tenantId }, { tenantId: null }] }
          : {}),
        ...(args.origin ? { origin: args.origin } : {}),
      },
      orderBy: [{ displayName: 'asc' }],
    });
  }

  // ─── Deployments (CD / DevOps) ─────────────────────────────────

  recordDeployment(args: {
    tenantId: string;
    appId: string;
    kind: StudioDeploymentKind;
    version: string;
    notes?: string;
  }): Promise<{ id: string }> {
    this.assertRealTenant(args.tenantId);
    return this.findApp(args.tenantId, args.appId).then(() =>
      this.prisma.studioDeployment.create({
        data: {
          tenantId: args.tenantId,
          appId: args.appId,
          kind: args.kind,
          version: args.version,
          notes: args.notes,
          status: StudioDeploymentStatus.PENDING,
        },
      }),
    );
  }

  async finishDeployment(args: {
    tenantId: string;
    id: string;
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
    errorMessage?: string;
  }) {
    this.assertRealTenant(args.tenantId);
    const existing = await this.prisma.studioDeployment.findUnique({
      where: { id: args.id },
    });
    if (!existing) throw new NotFoundException(`deployment ${args.id} not found`);
    if (existing.tenantId !== args.tenantId) {
      throw new ForbiddenException('deployment belongs to a different tenant');
    }
    return this.prisma.studioDeployment.update({
      where: { id: args.id },
      data: {
        status: args.status,
        finishedAt: new Date(),
        errorMessage: args.errorMessage,
      },
    });
  }

  listDeployments(tenantId: string, appId?: string) {
    this.assertRealTenant(tenantId);
    return this.prisma.studioDeployment.findMany({
      where: {
        tenantId,
        ...(appId ? { appId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private assertRealTenant(tenantId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
  }

  private assertValidSlug(slug: string) {
    if (!SLUG_REGEX.test(slug)) {
      throw new ConflictException(
        'slug must be 1-64 chars: lowercase alphanumeric with optional - or _',
      );
    }
  }
}

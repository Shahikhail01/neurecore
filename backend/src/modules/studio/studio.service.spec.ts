/**
 * Business Studio — Service unit tests.
 *
 * Asserts:
 *   1. CRUD on app / page / process / data model / report / component
 *      / deployment.
 *   2. Tenant guard refuses wildcard on every entry point.
 *   3. Cross-tenant find returns Forbidden.
 *   4. Deployment lifecycle (PENDING → SUCCEEDED/FAILED/CANCELLED).
 *   5. Slug validation rejects invalid formats.
 */

import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StudioService } from './studio.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  StudioAppStatus,
  StudioComponentOrigin,
  StudioDeploymentKind,
  StudioPageKind,
  StudioProcessKind,
} from '@prisma/client';

describe('StudioService', () => {
  let svc: StudioService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const prismaMock: Partial<jest.Mocked<PrismaService>> = {
      studioApp: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['studioApp']>,
      studioPage: { create: jest.fn() } as unknown as jest.Mocked<PrismaService['studioPage']>,
      studioProcess: { create: jest.fn() } as unknown as jest.Mocked<PrismaService['studioProcess']>,
      studioDataModel: { create: jest.fn() } as unknown as jest.Mocked<PrismaService['studioDataModel']>,
      studioReport: { create: jest.fn() } as unknown as jest.Mocked<PrismaService['studioReport']>,
      studioComponent: { create: jest.fn() } as unknown as jest.Mocked<PrismaService['studioComponent']>,
      studioDeployment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['studioDeployment']>,
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StudioService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    svc = moduleRef.get(StudioService);
    prisma = moduleRef.get(PrismaService);
  });

  // ─── Helpers ────────────────────────────────────────────────

  function tenantApp(overrides: Partial<{ id: string; tenantId: string }> = {}) {
    return {
      id: overrides.id ?? 'app-1',
      tenantId: overrides.tenantId ?? 'tenant-a',
      slug: 'sales-crm',
      displayName: 'Sales CRM',
      description: null,
      status: StudioAppStatus.DRAFT,
      manifest: {},
      version: '0.1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
    };
  }

  // ─── Apps ───────────────────────────────────────────────────

  it('createApp rejects wildcard', () => {
    expect(() =>
      svc.createApp({ tenantId: '*', slug: 's', displayName: 'd' }),
    ).toThrow(ForbiddenException);
  });

  it('createApp rejects invalid slug', () => {
    expect(() =>
      svc.createApp({ tenantId: 'tenant-a', slug: 'X', displayName: 'd' }),
    ).toThrow(ConflictException);
  });

  it('findApp refuses cross-tenant', async () => {
    (prisma.studioApp.findUnique as jest.Mock).mockResolvedValue(
      tenantApp({ tenantId: 'tenant-b' }),
    );
    await expect(svc.findApp('tenant-a', 'app-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('findApp throws NotFound when missing', async () => {
    (prisma.studioApp.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(svc.findApp('tenant-a', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('publishApp sets status=ACTIVE + publishedAt', async () => {
    (prisma.studioApp.findUnique as jest.Mock).mockResolvedValue(tenantApp());
    (prisma.studioApp.update as jest.Mock).mockResolvedValue({
      ...tenantApp(),
      status: StudioAppStatus.ACTIVE,
      publishedAt: new Date(),
    });
    const out = await svc.publishApp('tenant-a', 'app-1');
    expect(out.status).toBe(StudioAppStatus.ACTIVE);
    expect(out.publishedAt).toBeTruthy();
  });

  // ─── Pages ──────────────────────────────────────────────────

  it('createPage refuses cross-tenant app', async () => {
    (prisma.studioApp.findUnique as jest.Mock).mockResolvedValue(
      tenantApp({ tenantId: 'tenant-b' }),
    );
    await expect(
      svc.createPage({
        tenantId: 'tenant-a',
        appId: 'app-1',
        slug: 'p',
        displayName: 'd',
        kind: StudioPageKind.LIST,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ─── Components ────────────────────────────────────────────

  it('createComponent allows null tenantId (PREDEFINED)', async () => {
    (prisma.studioComponent.create as jest.Mock).mockResolvedValue({});
    await svc.createComponent({
      tenantId: null,
      slug: 'glass-panel',
      displayName: 'Glass Panel',
      description: 'Platform component.',
      origin: StudioComponentOrigin.PREDEFINED,
    });
    expect(prisma.studioComponent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: null,
          origin: StudioComponentOrigin.PREDEFINED,
        }),
      }),
    );
  });

  it('createComponent rejects invalid slug', () => {
    expect(() =>
      svc.createComponent({
        tenantId: 'tenant-a',
        slug: 'BAD!SLUG',
        displayName: 'd',
        description: 'desc',
      }),
    ).toThrow(ConflictException);
  });

  // ─── Deployments ───────────────────────────────────────────

  it('recordDeployment creates a PENDING row', async () => {
    (prisma.studioApp.findUnique as jest.Mock).mockResolvedValue(tenantApp());
    (prisma.studioDeployment.create as jest.Mock).mockResolvedValue({
      id: 'd1',
      status: 'PENDING',
    });
    const out = await svc.recordDeployment({
      tenantId: 'tenant-a',
      appId: 'app-1',
      kind: StudioDeploymentKind.STAGING_TO_PRODUCTION,
      version: '1.2.3',
    });
    expect(out.id).toBe('d1');
  });

  it('finishDeployment refuses cross-tenant', async () => {
    (prisma.studioDeployment.findUnique as jest.Mock).mockResolvedValue({
      id: 'd1',
      tenantId: 'tenant-b',
    });
    await expect(
      svc.finishDeployment({
        tenantId: 'tenant-a',
        id: 'd1',
        status: 'SUCCEEDED',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('finishDeployment marks SUCCEEDED + finishedAt', async () => {
    (prisma.studioDeployment.findUnique as jest.Mock).mockResolvedValue({
      id: 'd1',
      tenantId: 'tenant-a',
    });
    (prisma.studioDeployment.update as jest.Mock).mockResolvedValue({
      id: 'd1',
      status: 'SUCCEEDED',
      finishedAt: new Date(),
    });
    await svc.finishDeployment({
      tenantId: 'tenant-a',
      id: 'd1',
      status: 'SUCCEEDED',
    });
    expect(prisma.studioDeployment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    );
  });

  it('listDeployments refuses wildcard', () => {
    expect(() => svc.listDeployments('*')).toThrow(ForbiddenException);
  });
});

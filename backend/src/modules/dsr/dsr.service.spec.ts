/**
 * DSR — state machine + tenant isolation + audit tests.
 *
 * Asserts:
 *   1. Open request rejects wildcard tenantId.
 *   2. State transitions follow the FSM.
 *   3. Invalid transitions throw BadRequest.
 *   4. Cross-tenant find returns Forbidden.
 *   5. Audit log records every transition.
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DsrRequestStatus, DsrRequestType } from '@prisma/client';
import { DsrService } from './dsr.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';

describe('DsrService', () => {
  let svc: DsrService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const prismaMock: Partial<jest.Mocked<PrismaService>> = {
      dsrRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['dsrRequest']>,
      dsrAuditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['dsrAuditLog']>,
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DsrService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    svc = moduleRef.get(DsrService);
    prisma = moduleRef.get(PrismaService);
  });

  it('refuses wildcard tenant on openRequest', async () => {
    await expect(
      svc.openRequest({
        tenantId: '*',
        type: DsrRequestType.EXPORT,
        subjectId: 'u1',
        requesterId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('opens a request and writes the audit row', async () => {
    (prisma.dsrRequest.create as jest.Mock).mockResolvedValue({
      id: 'd1',
      tenantId: 'tenant-a',
      type: DsrRequestType.EXPORT,
      status: DsrRequestStatus.OPEN,
      subjectId: 'u1',
      subjectKind: 'user',
      requesterId: 'u1',
      reason: 'subject requested',
      resolution: {},
      openedAt: new Date(),
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
    });
    (prisma.dsrAuditLog.create as jest.Mock).mockResolvedValue({});

    const r = await svc.openRequest({
      tenantId: 'tenant-a',
      type: DsrRequestType.EXPORT,
      subjectId: 'u1',
      requesterId: 'u1',
      reason: 'subject requested',
    });
    expect(r.status).toBe(DsrRequestStatus.OPEN);
    expect(prisma.dsrAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('transitions OPEN → IN_PROGRESS → COMPLETED with audit', async () => {
    const openRow = {
      id: 'd1',
      tenantId: 'tenant-a',
      type: DsrRequestType.EXPORT,
      status: DsrRequestStatus.OPEN,
      subjectId: 'u1',
      subjectKind: 'user',
      requesterId: 'u1',
      reason: null,
      resolution: {},
      openedAt: new Date(),
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
    };
    const inProgressRow = { ...openRow, status: DsrRequestStatus.IN_PROGRESS, startedAt: new Date() };
    (prisma.dsrRequest.findUnique as jest.Mock)
      .mockResolvedValueOnce(openRow)
      .mockResolvedValueOnce(inProgressRow);
    (prisma.dsrRequest.update as jest.Mock)
      .mockResolvedValueOnce(inProgressRow)
      .mockResolvedValueOnce({
        ...inProgressRow,
        status: DsrRequestStatus.COMPLETED,
        completedAt: new Date(),
        resolution: { exportUrl: 'https://x' },
      });
    (prisma.dsrAuditLog.create as jest.Mock).mockResolvedValue({});

    await svc.startRequest('tenant-a', 'd1', 'admin-1');
    await svc.completeRequest('tenant-a', 'd1', 'admin-1', {
      exportUrl: 'https://x',
    });
    // 2 transitions = 2 audit rows (STARTED + COMPLETED). OPEN row is
    // written by openRequest, which this test does not call.
    expect(prisma.dsrAuditLog.create).toHaveBeenCalledTimes(2);
  });

  it('refuses invalid transition COMPLETED → IN_PROGRESS', async () => {
    (prisma.dsrRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'd1',
      tenantId: 'tenant-a',
      status: DsrRequestStatus.COMPLETED,
      type: DsrRequestType.DELETE,
      subjectId: 'u1',
      subjectKind: 'user',
      requesterId: 'u1',
      reason: null,
      resolution: {},
      openedAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      cancelledAt: null,
    });
    await expect(
      svc.startRequest('tenant-a', 'd1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses cross-tenant access', async () => {
    (prisma.dsrRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'd1',
      tenantId: 'tenant-b',
      status: DsrRequestStatus.OPEN,
      type: DsrRequestType.EXPORT,
      subjectId: 'u1',
      subjectKind: 'user',
      requesterId: 'u1',
      reason: null,
      resolution: {},
      openedAt: new Date(),
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
    });
    await expect(svc.findById('tenant-a', 'd1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws NotFound for missing request', async () => {
    (prisma.dsrRequest.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(svc.findById('tenant-a', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

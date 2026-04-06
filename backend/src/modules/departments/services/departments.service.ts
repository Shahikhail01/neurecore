import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DepartmentStatus } from '@prisma/client';

export interface CreateDeptInput {
  name: string;
  description?: string;
  status?: DepartmentStatus;
  headAgentId?: string;
  parentId?: string;
  tenantId: string;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      include: {
        children: true,
        parent: { select: { id: true, name: true } },
        agents: { select: { id: true, name: true, status: true, type: true } },
        _count: { select: { agents: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        children: true,
        parent: { select: { id: true, name: true } },
        agents: { select: { id: true, name: true, status: true, type: true } },
        _count: { select: { agents: true } },
      },
    });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async create(input: CreateDeptInput) {
    return this.prisma.department.create({
      data: {
        name: input.name,
        description: input.description,
        status: input.status ?? 'ACTIVE',
        headAgentId: input.headAgentId,
        parentId: input.parentId,
        tenantId: input.tenantId,
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<Omit<CreateDeptInput, 'tenantId'>>,
  ) {
    await this.findOne(id, tenantId);
    return this.prisma.department.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.department.delete({ where: { id } });
  }
}

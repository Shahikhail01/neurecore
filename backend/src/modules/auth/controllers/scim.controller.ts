import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { JwtPayload } from '../interfaces/token.interface';

interface ScimUser {
  userName: string;
  displayName?: string;
  emails?: { value: string; primary?: boolean }[];
  active?: boolean;
}

interface ScimGroup {
  displayName: string;
  members?: { value: string; display?: string }[];
}

interface ScimPatchOp {
  op: 'add' | 'remove' | 'replace';
  path?: string;
  value?: unknown;
}

@UseGuards(JwtAuthGuard)
@Controller('scim/v2')
export class ScimController {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Users ───────────────────────────────────────────────────────────────

  @Get('Users')
  async listUsers(@CurrentUser() user: JwtPayload) {
    const users = await this.prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: users.length,
      Resources: users.map((u) => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: u.id,
        userName: u.email,
        displayName: `${u.firstName} ${u.lastName}`.trim(),
        emails: [{ value: u.email, primary: true }],
        active: true,
        meta: { resourceType: 'User' },
      })),
    };
  }

  @Post('Users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@CurrentUser() user: JwtPayload, @Body() body: ScimUser) {
    const email = body.emails?.[0]?.value ?? body.userName;
    const [firstPart, ...rest] = (body.displayName ?? body.userName).split(' ');
    const created = await this.prisma.user.create({
      data: {
        email,
        firstName: firstPart ?? body.userName,
        lastName: rest.join(' ') || '_',
        tenantId: user.tenantId,
        passwordHash: '__scim_provisioned__',
      },
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: created.id,
      userName: created.email,
      displayName: `${created.firstName} ${created.lastName}`.trim(),
      emails: [{ value: created.email, primary: true }],
      active: true,
      meta: { resourceType: 'User', created: created.createdAt },
    };
  }

  @Get('Users/:id')
  async getUser(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const u = await this.prisma.user.findFirstOrThrow({
      where: { id, tenantId: user.tenantId },
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: u.id,
      userName: u.email,
      displayName: `${u.firstName} ${u.lastName}`.trim(),
      emails: [{ value: u.email, primary: true }],
      active: u.isActive,
      meta: { resourceType: 'User' },
    };
  }

  /** PUT /scim/v2/Users/:id — full replace */
  @Put('Users/:id')
  async replaceUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: ScimUser,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    const [firstPart, ...rest] = (body.displayName ?? body.userName).split(' ');
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: body.emails?.[0]?.value ?? body.userName,
        firstName: firstPart ?? body.userName,
        lastName: rest.join(' ') || existing.lastName,
        isActive: body.active ?? existing.isActive,
      },
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: updated.id,
      userName: updated.email,
      displayName: `${updated.firstName} ${updated.lastName}`.trim(),
      emails: [{ value: updated.email, primary: true }],
      active: updated.isActive,
      meta: { resourceType: 'User' },
    };
  }

  /** PATCH /scim/v2/Users/:id — partial update / deactivate */
  @Patch('Users/:id')
  async patchUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { schemas: string[]; Operations: ScimPatchOp[] },
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    const data: Record<string, unknown> = {};
    for (const op of body.Operations ?? []) {
      if (op.path === 'active' || op.path === 'Active') {
        data['isActive'] = Boolean(op.value);
      } else if (op.path === 'displayName') {
        const [f, ...r] = String(op.value ?? '').split(' ');
        data['firstName'] = f;
        if (r.length) data['lastName'] = r.join(' ');
      }
    }

    const updated = await this.prisma.user.update({ where: { id }, data });
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: updated.id,
      userName: updated.email,
      displayName: `${updated.firstName} ${updated.lastName}`.trim(),
      emails: [{ value: updated.email, primary: true }],
      active: updated.isActive,
      meta: { resourceType: 'User' },
    };
  }

  /** DELETE /scim/v2/Users/:id — deprovision (deactivate; soft delete) */
  @Delete('Users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  // ─── Groups (Departments) ─────────────────────────────────────────────────

  @Get('Groups')
  async listGroups(@CurrentUser() user: JwtPayload) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId: user.tenantId! },
    });

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: departments.length,
      Resources: departments.map((d) => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: d.id,
        displayName: d.name,
        members: [],
        meta: { resourceType: 'Group' },
      })),
    };
  }

  @Post('Groups')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(@CurrentUser() user: JwtPayload, @Body() body: ScimGroup) {
    const dept = await this.prisma.department.create({
      data: {
        name: body.displayName,
        tenantId: user.tenantId!,
      },
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: dept.id,
      displayName: dept.name,
      members: [],
      meta: { resourceType: 'Group', created: dept.createdAt },
    };
  }

  /** PATCH /scim/v2/Groups/:id — update group (rename / update members) */
  @Patch('Groups/:id')
  async patchGroup(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { schemas: string[]; Operations: ScimPatchOp[] },
  ) {
    const existing = await this.prisma.department.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!existing) throw new NotFoundException(`Group ${id} not found`);

    const data: Record<string, unknown> = {};
    for (const op of body.Operations ?? []) {
      if (op.path === 'displayName') {
        data['name'] = String(op.value ?? '');
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data,
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: updated.id,
      displayName: updated.name,
      members: [],
      meta: { resourceType: 'Group' },
    };
  }

  /** DELETE /scim/v2/Groups/:id — archive department */
  @Delete('Groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGroup(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const existing = await this.prisma.department.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!existing) throw new NotFoundException(`Group ${id} not found`);
    await this.prisma.department.update({
      where: { id },
      data: { status: 'INACTIVE' as any },
    });
  }
}

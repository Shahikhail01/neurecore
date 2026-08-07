/**
 * Deal — Controller.
 *
 * Mounted at `/api/v1/deals`. Tenant scope from JWT, never trusted
 * from request body. All mutating endpoints flow through DealsService.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DealStage } from '@prisma/client';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateDealDto } from './dto/create-deal.dto';
import { ListDealsDto } from './dto/list-deals.dto';
import { TransitionDealDto } from './dto/transition-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { AuthedActor, DealsService } from './deals.service';
import type { Request } from 'express';

interface AuthedRequest extends Request {
  user: {
    sub: string;
    tenantId: string;
    role: UserRole;
  };
}

function actorFromReq(req: AuthedRequest): AuthedActor {
  const u = req.user;
  if (!u || !u.tenantId) {
    throw new NotFoundException('tenant context required');
  }
  return { sub: u.sub, tenantId: u.tenantId, role: u.role };
}

@Controller({ path: 'deals', version: '1' })
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
  async list(@Req() req: AuthedRequest, @Query() query: ListDealsDto) {
    const actor = actorFromReq(req);
    return this.deals.list(
      actor,
      {
        stage: query.stage as DealStage | undefined,
        ownerUserId: query.ownerUserId,
        customerId: query.customerId,
        q: query.q,
        includeDeleted: !!query.includeDeleted && actor.role === UserRole.PLATFORM_ADMIN,
      },
      query.page,
      query.limit,
      query.sort ?? 'updatedAt',
      query.sortDir ?? 'desc',
    );
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
  async get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.deals.get(actorFromReq(req), id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: AuthedRequest, @Body() body: CreateDealDto) {
    const actor = actorFromReq(req);
    return this.deals.create(actor, {
      tenantId: actor.tenantId, // server-trusted, never from body
      customerId: body.customerId,
      contactId: body.contactId,
      projectId: body.projectId,
      ownerUserId: body.ownerUserId ?? actor.sub,
      name: body.name,
      stage: body.stage as DealStage | undefined,
      source: body.source,
      amount: body.amount,
      currency: body.currency,
      probability: body.probability,
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
      aiScore: body.aiScore,
      notes: body.notes,
    });
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: UpdateDealDto,
  ) {
    const actor = actorFromReq(req);
    return this.deals.update(actor, id, {
      customerId: body.customerId,
      contactId: body.contactId,
      projectId: body.projectId,
      ownerUserId: body.ownerUserId,
      name: body.name,
      stage: body.stage as DealStage | undefined,
      amount: body.amount,
      currency: body.currency,
      probability: body.probability,
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
      aiScore: body.aiScore,
      notes: body.notes,
    });
  }

  @Post(':id/transitions')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async transition(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: TransitionDealDto,
  ) {
    return this.deals.transitionTo(
      actorFromReq(req),
      id,
      body.toStage,
      body.reason,
    );
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.deals.softDelete(actorFromReq(req), id);
  }
}

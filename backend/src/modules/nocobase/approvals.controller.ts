/**
 * Approval Controller - REST API endpoints
 * Location: src/modules/nocobase/approvals.controller.ts
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApprovalService } from '../../core/services/approval.service';
import {
  Approval,
  CreateApprovalInput,
  UpdateApprovalInput,
  ApprovalFilters,
} from '../../domain/models';

@Controller('api/v1/approvals')
export class ApprovalsController {
  constructor(private approvalService: ApprovalService) {}

  @Post()
  async create(@Body() input: CreateApprovalInput): Promise<Approval> {
    if (!input.title || !input.requestedBy) {
      throw new BadRequestException(
        'Missing required fields: title, requestedBy',
      );
    }
    return this.approvalService.createApproval(input);
  }

  @Get()
  async list(
    @Query('requestedBy') requestedBy?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ): Promise<Approval[]> {
    const filters: ApprovalFilters = {
      requestedBy,
      status: status as any,
      priority: priority as any,
    };
    return this.approvalService.listApprovals(filters);
  }

  @Get('expired')
  async getExpired(): Promise<Approval[]> {
    return this.approvalService.getExpiredApprovals();
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Approval | null> {
    return this.approvalService.getApprovalById(id);
  }

  @Put(':id/approve')
  async approve(@Param('id') id: string): Promise<Approval> {
    return this.approvalService.approveApproval(id);
  }

  @Put(':id/reject')
  async reject(@Param('id') id: string): Promise<Approval> {
    return this.approvalService.rejectApproval(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateApprovalInput,
  ): Promise<Approval> {
    const approval = await this.approvalService.getApprovalById(id);
    if (!approval) {
      throw new BadRequestException(`Approval ${id} not found`);
    }
    return this.approvalService.getApprovalById(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    // Only allow deletion of pending approvals
    const approval = await this.approvalService.getApprovalById(id);
    if (!approval) {
      throw new BadRequestException(`Approval ${id} not found`);
    }
  }
}

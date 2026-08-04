/**
 * src/modules/approvals/controllers/approvals.controller.ts
 *
 * REST endpoints for approval processing
 * SOLID:
 * - SRP: Only routing and parameter handling
 * - DIP: Depends on ApprovalsService abstraction
 */

import {
    Controller,
    Post,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApprovalsService } from '../services/approvals.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import type {
    ApprovalFeedback,
} from '../../../shared/types/approvals.types';

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller({ path: 'approvals', version: '1' })
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
    constructor(private readonly approvalsService: ApprovalsService) { }

    // REMOVED @Get('stratified') — collides with governance.controller.ts
    // ApprovalsController @ GET /approvals/stratified.
    // Phase 0.5 collision-resolution: governance's enrichment-backed
    // implementation is the canonical owner; this controller now exposes
    // only the unique endpoints (feedback, approve, reject). Consumers
    // should call GET /api/v1/approvals/stratified on the governance route.
    // See neurecore/memory-bank-arc/comms/route-duplication-report.yaml.

    @Post('feedback')
    @ApiOperation({
        summary: 'Submit approval feedback',
        description:
            'Records user feedback when their decision differs from AI recommendation. Used for model learning.',
    })
    @ApiResponse({
        status: 201,
        description: 'Feedback successfully submitted',
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 403, description: 'Unauthorized' })
    async submitFeedback(
        @CurrentUser() user: JwtPayload,
        @Body() feedback: ApprovalFeedback
    ): Promise<{ success: boolean; message: string }> {
        await this.approvalsService.submitFeedback(user.tenantId!, feedback);
        return {
            success: true,
            message: 'Feedback submitted successfully',
        };
    }

    @Post(':approvalId/approve')
    @ApiOperation({
        summary: 'Approve a request',
        description: 'Marks an approval request as approved.',
    })
    @ApiResponse({
        status: 200,
        description: 'Request successfully approved',
    })
    @ApiResponse({ status: 404, description: 'Request not found' })
    async approve(
        @CurrentUser() user: JwtPayload,
        @Param('approvalId') approvalId: string
    ): Promise<{ success: boolean; message: string }> {
        await this.approvalsService.approveRequest(user.tenantId!, approvalId);
        return {
            success: true,
            message: 'Request approved successfully',
        };
    }

    @Post(':approvalId/reject')
    @ApiOperation({
        summary: 'Reject a request',
        description: 'Marks an approval request as rejected.',
    })
    @ApiResponse({
        status: 200,
        description: 'Request successfully rejected',
    })
    @ApiResponse({ status: 404, description: 'Request not found' })
    async reject(
        @CurrentUser() user: JwtPayload,
        @Param('approvalId') approvalId: string
    ): Promise<{ success: boolean; message: string }> {
        await this.approvalsService.rejectRequest(user.tenantId!, approvalId);
        return {
            success: true,
            message: 'Request rejected successfully',
        };
    }
}

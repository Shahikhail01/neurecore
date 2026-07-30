/**
 * HermesAdapterController — exposes the 5 execution endpoints to NeureCore.
 *
 * Plan ref: NC-AWL-IMP-2 §1.3
 *
 * The controller is the **only** HTTP surface that talks to the sidecar.
 * It enforces:
 *   - JWT auth (NeureCore's existing JwtAuthGuard)
 *   - Tenant scoping (req.user.tenantId must match the request)
 *   - The user must have at least one of the required roles (OWNER, ADMIN)
 *
 * The service layer (`hermes-adapter.service.ts`) handles the actual
 * proxying and token minting.
 *
 * **Routes (Phase 1.3, gated on feature flag):**
 *   POST /api/v1/hermes-adapter/executions
 *   POST /api/v1/hermes-adapter/executions/:id/approvals/:approvalId
 *   POST /api/v1/hermes-adapter/executions/:id/cancel
 *   POST /api/v1/hermes-adapter/executions/:id/resume
 *   GET  /api/v1/hermes-adapter/executions/:id
 *
 * **Phase 1.3 intentionally bypasses the feature flag** because the
 * entire point is to give callers a way to test the integration. The
 * flag is enforced by the chat path (Phase 1.4) when it routes intents
 * through this controller.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  HermesAdapterService,
  StartExecutionInput,
  ApprovalDecisionInput,
  SidecarExecutionState,
} from '../services/hermes-adapter.service';
import { ApprovalsService } from '../../approvals/services/approvals.service';

interface AuthedRequest {
  user: {
    sub: string;
    tenantId: string;
    roles?: string[];
  };
}

interface StartExecutionBody {
  executionId: string;
  projectId?: string;
  workspacePath?: string;
  allowedTools?: string[];
  initialMessage: string;
  approvalThreshold?: 'NONE' | 'STANDARD' | 'HIGH';
}

interface ApprovalBody {
  decision: 'approve' | 'reject';
  reason?: string;
}

@Controller({ path: 'hermes-adapter', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class HermesAdapterController {
  constructor(
    private readonly adapter: HermesAdapterService,
    private readonly approvals: ApprovalsService,
  ) {}

  /**
   * Start a new execution. The executionId is typically the chat
   * conversationId + a suffix, so it can be reconstructed from the chat
   * thread.
   */
  @Get('executions/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  async status(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<SidecarExecutionState> {
    return this.adapter.getExecutionStatus(id, req.user.tenantId, req.user.sub);
  }

  @Post('executions')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(201)
  async start(
    @Req() req: AuthedRequest,
    @Body() body: StartExecutionBody,
  ): Promise<SidecarExecutionState> {
    const input: StartExecutionInput = {
      executionId: body.executionId,
      tenantId: req.user.tenantId,
      userId: req.user.sub,
      projectId: body.projectId,
      workspacePath:
        body.workspacePath ??
        `/var/lib/neurecore/hermes/tenants/${req.user.tenantId}/`,
      allowedTools: body.allowedTools ?? [],
      initialMessage: body.initialMessage,
      approvalThreshold: body.approvalThreshold,
    };
    return this.adapter.startExecution(input);
  }

  @Post('executions/:id/cancel')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  async cancel(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<SidecarExecutionState> {
    return this.adapter.cancelExecution(id, req.user.tenantId, req.user.sub);
  }

  @Post('executions/:id/resume')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  async resume(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<SidecarExecutionState> {
    return this.adapter.resumeExecution(id, req.user.tenantId, req.user.sub);
  }

  @Post('executions/:id/approvals/:approvalId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  async submitApproval(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('approvalId') approvalId: string,
    @Body() body: ApprovalBody,
  ): Promise<SidecarExecutionState> {
    const approval = await this.approvals.findOne(approvalId, req.user.tenantId);
    if (!approval || approval.resourceId !== id) {
      throw new NotFoundException('Execution approval not found');
    }
    if (body.decision === 'approve') {
      await this.approvals.approveRequest(req.user.tenantId, approvalId, req.user.sub);
    } else {
      await this.approvals.rejectRequest(req.user.tenantId, approvalId, req.user.sub, body.reason);
    }
    const input: ApprovalDecisionInput = {
      executionId: id,
      tenantId: req.user.tenantId,
      userId: req.user.sub,
      approvalId,
      decision: body.decision,
      reason: body.reason,
    };
    return this.adapter.submitApprovalDecision(input);
  }
}

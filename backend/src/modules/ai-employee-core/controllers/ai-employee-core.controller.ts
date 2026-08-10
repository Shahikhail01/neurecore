import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AI_EMPLOYEE_CORE } from '../ai-employee-core.tokens';
import type { IAIEmployeeCore } from '../contracts/ai-employee-core.interface';
import {
  CancelEmployeeRunDto,
  ListEmployeeRunsQueryDto,
  StartEmployeeRunDto,
} from './ai-employee-core.dto';

interface EmployeeRunRequest {
  user?: { tenantId?: string; sub?: string; id?: string };
}

@Controller({ path: 'ai-employees/runs', version: '1' })
@UseGuards(JwtAuthGuard)
export class AIEmployeeCoreController {
  constructor(
    @Inject(AI_EMPLOYEE_CORE) private readonly core: IAIEmployeeCore,
  ) {}

  @Post()
  start(@Req() req: EmployeeRunRequest, @Body() body: StartEmployeeRunDto) {
    const { tenantId, actorId } = this.context(req);
    return this.core.start({
      tenantId,
      employeeId: body.employeeId,
      requestedBy: { actorId, actorType: 'HUMAN' },
      objective: body.objective,
      context: body.context,
      trigger: body.trigger,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Get(':id')
  async get(@Req() req: EmployeeRunRequest, @Param('id') id: string) {
    const { tenantId } = this.context(req);
    const run = await this.core.get(tenantId, id);
    if (!run) throw new NotFoundException('Employee run not found');
    return run;
  }

  @Get()
  list(
    @Req() req: EmployeeRunRequest,
    @Query() query: ListEmployeeRunsQueryDto,
  ) {
    return this.core.list(this.context(req).tenantId, query);
  }

  @Post(':id/resume')
  resume(@Req() req: EmployeeRunRequest, @Param('id') id: string) {
    return this.core.resume(this.context(req).tenantId, id);
  }

  @Post(':id/cancel')
  cancel(
    @Req() req: EmployeeRunRequest,
    @Param('id') id: string,
    @Body() body: CancelEmployeeRunDto,
  ) {
    return this.core.cancel(this.context(req).tenantId, id, body.reason);
  }

  private context(req: EmployeeRunRequest): {
    tenantId: string;
    actorId: string;
  } {
    const tenantId = req.user?.tenantId;
    const actorId = req.user?.sub ?? req.user?.id;
    if (!tenantId || !actorId) {
      throw new ForbiddenException(
        'tenant and authenticated actor are required',
      );
    }
    return { tenantId, actorId };
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../../modules/auth/interfaces/token.interface';
import { RevokeSchema } from './contracts';
import type {
  CreateHarnessChange,
  CreateHarnessReplay,
  CreateHarnessRun,
  CreateHarnessWaiver,
} from './contracts';
import { HarnessControlService } from './harness-control.service';

@Controller({ path: 'harness-control', version: '1' })
@ApiCommon('harness-control')
@Roles(UserRole.SUPER_ADMIN)
export class HarnessControlController {
  constructor(private readonly service: HarnessControlService) {}

  @Get('dashboard') dashboard() {
    return this.service.dashboard();
  }

  @Get('runs') runs() {
    return this.service.listRuns();
  }

  @Post('runs') requestRun(
    @CurrentUser() actor: JwtPayload,
    @Body() body: CreateHarnessRun,
  ) {
    return this.service.requestRun(actor, body);
  }

  @Post('runs/:id/approve') approveRun(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.approveRun(actor, id);
  }

  @Post('runs/:id/cancel') cancelRun(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.cancelRun(actor, id);
  }

  @Get('evidence/:id') evidence(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.getEvidence(actor, id);
  }

  @Get('changes') changes(@Query('kind') kind?: string) {
    return this.service.listChanges(kind);
  }

  @Post('changes') createChange(
    @CurrentUser() actor: JwtPayload,
    @Body() body: CreateHarnessChange,
  ) {
    return this.service.createChange(actor, body);
  }

  @Post('changes/:id/approve') approveChange(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.approveChange(actor, id);
  }

  @Get('waivers') waivers() {
    return this.service.listWaivers();
  }

  @Post('waivers') createWaiver(
    @CurrentUser() actor: JwtPayload,
    @Body() body: CreateHarnessWaiver,
  ) {
    return this.service.createWaiver(actor, body);
  }

  @Post('waivers/:id/approve') approveWaiver(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.approveWaiver(actor, id);
  }

  @Post('waivers/:id/revoke') revokeWaiver(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = RevokeSchema.parse(body);
    return this.service.revokeWaiver(actor, id, parsed.reason);
  }

  @Get('certificates') certificates() {
    return this.service.listCertificates();
  }

  @Post('certificates/:id/revoke') revokeCertificate(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = RevokeSchema.parse(body);
    return this.service.revokeCertificate(actor, id, parsed.reason);
  }

  @Get('audit') audit() {
    return this.service.listAudit();
  }

  @Get('audit/verify') verifyAudit() {
    return this.service.verifyAuditChain();
  }

  @Get('replay') replay() {
    return this.service.listReplayBundles();
  }

  @Post('replay') createReplay(
    @CurrentUser() actor: JwtPayload,
    @Body() body: CreateHarnessReplay,
  ) {
    return this.service.createReplayBundle(actor, body);
  }

  @Post('replay/:bundleId/execute') executeReplay(
    @CurrentUser() actor: JwtPayload,
    @Param('bundleId') bundleId: string,
  ) {
    return this.service.executeReplay(actor, bundleId);
  }
}

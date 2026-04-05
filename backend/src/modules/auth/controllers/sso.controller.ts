import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreateSsoConfigDto } from '../dto/sso.dto';
import { SsoConfigService } from '../services/sso-config.service';
import type { JwtPayload } from '../interfaces/token.interface';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'auth/sso', version: '1' })
export class SsoController {
  constructor(private readonly ssoConfigService: SsoConfigService) {}

  @Get('config')
  getConfig(@CurrentUser() user: JwtPayload) {
    return this.ssoConfigService.getConfig(user.tenantId!);
  }

  @Post('config')
  upsertConfig(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSsoConfigDto,
  ) {
    return this.ssoConfigService.upsertConfig(user.tenantId!, dto);
  }

  @Post('config/enable')
  enable(@CurrentUser() user: JwtPayload) {
    return this.ssoConfigService.toggleEnabled(user.tenantId!, true);
  }

  @Post('config/disable')
  disable(@CurrentUser() user: JwtPayload) {
    return this.ssoConfigService.toggleEnabled(user.tenantId!, false);
  }

  /** SAML SP metadata — returns XML */
  @Get('metadata')
  @Header('Content-Type', 'application/xml')
  getMetadata(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const xml = this.ssoConfigService.getSamlMetadataXml(user.tenantId!);
    res.send(xml);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SettingsService } from './settings.service';

// AI Provider DTOs
class CreateAIProviderDto {
  provider: string;
  name: string;
  apiKey: string;
  apiEndpoint?: string;
}

class UpdateAIProviderDto {
  name?: string;
  apiKey?: string;
  apiEndpoint?: string;
  isEnabled?: boolean;
}

class ToggleProviderDto {
  enabled: boolean;
}

// Tier DTOs
class CreateTierDto {
  name: string;
  slug: string;
  description: string;
}

class UpdateTierDto {
  name?: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
}

class ToggleTierDto {
  isActive: boolean;
}

class ReorderTiersDto {
  orderedIds: string[];
}

// Email Config DTOs
class CreateEmailConfigDto {
  provider: string;
  settings: {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpSecure?: boolean;
    apiKey?: string;
    fromEmail: string;
    fromName: string;
    replyToEmail?: string;
  };
}

class UpdateEmailConfigDto {
  settings?: CreateEmailConfigDto['settings'];
  isEnabled?: boolean;
}

class ToggleEmailConfigDto {
  isEnabled: boolean;
}

class TestEmailConfigDto {
  testEmail: string;
}

// Email Template DTOs
class CreateEmailTemplateDto {
  name: string;
  subject: string;
  body: string;
  type: string;
}

class UpdateEmailTemplateDto {
  name?: string;
  subject?: string;
  body?: string;
  type?: string;
  isActive?: boolean;
}

class ToggleEmailTemplateDto {
  isActive: boolean;
}

@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ==================== AI PROVIDERS ====================

  @Get('ai/providers')
  async getAIProviders() {
    const providers = await this.settingsService.getAIProviders();
    return { items: providers };
  }

  @Get('ai/providers/:id')
  async getAIProvider(@Param('id') id: string) {
    return this.settingsService.getAIProvider(id);
  }

  @Post('ai/providers')
  async createAIProvider(@Body() dto: CreateAIProviderDto) {
    return this.settingsService.createAIProvider(dto);
  }

  @Patch('ai/providers/:id')
  async updateAIProvider(
    @Param('id') id: string,
    @Body() dto: UpdateAIProviderDto,
  ) {
    return this.settingsService.updateAIProvider(id, dto);
  }

  @Delete('ai/providers/:id')
  async deleteAIProvider(@Param('id') id: string) {
    await this.settingsService.deleteAIProvider(id);
    return { success: true };
  }

  @Patch('ai/providers/:id/toggle')
  async toggleAIProvider(
    @Param('id') id: string,
    @Body() dto: ToggleProviderDto,
  ) {
    return this.settingsService.toggleAIProvider(id, dto.enabled);
  }

  @Post('ai/providers/:id/set-default')
  async setDefaultAIProvider(@Param('id') id: string) {
    return this.settingsService.setDefaultAIProvider(id);
  }

  @Post('ai/providers/:id/test')
  async testAIProvider(@Param('id') id: string) {
    return this.settingsService.testAIProvider(id);
  }

  @Get('ai/providers/:providerId/models')
  async getAIModels(@Param('providerId') providerId: string) {
    const models = await this.settingsService.getAIModels(providerId);
    return { items: models };
  }

  @Post('ai/providers/:providerId/models')
  async addAIModel(@Param('providerId') providerId: string, @Body() dto: any) {
    return this.settingsService.addAIModel(providerId, dto);
  }

  // ==================== TIERS ====================

  @Get('tiers')
  async getTiers() {
    const tiers = await this.settingsService.getTiers();
    return { items: tiers };
  }

  @Get('tiers/:id')
  async getTier(@Param('id') id: string) {
    return this.settingsService.getTier(id);
  }

  @Post('tiers')
  async createTier(@Body() dto: CreateTierDto) {
    return this.settingsService.createTier(dto);
  }

  @Patch('tiers/:id')
  async updateTier(@Param('id') id: string, @Body() dto: UpdateTierDto) {
    return this.settingsService.updateTier(id, dto);
  }

  @Delete('tiers/:id')
  async deleteTier(@Param('id') id: string) {
    await this.settingsService.deleteTier(id);
    return { success: true };
  }

  @Patch('tiers/:id/toggle')
  async toggleTier(@Param('id') id: string, @Body() dto: ToggleTierDto) {
    return this.settingsService.toggleTier(id, dto.isActive);
  }

  @Post('tiers/:id/set-default')
  async setDefaultTier(@Param('id') id: string) {
    return this.settingsService.setDefaultTier(id);
  }

  @Post('tiers/reorder')
  async reorderTiers(@Body() dto: ReorderTiersDto) {
    const tiers = await this.settingsService.reorderTiers(dto.orderedIds);
    return { items: tiers };
  }

  @Get('tiers/:id/usage')
  async getTierUsage(@Param('id') id: string) {
    return this.settingsService.getTierUsage(id);
  }

  // ==================== EMAIL CONFIGS ====================

  @Get('email/configs')
  async getEmailConfigs() {
    const configs = await this.settingsService.getEmailConfigs();
    return { items: configs };
  }

  @Get('email/configs/:id')
  async getEmailConfig(@Param('id') id: string) {
    return this.settingsService.getEmailConfig(id);
  }

  @Post('email/configs')
  async createEmailConfig(@Body() dto: CreateEmailConfigDto) {
    return this.settingsService.createEmailConfig(dto);
  }

  @Patch('email/configs/:id')
  async updateEmailConfig(
    @Param('id') id: string,
    @Body() dto: UpdateEmailConfigDto,
  ) {
    return this.settingsService.updateEmailConfig(id, dto);
  }

  @Delete('email/configs/:id')
  async deleteEmailConfig(@Param('id') id: string) {
    await this.settingsService.deleteEmailConfig(id);
    return { success: true };
  }

  @Patch('email/configs/:id/toggle')
  async toggleEmailConfig(
    @Param('id') id: string,
    @Body() dto: ToggleEmailConfigDto,
  ) {
    return this.settingsService.toggleEmailConfig(id, dto.isEnabled);
  }

  @Post('email/configs/:id/set-default')
  async setDefaultEmailConfig(@Param('id') id: string) {
    return this.settingsService.setDefaultEmailConfig(id);
  }

  @Post('email/configs/:id/test')
  async testEmailConfig(
    @Param('id') id: string,
    @Body() dto: TestEmailConfigDto,
  ) {
    return this.settingsService.testEmailConfig(id, dto.testEmail);
  }

  // ==================== EMAIL TEMPLATES ====================

  @Get('email/templates')
  async getEmailTemplates() {
    const templates = await this.settingsService.getEmailTemplates();
    return { items: templates };
  }

  @Get('email/templates/:id')
  async getEmailTemplate(@Param('id') id: string) {
    return this.settingsService.getEmailTemplate(id);
  }

  @Post('email/templates')
  async createEmailTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.settingsService.createEmailTemplate(dto);
  }

  @Patch('email/templates/:id')
  async updateEmailTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.settingsService.updateEmailTemplate(id, dto);
  }

  @Delete('email/templates/:id')
  async deleteEmailTemplate(@Param('id') id: string) {
    await this.settingsService.deleteEmailTemplate(id);
    return { success: true };
  }

  @Patch('email/templates/:id/toggle')
  async toggleEmailTemplate(
    @Param('id') id: string,
    @Body() dto: ToggleEmailTemplateDto,
  ) {
    return this.settingsService.toggleEmailTemplate(id, dto.isActive);
  }

  // ==================== EMAIL LOGS ====================

  @Get('email/logs')
  async getEmailLogs(@Query() query: any) {
    return this.settingsService.getEmailLogs(query);
  }

  @Get('email/logs/:id')
  async getEmailLog(@Param('id') id: string) {
    return this.settingsService.getEmailLog(id);
  }

  @Post('email/logs/:id/resend')
  async resendEmail(@Param('id') id: string) {
    return this.settingsService.resendEmail(id);
  }
}

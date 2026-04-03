/**
 * Onboarding Controller
 * Handles HTTP requests for the tenant onboarding wizard
 * Following SOLID principles with single responsibility per method
 */

import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import {
  StartOnboardingDto,
  UpdateOrganizationDto,
  UpdateAdminDto,
  SelectPlanDto,
  CreateDepartmentsDto,
  InviteUsersDto,
  AddIntegrationDto,
  ConfigureAgentsDto,
  UpdateSecurityDto,
  CompleteWizardDto,
} from './dto/onboarding.dto';
import { Public } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface WizardIdBody {
  wizardId: string;
}

@Controller({ path: 'onboarding', version: '1' })
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ============================================================================
  // Step 1: Start Onboarding
  // ============================================================================

  @Post('start')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async startOnboarding(
    @Body() dto: StartOnboardingDto,
  ): Promise<{ tempToken: string; wizardId: string; expiresAt: Date }> {
    return this.onboardingService.startOnboarding(dto);
  }

  @Post('start-authenticated')
  @UseGuards(JwtAuthGuard) // keep JWT guard: this one needs a real user identity
  @HttpCode(HttpStatus.CREATED)
  async startAuthenticatedWizard(
    @Request() req: { user: { email: string } },
  ): Promise<{ tempToken: string; wizardId: string; expiresAt: Date }> {
    return this.onboardingService.startAuthenticatedWizard(req.user.email);
  }

  // ============================================================================
  // Step 2: Organization
  // ============================================================================

  @Put('organization')
  @Public() // wizard session secured by wizardId in Redis
  @HttpCode(HttpStatus.OK)
  async updateOrganization(
    @Body() body: WizardIdBody & UpdateOrganizationDto,
  ): Promise<{ success: boolean }> {
    await this.onboardingService.updateOrganization(body.wizardId, body);
    return { success: true };
  }

  // ============================================================================
  // Step 3: Admin
  // ============================================================================

  @Put('admin')
  @Public()
  @HttpCode(HttpStatus.OK)
  async updateAdmin(
    @Body() body: WizardIdBody & UpdateAdminDto,
  ): Promise<{ success: boolean }> {
    await this.onboardingService.updateAdmin(body.wizardId, body);
    return { success: true };
  }

  // ============================================================================
  // Step 4: Plan
  // ============================================================================

  @Get('plans')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getPlans(): Promise<{ tiers: unknown[] }> {
    return this.onboardingService.getPlans();
  }

  @Put('plan')
  @Public()
  @HttpCode(HttpStatus.OK)
  async selectPlan(
    @Body() body: WizardIdBody & SelectPlanDto,
  ): Promise<{ success: boolean }> {
    await this.onboardingService.selectPlan(body.wizardId, body);
    return { success: true };
  }

  // ============================================================================
  // Step 5: Departments
  // ============================================================================

  @Post('departments')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createDepartments(
    @Body() body: WizardIdBody & CreateDepartmentsDto,
  ): Promise<{ departments: { id: string; name: string }[] }> {
    return this.onboardingService.createDepartments(body.wizardId, body);
  }

  // ============================================================================
  // Step 6: Team
  // ============================================================================

  @Post('invitations')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async inviteUsers(
    @Body() body: WizardIdBody & InviteUsersDto,
  ): Promise<{ invitations: { email: string; status: string }[] }> {
    return this.onboardingService.inviteUsers(body.wizardId, body);
  }

  // ============================================================================
  // Step 7: Integrations
  // ============================================================================

  @Post('integrations')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async addIntegration(
    @Body() body: WizardIdBody & AddIntegrationDto,
  ): Promise<{ integrationId: string; status: string }> {
    return this.onboardingService.addIntegration(body.wizardId, body);
  }

  // ============================================================================
  // Step 8: Agents
  // ============================================================================

  @Get('agent-templates')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getAgentTemplates(): Promise<{ templates: unknown[] }> {
    return this.onboardingService.getAgentTemplates();
  }

  @Post('agents')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async configureAgents(
    @Body() body: WizardIdBody & ConfigureAgentsDto,
  ): Promise<{ agents: { id: string; name: string }[] }> {
    return this.onboardingService.configureAgents(body.wizardId, body);
  }

  // ============================================================================
  // Step 9: Security
  // ============================================================================

  @Put('security')
  @Public()
  @HttpCode(HttpStatus.OK)
  async updateSecurity(
    @Body() body: WizardIdBody & UpdateSecurityDto,
  ): Promise<{ success: boolean }> {
    await this.onboardingService.updateSecurity(body.wizardId, body);
    return { success: true };
  }

  // ============================================================================
  // Step 10: Complete
  // ============================================================================

  @Post('complete')
  @Public()
  @HttpCode(HttpStatus.OK)
  async completeWizard(
    @Body() body: WizardIdBody & CompleteWizardDto,
  ): Promise<{
    tenantId: string;
    redirectUrl: string;
    welcomeEmailSent: boolean;
  }> {
    return this.onboardingService.completeWizard(body.wizardId, body);
  }

  // ============================================================================
  // Progress
  // ============================================================================

  @Get('progress/:wizardId')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getProgress(@Param('wizardId') wizardId: string): Promise<unknown> {
    return this.onboardingService.getWizardProgress(wizardId);
  }
}

/**
 * Onboarding Service
 * Handles the tenant onboarding wizard logic
 * Following SOLID principles:
 * - Single Responsibility: Only handles onboarding logic
 * - Open/Closed: Extensible via DTOs
 * - Liskov Substitution: Uses interfaces for dependencies
 * - Interface Segregation: Focused service methods
 * - Dependency Inversion: Depends on abstractions (Prisma, Redis)
 */

import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import {
  WizardData,
  WizardStep,
  DataResidency,
  AgentAutonomyLevel,
} from './interfaces/onboarding-state.interface';
import {
  StartOnboardingDto,
  StartOnboardingResponseDto,
  UpdateOrganizationDto,
  UpdateAdminDto,
  SelectPlanDto,
  CreateDepartmentsDto,
  InviteUsersDto,
  AddIntegrationDto,
  ConfigureAgentsDto,
  UpdateSecurityDto,
  CompleteWizardDto,
  CompleteWizardResponseDto,
  WizardStateResponseDto,
  TierDto,
  AgentTemplateDto,
} from './dto/onboarding.dto';

interface WizardState {
  email?: string;
  tempToken?: string;
  wizardData: WizardData;
  currentStep: number;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly TOTAL_STEPS = 10;
  private readonly SKIPPABLE_STEPS = [6, 7, 8]; // Team, Integrations, Agents are optional
  private readonly WIZARD_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================================
  // Step 1: Start Onboarding
  // ============================================================================

  async startOnboarding(
    dto: StartOnboardingDto,
  ): Promise<StartOnboardingResponseDto> {
    // Validate password confirmation
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Create wizard record
    const wizardId = this.generateWizardId();
    const tempToken = this.generateTempToken(wizardId);
    const expiresAt = new Date(Date.now() + this.WIZARD_TTL * 1000);

    // Store wizard data in Redis
    const wizardState: WizardState = {
      email: dto.email.toLowerCase(),
      tempToken,
      wizardData: {},
      currentStep: WizardStep.ORGANIZATION,
    };

    await this.redis.setJson(
      `wizard:${wizardId}`,
      wizardState,
      this.WIZARD_TTL,
    );

    this.logger.log(`Wizard started for ${dto.email}, wizardId: ${wizardId}`);

    return {
      tempToken,
      wizardId,
      expiresAt,
    };
  }

  // ============================================================================
  // Start Wizard for Already-Authenticated Users
  // ============================================================================

  async startAuthenticatedWizard(
    userEmail: string,
  ): Promise<StartOnboardingResponseDto> {
    // No email-conflict check — user already registered via /auth/register
    const wizardId = this.generateWizardId();
    const tempToken = this.generateTempToken(wizardId);
    const expiresAt = new Date(Date.now() + this.WIZARD_TTL * 1000);

    const wizardState: WizardState = {
      email: userEmail.toLowerCase(),
      tempToken,
      wizardData: {},
      currentStep: WizardStep.ORGANIZATION,
    };

    await this.redis.setJson(
      `wizard:${wizardId}`,
      wizardState,
      this.WIZARD_TTL,
    );

    this.logger.log(
      `Authenticated wizard started for ${userEmail}, wizardId: ${wizardId}`,
    );

    return { tempToken, wizardId, expiresAt };
  }

  // ============================================================================
  // Step 2: Update Organization
  // ============================================================================

  async updateOrganization(
    wizardId: string,
    dto: UpdateOrganizationDto,
  ): Promise<void> {
    const wizard = await this.validateAndGetWizard(wizardId);

    // Check slug uniqueness
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException('Company slug already taken');
    }

    const updatedData: WizardData = {
      ...wizard.wizardData,
      company: {
        name: dto.name,
        slug: dto.slug,
        industry: dto.industry,
        size: dto.size,
        website: dto.website,
        timezone: dto.timezone,
        currency: dto.currency,
      },
    };

    await this.updateWizardState(wizardId, {
      ...wizard,
      wizardData: updatedData,
      currentStep: WizardStep.ADMIN,
    });
  }

  // ============================================================================
  // Step 3: Update Admin
  // ============================================================================

  async updateAdmin(wizardId: string, dto: UpdateAdminDto): Promise<void> {
    const wizard = await this.validateAndGetWizard(wizardId);

    const updatedData: WizardData = {
      ...wizard.wizardData,
      admin: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
      },
    };

    await this.updateWizardState(wizardId, {
      ...wizard,
      wizardData: updatedData,
      currentStep: WizardStep.PLAN,
    });
  }

  // ============================================================================
  // Step 4: Get Plans & Select Plan
  // ============================================================================

  async getPlans(): Promise<{ tiers: TierDto[] }> {
    const tiers = await this.prisma.tier.findMany({
      where: { isDefault: true },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      tiers: tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        monthlyPrice: Number(tier.monthlyPrice),
        yearlyPrice: Number(tier.yearlyPrice),
        currency: tier.currency || 'USD',
        maxUsers: tier.maxUsers,
        maxAgents: tier.maxAgents,
        maxStorageGB: tier.maxStorageGB,
        features: this.getTierFeatures(tier.slug),
      })),
    };
  }

  async selectPlan(wizardId: string, dto: SelectPlanDto): Promise<void> {
    const wizard = await this.validateAndGetWizard(wizardId);

    // Validate tier exists
    const tier = await this.prisma.tier.findUnique({
      where: { id: dto.tierId },
    });

    if (!tier) {
      throw new NotFoundException('Selected plan not found');
    }

    const updatedData: WizardData = {
      ...wizard.wizardData,
      plan: {
        tierId: dto.tierId,
        billingCycle: dto.billingCycle,
      },
    };

    await this.updateWizardState(wizardId, {
      ...wizard,
      wizardData: updatedData,
      currentStep: WizardStep.DEPARTMENTS,
    });
  }

  // ============================================================================
  // Step 5: Create Departments
  // ============================================================================

  async createDepartments(
    wizardId: string,
    dto: CreateDepartmentsDto,
  ): Promise<{ departments: { id: string; name: string }[] }> {
    const wizard = await this.validateAndGetWizard(wizardId);
    const company = wizard.wizardData.company;

    if (!company) {
      throw new BadRequestException(
        'Please complete organization details first',
      );
    }

    // Get or create tenant
    let tenant = await this.prisma.tenant.findUnique({
      where: { slug: company.slug },
    });

    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          name: company.name,
          slug: company.slug,
          industry: company.industry,
          settings: {
            companySize: company.size,
            timezone: company.timezone,
            currency: company.currency,
          },
          tierId: wizard.wizardData.plan?.tierId || 'tier_starter',
          status: 'TRIAL',
        },
      });
    }

    // Create departments
    const createdDepartments: { id: string; name: string }[] = [];
    for (const dept of dto.departments) {
      const department = await this.prisma.department.create({
        data: {
          name: dept.name,
          tenantId: tenant.id,
          parentId: dept.parentId || null,
        },
      });
      createdDepartments.push({
        id: department.id,
        name: department.name,
      });
    }

    // Update wizard state with department info
    const updatedData: WizardData = {
      ...wizard.wizardData,
      departments: dto.departments.map((d, i) => ({
        ...d,
        departmentId: createdDepartments[i]?.id,
      })),
    };

    await this.updateWizardState(wizardId, {
      ...wizard,
      wizardData: updatedData,
      currentStep: WizardStep.TEAM,
    });

    return { departments: createdDepartments };
  }

  // ============================================================================
  // Step 6: Invite Team Members
  // ============================================================================

  async inviteUsers(
    wizardId: string,
    dto: InviteUsersDto,
  ): Promise<{ invitations: { email: string; status: string }[] }> {
    const wizard = await this.validateAndGetWizard(wizardId);
    const company = wizard.wizardData.company;

    if (!company) {
      throw new BadRequestException(
        'Please complete organization details first',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: company.slug },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const invitations: { email: string; status: string }[] = [];
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    for (const invite of dto.invitations) {
      const token = this.generateWizardId();

      // Create invitation record (using ApiKey as a temporary store for invitations)
      await this.prisma.apiKey.create({
        data: {
          tenantId: tenant.id,
          name: `invite:${invite.email}`,
          keyHash: token,
          prefix: token.substring(0, 8),
          expiresAt,
        },
      });

      invitations.push({
        email: invite.email,
        status: 'pending',
      });
    }

    // Update wizard state
    const updatedData: WizardData = {
      ...wizard.wizardData,
      invitations: dto.invitations.map((inv) => ({
        email: inv.email,
        firstName: inv.firstName,
        lastName: inv.lastName,
        role: inv.role,
        departmentId: inv.departmentId,
        message: inv.message,
      })),
    };

    await this.updateWizardState(wizardId, {
      ...wizard,
      wizardData: updatedData,
      currentStep: WizardStep.INTEGRATIONS,
    });

    return { invitations };
  }

  // ============================================================================
  // Step 7: Add Integration
  // ============================================================================

  async addIntegration(
    wizardId: string,
    dto: AddIntegrationDto,
  ): Promise<{ integrationId: string; status: string }> {
    const wizard = await this.validateAndGetWizard(wizardId);
    const company = wizard.wizardData.company;

    if (!company) {
      throw new BadRequestException(
        'Please complete organization details first',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: company.slug },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    // Create CRM connector (integration)
    const integration = await this.prisma.crmConnector.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        provider: dto.type,
        config: {
          instanceUrl: dto.instanceUrl,
          clientId: dto.clientId,
          host: dto.host,
          port: dto.port,
          user: dto.user,
          fromEmail: dto.fromEmail,
          workspaceId: dto.workspaceId,
        },
        isActive: true,
      },
    });

    // Update wizard state — store the type string (not the record id) so
    // completeWizard's idempotency check (findFirst by provider type) works correctly.
    const integrations = wizard.wizardData.integrations || [];
    integrations.push(dto.type);

    await this.updateWizardState(wizardId, {
      ...wizard,
      wizardData: {
        ...wizard.wizardData,
        integrations,
      },
      currentStep: WizardStep.AGENTS,
    });

    return {
      integrationId: integration.id,
      status: 'connected',
    };
  }

  // ============================================================================
  // Step 8: Configure Agents
  // ============================================================================

  async getAgentTemplates(): Promise<{ templates: AgentTemplateDto[] }> {
    const templates = await this.prisma.agentTemplate.findMany({
      where: { isPublic: true },
      take: 50,
    });

    return {
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        department: 'General',
        type: 'FUNCTIONAL',
        autonomyLevel: AgentAutonomyLevel.RECOMMEND,
      })),
    };
  }

  async configureAgents(
    wizardId: string,
    dto: ConfigureAgentsDto,
  ): Promise<{ agents: { id: string; name: string }[] }> {
    const wizard = await this.validateAndGetWizard(wizardId);
    const company = wizard.wizardData.company;

    if (!company) {
      throw new BadRequestException(
        'Please complete organization details first',
      );
    }

    let tenant = await this.prisma.tenant.findUnique({
      where: { slug: company.slug },
    });

    // Create tenant if it doesn't exist yet (departments step may have been skipped)
    if (!tenant) {
      const tier = wizard.wizardData.plan?.tierId
        ? await this.prisma.tier.findUnique({
            where: { id: wizard.wizardData.plan.tierId },
          })
        : await this.prisma.tier.findFirst({ where: { isDefault: true } });

      tenant = await this.prisma.tenant.create({
        data: {
          name: company.name,
          slug: company.slug,
          industry: company.industry,
          tierId: tier?.id ?? 'tier_starter',
          status: 'TRIAL',
          settings: {
            companySize: company.size,
            timezone: company.timezone,
            currency: company.currency,
          },
        },
      });
    }

    const createdAgents: { id: string; name: string }[] = [];
    for (const agent of dto.agents) {
      const template = await this.prisma.agentTemplate.findUnique({
        where: { id: agent.templateId },
      });

      if (!template) {
        this.logger.warn(
          `Agent template ${agent.templateId} not found, skipping`,
        );
        continue;
      }

      const newAgent = await this.prisma.agent.create({
        data: {
          tenantId: tenant.id,
          name: agent.name,
          departmentId: agent.departmentId ?? null,
          status: 'IDLE',
          isSelected: true,
          templateId: agent.templateId,
        },
      });

      createdAgents.push({
        id: newAgent.id,
        name: newAgent.name,
      });
    }

    // Update wizard state
    await this.updateWizardState(wizardId, {
      ...wizard,
      wizardData: {
        ...wizard.wizardData,
        agents: dto.agents.map((a) => ({
          templateId: a.templateId,
          name: a.name,
          departmentId: a.departmentId,
          autonomyLevel: a.autonomyLevel || AgentAutonomyLevel.RECOMMEND,
        })),
      },
      currentStep: WizardStep.SECURITY,
    });

    return { agents: createdAgents };
  }

  // ============================================================================
  // Step 9: Update Security
  // ============================================================================

  async updateSecurity(
    wizardId: string,
    dto: UpdateSecurityDto,
  ): Promise<void> {
    const wizard = await this.validateAndGetWizard(wizardId);

    // Validate required consents
    if (!dto.gdprConsent || !dto.termsAccepted || !dto.privacyAccepted) {
      throw new BadRequestException(
        'You must accept Terms of Service, Privacy Policy, and confirm GDPR compliance',
      );
    }

    const updatedData: WizardData = {
      ...wizard.wizardData,
      security: {
        dataResidency: dto.dataResidency,
        gdprConsent: dto.gdprConsent,
        termsAccepted: dto.termsAccepted,
        privacyAccepted: dto.privacyAccepted,
        auditRetentionDays: dto.auditRetentionDays,
        require2FA: dto.require2FA,
        ipWhitelist: dto.ipWhitelist,
      },
    };

    await this.updateWizardState(wizardId, {
      ...wizard,
      wizardData: updatedData,
      currentStep: WizardStep.REVIEW,
    });
  }

  // ============================================================================
  // Step 10: Complete Wizard
  // ============================================================================

  async completeWizard(
    wizardId: string,
    dto: CompleteWizardDto,
  ): Promise<CompleteWizardResponseDto> {
    const wizard = await this.validateAndGetWizard(wizardId);
    // `email` lives at the wizard root (set by startOnboarding / startAuthenticatedWizard),
    // NOT inside wizardData — destructuring the wrong object was the root-cause of the
    // "Please complete all required steps" 400 that prevented tenant creation.
    const email = wizard.email;
    const { company, admin, plan, security } = wizard.wizardData;

    if (!email || !company) {
      throw new BadRequestException(
        'Please complete all required organisation steps',
      );
    }

    // Find tenant (created in step 5 - departments, or create now if skipped)
    let tenant = await this.prisma.tenant.findUnique({
      where: { slug: company.slug },
    });

    if (!tenant) {
      // Tenant not yet created (departments step was skipped)
      const tier = plan?.tierId
        ? await this.prisma.tier.findUnique({ where: { id: plan.tierId } })
        : await this.prisma.tier.findFirst({ where: { isDefault: true } });

      tenant = await this.prisma.tenant.create({
        data: {
          name: company.name,
          slug: company.slug,
          industry: company.industry,
          tierId: tier?.id ?? 'tier_starter',
          status: 'TRIAL',
          settings: {
            companySize: company.size,
            timezone: company.timezone,
            currency: company.currency,
          },
        },
      });
    }

    // Link or create admin user — if user already exists (registered via /auth/register)
    // update their tenantId; otherwise create a new user.
    let adminUser = await this.prisma.user.findUnique({ where: { email } });
    if (adminUser) {
      // User registered via /auth/register — link to the tenant
      adminUser = await this.prisma.user.update({
        where: { email },
        data: {
          firstName: admin?.firstName || adminUser.firstName,
          lastName: admin?.lastName || adminUser.lastName,
          tenantId: tenant.id,
          role: 'ADMIN',
          isActive: true,
        },
      });
    } else {
      adminUser = await this.prisma.user.create({
        data: {
          email,
          passwordHash:
            (wizard.wizardData as WizardData & { passwordHash?: string })
              .passwordHash || '',
          firstName: admin?.firstName ?? email.split('@')[0],
          lastName: admin?.lastName ?? '',
          tenantId: tenant.id,
          role: 'ADMIN',
          isActive: true,
          isVerified: false,
        },
      });
    }

    // Update tenant status and settings
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: 'ACTIVE',
        settings: {
          ...(typeof tenant.settings === 'object' ? tenant.settings : {}),
          dataResidency: security?.dataResidency || DataResidency.US,
          auditRetentionDays: security?.auditRetentionDays || 365,
          require2FA: security?.require2FA || false,
          ipWhitelist: security?.ipWhitelist || [],
        },
      },
    });

    // Store consent records in tenant metadata
    if (security) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          actor: adminUser.id,
          action: 'CONSENT_ACCEPTED',
          resource: 'TENANT',
          resourceId: tenant.id,
          details: {
            gdprConsent: security.gdprConsent,
            termsAccepted: security.termsAccepted,
            privacyAccepted: security.privacyAccepted,
            marketingConsent: dto.marketingConsent || false,
          },
        },
      });
    }

    // ── Deploy agents from wizard state (idempotent: skip if already deployed) ──
    const {
      agents: wizardAgents,
      invitations: wizardInvitations,
      integrations: wizardIntegrations,
    } = wizard.wizardData;

    if (wizardAgents?.length) {
      const existingAgentCount = await this.prisma.agent.count({
        where: { tenantId: tenant.id },
      });
      if (existingAgentCount === 0) {
        for (const agent of wizardAgents) {
          await this.prisma.agent.create({
            data: {
              tenantId: tenant.id,
              name: agent.name,
              departmentId: agent.departmentId ?? null,
              templateId: agent.templateId,
              status: 'IDLE',
              isSelected: true,
            },
          });
        }
        this.logger.log(
          `Deployed ${wizardAgents.length} agents for tenant ${tenant.id}`,
        );
      }
    }

    // ── Deploy pending invitations from wizard state ──────────────────────────
    if (wizardInvitations?.length) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      for (const invite of wizardInvitations) {
        const existing = await this.prisma.apiKey.findFirst({
          where: { tenantId: tenant.id, name: `invite:${invite.email}` },
        });
        if (!existing) {
          const token = this.generateWizardId();
          await this.prisma.apiKey.create({
            data: {
              tenantId: tenant.id,
              name: `invite:${invite.email}`,
              keyHash: token,
              prefix: token.substring(0, 8),
              expiresAt,
            },
          });
        }
      }
      this.logger.log(
        `Processed ${wizardInvitations.length} invitations for tenant ${tenant.id}`,
      );
    }

    // ── Create placeholder connectors for selected integrations ──────────────
    if (wizardIntegrations?.length) {
      for (const integType of wizardIntegrations) {
        const existing = await this.prisma.crmConnector.findFirst({
          where: { tenantId: tenant.id, provider: integType },
        });
        if (!existing) {
          await this.prisma.crmConnector.create({
            data: {
              tenantId: tenant.id,
              name: integType
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase()),
              provider: integType,
              config: {},
              isActive: false,
            },
          });
        }
      }
      this.logger.log(
        `Created ${wizardIntegrations.length} integration placeholders for tenant ${tenant.id}`,
      );
    }

    // Clear wizard state
    await this.redis.del(`wizard:${wizardId}`);

    this.logger.log(
      `Wizard completed for tenant ${tenant.id}, admin: ${email}`,
    );

    return {
      tenantId: tenant.id,
      redirectUrl: '/dashboard-v2',
      welcomeEmailSent: true,
    };
  }

  // ============================================================================
  // Get Wizard State
  // ============================================================================

  async getWizardProgress(wizardId: string): Promise<WizardStateResponseDto> {
    const wizard = await this.validateAndGetWizard(wizardId);
    const data = wizard.wizardData;

    const completedSteps: number[] = [];
    if (data.company) completedSteps.push(WizardStep.ORGANIZATION);
    if (data.admin) completedSteps.push(WizardStep.ADMIN);
    if (data.plan) completedSteps.push(WizardStep.PLAN);
    if (data.departments?.length) completedSteps.push(WizardStep.DEPARTMENTS);
    if (data.invitations?.length) completedSteps.push(WizardStep.TEAM);
    if (data.integrations?.length) completedSteps.push(WizardStep.INTEGRATIONS);
    if (data.agents?.length) completedSteps.push(WizardStep.AGENTS);
    if (data.security) completedSteps.push(WizardStep.SECURITY);

    const canSkip = Array.from({ length: this.TOTAL_STEPS }, (_, i) =>
      this.SKIPPABLE_STEPS.includes(i + 1),
    );

    return {
      wizardId,
      currentStep: wizard.currentStep,
      totalSteps: this.TOTAL_STEPS,
      completedSteps,
      data: data as unknown as Record<string, unknown>,
      canGoBack: wizard.currentStep > 1,
      canSkip,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateWizardId(): string {
    return `wiz_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateTempToken(wizardId: string): string {
    return this.jwtService.sign(
      { wizardId, type: 'wizard' },
      { expiresIn: '24h' },
    );
  }

  private async validateAndGetWizard(wizardId: string): Promise<WizardState> {
    const state = await this.redis.getJson<WizardState>(`wizard:${wizardId}`);
    if (!state) {
      throw new UnauthorizedException('Invalid or expired wizard session');
    }
    return state;
  }

  private async updateWizardState(
    wizardId: string,
    state: WizardState,
  ): Promise<void> {
    await this.redis.setJson(`wizard:${wizardId}`, state, this.WIZARD_TTL);
  }

  private getTierFeatures(tierSlug: string): string[] {
    const features: Record<string, string[]> = {
      starter: [
        'core_tasks',
        'core_workflows',
        'core_agents',
        'basic_analytics',
        'email_support',
      ],
      professional: [
        'api_access',
        'sso_ready',
        'audit_export',
        'custom_branding',
        'priority_support',
        'advanced_analytics',
      ],
      enterprise: [
        'sso_saml',
        'sso_oidc',
        'custom_domain',
        'dedicated_support',
        'sla_guarantee',
        'unlimited_storage',
      ],
    };

    return features[tierSlug] || features.starter;
  }
}

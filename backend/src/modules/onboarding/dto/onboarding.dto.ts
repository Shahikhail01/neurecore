/**
 * Onboarding Wizard DTOs
 * Data Transfer Objects for each wizard step
 * Following SOLID principles with single responsibility
 */

import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
  IsInt,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  Industry,
  CompanySize,
  DataResidency,
  BillingCycle,
  UserRole,
  AgentAutonomyLevel,
  IntegrationType,
} from '../interfaces/onboarding-state.interface';

// ============================================================================
// Step 1: Account Creation DTOs
// ============================================================================

export class StartOnboardingDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase, one lowercase, one number, and one special character',
  })
  password!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  confirmPassword!: string;
}

export class StartOnboardingResponseDto {
  tempToken!: string;
  wizardId!: string;
  expiresAt!: Date;
}

// ============================================================================
// Step 2: Organization DTOs
// ============================================================================

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  @MaxLength(100, { message: 'Company name cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug!: string;

  @IsEnum(Industry, { message: 'Please select a valid industry' })
  industry!: Industry;

  @IsEnum(CompanySize, { message: 'Please select a valid company size' })
  size!: CompanySize;

  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid website URL' })
  @MaxLength(500)
  website?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  timezone!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a 3-letter code' })
  currency!: string;
}

// ============================================================================
// Step 3: Admin DTOs
// ============================================================================

export class UpdateAdminDto {
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Please provide a valid phone number in E.164 format',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;
}

// ============================================================================
// Step 4: Plan DTOs
// ============================================================================

export class SelectPlanDto {
  @IsString()
  @MinLength(1)
  tierId!: string;

  @IsEnum(BillingCycle, { message: 'Please select monthly or yearly billing' })
  billingCycle!: BillingCycle;
}

export class TierDto {
  id!: string;
  name!: string;
  monthlyPrice!: number;
  yearlyPrice!: number;
  currency!: string;
  maxUsers!: number;
  maxAgents!: number;
  maxStorageGB!: number;
  features!: string[];
}

export class GetPlansResponseDto {
  tiers!: TierDto[];
}

// ============================================================================
// Step 5: Departments DTOs
// ============================================================================

export class DepartmentInputDto {
  @IsString()
  @MinLength(1, { message: 'Department name is required' })
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Manager email must be valid' })
  managerEmail?: string;
}

export class CreateDepartmentsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one department is required' })
  @ValidateNested({ each: true })
  @Type(() => DepartmentInputDto)
  departments!: DepartmentInputDto[];
}

export class DepartmentOutputDto {
  id!: string;
  name!: string;
  parentId!: string | null;
  managerId!: string | null;
  createdAt!: Date;
}

// ============================================================================
// Step 6: Team Invitation DTOs
// ============================================================================

export class InvitationInputDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName!: string;

  @IsEnum(UserRole, { message: 'Please select a valid role' })
  role!: UserRole;

  @IsOptional()
  @IsString()
  @MinLength(1)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class InviteUsersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvitationInputDto)
  invitations!: InvitationInputDto[];
}

export class InvitationOutputDto {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  role!: UserRole;
  departmentId!: string;
  status!: 'pending' | 'accepted' | 'expired';
  expiresAt!: Date;
}

// ============================================================================
// Step 7: Integration DTOs
// ============================================================================

export class AddIntegrationDto {
  @IsEnum(IntegrationType, {
    message: 'Please select a valid integration type',
  })
  type!: IntegrationType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  instanceUrl?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEmail({}, { message: 'From email must be valid' })
  fromEmail?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;
}

export class IntegrationOutputDto {
  id!: string;
  type!: IntegrationType;
  name!: string;
  status!: 'connected' | 'disconnected' | 'error';
  lastSyncAt!: Date | null;
  createdAt!: Date;
}

// ============================================================================
// Step 8: Agent Configuration DTOs
// ============================================================================

export class AgentConfigInputDto {
  @IsString()
  @MinLength(1)
  templateId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsEnum(AgentAutonomyLevel)
  autonomyLevel?: AgentAutonomyLevel;
}

export class ConfigureAgentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentConfigInputDto)
  agents!: AgentConfigInputDto[];
}

export class AgentTemplateDto {
  id!: string;
  name!: string;
  description!: string;
  department!: string;
  type!: string;
  autonomyLevel!: AgentAutonomyLevel;
}

// ============================================================================
// Step 9: Security DTOs
// ============================================================================

export class UpdateSecurityDto {
  @IsEnum(DataResidency, {
    message: 'Please select a valid data residency region',
  })
  dataResidency!: DataResidency;

  @IsBoolean({ message: 'GDPR consent is required' })
  gdprConsent!: boolean;

  @IsBoolean({ message: 'Terms of Service acceptance is required' })
  termsAccepted!: boolean;

  @IsBoolean({ message: 'Privacy Policy acceptance is required' })
  privacyAccepted!: boolean;

  @IsInt()
  @Min(30, { message: 'Audit retention must be at least 30 days' })
  @Max(3650, { message: 'Audit retention cannot exceed 3650 days' })
  auditRetentionDays!: number;

  @IsOptional()
  @IsBoolean()
  require2FA?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];
}

// ============================================================================
// Step 10: Complete Wizard DTOs
// ============================================================================

export class CompleteWizardDto {
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referralCode?: string;
}

export class CompleteWizardResponseDto {
  tenantId!: string;
  redirectUrl!: string;
  welcomeEmailSent!: boolean;
}

// ============================================================================
// General DTOs
// ============================================================================

export class GetWizardStateDto {
  wizardId?: string;
}

export class WizardStateResponseDto {
  wizardId!: string;
  currentStep!: number;
  totalSteps!: number;
  completedSteps!: number[];
  data!: Record<string, unknown>;
  canGoBack!: boolean;
  canSkip!: boolean[];
}

export class UpdateWizardStepDto {
  @IsInt()
  @Min(1)
  @Max(10)
  step!: number;
}

/**
 * Onboarding Wizard Types
 * Following SOLID principles with single responsibility per interface
 */

// ============================================================================
// Enums (matching backend)
// ============================================================================

export enum WizardStep {
  WELCOME = 1,
  ORGANIZATION = 2,
  ADMIN = 3,
  PLAN = 4,
  DEPARTMENTS = 5,
  TEAM = 6,
  INTEGRATIONS = 7,
  AGENTS = 8,
  SECURITY = 9,
  REVIEW = 10,
}

export enum Industry {
  TECHNOLOGY = "TECHNOLOGY",
  FINANCE = "FINANCE",
  HEALTHCARE = "HEALTHCARE",
  RETAIL = "RETAIL",
  MANUFACTURING = "MANUFACTURING",
  EDUCATION = "EDUCATION",
  LEGAL = "LEGAL",
  CONSULTING = "CONSULTING",
  MEDIA = "MEDIA",
  REAL_ESTATE = "REAL_ESTATE",
  HOSPITALITY = "HOSPITALITY",
  TRANSPORTATION = "TRANSPORTATION",
  ENERGY = "ENERGY",
  GOVERNMENT = "GOVERNMENT",
  NON_PROFIT = "NON_PROFIT",
  OTHER = "OTHER",
}

export enum CompanySize {
  STARTUP = "STARTUP",
  SMALL = "SMALL",
  MEDIUM = "MEDIUM",
  LARGE = "LARGE",
  ENTERPRISE = "ENTERPRISE",
}

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  AGENT = "AGENT",
  VIEWER = "VIEWER",
}

export enum BillingCycle {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

export enum DataResidency {
  US = "US",
  EU = "EU",
  APAC = "APAC",
}

export enum IntegrationType {
  CRM_SALESFORCE = "CRM_SALESFORCE",
  CRM_HUBSPOT = "CRM_HUBSPOT",
  CRM_PIPEDRIVE = "CRM_PIPEDRIVE",
  EMAIL_SMTP = "EMAIL_SMTP",
  EMAIL_GMAIL = "EMAIL_GMAIL",
  CALENDAR_GOOGLE = "CALENDAR_GOOGLE",
  CALENDAR_OFFICE365 = "CALENDAR_OFFICE365",
  STORAGE_GOOGLE_DRIVE = "STORAGE_GOOGLE_DRIVE",
  STORAGE_ONEDRIVE = "STORAGE_ONEDRIVE",
  COMMUNICATION_SLACK = "COMMUNICATION_SLACK",
  COMMUNICATION_TEAMS = "COMMUNICATION_TEAMS",
}

export enum AgentAutonomyLevel {
  ASSIST = "ASSIST",
  RECOMMEND = "RECOMMEND",
  EXECUTE = "EXECUTE",
  AUTONOMOUS = "AUTONOMOUS",
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface StartOnboardingDto {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateOrganizationDto {
  wizardId: string;
  name: string;
  slug: string;
  industry: Industry;
  size: CompanySize;
  website?: string;
  timezone: string;
  currency: string;
}

export interface UpdateAdminDto {
  wizardId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  jobTitle?: string;
}

export interface SelectPlanDto {
  wizardId: string;
  tierId: string;
  billingCycle: BillingCycle;
}

export interface DepartmentInputDto {
  name: string;
  parentId?: string;
  managerEmail?: string;
}

export interface CreateDepartmentsDto {
  wizardId: string;
  departments: DepartmentInputDto[];
}

export interface InvitationInputDto {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: string;
  message?: string;
}

export interface InviteUsersDto {
  wizardId: string;
  invitations: InvitationInputDto[];
}

export interface AddIntegrationDto {
  wizardId: string;
  type: IntegrationType;
  name: string;
  instanceUrl?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  fromEmail?: string;
  workspaceId?: string;
}

export interface AgentConfigInputDto {
  templateId: string;
  name: string;
  departmentId?: string;
  autonomyLevel?: AgentAutonomyLevel;
}

export interface ConfigureAgentsDto {
  wizardId: string;
  agents: AgentConfigInputDto[];
}

export interface UpdateSecurityDto {
  wizardId: string;
  dataResidency: DataResidency;
  gdprConsent: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  auditRetentionDays: number;
  require2FA?: boolean;
  ipWhitelist?: string[];
}

export interface CompleteWizardDto {
  wizardId: string;
  marketingConsent?: boolean;
  referralCode?: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface StartOnboardingResponse {
  tempToken: string;
  wizardId: string;
  expiresAt: Date;
}

export interface TierDto {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  maxUsers: number;
  maxAgents: number;
  maxStorageGB: number;
  features: string[];
}

export interface GetPlansResponse {
  tiers: TierDto[];
}

export interface DepartmentOutputDto {
  id: string;
  name: string;
}

export interface CreateDepartmentsResponse {
  departments: DepartmentOutputDto[];
}

export interface InvitationOutputDto {
  email: string;
  status: string;
}

export interface InviteUsersResponse {
  invitations: InvitationOutputDto[];
}

export interface AddIntegrationResponse {
  integrationId: string;
  status: string;
}

export interface AgentTemplateDto {
  id: string;
  name: string;
  description: string;
  department: string;
  type: string;
  autonomyLevel: AgentAutonomyLevel;
}

export interface GetAgentTemplatesResponse {
  templates: AgentTemplateDto[];
}

export interface ConfigureAgentsResponse {
  agents: { id: string; name: string }[];
}

export interface CompleteWizardResponse {
  tenantId: string;
  redirectUrl: string;
  welcomeEmailSent: boolean;
}

export interface WizardStateResponse {
  wizardId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  data: WizardData;
  canGoBack: boolean;
  canSkip: boolean[];
}

// ============================================================================
// Wizard Data State
// ============================================================================

export interface WizardData {
  email?: string;
  tempToken?: string;
  company?: {
    name: string;
    slug: string;
    industry: Industry;
    size: CompanySize;
    website?: string;
    timezone: string;
    currency: string;
  };
  admin?: {
    firstName: string;
    lastName: string;
    phone?: string;
    jobTitle?: string;
  };
  plan?: {
    tierId: string;
    billingCycle: BillingCycle;
  };
  departments?: DepartmentInputDto[];
  invitations?: InvitationInputDto[];
  integrations?: string[];
  agents?: AgentConfigInputDto[];
  security?: {
    dataResidency: DataResidency;
    gdprConsent: boolean;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    auditRetentionDays: number;
    require2FA?: boolean;
    ipWhitelist?: string[];
  };
  marketingConsent?: boolean;
  referralCode?: string;
}

// ============================================================================
// Display Helpers
// ============================================================================

export const INDUSTRY_OPTIONS = [
  { value: Industry.TECHNOLOGY, label: "Technology" },
  { value: Industry.FINANCE, label: "Finance & Banking" },
  { value: Industry.HEALTHCARE, label: "Healthcare" },
  { value: Industry.RETAIL, label: "Retail & E-commerce" },
  { value: Industry.MANUFACTURING, label: "Manufacturing" },
  { value: Industry.EDUCATION, label: "Education" },
  { value: Industry.LEGAL, label: "Legal Services" },
  { value: Industry.CONSULTING, label: "Consulting" },
  { value: Industry.MEDIA, label: "Media & Entertainment" },
  { value: Industry.REAL_ESTATE, label: "Real Estate" },
  { value: Industry.HOSPITALITY, label: "Hospitality & Travel" },
  { value: Industry.TRANSPORTATION, label: "Transportation & Logistics" },
  { value: Industry.ENERGY, label: "Energy & Utilities" },
  { value: Industry.GOVERNMENT, label: "Government & Public Sector" },
  { value: Industry.NON_PROFIT, label: "Non-Profit" },
  { value: Industry.OTHER, label: "Other" },
] as const;

export const COMPANY_SIZE_OPTIONS = [
  { value: CompanySize.STARTUP, label: "1-10 employees" },
  { value: CompanySize.SMALL, label: "11-50 employees" },
  { value: CompanySize.MEDIUM, label: "51-200 employees" },
  { value: CompanySize.LARGE, label: "201-1000 employees" },
  { value: CompanySize.ENTERPRISE, label: "1000+ employees" },
] as const;

export const USER_ROLE_OPTIONS = [
  { value: UserRole.ADMIN, label: "Administrator" },
  { value: UserRole.MANAGER, label: "Manager" },
  { value: UserRole.AGENT, label: "Agent" },
  { value: UserRole.VIEWER, label: "Viewer (Read-only)" },
] as const;

export const BILLING_CYCLE_OPTIONS = [
  { value: BillingCycle.MONTHLY, label: "Monthly" },
  { value: BillingCycle.YEARLY, label: "Yearly (Save 17%)" },
] as const;

export const DATA_RESIDENCY_OPTIONS = [
  { value: DataResidency.US, label: "United States (US)" },
  { value: DataResidency.EU, label: "European Union (GDPR compliant)" },
  { value: DataResidency.APAC, label: "Asia Pacific (APAC)" },
] as const;

export const INTEGRATION_TYPE_OPTIONS = [
  {
    value: IntegrationType.CRM_SALESFORCE,
    label: "Salesforce",
    tier: "Professional+",
  },
  {
    value: IntegrationType.CRM_HUBSPOT,
    label: "HubSpot",
    tier: "Professional+",
  },
  {
    value: IntegrationType.CRM_PIPEDRIVE,
    label: "Pipedrive",
    tier: "Professional+",
  },
  { value: IntegrationType.EMAIL_SMTP, label: "SMTP Email", tier: "Any" },
  { value: IntegrationType.EMAIL_GMAIL, label: "Gmail", tier: "Any" },
  {
    value: IntegrationType.CALENDAR_GOOGLE,
    label: "Google Calendar",
    tier: "Any",
  },
  {
    value: IntegrationType.CALENDAR_OFFICE365,
    label: "Microsoft 365 Calendar",
    tier: "Enterprise",
  },
  {
    value: IntegrationType.STORAGE_GOOGLE_DRIVE,
    label: "Google Drive",
    tier: "Any",
  },
  {
    value: IntegrationType.STORAGE_ONEDRIVE,
    label: "Microsoft OneDrive",
    tier: "Enterprise",
  },
  { value: IntegrationType.COMMUNICATION_SLACK, label: "Slack", tier: "Any" },
  {
    value: IntegrationType.COMMUNICATION_TEAMS,
    label: "Microsoft Teams",
    tier: "Enterprise",
  },
] as const;

export const AUTONOMY_LEVEL_OPTIONS = [
  {
    value: AgentAutonomyLevel.ASSIST,
    label: "Assist",
    description: "Human approves all actions",
  },
  {
    value: AgentAutonomyLevel.RECOMMEND,
    label: "Recommend",
    description: "Human reviews recommendations",
  },
  {
    value: AgentAutonomyLevel.EXECUTE,
    label: "Execute",
    description: "Human reviews completed work",
  },
  {
    value: AgentAutonomyLevel.AUTONOMOUS,
    label: "Autonomous",
    description: "Agent acts independently",
  },
] as const;

export const AUDIT_RETENTION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
  { value: 730, label: "2 years" },
] as const;

export const STEP_LABELS: Record<WizardStep, string> = {
  [WizardStep.WELCOME]: "Get Started",
  [WizardStep.ORGANIZATION]: "Organization",
  [WizardStep.ADMIN]: "Admin Account",
  [WizardStep.PLAN]: "Choose Plan",
  [WizardStep.DEPARTMENTS]: "Departments",
  [WizardStep.TEAM]: "Invite Team",
  [WizardStep.INTEGRATIONS]: "Integrations",
  [WizardStep.AGENTS]: "Configure Agents",
  [WizardStep.SECURITY]: "Security",
  [WizardStep.REVIEW]: "Review & Launch",
};

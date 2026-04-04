/**
 * Onboarding Wizard State Interface
 * Defines the complete state structure for the tenant onboarding wizard
 */

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
  TECHNOLOGY = 'TECHNOLOGY',
  FINANCE = 'FINANCE',
  HEALTHCARE = 'HEALTHCARE',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  EDUCATION = 'EDUCATION',
  LEGAL = 'LEGAL',
  CONSULTING = 'CONSULTING',
  MEDIA = 'MEDIA',
  REAL_ESTATE = 'REAL_ESTATE',
  HOSPITALITY = 'HOSPITALITY',
  TRANSPORTATION = 'TRANSPORTATION',
  ENERGY = 'ENERGY',
  GOVERNMENT = 'GOVERNMENT',
  NON_PROFIT = 'NON_PROFIT',
  OTHER = 'OTHER',
}

export enum CompanySize {
  STARTUP = 'STARTUP',
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  ENTERPRISE = 'ENTERPRISE',
}

export enum DataResidency {
  US = 'US',
  EU = 'EU',
  APAC = 'APAC',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

export enum AgentAutonomyLevel {
  ASSIST = 'ASSIST',
  RECOMMEND = 'RECOMMEND',
  EXECUTE = 'EXECUTE',
  AUTONOMOUS = 'AUTONOMOUS',
}

export enum IntegrationType {
  CRM_SALESFORCE = 'CRM_SALESFORCE',
  CRM_HUBSPOT = 'CRM_HUBSPOT',
  CRM_PIPEDRIVE = 'CRM_PIPEDRIVE',
  EMAIL_SMTP = 'EMAIL_SMTP',
  EMAIL_GMAIL = 'EMAIL_GMAIL',
  CALENDAR_GOOGLE = 'CALENDAR_GOOGLE',
  CALENDAR_OFFICE365 = 'CALENDAR_OFFICE365',
  STORAGE_GOOGLE_DRIVE = 'STORAGE_GOOGLE_DRIVE',
  STORAGE_ONEDRIVE = 'STORAGE_ONEDRIVE',
  COMMUNICATION_SLACK = 'COMMUNICATION_SLACK',
  COMMUNICATION_TEAMS = 'COMMUNICATION_TEAMS',
}

export interface WizardData {
  // Step 1: Welcome (Account Creation)
  email?: string;
  tempToken?: string;

  // Step 2: Organization
  company?: {
    name: string;
    slug: string;
    industry: Industry;
    size: CompanySize;
    website?: string;
    timezone: string;
    currency: string;
  };

  // Step 3: Admin
  admin?: {
    firstName: string;
    lastName: string;
    phone?: string;
    jobTitle?: string;
  };

  // Step 4: Plan
  plan?: {
    tierId: string;
    billingCycle: BillingCycle;
    subscriptionId?: string;
  };

  // Step 5: Departments
  departments?: Array<{
    name: string;
    parentId?: string;
    managerEmail?: string;
  }>;

  // Step 6: Team
  invitations?: Array<{
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    departmentId?: string;
    message?: string;
  }>;

  // Step 7: Integrations
  integrations?: string[]; // Integration IDs

  // Step 7 (sub): Workspace provisioning — captured alongside storage integration selection
  workspaceProvisioning?: {
    enabled: boolean;
    provider: 'GOOGLE_WORKSPACE' | 'MICROSOFT_365';
    emailDomain: string;
    emailPattern: 'FIRST_DOT_LAST' | 'FIRSTLAST' | 'F_DOT_LAST';
    folderStructure: 'BY_DEPARTMENT' | 'FLAT';
  };
  // Step 8: Agents
  agents?: Array<{
    templateId: string;
    name: string;
    departmentId?: string;
    autonomyLevel: AgentAutonomyLevel;
  }>;

  // Step 9: Security
  security?: {
    dataResidency: DataResidency;
    gdprConsent: boolean;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    auditRetentionDays: number;
    require2FA?: boolean;
    ipWhitelist?: string[];
  };

  // Step 10: Review
  marketingConsent?: boolean;
  referralCode?: string;
}

export interface OnboardingWizardEntity {
  id: string;
  tenantId: string | null;
  currentStep: number;
  wizardData: WizardData;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

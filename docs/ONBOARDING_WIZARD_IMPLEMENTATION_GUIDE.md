# NeureCore Tenant Onboarding Wizard — Implementation Guide

**Date:** 2026-03-31  
**Status:** Planning  
**Priority:** High  
**Target:** Phase 1.5 — User Onboarding

---

## Overview

The onboarding wizard guides new tenants through the initial setup process, collecting essential information to configure their NeureCore workspace. The wizard is designed to be:

- **Step-by-step** — Break complex setup into manageable steps
- **Flexible** — Allow skipping optional steps
- **Template-driven** — Use pre-configured templates where possible
- **Self-service** — No support intervention required

---

## Wizard Flow (10 Steps)

```
1. Welcome → Create Account
       ↓
2. Organization Details
       ↓
3. Admin User Setup
       ↓
4. Plan Selection (with pricing)
       ↓
5. Department Structure (with templates)
       ↓
6. Invite Team Members (skip option)
       ↓
7. Connect Integrations (skip option)
       ↓
8. Configure Agents (skip option)
       ↓
9. Security & Compliance
       ↓
10. Review & Launch
```

---

## Step-by-Step Information Gathering

### Step 1: Welcome & Account Creation

| Field             | Type   | Required | Validation                                    |
| ----------------- | ------ | -------- | --------------------------------------------- |
| `email`           | string | ✅       | Valid email format                            |
| `password`        | string | ✅       | Min 8 chars, 1 uppercase, 1 number, 1 special |
| `confirmPassword` | string | ✅       | Must match password                           |

**Backend:**

- `POST /api/v1/auth/register-tenant` — Creates preliminary account
- Returns `tempToken` for wizard continuation
- Does NOT create full tenant yet

---

### Step 2: Organization Details

| Field         | Type   | Required | Validation                             |
| ------------- | ------ | -------- | -------------------------------------- |
| `companyName` | string | ✅       | 2-100 chars, unique slug generation    |
| `companySlug` | string | ✅       | Lowercase, alphanumeric, hyphens only  |
| `industry`    | enum   | ✅       | From predefined list                   |
| `companySize` | enum   | ✅       | 1-10, 11-50, 51-200, 201-1000, 1000+   |
| `website`     | string | 🟡       | Valid URL format                       |
| `timezone`    | string | ✅       | IANA timezone (e.g., America/New_York) |
| `currency`    | enum   | ✅       | USD, EUR, GBP, CAD, AUD                |

**Industry Options:**

```typescript
enum Industry {
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

enum CompanySize {
  STARTUP = "STARTUP", // 1-10
  SMALL = "SMALL", // 11-50
  MEDIUM = "MEDIUM", // 51-200
  LARGE = "LARGE", // 201-1000
  ENTERPRISE = "ENTERPRISE", // 1000+
}
```

**Backend:**

- `PUT /api/v1/tenants/wizard` — Update wizard state
- Validates slug uniqueness
- Auto-generates slug from company name if not provided

---

### Step 3: Admin User Setup

| Field       | Type   | Required | Validation            |
| ----------- | ------ | -------- | --------------------- |
| `firstName` | string | ✅       | 1-50 chars            |
| `lastName`  | string | ✅       | 1-50 chars            |
| `phone`     | string | 🟡       | Valid phone format    |
| `jobTitle`  | string | 🟡       | 1-100 chars           |
| `avatar`    | file   | 🟡       | Image upload, max 5MB |

**Backend:**

- `PUT /api/v1/users/wizard` — Update admin profile
- Uses `tempToken` from step 1
- Sets role to `ADMIN`

---

### Step 4: Plan Selection

| Field           | Type   | Required | Description                  |
| --------------- | ------ | -------- | ---------------------------- |
| `tierId`        | enum   | ✅       | Selected pricing tier        |
| `billingCycle`  | enum   | ✅       | MONTHLY or YEARLY            |
| `paymentMethod` | object | 🟡       | Credit card details (Stripe) |

**Available Tiers:**

| Tier         | Monthly Price | Yearly Price | Users     | Agents    | Storage | Features                             |
| ------------ | ------------- | ------------ | --------- | --------- | ------- | ------------------------------------ |
| Starter      | $29           | $290         | 5         | 3         | 10GB    | Core features                        |
| Professional | $99           | $990         | 25        | 15        | 100GB   | + API access, SSO ready              |
| Enterprise   | $299          | $2,990       | Unlimited | Unlimited | 1TB     | + SSO, Custom branding, Audit export |

**Features by Tier:**

```typescript
const TIER_FEATURES = {
  starter: [
    "core_tasks",
    "core_workflows",
    "core_agents",
    "basic_analytics",
    "email_support",
  ],
  professional: [
    "starter_features",
    "api_access",
    "sso_ready",
    "audit_export",
    "custom_branding",
    "priority_support",
    "advanced_analytics",
  ],
  enterprise: [
    "professional_features",
    "sso_saml",
    "sso_oidc",
    "custom_domain",
    "dedicated_support",
    "sla_guarantee",
    "unlimited_storage",
  ],
};
```

**Backend:**

- `POST /api/v1/billing/subscribe` — Create Stripe subscription
- Returns `subscriptionId`
- Stores billing info in `billing_accounts` table

---

### Step 5: Department Structure

| Field                        | Type   | Required | Description                    |
| ---------------------------- | ------ | -------- | ------------------------------ |
| `departments[]`              | array  | ✅       | At least 1 department required |
| `departments[].name`         | string | ✅       | Department name                |
| `departments[].parentId`     | string | 🟡       | Parent department ID           |
| `departments[].managerEmail` | email  | 🟡       | Manager email                  |

**Department Templates:**

```typescript
const DEPARTMENT_TEMPLATES = [
  { name: "Administration", icon: "building", color: "#6B7280" },
  { name: "Finance", icon: "dollar-sign", color: "#10B981" },
  { name: "Operations", icon: "settings", color: "#3B82F6" },
  { name: "Risk & Compliance", icon: "shield", color: "#EF4444" },
  { name: "Sales & Marketing", icon: "trending-up", color: "#F59E0B" },
  { name: "Human Resources", icon: "users", color: "#8B5CF6" },
  { name: "IT & Engineering", icon: "code", color: "#06B6D4" },
  { name: "Customer Success", icon: "heart", color: "#EC4899" },
  { name: "Legal", icon: "scale", color: "#6366F1" },
];
```

**Hierarchy Support:**

- Flat (all departments at root)
- Hierarchical (parent-child relationships)
- Max depth: 3 levels

**Backend:**

- `POST /api/v1/departments/bulk` — Create multiple departments
- Returns array of created departments with IDs
- Auto-assigns creator as initial manager if email matches

---

### Step 6: Invite Team Members (Optional)

| Field                    | Type   | Required | Description                   |
| ------------------------ | ------ | -------- | ----------------------------- |
| `invites[]`              | array  | 🟡       | Can skip this step            |
| `invites[].email`        | email  | ✅       | Team member email             |
| `invites[].firstName`    | string | ✅       | First name                    |
| `invites[].lastName`     | string | ✅       | Last name                     |
| `invites[].role`         | enum   | ✅       | ADMIN, MANAGER, AGENT, VIEWER |
| `invites[].departmentId` | string | ✅       | Assigned department           |
| `invites[].message`      | string | 🟡       | Personal invite message       |

**User Roles:**

```typescript
enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN", // Platform only
  ADMIN = "ADMIN", // Full tenant access
  MANAGER = "MANAGER", // Department + team
  AGENT = "AGENT", // Execute tasks, use agents
  VIEWER = "VIEWER", // Read-only
}
```

**Permissions Matrix:**
| Permission | ADMIN | MANAGER | AGENT | VIEWER |
|------------|-------|---------|-------|--------|
| Manage users | ✅ | Department | ❌ | ❌ |
| Manage agents | ✅ | Department | ❌ | ❌ |
| Create tasks | ✅ | ✅ | ✅ | ❌ |
| View tasks | ✅ | ✅ | ✅ | ✅ |
| Configure integrations | ✅ | ❌ | ❌ | ❌ |
| View billing | ✅ | ❌ | ❌ | ❌ |
| Export data | ✅ | ✅ | ❌ | ❌ |

**Backend:**

- `POST /api/v1/users/invite/bulk` — Send invitation emails
- Creates pending invitations in DB
- Sends email with magic link
- Invitee completes registration on click

---

### Step 7: Connect Integrations (Optional)

| Integration          | Required Fields                       | Tier Required |
| -------------------- | ------------------------------------- | ------------- |
| **Salesforce**       | instanceUrl, clientId, clientSecret   | Professional+ |
| **HubSpot**          | apiKey, portalId                      | Professional+ |
| **Pipedrive**        | apiToken, companyDomain               | Professional+ |
| **Google Workspace** | clientId, clientSecret                | Enterprise    |
| **Microsoft 365**    | tenantId, clientId, clientSecret      | Enterprise    |
| **Slack**            | botToken, workspaceId                 | Any           |
| **Email (SMTP)**     | host, port, user, password, fromEmail | Any           |

**Integration Object Structure:**

```typescript
interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  credentials: {
    // OAuth fields (encrypted at rest)
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    // API key fields (encrypted at rest)
    apiKey?: string;
    // Manual fields
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    fromEmail?: string;
  };
  settings: {
    enabled: boolean;
    syncFrequency?: "realtime" | "hourly" | "daily";
    webhookUrl?: string;
  };
}

enum IntegrationType {
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
```

**Backend:**

- `POST /api/v1/connectors` — Create integration
- `POST /api/v1/connectors/:id/test` — Test connection
- Credentials encrypted before storage
- Returns connection status

---

### Step 8: Configure Agents (Optional)

| Field                   | Type   | Required | Description              |
| ----------------------- | ------ | -------- | ------------------------ |
| `agents[]`              | array  | 🟡       | Can skip this step       |
| `agents[].templateId`   | string | ✅       | Template from library    |
| `agents[].name`         | string | ✅       | Custom agent name        |
| `agents[].departmentId` | string | ✅       | Assigned department      |
| `agents[].config`       | object | 🟡       | Template-specific config |

**Agent Behavior Levels:**

```typescript
enum AgentAutonomyLevel {
  ASSIST = "ASSIST", // Human approves all actions
  RECOMMEND = "RECOMMEND", // Human reviews recommendations
  EXECUTE = "EXECUTE", // Human reviews completed work
  AUTONOMOUS = "AUTONOMOUS", // Agent acts independently
}
```

**Agent Templates (by Department):**

| Department        | Available Templates                                                |
| ----------------- | ------------------------------------------------------------------ |
| Finance           | Finance Analyst, Financial Risk Analyst, Tax Advisor               |
| Operations        | Supply Chain Specialist, Operations Coordinator, Process Optimizer |
| Risk & Compliance | Audit & Compliance Officer, Risk Analyst, Compliance Monitor       |
| Administration    | Google Workspace Assistant, Email Manager, Calendar Manager        |
| Sales & Marketing | Sales Assistant, Marketing Analyst, Lead Qualifier                 |
| Human Resources   | HR Assistant, Recruitment Agent, Onboarding Coordinator            |
| IT & Engineering  | Code Reviewer, DevOps Assistant, Documentation Writer              |
| Customer Success  | Support Agent, Customer Onboarding Agent, Feedback Analyst         |

**99 Total Platform Templates** — See `backend/prisma/seed-platform-templates.cjs`

**Backend:**

- `POST /api/v1/agents/bulk` — Create agents from templates
- Copies template configuration to new agents
- Sets initial status based on tier limits

---

### Step 9: Security & Compliance

| Field                | Type    | Required | Description             |
| -------------------- | ------- | -------- | ----------------------- |
| `dataResidency`      | enum    | ✅       | US, EU, APAC            |
| `gdprConsent`        | boolean | ✅       | GDPR acknowledgment     |
| `termsAccepted`      | boolean | ✅       | Terms of Service        |
| `privacyAccepted`    | boolean | ✅       | Privacy Policy          |
| `auditRetentionDays` | number  | ✅       | 30, 90, 365             |
| `require2FA`         | boolean | 🟡       | Force 2FA for all users |
| `ipWhitelist[]`      | array   | 🟡       | Allowed IP addresses    |

**Data Residency Options:**

```typescript
enum DataResidency {
  US = "US", // United States
  EU = "EU", // European Union (GDPR compliant)
  APAC = "APAC", // Asia Pacific
}
```

**Backend:**

- `PUT /api/v1/tenants/:id/security` — Update security settings
- Stores consent records with timestamps
- Creates audit log entry for compliance

---

### Step 10: Review & Launch

| Field              | Type    | Required | Description              |
| ------------------ | ------- | -------- | ------------------------ |
| `marketingConsent` | boolean | 🟡       | Marketing communications |
| `referralCode`     | string  | 🟡       | Optional referral code   |
| `launch`           | boolean | ✅       | Confirm and launch       |

**Review Summary Display:**

```
Organization: Acme Corporation
Plan: Professional (Yearly) - $990/year
Users: 5 invited (25 max)
Departments: 3 created
Integrations: 1 connected (Salesforce)
Agents: 2 configured
Data Region: US
Audit Retention: 365 days
```

**Backend:**

- `POST /api/v1/tenants/wizard/complete` — Finalize tenant
- Activates tenant record
- Triggers welcome email sequence
- Creates default dashboard data
- Returns `tenantId` and redirects to `/dashboard`

---

## Database Schema Changes

### New Tables

```prisma
model OnboardingWizard {
  id            String    @id @default(cuid())
  tenantId      String?   @unique
  currentStep   Int       @default(1)
  wizardData    Json      @default("{}")
  completedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tenant        Tenant?   @relation(fields: [tenantId], references: [id])
}

model TenantInvitation {
  id            String    @id @default(cuid())
  tenantId      String
  email         String
  firstName     String
  lastName      String
  role          UserRole
  departmentId  String
  message       String?
  token         String    @unique
  expiresAt     DateTime
  acceptedAt    DateTime?
  createdAt     DateTime  @default(now())

  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  department    Department @relation(fields: [departmentId], references: [id])

  @@unique([tenantId, email])
}

model ConsentRecord {
  id            String    @id @default(cuid())
  tenantId      String
  consentType   String    // 'gdpr', 'terms', 'privacy', 'marketing'
  granted       Boolean
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime  @default(now())

  @@unique([tenantId, consentType])
}
```

### Updated Tables

```prisma
model Tenant {
  // Add new fields
  industry       Industry?
  companySize    CompanySize?
  website        String?
  dataResidency  DataResidency @default(US)
  auditRetention Int           @default(365)
  require2FA     Boolean       @default(false)
  ipWhitelist    String[]      @default([])

  // Add relations
  onboardingWizard OnboardingWizard?
  invitations      TenantInvitation[]
  consentRecords   ConsentRecord[]
}
```

---

## API Endpoints

### Authentication

| Method | Endpoint                | Description                       |
| ------ | ----------------------- | --------------------------------- |
| POST   | `/auth/register-tenant` | Start wizard, create temp account |
| POST   | `/auth/verify-email`    | Verify email with OTP             |
| POST   | `/auth/resend-otp`      | Resend verification OTP           |

### Tenant Setup

| Method | Endpoint                   | Description                 |
| ------ | -------------------------- | --------------------------- |
| PUT    | `/tenants/wizard`          | Update organization details |
| PUT    | `/tenants/:id/security`    | Update security settings    |
| POST   | `/tenants/wizard/complete` | Finalize and launch         |

### User Setup

| Method | Endpoint                     | Description            |
| ------ | ---------------------------- | ---------------------- |
| PUT    | `/users/wizard`              | Update admin profile   |
| POST   | `/users/invite/bulk`         | Send team invitations  |
| GET    | `/invitations/:token`        | Get invitation details |
| POST   | `/invitations/:token/accept` | Accept invitation      |

### Departments

| Method | Endpoint            | Description                 |
| ------ | ------------------- | --------------------------- |
| POST   | `/departments/bulk` | Create multiple departments |

### Billing

| Method | Endpoint                  | Description           |
| ------ | ------------------------- | --------------------- |
| POST   | `/billing/subscribe`      | Create subscription   |
| GET    | `/billing/plans`          | Get available plans   |
| PUT    | `/billing/payment-method` | Update payment method |

### Integrations

| Method | Endpoint               | Description        |
| ------ | ---------------------- | ------------------ |
| POST   | `/connectors`          | Create integration |
| POST   | `/connectors/:id/test` | Test connection    |
| DELETE | `/connectors/:id`      | Remove integration |

### Agents

| Method | Endpoint       | Description                  |
| ------ | -------------- | ---------------------------- |
| POST   | `/agents/bulk` | Create agents from templates |

---

## Frontend Components

```
frontend-tenant/src/app/onboarding/
├── page.tsx                    # Main wizard page
├── components/
│   ├── steps/
│   │   ├── WelcomeStep.tsx
│   │   ├── OrganizationStep.tsx
│   │   ├── AdminStep.tsx
│   │   ├── PlanStep.tsx
│   │   ├── DepartmentsStep.tsx
│   │   ├── TeamStep.tsx
│   │   ├── IntegrationsStep.tsx
│   │   ├── AgentsStep.tsx
│   │   ├── SecurityStep.tsx
│   │   └── ReviewStep.tsx
│   ├── WizardShell.tsx          # Layout with progress
│   ├── StepIndicator.tsx       # Visual progress
│   ├── SkipButton.tsx          # Skip optional steps
│   └── ReviewSummary.tsx      # Final review card
├── hooks/
│   ├── useWizardStore.ts       # Zustand store
│   └── useWizardSubmit.ts      # Submission logic
├── api/
│   └── wizard.ts               # API client functions
└── types/
    └── wizard.ts               # TypeScript types
```

---

## State Management (Zustand)

```typescript
interface WizardState {
  currentStep: number;
  totalSteps: number;
  wizardData: {
    email?: string;
    password?: string;
    company?: {
      name: string;
      slug: string;
      industry: string;
      size: string;
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
      billingCycle: string;
      subscriptionId?: string;
    };
    departments?: Array<{
      name: string;
      parentId?: string;
      managerEmail?: string;
    }>;
    invitations?: Array<{
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      departmentId: string;
    }>;
    integrations?: string[]; // Integration IDs
    agents?: Array<{
      templateId: string;
      name: string;
      departmentId: string;
    }>;
    security?: {
      dataResidency: string;
      gdprConsent: boolean;
      termsAccepted: boolean;
      privacyAccepted: boolean;
      auditRetentionDays: number;
      require2FA?: boolean;
    };
  };

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (data: Partial<WizardState["wizardData"]>) => void;
  resetWizard: () => void;
}
```

---

## Implementation Order

1. **Backend**
   - [ ] Create/update Prisma schema
   - [ ] Add wizard API endpoints
   - [ ] Implement validation logic
   - [ ] Add Stripe integration

2. **Frontend**
   - [ ] Create wizard page layout
   - [ ] Implement each step component
   - [ ] Add Zustand store
   - [ ] Connect to API endpoints
   - [ ] Add progress indicator
   - [ ] Implement review step

3. **Testing**
   - [ ] Unit tests for each step
   - [ ] Integration tests for API
   - [ ] E2E test for full flow

4. **Deployment**
   - [ ] Deploy backend changes
   - [ ] Deploy frontend changes
   - [ ] Update DNS/routes

---

## Files to Create/Modify

### Backend

```
backend/src/modules/
├── onboarding/
│   ├── onboarding.module.ts
│   ├── onboarding.controller.ts
│   ├── onboarding.service.ts
│   ├── dto/
│   │   ├── create-wizard.dto.ts
│   │   ├── update-organization.dto.ts
│   │   ├── update-plan.dto.ts
│   │   ├── create-departments.dto.ts
│   │   ├── invite-users.dto.ts
│   │   ├── add-integration.dto.ts
│   │   ├── configure-agents.dto.ts
│   │   └── complete-wizard.dto.ts
│   └── interfaces/
│       └── wizard-state.interface.ts
```

### Frontend

```
frontend-tenant/src/app/onboarding/
├── page.tsx
├── components/
│   ├── WizardShell.tsx
│   ├── StepIndicator.tsx
│   ├── steps/
│   │   ├── WelcomeStep.tsx
│   │   ├── OrganizationStep.tsx
│   │   ├── AdminStep.tsx
│   │   ├── PlanStep.tsx
│   │   ├── DepartmentsStep.tsx
│   │   ├── TeamStep.tsx
│   │   ├── IntegrationsStep.tsx
│   │   ├── AgentsStep.tsx
│   │   ├── SecurityStep.tsx
│   │   └── ReviewStep.tsx
│   └── shared/
│       ├── FormField.tsx
│       ├── SelectField.tsx
│       └── SkipButton.tsx
├── hooks/
│   ├── useWizardStore.ts
│   └── useWizardSubmit.ts
├── api/
│   └── wizard.ts
└── types/
    └── wizard.ts
```

---

## Success Metrics

| Metric                          | Target       |
| ------------------------------- | ------------ |
| Wizard Completion Rate          | > 70%        |
| Average Time to Complete        | < 10 minutes |
| Support Tickets from Onboarding | < 5%         |
| Successful Integrations         | > 80%        |
| First Login within 24h          | > 60%        |

---

## References

- [SOLID Principles Guide](docs/SOLID_PRINCIPLES_GUIDE.md)
- [Backend Architecture](plans/solid_architecture_complete.md)
- [Prisma Schema](backend/prisma/schema.prisma)
- [Implementation Reference](plans/IMPLEMENTATION-REFERENCE.md)

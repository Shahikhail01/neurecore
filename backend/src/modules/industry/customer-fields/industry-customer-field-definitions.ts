/**
 * Industry Customer Field Definitions
 *
 * Stage 2 Phase 2B: Per-industry structured customer field definitions.
 *
 * Each industry defines its own set of additional fields that extend
 * the base Customer model. These are rendered dynamically in the
 * CustomerForm via the IndustryCustomerFields component.
 *
 * SOLID:
 * - OCP: New industry = add entry to this registry. Zero code changes elsewhere.
 * - ISP: Field definitions are a focused contract. Consumers get typed data.
 */

export type CustomerFieldType =
  | 'string'
  | 'enum'
  | 'date'
  | 'month-day'
  | 'boolean'
  | 'encrypted';

export interface CustomerFieldAppearance {
  section: string;
  order: number;
}

export interface CustomerFieldDef {
  key: string;
  label: string;
  type: CustomerFieldType;
  options?: string[];
  required: boolean;
  placeholder?: string;
  hint?: string;
  appearance?: CustomerFieldAppearance;
}

export interface CustomerFieldSection {
  section: string;
  fields: CustomerFieldDef[];
}

// ─── Registry: Industry Slug → Customer Field Definitions ──────────────────

export const INDUSTRY_CUSTOMER_FIELDS: Record<string, CustomerFieldDef[]> = {
  // ─── Financial & Compliance ────────────────────────────────────────────
  'financial-services': [
    {
      key: 'clientType',
      label: 'Client Type',
      type: 'enum',
      options: ['Individual', 'Small Business', 'Mid-Market', 'Enterprise'],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'amlRiskTier',
      label: 'AML Risk Tier',
      type: 'enum',
      options: ['Low', 'Medium', 'High'],
      required: true,
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'kycStatus',
      label: 'KYC Status',
      type: 'enum',
      options: ['Pending', 'Verified', 'Expired'],
      required: false,
      appearance: { section: 'Compliance', order: 2 },
    },
    {
      key: 'taxId',
      label: 'Tax ID / SSN',
      type: 'encrypted',
      required: false,
      placeholder: 'XXX-XX-XXXX',
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'accountType',
      label: 'Account Type',
      type: 'enum',
      options: ['Checking', 'Savings', 'Investment', 'Loan', 'Credit'],
      required: false,
      appearance: { section: 'Financial', order: 2 },
    },
    {
      key: 'riskScore',
      label: 'Risk Score',
      type: 'string',
      required: false,
      hint: 'Internal risk assessment score (0-100)',
      appearance: { section: 'Classification', order: 2 },
    },
  ],

  'accounting-audit-services': [
    {
      key: 'clientType',
      label: 'Client Type',
      type: 'enum',
      options: ['Individual', 'SME', 'Corporate', 'Non-Profit'],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'serviceType',
      label: 'Service Type',
      type: 'enum',
      options: ['Audit', 'Tax', 'Bookkeeping', 'Advisory', 'Payroll'],
      required: true,
      appearance: { section: 'Engagement', order: 1 },
    },
    {
      key: 'fiscalYearEnd',
      label: 'Fiscal Year End',
      type: 'month-day',
      required: false,
      hint: 'Month and day of fiscal year end (MM-DD)',
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'taxId',
      label: 'Tax ID / EIN',
      type: 'encrypted',
      required: false,
      placeholder: 'XX-XXXXXXX',
      appearance: { section: 'Financial', order: 2 },
    },
    {
      key: 'engagementStatus',
      label: 'Engagement Status',
      type: 'enum',
      options: [
        'Prospect',
        'Proposal Sent',
        'Engaged',
        'Active',
        'Completed',
        'Retained',
      ],
      required: true,
      appearance: { section: 'Engagement', order: 2 },
    },
  ],

  insurance: [
    {
      key: 'policyType',
      label: 'Policy Type',
      type: 'enum',
      options: ['Life', 'Health', 'Property', 'Liability', 'Auto', 'Business'],
      required: false,
      appearance: { section: 'Policy', order: 1 },
    },
    {
      key: 'insuredSince',
      label: 'Insured Since',
      type: 'date',
      required: false,
      appearance: { section: 'Policy', order: 2 },
    },
    {
      key: 'renewalDate',
      label: 'Renewal Date',
      type: 'date',
      required: false,
      appearance: { section: 'Policy', order: 3 },
    },
    {
      key: 'claimsHistory',
      label: 'Claims History',
      type: 'string',
      required: false,
      hint: 'Summary of recent claims (last 3 years)',
      appearance: { section: 'Policy', order: 4 },
    },
  ],

  // ─── Healthcare & Life Sciences ────────────────────────────────────────
  'healthcare-life-sciences': [
    {
      key: 'patientIdPrefix',
      label: 'Patient ID Prefix',
      type: 'string',
      required: false,
      placeholder: 'e.g. P-',
      appearance: { section: 'Clinical', order: 1 },
    },
    {
      key: 'insuranceProvider',
      label: 'Insurance Provider',
      type: 'enum',
      options: [
        'Medicare',
        'Medicaid',
        'Blue Cross',
        'UnitedHealth',
        'Aetna',
        'Cigna',
        'Other',
      ],
      required: false,
      appearance: { section: 'Clinical', order: 2 },
    },
    {
      key: 'hipaaConsent',
      label: 'HIPAA Consent on File',
      type: 'boolean',
      required: true,
      hint: 'Has the patient signed the HIPAA consent form?',
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'primaryPhysician',
      label: 'Primary Physician',
      type: 'string',
      required: false,
      appearance: { section: 'Clinical', order: 3 },
    },
    {
      key: 'medicalRecordNumber',
      label: 'MRN',
      type: 'encrypted',
      required: false,
      placeholder: 'Medical record number',
      appearance: { section: 'Clinical', order: 4 },
    },
    {
      key: 'emergencyContact',
      label: 'Emergency Contact',
      type: 'string',
      required: false,
      hint: 'Name and phone of emergency contact',
      appearance: { section: 'Personal', order: 1 },
    },
  ],

  // ─── Business & Technology ─────────────────────────────────────────────
  'technology-digital-services': [
    {
      key: 'companySize',
      label: 'Company Size',
      type: 'enum',
      options: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'techStack',
      label: 'Technology Stack',
      type: 'string',
      required: false,
      hint: 'Primary technologies used (e.g. React, Python, AWS)',
      appearance: { section: 'Technical', order: 1 },
    },
    {
      key: 'contractType',
      label: 'Contract Type',
      type: 'enum',
      options: ['Hourly', 'Retainer', 'Fixed Fee', 'SaaS Subscription'],
      required: true,
      appearance: { section: 'Engagement', order: 1 },
    },
    {
      key: 'slaTier',
      label: 'SLA Tier',
      type: 'enum',
      options: ['Standard', 'Premium', 'Enterprise', 'Custom'],
      required: false,
      appearance: { section: 'Engagement', order: 2 },
    },
    {
      key: 'dataResidency',
      label: 'Data Residency Requirement',
      type: 'enum',
      options: ['US', 'EU', 'UK', 'Canada', 'Australia', 'Any'],
      required: false,
      hint: 'Where must customer data be stored?',
      appearance: { section: 'Compliance', order: 1 },
    },
  ],

  'professional-business-services': [
    {
      key: 'clientType',
      label: 'Client Type',
      type: 'enum',
      options: ['Startup', 'SMB', 'Mid-Market', 'Enterprise', 'Public Sector'],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'engagementType',
      label: 'Engagement Type',
      type: 'enum',
      options: [
        'Strategy',
        'Implementation',
        'Managed Services',
        'Advisory',
        'Staff Augmentation',
      ],
      required: true,
      appearance: { section: 'Engagement', order: 1 },
    },
    {
      key: 'contractValue',
      label: 'Contract Value (Annual)',
      type: 'string',
      required: false,
      hint: 'Annual recurring revenue or total contract value',
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'renewalDate',
      label: 'Contract Renewal Date',
      type: 'date',
      required: false,
      appearance: { section: 'Engagement', order: 2 },
    },
    {
      key: 'stakeholderCount',
      label: 'Key Stakeholders',
      type: 'string',
      required: false,
      hint: 'Number of key decision-makers',
      appearance: { section: 'Classification', order: 2 },
    },
  ],

  // ─── Consumer & Commerce ───────────────────────────────────────────────
  'retail-commerce-consumer': [
    {
      key: 'storeCount',
      label: 'Store / Location Count',
      type: 'string',
      required: false,
      hint: 'Number of physical locations',
      appearance: { section: 'Operations', order: 1 },
    },
    {
      key: 'salesChannel',
      label: 'Sales Channels',
      type: 'enum',
      options: [
        'Brick & Mortar',
        'E-Commerce',
        'Omnichannel',
        'Wholesale',
        'Marketplace',
      ],
      required: false,
      appearance: { section: 'Operations', order: 2 },
    },
    {
      key: 'averageOrderValue',
      label: 'Average Order Value',
      type: 'string',
      required: false,
      hint: 'Typical customer order value in USD',
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'posSystem',
      label: 'POS System',
      type: 'enum',
      options: [
        'Shopify POS',
        'Square',
        'Clover',
        'Lightspeed',
        'Toast',
        'Custom',
      ],
      required: false,
      appearance: { section: 'Technical', order: 1 },
    },
    {
      key: 'loyaltyProgram',
      label: 'Has Loyalty Program',
      type: 'boolean',
      required: false,
      hint: 'Does the customer run a loyalty or rewards program?',
      appearance: { section: 'Marketing', order: 1 },
    },
  ],

  'media-communications-creative': [
    {
      key: 'clientType',
      label: 'Client Type',
      type: 'enum',
      options: [
        'Brand',
        'Agency',
        'Publisher',
        'Platform',
        'Production Company',
      ],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'projectType',
      label: 'Project Type',
      type: 'enum',
      options: [
        'Campaign',
        'Content Production',
        'Brand Strategy',
        'Media Buying',
        'Creative Retainer',
      ],
      required: false,
      appearance: { section: 'Engagement', order: 1 },
    },
    {
      key: 'campaignBudget',
      label: 'Campaign Budget Range',
      type: 'enum',
      options: ['< $10K', '$10K-$50K', '$50K-$250K', '$250K-$1M', '$1M+'],
      required: false,
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'targetAudience',
      label: 'Target Audience Demographics',
      type: 'string',
      required: false,
      hint: 'Brief description of target audience',
      appearance: { section: 'Marketing', order: 1 },
    },
  ],

  // ─── Industrial & Infrastructure ────────────────────────────────────────
  'manufacturing-industrial': [
    {
      key: 'facilityType',
      label: 'Facility Type',
      type: 'enum',
      options: [
        'Factory',
        'Assembly Plant',
        'Refinery',
        'Processing Unit',
        'Distribution Center',
      ],
      required: false,
      appearance: { section: 'Operations', order: 1 },
    },
    {
      key: 'productionCapacity',
      label: 'Production Capacity',
      type: 'string',
      required: false,
      hint: 'Units per day/month or other capacity metric',
      appearance: { section: 'Operations', order: 2 },
    },
    {
      key: 'isoCertifications',
      label: 'ISO Certifications',
      type: 'string',
      required: false,
      hint: 'e.g. ISO 9001, ISO 14001',
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'safetyRating',
      label: 'Safety Rating',
      type: 'enum',
      options: ['A', 'B', 'C', 'D', 'Not Rated'],
      required: false,
      appearance: { section: 'Compliance', order: 2 },
    },
    {
      key: 'workforceSize',
      label: 'Workforce Size',
      type: 'enum',
      options: ['< 50', '50-200', '200-500', '500-1000', '1000+'],
      required: false,
      appearance: { section: 'Classification', order: 1 },
    },
  ],

  'construction-engineering-infrastructure': [
    {
      key: 'projectCategory',
      label: 'Project Category',
      type: 'enum',
      options: [
        'Residential',
        'Commercial',
        'Industrial',
        'Infrastructure',
        'Renovation',
      ],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'bondingCapacity',
      label: 'Bonding Capacity',
      type: 'string',
      required: false,
      hint: 'Surety bonding limit in USD',
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'licenseNumber',
      label: 'License Number',
      type: 'encrypted',
      required: false,
      placeholder: 'State contractor license number',
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'safetyRecord',
      label: 'Safety Record (EMR)',
      type: 'string',
      required: false,
      hint: 'Experience Modification Rate',
      appearance: { section: 'Compliance', order: 2 },
    },
    {
      key: 'tradeSpecialty',
      label: 'Trade Specialty',
      type: 'string',
      required: false,
      hint: 'Primary trade (e.g. electrical, structural)',
      appearance: { section: 'Classification', order: 2 },
    },
  ],

  'energy-utilities-natural-resources': [
    {
      key: 'facilityType',
      label: 'Facility Type',
      type: 'enum',
      options: [
        'Power Plant',
        'Substation',
        'Pipeline',
        'Extraction Site',
        'Refinery',
        'Wind/Solar Farm',
      ],
      required: false,
      appearance: { section: 'Operations', order: 1 },
    },
    {
      key: 'regulatoryBody',
      label: 'Primary Regulator',
      type: 'enum',
      options: ['FERC', 'NERC', 'EPA', 'BLM', 'State PUC', 'Other'],
      required: false,
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'capacityMW',
      label: 'Capacity (MW)',
      type: 'string',
      required: false,
      hint: 'Installed capacity in megawatts',
      appearance: { section: 'Operations', order: 2 },
    },
    {
      key: 'environmentalPermitExpiry',
      label: 'Environmental Permit Expiry',
      type: 'date',
      required: false,
      appearance: { section: 'Compliance', order: 2 },
    },
  ],

  'logistics-transportation-supply-chain': [
    {
      key: 'fleetSize',
      label: 'Fleet Size',
      type: 'string',
      required: false,
      hint: 'Number of vehicles in fleet',
      appearance: { section: 'Operations', order: 1 },
    },
    {
      key: 'serviceType',
      label: 'Service Type',
      type: 'enum',
      options: [
        'FTL',
        'LTL',
        'Intermodal',
        'Last Mile',
        'Air Freight',
        'Ocean Freight',
      ],
      required: false,
      appearance: { section: 'Operations', order: 2 },
    },
    {
      key: 'coverageArea',
      label: 'Coverage Area',
      type: 'enum',
      options: ['Local', 'Regional', 'National', 'International'],
      required: false,
      appearance: { section: 'Operations', order: 3 },
    },
    {
      key: 'dotNumber',
      label: 'DOT Number',
      type: 'encrypted',
      required: false,
      placeholder: 'USDOT registration number',
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'onTimeRate',
      label: 'On-Time Delivery Rate',
      type: 'string',
      required: false,
      hint: 'Percentage of on-time deliveries',
      appearance: { section: 'Performance', order: 1 },
    },
  ],

  // ─── Public & Social ───────────────────────────────────────────────────
  'government-public-sector': [
    {
      key: 'agencyType',
      label: 'Agency Type',
      type: 'enum',
      options: [
        'Federal',
        'State',
        'County',
        'Municipal',
        'Tribal',
        'Special District',
      ],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'contractNumber',
      label: 'Contract / Grant Number',
      type: 'encrypted',
      required: false,
      placeholder: 'Government contract reference number',
      appearance: { section: 'Engagement', order: 1 },
    },
    {
      key: 'securityClearanceRequired',
      label: 'Security Clearance Required',
      type: 'boolean',
      required: false,
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'appropriationSource',
      label: 'Appropriation Source',
      type: 'string',
      required: false,
      hint: 'Funding source or budget code',
      appearance: { section: 'Financial', order: 1 },
    },
  ],

  'education-research': [
    {
      key: 'institutionType',
      label: 'Institution Type',
      type: 'enum',
      options: [
        'K-12',
        'Community College',
        'University',
        'Research Institute',
        'Online',
      ],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'studentCount',
      label: 'Student / Enrollment Count',
      type: 'string',
      required: false,
      hint: 'Approximate number of students served',
      appearance: { section: 'Classification', order: 2 },
    },
    {
      key: 'accreditationBody',
      label: 'Accreditation Body',
      type: 'string',
      required: false,
      hint: 'Primary accrediting organization',
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'grantSource',
      label: 'Grant Funding Source',
      type: 'string',
      required: false,
      hint: 'Primary grant or funding source',
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'irbApprovalRequired',
      label: 'IRB Approval Required',
      type: 'boolean',
      required: false,
      hint: 'Institutional Review Board approval needed for research',
      appearance: { section: 'Compliance', order: 2 },
    },
  ],

  'nonprofit-international': [
    {
      key: 'organizationType',
      label: 'Organization Type',
      type: 'enum',
      options: [
        '501(c)(3)',
        'Foundation',
        'INGO',
        'Advocacy Group',
        'Religious',
        'Other',
      ],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'taxExemptId',
      label: 'Tax Exempt ID',
      type: 'encrypted',
      required: false,
      placeholder: 'EIN or equivalent',
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'donorCount',
      label: 'Active Donor Count',
      type: 'string',
      required: false,
      hint: 'Number of active donors',
      appearance: { section: 'Classification', order: 2 },
    },
    {
      key: 'annualBudget',
      label: 'Annual Operating Budget',
      type: 'string',
      required: false,
      hint: 'Approximate annual budget in USD',
      appearance: { section: 'Financial', order: 2 },
    },
    {
      key: 'volunteerBase',
      label: 'Volunteer Base Size',
      type: 'string',
      required: false,
      hint: 'Approximate number of active volunteers',
      appearance: { section: 'Operations', order: 1 },
    },
  ],

  // ─── Agriculture & Food ────────────────────────────────────────────────
  'agriculture-food-systems': [
    {
      key: 'operationType',
      label: 'Operation Type',
      type: 'enum',
      options: [
        'Crop Farm',
        'Livestock',
        'Dairy',
        'Poultry',
        'Fishery',
        'Mixed',
        'Food Processing',
      ],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'acreage',
      label: 'Acreage / Farm Size',
      type: 'string',
      required: false,
      hint: 'Total acres under management',
      appearance: { section: 'Operations', order: 1 },
    },
    {
      key: 'organicCertified',
      label: 'USDA Organic Certified',
      type: 'boolean',
      required: false,
      appearance: { section: 'Compliance', order: 1 },
    },
    {
      key: 'primaryCrops',
      label: 'Primary Crops / Products',
      type: 'string',
      required: false,
      hint: 'Comma-separated list of main products',
      appearance: { section: 'Operations', order: 2 },
    },
    {
      key: 'waterSource',
      label: 'Water Source',
      type: 'enum',
      options: [
        'Well',
        'Municipal',
        'Surface Water',
        'Irrigation District',
        'Rain-Fed',
      ],
      required: false,
      appearance: { section: 'Operations', order: 3 },
    },
  ],

  // ─── Other ──────────────────────────────────────────────────────────────
  'special-purpose-organizations': [
    {
      key: 'entityType',
      label: 'Entity Type',
      type: 'enum',
      options: [
        'Family Office',
        'Holding Company',
        'Conglomerate',
        'Investment Vehicle',
        'Trust',
        'Other',
      ],
      required: true,
      appearance: { section: 'Classification', order: 1 },
    },
    {
      key: 'assetsUnderManagement',
      label: 'Assets Under Management',
      type: 'string',
      required: false,
      hint: 'Approximate AUM in USD',
      appearance: { section: 'Financial', order: 1 },
    },
    {
      key: 'jurisdiction',
      label: 'Primary Jurisdiction',
      type: 'string',
      required: false,
      hint: 'Country or state of incorporation',
      appearance: { section: 'Classification', order: 2 },
    },
    {
      key: 'boardSize',
      label: 'Board Size',
      type: 'string',
      required: false,
      hint: 'Number of board members',
      appearance: { section: 'Governance', order: 1 },
    },
  ],
};

export function getCustomerFieldDefs(
  industrySlug: string,
): CustomerFieldDef[] | null {
  return INDUSTRY_CUSTOMER_FIELDS[industrySlug] ?? null;
}

export function getCustomerFieldSections(
  industrySlug: string,
): CustomerFieldSection[] {
  const defs = getCustomerFieldDefs(industrySlug);
  if (!defs) return [];

  const sectionMap = new Map<string, CustomerFieldDef[]>();

  for (const def of defs) {
    const section = def.appearance?.section ?? 'General';
    if (!sectionMap.has(section)) {
      sectionMap.set(section, []);
    }
    sectionMap.get(section)!.push(def);
  }

  return [...sectionMap.entries()]
    .map(([section, fields]) => ({
      section,
      fields: fields.sort(
        (a, b) => (a.appearance?.order ?? 0) - (b.appearance?.order ?? 0),
      ),
    }))
    .sort((a, b) => {
      const aMin = Math.min(...a.fields.map((f) => f.appearance?.order ?? 0));
      const bMin = Math.min(...b.fields.map((f) => f.appearance?.order ?? 0));
      return aMin - bMin;
    });
}

export function getAllIndustrySlugsWithFields(): string[] {
  return Object.keys(INDUSTRY_CUSTOMER_FIELDS);
}

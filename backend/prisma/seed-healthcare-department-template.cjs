#!/usr/bin/env node
/**
 * seed-healthcare-department-template.cjs
 *
 * D21 / D22 fix: Seed a healthcare-specific department template
 * (Healthcare Clinic) so tenants in `healthcare-life-sciences` industry
 * can deploy departments + agents during onboarding.
 *
 * Idempotent: uses upsert on slug.
 *
 * Run: node prisma/seed-healthcare-department-template.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATE = {
  slug: 'healthcare-clinic',
  name: 'Healthcare Clinic',
  description:
    'Department template for a healthcare clinic: clinical operations, nursing, pharmacy, laboratory, patient services, and billing departments with 8 AI employees.',
  category: 'healthcare',
  tags: ['healthcare', 'industry:healthcare', 'healthcare-life-sciences', 'clinic'],
  isPublic: true,
  structure: [
    {
      name: 'Clinical Operations Coordinator',
      type: 'CORE',
      description:
        'Manages appointment scheduling, patient communications, insurance verification, care coordination, and clinical workflows for a healthcare practice. Ensures patients are scheduled appropriately, insurance eligibility is verified, referrals are coordinated, and confidentiality is maintained per HIPAA.',
    },
    {
      name: 'Nurse Practitioner',
      type: 'CORE',
      description:
        'Supports patient triage, vitals documentation, medication reconciliation, patient education, and care plan execution. Coordinates with physicians and specialists while maintaining clinical documentation standards.',
    },
    {
      name: 'Medical Records Clerk',
      type: 'CORE',
      description:
        'Manages patient records: document filing, attachment organization, release requests, lab results, imaging, and records maintenance per HIPAA. Ensures accuracy, completeness, and timely processing of record requests.',
    },
    {
      name: 'Pharmacy Manager',
      type: 'CORE',
      description:
        'Oversees prescription processing, drug interaction checks, formulary management, patient medication counselling, and pharmacy inventory. Ensures compliance with state pharmacy regulations and controlled substance handling.',
    },
    {
      name: 'Lab Technician',
      type: 'CORE',
      description:
        'Handles specimen processing, test result ingestion, abnormality flagging, and physician notification. Maintains lab equipment calibration and tracks pending results for timely follow-up.',
    },
    {
      name: 'Patient Advocate',
      type: 'FUNCTIONAL',
      description:
        'Advocates for patients: insurance appeals, patient education, follow-up calls, satisfaction surveys, and care coordination. Maintains empathy, professionalism, and helps patients navigate complex healthcare systems.',
    },
    {
      name: 'Billing Specialist (Healthcare)',
      type: 'FUNCTIONAL',
      description:
        'Manages insurance coding, claim submission, payment tracking, denial management, and A/R follow-up. Codes encounters accurately, submits clean claims, tracks payments, and appeals denials.',
    },
    {
      name: 'Practice Manager',
      type: 'EXECUTIVE',
      description:
        'Oversees clinic operations: staff scheduling, budget management, vendor relations, compliance oversight, and strategic planning. Ensures smooth daily operations and drives continuous improvement.',
    },
  ],
};

async function seed() {
  const existing = await prisma.departmentTemplate.findUnique({
    where: { slug: TEMPLATE.slug },
  });

  if (existing) {
    await prisma.departmentTemplate.update({
      where: { id: existing.id },
      data: {
        name: TEMPLATE.name,
        description: TEMPLATE.description,
        category: TEMPLATE.category,
        tags: TEMPLATE.tags,
        structure: TEMPLATE.structure,
        isPublic: TEMPLATE.isPublic,
      },
    });
    console.log(`UPDATED  healthcare-clinic (id=${existing.id})`);
  } else {
    const created = await prisma.departmentTemplate.create({
      data: {
        slug: TEMPLATE.slug,
        name: TEMPLATE.name,
        description: TEMPLATE.description,
        category: TEMPLATE.category,
        tags: TEMPLATE.tags,
        structure: TEMPLATE.structure,
        isPublic: TEMPLATE.isPublic,
      },
    });
    console.log(`CREATED  healthcare-clinic (id=${created.id})`);
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

#!/usr/bin/env node
/**
 * seed-healthcare-agent-templates.cjs
 *
 * D29 fix: Seed healthcare-specific AgentTemplate rows and add them
 * to the Professional tier's TierAgentPool so the new healthcare
 * tenants get agents provisioned at onboarding.
 *
 * Idempotent: uses upsert on AgentTemplate.slug and TierAgentPool.
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

const AGENTS = [
  {
    slug: 'healthcare-clinical-operations-coordinator',
    name: 'Clinical Operations Coordinator',
    type: 'CORE',
    role: 'Coordinator',
    description:
      'Manages appointment scheduling, patient communications, insurance verification, care coordination, and clinical workflows for a healthcare practice.',
    systemPrompt:
      'You are a Clinical Operations Coordinator for a healthcare practice. Your role: appointment scheduling, patient communications, insurance verification, care coordination. Ensure patients are scheduled appropriately, insurance eligibility is verified, referrals are coordinated, and confidentiality is maintained per HIPAA.',
  },
  {
    slug: 'healthcare-nurse-practitioner',
    name: 'Nurse Practitioner',
    type: 'CORE',
    role: 'Nurse',
    description:
      'Supports patient triage, vitals documentation, medication reconciliation, patient education, and care plan execution.',
    systemPrompt:
      'You are a Nurse Practitioner supporting a healthcare practice. Your role: patient triage, vitals documentation, medication reconciliation, patient education, care plan execution. Coordinate with physicians and specialists while maintaining clinical documentation standards.',
  },
  {
    slug: 'healthcare-medical-records-clerk',
    name: 'Medical Records Clerk',
    type: 'CORE',
    role: 'Records',
    description:
      'Manages patient records: document filing, attachment organization, release requests, lab results, imaging, and records maintenance per HIPAA.',
    systemPrompt:
      'You are a Medical Records Clerk for a healthcare practice. Your role: document filing, attachment organization, release requests, records maintenance. Maintain accurate and complete patient records. Process release requests per HIPAA. Organize lab results and imaging.',
  },
  {
    slug: 'healthcare-pharmacy-manager',
    name: 'Pharmacy Manager',
    type: 'CORE',
    role: 'Pharmacy',
    description:
      'Oversees prescription processing, drug interaction checks, formulary management, patient medication counselling, and pharmacy inventory.',
    systemPrompt:
      'You are a Pharmacy Manager for a healthcare practice. Your role: prescription processing, drug interaction checks, formulary management, patient medication counselling, pharmacy inventory. Ensure compliance with state pharmacy regulations and controlled substance handling.',
  },
  {
    slug: 'healthcare-lab-technician',
    name: 'Lab Technician',
    type: 'CORE',
    role: 'Lab',
    description:
      'Handles specimen processing, test result ingestion, abnormality flagging, and physician notification.',
    systemPrompt:
      'You are a Lab Technician for a healthcare practice. Your role: specimen processing, test result ingestion, abnormality flagging, physician notification. Maintain lab equipment calibration and track pending results for timely follow-up.',
  },
  {
    slug: 'healthcare-patient-advocate',
    name: 'Patient Advocate',
    type: 'FUNCTIONAL',
    role: 'Advocate',
    description:
      'Advocates for patients: insurance appeals, patient education, follow-up calls, satisfaction surveys, and care coordination.',
    systemPrompt:
      'You are a Patient Advocate for a healthcare practice. Your role: insurance appeals, patient education, follow-up calls, satisfaction surveys, care coordination. Maintain empathy, professionalism, and help patients navigate complex healthcare systems.',
  },
  {
    slug: 'healthcare-billing-specialist',
    name: 'Billing Specialist (Healthcare)',
    type: 'FUNCTIONAL',
    role: 'Billing',
    description:
      'Manages insurance coding, claim submission, payment tracking, denial management, and A/R follow-up.',
    systemPrompt:
      'You are a Billing Specialist for a healthcare practice. Your role: insurance coding, claim submission, payment tracking, denial management, A/R follow-up. Code encounters accurately, submit clean claims, track payments, and appeal denials.',
  },
  {
    slug: 'healthcare-practice-manager',
    name: 'Practice Manager',
    type: 'EXECUTIVE',
    role: 'Manager',
    description:
      'Oversees clinic operations: staff scheduling, budget management, vendor relations, compliance oversight, and strategic planning.',
    systemPrompt:
      'You are a Practice Manager for a healthcare practice. Your role: staff scheduling, budget management, vendor relations, compliance oversight, strategic planning. Ensure smooth daily operations and drive continuous improvement.',
  },
];

async function seed() {
  // 1. Upsert AgentTemplate rows by name (natural key — AgentTemplate has no slug)
  const tmplIds = [];
  for (const a of AGENTS) {
    let tmpl = await prisma.agentTemplate.findFirst({ where: { name: a.name } });
    if (tmpl) {
      tmpl = await prisma.agentTemplate.update({
        where: { id: tmpl.id },
        data: {
          type: a.type,
          description: a.description,
          systemPrompt: a.systemPrompt,
        },
      });
      console.log(`UPDATE  AgentTemplate ${a.name} (id=${tmpl.id})`);
    } else {
      tmpl = await prisma.agentTemplate.create({
        data: {
          name: a.name,
          type: a.type,
          description: a.description,
          systemPrompt: a.systemPrompt,
          version: '1.0.0',
          enabled: true,
        },
      });
      console.log(`CREATE  AgentTemplate ${a.name} (id=${tmpl.id})`);
    }
    tmplIds.push({ id: tmpl.id, name: tmpl.name, type: tmpl.type });
  }

  // 2. Add to Professional tier's TierAgentPool
  const proTier = await prisma.tier.findUnique({ where: { slug: 'professional' } });
  if (!proTier) {
    console.error('Professional tier not found; aborting TierAgentPool seeding');
    return;
  }
  let slot = 1;
  for (const t of tmplIds) {
    const existing = await prisma.tierAgentPool.findFirst({
      where: { tierId: proTier.id, templateId: t.id },
    });
    if (existing) {
      console.log(`SKIP    TierAgentPool ${t.name} (exists)`);
      continue;
    }
    await prisma.tierAgentPool.create({
      data: {
        tierId: proTier.id,
        templateId: t.id,
        slot: slot++,
        isDefaultSelected: true,
        isRequired: false,
      },
    });
    console.log(`CREATE  TierAgentPool ${t.name} (slot=${slot - 1})`);
  }

  // 3. Backfill: instantiate these 8 agents for the existing
  //    ReVerify Community Health Alliance tenant so the dashboard
  //    shows non-zero counts. Distribute via round-robin to the
  //    existing 8 departments.
  const hcTenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'ReVerify Community Health' } },
  });
  if (hcTenant) {
    const depts = await prisma.department.findMany({ where: { tenantId: hcTenant.id } });
    if (depts.length === tmplIds.length) {
      // Map agent type to a department (by simple ordering)
      const existingAgents = await prisma.agent.count({ where: { tenantId: hcTenant.id } });
      if (existingAgents === 0) {
        for (let i = 0; i < tmplIds.length; i++) {
          const tmpl = await prisma.agentTemplate.findUnique({ where: { id: tmplIds[i].id } });
          const dept = depts[i];
          const poolEntry = await prisma.tierAgentPool.findFirst({
            where: { tierId: proTier.id, templateId: tmpl.id },
          });
          await prisma.agent.create({
            data: {
              tenantId: hcTenant.id,
              name: tmpl.name,
              type: tmpl.type,
              model: 'gpt-4o-mini',
              systemPrompt: tmpl.systemPrompt,
              permissions: [],
              config: {},
              templateId: tmpl.id,
              templateVersion: tmpl.version,
              tierAgentPoolId: poolEntry?.id,
              departmentId: dept.id,
              isSelected: true,
              isActive: true,
            },
          });
          console.log(`BACKFILL  Agent ${tmpl.name} → dept ${dept.name}`);
        }
      } else {
        console.log(`SKIP backfill: tenant already has ${existingAgents} agents`);
      }
    } else {
      console.log(`SKIP backfill: tenant has ${depts.length} depts, need ${tmplIds.length}`);
    }
  } else {
    console.log('No ReVerify Community Health Alliance tenant found for backfill');
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

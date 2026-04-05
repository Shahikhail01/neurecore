/**
 * seed-comprehensive-demo.mjs
 *
 * Comprehensive demo data seed for the demo@marketing tenant.
 * Seeds: new agents, cost records, budget policies, goals, projects,
 *        SSO config, knowledge documents, budget incidents, notifications, routines.
 *
 * Usage:  node seed-comprehensive-demo.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = '4109424f-59fa-463a-8f5e-52299fcf47f0';

const DEPT = {
  MARKETING: `${TENANT_ID}-marketing`,
  EXECUTIVE: `${TENANT_ID}-executive`,
  RESEARCH: `${TENANT_ID}-research`,
  SALES: `${TENANT_ID}-sales`,
  OPERATIONS: `${TENANT_ID}-operations`,
};

function log(icon, msg) {
  console.log(`  ${icon}  ${msg}`);
}
function sep(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ─── Helper: random date within last N days ───────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function hoursAgo(h) {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d;
}

// ─── 1. NEW AGENTS ───────────────────────────────────────────────────────────
async function seedAgents() {
  sep('STEP 1: New Agents');

  const agentDefs = [
    {
      id: `${TENANT_ID}-email-specialist`,
      name: 'Email Marketing Specialist',
      description:
        'Designs and executes email marketing campaigns, manages subscriber lists, and tracks email KPIs.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.MARKETING,
      model: 'gpt-4o-mini',
      systemPrompt:
        'You are an Email Marketing Specialist at a growth marketing agency. You design high-converting email campaigns, manage subscriber segmentation, A/B test subject lines, and analyze open rates and click-through rates.',
      permissions:
        '["send_email","read_email","crm","spreadsheet","document_summary","template_engine","analytics_dashboard"]',
    },
    {
      id: `${TENANT_ID}-seo-analyst`,
      name: 'SEO & Content Analyst',
      description:
        'Conducts keyword research, optimizes content for search, and monitors organic traffic.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.MARKETING,
      model: 'gpt-4o-mini',
      systemPrompt:
        'You are an SEO & Content Analyst at a growth marketing agency. You perform keyword research, conduct technical SEO audits, optimize content for search engines, and track organic ranking performance.',
      permissions:
        '["web_search","document_summary","spreadsheet","seo_tools","report_builder","analytics_dashboard"]',
    },
    {
      id: `${TENANT_ID}-campaign-manager`,
      name: 'Campaign Manager',
      description:
        'Oversees multi-channel campaign execution, coordinates budgets and timelines across teams.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.MARKETING,
      model: 'gpt-4o',
      systemPrompt:
        'You are a Campaign Manager at a growth marketing agency. You coordinate and execute integrated marketing campaigns across digital channels, manage budgets, timelines, and stakeholder communication.',
      permissions:
        '["crm","calendar","spreadsheet","email_send","template_engine","ad_optimization","budget_tracking"]',
    },
    {
      id: `${TENANT_ID}-performance-analyst`,
      name: 'Performance Analyst',
      description:
        'Analyzes ad performance, ROAS, CAC, and LTV metrics across all paid channels.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.RESEARCH,
      model: 'gpt-4o-mini',
      systemPrompt:
        'You are a Performance Analyst at a growth marketing agency. You analyze paid advertising performance metrics including ROAS, CPC, CPM, CAC, and LTV across Google Ads, Meta Ads, LinkedIn, and TikTok.',
      permissions:
        '["web_search","spreadsheet","document_summary","analytics_dashboard","report_builder","database_query"]',
    },
    {
      id: `${TENANT_ID}-client-relations`,
      name: 'Client Relations AI',
      description:
        'Handles client communication, schedules reviews, and maintains CRM records.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.SALES,
      model: 'gpt-4o-mini',
      systemPrompt:
        'You are a Client Relations AI at a growth marketing agency. You manage client communication, schedule quarterly business reviews, ensure client satisfaction, and maintain accurate CRM records for all accounts.',
      permissions:
        '["email_send","crm","calendar","document_summary","task_management","report_builder"]',
    },
    {
      id: `${TENANT_ID}-budget-controller`,
      name: 'Budget Controller',
      description:
        'Tracks ad spend, monitors budget pacing, and generates spend forecasts.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.OPERATIONS,
      model: 'gpt-4o-mini',
      systemPrompt:
        'You are a Budget Controller at a growth marketing agency. You track advertising spend against allocated budgets, monitor daily pacing, flag overspend risks, and generate weekly and monthly spend forecasts.',
      permissions:
        '["spreadsheet","document_summary","analytics_dashboard","budget_tracking","report_builder","email_send"]',
    },
    {
      id: `${TENANT_ID}-lead-gen-bot`,
      name: 'Lead Generation Bot',
      description:
        'Researches and qualifies prospects, enriches lead data, and populates the sales pipeline.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.SALES,
      model: 'gpt-4o-mini',
      systemPrompt:
        'You are a Lead Generation Bot at a growth marketing agency. You research and identify qualified prospects using web scraping and LinkedIn, enrich lead data with firmographic information, score leads based on ICP criteria, and populate the CRM pipeline.',
      permissions:
        '["web_search","crm","email_send","spreadsheet","document_summary","database_query"]',
    },
    {
      id: `${TENANT_ID}-brand-strategist`,
      name: 'Brand Strategist',
      description:
        'Develops brand positioning, messaging frameworks, and competitive analysis.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.MARKETING,
      model: 'gpt-4o',
      systemPrompt:
        'You are a Brand Strategist at a growth marketing agency. You develop brand positioning frameworks, craft messaging hierarchies, conduct competitive landscape analysis, and define brand voice and tone guidelines for clients.',
      permissions:
        '["web_search","document_summary","template_engine","spreadsheet","report_builder","analytics_dashboard"]',
    },
    {
      id: `${TENANT_ID}-outreach-specialist`,
      name: 'Outreach Specialist',
      description:
        'Manages cold outreach sequences, partnership emails, and influencer communications.',
      type: 'FUNCTIONAL',
      departmentId: DEPT.SALES,
      model: 'gpt-4o-mini',
      systemPrompt:
        'You are an Outreach Specialist at a growth marketing agency. You craft personalized cold outreach emails, manage multi-step drip sequences, coordinate partnership inquiries, and handle influencer collaboration communications.',
      permissions:
        '["email_send","crm","calendar","template_engine","web_search","spreadsheet"]',
    },
    {
      id: `${TENANT_ID}-ai-ops-engineer`,
      name: 'AI Ops Engineer',
      description:
        'Monitors agent performance, manages LLM costs, and optimises AI workflows.',
      type: 'META',
      departmentId: DEPT.OPERATIONS,
      model: 'gpt-4o',
      systemPrompt:
        "You are an AI Operations Engineer at a growth marketing agency. You monitor AI agent performance, track LLM costs and efficiency, identify workflow bottlenecks, and continuously optimise the agency's AI infrastructure.",
      permissions:
        '["analytics_dashboard","spreadsheet","document_summary","task_management","workflow_engine","report_builder"]',
    },
  ];

  let created = 0,
    skipped = 0;
  for (const def of agentDefs) {
    const exists = await prisma.agent.findUnique({ where: { id: def.id } });
    if (exists) {
      skipped++;
      continue;
    }

    await prisma.agent.create({
      data: {
        id: def.id,
        name: def.name,
        description: def.description,
        type: def.type,
        status: 'IDLE',
        model: def.model,
        systemPrompt: def.systemPrompt,
        permissions: def.permissions,
        isActive: true,
        isSelected: true,
        deploymentMode: 'PRODUCTION',
        tenantId: TENANT_ID,
        departmentId: def.departmentId,
        config: {},
        metadata: {},
      },
    });
    created++;
    log('🤖', `Created: ${def.name}`);
  }
  log('✅', `Agents: ${created} created, ${skipped} already existed`);
  return agentDefs.map((d) => d.id);
}

// ─── 2. COST RECORDS ──────────────────────────────────────────────────────────
async function seedCostRecords(agentIds) {
  sep('STEP 2: Cost Records');

  const existing = await prisma.costRecord.count({
    where: { tenantId: TENANT_ID },
  });
  if (existing >= 20) {
    log('⏭️ ', `Already have ${existing} cost records, skipping`);
    return;
  }

  const allAgentIds = [
    `${TENANT_ID}-ceo-agent`,
    `${TENANT_ID}-marketing-director`,
    `${TENANT_ID}-social-media-manager`,
    `${TENANT_ID}-content-creator`,
    `${TENANT_ID}-data-analyst`,
    `${TENANT_ID}-research-analyst`,
    `${TENANT_ID}-sales-manager`,
    `${TENANT_ID}-account-manager`,
    `${TENANT_ID}-operations-manager`,
    `${TENANT_ID}-campaign-manager`,
    `${TENANT_ID}-email-specialist`,
    `${TENANT_ID}-performance-analyst`,
    `${TENANT_ID}-lead-gen-bot`,
    `${TENANT_ID}-brand-strategist`,
  ];

  const allDeptIds = [
    DEPT.MARKETING,
    DEPT.EXECUTIVE,
    DEPT.RESEARCH,
    DEPT.SALES,
    DEPT.OPERATIONS,
  ];

  const costConfigs = [
    // OpenAI GPT-4o
    {
      provider: 'OPENAI',
      model: 'gpt-4o',
      inputRate: 0.005,
      outputRate: 0.015,
    },
    // OpenAI GPT-4o-mini
    {
      provider: 'OPENAI',
      model: 'gpt-4o-mini',
      inputRate: 0.00015,
      outputRate: 0.0006,
    },
    // Anthropic Claude Sonnet
    {
      provider: 'ANTHROPIC',
      model: 'claude-3-5-sonnet-20241022',
      inputRate: 0.003,
      outputRate: 0.015,
    },
    // DeepSeek
    {
      provider: 'DEEPSEEK',
      model: 'deepseek-chat',
      inputRate: 0.00027,
      outputRate: 0.0011,
    },
    // Minimax
    {
      provider: 'MINIMAX',
      model: 'abab6.5s-chat',
      inputRate: 0.0001,
      outputRate: 0.0001,
    },
  ];

  const records = [];

  // 30 records spanning the last 30 days, various agents/depts/models
  for (let i = 0; i < 30; i++) {
    const daysBack = Math.floor(Math.random() * 30);
    const windowStart = daysAgo(daysBack);
    const windowEnd = new Date(windowStart.getTime() + 3600_000); // +1 hour

    const cc = costConfigs[i % costConfigs.length];
    const inputTokens = 500 + Math.floor(Math.random() * 3000);
    const outputTokens = 200 + Math.floor(Math.random() * 1500);
    // costCents in cents (divide rate per 1000 tokens * tokens * 100 for cents)
    const costCents = (
      (inputTokens / 1000) * cc.inputRate * 100 +
      (outputTokens / 1000) * cc.outputRate * 100
    ).toFixed(4);

    const agentId = allAgentIds[i % allAgentIds.length];
    const departmentId = allDeptIds[i % allDeptIds.length];

    records.push({
      tenantId: TENANT_ID,
      agentId,
      departmentId,
      provider: cc.provider,
      model: cc.model,
      inputTokens,
      outputTokens,
      costCents,
      windowStart,
      windowEnd,
    });
  }

  await prisma.costRecord.createMany({ data: records });
  log('✅', `Created ${records.length} cost records`);
}

// ─── 3. BUDGET POLICIES ───────────────────────────────────────────────────────
async function seedBudgetPolicies() {
  sep('STEP 3: Budget Policies');

  // Compute next reset dates
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const nextMonday = new Date();
  nextMonday.setDate(
    nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7) || 7,
  );
  nextMonday.setHours(0, 0, 0, 0);

  const policies = [
    {
      name: 'Monthly Platform Budget',
      limitCents: 50000, // $500/month
      period: 'MONTHLY',
      scope: 'TENANT',
      alertThresholds: [50, 75, 90],
      action: 'ALERT',
      tenantId: TENANT_ID,
      agentId: null,
      departmentId: null,
      resetAt: nextMonth,
    },
    {
      name: 'Marketing Dept Monthly Budget',
      limitCents: 20000, // $200/month
      period: 'MONTHLY',
      scope: 'DEPARTMENT',
      alertThresholds: [60, 80, 95],
      action: 'ALERT',
      tenantId: TENANT_ID,
      agentId: null,
      departmentId: DEPT.MARKETING,
      resetAt: nextMonth,
    },
    {
      name: 'Research Dept Monthly Budget',
      limitCents: 10000, // $100/month
      period: 'MONTHLY',
      scope: 'DEPARTMENT',
      alertThresholds: [70, 90],
      action: 'DEGRADE',
      tenantId: TENANT_ID,
      agentId: null,
      departmentId: DEPT.RESEARCH,
      resetAt: nextMonth,
    },
    {
      name: 'CEO Agent Daily Budget',
      limitCents: 500, // $5/day
      period: 'DAILY',
      scope: 'AGENT',
      alertThresholds: [80],
      action: 'BLOCK',
      tenantId: TENANT_ID,
      agentId: `${TENANT_ID}-ceo-agent`,
      departmentId: null,
      resetAt: tomorrow,
    },
    {
      name: 'Weekly Analytics Budget',
      limitCents: 5000, // $50/week
      period: 'WEEKLY',
      scope: 'DEPARTMENT',
      alertThresholds: [75, 95],
      action: 'ALERT',
      tenantId: TENANT_ID,
      agentId: null,
      departmentId: DEPT.RESEARCH,
      resetAt: nextMonday,
    },
  ];

  let created = 0;
  for (const pol of policies) {
    const exists = await prisma.budgetPolicy.findFirst({
      where: { tenantId: TENANT_ID, name: pol.name },
    });
    if (exists) continue;

    await prisma.budgetPolicy.create({ data: pol });
    created++;
    log('💰', `Created policy: ${pol.name}`);
  }
  log('✅', `Budget policies: ${created} created`);

  // Also create budget incidents (require a real policyId)
  const mktPolicy = await prisma.budgetPolicy.findFirst({
    where: { tenantId: TENANT_ID, name: 'Marketing Dept Monthly Budget' },
  });
  const resPolicy = await prisma.budgetPolicy.findFirst({
    where: { tenantId: TENANT_ID, name: 'Research Dept Monthly Budget' },
  });

  const incidentDefs = [
    mktPolicy && {
      budgetPolicyId: mktPolicy.id,
      threshold: 94,
      totalCents: 18750,
      status: 'ACTIVE',
    },
    resPolicy && {
      budgetPolicyId: resPolicy.id,
      threshold: 102,
      totalCents: 10200,
      status: 'RESOLVED',
      resolvedAt: daysAgo(12),
    },
  ].filter(Boolean);

  for (const inc of incidentDefs) {
    const exists = await prisma.budgetIncident.findFirst({
      where: { budgetPolicyId: inc.budgetPolicyId, status: inc.status },
    });
    if (!exists) {
      await prisma.budgetIncident.create({ data: inc });
      log('⚠️ ', `Created budget incident (${inc.status})`);
    }
  }
}

// ─── 4. GOALS ─────────────────────────────────────────────────────────────────
async function seedGoals() {
  sep('STEP 4: Goals');

  const existing = await prisma.goal.count({ where: { tenantId: TENANT_ID } });
  if (existing >= 5) {
    log('⏭️ ', `Already have ${existing} goals, skipping`);
    const goals = await prisma.goal.findMany({
      where: { tenantId: TENANT_ID },
      select: { id: true, title: true },
    });
    return Object.fromEntries(goals.map((g) => [g.title, g.id]));
  }

  const ceoId = `${TENANT_ID}-ceo-agent`;
  const directorId = `${TENANT_ID}-marketing-director`;
  const salesId = `${TENANT_ID}-sales-manager`;
  const researchId = `${TENANT_ID}-research-analyst`;
  const socialId = `${TENANT_ID}-social-media-manager`;
  const emailId = `${TENANT_ID}-email-specialist`;
  const campaignId = `${TENANT_ID}-campaign-manager`;
  const seoId = `${TENANT_ID}-seo-analyst`;
  const perfId = `${TENANT_ID}-performance-analyst`;
  const leadId = `${TENANT_ID}-lead-gen-bot`;

  // Company-level goals first
  const companyGoal1 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Grow Agency Revenue 40% in Q2 2026',
      description:
        'Drive 40% quarter-over-quarter revenue growth by expanding client roster, upselling existing accounts, and launching new service packages.',
      level: 'COMPANY',
      status: 'ACTIVE',
      progress: 18,
      ownerAgentId: ceoId,
      departmentId: DEPT.EXECUTIVE,
      targetDate: new Date('2026-06-30'),
    },
  });
  log('🎯', `Goal: ${companyGoal1.title}`);

  const companyGoal2 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Achieve AI Maturity Score of 75 by Q3 2026',
      description:
        "Elevate the agency's AI adoption maturity from Beginner (20) to Advanced (75+) by deploying all AI agents, integrating Google Workspace, and automating 80% of repetitive workflows.",
      level: 'COMPANY',
      status: 'ACTIVE',
      progress: 26,
      ownerAgentId: ceoId,
      departmentId: DEPT.EXECUTIVE,
      targetDate: new Date('2026-09-30'),
    },
  });
  log('🎯', `Goal: ${companyGoal2.title}`);

  // Department-level goals
  const deptGoal1 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Launch 6 Major Client Campaigns in Q2',
      description:
        'Execute at least 6 full-funnel integrated campaigns for key accounts across paid social, SEM, email, and content channels.',
      level: 'DEPARTMENT',
      status: 'ACTIVE',
      progress: 33,
      parentId: companyGoal1.id,
      ownerAgentId: directorId,
      departmentId: DEPT.MARKETING,
      targetDate: new Date('2026-06-30'),
    },
  });
  log('🎯', `Goal: ${deptGoal1.title}`);

  const deptGoal2 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Generate 300 Qualified Leads for Sales Pipeline',
      description:
        'Fill the sales pipeline with 300 MQLs through inbound content, outbound prospecting, and partner referrals.',
      level: 'DEPARTMENT',
      status: 'ACTIVE',
      progress: 42,
      parentId: companyGoal1.id,
      ownerAgentId: salesId,
      departmentId: DEPT.SALES,
      targetDate: new Date('2026-06-30'),
    },
  });
  log('🎯', `Goal: ${deptGoal2.title}`);

  const deptGoal3 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Build a Comprehensive AI Knowledge Base',
      description:
        'Index 50+ proprietary documents, playbooks, and case studies into the knowledge base to supercharge agent intelligence.',
      level: 'DEPARTMENT',
      status: 'ACTIVE',
      progress: 15,
      parentId: companyGoal2.id,
      ownerAgentId: researchId,
      departmentId: DEPT.RESEARCH,
      targetDate: new Date('2026-07-31'),
    },
  });
  log('🎯', `Goal: ${deptGoal3.title}`);

  const deptGoal4 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Reduce Campaign Launch Time by 50%',
      description:
        'Automate campaign setup, creative briefing, and audience targeting to cut time-to-launch from 2 weeks to 5 business days.',
      level: 'DEPARTMENT',
      status: 'ACTIVE',
      progress: 20,
      parentId: companyGoal2.id,
      ownerAgentId: campaignId,
      departmentId: DEPT.OPERATIONS,
      targetDate: new Date('2026-08-31'),
    },
  });
  log('🎯', `Goal: ${deptGoal4.title}`);

  // Individual-level goals
  const indGoal1 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Automate Weekly Email Newsletter Pipeline',
      description:
        'Set up a fully automated email newsletter workflow: content curation → template population → A/B test → send → analytics.',
      level: 'INDIVIDUAL',
      status: 'ACTIVE',
      progress: 60,
      parentId: deptGoal1.id,
      ownerAgentId: emailId,
      departmentId: DEPT.MARKETING,
      targetDate: new Date('2026-05-31'),
    },
  });
  log('🎯', `Goal: ${indGoal1.title}`);

  const indGoal2 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Publish 25 SEO-Optimised Articles by EOQ',
      description:
        'Research, draft, and publish 25 high-intent SEO articles targeting 50+ keywords with avg. difficulty < 35.',
      level: 'INDIVIDUAL',
      status: 'ACTIVE',
      progress: 36,
      parentId: deptGoal1.id,
      ownerAgentId: seoId,
      departmentId: DEPT.MARKETING,
      targetDate: new Date('2026-06-30'),
    },
  });
  log('🎯', `Goal: ${indGoal2.title}`);

  const indGoal3 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Close 15 New Enterprise Accounts by Q2',
      description:
        'Convert 15 enterprise leads (MRR > $5k each) from the pipeline to signed contracts.',
      level: 'INDIVIDUAL',
      status: 'ACTIVE',
      progress: 27,
      parentId: deptGoal2.id,
      ownerAgentId: leadId,
      departmentId: DEPT.SALES,
      targetDate: new Date('2026-06-30'),
    },
  });
  log('🎯', `Goal: ${indGoal3.title}`);

  const indGoal4 = await prisma.goal.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Achieve 4.8★ Client Satisfaction Rating',
      description:
        'Deliver exceptional client experiences to achieve and maintain a 4.8/5 NPS score across all accounts.',
      level: 'INDIVIDUAL',
      status: 'ACTIVE',
      progress: 80,
      parentId: deptGoal2.id,
      ownerAgentId: `${TENANT_ID}-client-relations`,
      departmentId: DEPT.SALES,
      targetDate: new Date('2026-06-30'),
    },
  });
  log('🎯', `Goal: ${indGoal4.title}`);

  log('✅', 'All goals created');
  return {
    companyGoal1: companyGoal1.id,
    companyGoal2: companyGoal2.id,
    deptGoal1: deptGoal1.id,
    deptGoal2: deptGoal2.id,
    deptGoal3: deptGoal3.id,
  };
}

// ─── 5. PROJECTS ──────────────────────────────────────────────────────────────
async function seedProjects(goalIds) {
  sep('STEP 5: Projects');

  const existing = await prisma.project.count({
    where: { tenantId: TENANT_ID },
  });
  if (existing >= 4) {
    log('⏭️ ', `Already have ${existing} projects, skipping`);
    return;
  }

  const allGoals = await prisma.goal.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true },
  });
  const gIds = allGoals.map((g) => g.id);

  const projects = [
    {
      name: 'Q2 Marketing Campaign Rollout',
      description:
        'Full execution of the Q2 multi-channel marketing campaigns for all key client accounts, including creative production, media buying, and performance tracking.',
      status: 'ACTIVE',
      departmentId: DEPT.MARKETING,
      goalIds: gIds.slice(0, 2),
      targetDate: new Date('2026-06-30'),
      metadata: {
        estimatedBudget: '$45,000',
        clients: 6,
        channels: ['paid_social', 'sem', 'email', 'content'],
      },
    },
    {
      name: 'CRM Integration & Lead Nurture Automation',
      description:
        'Integrate HubSpot CRM with AI agents, automate lead scoring, and deploy multi-touch nurture sequences for all pipeline stages.',
      status: 'ACTIVE',
      departmentId: DEPT.SALES,
      goalIds: gIds.slice(1, 3),
      targetDate: new Date('2026-05-31'),
      metadata: {
        estimatedBudget: '$8,000',
        milestones: [
          'HubSpot API integration',
          'Lead scoring model',
          '5-step nurture sequence',
          'Dashboard',
        ],
      },
    },
    {
      name: 'AI Knowledge Base Build-out',
      description:
        'Upload, index, and categorise all agency playbooks, case studies, SOPs, and client briefs into the knowledge base system.',
      status: 'ACTIVE',
      departmentId: DEPT.RESEARCH,
      goalIds: gIds.slice(2, 4),
      targetDate: new Date('2026-07-31'),
      metadata: {
        estimatedBudget: '$3,500',
        targetDocuments: 50,
        spaces: [
          'Q2 Marketing Playbook',
          'Campaign Library',
          'SOPs',
          'Client Briefs',
        ],
      },
    },
    {
      name: 'Email Automation Platform Launch',
      description:
        'Stand up the full email marketing automation stack: template builder, subscriber management, drip sequences, and real-time analytics.',
      status: 'ACTIVE',
      departmentId: DEPT.OPERATIONS,
      goalIds: gIds.slice(0, 1),
      targetDate: new Date('2026-05-15'),
      metadata: {
        estimatedBudget: '$5,000',
        subscribers: '12,500',
        templates: 8,
        sequences: 5,
      },
    },
    {
      name: 'Brand Refresh Initiative — Q3 2026',
      description:
        'Refresh the brand positioning, visual identity, messaging framework, and website copy for 3 key client accounts.',
      status: 'ACTIVE',
      departmentId: DEPT.MARKETING,
      goalIds: gIds.slice(0, 2),
      targetDate: new Date('2026-08-31'),
      metadata: {
        estimatedBudget: '$22,000',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
        deliverables: ['Brand guide', 'Messaging framework', 'Landing pages'],
      },
    },
    {
      name: 'Performance Analytics Dashboard Build',
      description:
        'Build a unified cross-channel performance analytics dashboard aggregating Google Ads, Meta, LinkedIn, and email metrics in real-time.',
      status: 'ACTIVE',
      departmentId: DEPT.RESEARCH,
      goalIds: gIds.slice(1, 3),
      targetDate: new Date('2026-06-15'),
      metadata: {
        estimatedBudget: '$6,500',
        dataConnectors: [
          'Google Ads',
          'Meta Ads',
          'LinkedIn',
          'HubSpot',
          'Google Analytics',
        ],
        refreshInterval: '15 minutes',
      },
    },
  ];

  let created = 0;
  for (const proj of projects) {
    const exists = await prisma.project.findFirst({
      where: { tenantId: TENANT_ID, name: proj.name },
    });
    if (exists) continue;

    await prisma.project.create({
      data: { ...proj, tenantId: TENANT_ID },
    });
    created++;
    log('📁', `Created project: ${proj.name}`);
  }
  log('✅', `Projects: ${created} created`);
}

// ─── 6. SSO CONFIG ────────────────────────────────────────────────────────────
async function seedSsoConfig() {
  sep('STEP 6: SSO Config');

  const existing = await prisma.ssoConfig.findUnique({
    where: { tenantId: TENANT_ID },
  });
  if (existing) {
    log('⏭️ ', 'SSO config already exists');
    return;
  }

  await prisma.ssoConfig.create({
    data: {
      tenantId: TENANT_ID,
      provider: 'SAML',
      entryPoint:
        'https://sso.example-idp.com/saml/sso/growth-marketing-agency',
      issuer: 'https://sso.example-idp.com/saml/metadata',
      cert: `-----BEGIN CERTIFICATE-----
MIIDpDCCAoygAwIBAgIGAYu1FEOyMA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQG
EwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNj
bzENMAsGA1UECgwEQWNtZTEOMAwGA1UECwwFSURNZ3IxGTAXBgNVBAMMEGFjbWUu
ZXhhbXBsZS5jb20xHDAaBgkqhkiG9w0BCQEWDWluZm9AYWNtZS5jb20wHhcNMjQw
MTAxMDAwMDAwWhcNMjYwMTAxMDAwMDAwWjCBkjELMAkGA1UEBhMCVVMxEzARBgNV
BAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xDTALBgNVBAoM
BEFjbWUxDjAMBgNVBAsMBUlETWdyMRkwFwYDVQQDDBBhY21lLmV4YW1wbGUuY29t
-----END CERTIFICATE-----`,
      clientId: 'growth-marketing-agency-sp',
      isEnabled: false,
      metadata: {
        note: 'Demo SAML SSO configuration — not active in demo environment',
        configuredBy: 'seed-script',
        idpName: 'Okta (demo)',
      },
    },
  });
  log('✅', 'SSO config created (SAML, disabled)');
}

// ─── 7. KNOWLEDGE DOCUMENTS ───────────────────────────────────────────────────
async function seedKnowledgeDocuments() {
  sep('STEP 7: Knowledge Documents');

  const SPACE_PLAYBOOK = 'ead7f8d4-f7c4-495d-b704-a378b6791a06';
  const SPACE_LIBRARY = '90d7dc61-6f02-4556-9ac8-0d64b846c58e';

  const docs = [
    {
      spaceId: SPACE_PLAYBOOK,
      title: 'Q1 2026 Campaign Performance Report',
      content: `# Q1 2026 Campaign Performance Report

## Executive Summary
Q1 2026 delivered strong results across all client accounts. Total managed spend: $312,500. Blended ROAS: 4.2x. New clients onboarded: 3.

## Channel Performance
- **Paid Social (Meta/TikTok):** $145,000 spend | 3.8x ROAS | 12.4M impressions
- **Search (Google/Bing):** $98,000 spend | 5.1x ROAS | 245K clicks
- **Email Marketing:** 4.2M sends | 24.3% open rate | 3.1% CTR
- **Content/SEO:** 18 articles published | 42,000 organic sessions | +38% YoY

## Top Performing Campaigns
1. TechCorp "Spring Launch" — ROAS 6.8x, $28K revenue generated
2. Acme Corp "Q1 Promo" — ROAS 5.2x, 2,400 conversions
3. Startup X "Brand Awareness" — 8.2M impressions, 3.4% brand recall lift

## Key Learnings
- Video creative outperformed static by 2.3x on Meta
- Long-tail keywords drove 67% of conversions at 40% lower CPC
- Email sequences with 3+ touchpoints had 2.1x higher conversion rate

## Q2 Recommendations
- Shift 15% budget from static to video creative
- Expand long-tail keyword coverage by 200 terms
- Launch retargeting sequences for all mid-funnel prospects`,
      sourceType: 'MANUAL',
      metadata: {
        quarter: 'Q1 2026',
        type: 'performance_report',
        author: 'Data Analyst',
      },
    },
    {
      spaceId: SPACE_PLAYBOOK,
      title: 'Growth Marketing Agency SOPs — AI Agent Usage',
      content: `# Standard Operating Procedures: AI Agent Usage

## Overview
All AI agents in our platform operate within defined boundaries and require human oversight for high-stakes decisions. This SOP defines correct usage, escalation paths, and guardrails.

## Agent Roles & Boundaries

### CEO Agent
- **Can do:** Generate strategy documents, review KPI dashboards, draft board reports
- **Cannot do:** Make hiring decisions, approve spending >$10K, sign contracts
- **Escalate to:** Human CEO for final approval on strategic pivots

### Marketing Director Agent
- **Can do:** Plan campaigns, allocate budgets up to $25K, brief creative teams
- **Cannot do:** Approve final creative, authorise media buys >$50K
- **Escalate to:** Marketing VP for major campaign launches

### Sales Manager Agent  
- **Can do:** Qualify leads, draft proposals up to $20K, schedule demos
- **Cannot do:** Offer discounts >20%, close enterprise deals solo
- **Escalate to:** Human Sales Director for enterprise accounts

## Approval Workflows
1. AI generates draft → Human reviews → Human approves → AI executes
2. For budgets >$10K: additional CFO sign-off required
3. For client communications: always CC account manager

## Data Security
- All agents operate on anonymised data in demo environments
- Production agents subject to GDPR/CCPA data handling policies
- API keys rotated monthly, access logs retained 12 months`,
      sourceType: 'MANUAL',
      metadata: { type: 'sop', version: '2.1', lastUpdated: '2026-03-15' },
    },
    {
      spaceId: SPACE_LIBRARY,
      title: 'Social Media Content Calendar — April 2026',
      content: `# Social Media Content Calendar — April 2026

## Monthly Theme: "AI-Powered Growth"
Focus on showcasing AI efficiency gains, client success stories, and thought leadership.

## Week 1 (Apr 6–12): AI in Marketing
- **Monday:** LinkedIn post — "5 ways AI is changing digital marketing in 2026"
- **Tuesday:** Instagram carousel — Client success story: TechCorp 6.8x ROAS
- **Wednesday:** Twitter thread — "How we run a 50-person agency with 20 AI agents"
- **Thursday:** LinkedIn article — "The future of programmatic advertising"
- **Friday:** Instagram Reel — Behind the scenes: AI agent dashboard tour

## Week 2 (Apr 13–19): Client Spotlight
- **Monday:** LinkedIn — "Case Study: How Acme Corp achieved 5.2x ROAS with AI"
- **Wednesday:** Twitter — Q&A thread on AI marketing tools
- **Friday:** Instagram — Team spotlight + culture content

## Week 3 (Apr 20–26): Product/Service Focus
- **Monday:** LinkedIn — "Introducing our new AI Brand Strategist agent"
- **Wednesday:** Twitter — Tips on SEO + AI content creation
- **Friday:** Instagram — Client testimonial video

## Week 4 (Apr 27–30): Month Recap
- **Monday:** LinkedIn — Monthly performance digest
- **Wednesday:** Twitter — Predictions for May 2026 trends
- **Friday:** Instagram — Fun Friday / culture post

## KPIs
- LinkedIn: 15% engagement rate target
- Instagram: 8% reach rate target  
- Twitter/X: 500 impressions per tweet target`,
      sourceType: 'MANUAL',
      metadata: {
        month: 'April 2026',
        type: 'content_calendar',
        assignedTo: 'Social Media Manager',
      },
    },
    {
      spaceId: SPACE_LIBRARY,
      title: 'Lead Scoring Framework & ICP Definition',
      content: `# Lead Scoring Framework & Ideal Customer Profile

## Ideal Customer Profile (ICP)
**Company Size:** 50–500 employees
**Industry:** SaaS, E-commerce, FinTech, HealthTech, Consumer Brands
**Revenue:** $5M–$100M ARR
**Marketing Budget:** $50K–$500K/year
**Pain Points:** Scaling marketing without headcount, measuring ROI, content at scale

## Lead Scoring Model (0–100 points)

### Demographic / Firmographic (max 40 pts)
| Criterion | Points |
|-----------|--------|
| 100–500 employees | 20 |
| 50–100 employees | 10 |
| Industry match (SaaS/E-com/FinTech) | 15 |
| Revenue $5M–$100M | 10 |
| HQ in target region (US/EU/AU) | 5 |

### Behavioural (max 40 pts)
| Criterion | Points |
|-----------|--------|
| Booked a demo | 25 |
| Downloaded 2+ resources | 15 |
| Opened 3+ emails | 10 |
| Visited pricing page | 10 |
| Attended webinar | 8 |
| Social media engagement | 5 |

### Intent Signals (max 20 pts)
| Criterion | Points |
|-----------|--------|
| G2/Capterra review read | 10 |
| Competitor comparison page visit | 8 |
| ROI calculator used | 7 |
| LinkedIn ad click | 5 |

## Lead Stages
- **MQL:** Score ≥ 40 → Hand off to Sales Manager Agent
- **SQL:** Score ≥ 65 + demo booked → Account Manager engaged  
- **Opportunity:** Demo completed + proposal requested
- **Closed Won:** Contract signed`,
      sourceType: 'MANUAL',
      metadata: {
        type: 'sales_framework',
        version: '3.0',
        lastUpdated: '2026-02-20',
      },
    },
    {
      spaceId: SPACE_PLAYBOOK,
      title: 'SEO Keyword Strategy — Q2 2026',
      content: `# SEO Keyword Strategy Q2 2026

## Target Keyword Clusters

### Cluster 1: AI Marketing Tools (High Priority)
- "ai marketing automation" — Vol: 12,400/mo, KD: 42
- "ai marketing tools 2026" — Vol: 8,200/mo, KD: 38  
- "marketing ai agents" — Vol: 3,400/mo, KD: 28
- "best ai tools for digital marketing" — Vol: 5,600/mo, KD: 45

### Cluster 2: Agency Services (Medium Priority)
- "growth marketing agency" — Vol: 6,800/mo, KD: 55
- "performance marketing agency" — Vol: 4,200/mo, KD: 52
- "digital marketing agency pricing" — Vol: 3,100/mo, KD: 44
- "b2b marketing agency" — Vol: 5,400/mo, KD: 58

### Cluster 3: Long-Tail / Conversion (Priority)
- "how to scale marketing without hiring" — Vol: 1,200/mo, KD: 22
- "ai tools to replace marketing team" — Vol: 890/mo, KD: 18
- "marketing automation for startups" — Vol: 2,100/mo, KD: 31
- "roi of ai in marketing" — Vol: 1,800/mo, KD: 26

## Content Calendar (25 articles)
Week 1-2: Foundation pieces on AI marketing (clusters 1 & 3)
Week 3-4: Service landing pages (cluster 2)
Week 5-8: Deep-dive guides and case studies (cluster 1 & 3)

## Technical SEO Checklist
- [ ] Core Web Vitals: all green (LCP < 2.5s, CLS < 0.1, FID < 100ms)
- [ ] Schema markup: Article, Organisation, FAQPage
- [ ] Internal linking: minimum 3 links per new article
- [ ] External backlinks target: 5 DA60+ per month`,
      sourceType: 'MANUAL',
      metadata: {
        type: 'seo_strategy',
        quarter: 'Q2 2026',
        assignedTo: 'SEO & Content Analyst',
      },
    },
  ];

  let created = 0;
  for (const doc of docs) {
    const exists = await prisma.knowledgeDocument.findFirst({
      where: { spaceId: doc.spaceId, title: doc.title },
    });
    if (exists) continue;

    await prisma.knowledgeDocument.create({ data: doc });
    created++;
    log('📄', `Created doc: ${doc.title}`);
  }
  log('✅', `Knowledge documents: ${created} created`);
}

// ─── 8. NOTIFICATIONS ────────────────────────────────────────────────────────
async function seedNotifications() {
  sep('STEP 8: Notifications');

  const existing = await prisma.notification.count({
    where: { tenantId: TENANT_ID },
  });
  if (existing >= 5) {
    log('⏭️ ', `Already have ${existing} notifications, skipping`);
    return;
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: TENANT_ID },
    select: { id: true },
  });
  const userId = user?.id;

  const notifications = [
    {
      type: 'SUCCESS',
      title: 'Campaign Manager Agent Deployed',
      message:
        'Campaign Manager agent is now live and processing its first batch of Q2 campaign briefs. 3 workflows triggered.',
      isRead: false,
      tenantId: TENANT_ID,
      userId,
      payload: {
        agentId: `${TENANT_ID}-campaign-manager`,
        action: 'deployment',
      },
    },
    {
      type: 'BILLING_ALERT',
      title: 'Marketing Dept at 94% of Monthly Budget',
      message:
        'The Marketing department has consumed 94% ($18,750 of $20,000) of its monthly AI budget. Consider adjusting usage or increasing the limit.',
      isRead: false,
      tenantId: TENANT_ID,
      userId,
      payload: { scope: 'DEPARTMENT', department: 'Marketing', pctUsed: 94 },
    },
    {
      type: 'INFO',
      title: 'New Knowledge Documents Indexed',
      message:
        '5 new documents have been successfully indexed into your knowledge base spaces. Agents can now query this content.',
      isRead: true,
      tenantId: TENANT_ID,
      userId,
      payload: {
        documentsAdded: 5,
        spaces: ['Q2 Marketing Playbook', 'Q2 Campaign Library'],
      },
    },
    {
      type: 'SUCCESS',
      title: '26 Demo Tasks Completed This Week',
      message:
        'All 26 scheduled AI agent tasks for this week have completed successfully. View the full execution report.',
      isRead: true,
      tenantId: TENANT_ID,
      userId,
      payload: { tasksCompleted: 26, successRate: '100%' },
    },
    {
      type: 'AGENT_ALERT',
      title: 'Lead Generation Bot Found 47 New Prospects',
      message:
        'The Lead Generation Bot has identified 47 new qualified prospects matching the ICP. 12 scored 65+ (SQL-ready). Review in CRM.',
      isRead: false,
      tenantId: TENANT_ID,
      userId,
      payload: {
        totalProspects: 47,
        sqlReady: 12,
        agentId: `${TENANT_ID}-lead-gen-bot`,
      },
    },
    {
      type: 'INFO',
      title: 'Q2 Goal Progress Update',
      message:
        'Your Q2 company goal "Grow Agency Revenue 40%" is at 18% progress. 3 linked department goals are on track.',
      isRead: false,
      tenantId: TENANT_ID,
      userId,
      payload: { goalProgress: 18, linkedGoals: 3 },
    },
    {
      type: 'SUCCESS',
      title: 'Email Campaign: 32.4% Open Rate',
      message:
        'The "AI Trends May 2026" newsletter achieved a 32.4% open rate and 4.8% CTR — above industry average. Full stats available.',
      isRead: true,
      tenantId: TENANT_ID,
      userId,
      payload: {
        openRate: '32.4%',
        ctr: '4.8%',
        campaign: 'AI Trends May 2026',
      },
    },
    {
      type: 'WARNING',
      title: 'SEO Analyst Agent: 3 Articles Pending Review',
      message:
        '3 SEO articles drafted by the SEO & Content Analyst agent are awaiting human review before publication.',
      isRead: false,
      tenantId: TENANT_ID,
      userId,
      payload: { pendingArticles: 3, agentId: `${TENANT_ID}-seo-analyst` },
    },
  ];

  let created = 0;
  for (const n of notifications) {
    await prisma.notification.create({ data: n });
    created++;
  }
  log('✅', `Notifications: ${created} created`);
}

// ─── 9. ROUTINES ──────────────────────────────────────────────────────────────
async function seedRoutines() {
  sep('STEP 9: Routines');

  const existing = await prisma.routine.count({
    where: { tenantId: TENANT_ID },
  });
  if (existing >= 3) {
    log('⏭️ ', `Already have ${existing} routines, skipping`);
    return;
  }

  const routines = [
    {
      name: 'Daily KPI Morning Briefing',
      description:
        'Every weekday at 8 AM, the CEO Agent pulls overnight metrics and sends a morning briefing email to the team.',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      graphDefinition: {
        nodes: [
          { id: 'trigger', type: 'trigger', label: 'Schedule: 8 AM weekdays' },
          {
            id: 'pull_metrics',
            type: 'agent_task',
            label: 'CEO Agent: pull KPI dashboard',
            agentId: `${TENANT_ID}-ceo-agent`,
            tool: 'analytics_dashboard',
          },
          {
            id: 'generate_brief',
            type: 'agent_task',
            label: 'CEO Agent: generate briefing',
            agentId: `${TENANT_ID}-ceo-agent`,
            tool: 'document_summary',
          },
          {
            id: 'send_email',
            type: 'agent_task',
            label: 'Admin Assistant: send email',
            agentId: `${TENANT_ID}-administrative-assistant`,
            tool: 'email_send',
          },
        ],
        edges: [
          { from: 'trigger', to: 'pull_metrics' },
          { from: 'pull_metrics', to: 'generate_brief' },
          { from: 'generate_brief', to: 'send_email' },
        ],
      },
      config: {
        maxIterations: 1,
        timeout: 120000,
        retryPolicy: { maxRetries: 2 },
      },
      metadata: {
        category: 'reporting',
        frequency: 'daily',
        stakeholders: ['CEO', 'Marketing Director'],
      },
    },
    {
      name: 'Weekly Lead Pipeline Refresh',
      description:
        'Every Monday at 9 AM, the Lead Gen Bot and Sales Manager refresh the pipeline, score new leads, and brief the Account Manager.',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      graphDefinition: {
        nodes: [
          { id: 'trigger', type: 'trigger', label: 'Schedule: Monday 9 AM' },
          {
            id: 'search_leads',
            type: 'agent_task',
            label: 'Lead Gen Bot: web search prospects',
            agentId: `${TENANT_ID}-lead-gen-bot`,
            tool: 'web_search',
          },
          {
            id: 'score_leads',
            type: 'agent_task',
            label: 'Sales Manager: score & qualify',
            agentId: `${TENANT_ID}-sales-manager`,
            tool: 'crm',
          },
          {
            id: 'update_crm',
            type: 'agent_task',
            label: 'Account Manager: update CRM',
            agentId: `${TENANT_ID}-account-manager`,
            tool: 'crm',
          },
          {
            id: 'notify_team',
            type: 'agent_task',
            label: 'Client Relations: send summary',
            agentId: `${TENANT_ID}-client-relations`,
            tool: 'email_send',
          },
        ],
        edges: [
          { from: 'trigger', to: 'search_leads' },
          { from: 'search_leads', to: 'score_leads' },
          { from: 'score_leads', to: 'update_crm' },
          { from: 'update_crm', to: 'notify_team' },
        ],
      },
      config: {
        maxIterations: 1,
        timeout: 300000,
        retryPolicy: { maxRetries: 1 },
      },
      metadata: {
        category: 'sales',
        frequency: 'weekly',
        stakeholders: ['Sales Manager', 'Account Manager'],
      },
    },
    {
      name: 'Social Media Content Scheduling',
      description:
        "Every Friday at 3 PM, the Social Media Manager schedules next week's posts across all channels.",
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      graphDefinition: {
        nodes: [
          { id: 'trigger', type: 'trigger', label: 'Schedule: Friday 3 PM' },
          {
            id: 'get_calendar',
            type: 'agent_task',
            label: 'Content Creator: get content calendar',
            agentId: `${TENANT_ID}-content-creator`,
            tool: 'calendar',
          },
          {
            id: 'draft_posts',
            type: 'agent_task',
            label: 'Content Creator: draft posts',
            agentId: `${TENANT_ID}-content-creator`,
            tool: 'document_summary',
          },
          {
            id: 'schedule_posts',
            type: 'agent_task',
            label: 'Social Media Manager: schedule posts',
            agentId: `${TENANT_ID}-social-media-manager`,
            tool: 'calendar',
          },
        ],
        edges: [
          { from: 'trigger', to: 'get_calendar' },
          { from: 'get_calendar', to: 'draft_posts' },
          { from: 'draft_posts', to: 'schedule_posts' },
        ],
      },
      config: {
        maxIterations: 1,
        timeout: 180000,
        retryPolicy: { maxRetries: 2 },
      },
      metadata: {
        category: 'content',
        frequency: 'weekly',
        stakeholders: ['Social Media Manager', 'Marketing Director'],
      },
    },
    {
      name: 'Monthly Budget & Cost Review',
      description:
        'On the 1st of each month, the Budget Controller reviews AI spend vs budget and generates a monthly cost report.',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      graphDefinition: {
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            label: 'Schedule: 1st of month at 10 AM',
          },
          {
            id: 'pull_costs',
            type: 'agent_task',
            label: 'Budget Controller: pull cost records',
            agentId: `${TENANT_ID}-budget-controller`,
            tool: 'spreadsheet',
          },
          {
            id: 'analyse',
            type: 'agent_task',
            label: 'Performance Analyst: analyse spend',
            agentId: `${TENANT_ID}-performance-analyst`,
            tool: 'document_summary',
          },
          {
            id: 'report',
            type: 'agent_task',
            label: 'Ops Manager: generate report',
            agentId: `${TENANT_ID}-operations-manager`,
            tool: 'email_send',
          },
        ],
        edges: [
          { from: 'trigger', to: 'pull_costs' },
          { from: 'pull_costs', to: 'analyse' },
          { from: 'analyse', to: 'report' },
        ],
      },
      config: {
        maxIterations: 1,
        timeout: 240000,
        retryPolicy: { maxRetries: 1 },
      },
      metadata: {
        category: 'finance',
        frequency: 'monthly',
        stakeholders: ['CEO', 'Operations Manager'],
      },
    },
    {
      name: 'Weekly SEO Content Publishing',
      description:
        'Every Tuesday at 10 AM, the SEO Analyst researches trending topics and the Content Creator drafts 3 new SEO articles.',
      status: 'ACTIVE',
      tenantId: TENANT_ID,
      graphDefinition: {
        nodes: [
          { id: 'trigger', type: 'trigger', label: 'Schedule: Tuesday 10 AM' },
          {
            id: 'keyword_research',
            type: 'agent_task',
            label: 'SEO Analyst: keyword research',
            agentId: `${TENANT_ID}-seo-analyst`,
            tool: 'web_search',
          },
          {
            id: 'draft_articles',
            type: 'agent_task',
            label: 'Content Creator: draft articles',
            agentId: `${TENANT_ID}-content-creator`,
            tool: 'document_summary',
          },
          {
            id: 'update_tracker',
            type: 'agent_task',
            label: 'SEO Analyst: update content tracker',
            agentId: `${TENANT_ID}-seo-analyst`,
            tool: 'spreadsheet',
          },
        ],
        edges: [
          { from: 'trigger', to: 'keyword_research' },
          { from: 'keyword_research', to: 'draft_articles' },
          { from: 'draft_articles', to: 'update_tracker' },
        ],
      },
      config: {
        maxIterations: 1,
        timeout: 240000,
        retryPolicy: { maxRetries: 2 },
      },
      metadata: {
        category: 'content',
        frequency: 'weekly',
        stakeholders: ['Content Creator', 'Marketing Director'],
      },
    },
  ];

  const triggerConfigs = [
    {
      type: 'SCHEDULE',
      config: { cron: '0 8 * * 1-5', timezone: 'America/New_York' },
    },
    {
      type: 'SCHEDULE',
      config: { cron: '0 9 * * 1', timezone: 'America/New_York' },
    },
    {
      type: 'SCHEDULE',
      config: { cron: '0 15 * * 5', timezone: 'America/New_York' },
    },
    {
      type: 'SCHEDULE',
      config: { cron: '0 10 1 * *', timezone: 'America/New_York' },
    },
    {
      type: 'SCHEDULE',
      config: { cron: '0 10 * * 2', timezone: 'America/New_York' },
    },
  ];

  let created = 0;
  for (let i = 0; i < routines.length; i++) {
    const r = routines[i];
    const exists = await prisma.routine.findFirst({
      where: { tenantId: TENANT_ID, name: r.name },
    });
    if (exists) continue;

    const routine = await prisma.routine.create({ data: r });
    await prisma.routineTrigger.create({
      data: {
        type: triggerConfigs[i].type,
        config: triggerConfigs[i].config,
        isActive: true,
        routineId: routine.id,
      },
    });
    created++;
    log('⚙️ ', `Created routine: ${r.name}`);
  }
  log('✅', `Routines: ${created} created`);
}

// ─── 10. KNOWLEDGE SPACE ACCESS (link new agents to spaces) ─────────────────
async function seedKnowledgeAccess() {
  sep('STEP 10: Agent–Knowledge Access');

  const spaces = await prisma.knowledgeSpace.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true },
  });
  if (spaces.length === 0) {
    log('⚠️ ', 'No knowledge spaces found, skipping');
    return;
  }

  const newAgentIds = [
    `${TENANT_ID}-email-specialist`,
    `${TENANT_ID}-seo-analyst`,
    `${TENANT_ID}-campaign-manager`,
    `${TENANT_ID}-performance-analyst`,
    `${TENANT_ID}-client-relations`,
    `${TENANT_ID}-budget-controller`,
    `${TENANT_ID}-lead-gen-bot`,
    `${TENANT_ID}-brand-strategist`,
    `${TENANT_ID}-outreach-specialist`,
    `${TENANT_ID}-ai-ops-engineer`,
  ];

  let created = 0;
  for (const agentId of newAgentIds) {
    for (const space of spaces) {
      try {
        await prisma.agentKnowledgeAccess.create({
          data: { agentId, spaceId: space.id },
        });
        created++;
      } catch {
        // unique constraint — already linked
      }
    }
  }
  log('✅', `Agent–space access links: ${created} created`);
}

// ─── 11. ADDITIONAL TASKS for new agents ────────────────────────────────────
async function seedAdditionalTasks() {
  sep('STEP 11: Additional Tasks for New Agents');

  const existing = await prisma.task.count({ where: { tenantId: TENANT_ID } });
  if (existing >= 80) {
    log('⏭️ ', `Already have ${existing} tasks, skipping additional tasks`);
    return;
  }

  const now = new Date();
  function nextWeekday(dayOffset, hour) {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  const tasks = [
    // Email Specialist
    {
      title: 'May Newsletter Campaign Setup',
      description:
        'Set up the May 2026 email newsletter: segment subscriber list, populate template with AI Trends content, configure A/B test (2 subject lines), schedule send for Tuesday 10 AM.',
      agentId: `${TENANT_ID}-email-specialist`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(1, 9),
      input: {
        tool: 'email_send',
        params: {
          action: 'create_campaign',
          subject: 'AI Marketing Trends — May 2026',
          template: 'newsletter-v3',
          segments: ['all_subscribers', 'enterprise_prospects'],
        },
      },
      tags: ['email', 'newsletter', 'may2026'],
    },
    {
      title: 'Email Subscriber List Cleanup',
      description:
        'Identify and remove hard bounces, unsubscribes, and dormant subscribers (>6 months inactive). Export cleaned list to spreadsheet.',
      agentId: `${TENANT_ID}-email-specialist`,
      priority: 'MEDIUM',
      scheduledAt: nextWeekday(2, 11),
      input: {
        tool: 'crm',
        params: { action: 'list_contacts', filter: 'inactive_6_months' },
      },
      tags: ['email', 'hygiene', 'crm'],
    },
    // SEO Analyst
    {
      title: 'Q2 Keyword Gap Analysis',
      description:
        'Run a gap analysis comparing our organic keyword coverage against top 3 competitors. Identify 50+ untapped high-intent keywords for the content calendar.',
      agentId: `${TENANT_ID}-seo-analyst`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(1, 10),
      input: {
        tool: 'web_search',
        params: {
          query:
            'AI marketing agency organic keywords competitive landscape 2026',
          sources: ['serp', 'semrush'],
        },
      },
      tags: ['seo', 'keywords', 'competitive'],
    },
    {
      title: 'Technical SEO Audit — Core Web Vitals',
      description:
        'Run a full technical SEO audit: check Core Web Vitals, crawl errors, broken links, schema markup, and mobile usability across all 45 website pages.',
      agentId: `${TENANT_ID}-seo-analyst`,
      priority: 'MEDIUM',
      scheduledAt: nextWeekday(3, 9),
      input: {
        tool: 'web_search',
        params: {
          query: 'site:neurecore.com core web vitals issues',
          type: 'technical_audit',
        },
      },
      tags: ['seo', 'technical', 'audit'],
    },
    // Campaign Manager
    {
      title: 'TechCorp Q2 Campaign Brief',
      description:
        'Prepare comprehensive campaign brief for TechCorp Q2 launch: audience segmentation, channel mix, creative requirements, budget allocation ($45K total), KPI targets.',
      agentId: `${TENANT_ID}-campaign-manager`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(0, 14),
      input: {
        tool: 'crm',
        params: {
          action: 'list_deals',
          filter: 'client_techcorp',
          stage: 'planning',
        },
      },
      tags: ['campaign', 'brief', 'techcorp'],
    },
    {
      title: 'Multi-Channel Campaign Calendar Setup',
      description:
        'Build the Q2 multi-channel campaign calendar in Google Calendar for all 6 clients. Block creative production, review, and go-live dates for each campaign.',
      agentId: `${TENANT_ID}-campaign-manager`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(1, 13),
      input: {
        tool: 'calendar',
        params: {
          action: 'create',
          events: [
            { title: 'TechCorp Campaign Go-Live', date: '2026-04-15' },
            { title: 'Acme Corp Launch', date: '2026-04-22' },
          ],
        },
      },
      tags: ['calendar', 'planning', 'campaigns'],
    },
    // Performance Analyst
    {
      title: 'Weekly Paid Ads Performance Report',
      description:
        'Pull last 7-day performance data from Google Ads and Meta Ads. Calculate ROAS, CPC, CPM, CTR for all active campaigns. Flag any campaigns ROAS < 2.5x for optimisation.',
      agentId: `${TENANT_ID}-performance-analyst`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(0, 8),
      input: {
        tool: 'spreadsheet',
        params: {
          action: 'read',
          spreadsheetId: 'ads-performance-tracker',
          cellRange: 'A1:Z100',
        },
      },
      tags: ['performance', 'paid-ads', 'weekly'],
    },
    {
      title: 'Attribution Model Analysis',
      description:
        'Compare first-touch, last-touch, and data-driven attribution models for Q1 conversions. Recommend the optimal attribution model for Q2 reporting.',
      agentId: `${TENANT_ID}-performance-analyst`,
      priority: 'MEDIUM',
      scheduledAt: nextWeekday(2, 10),
      input: {
        tool: 'document_summary',
        params: {
          content: 'Q1 2026 Campaign Performance Report',
          maxLength: 100,
          focus: 'attribution_analysis',
        },
      },
      tags: ['analytics', 'attribution', 'q1-review'],
    },
    // Client Relations
    {
      title: 'Q2 QBR Prep — All Clients',
      description:
        'Prepare quarterly business review (QBR) decks for all 6 key accounts. Include Q1 performance summary, Q2 strategy, and 3+ upsell opportunities per client.',
      agentId: `${TENANT_ID}-client-relations`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(2, 9),
      input: {
        tool: 'crm',
        params: {
          action: 'list_contacts',
          filter: 'key_accounts',
          include: ['performance_data', 'contract_value'],
        },
      },
      tags: ['qbr', 'client', 'quarterly'],
    },
    {
      title: 'Client NPS Survey Follow-Ups',
      description:
        'Send personalised follow-up emails to clients who scored 6 or below on the April NPS survey. Schedule 15-min call with each detractor.',
      agentId: `${TENANT_ID}-client-relations`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(1, 10),
      input: {
        tool: 'email_send',
        params: {
          to: 'detractors@survey',
          subject: 'We want to make this right',
          template: 'nps-recovery',
        },
      },
      tags: ['nps', 'retention', 'client'],
    },
    // Budget Controller
    {
      title: 'April AI Spend Reconciliation',
      description:
        'Reconcile all AI agent costs from April: match LLM usage records against budgets, calculate variance per department, flag any overruns.',
      agentId: `${TENANT_ID}-budget-controller`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(0, 9),
      input: {
        tool: 'spreadsheet',
        params: {
          action: 'read',
          spreadsheetId: 'ai-cost-tracker-april',
          cellRange: 'A1:K60',
        },
      },
      tags: ['budget', 'costs', 'reconciliation'],
    },
    {
      title: 'May Budget Pacing Forecast',
      description:
        "Using April's daily spend run rate, forecast May's AI costs per department. Identify if any department is on pace to exceed monthly budget and recommend adjustments.",
      agentId: `${TENANT_ID}-budget-controller`,
      priority: 'MEDIUM',
      scheduledAt: nextWeekday(1, 14),
      input: {
        tool: 'document_summary',
        params: {
          content: 'April cost records from database',
          maxLength: 80,
          focus: 'budget_forecast',
        },
      },
      tags: ['budget', 'forecast', 'may2026'],
    },
    // Lead Gen Bot
    {
      title: 'LinkedIn SaaS Prospect Research',
      description:
        'Search LinkedIn Sales Navigator for SaaS companies 50-200 employees, Series A-B funded, with marketing budget signals. Find 50 qualified prospects matching ICP.',
      agentId: `${TENANT_ID}-lead-gen-bot`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(1, 8),
      input: {
        tool: 'web_search',
        params: {
          query:
            'SaaS startups Series A B marketing budget 2026 site:linkedin.com',
          type: 'prospecting',
        },
      },
      tags: ['lead-gen', 'prospecting', 'saas'],
    },
    {
      title: 'Prospect Data Enrichment & CRM Update',
      description:
        'Enrich the 47 new prospects found this week with firmographic data (employee count, funding, tech stack, contacts). Upload enriched records to HubSpot CRM.',
      agentId: `${TENANT_ID}-lead-gen-bot`,
      priority: 'MEDIUM',
      scheduledAt: nextWeekday(2, 11),
      input: {
        tool: 'crm',
        params: {
          action: 'create_contact',
          batch: true,
          contacts: '{{enriched_prospects}}',
        },
      },
      tags: ['crm', 'enrichment', 'hubspot'],
    },
    // Brand Strategist
    {
      title: 'TechCorp Brand Positioning Workshop Prep',
      description:
        'Prepare a comprehensive brand positioning analysis for TechCorp: competitive audit of 5 rivals, messaging gap analysis, and 3 positioning options with rationale.',
      agentId: `${TENANT_ID}-brand-strategist`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(3, 10),
      input: {
        tool: 'web_search',
        params: {
          query:
            'TechCorp competitors brand positioning SaaS AI tools benchmark 2026',
        },
      },
      tags: ['brand', 'positioning', 'techcorp'],
    },
    {
      title: 'Agency Tone of Voice Guide Update',
      description:
        "Refresh the agency's tone of voice guidelines to reflect the 2026 brand evolution: more AI-forward, authoritative but approachable, data-driven storytelling.",
      agentId: `${TENANT_ID}-brand-strategist`,
      priority: 'LOW',
      scheduledAt: nextWeekday(4, 14),
      input: {
        tool: 'document_summary',
        params: {
          content: 'Current tone of voice guide v2.0',
          maxLength: 50,
          focus: 'refresh_recommendations',
        },
      },
      tags: ['brand', 'content', 'guidelines'],
    },
    // Outreach Specialist
    {
      title: 'Cold Outreach Sequence — FinTech Vertical',
      description:
        'Design and launch a 5-email cold outreach sequence targeting FinTech companies. Personalise each email using firmographic data. Goal: 30% reply rate.',
      agentId: `${TENANT_ID}-outreach-specialist`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(1, 9),
      input: {
        tool: 'email_send',
        params: {
          to: 'fintech_prospects@list',
          subject: '{{personalised_subject}}',
          sequence: 'fintech-cold-v1',
          steps: 5,
        },
      },
      tags: ['outreach', 'cold-email', 'fintech'],
    },
    // AI Ops Engineer
    {
      title: 'Weekly AI Agent Performance Audit',
      description:
        'Review task success rates, average execution times, and error rates for all 20 agents. Identify any agents with >10% error rate and recommend fixes.',
      agentId: `${TENANT_ID}-ai-ops-engineer`,
      priority: 'HIGH',
      scheduledAt: nextWeekday(0, 7),
      input: {
        tool: 'spreadsheet',
        params: {
          action: 'read',
          spreadsheetId: 'agent-performance-log',
          cellRange: 'A1:P200',
        },
      },
      tags: ['ops', 'monitoring', 'performance'],
    },
    {
      title: 'LLM Cost Optimisation Review',
      description:
        'Analyse which agents are using GPT-4o when GPT-4o-mini would suffice. Calculate potential savings from model downgrades. Present savings report with recommendations.',
      agentId: `${TENANT_ID}-ai-ops-engineer`,
      priority: 'MEDIUM',
      scheduledAt: nextWeekday(3, 11),
      input: {
        tool: 'document_summary',
        params: {
          content: 'April LLM cost records by agent and model',
          maxLength: 80,
          focus: 'model_optimisation',
        },
      },
      tags: ['ops', 'cost-optimisation', 'llm'],
    },
  ];

  let created = 0;
  for (const t of tasks) {
    const data = {
      tenantId: TENANT_ID,
      title: t.title,
      description: t.description,
      agentId: t.agentId,
      priority: t.priority,
      status: 'PENDING',
      scheduledAt: t.scheduledAt,
      input: t.input,
    };
    try {
      await prisma.task.create({ data });
      created++;
    } catch (e) {
      log(
        '⚠️ ',
        `Task skipped: ${t.title.substring(0, 40)} — ${e.message.substring(0, 60)}`,
      );
    }
  }
  log('✅', `Additional tasks: ${created} created`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE DEMO SEED — Growth Marketing Agency Tenant');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log(`  Tenant ID: ${TENANT_ID}`);
  console.log('');

  try {
    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
    if (!tenant) {
      throw new Error(`Tenant ${TENANT_ID} not found!`);
    }
    log('✅', `Tenant: ${tenant.name}`);

    await seedAgents();
    await seedCostRecords();
    await seedBudgetPolicies();
    await seedGoals();
    await seedProjects();
    await seedSsoConfig();
    await seedKnowledgeDocuments();
    await seedNotifications();
    await seedRoutines();
    await seedKnowledgeAccess();
    await seedAdditionalTasks();

    // Final summary
    sep('SUMMARY');
    const [
      agents,
      costs,
      budgets,
      goals,
      projects,
      docs,
      sso,
      notifs,
      routines,
      tasks,
    ] = await Promise.all([
      prisma.agent.count({ where: { tenantId: TENANT_ID } }),
      prisma.costRecord.count({ where: { tenantId: TENANT_ID } }),
      prisma.budgetPolicy.count({ where: { tenantId: TENANT_ID } }),
      prisma.goal.count({ where: { tenantId: TENANT_ID } }),
      prisma.project.count({ where: { tenantId: TENANT_ID } }),
      prisma.knowledgeDocument.count(),
      prisma.ssoConfig.count({ where: { tenantId: TENANT_ID } }),
      prisma.notification.count({ where: { tenantId: TENANT_ID } }),
      prisma.routine.count({ where: { tenantId: TENANT_ID } }),
      prisma.task.count({ where: { tenantId: TENANT_ID } }),
    ]);

    console.log('');
    log('🤖', `Agents: ${agents}`);
    log('💵', `Cost Records: ${costs}`);
    log('💰', `Budget Policies: ${budgets}`);
    log('🎯', `Goals: ${goals}`);
    log('📁', `Projects: ${projects}`);
    log('📄', `Knowledge Documents: ${docs}`);
    log('🔐', `SSO Configs: ${sso}`);
    log('🔔', `Notifications: ${notifs}`);
    log('⚙️ ', `Routines: ${routines}`);
    log('📋', `Tasks: ${tasks}`);
    console.log(
      '\n════════════════════════════════════════════════════════════',
    );
    console.log('  ✅  SEED COMPLETE');
    console.log(
      '════════════════════════════════════════════════════════════\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\n❌ Seed failed:', e.message);
  console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});

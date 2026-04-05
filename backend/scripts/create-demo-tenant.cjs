#!/usr/bin/env node
/**
 * Demo Tenant Setup Script
 * Creates a complete demo tenant for a marketing agency with:
 * - Marketing company structure
 * - AI Agents for different roles (CEO, Researchers, Account Managers, etc.)
 * - Workflows and tasks mimicking marketing company activities
 * - Google Workspace mock integration
 *
 * Usage: node create-demo-tenant.js [email] [password] [tenant-name]
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'demo@marketing-agency.local';
  const password = process.argv[3] || 'Marketing@123!';
  const tenantName = process.argv[4] || 'Growth Marketing Agency';
  const slug = (tenantName || 'growth-marketing-agency')
    .toLowerCase()
    .replace(/\s+/g, '-');

  console.log('='.repeat(60));
  console.log('🚀 Creating Demo Tenant for Marketing Agency');
  console.log('='.repeat(60));

  // Step 1: Get or create a default tier
  let tier = await prisma.tier.findFirst({ where: { isDefault: true } });
  if (!tier) {
    console.log('\n📋 Creating default tier...');
    tier = await prisma.tier.create({
      data: {
        name: 'Pro',
        slug: 'pro',
        description: 'Professional tier for demo',
        isActive: true,
        isDefault: true,
        sortOrder: 1,
        monthlyPrice: 49.99,
        yearlyPrice: 499.99,
        maxUsers: 10,
        maxAgents: 15,
        maxStorageGB: 50,
        maxApiCalls: 50000,
        maxConversationMessages: 10000,
        maxFileSizeMB: 100,
        allowCustomBranding: true,
        allowApiAccess: true,
        allowSso: false,
        allowAuditExport: true,
      },
    });
    console.log(`✅ Created tier: ${tier.name}`);
  }

  // Step 2: Create tenant
  console.log('\n🏢 Creating tenant:', tenantName, 'slug=', slug);
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {
      name: tenantName,
      status: 'ACTIVE',
      industry: 'Marketing',
      website: 'https://growthmarketing.demo',
      settings: JSON.stringify({
        timezone: 'America/New_York',
        language: 'en',
        dateFormat: 'MM/DD/YYYY',
      }),
    },
    create: {
      name: tenantName,
      slug,
      status: 'ACTIVE',
      industry: 'Marketing',
      website: 'https://growthmarketing.demo',
      tierId: tier.id,
      settings: JSON.stringify({
        timezone: 'America/New_York',
        language: 'en',
        dateFormat: 'MM/DD/YYYY',
      }),
    },
  });
  console.log(`✅ Created tenant: ${tenant.id}`);

  // Step 3: Create admin user
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('\n👤 Creating admin user:', email);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName: 'Demo',
      lastName: 'Admin',
      tenantId: tenant.id,
      role: 'OWNER',
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      firstName: 'Demo',
      lastName: 'Admin',
      tenantId: tenant.id,
      role: 'OWNER',
    },
  });
  console.log(`✅ Created user: ${user.id}`);

  // Step 4: Create departments for marketing agency
  console.log('\n🏗️ Creating departments...');
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { id: `${tenant.id}-executive` },
      update: {},
      create: {
        id: `${tenant.id}-executive`,
        name: 'Executive',
        description: 'Executive leadership team',
        status: 'ACTIVE',
        tenantId: tenant.id,
      },
    }),
    prisma.department.upsert({
      where: { id: `${tenant.id}-marketing` },
      update: {},
      create: {
        id: `${tenant.id}-marketing`,
        name: 'Marketing',
        description: 'Marketing and brand management',
        status: 'ACTIVE',
        tenantId: tenant.id,
      },
    }),
    prisma.department.upsert({
      where: { id: `${tenant.id}-sales` },
      update: {},
      create: {
        id: `${tenant.id}-sales`,
        name: 'Sales',
        description: 'Sales and client relations',
        status: 'ACTIVE',
        tenantId: tenant.id,
      },
    }),
    prisma.department.upsert({
      where: { id: `${tenant.id}-operations` },
      update: {},
      create: {
        id: `${tenant.id}-operations`,
        name: 'Operations',
        description: 'Day-to-day operations',
        status: 'ACTIVE',
        tenantId: tenant.id,
      },
    }),
    prisma.department.upsert({
      where: { id: `${tenant.id}-research` },
      update: {},
      create: {
        id: `${tenant.id}-research`,
        name: 'Research & Analytics',
        description: 'Market research and data analytics',
        status: 'ACTIVE',
        tenantId: tenant.id,
      },
    }),
  ]);
  console.log(`✅ Created ${departments.length} departments`);

  // Step 5: Create AI Agents for marketing agency
  console.log('\n🤖 Creating AI Agents...');

  const agentsData = [
    // Executive
    {
      name: 'CEO Agent',
      description:
        'Chief Executive Officer - manages overall company direction',
      type: 'EXECUTIVE',
      departmentId: `${tenant.id}-executive`,
      systemPrompt:
        'You are the CEO of a marketing agency. You oversee all operations, make strategic decisions, and lead morning meetings. You coordinate with all department heads and ensure the company meets its goals.',
      instructions:
        'Lead daily standups, review reports, make strategic decisions, approve client proposals, handle high-level client communications.',
    },
    // Marketing Department
    {
      name: 'Marketing Director',
      description: 'Leads marketing strategy and campaigns',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-marketing`,
      systemPrompt:
        'You are the Marketing Director of a growth marketing agency. You create and manage marketing campaigns, coordinate with creative teams, and report to the CEO.',
      instructions:
        'Plan campaigns, coordinate with team, create marketing reports, manage social media, analyze campaign performance.',
    },
    {
      name: 'Content Creator',
      description: 'Creates marketing content and materials',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-marketing`,
      systemPrompt:
        'You are a Content Creator for a marketing agency. You produce blog posts, social media content, email newsletters, and marketing materials.',
      instructions:
        'Write blog posts, create social media content, draft email campaigns, produce marketing materials.',
    },
    {
      name: 'Social Media Manager',
      description: 'Manages social media presence',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-marketing`,
      systemPrompt:
        'You are a Social Media Manager for a marketing agency. You manage client social media accounts, schedule posts, and engage with followers.',
      instructions:
        'Schedule posts, engage with audience, track metrics, create social strategies.',
    },
    // Sales Department
    {
      name: 'Sales Manager',
      description: 'Manages client acquisition and relationships',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-sales`,
      systemPrompt:
        'You are a Sales Manager for a marketing agency. You prospect new clients, manage existing relationships, and close deals.',
      instructions:
        'Prospect leads, schedule meetings, prepare proposals, negotiate contracts, maintain client relationships.',
    },
    {
      name: 'Account Manager',
      description: 'Manages client accounts and communication',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-sales`,
      systemPrompt:
        'You are an Account Manager for a marketing agency. You maintain client relationships, address concerns, and ensure client satisfaction.',
      instructions:
        'Client communication, project coordination, issue resolution, upselling, account reviews.',
    },
    // Operations
    {
      name: 'Operations Manager',
      description: 'Manages day-to-day operations',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-operations`,
      systemPrompt:
        'You are an Operations Manager for a marketing agency. You ensure smooth daily operations, manage resources, and coordinate teams.',
      instructions:
        'Resource allocation, task management, process optimization, team coordination, scheduling.',
    },
    {
      name: 'Administrative Assistant',
      description: 'Supports executive and team operations',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-operations`,
      systemPrompt:
        'You are an Administrative Assistant for a marketing agency. You support the team with scheduling, communications, and administrative tasks.',
      instructions:
        'Schedule meetings, manage calendars, handle correspondence, coordinate travel, maintain records.',
    },
    // Research & Analytics
    {
      name: 'Research Analyst',
      description: 'Conducts market research and analysis',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-research`,
      systemPrompt:
        'You are a Research Analyst for a marketing agency. You conduct market research, analyze data, and provide insights to guide strategy.',
      instructions:
        'Market research, data analysis, competitor analysis, trend monitoring, report generation.',
    },
    {
      name: 'Data Analyst',
      description: 'Analyzes marketing performance data',
      type: 'FUNCTIONAL',
      departmentId: `${tenant.id}-research`,
      systemPrompt:
        'You are a Data Analyst for a marketing agency. You analyze marketing metrics, create dashboards, and provide performance insights.',
      instructions:
        'Data analysis, KPI tracking, dashboard creation, performance reporting, insights generation.',
    },
  ];

  const agents = await Promise.all(
    agentsData.map((agentData) =>
      prisma.agent.upsert({
        where: {
          id: `${tenant.id}-${agentData.name.toLowerCase().replace(/\s+/g, '-')}`,
        },
        update: { ...agentData, tenantId: tenant.id },
        create: {
          ...agentData,
          id: `${tenant.id}-${agentData.name.toLowerCase().replace(/\s+/g, '-')}`,
          tenantId: tenant.id,
          status: 'IDLE',
          model: 'gpt-4o-mini',
          isActive: true,
          budgetPerDay: 50.0,
          permissions: JSON.stringify([
            'calendar_events',
            'calendar_create_event',
            'send_email',
            'read_email',
            'create_document',
            'read_document',
            'create_spreadsheet',
            'read_spreadsheet',
            'web_search',
            'task_management',
          ]),
        },
      }),
    ),
  );
  console.log(`✅ Created ${agents.length} AI Agents`);

  // Step 6: Create tool integrations for Google Workspace mock
  console.log('\n🔌 Setting up tool integrations...');

  const toolIntegrations = [
    {
      name: 'Google Workspace',
      description:
        'Mock Google Workspace - Calendar, Gmail, Drive, Docs, Sheets',
      category: 'API',
      config: JSON.stringify({
        provider: 'google',
        mockMode: true,
        features: ['calendar', 'gmail', 'drive', 'docs', 'sheets'],
      }),
      isActive: true,
      isBuiltIn: true,
    },
    {
      name: 'Email Service',
      description: 'Email sending and receiving',
      category: 'COMMUNICATION',
      config: JSON.stringify({ provider: 'mock', type: 'email' }),
      isActive: true,
      isBuiltIn: true,
    },
    {
      name: 'Calendar',
      description: 'Calendar management and scheduling',
      category: 'COMMUNICATION',
      config: JSON.stringify({ provider: 'mock', type: 'calendar' }),
      isActive: true,
      isBuiltIn: true,
    },
    {
      name: 'Task Management',
      description: 'Task and project management',
      category: 'CUSTOM',
      config: JSON.stringify({ provider: 'mock', type: 'tasks' }),
      isActive: true,
      isBuiltIn: true,
    },
  ];

  await Promise.all(
    toolIntegrations.map((tool) =>
      prisma.toolIntegration.upsert({
        where: {
          id: `${tenant.id}-${tool.name.toLowerCase().replace(/\s+/g, '-')}`,
        },
        update: { ...tool, tenantId: tenant.id },
        create: {
          ...tool,
          id: `${tenant.id}-${tool.name.toLowerCase().replace(/\s+/g, '-')}`,
          tenantId: tenant.id,
        },
      }),
    ),
  );
  console.log(`✅ Created ${toolIntegrations.length} tool integrations`);

  // Step 7: Create demo workflows mimicking marketing company activities
  console.log('\n📋 Creating demo workflows...');

  const workflowsData = [
    {
      name: 'Morning Standup',
      description:
        'Daily morning meeting workflow - CEO leads standup with all agents',
      definition: JSON.stringify({
        steps: [
          { id: 'start', name: 'Start Meeting', type: 'trigger' },
          {
            id: 'ceo_brief',
            name: 'CEO Briefing',
            type: 'action',
            agent: 'CEO Agent',
          },
          {
            id: 'marketing_update',
            name: 'Marketing Update',
            type: 'action',
            agent: 'Marketing Director',
          },
          {
            id: 'sales_update',
            name: 'Sales Update',
            type: 'action',
            agent: 'Sales Manager',
          },
          {
            id: 'research_update',
            name: 'Research Update',
            type: 'action',
            agent: 'Research Analyst',
          },
          {
            id: 'tasks_assignment',
            name: 'Task Assignment',
            type: 'action',
            agent: 'Operations Manager',
          },
          { id: 'end', name: 'End Meeting', type: 'completion' },
        ],
      }),
      status: 'ACTIVE',
    },
    {
      name: 'Client Onboarding',
      description:
        'New client onboarding workflow - from signup to campaign launch',
      definition: JSON.stringify({
        steps: [
          { id: 'start', name: 'New Client Signup', type: 'trigger' },
          {
            id: 'welcome_email',
            name: 'Send Welcome Email',
            type: 'action',
            tool: 'email_send',
          },
          {
            id: 'setup_account',
            name: 'Setup Account',
            type: 'action',
            agent: 'Account Manager',
          },
          {
            id: 'kickoff_meeting',
            name: 'Schedule Kickoff',
            type: 'action',
            tool: 'calendar',
          },
          {
            id: 'research',
            name: 'Market Research',
            type: 'action',
            agent: 'Research Analyst',
          },
          {
            id: 'strategy',
            name: 'Create Strategy',
            type: 'action',
            agent: 'Marketing Director',
          },
          {
            id: 'launch',
            name: 'Launch Campaign',
            type: 'action',
            agent: 'Content Creator',
          },
          { id: 'end', name: 'Complete Onboarding', type: 'completion' },
        ],
      }),
      status: 'ACTIVE',
    },
    {
      name: 'Weekly Report Generation',
      description: 'Generate weekly performance reports for all clients',
      definition: JSON.stringify({
        steps: [
          { id: 'start', name: 'Start Report', type: 'trigger' },
          {
            id: 'collect_data',
            name: 'Collect Metrics',
            type: 'action',
            agent: 'Data Analyst',
          },
          {
            id: 'analyze',
            name: 'Analyze Performance',
            type: 'action',
            agent: 'Research Analyst',
          },
          {
            id: 'create_report',
            name: 'Create Report Doc',
            type: 'action',
            tool: 'document',
          },
          {
            id: 'update_spreadsheet',
            name: 'Update Spreadsheet',
            type: 'action',
            tool: 'spreadsheet',
          },
          {
            id: 'email_client',
            name: 'Email to Client',
            type: 'action',
            tool: 'email_send',
          },
          { id: 'end', name: 'Complete', type: 'completion' },
        ],
      }),
      status: 'ACTIVE',
    },
    {
      name: 'Lead Follow-up',
      description: 'Follow up with leads and nurture through sales funnel',
      definition: JSON.stringify({
        steps: [
          { id: 'start', name: 'New Lead', type: 'trigger' },
          {
            id: 'research_lead',
            name: 'Research Lead',
            type: 'action',
            agent: 'Research Analyst',
          },
          {
            id: 'initial_contact',
            name: 'Initial Contact',
            type: 'action',
            agent: 'Sales Manager',
          },
          {
            id: 'schedule_call',
            name: 'Schedule Call',
            type: 'action',
            tool: 'calendar',
          },
          {
            id: 'follow_up',
            name: 'Follow Up',
            type: 'action',
            agent: 'Account Manager',
          },
          {
            id: 'proposal',
            name: 'Send Proposal',
            type: 'action',
            agent: 'Sales Manager',
          },
          { id: 'end', name: 'Complete', type: 'completion' },
        ],
      }),
      status: 'ACTIVE',
    },
    {
      name: 'Content Marketing',
      description: 'Content creation and distribution workflow',
      definition: JSON.stringify({
        steps: [
          { id: 'start', name: 'Content Plan', type: 'trigger' },
          {
            id: 'research_topics',
            name: 'Research Topics',
            type: 'action',
            agent: 'Research Analyst',
          },
          {
            id: 'create_content',
            name: 'Create Content',
            type: 'action',
            agent: 'Content Creator',
          },
          {
            id: 'review',
            name: 'Review Content',
            type: 'action',
            agent: 'Marketing Director',
          },
          {
            id: 'publish',
            name: 'Publish & Distribute',
            type: 'action',
            agent: 'Social Media Manager',
          },
          {
            id: 'track',
            name: 'Track Performance',
            type: 'action',
            agent: 'Data Analyst',
          },
          { id: 'end', name: 'Complete', type: 'completion' },
        ],
      }),
      status: 'ACTIVE',
    },
  ];

  await Promise.all(
    workflowsData.map((workflow) =>
      prisma.workflow.upsert({
        where: {
          id: `${tenant.id}-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`,
        },
        update: { ...workflow, tenantId: tenant.id },
        create: {
          ...workflow,
          id: `${tenant.id}-${workflow.name.toLowerCase().replace(/\s+/g, '-')}`,
          tenantId: tenant.id,
        },
      }),
    ),
  );
  console.log(`✅ Created ${workflowsData.length} workflows`);

  // Step 8: Create demo tasks mimicking daily activities
  console.log('\n📝 Creating demo tasks...');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const tasksData = [
    // CEO Tasks
    {
      title: 'Morning Standup Meeting',
      description: 'Lead daily standup with all department heads',
      status: 'PENDING',
      priority: 'HIGH',
      scheduledAt: new Date(today.setHours(9, 0, 0, 0)),
      agentId: `${tenant.id}-ceo-agent`,
    },
    {
      title: 'Review Weekly Reports',
      description: 'Review and approve weekly client performance reports',
      status: 'PENDING',
      priority: 'MEDIUM',
      scheduledAt: new Date(today.setHours(14, 0, 0, 0)),
      agentId: `${tenant.id}-ceo-agent`,
    },
    {
      title: 'Client Call - Acme Corp',
      description: 'Quarterly check-in call with Acme Corp client',
      status: 'PENDING',
      priority: 'HIGH',
      scheduledAt: new Date(tomorrow.setHours(11, 0, 0, 0)),
      agentId: `${tenant.id}-ceo-agent`,
    },
    // Marketing Tasks
    {
      title: 'Create Campaign Strategy',
      description:
        'Develop Q2 marketing campaign strategy for TechStart client',
      status: 'PENDING',
      priority: 'HIGH',
      scheduledAt: new Date(today.setHours(10, 0, 0, 0)),
      agentId: `${tenant.id}-marketing-director`,
    },
    {
      title: 'Blog Post Draft - SEO Trends',
      description:
        'Write blog post about latest SEO trends for content marketing',
      status: 'PENDING',
      priority: 'MEDIUM',
      scheduledAt: new Date(today.setHours(13, 0, 0, 0)),
      agentId: `${tenant.id}-content-creator`,
    },
    {
      title: 'Social Media Schedule',
      description: 'Schedule next week social media posts for all clients',
      status: 'PENDING',
      priority: 'MEDIUM',
      scheduledAt: new Date(today.setHours(15, 0, 0, 0)),
      agentId: `${tenant.id}-social-media-manager`,
    },
    // Sales Tasks
    {
      title: 'Prospect New Leads',
      description:
        'Research and reach out to 10 new potential clients in SaaS space',
      status: 'PENDING',
      priority: 'HIGH',
      scheduledAt: new Date(today.setHours(9, 30, 0, 0)),
      agentId: `${tenant.id}-sales-manager`,
    },
    {
      title: 'Follow up with TechCorp',
      description: 'Follow up on proposal sent to TechCorp last week',
      status: 'PENDING',
      priority: 'HIGH',
      scheduledAt: new Date(today.setHours(11, 0, 0, 0)),
      agentId: `${tenant.id}-account-manager`,
    },
    {
      title: 'Prepare Sales Report',
      description: 'Prepare monthly sales pipeline report for CEO',
      status: 'PENDING',
      priority: 'MEDIUM',
      scheduledAt: new Date(today.setHours(16, 0, 0, 0)),
      agentId: `${tenant.id}-sales-manager`,
    },
    // Operations Tasks
    {
      title: 'Team Resource Allocation',
      description: 'Review and allocate team resources for next week projects',
      status: 'PENDING',
      priority: 'MEDIUM',
      scheduledAt: new Date(today.setHours(10, 30, 0, 0)),
      agentId: `${tenant.id}-operations-manager`,
    },
    {
      title: 'Schedule Team Meetings',
      description: 'Coordinate and schedule team meetings for the week',
      status: 'PENDING',
      priority: 'LOW',
      scheduledAt: new Date(today.setHours(14, 30, 0, 0)),
      agentId: `${tenant.id}-administrative-assistant`,
    },
    // Research Tasks
    {
      title: 'Competitor Analysis',
      description: 'Complete competitive analysis for DigitalFirst client',
      status: 'PENDING',
      priority: 'HIGH',
      scheduledAt: new Date(today.setHours(9, 0, 0, 0)),
      agentId: `${tenant.id}-research-analyst`,
    },
    {
      title: 'Analytics Dashboard Update',
      description: 'Update performance dashboards with latest metrics',
      status: 'PENDING',
      priority: 'MEDIUM',
      scheduledAt: new Date(today.setHours(12, 0, 0, 0)),
      agentId: `${tenant.id}-data-analyst`,
    },
    {
      title: 'Market Trends Report',
      description: 'Research and compile monthly market trends report',
      status: 'PENDING',
      priority: 'MEDIUM',
      scheduledAt: new Date(nextWeek.setHours(17, 0, 0, 0)),
      agentId: `${tenant.id}-research-analyst`,
    },
  ];

  await Promise.all(
    tasksData.map((task) =>
      prisma.task.upsert({
        where: {
          id: `${tenant.id}-${task.title.toLowerCase().replace(/\s+/g, '-')}`,
        },
        update: { ...task, tenantId: tenant.id },
        create: {
          ...task,
          id: `${tenant.id}-${task.title.toLowerCase().replace(/\s+/g, '-')}`,
          tenantId: tenant.id,
          input: JSON.stringify({ createdFrom: 'demo-setup' }),
        },
      }),
    ),
  );
  console.log(`✅ Created ${tasksData.length} demo tasks`);

  // Step 9: Create goals for the marketing company (SKIPPED - table doesn't exist in DB)
  console.log(
    '\n🎯 Creating company goals (skipped - goals table needs migration)...',
  );
  // Goals creation requires database migration first
  // const goalsData = [...];
  console.log('✅ Goals creation skipped (table pending migration)');

  // Step 10: Create provisioning config (SKIPPED - table doesn't exist in DB)
  console.log(
    '\n☁️ Setting up workspace provisioning (skipped - provisioning tables need migration)...',
  );
  console.log('✅ Workspace provisioning skipped (table pending migration)');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Demo Tenant Setup Complete!');
  console.log('='.repeat(60));
  console.log(`\n📧 Login Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log(`🏢 Tenant: ${tenantName} (${slug})`);
  console.log(`🔗 URL: http://localhost:3000`);
  console.log('\n📊 Created:');
  console.log(`  - ${departments.length} Departments`);
  console.log(`  - ${agents.length} AI Agents`);
  console.log(`  - ${workflowsData.length} Workflows`);
  console.log(`  - ${tasksData.length} Tasks`);
  console.log(`  - 0 Goals (pending migration)`);
  console.log('\n🤖 AI Agents Available:');
  agents.forEach((a) => console.log(`  - ${a.name}`));
  console.log('\n✅ All systems ready for testing!');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  console.error(err.stack);
  prisma.$disconnect();
  process.exit(1);
});

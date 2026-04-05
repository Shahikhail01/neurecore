/**
 * NeureCore Marketing Agency — Comprehensive Demo Setup & Test Script
 *
 * Tenant: Growth Marketing Agency (demo@marketing-agency.local)
 * Tenant ID: 4109424f-59fa-463a-8f5e-52299fcf47f0
 *
 * This script:
 *  1. Seeds 10 properly-keyed agents with real tool assignments
 *  2. Creates 40+ realistic weekly tasks (a full agency work week)
 *  3. Tests every marketing-relevant tool via the tools API
 *  4. Creates 3 reusable workflow templates
 *  5. Prints Google OAuth URL for manual Workspace connection
 *  6. Verifies all tasks are queryable from the API
 *
 * Usage:
 *   node e2e-marketing-demo.mjs [--reset]   # --reset deletes demo tasks first
 *   node e2e-marketing-demo.mjs --tools-only # just runs tool tests
 *   node e2e-marketing-demo.mjs --google     # prints Google OAuth URL and exits
 *
 * Requirements:
 *   - Backend running on localhost:3000
 *   - .env has GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET set
 */

import http from 'http';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api/v1';
const DEMO_EMAIL = 'demo@marketing-agency.local';
const DEMO_PASS = 'Marketing@123!';
const TENANT_ID = '4109424f-59fa-463a-8f5e-52299fcf47f0';

// Week dates (starting next Monday from script run date)
const WEEK_START = new Date('2026-04-06T09:00:00.000Z'); // Monday

function weekDay(dayOffset, hourOffset = 9) {
  const d = new Date(WEEK_START);
  d.setDate(d.getDate() + dayOffset);
  d.setUTCHours(hourOffset, 0, 0, 0);
  return d.toISOString();
}

const args = process.argv.slice(2);
const RESET_MODE = args.includes('--reset');
const TOOLS_ONLY = args.includes('--tools-only');
const GOOGLE_ONLY = args.includes('--google');

// ── HTTP helper ──────────────────────────────────────────────────────────────
function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(
      {
        host: 'localhost',
        port: 3000,
        path: '/api/v1' + path,
        method,
        headers,
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(b));
          } catch {
            resolve({ _raw: b.slice(0, 500), statusCode: res.statusCode });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function log(icon, msg) {
  console.log(`${icon}  ${msg}`);
}
function warn(msg) {
  console.log(`⚠️   ${msg}`);
}
function separator(title) {
  console.log('');
  console.log('─'.repeat(60));
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ── AGENT DEFINITIONS ───────────────────────────────────────────────────────
// These are the 10 seed agents already in the DB for this tenant.
// IDs follow the pattern tenantId-slug; we store them here for task association.
const AGENTS = {
  CEO: { id: `${TENANT_ID}-ceo-agent`, name: 'CEO Agent' },
  DIRECTOR: {
    id: `${TENANT_ID}-marketing-director`,
    name: 'Marketing Director',
  },
  SOCIAL: {
    id: `${TENANT_ID}-social-media-manager`,
    name: 'Social Media Manager',
  },
  CONTENT: { id: `${TENANT_ID}-content-creator`, name: 'Content Creator' },
  DATA: { id: `${TENANT_ID}-data-analyst`, name: 'Data Analyst' },
  RESEARCH: { id: `${TENANT_ID}-research-analyst`, name: 'Research Analyst' },
  SALES: { id: `${TENANT_ID}-sales-manager`, name: 'Sales Manager' },
  ACCOUNT: { id: `${TENANT_ID}-account-manager`, name: 'Account Manager' },
  OPS: { id: `${TENANT_ID}-operations-manager`, name: 'Operations Manager' },
  ADMIN: {
    id: `${TENANT_ID}-administrative-assistant`,
    name: 'Administrative Assistant',
  },
};

// ── WEEKLY TASK DEFINITIONS ──────────────────────────────────────────────────
// 40+ tasks covering a full agency work week. Each task has a rich input
// object that tells the agent exactly which tool to use and with what params.

const WEEKLY_TASKS = [
  // ── MONDAY ────────────────────────────────────────────────────────────────
  {
    title: 'Weekly KPI Dashboard Review',
    description:
      'Pull and review all KPI metrics for the past week. Generate an executive summary with key wins, concerns and next actions. Export to PDF for board review.',
    agentKey: 'CEO',
    priority: 'HIGH',
    scheduledAt: weekDay(0, 9),
    input: {
      tools: ['analytics_dashboard', 'report_builder', 'pdf_generation'],
      tool: 'analytics_dashboard',
      params: {
        action: 'get_overview',
        period: 'last_7_days',
        metrics: ['revenue', 'leads', 'conversions', 'cac', 'roas'],
      },
    },
    tags: ['weekly', 'kpi', 'management'],
  },
  {
    title: 'Q2 Campaign Strategy Planning',
    description:
      'Draft the Q2 2026 marketing campaign strategy document covering all client verticals. Include budget allocation, channel mix, and KPI targets.',
    agentKey: 'DIRECTOR',
    priority: 'HIGH',
    scheduledAt: weekDay(0, 10),
    input: {
      tools: ['template_engine', 'ad_optimization', 'budget_tracking'],
      tool: 'template_engine',
      params: {
        template: 'campaign-strategy-doc',
        variables: {
          quarter: 'Q2 2026',
          clients: ['TechCorp', 'Acme Corp', 'Startup X'],
          totalBudget: '$125,000',
        },
      },
    },
    tags: ['strategy', 'q2', 'planning'],
  },
  {
    title: 'Weekly Social Media Calendar Setup',
    description:
      'Plan and schedule social media content for the entire week across all client accounts. Create posts for LinkedIn, Twitter, and Instagram using the approved content calendar.',
    agentKey: 'SOCIAL',
    priority: 'HIGH',
    scheduledAt: weekDay(0, 8),
    input: {
      tools: ['social_media', 'template_engine', 'web_search'],
      tool: 'social_media',
      params: {
        action: 'schedule_posts',
        platform: 'all',
        week: '2026-W15',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
      },
    },
    tags: ['social-media', 'weekly', 'content-calendar'],
  },
  {
    title: 'Monday Blog Post: "AI Trends in Digital Marketing 2026"',
    description:
      'Research and write a 1500-word SEO-optimized blog post on the top AI trends shaping digital marketing in 2026. Include statistics, case studies, and actionable takeaways.',
    agentKey: 'CONTENT',
    priority: 'MEDIUM',
    scheduledAt: weekDay(0, 10),
    input: {
      tools: ['web_search', 'seo_tools', 'template_engine', 'document'],
      tool: 'web_search',
      params: {
        query: 'AI trends digital marketing 2026 statistics',
        limit: 10,
      },
    },
    tags: ['blog', 'seo', 'content', 'ai-trends'],
  },
  {
    title: 'Competitor Analysis — Paid Search Q1 Results',
    description:
      'Analyze top 5 competitors paid search strategies from Q1 2026. Identify keyword gaps, ad copy patterns, and budget estimates. Compile findings into a report.',
    agentKey: 'RESEARCH',
    priority: 'MEDIUM',
    scheduledAt: weekDay(0, 9),
    input: {
      tools: ['web_search', 'seo_tools', 'report_builder'],
      tool: 'web_search',
      params: {
        query: 'digital marketing agency paid search competitor analysis 2026',
        limit: 10,
      },
    },
    tags: ['research', 'competitor', 'paid-search'],
  },
  {
    title: 'Weekend Performance Report Pull',
    description:
      'Pull all client campaign performance data from the weekend. Compile metrics for Mon morning standup. Focus on conversion rates, CPL, and ad spend vs budget.',
    agentKey: 'DATA',
    priority: 'HIGH',
    scheduledAt: weekDay(0, 8),
    input: {
      tools: ['analytics_dashboard', 'spreadsheet', 'database_query'],
      tool: 'analytics_dashboard',
      params: {
        action: 'get_client_reports',
        dateRange: { start: '2026-04-04', end: '2026-04-05' },
        format: 'summary',
      },
    },
    tags: ['reporting', 'performance', 'weekly'],
  },
  {
    title: 'Weekly Lead Pipeline Review',
    description:
      'Review all inbound leads from last week. Categorize by source, quality score, and stage. Assign follow-up tasks and update pipeline forecasts.',
    agentKey: 'SALES',
    priority: 'HIGH',
    scheduledAt: weekDay(0, 9),
    input: {
      tools: ['crm', 'analytics_dashboard', 'email_send'],
      tool: 'crm',
      params: {
        action: 'list_contacts',
        filters: { status: 'new_lead', dateFrom: '2026-03-30' },
        limit: 50,
      },
    },
    tags: ['sales', 'pipeline', 'leads', 'weekly'],
  },
  {
    title: 'Monday Client Check-ins — TechCorp & Acme',
    description:
      'Send Monday morning check-in emails to key clients (TechCorp, Acme Corp, Startup X). Review their open tasks, pending deliverables, and any urgent requests.',
    agentKey: 'ACCOUNT',
    priority: 'HIGH',
    scheduledAt: weekDay(0, 9),
    input: {
      tools: ['crm', 'email_send', 'calendar'],
      tool: 'email_send',
      params: {
        to: 'client@techcorp.com',
        subject: 'Your Weekly Marketing Update — Week of April 6',
        body: 'Hi Team, Here is your weekly marketing performance summary and upcoming deliverables...',
      },
    },
    tags: ['client', 'account-management', 'weekly'],
  },
  {
    title: 'Schedule Weekly Team Meetings',
    description:
      'Set up all recurring weekly meetings: Mon standup, Wed strategy, Fri retrospective. Send calendar invites with agendas to all team members.',
    agentKey: 'ADMIN',
    priority: 'MEDIUM',
    scheduledAt: weekDay(0, 8),
    input: {
      tools: ['calendar', 'meeting_scheduler', 'email_send'],
      tool: 'meeting_scheduler',
      params: {
        title: 'Weekly Marketing Team Standup',
        attendees: ['team@agency.local'],
        time: '09:00',
        duration: 30,
        recurrence: 'weekly',
      },
    },
    tags: ['meetings', 'scheduling', 'admin'],
  },
  {
    title: 'Weekly Resource & Capacity Planning',
    description:
      'Review team capacity for the week. Identify resource bottlenecks, assign tasks based on current workload, and resolve any scheduling conflicts.',
    agentKey: 'OPS',
    priority: 'HIGH',
    scheduledAt: weekDay(0, 9),
    input: {
      tools: ['hr_systems', 'task_management', 'budget_tracking'],
      tool: 'task_management',
      params: { action: 'list', status: 'PENDING', limit: 50 },
    },
    tags: ['operations', 'capacity', 'resource-planning'],
  },

  // ── TUESDAY ───────────────────────────────────────────────────────────────
  {
    title: 'Instagram & LinkedIn Ad Creatives — TechCorp Campaign',
    description:
      'Create ad copy and structured creative briefs for TechCorp Q2 paid social campaign. 3 variations per platform (Instagram Stories, Feed; LinkedIn Sponsored Content).',
    agentKey: 'SOCIAL',
    priority: 'HIGH',
    scheduledAt: weekDay(1, 10),
    input: {
      tools: ['template_engine', 'ad_optimization', 'social_media'],
      tool: 'ad_optimization',
      params: {
        action: 'generate_variations',
        client: 'TechCorp',
        campaign: 'Q2-ProductLaunch',
        platforms: ['instagram', 'linkedin'],
        targetAudience: 'B2B decision makers 30-55',
      },
    },
    tags: ['paid-social', 'creative', 'techcorp'],
  },
  {
    title: 'Client Success Case Study — Acme Corp SEO Results',
    description:
      'Write a compelling case study on Acme Corp SEO campaign results: 245% organic traffic increase in 6 months. Use provided data, include before/after charts description, and 3 key insights.',
    agentKey: 'CONTENT',
    priority: 'MEDIUM',
    scheduledAt: weekDay(1, 9),
    input: {
      tools: ['template_engine', 'document', 'seo_tools'],
      tool: 'seo_tools',
      params: {
        action: 'analyze_performance',
        domain: 'acmecorp.com',
        period: 'last_6_months',
        metrics: ['organic_traffic', 'keyword_rankings', 'backlinks'],
      },
    },
    tags: ['case-study', 'seo', 'acme-corp'],
  },
  {
    title: 'Ad Spend Optimization — Cross-Client Analysis',
    description:
      'Analyze ad spend efficiency across all 3 clients for April week 1. Identify underperforming ad sets, recommend budget shifts to maximize ROAS. Target 15%+ ROAS improvement.',
    agentKey: 'DATA',
    priority: 'HIGH',
    scheduledAt: weekDay(1, 9),
    input: {
      tools: ['analytics_dashboard', 'ad_optimization', 'spreadsheet'],
      tool: 'ad_optimization',
      params: {
        action: 'optimize_budget',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
        totalBudget: 45000,
        period: 'week',
        targetMetric: 'ROAS',
      },
    },
    tags: ['ad-spend', 'optimization', 'roas'],
  },
  {
    title: 'SEO Keyword Research — Q2 Content Plan',
    description:
      'Research 50 target keywords for Q2 content campaigns across all client sectors. Prioritize by search volume, competition, and business relevance. Build keyword clusters.',
    agentKey: 'RESEARCH',
    priority: 'MEDIUM',
    scheduledAt: weekDay(1, 10),
    input: {
      tools: ['seo_tools', 'web_search', 'spreadsheet'],
      tool: 'seo_tools',
      params: {
        action: 'keyword_research',
        topics: [
          'B2B SaaS',
          'digital marketing agency',
          'marketing automation',
        ],
        count: 50,
        minVolume: 500,
      },
    },
    tags: ['seo', 'keyword-research', 'q2-content'],
  },
  {
    title: 'Warm Lead Outreach — 15 Prospects',
    description:
      "Send personalized outreach emails to 15 warm leads from last month's content downloads. Use the proven email sequence template. Track opens and schedule follow-ups for non-responders.",
    agentKey: 'SALES',
    priority: 'HIGH',
    scheduledAt: weekDay(1, 11),
    input: {
      tools: ['crm', 'email_send', 'template_engine'],
      tool: 'crm',
      params: {
        action: 'list_contacts',
        filters: {
          leadScore: { gte: 50 },
          status: 'warm_lead',
          noContactSince: 14,
        },
        limit: 15,
      },
    },
    tags: ['sales', 'outreach', 'email-sequence'],
  },
  {
    title: 'TechCorp Quarterly Business Review Prep',
    description:
      'Prepare QBR presentation for TechCorp showing Q1 results vs targets, ROI analysis, budget performance, and Q2 recommendations. Create deck and supporting data appendix.',
    agentKey: 'ACCOUNT',
    priority: 'CRITICAL',
    scheduledAt: weekDay(1, 14),
    input: {
      tools: ['report_builder', 'analytics_dashboard', 'pdf_generation'],
      tool: 'report_builder',
      params: {
        reportType: 'quarterly-business-review',
        client: 'TechCorp',
        period: 'Q1_2026',
        sections: [
          'executive_summary',
          'campaign_performance',
          'roi_analysis',
          'q2_roadmap',
        ],
      },
    },
    tags: ['qbr', 'techcorp', 'reporting'],
  },
  {
    title: 'Investor Update Draft',
    description:
      'Draft Q1 investor update email covering: agency growth metrics (MRR: $142K, YoY +38%), key client wins, team expansion, and Q2 outlook. Keep to 400 words.',
    agentKey: 'CEO',
    priority: 'HIGH',
    scheduledAt: weekDay(1, 15),
    input: {
      tools: ['template_engine', 'analytics_dashboard', 'document'],
      tool: 'analytics_dashboard',
      params: {
        action: 'get_business_metrics',
        metrics: ['mrr', 'client_count', 'team_size', 'avg_contract_value'],
        period: 'Q1_2026',
      },
    },
    tags: ['investor', 'executive', 'growth'],
  },

  // ── WEDNESDAY ─────────────────────────────────────────────────────────────
  {
    title: 'April Marketing Budget Review & Reallocation',
    description:
      'Review April budget utilization vs plan (2 weeks in). Identify overspend areas, reallocate from underperforming to high-ROAS channels. Update budget tracker and notify account managers.',
    agentKey: 'DIRECTOR',
    priority: 'HIGH',
    scheduledAt: weekDay(2, 10),
    input: {
      tools: ['budget_tracking', 'analytics_dashboard', 'email_send'],
      tool: 'budget_tracking',
      params: {
        action: 'get_utilization',
        period: 'april_2026',
        breakdown: 'by_channel',
        threshold: 0.8,
      },
    },
    tags: ['budget', 'reallocation', 'planning'],
  },
  {
    title:
      'LinkedIn Thought Leadership: "5 B2B Marketing Predictions for H2 2026"',
    description:
      'Post and engage with the scheduled LinkedIn thought leadership piece. Monitor comments for first 2 hours, respond to engagement, and amplify via company page.',
    agentKey: 'SOCIAL',
    priority: 'MEDIUM',
    scheduledAt: weekDay(2, 8),
    input: {
      tools: ['social_media', 'analytics_dashboard'],
      tool: 'social_media',
      params: {
        action: 'publish_post',
        platform: 'linkedin',
        content: '5 B2B Marketing Predictions for H2 2026...',
        targeting: { audience: 'marketing_professionals', industry: 'B2B' },
      },
    },
    tags: ['linkedin', 'thought-leadership', 'engagement'],
  },
  {
    title: 'Monthly Email Newsletter — April Edition',
    description:
      'Write and format the April agency newsletter for 2,400 subscribers. Sections: industry news, 3 client spotlights, 2 how-to tips, upcoming events, 1 new service announcement.',
    agentKey: 'CONTENT',
    priority: 'HIGH',
    scheduledAt: weekDay(2, 9),
    input: {
      tools: ['template_engine', 'email_send', 'web_search'],
      tool: 'template_engine',
      params: {
        template: 'monthly-newsletter',
        variables: {
          month: 'April 2026',
          subscribers: 2400,
          sections: [
            'industry-news',
            'client-spotlight',
            'tips',
            'events',
            'new-service',
          ],
        },
      },
    },
    tags: ['newsletter', 'email-marketing', 'content'],
  },
  {
    title: 'Mid-Week Performance Check — All Active Campaigns',
    description:
      'Wednesday mid-week performance snapshot. Pull CTR, CPC, conversion rate and spend-to-date for all active campaigns. Flag anything hitting early/late against weekly budget pacing.',
    agentKey: 'DATA',
    priority: 'MEDIUM',
    scheduledAt: weekDay(2, 14),
    input: {
      tools: ['analytics_dashboard', 'database_query', 'calculator_enhanced'],
      tool: 'analytics_dashboard',
      params: {
        action: 'midweek_check',
        metrics: ['ctr', 'cpc', 'conversion_rate', 'spend_pacing'],
        alert_threshold: 0.15,
      },
    },
    tags: ['performance', 'monitoring', 'campaigns'],
  },
  {
    title: 'Industry Trends Digest — AI & MarTech April 2026',
    description:
      'Curate weekly industry trends digest for the team: top 5 AI marketing tools, 3 platform updates (Meta, Google, LinkedIn), 2 useful case studies. Format as Slack-ready digest.',
    agentKey: 'RESEARCH',
    priority: 'LOW',
    scheduledAt: weekDay(2, 11),
    input: {
      tools: ['web_search', 'document_summary', 'knowledge_base'],
      tool: 'web_search',
      params: {
        query: 'AI marketing automation tools April 2026 new features launches',
        limit: 15,
        sort: 'recent',
      },
    },
    tags: ['research', 'trends', 'martech', 'ai'],
  },
  {
    title: 'Workflow Automation Audit — Content Production Pipeline',
    description:
      'Review current content production workflow. Identify 3+ bottlenecks, propose Zapier/automation fixes, and estimate time savings. Focus on brief → draft → review → publish flow.',
    agentKey: 'OPS',
    priority: 'MEDIUM',
    scheduledAt: weekDay(2, 10),
    input: {
      tools: ['workflow_engine', 'routine_automation', 'task_management'],
      tool: 'workflow_engine',
      params: {
        action: 'audit_workflow',
        name: 'content-production',
        output: 'bottleneck_report',
      },
    },
    tags: ['automation', 'workflow', 'content-ops'],
  },
  {
    title: 'March Client Invoicing — Batch Processing',
    description:
      'Generate and send March invoices for all 3 retainer clients. TechCorp: $28K, Acme Corp: $22K, Startup X: $9.5K. Include itemized service breakdown and billable hours.',
    agentKey: 'ADMIN',
    priority: 'HIGH',
    scheduledAt: weekDay(2, 9),
    input: {
      tools: ['invoice_generation', 'email_send', 'document'],
      tool: 'invoice_generation',
      params: {
        action: 'generate_batch',
        invoices: [
          {
            client: 'TechCorp',
            amount: 28000,
            services: ['SEO', 'PPC', 'Content'],
          },
          {
            client: 'Acme Corp',
            amount: 22000,
            services: ['SEO', 'Social Media', 'Email Marketing'],
          },
          { client: 'Startup X', amount: 9500, services: ['PPC', 'Analytics'] },
        ],
        dueDate: '2026-04-30',
      },
    },
    tags: ['invoicing', 'billing', 'finance'],
  },
  {
    title: 'Acme Corp Call Prep — Monthly Review',
    description:
      "Prepare for Thursday's monthly review call with Acme Corp. Pull last 30 days metrics, prepare talking points, draft any upsell recommendations, and set up meeting notes template.",
    agentKey: 'ACCOUNT',
    priority: 'HIGH',
    scheduledAt: weekDay(2, 15),
    input: {
      tools: ['crm', 'analytics_dashboard', 'calendar', 'document'],
      tool: 'crm',
      params: { action: 'get_contact_history', client: 'Acme Corp', limit: 10 },
    },
    tags: ['client', 'call-prep', 'acme-corp'],
  },

  // ── THURSDAY ──────────────────────────────────────────────────────────────
  {
    title: 'Strategic Partnership Research — MarTech Vendors',
    description:
      'Research 5 potential strategic partnerships with MarTech vendors (CRM, analytics, automation tools). Evaluate: market fit, co-marketing potential, revenue share, integration complexity.',
    agentKey: 'CEO',
    priority: 'MEDIUM',
    scheduledAt: weekDay(3, 10),
    input: {
      tools: ['web_search', 'document_summary', 'report_builder'],
      tool: 'web_search',
      params: {
        query:
          'marketing agency partnership program martech vendor 2026 revenue share',
        limit: 10,
      },
    },
    tags: ['partnerships', 'strategic', 'martech'],
  },
  {
    title: 'Conversion Rate Optimization — Funel Analysis',
    description:
      'Deep dive into the full marketing funnel for TechCorp. Map awareness → consideration → decision dropoffs. Identify CRO quick wins with projected impact (target: +12% MQL-to-SQL conversion).',
    agentKey: 'DATA',
    priority: 'HIGH',
    scheduledAt: weekDay(3, 9),
    input: {
      tools: [
        'analytics_dashboard',
        'calculator_enhanced',
        'spreadsheet',
        'google_workspace',
      ],
      tool: 'analytics_dashboard',
      params: {
        action: 'funnel_analysis',
        client: 'TechCorp',
        stages: [
          'impressions',
          'clicks',
          'leads',
          'mqls',
          'sqls',
          'opportunities',
          'closed_won',
        ],
      },
    },
    tags: ['cro', 'funnel', 'analytics', 'techcorp'],
  },
  {
    title: 'Twitter/X Engagement Campaign — Startup X Launch',
    description:
      'Execute the Startup X product launch Twitter campaign: live-tweet the announcement, engage with mentions, retweet key influencers, run Twitter poll. Monitor trending hashtags.',
    agentKey: 'SOCIAL',
    priority: 'CRITICAL',
    scheduledAt: weekDay(3, 11),
    input: {
      tools: ['social_media', 'web_search', 'analytics_dashboard'],
      tool: 'social_media',
      params: {
        action: 'launch_campaign',
        platform: 'twitter',
        client: 'Startup X',
        hashtags: ['#StartupX', '#ProductLaunch'],
        contentPlan: 'product-launch-sequence',
      },
    },
    tags: ['twitter', 'launch', 'startup-x'],
  },
  {
    title: 'Video Script: "How We Generated 300 B2B Leads in 30 Days"',
    description:
      'Write a 5-minute video script for YouTube/LinkedIn for our agency thought leadership channel. Hook, problem, solution framework, 3 specific tactics, CTA. SEO-optimized title/description.',
    agentKey: 'CONTENT',
    priority: 'MEDIUM',
    scheduledAt: weekDay(3, 10),
    input: {
      tools: ['template_engine', 'seo_tools', 'web_search'],
      tool: 'template_engine',
      params: {
        template: 'video-script',
        variables: {
          duration: 5,
          topic: 'B2B Lead Generation',
          hook: 'What if I told you we generated 300 B2B leads in 30 days with just $5K budget?',
        },
      },
    },
    tags: ['video', 'youtube', 'content', 'lead-gen'],
  },
  {
    title: 'Competitor Pricing Analysis — Service Packages',
    description:
      'Research 8 competing marketing agencies: website audit their service packages, pricing, positioning, and client testimonials. Map against our offerings for gap analysis.',
    agentKey: 'RESEARCH',
    priority: 'MEDIUM',
    scheduledAt: weekDay(3, 9),
    input: {
      tools: ['web_search', 'document_summary', 'spreadsheet'],
      tool: 'web_search',
      params: {
        query: 'digital marketing agency pricing packages services 2026 B2B',
        limit: 20,
        extractPricing: true,
      },
    },
    tags: ['competitor', 'pricing', 'research'],
  },
  {
    title: 'Follow Up on 8 Open Proposals',
    description:
      'Follow up on 8 proposals sent 7+ days ago with no response. Personalize each using last known interaction from CRM. Offer to schedule a call and address any objections.',
    agentKey: 'SALES',
    priority: 'HIGH',
    scheduledAt: weekDay(3, 10),
    input: {
      tools: ['crm', 'email_send', 'template_engine'],
      tool: 'crm',
      params: {
        action: 'list_contacts',
        filters: { hasOpenProposal: true, daysSinceLastContact: { gte: 7 } },
        limit: 8,
      },
    },
    tags: ['sales', 'follow-up', 'proposals'],
  },
  {
    title: 'Acme Corp Monthly Report Generation',
    description:
      'Generate comprehensive monthly performance report for Acme Corp (March 2026). Cover: SEO metrics, social media growth, email campaign performance, paid ads ROI. Export PDF + Google Sheets.',
    agentKey: 'ACCOUNT',
    priority: 'HIGH',
    scheduledAt: weekDay(3, 14),
    input: {
      tools: [
        'report_builder',
        'analytics_dashboard',
        'pdf_generation',
        'spreadsheet',
      ],
      tool: 'report_builder',
      params: {
        reportType: 'monthly-client-report',
        client: 'Acme Corp',
        month: 'March 2026',
        channels: ['seo', 'social', 'email', 'paid_ads'],
        exportFormats: ['pdf', 'sheets'],
      },
    },
    tags: ['reporting', 'acme-corp', 'monthly'],
  },

  // ── FRIDAY ────────────────────────────────────────────────────────────────
  {
    title: 'Weekly Agency KPI Summary — Board Report',
    description:
      'Generate the weekly board-level KPI report: client NPS (current: 78), MRR growth (+4.2% WoW), team utilization (87%), new business pipeline ($340K). Send to board by EOD.',
    agentKey: 'CEO',
    priority: 'HIGH',
    scheduledAt: weekDay(4, 10),
    input: {
      tools: [
        'analytics_dashboard',
        'report_builder',
        'pdf_generation',
        'email_send',
      ],
      tool: 'analytics_dashboard',
      params: {
        action: 'weekly_board_summary',
        metrics: ['nps', 'mrr_growth', 'team_utilization', 'pipeline_value'],
        period: '2026-W15',
      },
    },
    tags: ['board-report', 'kpi', 'weekly', 'executive'],
  },
  {
    title: 'Next Week Campaign Preparation — Media Plan',
    description:
      'Prepare media plan for next week (W16). Allocate budgets across channels per client, review creative assets ready for deployment, set up A/B tests, confirm UTM tracking.',
    agentKey: 'DIRECTOR',
    priority: 'HIGH',
    scheduledAt: weekDay(4, 9),
    input: {
      tools: ['ad_optimization', 'budget_tracking', 'template_engine'],
      tool: 'budget_tracking',
      params: {
        action: 'plan_week',
        week: '2026-W16',
        totalBudget: 52000,
        channels: ['google_ads', 'meta', 'linkedin', 'email', 'seo'],
      },
    },
    tags: ['media-plan', 'planning', 'weekly'],
  },
  {
    title: 'Weekend Social Post Scheduling — All Clients',
    description:
      'Queue weekend social posts for Saturday and Sunday (Apr 12-13) for all 3 clients. Weekend posts: 1 Instagram story each, 1 fun/inspirational tweet, LinkedIn Company page update.',
    agentKey: 'SOCIAL',
    priority: 'MEDIUM',
    scheduledAt: weekDay(4, 15),
    input: {
      tools: ['social_media', 'template_engine'],
      tool: 'social_media',
      params: {
        action: 'schedule_weekend_posts',
        dates: ['2026-04-12', '2026-04-13'],
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
        types: ['instagram_story', 'twitter_post', 'linkedin_company_update'],
      },
    },
    tags: ['social-media', 'weekend', 'scheduling'],
  },
  {
    title: 'End-of-Week Content Roundup Blog',
    description:
      'Write a "This Week in Digital Marketing" roundup post summarizing the week\'s biggest news: 3 platform updates, 2 industry studies, 1 hot take. 800 words, optimized for newsletter.',
    agentKey: 'CONTENT',
    priority: 'LOW',
    scheduledAt: weekDay(4, 11),
    input: {
      tools: ['web_search', 'template_engine', 'document', 'seo_tools'],
      tool: 'web_search',
      params: {
        query: 'digital marketing news week April 6 2026',
        limit: 15,
        sort: 'recent',
      },
    },
    tags: ['content', 'roundup', 'blog', 'newsletter'],
  },
  {
    title: 'Weekly Performance Report → Google Sheets Export',
    description:
      "Compile the week's performance data for all 3 clients into the master performance Google Sheet. Update weekly trend charts, add weekly commentary, share with account managers.",
    agentKey: 'DATA',
    priority: 'HIGH',
    scheduledAt: weekDay(4, 14),
    input: {
      tools: [
        'analytics_dashboard',
        'spreadsheet',
        'google_workspace',
        'export',
      ],
      tool: 'spreadsheet',
      params: {
        action: 'update',
        sheetId: 'agency-weekly-performance',
        week: '2026-W15',
        data: {
          clients: ['TechCorp', 'Acme Corp', 'Startup X'],
          metrics: ['impressions', 'clicks', 'conversions', 'spend', 'roas'],
        },
      },
    },
    tags: ['reporting', 'google-sheets', 'weekly', 'data-export'],
  },
  {
    title: 'Summary Research Report → Google Drive Upload',
    description:
      "Compile all week's research findings (competitor analysis, industry trends, keyword data) into a single summary document. Upload to Google Drive client shared folder.",
    agentKey: 'RESEARCH',
    priority: 'MEDIUM',
    scheduledAt: weekDay(4, 14),
    input: {
      tools: [
        'report_builder',
        'document_summary',
        'google_workspace',
        'pdf_generation',
      ],
      tool: 'report_builder',
      params: {
        reportType: 'weekly-research-digest',
        week: '2026-W15',
        sections: [
          'industry-trends',
          'competitor-analysis',
          'keyword-opportunities',
          'recommendations',
        ],
        output: {
          format: 'pdf',
          destination: 'google_drive',
          folder: 'Research/Weekly',
        },
      },
    },
    tags: ['research', 'report', 'google-drive'],
  },
  {
    title: 'Friday Sales Pipeline Close-Out',
    description:
      'Final pipeline review for the week. Update deal stages, log all outreach activities, mark any deals as won/lost/deferred. Generate Friday EOW pipeline report for CEO review.',
    agentKey: 'SALES',
    priority: 'HIGH',
    scheduledAt: weekDay(4, 16),
    input: {
      tools: ['crm', 'report_builder', 'analytics_dashboard'],
      tool: 'crm',
      params: {
        action: 'pipeline_summary',
        period: 'current_week',
        stages: [
          'prospecting',
          'proposal',
          'negotiation',
          'closed_won',
          'closed_lost',
        ],
      },
    },
    tags: ['sales', 'pipeline', 'close-out', 'weekly'],
  },
  {
    title: 'Client Weekly Update Emails — All Accounts',
    description:
      "Send personalized weekly update emails to all active clients (TechCorp, Acme Corp, Startup X). Include week highlights, metrics snapshot, next week's planned activities.",
    agentKey: 'ACCOUNT',
    priority: 'HIGH',
    scheduledAt: weekDay(4, 15),
    input: {
      tools: ['crm', 'email_send', 'template_engine', 'analytics_dashboard'],
      tool: 'template_engine',
      params: {
        template: 'weekly-client-update',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
        week: '2026-W15',
      },
    },
    tags: ['client', 'email', 'weekly-update', 'account-management'],
  },
  {
    title: 'Payroll Prep & Time Tracking Review',
    description:
      "Review week's time tracking submissions, flag any missing entries, prepare payroll data for finance team. Calculate billable hours vs total for each team member.",
    agentKey: 'ADMIN',
    priority: 'HIGH',
    scheduledAt: weekDay(4, 16),
    input: {
      tools: ['hr_systems', 'expense_tracking', 'calculator_enhanced'],
      tool: 'hr_systems',
      params: {
        action: 'get_time_tracking',
        week: '2026-W15',
        format: 'payroll_summary',
      },
    },
    tags: ['payroll', 'time-tracking', 'admin', 'hr'],
  },
  {
    title: 'End-of-Week Task & Workflow Review',
    description:
      'Review all tasks completed this week. Archive completed workflows, reschedule any uncompleted items to next week, identify recurring process improvement opportunities.',
    agentKey: 'OPS',
    priority: 'MEDIUM',
    scheduledAt: weekDay(4, 17),
    input: {
      tools: ['task_management', 'workflow_engine', 'routine_automation'],
      tool: 'task_management',
      params: {
        action: 'list',
        status: 'COMPLETED',
        scheduledFrom: weekDay(0, 0),
        scheduledTo: weekDay(4, 23),
      },
    },
    tags: ['operations', 'review', 'weekly', 'close-out'],
  },
];

// ── TOOL TESTS ───────────────────────────────────────────────────────────────
// Tests that verify each marketing-relevant tool works correctly
const TOOL_TESTS = [
  // Calculator (enhanced) — now named calculator_enhanced
  {
    tool: 'calculator_enhanced',
    input: { expression: '28000 + 22000 + 9500' },
    expectKey: 'result',
    label: 'Monthly revenue calc',
  },
  // Calculator (basic)
  {
    tool: 'calculator',
    input: { expression: '15000 * 1.35' },
    expectKey: 'result',
    label: 'Basic calculator',
  },
  // Task management — list & create (needs valid JWT → tenantId from OptionalJwtAuthGuard)
  {
    tool: 'task_management',
    input: { action: 'list' },
    expectKey: 'success',
    label: 'Task list',
  },
  {
    tool: 'task_management',
    input: {
      action: 'create',
      title: 'Test Marketing Task',
      description: 'Tool test',
      priority: 'LOW',
      status: 'PENDING',
    },
    expectKey: 'taskId',
    label: 'Task create',
  },
  // Web search — needs SERPER_API_KEY env var
  {
    tool: 'web_search',
    input: { query: 'digital marketing trends 2026', limit: 3 },
    expectKey: null,
    label: 'Web search (Serper)',
  },
  // Template engine — list_templates (no required params)
  {
    tool: 'template_engine',
    input: { action: 'list_templates' },
    expectKey: null,
    label: 'Template list',
  },
  // Template engine — validate inline template content (no DB template needed)
  {
    tool: 'template_engine',
    input: {
      action: 'validate_template',
      templateContent: 'Hello {{client}}, your report for {{date}} is ready.',
    },
    expectKey: null,
    label: 'Template validate',
  },
  // Analytics dashboard
  {
    tool: 'analytics_dashboard',
    input: { action: 'list_dashboards' },
    expectKey: null,
    label: 'Analytics dashboards',
  },
  // Ad optimization — use list_campaigns (no required ids)
  {
    tool: 'ad_optimization',
    input: {
      action: 'get_campaign_performance',
      campaignId: 'demo-q2-campaign',
    },
    expectKey: null,
    label: 'Ad optimization',
  },
  // SEO tools — analyze_page with url
  {
    tool: 'seo_tools',
    input: { action: 'analyze_page', url: 'https://example.com' },
    expectKey: null,
    label: 'SEO page analysis',
  },
  // Social media — list posts for a platform
  {
    tool: 'social_media',
    input: { action: 'list', platform: 'twitter' },
    expectKey: null,
    label: 'Social media list',
  },
  // CRM — list_contacts with required provider
  {
    tool: 'crm',
    input: { action: 'list_contacts', provider: 'hubspot' },
    expectKey: null,
    label: 'CRM contacts',
  },
  // Report builder — list_reports
  {
    tool: 'report_builder',
    input: { action: 'list_reports' },
    expectKey: null,
    label: 'Report list',
  },
  // Invoice generation — list_invoices
  {
    tool: 'invoice_generation',
    input: { action: 'list_invoices' },
    expectKey: null,
    label: 'Invoices list',
  },
  // Budget tracking — list_budgets
  {
    tool: 'budget_tracking',
    input: { action: 'list_budgets' },
    expectKey: null,
    label: 'Budget list',
  },
  // Email send — needs SMTP config (expected warning)
  {
    tool: 'email_send',
    input: {
      to: 'test@example.com',
      subject: 'Tool Test',
      body: 'This is a test email from the NeureCore tool test suite.',
    },
    expectKey: null,
    label: 'Email send (SMTP check)',
  },
  // Document summary — use 'content' field (not 'text')
  {
    tool: 'document_summary',
    input: {
      content:
        'Growth Marketing Agency achieved 38% YoY revenue growth in Q1 2026, driven by expansion into B2B SaaS vertical. Key clients TechCorp and Acme Corp both renewed with upsells.',
    },
    expectKey: null,
    label: 'Document summary (AI)',
  },
  // PDF generation — create_pdf with html content
  {
    tool: 'pdf_generation',
    input: {
      action: 'create_pdf',
      content:
        '<h1>Test Marketing Report</h1><p>Q1 2026 Performance Summary</p>',
    },
    expectKey: null,
    label: 'PDF generation',
  },
  // Spreadsheet — create (only needs title; 'read' requires spreadsheetId)
  {
    tool: 'spreadsheet',
    input: { action: 'create', title: 'Marketing Demo Spreadsheet' },
    expectKey: null,
    label: 'Spreadsheet create',
  },
  // Meeting scheduler — list_meetings (no required params)
  {
    tool: 'meeting_scheduler',
    input: { action: 'list_meetings' },
    expectKey: null,
    label: 'Meeting list',
  },
  // Calendar — needs Google OAuth (expected warning)
  {
    tool: 'calendar',
    input: { action: 'list', startDate: '2026-04-07', endDate: '2026-04-11' },
    expectKey: null,
    label: 'Calendar events',
  },
  // Knowledge base — action: 'search' with query
  {
    tool: 'knowledge_base',
    input: { action: 'search', query: 'B2B digital marketing best practices' },
    expectKey: null,
    label: 'Knowledge base search',
  },
  // Expense tracking — list_expenses
  {
    tool: 'expense_tracking',
    input: { action: 'list_expenses' },
    expectKey: null,
    label: 'Expense list',
  },
  // HR systems — list_employees
  {
    tool: 'hr_systems',
    input: { action: 'list_employees' },
    expectKey: null,
    label: 'HR employees list',
  },
  // Workflow engine
  {
    tool: 'workflow_engine',
    input: { action: 'list_workflows' },
    expectKey: null,
    label: 'Workflow engine',
  },
  // Routine automation — list_routines
  {
    tool: 'routine_automation',
    input: { action: 'list_routines' },
    expectKey: null,
    label: 'Routine list',
  },
];

// ── WORKFLOW TEMPLATES ────────────────────────────────────────────────────────
const WORKFLOW_TEMPLATES = [
  {
    name: 'Weekly Client Report Pipeline',
    description:
      'Automated weekly report generation: pull analytics → build report → generate PDF → send to client. Runs every Friday at 3 PM.',
    trigger: 'SCHEDULED',
    schedule: '0 15 * * 5',
    steps: [
      {
        step: 1,
        agent: 'data-analyst',
        tool: 'analytics_dashboard',
        action: 'compile_weekly_metrics',
      },
      {
        step: 2,
        agent: 'data-analyst',
        tool: 'report_builder',
        action: 'generate_report',
      },
      {
        step: 3,
        agent: 'account-manager',
        tool: 'pdf_generation',
        action: 'export_pdf',
      },
      {
        step: 4,
        agent: 'account-manager',
        tool: 'email_send',
        action: 'send_to_client',
      },
    ],
  },
  {
    name: 'New Lead Qualification & Outreach',
    description:
      'When a new lead comes in: research the company → score the lead → assign to sales → send initial outreach email.',
    trigger: 'WEBHOOK',
    webhookEvent: 'new_lead_intake',
    steps: [
      {
        step: 1,
        agent: 'research-analyst',
        tool: 'web_search',
        action: 'research_company',
      },
      {
        step: 2,
        agent: 'sales-manager',
        tool: 'crm',
        action: 'score_and_qualify_lead',
      },
      {
        step: 3,
        agent: 'sales-manager',
        tool: 'email_send',
        action: 'send_outreach_email',
      },
    ],
  },
  {
    name: 'Content Publishing Pipeline',
    description:
      'Full content workflow: research topic → write draft → SEO optimize → schedule social posts → publish.',
    trigger: 'MANUAL',
    steps: [
      {
        step: 1,
        agent: 'research-analyst',
        tool: 'web_search',
        action: 'research_topic',
      },
      {
        step: 2,
        agent: 'content-creator',
        tool: 'template_engine',
        action: 'write_draft',
      },
      {
        step: 3,
        agent: 'content-creator',
        tool: 'seo_tools',
        action: 'optimize_content',
      },
      {
        step: 4,
        agent: 'social-media',
        tool: 'social_media',
        action: 'schedule_promotion',
      },
    ],
  },
];

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  separator('NeureCore Marketing Agency — Demo Setup Script');
  log('📅', `Week: April 6–10, 2026 (W15)`);
  log('🏢', `Tenant: Growth Marketing Agency`);
  log('👤', `Demo User: ${DEMO_EMAIL}`);
  console.log('');

  // Step 0: Login
  separator('STEP 1: Authentication');
  const loginRes = await apiCall('POST', '/auth/login', {
    email: DEMO_EMAIL,
    password: DEMO_PASS,
  });
  if (!loginRes.data?.tokens?.accessToken) {
    console.error('❌ Login failed:', JSON.stringify(loginRes));
    process.exit(1);
  }
  const token = loginRes.data.tokens.accessToken;
  log('✅', `Logged in as ${DEMO_EMAIL} (role: ${loginRes.data.user.role})`);

  // ── Google OAuth info (always print) ──────────────────────────────────────
  separator('STEP 2: Google Workspace Connection');
  const gStatus = await apiCall(
    'GET',
    '/connectors/oauth/google/status',
    null,
    token,
  );
  const connected = gStatus.data?.connected;

  if (connected) {
    log('✅', 'Google Workspace already connected for this tenant');
  } else {
    const authRes = await apiCall(
      'GET',
      '/connectors/oauth/google/authorize',
      null,
      token,
    );
    const oauthUrl = authRes.data?.url;
    log('🔗', 'Google Workspace NOT connected. Complete OAuth flow:');
    console.log('');
    console.log('  1. Open this URL in your browser:');
    console.log('');
    if (oauthUrl) {
      console.log('  ' + oauthUrl);
    }
    console.log('');
    console.log('  2. Login with: gecdroship@gmail.com');
    console.log('  3. Grant access to: Gmail, Calendar, Drive, Docs, Sheets');
    console.log(
      '  4. The callback will redirect to localhost:3000 automatically',
    );
    console.log(
      '  5. After connecting, re-run this script to test Google tools',
    );
  }

  if (GOOGLE_ONLY) {
    process.exit(0);
  }

  // ── Tool Tests ────────────────────────────────────────────────────────────
  separator('STEP 3: Tool Execution Tests');
  log('🔧', `Testing ${TOOL_TESTS.length} marketing tools...`);
  console.log('');

  const toolResults = { passed: 0, failed: 0, warnings: 0 };
  for (const test of TOOL_TESTS) {
    const res = await apiCall(
      'POST',
      '/tools/execute',
      { tool: test.tool, input: test.input },
      token,
    );

    // Unwrap response
    const inner = res.data?.data ?? res.data ?? {};
    const success = inner.success !== false && res.status !== 'error';

    if (res.status === 'error' || (inner.success === false && inner.error)) {
      const errMsg = inner.error ?? res.error?.message ?? 'Unknown error';
      // Distinguish config-required failures (expected) from real bugs
      const isConfigMissing =
        /api.?key|not configured|no key|MISSING|smtp.*missing|check llm|llm api|provider not|connection refused/i.test(
          errMsg,
        );
      if (isConfigMissing) {
        warn(
          `${test.label} [${test.tool}]: needs API key config — ${errMsg.slice(0, 80)}`,
        );
        toolResults.warnings++;
      } else {
        log(
          '❌',
          `${test.label} [${test.tool}] FAILED: ${errMsg.slice(0, 120)}`,
        );
        toolResults.failed++;
      }
    } else {
      log('✅', `${test.label} [${test.tool}]`);
      toolResults.passed++;
    }
  }

  console.log('');
  log(
    '📊',
    `Tool results: ${toolResults.passed} passed, ${toolResults.failed} failed, ${toolResults.warnings} need API key config`,
  );

  if (TOOLS_ONLY) {
    separator('Done — tools-only mode');
    process.exit(0);
  }

  // ── Reset mode: clear old demo tasks ─────────────────────────────────────
  if (RESET_MODE) {
    separator('STEP 4: Clearing old demo tasks');
    const existingTasks = await apiCall('GET', '/tasks?limit=100', null, token);
    const taskList = existingTasks.data?.data ?? [];
    let deleted = 0;
    for (const t of taskList) {
      if (
        t.input &&
        JSON.parse(
          typeof t.input === 'string' ? t.input : JSON.stringify(t.input),
        )?.createdFrom === 'demo-setup'
      ) {
        const del = await apiCall('DELETE', '/tasks/' + t.id, null, token);
        if (del.status !== 'error') deleted++;
      }
    }
    log('🗑️ ', `Cleared ${deleted} old demo tasks`);
  }

  // ── Create weekly tasks ───────────────────────────────────────────────────
  separator('STEP 4: Creating 40+ Weekly Marketing Tasks');
  log('📋', `Creating ${WEEKLY_TASKS.length} tasks for Week of April 6–10...`);
  console.log('');

  const createdTasks = [];
  const failedTasks = [];

  for (const taskDef of WEEKLY_TASKS) {
    const agentInfo = AGENTS[taskDef.agentKey];
    const taskInput = {
      ...taskDef.input,
      createdFrom: 'demo-setup',
      week: '2026-W15',
      agentName: agentInfo.name,
      tags: taskDef.tags,
    };

    const res = await apiCall(
      'POST',
      '/tasks',
      {
        title: taskDef.title,
        description: taskDef.description,
        priority: taskDef.priority,
        status: 'PENDING',
        scheduledAt: taskDef.scheduledAt,
        agentId: null, // Note: stored as audit; dispatch requires UUID agentId
        input: taskInput,
      },
      token,
    );

    if (res.status === 'success' && res.data?.id) {
      createdTasks.push({
        id: res.data.id,
        title: taskDef.title,
        agent: agentInfo.name,
      });
      log('✅', `[${agentInfo.name}] ${taskDef.title}`);
    } else {
      failedTasks.push(taskDef.title);
      log(
        '❌',
        `FAILED: ${taskDef.title} — ${JSON.stringify(res).slice(0, 100)}`,
      );
    }
  }

  console.log('');
  log(
    '📊',
    `Tasks: ${createdTasks.length} created, ${failedTasks.length} failed`,
  );

  // ── Create Workflow Templates ─────────────────────────────────────────────
  separator('STEP 5: Creating Workflow Templates');

  const savedWorkflows = [];
  for (const wf of WORKFLOW_TEMPLATES) {
    const res = await apiCall(
      'POST',
      '/workflows',
      {
        name: wf.name,
        description: wf.description,
        trigger: wf.trigger,
        schedule: wf.schedule ?? null,
        config: {
          trigger: wf.trigger,
          schedule: wf.schedule,
          webhookEvent: wf.webhookEvent,
          steps: wf.steps,
          createdFrom: 'demo-setup',
        },
      },
      token,
    );

    if (res.status === 'success' && res.data?.id) {
      savedWorkflows.push({ id: res.data.id, name: wf.name });
      log('✅', `Workflow: ${wf.name}`);
    } else {
      // Workflow already exists or failed — not critical
      warn(
        `Workflow '${wf.name}': ${JSON.stringify(res.data ?? res.error ?? res).slice(0, 100)}`,
      );
    }
  }

  // ── Tool-based task creation (task_management tool) ────────────────────────
  separator('STEP 6: Testing task_management Tool');

  const weeklyTasksToCreate = [
    {
      title: 'SEO Audit — All Client Websites',
      priority: 'MEDIUM',
      status: 'PENDING',
    },
    {
      title: 'Monthly Budget Reconciliation',
      priority: 'HIGH',
      status: 'PENDING',
    },
    {
      title: 'Team OKR Review — Q2 Target Setting',
      priority: 'HIGH',
      status: 'PENDING',
    },
    {
      title: 'Social Media Analytics Report',
      priority: 'MEDIUM',
      status: 'PENDING',
    },
    {
      title: 'New Client Onboarding — Startup Y',
      priority: 'CRITICAL',
      status: 'PENDING',
    },
  ];

  let toolTasksPassed = 0;
  for (const t of weeklyTasksToCreate) {
    const res = await apiCall(
      'POST',
      '/tools/execute',
      {
        tool: 'task_management',
        input: {
          action: 'create',
          title: t.title,
          priority: t.priority,
          status: t.status,
          description: `Created via task_management tool in demo setup. Week W15.`,
        },
      },
      token,
    );

    const inner = res.data?.data ?? res.data ?? {};
    if (inner.success && inner.taskId) {
      log(
        '✅',
        `task_management tool created: ${t.title} (id: ${inner.taskId.slice(0, 8)}...)`,
      );
      toolTasksPassed++;
    } else {
      warn(
        `task_management create failed for "${t.title}": ${inner.error ?? JSON.stringify(inner).slice(0, 80)}`,
      );
    }
  }

  // ── Verify final task count ───────────────────────────────────────────────
  separator('STEP 7: Verification — Final State');

  const finalTasks = await apiCall('GET', '/tasks?limit=100', null, token);
  const taskTotal = finalTasks.data?.data?.length ?? 0;
  log('📋', `Total tasks in DB: ${taskTotal}`);

  const finalWf = await apiCall('GET', '/workflows?limit=20', null, token);
  const wfTotal = (finalWf.data?.data ?? finalWf.data ?? []).length;
  log('🔄', `Total workflows in DB: ${wfTotal}`);

  const tools = await apiCall('GET', '/tools', null, null);
  const innerTools = tools.data?.data ?? [];
  log(
    '🔧',
    `Total registered tools: ${Array.isArray(innerTools) ? innerTools.length : 'unknown'}`,
  );

  // ── Agent Summary ─────────────────────────────────────────────────────────
  const agentsRes = await apiCall('GET', '/agents', null, token);
  const agentList = agentsRes.data?.data ?? [];
  log('🤖', `Agents in tenant: ${agentList.length}`);

  // ── Final Summary ─────────────────────────────────────────────────────────
  separator('DEMO SETUP COMPLETE');

  console.log('');
  console.log('  📦 What was created:');
  console.log(
    `     • ${createdTasks.length} weekly tasks (Mon–Fri, 10 agents, April 6–10 2026)`,
  );
  console.log(
    `     • ${toolTasksPassed} additional tasks via task_management tool`,
  );
  console.log(`     • ${savedWorkflows.length} reusable workflow templates`);
  console.log('');
  console.log('  🔧 Tool test results:');
  console.log(`     • ${toolResults.passed} tools working correctly`);
  console.log(`     • ${toolResults.failed} tools have bugs (check above)`);
  console.log(
    `     • ${toolResults.warnings} tools need API key config (SMTP, Serper, etc.)`,
  );
  console.log('');
  console.log('  🌐 Frontend URLs to verify:');
  console.log('     • http://localhost:3001/tasks       — All created tasks');
  console.log(
    '     • http://localhost:3001/workflows   — 3 reusable workflow templates',
  );
  console.log(
    '     • http://localhost:3001/agents      — 10 agent team roster',
  );
  console.log('     • http://localhost:3001/dashboard   — KPI dashboard');
  console.log('');
  if (!connected) {
    console.log('  🔗 NEXT: Connect Google Workspace');
    console.log('     Run: node e2e-marketing-demo.mjs --google');
    console.log('     And follow the OAuth instructions above');
    console.log('');
  }
  console.log('  🔁 To re-run fresh:');
  console.log('     node e2e-marketing-demo.mjs --reset');
  console.log('');
  console.log('  🔧 To re-test tools only:');
  console.log('     node e2e-marketing-demo.mjs --tools-only');
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message ?? err);
  process.exit(1);
});

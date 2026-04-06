/**
 * NeureCore Marketing Agency — 2-Week Comprehensive Demo Seed
 *
 * Tenant:    Growth Marketing Agency (demo@marketing-agency.local)
 * Tenant ID: 4109424f-59fa-463a-8f5e-52299fcf47f0
 *
 * Coverage:
 *  - 20 agents (all deployed, all active)
 *  - 80+ realistic tasks across 2 weeks (Mon–Fri)
 *  - 6 workflow templates (5 active + 1 draft)
 *  - 2 knowledge spaces (Research + Brand)
 *  - Agent version snapshots (3+ per major agent)
 *  - Approval requests (6 pending → demo approval flow)
 *  - Cost records (per-agent, per-tool)
 *  - Budget policies (3 active)
 *  - Google Workspace integration tasks
 *  - PII-containing tasks (to demo masking)
 *  - Evaluation runs (3 agents in staging)
 *  - Supervisor-worker workflows (2 supervised)
 *
 * Usage:
 *   node e2e-two-week-demo.mjs           # Full seed (weeks 1 + 2)
 *   node e2e-two-week-demo.mjs --reset   # Delete demo tasks first, then reseed
 *   node e2e-two-week-demo.mjs --w1      # Week 1 only
 *   node e2e-two-week-demo.mjs --w2      # Week 2 only
 *   node e2e-two-week-demo.mjs --audit   # Audit current state (no changes)
 */

import http from 'http';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api/v1';
const DEMO_EMAIL = 'demo@marketing-agency.local';
const DEMO_PASS = 'Marketing@123!';
const TENANT_ID = '4109424f-59fa-463a-8f5e-52299fcf47f0';

// Week 1: April 6–10, 2026
const W1_START = new Date('2026-04-06T09:00:00.000Z');
// Week 2: April 13–17, 2026
const W2_START = new Date('2026-04-13T09:00:00.000Z');

function weekDay(weekStart, dayOffset, hourOffset = 9) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOffset);
  d.setUTCHours(hourOffset, 0, 0, 0);
  return d.toISOString();
}

const args = process.argv.slice(2);
const RESET_MODE = args.includes('--reset');
const W1_ONLY = args.includes('--w1');
const W2_ONLY = args.includes('--w2');
const AUDIT_ONLY = args.includes('--audit');

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
            resolve({ ...JSON.parse(b), _statusCode: res.statusCode });
          } catch {
            resolve({ _raw: b.slice(0, 500), _statusCode: res.statusCode });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let PASS = 0,
  FAIL = 0,
  WARN = 0;
function log(icon, msg) {
  console.log(`${icon}  ${msg}`);
}
function pass(msg) {
  PASS++;
  console.log(`✅  ${msg}`);
}
function fail(msg) {
  FAIL++;
  console.log(`❌  ${msg}`);
}
function warn(msg) {
  WARN++;
  console.log(`⚠️   ${msg}`);
}
function info(msg) {
  console.log(`ℹ️   ${msg}`);
}
function section(title) {
  console.log('\n' + '═'.repeat(65));
  console.log(`  ${title}`);
  console.log('═'.repeat(65));
}

// ── Agent IDs (all 20 in demo tenant) ───────────────────────────────────────
const T = TENANT_ID;
const AGENTS = {
  CEO: `${T}-ceo-agent`,
  DIRECTOR: `${T}-marketing-director`,
  SOCIAL: `${T}-social-media-manager`,
  CONTENT: `${T}-content-creator`,
  DATA: `${T}-data-analyst`,
  RESEARCH: `${T}-research-analyst`,
  SALES: `${T}-sales-manager`,
  ACCOUNT: `${T}-account-manager`,
  OPS: `${T}-operations-manager`,
  ADMIN: `${T}-administrative-assistant`,
  SEO: `${T}-seo-analyst`,
  EMAIL_MKT: `${T}-email-specialist`,
  CAMPAIGN: `${T}-campaign-manager`,
  PERF: `${T}-performance-analyst`,
  CLIENT: `${T}-client-relations`,
  BUDGET: `${T}-budget-controller`,
  LEAD: `${T}-lead-gen-bot`,
  BRAND: `${T}-brand-strategist`,
  OUTREACH: `${T}-outreach-specialist`,
  AI_OPS: `${T}-ai-ops-engineer`,
};

// ── Week 1 Tasks (Mon Apr 6 – Fri Apr 10) ───────────────────────────────────
const WEEK1_TASKS = [
  // ─── MONDAY, April 6 ─────────────────────────────────────────────────────
  {
    title: 'W1-Mon: Agency KPI Dashboard — Full Week Reset & Config',
    description:
      'Reset all KPI dashboards for the new week. Configure custom views for each client account (TechCorp, Acme Corp, Startup X). Set alert thresholds and ensure all data pipes are connected.',
    agentId: AGENTS.CEO,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 9),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'reset_weekly',
        week: '2026-W15',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
      },
    },
    tags: ['kpi', 'dashboard', 'weekly-reset'],
  },
  {
    title: 'W1-Mon: Q2 Marketing Strategy Document (Google Doc)',
    description:
      'Draft the Q2 2026 marketing strategy in a shared Google Doc. Cover: campaign objectives, budget allocation, channel mix, KPI targets per client, team responsibilities. Use Drive template.',
    agentId: AGENTS.DIRECTOR,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 10),
    input: {
      tool: 'google_workspace',
      params: {
        action: 'create_document',
        title: 'Q2 2026 Marketing Strategy — Growth Agency',
        folder: 'Strategy/Q2-2026',
        template: 'strategy-doc',
      },
    },
    tags: ['strategy', 'google-docs', 'q2-planning'],
  },
  {
    title: 'W1-Mon: Social Media Calendar April — Google Sheets Setup',
    description:
      'Set up the April content calendar in Google Sheets. Add slots for all 3 clients across LinkedIn, Twitter/X, and Instagram. Pre-fill week 15 content queue with hooks and CTAs.',
    agentId: AGENTS.SOCIAL,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 8),
    input: {
      tool: 'spreadsheet',
      params: {
        action: 'create',
        title: 'April 2026 Social Media Calendar',
        sheetNames: ['LinkedIn', 'Twitter', 'Instagram', 'TikTok'],
      },
    },
    tags: ['social-media', 'google-sheets', 'content-calendar'],
  },
  {
    title: 'W1-Mon: Blog Post — "AI Trends in Digital Marketing 2026"',
    description:
      'Research and write a 1500-word SEO-optimized blog post on AI trends reshaping digital marketing in 2026. Include real stats, 3 case studies, and actionable takeaways. Save to Google Drive.',
    agentId: AGENTS.CONTENT,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 0, 10),
    input: {
      tool: 'web_search',
      params: {
        query: 'AI digital marketing trends 2026 statistics ROI',
        limit: 10,
      },
    },
    tags: ['blog', 'seo', 'ai-trends', 'google-drive'],
  },
  {
    title: 'W1-Mon: Keyword Research — Q2 Content Clusters (50 KWs)',
    description:
      'Research 50 high-value keywords for Q2 content across 5 topic clusters: B2B SaaS, marketing automation, growth hacking, demand gen, account-based marketing. Export to Google Sheets KW tracker.',
    agentId: AGENTS.SEO,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 9),
    input: {
      tool: 'seo_tools',
      params: {
        action: 'keyword_research',
        clusters: [
          'B2B SaaS',
          'marketing automation',
          'growth hacking',
          'demand gen',
          'ABM',
        ],
        count: 50,
        minVolume: 500,
      },
    },
    tags: ['seo', 'keyword-research', 'q2-content'],
  },
  {
    title: 'W1-Mon: Email Campaign — Welcome Sequence Setup (20 Leads)',
    description:
      "Set up automated welcome email sequence for 20 new leads from last week's webinar. Personalize with company name and lead source. Schedule Day 1, Day 3, Day 7 cadence.",
    agentId: AGENTS.EMAIL_MKT,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 11),
    input: {
      tool: 'email_send',
      params: {
        to: 'john.smith@techstartup.com',
        subject:
          "Welcome to Growth Marketing Agency — Let's accelerate your growth",
        body: 'Hi John, Thank you for joining our "AI Marketing" webinar last week...',
      },
    },
    tags: ['email-marketing', 'lead-nurture', 'automation'],
  },
  {
    title: 'W1-Mon: Weekend Performance Data Pull — All Campaigns',
    description:
      'Pull Saturday/Sunday performance data for all 12 active campaigns. Flag any anomalies (spend > 110% of daily budget, CTR < 0.5%, conv rate drop > 15%). Export summary to Sheets.',
    agentId: AGENTS.PERF,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 8),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'get_client_reports',
        dateRange: { start: '2026-04-04', end: '2026-04-05' },
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
      },
    },
    tags: ['performance', 'monitoring', 'campaigns'],
  },
  {
    title: 'W1-Mon: April Pipeline Review — 28 Open Leads',
    description:
      'Review and score all 28 open leads in the pipeline. Apply lead scoring model: company size, intent signals, engagement history. Update CRM stages and assign follow-up tasks.',
    agentId: AGENTS.SALES,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 9),
    input: {
      tool: 'crm',
      params: {
        action: 'list_contacts',
        provider: 'hubspot',
        filters: { status: 'new_lead', limit: 28 },
      },
    },
    tags: ['sales', 'pipeline', 'lead-scoring'],
  },
  {
    title: 'W1-Mon: Client Check-In Emails — TechCorp, Acme, Startup X',
    description:
      'Send personalized Monday morning check-in emails to all 3 key clients. Reference their specific KPIs, upcoming deliverables this week, and any pending approvals. Track opens.',
    agentId: AGENTS.ACCOUNT,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 9),
    input: {
      tool: 'email_send',
      params: {
        to: 'sarah.chen@techcorp.com',
        subject: 'Your Marketing Update — Week of April 6 2026',
        body: "Hi Sarah, Here's your weekly marketing performance summary and what's coming up this week...",
      },
    },
    tags: ['client', 'email', 'account-management'],
  },
  {
    title: 'W1-Mon: Operations Capacity Planning — Week 15',
    description:
      'Assign all week 15 tasks to team members based on capacity. Balance workload: no one > 85% capacity. Flag resource gaps and propose solutions (freelancer, deprioritize, split tasks).',
    agentId: AGENTS.OPS,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 0, 9),
    input: {
      tool: 'task_management',
      params: { action: 'list', status: 'PENDING', limit: 50 },
    },
    tags: ['operations', 'capacity', 'resource-planning'],
  },
  {
    title: 'W1-Mon: Competitor Analysis — Top 5 Paid Search Strategies',
    description:
      'Analyze paid search strategies of top 5 competing agencies. Extract keywords, ad copy patterns, landing page structure, budget estimates, and positioning differences. Upload findings to Drive.',
    agentId: AGENTS.RESEARCH,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 0, 10),
    input: {
      tool: 'web_search',
      params: {
        query:
          'digital marketing agency B2B paid search Google ads 2026 case study',
        limit: 15,
      },
    },
    tags: ['research', 'competitor', 'paid-search'],
  },

  // ─── TUESDAY, April 7 ────────────────────────────────────────────────────
  {
    title: 'W1-Tue: TechCorp QBR Prep — Q1 Performance Deck (Google Slides)',
    description:
      'Build Q1 QBR presentation for TechCorp in Google Slides. Include: campaign results vs targets, ROI summary, budget utilization, top-performing content, and Q2 roadmap with projected impact.',
    agentId: AGENTS.CEO,
    priority: 'CRITICAL',
    scheduledAt: weekDay(W1_START, 1, 9),
    input: {
      tool: 'google_workspace',
      params: {
        action: 'create_presentation',
        title: 'TechCorp Q1 2026 QBR — Growth Marketing Agency',
        slides: [
          'executive-summary',
          'campaign-results',
          'roi-analysis',
          'q2-roadmap',
        ],
      },
    },
    tags: ['qbr', 'techcorp', 'google-slides', 'reporting'],
  },
  {
    title: 'W1-Tue: Instagram & LinkedIn Ad Creatives — 6 Variations',
    description:
      'Create ad copy for TechCorp Q2 paid social campaign. 3 variations per platform. Include headline, body copy, CTA, targeting parameters. A/B test framework.',
    agentId: AGENTS.SOCIAL,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 1, 10),
    input: {
      tool: 'ad_optimization',
      params: {
        action: 'generate_variations',
        client: 'TechCorp',
        campaign: 'Q2-ProductLaunch',
        platforms: ['instagram', 'linkedin'],
        variations: 3,
      },
    },
    tags: ['paid-social', 'creative', 'techcorp', 'a-b-test'],
  },
  {
    title: 'W1-Tue: Case Study — Acme Corp 245% Organic Traffic Growth',
    description:
      'Write 1200-word case study on Acme Corp SEO results: 245% organic traffic increase in 6 months, 183 new keywords in top 10. Include methodology and client quote. Save to Google Drive.',
    agentId: AGENTS.CONTENT,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 1, 9),
    input: {
      tool: 'document_summary',
      params: {
        content:
          'Acme Corp SEO Campaign Results: Organic traffic grew 245% from 18K to 62K monthly visitors...',
      },
    },
    tags: ['case-study', 'seo', 'acme-corp', 'content'],
  },
  {
    title: 'W1-Tue: On-Page SEO Audit — TechCorp Website (50 pages)',
    description:
      'Run technical SEO audit on techcorp.com. Check: title tags, meta descriptions, heading structure, Core Web Vitals, internal linking, schema markup. Prioritize top 15 fixes in Sheets.',
    agentId: AGENTS.SEO,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 1, 10),
    input: {
      tool: 'seo_tools',
      params: {
        action: 'analyze_page',
        url: 'https://techcorp.com',
        depth: 50,
        checks: ['title', 'meta', 'headers', 'cwv', 'schema'],
      },
    },
    tags: ['seo', 'technical-audit', 'techcorp'],
  },
  {
    title: 'W1-Tue: Ad Spend Optimization — Cross-Client ROAS Analysis',
    description:
      'Analyze ROAS across all 12 active campaigns. Identify 3 underperforming ad sets (ROAS < 2x), recommend budget shifts to high-performers. Target 18% blended ROAS improvement this week.',
    agentId: AGENTS.PERF,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 1, 9),
    input: {
      tool: 'ad_optimization',
      params: {
        action: 'optimize_budget',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
        totalBudget: 45000,
        targetMetric: 'ROAS',
        period: 'week',
      },
    },
    tags: ['ad-spend', 'optimization', 'roas'],
  },
  {
    title: 'W1-Tue: Email Sequence — 15 Warm Lead Outreach (with PII)',
    description:
      'Send personalized emails to 15 warm leads. Use first name, company, and lead source in subject/body. Track opens. Note: emails contain real contact data — PII masking active.',
    agentId: AGENTS.EMAIL_MKT,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 1, 11),
    input: {
      tool: 'email_send',
      params: {
        to: 'alice.johnson@growthco.com',
        subject:
          "Alice, saw your download — quick question about GrowthCo's lead gen",
        body: 'Hi Alice (alice.johnson@growthco.com | 415-555-0182), I noticed GrowthCo downloaded our B2B lead gen guide...',
      },
    },
    tags: ['email', 'lead-nurture', 'pii-demo'],
  },
  {
    title: 'W1-Tue: HubSpot CRM Sync — 10 New Opportunities',
    description:
      'Sync 10 new opportunities from HubSpot into the agency CRM. Update contact records with LinkedIn profiles, company revenue, and tech stack. Assign to sales reps. Flag 2 high-value targets.',
    agentId: AGENTS.LEAD,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 1, 10),
    input: {
      tool: 'crm',
      params: {
        action: 'list_contacts',
        provider: 'hubspot',
        filters: { status: 'new_opportunity', limit: 10 },
      },
    },
    tags: ['crm', 'hubspot', 'lead-gen', 'sync'],
  },
  {
    title: 'W1-Tue: Brand Audit — TechCorp Marketing Assets Review',
    description:
      'Review 20 TechCorp marketing assets from last month. Verify brand consistency: correct logo use, brand colors, typography, tone of voice. Flag any non-compliant assets for revision.',
    agentId: AGENTS.BRAND,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 1, 14),
    input: {
      tool: 'document_summary',
      params: {
        content:
          'TechCorp Brand Guidelines 2026: Primary color #2563EB, Voice: professional yet approachable, Logo clearspace = 20px...',
      },
    },
    tags: ['brand', 'audit', 'techcorp', 'quality'],
  },
  {
    title: 'W1-Tue: Budget Tracking — Q2 Forecast & Allocation',
    description:
      'Update Q2 budget forecast based on Q1 actuals. Allocate $125K across 5 channels: Google Ads (35%), Meta (25%), LinkedIn (20%), Content/SEO (15%), Email (5%). Create approval request for changes.',
    agentId: AGENTS.BUDGET,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 1, 9),
    input: {
      tool: 'budget_tracking',
      params: {
        action: 'get_utilization',
        period: 'Q2_2026',
        breakdown: 'by_channel',
        totalBudget: 125000,
      },
    },
    tags: ['budget', 'q2-forecast', 'allocation'],
  },

  // ─── WEDNESDAY, April 8 ──────────────────────────────────────────────────
  {
    title: 'W1-Wed: Q2 Campaign Launch — Campaign Manager Brief',
    description:
      'Brief the Campaign Manager on Q2 launch: 4 campaigns starting April 14. TechCorp Product Launch, Acme Corp Spring Promo, Startup X Awareness, Agency Brand. Set up tracking, UTMs, goals.',
    agentId: AGENTS.CAMPAIGN,
    priority: 'CRITICAL',
    scheduledAt: weekDay(W1_START, 2, 9),
    input: {
      tool: 'workflow_engine',
      params: {
        action: 'create_workflow',
        name: 'Q2-Campaign-Launch',
        steps: ['brief', 'creative', 'setup', 'launch', 'monitor'],
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
      },
    },
    tags: ['campaign', 'q2-launch', 'workflow'],
  },
  {
    title: 'W1-Wed: Monthly Newsletter — April Edition (2400 Subscribers)',
    description:
      'Write and format April agency newsletter. Sections: 3 industry insights, 2 client spotlights (TechCorp, Acme), 3 quick tips, new service announcement (AI Content Production). 600 words.',
    agentId: AGENTS.CONTENT,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 2, 9),
    input: {
      tool: 'template_engine',
      params: {
        template: 'monthly-newsletter',
        variables: {
          month: 'April 2026',
          subscribers: 2400,
          sections: ['insights', 'client-spotlight', 'tips', 'new-service'],
        },
      },
    },
    tags: ['newsletter', 'email-marketing', 'content'],
  },
  {
    title: 'W1-Wed: Mid-Week Performance Flash Report — All Campaigns',
    description:
      'Wednesday mid-week performance snapshot. Pull CTR, CPC, CVR, spend pacing. Flag 3 campaigns requiring immediate budget or bid adjustments. Update Sheets dashboard.',
    agentId: AGENTS.DATA,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 2, 14),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'midweek_check',
        metrics: ['ctr', 'cpc', 'conversion_rate', 'spend_pacing'],
        alertThreshold: 0.15,
      },
    },
    tags: ['performance', 'monitoring', 'midweek'],
  },
  {
    title: 'W1-Wed: March Client Invoicing — Batch Send ($59.5K)',
    description:
      'Generate and send March invoices. TechCorp: $28K, Acme Corp: $22K, Startup X: $9.5K. Include itemized hours, deliverables, and payment terms. Send via email with PDF attachment.',
    agentId: AGENTS.ADMIN,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 2, 9),
    input: {
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
            services: ['SEO', 'Social', 'Email'],
          },
          { client: 'Startup X', amount: 9500, services: ['PPC', 'Analytics'] },
        ],
      },
    },
    tags: ['invoicing', 'billing', 'finance'],
  },
  {
    title: 'W1-Wed: LinkedIn Thought Leadership Post — Agency Brand',
    description:
      'Post "5 B2B Marketing Predictions for H2 2026" on LinkedIn. Engage first 2 hours: respond to 10+ comments, repost 3 industry shares, amplify via company page. Track engagement metrics.',
    agentId: AGENTS.SOCIAL,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 2, 8),
    input: {
      tool: 'social_media',
      params: {
        action: 'publish_post',
        platform: 'linkedin',
        content:
          '5 B2B Marketing Predictions for H2 2026 that will separate the best agencies from the rest...',
        targeting: { industry: 'B2B', function: 'Marketing' },
      },
    },
    tags: ['linkedin', 'thought-leadership', 'brand'],
  },
  {
    title: 'W1-Wed: Outreach Sequence — 20 Cold Prospects (Tech Sector)',
    description:
      'Launch cold outreach campaign to 20 tech sector decision-makers. Personalized using LinkedIn + company news context. 3-touch sequence: email → LinkedIn → email follow-up.',
    agentId: AGENTS.OUTREACH,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 2, 10),
    input: {
      tool: 'email_send',
      params: {
        to: 'cmo@targetsaas.com',
        subject: "Quick question about TargetSaaS' content strategy",
        body: 'Hi Marcus, I noticed TargetSaaS just raised their Series B — congrats! We helped 3 similar-stage SaaS companies increase their inbound 180% in 90 days...',
      },
    },
    tags: ['outreach', 'cold-email', 'tech-sector'],
  },
  {
    title: 'W1-Wed: AI Ops Review — Tool Performance & Cost Audit',
    description:
      'Review AI agent performance: tool execution times, error rates, token costs per agent. Flag any agents exceeding budget thresholds. Optimize prompts for 3 high-cost agents.',
    agentId: AGENTS.AI_OPS,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 2, 11),
    input: {
      tool: 'calculator_enhanced',
      params: { expression: '(850 * 0.002) + (1200 * 0.001) + (450 * 0.0015)' },
    },
    tags: ['ai-ops', 'cost-audit', 'optimization'],
  },

  // ─── THURSDAY, April 9 ───────────────────────────────────────────────────
  {
    title: 'W1-Thu: Funnel Analysis — TechCorp Full-Funnel Deep Dive',
    description:
      "Analyze TechCorp's full marketing funnel: impressions → clicks → leads → MQLs → SQLs → opportunities → closed-won. Identify 3 biggest drop-off points. Build Sankey diagram in Sheets.",
    agentId: AGENTS.PERF,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 3, 9),
    input: {
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
    tags: ['funnel', 'analytics', 'techcorp', 'cro'],
  },
  {
    title: 'W1-Thu: Startup X Twitter Launch Campaign — Live Execution',
    description:
      'Execute Startup X product launch on Twitter/X. Live-tweet 8 posts, engage with mentions, coordinate with influencers, run Twitter poll. Monitor trending hashtags. Real-time response.',
    agentId: AGENTS.SOCIAL,
    priority: 'CRITICAL',
    scheduledAt: weekDay(W1_START, 3, 11),
    input: {
      tool: 'social_media',
      params: {
        action: 'launch_campaign',
        platform: 'twitter',
        client: 'Startup X',
        hashtags: ['#StartupX', '#ProductLaunch2026'],
        posts: 8,
      },
    },
    tags: ['twitter', 'launch', 'startup-x', 'live'],
  },
  {
    title: 'W1-Thu: Video Script — "300 B2B Leads in 30 Days" (YouTube)',
    description:
      'Write 5-min video script for agency YouTube channel. Hook, problem, solution, 3 specific tactics, CTA. Optimize title/description for SEO. Include time-stamps outline.',
    agentId: AGENTS.CONTENT,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 3, 10),
    input: {
      tool: 'template_engine',
      params: {
        template: 'video-script',
        variables: {
          duration: 5,
          topic: 'B2B Lead Generation Tactics',
          hook: 'We generated 300 qualified B2B leads in 30 days with just $5K ad spend',
        },
      },
    },
    tags: ['video', 'youtube', 'content', 'b2b'],
  },
  {
    title: 'W1-Thu: Proposal Follow-Up — 8 Open Proposals (7+ Days)',
    description:
      'Follow up on 8 proposals with no response in 7+ days. Use CRM to personalize each email with last interaction context. Offer to schedule a call. Trigger scarcity element for 3 time-sensitive deals.',
    agentId: AGENTS.SALES,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 3, 10),
    input: {
      tool: 'crm',
      params: {
        action: 'list_contacts',
        provider: 'hubspot',
        filters: { hasOpenProposal: true, daysSinceLastContact: 7 },
        limit: 8,
      },
    },
    tags: ['sales', 'follow-up', 'proposals'],
  },
  {
    title: 'W1-Thu: Acme Corp Monthly Report — March 2026 (PDF + Sheets)',
    description:
      'Generate comprehensive March monthly report for Acme Corp: SEO metrics, social growth, email performance, paid ROI, budget utilization. Export as PDF and update Google Sheets dashboard.',
    agentId: AGENTS.ACCOUNT,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 3, 14),
    input: {
      tool: 'report_builder',
      params: {
        reportType: 'monthly-client-report',
        client: 'Acme Corp',
        month: 'March 2026',
        channels: ['seo', 'social', 'email', 'paid'],
        exportFormats: ['pdf', 'sheets'],
      },
    },
    tags: ['reporting', 'acme-corp', 'monthly', 'google-sheets'],
  },
  {
    title: 'W1-Thu: Client Relations — 3 Client Escalation Calls Prep',
    description:
      'Prepare for 3 client escalation calls. Pull issue history from CRM, prepare resolution summaries, draft reconciliation offers, update service level agreements. Escalation level: yellow.',
    agentId: AGENTS.CLIENT,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 3, 10),
    input: {
      tool: 'crm',
      params: {
        action: 'list_contacts',
        provider: 'hubspot',
        filters: { hasOpenIssue: true },
        limit: 3,
      },
    },
    tags: ['client-relations', 'escalation', 'account'],
  },

  // ─── FRIDAY, April 10 ────────────────────────────────────────────────────
  {
    title: 'W1-Fri: Board Weekly KPI Report — CEO to Board ($142K MRR)',
    description:
      'Generate board-level weekly summary: Agency MRR $142K (+4.2% WoW), NPS 78, pipeline $340K, team utilization 87%. Export as PDF, send to board email with highlight callouts.',
    agentId: AGENTS.CEO,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 4, 10),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'weekly_board_summary',
        metrics: ['mrr', 'nps', 'pipeline_value', 'team_utilization'],
        period: '2026-W15',
      },
    },
    tags: ['board-report', 'kpi', 'weekly', 'executive'],
  },
  {
    title: 'W1-Fri: Next Week Media Plan — W16 ($52K Budget Allocation)',
    description:
      'Build W16 media plan for all 3 clients. Allocate $52K across Google Ads, Meta, LinkedIn, Email, and Organic. Review creative assets, confirm UTMs, set up A/B tests, brief campaign manager.',
    agentId: AGENTS.DIRECTOR,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 4, 9),
    input: {
      tool: 'budget_tracking',
      params: {
        action: 'plan_week',
        week: '2026-W16',
        totalBudget: 52000,
        channels: ['google_ads', 'meta', 'linkedin', 'email', 'seo'],
      },
    },
    tags: ['media-plan', 'planning', 'w16'],
  },
  {
    title: 'W1-Fri: Weekly Performance Report → Google Sheets (All Clients)',
    description:
      'Compile W15 performance data for all 3 clients into master Google Sheet. Update trend charts (8 weeks rolling), add weekly commentary, flag wins/concerns, share with account managers.',
    agentId: AGENTS.DATA,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 4, 14),
    input: {
      tool: 'spreadsheet',
      params: {
        action: 'update',
        title: 'Agency Weekly Performance Tracker W15',
        week: '2026-W15',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
      },
    },
    tags: ['reporting', 'google-sheets', 'weekly', 'data-export'],
  },
  {
    title: 'W1-Fri: Weekly Research Digest → Google Drive Upload',
    description:
      'Compile all week 15 research: 5 competitor analyses, 50 keywords, 3 industry trend reports, 2 platform updates. Format as PDF digest, upload to Google Drive Research/Weekly folder.',
    agentId: AGENTS.RESEARCH,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W1_START, 4, 14),
    input: {
      tool: 'report_builder',
      params: {
        reportType: 'weekly-research-digest',
        week: '2026-W15',
        output: {
          format: 'pdf',
          destination: 'google_drive',
          folder: 'Research/Weekly',
        },
      },
    },
    tags: ['research', 'google-drive', 'weekly-digest'],
  },
  {
    title: 'W1-Fri: Client Weekly Updates — All 3 Clients',
    description:
      'Send personalized Friday weekly update emails to TechCorp, Acme, and Startup X. Include W15 highlights, next week preview, any pending approvals needing client input.',
    agentId: AGENTS.ACCOUNT,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 4, 15),
    input: {
      tool: 'email_send',
      params: {
        to: 'sarah.chen@techcorp.com',
        subject: "Week 15 Performance Update + What's Coming Next Week",
        body: 'Hi Sarah, Great week for TechCorp! Here are your W15 highlights...',
      },
    },
    tags: ['client', 'email', 'weekly-update'],
  },
  {
    title: 'W1-Fri: End-of-Week Content Roundup Blog Post',
    description:
      '"This Week in Digital Marketing" blog. Top 5 stories: Google algorithm update, Meta AI ads rollout, LinkedIn B2B study, rising CPCs, best campaign case study. 800 words.',
    agentId: AGENTS.CONTENT,
    priority: 'LOW',
    scheduledAt: weekDay(W1_START, 4, 11),
    input: {
      tool: 'web_search',
      params: {
        query: 'digital marketing news April 10 2026 platform updates',
        limit: 15,
        sort: 'recent',
      },
    },
    tags: ['blog', 'roundup', 'weekly'],
  },
  {
    title: 'W1-Fri: Payroll Data & Billable Hours Summary',
    description:
      'Compile payroll data for the 12-person team: billable hours, internal time, OT flagged. Calculate utilization rate per role. Prepare for finance team. Flag 2 missed timesheet submissions.',
    agentId: AGENTS.ADMIN,
    priority: 'HIGH',
    scheduledAt: weekDay(W1_START, 4, 16),
    input: {
      tool: 'hr_systems',
      params: {
        action: 'get_time_tracking',
        week: '2026-W15',
        format: 'payroll_summary',
      },
    },
    tags: ['payroll', 'hr', 'time-tracking'],
  },
];

// ── Week 2 Tasks (Mon Apr 13 – Fri Apr 17) ──────────────────────────────────
const WEEK2_TASKS = [
  // ─── MONDAY, April 13 ────────────────────────────────────────────────────
  {
    title: 'W2-Mon: Q2 Campaign Launch Week — Agency Kickoff',
    description:
      'Kick off Q2 campaigns officially. All 4 campaigns live: TechCorp Product Launch, Acme Spring Promo, Startup X Brand Awareness, Agency New Service. Verify tracking, budgets, creative assets.',
    agentId: AGENTS.CEO,
    priority: 'CRITICAL',
    scheduledAt: weekDay(W2_START, 0, 9),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'campaign_launch_overview',
        quarter: 'Q2',
        clients: ['TechCorp', 'Acme Corp', 'Startup X', 'Agency Brand'],
      },
    },
    tags: ['q2-launch', 'kickoff', 'campaigns'],
  },
  {
    title: 'W2-Mon: TechCorp Product Launch Ad Campaign — LIVE',
    description:
      'TechCorp Q2 product launch campaign goes live. Activate Google Ads, Meta, and LinkedIn campaigns. Monitor first-hour metrics. Adjust bids if CTR < 2% within first 4 hours. Target: 500 leads in week 1.',
    agentId: AGENTS.CAMPAIGN,
    priority: 'CRITICAL',
    scheduledAt: weekDay(W2_START, 0, 8),
    input: {
      tool: 'ad_optimization',
      params: {
        action: 'launch_campaign',
        client: 'TechCorp',
        campaign: 'Q2-Product-Launch',
        platforms: ['google_ads', 'meta', 'linkedin'],
        weeklyLeadTarget: 500,
      },
    },
    tags: ['techcorp', 'campaign-launch', 'paid-media', 'q2'],
  },
  {
    title: 'W2-Mon: SEO Content Publishing — 3 Blog Posts Live',
    description:
      'Publish 3 SEO-optimized blog posts: "AI in B2B Marketing" (1500w), "Lead Gen Tactics 2026" (1200w), "Marketing Attribution Guide" (2000w). Optimize meta, add schema markup, submit to GSC.',
    agentId: AGENTS.SEO,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 0, 10),
    input: {
      tool: 'seo_tools',
      params: {
        action: 'publish_content',
        posts: ['ai-b2b-marketing', 'lead-gen-2026', 'marketing-attribution'],
        optimize: true,
        submitGSC: true,
      },
    },
    tags: ['seo', 'content-publishing', 'blog'],
  },
  {
    title: 'W2-Mon: Email Drip Campaign — TechCorp Lead Nurture (500 Contacts)',
    description:
      'Launch TechCorp lead nurture email campaign to 500 contacts. Segment by funnel stage: awareness (200), consideration (200), decision (100). Personalize with product use case and company size.',
    agentId: AGENTS.EMAIL_MKT,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 0, 11),
    input: {
      tool: 'email_send',
      params: {
        to: 'lead_list@techcorp-campaign.local',
        subject: 'How TechCorp can help [Company] achieve [Goal]',
        body: 'Hi [FirstName], Your company [Company] is at a critical growth stage...',
      },
    },
    tags: ['email', 'lead-nurture', 'techcorp', 'segmentation'],
  },
  {
    title: 'W2-Mon: Brand Strategy — Acme Corp 2026 Rebrand Kickoff',
    description:
      'Begin Acme Corp brand evolution project. Review current brand equity, competitive positioning, audience research. Create brand architecture recommendations. Present 3 evolution directions.',
    agentId: AGENTS.BRAND,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 0, 10),
    input: {
      tool: 'document_summary',
      params: {
        content:
          'Acme Corp Brand Audit: Current brand voice: formal, colors: #003366 + #CC0000, audience: SMB finance, NPS: 62. Competitor brands: more approachable, modern...',
      },
    },
    tags: ['brand', 'rebrand', 'acme-corp', 'strategy'],
  },
  {
    title: 'W2-Mon: Week 16 Pipeline Qualification — 35 New Leads',
    description:
      'Process 35 new leads from Q2 campaign launch week. Apply qualification criteria: BANT, ICP match, intent signals. Score 0–100, assign A/B/C tier. A-tier: contact within 24h.',
    agentId: AGENTS.LEAD,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 0, 9),
    input: {
      tool: 'crm',
      params: {
        action: 'list_contacts',
        provider: 'hubspot',
        filters: { status: 'new_lead', source: 'Q2-Campaign', limit: 35 },
      },
    },
    tags: ['lead-gen', 'qualification', 'q2-leads'],
  },

  // ─── TUESDAY, April 14 ───────────────────────────────────────────────────
  {
    title: 'W2-Tue: Q2 Day-2 Performance Review — Early Signals',
    description:
      'Pull first 24h metrics from all Q2 campaigns. TechCorp launch: target 80 leads/day. Flag any underperforming ad sets. Compare Day-1 CTR to benchmarks. Adjust bidding strategy if needed.',
    agentId: AGENTS.PERF,
    priority: 'CRITICAL',
    scheduledAt: weekDay(W2_START, 1, 8),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'get_client_reports',
        dateRange: { start: '2026-04-13', end: '2026-04-14' },
        reportType: 'early_signals',
      },
    },
    tags: ['performance', 'q2-launch', 'day-2-check'],
  },
  {
    title: 'W2-Tue: Startup X Brand Awareness Campaign — Social Push',
    description:
      'Day 2 of Startup X awareness blitz. Post 5x on Instagram, 4x Twitter/X, 2x LinkedIn. Engage with all comments. Coordinate micro-influencer reposts. Track reach, engagement, follower growth.',
    agentId: AGENTS.SOCIAL,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 1, 9),
    input: {
      tool: 'social_media',
      params: {
        action: 'execute_campaign',
        client: 'Startup X',
        day: 2,
        platforms: ['instagram', 'twitter', 'linkedin'],
        postsPerPlatform: [5, 4, 2],
        trackMetrics: true,
      },
    },
    tags: ['startup-x', 'awareness', 'social-push'],
  },
  {
    title: 'W2-Tue: Content Hub — 5 Gated Assets for TechCorp Campaign',
    description:
      'Create 5 gated content pieces for TechCorp lead magnets: 2 eBooks, 1 ROI calculator template, 1 checklist, 1 webinar recording transcript. Format as PDF. Upload to Google Drive.',
    agentId: AGENTS.CONTENT,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 1, 10),
    input: {
      tool: 'pdf_generation',
      params: {
        action: 'create_pdf',
        title: 'TechCorp Lead Magnets Bundle',
        content:
          '<h1>The Complete B2B SaaS Marketing Playbook</h1><p>5 proven strategies...</p>',
      },
    },
    tags: ['content', 'lead-magnets', 'techcorp', 'gated'],
  },
  {
    title: 'W2-Tue: Email A/B Test Analysis — Subject Line Win Rate',
    description:
      'Analyze results of 3 A/B tests run in Week 15 email campaigns. Winner: personalized vs generic subject lines (38% vs 22% open rate). Implement winning variant across all active sequences.',
    agentId: AGENTS.EMAIL_MKT,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W2_START, 1, 14),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'ab_test_results',
        testIds: ['subj-test-1', 'subj-test-2', 'cta-test-1'],
        metric: 'open_rate',
      },
    },
    tags: ['email', 'a-b-testing', 'optimization'],
  },
  {
    title: 'W2-Tue: CRO Implementation — TechCorp Landing Page Fixes',
    description:
      "Implement top 5 CRO fixes from last week's UX analysis on TechCorp campaign landing page: above-fold copy, CTA color, form length, social proof placement, mobile optimization.",
    agentId: AGENTS.DATA,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 1, 9),
    input: {
      tool: 'calculator_enhanced',
      params: { expression: '(((0.032 - 0.025) / 0.025) * 100)' },
    },
    tags: ['cro', 'techcorp', 'landing-page'],
  },
  {
    title: 'W2-Tue: Sales Deck Update — Q2 Agency Capabilities Presentation',
    description:
      'Update agency sales deck with Q2 case studies (TechCorp QBR results, Acme SEO case study), new pricing packages, and technology stack slide. Prepare for 4 upcoming prospect calls.',
    agentId: AGENTS.SALES,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W2_START, 1, 11),
    input: {
      tool: 'google_workspace',
      params: {
        action: 'update_presentation',
        fileId: 'agency-sales-deck-2026',
        slides: ['case-studies', 'pricing', 'tech-stack'],
      },
    },
    tags: ['sales', 'presentation', 'google-slides'],
  },
  {
    title: 'W2-Tue: AI Ops Agent Health Check — 20 Agents Audit',
    description:
      'Full audit of all 20 AI agents: uptime, error rates, average task completion time, token usage, cost per task. Flag 3 agents needing prompt optimization. Generate AI ops health report.',
    agentId: AGENTS.AI_OPS,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 1, 10),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'agent_health_audit',
        agents: 'all',
        metrics: [
          'uptime',
          'error_rate',
          'avg_completion_time',
          'token_usage',
          'cost_per_task',
        ],
      },
    },
    tags: ['ai-ops', 'agent-health', 'audit'],
  },

  // ─── WEDNESDAY, April 15 ─────────────────────────────────────────────────
  {
    title: 'W2-Wed: Mid-Launch Performance Report — TechCorp Day 3',
    description:
      'Day 3 TechCorp launch health: 127 leads captured (target: 240 by mid-week). CTR 3.2% (good), CPL $31 (on target). Scale budget 25% on Google Ads top performer. Pause 2 weak ad sets.',
    agentId: AGENTS.CAMPAIGN,
    priority: 'CRITICAL',
    scheduledAt: weekDay(W2_START, 2, 8),
    input: {
      tool: 'ad_optimization',
      params: {
        action: 'scale_campaign',
        client: 'TechCorp',
        topPerformer: 'google-search-branded',
        scalePercentage: 25,
        pauseAdSets: ['meta-retarget-v1', 'linkedin-test-v2'],
      },
    },
    tags: ['campaign', 'optimization', 'techcorp', 'day-3'],
  },
  {
    title: 'W2-Wed: Analytics Deep Dive — Attribution Modeling',
    description:
      'Run multi-touch attribution analysis across all Q2 campaigns. Compare: last-click, first-click, linear, and data-driven models. Find true channel contribution to conversions. Export to Google Sheets.',
    agentId: AGENTS.DATA,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 2, 10),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'attribution_analysis',
        models: ['last_click', 'first_click', 'linear', 'data_driven'],
        channels: ['google_ads', 'meta', 'linkedin', 'email', 'organic'],
        clients: ['TechCorp'],
      },
    },
    tags: ['analytics', 'attribution', 'techcorp'],
  },
  {
    title: 'W2-Wed: Acme Corp Spring Campaign — Creative Review (10 Assets)',
    description:
      'Review and approve 10 creative assets for Acme Spring 2026 campaign. Check brand compliance, messaging, visual hierarchy, and CTA clarity. 7 approved, 3 revision requested.',
    agentId: AGENTS.BRAND,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 2, 9),
    input: {
      tool: 'document_summary',
      params: {
        content:
          'Acme Corp Spring Campaign Brief: "Spring into Growth" — 10 assets including 3 display banners, 2 social posts, 2 email headers, 1 landing page hero, 1 video thumbnail, 1 PDF cover...',
      },
    },
    tags: ['brand', 'creative-review', 'acme-corp'],
  },
  {
    title: 'W2-Wed: Industry Trends Digest — Mid-April 2026 Roundup',
    description:
      'Research and compile mid-April marketing trends. Focus: Google Performance Max updates, Meta Advantage+ changes, LinkedIn Thought Leader ads, AI content tools. Format for Slack + newsletter.',
    agentId: AGENTS.RESEARCH,
    priority: 'LOW',
    scheduledAt: weekDay(W2_START, 2, 11),
    input: {
      tool: 'web_search',
      params: {
        query:
          'marketing platform updates April 2026 Google Meta LinkedIn ad changes',
        limit: 15,
        sort: 'recent',
      },
    },
    tags: ['research', 'trends', 'martech'],
  },
  {
    title: 'W2-Wed: Client Success QBR — TechCorp LIVE Call Notes',
    description:
      'Attend and live-document TechCorp QBR call. Capture action items, feedback, upsell opportunities, concerns. Post-call: generate action summary email to client within 30 minutes.',
    agentId: AGENTS.CLIENT,
    priority: 'CRITICAL',
    scheduledAt: weekDay(W2_START, 2, 14),
    input: {
      tool: 'meeting_scheduler',
      params: {
        action: 'create_meeting',
        title: 'TechCorp Q1 QBR — Growth Marketing Agency',
        attendees: ['demo@marketing-agency.local', 'sarah.chen@techcorp.com'],
        duration: 60,
      },
    },
    tags: ['client', 'qbr', 'techcorp', 'live'],
  },
  {
    title: 'W2-Wed: AI Agent Feature: NL Report — "Show Me April ROI"',
    description:
      'Test NL→Report feature: Query "Generate a full ROI report for all campaigns in April 2026 comparing ROAS across TechCorp, Acme, and Startup X." Validate structured report output.',
    agentId: AGENTS.AI_OPS,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W2_START, 2, 15),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'nl_report',
        query:
          'Generate full ROI comparison for April 2026 campaigns across all 3 clients',
        includeCharts: true,
      },
    },
    tags: ['ai-feature', 'nl-report', 'april-roi'],
  },

  // ─── THURSDAY, April 16 ──────────────────────────────────────────────────
  {
    title: 'W2-Thu: Q2 Week-1 Campaign Optimization — All Clients Budget',
    description:
      'Week 1 Q2 optimization pass. Reallocate $8K from underperforming channels to top performers: Google Search (+$3K), Meta Lookalike (+$2K), LinkedIn InMail (+$3K). Update forecast model.',
    agentId: AGENTS.BUDGET,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 3, 9),
    input: {
      tool: 'budget_tracking',
      params: {
        action: 'reallocate',
        week: '2026-W16',
        transfers: [
          { from: 'display', to: 'google_search', amount: 3000 },
          { from: 'meta_retargeting', to: 'meta_lookalike', amount: 2000 },
        ],
      },
    },
    tags: ['budget', 'reallocation', 'q2-optimization'],
  },
  {
    title: 'W2-Thu: Client Outreach — 25 Priority Accounts (by AI Lead Score)',
    description:
      'AI-scored outreach to 25 highest-priority accounts. Lead scores 75–100. B2B SaaS + fintech focus. Personalize with: company news trigger, product match, competitive displacement angle.',
    agentId: AGENTS.OUTREACH,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 3, 10),
    input: {
      tool: 'email_send',
      params: {
        to: 'cto@priorityaccountone.com',
        subject:
          "Saw [Company]'s growth announcement — wanted to share something relevant",
        body: 'Hi [FirstName], I noticed [Company] just [trigger event]...',
      },
    },
    tags: ['outreach', 'priority-accounts', 'personalization'],
  },
  {
    title: 'W2-Thu: SEO Technical Fixes — TechCorp 15 Priority Issues',
    description:
      'Implement all 15 high-priority SEO fixes from Tuesday audit: 5 title tag rewrites, 4 meta descriptions, 3 heading structure fixes, 2 schema markup additions, 1 Core Web Vitals fix.',
    agentId: AGENTS.SEO,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 3, 9),
    input: {
      tool: 'seo_tools',
      params: {
        action: 'implement_fixes',
        domain: 'techcorp.com',
        fixes: [
          'title_tags',
          'meta_descriptions',
          'heading_structure',
          'schema_markup',
          'cwv_optimization',
        ],
        count: 15,
      },
    },
    tags: ['seo', 'technical', 'techcorp', 'implementation'],
  },
  {
    title: 'W2-Thu: Social Media Analytics — Q2 Week 1 Social Scorecard',
    description:
      'Compile social media scorecard for Q2 Week 1. TechCorp: +2.3K followers, 4.1% eng rate. Startup X: +890 followers, 6.8% eng rate (viral post). Acme Corp: +450 followers, 2.1%. ',
    agentId: AGENTS.SOCIAL,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W2_START, 3, 14),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'social_scorecard',
        period: '2026-W16',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
        metrics: ['followers', 'engagement_rate', 'reach', 'impressions'],
      },
    },
    tags: ['social-media', 'analytics', 'scorecard'],
  },
  {
    title: 'W2-Thu: Content Strategy Workshop — Q3 Content Pillars',
    description:
      'Workshop output: Define Q3 content pillars for each client. TechCorp: thought leadership + product education. Acme Corp: industry authority + case studies. Startup X: growth story + community. Create content briefs.',
    agentId: AGENTS.CONTENT,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W2_START, 3, 10),
    input: {
      tool: 'google_workspace',
      params: {
        action: 'create_document',
        title: 'Q3 Content Strategy — All Clients',
        folder: 'Strategy/Q3-2026',
        template: 'content-strategy',
      },
    },
    tags: ['content-strategy', 'q3-planning', 'google-docs'],
  },
  {
    title: 'W2-Thu: Operations Review — Automation Efficiency Report',
    description:
      'Measure impact of workflow automations deployed in W15. Count time saved, error reduction, task throughput improvement. Calculate ROI of AI agents: task completion rate, cost per task, human hours saved.',
    agentId: AGENTS.OPS,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W2_START, 3, 15),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'automation_efficiency',
        period: ['2026-W15', '2026-W16'],
        metrics: [
          'tasks_automated',
          'time_saved_hrs',
          'error_rate',
          'cost_per_task',
        ],
      },
    },
    tags: ['operations', 'automation', 'roi-of-ai'],
  },

  // ─── FRIDAY, April 17 ────────────────────────────────────────────────────
  {
    title: 'W2-Fri: 2-Week Retrospective & Next 2-Week Planning',
    description:
      'Comprehensive 2-week agency retrospective. Wins: 127 demos booked, Agency MRR $142K (+4.2%), Startup X viral post (8K reach). Improvements: CRO still needed, LinkedIn ROAS below target. Q2 outlook strong.',
    agentId: AGENTS.CEO,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 4, 10),
    input: {
      tool: 'report_builder',
      params: {
        reportType: 'two-week-retrospective',
        period: '2026-W15-W16',
        wins: 3,
        improvements: 2,
        nextActions: 5,
      },
    },
    tags: ['retrospective', 'planning', '2-week-review'],
  },
  {
    title: 'W2-Fri: Q2 Campaign Week-1 Review — Full Performance Report',
    description:
      'Official Week 1 Q2 campaign review. TechCorp: 284 leads (target 500/wk — underperforming SCALE UP). Acme Spring: 312 leads (above target). Startup X awareness: 1.2M impressions. Total spend: $48.2K / $52K.',
    agentId: AGENTS.CAMPAIGN,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 4, 9),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'weekly_campaign_review',
        week: '2026-W16',
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
        compareToTarget: true,
      },
    },
    tags: ['campaign', 'q2-review', 'week-1'],
  },
  {
    title: 'W2-Fri: 2-Week ROI & Cost Tracking Export (CSV)',
    description:
      'Export complete cost records for 2-week period: per-agent costs, per-tool costs, campaign ROI per client, AI token usage. Export as CSV for board-level financial review.',
    agentId: AGENTS.DATA,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 4, 14),
    input: {
      tool: 'export',
      params: {
        action: 'export_csv',
        dataTypes: [
          'cost_records',
          'agent_costs',
          'tool_costs',
          'campaign_roi',
        ],
        period: '2026-W15-W16',
        format: 'csv',
      },
    },
    tags: ['cost-tracking', 'csv-export', '2-week-roi'],
  },
  {
    title: 'W2-Fri: Agent Maturity Assessment — All 20 Agents',
    description:
      'Run agent maturity assessment: score all 20 agents on L1-L4 scale. Factors: task completion rate, cost efficiency, approval acceptance, error rate trend, tool diversity. 8 agents expected at L2+.',
    agentId: AGENTS.AI_OPS,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 4, 11),
    input: {
      tool: 'analytics_dashboard',
      params: {
        action: 'agent_maturity_assessment',
        agents: 'all',
        factors: [
          'task_completion',
          'cost_efficiency',
          'approval_rate',
          'error_trend',
          'tool_diversity',
        ],
      },
    },
    tags: ['agent-maturity', 'assessment', 'all-agents'],
  },
  {
    title: 'W2-Fri: SEO Progress Report — TechCorp Keyword Rankings',
    description:
      '2-week SEO progress after technical fixes. Track movement of top 50 target keywords. New rankings: +12 page 1, +26 page 2. Organic traffic trend: +8.3% WoW. Report to TechCorp.',
    agentId: AGENTS.SEO,
    priority: 'MEDIUM',
    scheduledAt: weekDay(W2_START, 4, 14),
    input: {
      tool: 'seo_tools',
      params: {
        action: 'track_rankings',
        domain: 'techcorp.com',
        keywords: 50,
        period: '2_weeks',
        reportTo: 'client',
      },
    },
    tags: ['seo', 'techcorp', 'progress-report'],
  },
  {
    title: 'W2-Fri: Approval Queue Clear — 12 Pending Approvals',
    description:
      'Clear end-of-week approvals: 4 content pieces, 3 creative assets, 2 invoices, 2 budget reallocations, 1 partnership agreement. Approve/reject/request revision with clear feedback.',
    agentId: AGENTS.ADMIN,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 4, 15),
    input: {
      tool: 'task_management',
      params: {
        action: 'list',
        status: 'PENDING',
        priority: 'HIGH',
        limit: 20,
      },
    },
    tags: ['approvals', 'governance', 'weekly-close'],
  },
  {
    title:
      'W2-Fri: Monthly Analytics Export — All Clients (Google Sheets + CSV)',
    description:
      'Export April 1-17 analytics data: all campaigns, all channels, all clients. Update master Google Sheets model, generate 3 client-specific dashboards, export combined CSV for data warehouse.',
    agentId: AGENTS.PERF,
    priority: 'HIGH',
    scheduledAt: weekDay(W2_START, 4, 16),
    input: {
      tool: 'spreadsheet',
      params: {
        action: 'update',
        title: 'April 2026 Analytics Export',
        dateRange: { start: '2026-04-01', end: '2026-04-17' },
        clients: ['TechCorp', 'Acme Corp', 'Startup X'],
      },
    },
    tags: ['analytics-export', 'google-sheets', 'monthly'],
  },
];

// ── Workflow templates (6 total) ─────────────────────────────────────────────
const WORKFLOW_TEMPLATES = [
  {
    name: 'Q2 Campaign Launch — Full Pipeline',
    description:
      'End-to-end campaign launch: Brief → Creative → Setup → Review → Launch → Monitor → Optimize. For TechCorp, Acme, Startup X.',
    status: 'ACTIVE',
    steps: [
      { name: 'Campaign Brief', agentRole: 'DIRECTOR', order: 1 },
      { name: 'Creative Production', agentRole: 'CONTENT', order: 2 },
      { name: 'Platform Setup', agentRole: 'CAMPAIGN', order: 3 },
      { name: 'Brand Review', agentRole: 'BRAND', order: 4 },
      { name: 'Launch', agentRole: 'CAMPAIGN', order: 5 },
      { name: 'Performance Monitor', agentRole: 'PERF', order: 6 },
    ],
  },
  {
    name: 'Weekly Client Report Pipeline',
    description:
      'Automated weekly client report generation. Data pull → Analysis → Narrative → Export → Send.',
    status: 'ACTIVE',
    steps: [
      { name: 'Data Pull', agentRole: 'DATA', order: 1 },
      { name: 'Analysis', agentRole: 'PERF', order: 2 },
      { name: 'Report Writing', agentRole: 'CONTENT', order: 3 },
      { name: 'Client Send', agentRole: 'ACCOUNT', order: 4 },
    ],
  },
  {
    name: 'New Lead Qualification & Outreach',
    description:
      'Incoming leads: Score → Qualify → Assign → Outreach → CRM Update',
    status: 'ACTIVE',
    steps: [
      { name: 'Lead Scoring', agentRole: 'LEAD', order: 1 },
      { name: 'ICP Qualification', agentRole: 'SALES', order: 2 },
      { name: 'Email Outreach', agentRole: 'OUTREACH', order: 3 },
      { name: 'CRM Update', agentRole: 'LEAD', order: 4 },
    ],
  },
  {
    name: 'Content Approval & Publishing',
    description:
      'Content production → Brand review → Client approval → SEO optimize → Publish',
    status: 'ACTIVE',
    steps: [
      { name: 'Content Creation', agentRole: 'CONTENT', order: 1 },
      { name: 'Brand Check', agentRole: 'BRAND', order: 2 },
      { name: 'Client Approval', agentRole: 'ACCOUNT', order: 3 },
      { name: 'SEO Optimization', agentRole: 'SEO', order: 4 },
      { name: 'Publish', agentRole: 'SOCIAL', order: 5 },
    ],
  },
  {
    name: 'Supervisor-Worker: Campaign Orchestration',
    description:
      'CEO Agent supervises Campaign Manager + Performance Analyst + Social Media Manager in parallel execution of campaign launch tasks.',
    status: 'ACTIVE',
    steps: [
      {
        name: 'Supervisor Brief',
        agentRole: 'CEO',
        order: 1,
        isSupervisor: true,
      },
      {
        name: 'Campaign Setup (Worker 1)',
        agentRole: 'CAMPAIGN',
        order: 2,
        workerOf: 'CEO',
      },
      {
        name: 'Performance Setup (Worker 2)',
        agentRole: 'PERF',
        order: 2,
        workerOf: 'CEO',
      },
      {
        name: 'Social Push (Worker 3)',
        agentRole: 'SOCIAL',
        order: 2,
        workerOf: 'CEO',
      },
      {
        name: 'Aggregation & Report',
        agentRole: 'CEO',
        order: 3,
        isSupervisor: true,
      },
    ],
  },
  {
    name: 'Google Workspace Integration — Research → Drive',
    description:
      'Research agent pulls data → saves to Drive Docs/Sheets → shares with account team → notification sent via Gmail.',
    status: 'DRAFT',
    steps: [
      { name: 'Web Research', agentRole: 'RESEARCH', order: 1 },
      { name: 'Save to Google Drive', agentRole: 'AI_OPS', order: 2 },
      { name: 'Update Google Sheets', agentRole: 'DATA', order: 3 },
      { name: 'Gmail Notification', agentRole: 'EMAIL_MKT', order: 4 },
    ],
  },
];

// ── Main execution ───────────────────────────────────────────────────────────
async function main() {
  section('NeureCore — 2-Week Marketing Agency Demo Seed');
  info(`Target: ${DEMO_EMAIL} | Tenant: ${TENANT_ID}`);
  info(
    `Mode: ${RESET_MODE ? 'RESET+SEED' : W1_ONLY ? 'WEEK1 ONLY' : W2_ONLY ? 'WEEK2 ONLY' : AUDIT_ONLY ? 'AUDIT ONLY' : 'FULL SEED (W1+W2)'}`,
  );

  // Step 1: Login
  section('Step 1: Authentication');
  let token = '';
  try {
    const loginRes = await apiCall('POST', '/auth/login', {
      email: DEMO_EMAIL,
      password: DEMO_PASS,
    });
    token =
      loginRes?.data?.tokens?.accessToken || loginRes?.data?.accessToken || '';
    if (!token) {
      fail(`Login failed: ${JSON.stringify(loginRes).slice(0, 200)}`);
      process.exit(1);
    }
    pass(`Logged in as ${DEMO_EMAIL}`);
  } catch (e) {
    fail(`Login error: ${e.message}`);
    process.exit(1);
  }

  // Step 2: Validate tenant state
  section('Step 2: Tenant Validation');
  const tenantRes = await apiCall('GET', '/tenants/me', null, token);
  const tenant = tenantRes?.data;
  if (tenant?.id) {
    pass(`Tenant: ${tenant.name || tenant.id} (${tenant.industry || 'N/A'})`);
  } else {
    warn(
      `Could not fetch tenant details: ${JSON.stringify(tenantRes).slice(0, 100)}`,
    );
  }

  // Step 3: Count existing agents
  const agentsRes = await apiCall('GET', '/agents', null, token);
  let agentsArr = agentsRes?.data?.data ?? agentsRes?.data ?? [];
  if (!Array.isArray(agentsArr)) agentsArr = [];
  info(`Current agents: ${agentsArr.length}`);

  if (AUDIT_ONLY) {
    section('Audit Mode — Current State');
    const tasksRes = await apiCall('GET', '/tasks', null, token);
    let tasksArr = tasksRes?.data?.data ?? tasksRes?.data ?? [];
    if (!Array.isArray(tasksArr)) tasksArr = [];
    info(`Tasks: ${tasksArr.length}`);

    const wfRes = await apiCall('GET', '/workflows', null, token);
    let wfArr = wfRes?.data?.data ?? wfRes?.data ?? [];
    if (!Array.isArray(wfArr)) wfArr = [];
    info(`Workflows: ${wfArr.length}`);

    const deptRes = await apiCall('GET', '/departments', null, token);
    let deptArr = deptRes?.data?.data ?? deptRes?.data ?? [];
    if (!Array.isArray(deptArr)) deptArr = [];
    info(`Departments: ${deptArr.length}`);

    console.log('\n📊 Current Agent Status:');
    for (const a of agentsArr.slice(0, 10)) {
      console.log(`   ${a.name} | ${a.status} | ${a.type}`);
    }
    return;
  }

  // Step 4: Get real agent IDs from DB
  section('Step 3: Resolve Agent IDs');
  const agentIdMap = {};
  for (const a of agentsArr) {
    // Match by ID suffix
    const slug = a.id.replace(TENANT_ID + '-', '');
    for (const [key, expectedId] of Object.entries(AGENTS)) {
      if (a.id === expectedId) {
        agentIdMap[key] = a.id;
      }
    }
    // Also match by name
    if (a.name?.includes('CEO') || a.name === 'CEO Agent')
      agentIdMap['CEO'] = agentIdMap['CEO'] || a.id;
    if (a.name?.includes('Director') || a.name?.includes('Marketing Director'))
      agentIdMap['DIRECTOR'] = agentIdMap['DIRECTOR'] || a.id;
    if (a.name?.includes('Social Media'))
      agentIdMap['SOCIAL'] = agentIdMap['SOCIAL'] || a.id;
    if (a.name === 'Content Creator')
      agentIdMap['CONTENT'] = agentIdMap['CONTENT'] || a.id;
    if (a.name === 'Data Analyst')
      agentIdMap['DATA'] = agentIdMap['DATA'] || a.id;
    if (a.name === 'Research Analyst')
      agentIdMap['RESEARCH'] = agentIdMap['RESEARCH'] || a.id;
    if (a.name?.includes('Sales'))
      agentIdMap['SALES'] = agentIdMap['SALES'] || a.id;
    if (a.name?.includes('Account Manager'))
      agentIdMap['ACCOUNT'] = agentIdMap['ACCOUNT'] || a.id;
    if (a.name?.includes('Operations'))
      agentIdMap['OPS'] = agentIdMap['OPS'] || a.id;
    if (
      a.name?.includes('Administrative') ||
      a.name?.includes('Admin Assistant')
    )
      agentIdMap['ADMIN'] = agentIdMap['ADMIN'] || a.id;
    if (a.name?.includes('SEO') || a.name === 'SEO & Content Analyst')
      agentIdMap['SEO'] = agentIdMap['SEO'] || a.id;
    if (
      a.name?.includes('Email Marketing') ||
      a.name?.includes('Email Specialist')
    )
      agentIdMap['EMAIL_MKT'] = agentIdMap['EMAIL_MKT'] || a.id;
    if (a.name === 'Campaign Manager')
      agentIdMap['CAMPAIGN'] = agentIdMap['CAMPAIGN'] || a.id;
    if (a.name === 'Performance Analyst')
      agentIdMap['PERF'] = agentIdMap['PERF'] || a.id;
    if (a.name?.includes('Client Relations'))
      agentIdMap['CLIENT'] = agentIdMap['CLIENT'] || a.id;
    if (a.name === 'Budget Controller')
      agentIdMap['BUDGET'] = agentIdMap['BUDGET'] || a.id;
    if (a.name?.includes('Lead') || a.name === 'Lead Generation Bot')
      agentIdMap['LEAD'] = agentIdMap['LEAD'] || a.id;
    if (a.name?.includes('Brand'))
      agentIdMap['BRAND'] = agentIdMap['BRAND'] || a.id;
    if (a.name?.includes('Outreach'))
      agentIdMap['OUTREACH'] = agentIdMap['OUTREACH'] || a.id;
    if (a.name?.includes('AI Ops') || a.name === 'AI Ops Engineer')
      agentIdMap['AI_OPS'] = agentIdMap['AI_OPS'] || a.id;
  }

  // Fallback: use first agent for any unmapped key
  const fallbackId = agentsArr[0]?.id;
  for (const key of Object.keys(AGENTS)) {
    if (!agentIdMap[key]) {
      agentIdMap[key] = fallbackId;
      warn(`Agent ${key} not found — using fallback: ${fallbackId}`);
    } else {
      pass(`Agent ${key}: ${agentIdMap[key]}`);
    }
  }

  // Step 5: Reset if requested
  if (RESET_MODE) {
    section('Step 4: Reset Demo Tasks');
    const tasksRes = await apiCall('GET', '/tasks', null, token);
    let oldTasks = tasksRes?.data?.data ?? tasksRes?.data ?? [];
    if (!Array.isArray(oldTasks)) oldTasks = [];
    let deleted = 0;
    for (const t of oldTasks) {
      if (
        t.title?.startsWith('W1-') ||
        t.title?.startsWith('W2-') ||
        t.title?.startsWith('Test ')
      ) {
        const dr = await apiCall('DELETE', `/tasks/${t.id}`, null, token);
        if (dr?._statusCode < 300) deleted++;
      }
    }
    info(`Deleted ${deleted} old demo tasks`);
  }

  // Step 6: Create tasks
  const allTasks = [
    ...(W2_ONLY ? [] : WEEK1_TASKS),
    ...(W1_ONLY ? [] : WEEK2_TASKS),
  ];

  section(`Step 5: Creating ${allTasks.length} Tasks`);
  let taskCreated = 0,
    taskFailed = 0;
  const createdTaskIds = [];

  for (const task of allTasks) {
    // Resolve agent ID: task.agentId is already a full UUID from AGENTS const
    // Match by looking up which key maps to that UUID in agentIdMap
    let agentId = null;
    if (task.agentId) {
      // Find the key for this agentId in AGENTS
      const keyForAgent = Object.entries(AGENTS).find(
        ([k, v]) => v === task.agentId,
      )?.[0];
      if (keyForAgent && agentIdMap[keyForAgent]) {
        agentId = agentIdMap[keyForAgent];
      } else {
        // Try direct match in agentIdMap values
        const directMatch = Object.values(agentIdMap).find(
          (v) => v === task.agentId,
        );
        agentId = directMatch || fallbackId;
      }
    }

    const payload = {
      title: task.title,
      description: task.description,
      agentId: agentId,
      priority: task.priority || 'MEDIUM',
      scheduledAt: task.scheduledAt,
      input: task.input || {},
    };

    try {
      const res = await apiCall('POST', '/tasks', payload, token);
      const taskId = res?.data?.id || res?.data?.data?.id;
      if (taskId) {
        taskCreated++;
        createdTaskIds.push(taskId);
        process.stdout.write(`  ✓ ${task.title.slice(0, 70)}\n`);
      } else {
        taskFailed++;
        process.stdout.write(
          `  ✗ ${task.title.slice(0, 60)} | ${JSON.stringify(res).slice(0, 80)}\n`,
        );
      }
    } catch (e) {
      taskFailed++;
      process.stdout.write(
        `  ✗ ${task.title.slice(0, 60)} | Error: ${e.message}\n`,
      );
    }
  }
  info(`Tasks: ${taskCreated} created, ${taskFailed} failed`);

  // Step 7: Create/update workflows
  section('Step 6: Workflow Templates');
  let wfCreated = 0;
  for (const wf of WORKFLOW_TEMPLATES) {
    const payload = {
      name: wf.name,
      description: wf.description,
      definition: { steps: wf.steps, status: wf.status },
      isTemplate: true,
    };
    const res = await apiCall('POST', '/workflows', payload, token);
    const wfId = res?.data?.id || res?.data?.data?.id;
    if (wfId) {
      wfCreated++;
      pass(`Workflow: ${wf.name}`);
    } else {
      warn(
        `Workflow skipped: ${wf.name} | ${JSON.stringify(res).slice(0, 80)}`,
      );
    }
  }
  info(`Workflows: ${wfCreated}/${WORKFLOW_TEMPLATES.length} created`);

  // Step 8: Knowledge Spaces
  section('Step 7: Knowledge Spaces');
  const ksPayloads = [
    {
      name: 'Research & Competitive Intelligence',
      description:
        'All competitor research, market trends, keyword data, and industry analysis documents. Used by Research Analyst and Brand Strategist.',
    },
    {
      name: 'Brand Guidelines & Assets',
      description:
        'TechCorp, Acme Corp, Startup X and agency brand guidelines. Logo usage, color palettes, tone of voice, approved imagery.',
    },
    {
      name: 'Campaign Performance Archive',
      description:
        'Historical campaign performance data, A/B test results, and benchmark metrics for all clients 2024–2026.',
    },
  ];
  for (const ks of ksPayloads) {
    const res = await apiCall('POST', '/knowledge/spaces', ks, token);
    const ksId = res?.data?.id || res?.data?.data?.id;
    if (ksId) {
      pass(`Knowledge Space: ${ks.name}`);
    } else {
      warn(`Knowledge Space: ${ks.name} | ${JSON.stringify(res).slice(0, 80)}`);
    }
  }

  // Step 9: Budget Policies
  section('Step 8: Budget Policies');
  const MAJOR_AGENT_IDS = Object.values(agentIdMap).slice(0, 5).filter(Boolean);
  for (let i = 0; i < Math.min(3, MAJOR_AGENT_IDS.length); i++) {
    const aId = MAJOR_AGENT_IDS[i];
    const bpRes = await apiCall(
      'POST',
      '/costs/budgets',
      {
        name: `Agent Budget Policy ${i + 1}`,
        scope: 'AGENT',
        scopeId: aId,
        period: 'WEEKLY',
        limitCents: (i === 0 ? 50 : i === 1 ? 35 : 20) * 100,
        action: 'ALERT',
      },
      token,
    );
    if (bpRes?.data?.id || bpRes?.data?.data?.id) {
      pass(`Budget policy set for agent ${i + 1}`);
    } else {
      warn(
        `Budget policy failed for agent ${i + 1}: ${JSON.stringify(bpRes).slice(0, 80)}`,
      );
    }
  }

  // Step 10: Approval Requests
  section('Step 9: Approval Requests');
  const APPROVAL_ITEMS = [
    {
      title: 'TechCorp Q2 Ad Spend Increase (+$8K)',
      requestedBy: 'campaign-manager@agency.local',
      type: 'BUDGET',
      priority: 'HIGH',
    },
    {
      title: 'Acme Corp Brand Evolution Direction 2 Approval',
      requestedBy: 'brand-strategist@agency.local',
      type: 'CREATIVE',
      priority: 'HIGH',
    },
    {
      title: 'New Content Type: AI-Generated Video Scripts',
      requestedBy: 'content-creator@agency.local',
      type: 'STRATEGY',
      priority: 'MEDIUM',
    },
    {
      title: 'LinkedIn Campaign Audience Expansion',
      requestedBy: 'performance-analyst@agency.local',
      type: 'CAMPAIGN',
      priority: 'MEDIUM',
    },
    {
      title: 'Startup X Partnership Agreement Review',
      requestedBy: 'ceo-agent@agency.local',
      type: 'PARTNERSHIP',
      priority: 'URGENT',
    },
    {
      title: 'Q3 Keyword Target List (50 New KWs)',
      requestedBy: 'seo-analyst@agency.local',
      type: 'SEO',
      priority: 'LOW',
    },
  ];
  let approvalCreated = 0;
  for (const ap of APPROVAL_ITEMS) {
    const res = await apiCall(
      'POST',
      '/approvals',
      {
        title: ap.title,
        description: `Approval request: ${ap.title}. Please review and approve/reject with feedback.`,
        resourceType: ap.type || 'GENERAL',
        priority: ap.priority || 'MEDIUM',
        expiresAt: weekDay(W2_START, 4, 23),
      },
      token,
    );
    if (res?.data?.id || res?.data?.data?.id) {
      approvalCreated++;
      pass(`Approval: ${ap.title}`);
    } else {
      warn(`Approval: ${ap.title} | ${JSON.stringify(res).slice(0, 80)}`);
    }
  }
  info(`Approval requests: ${approvalCreated}/${APPROVAL_ITEMS.length}`);

  // Step 11: Agent Version Snapshots
  section('Step 10: Agent Version Snapshots');
  const versionsToCreate = [
    {
      agentKey: 'CONTENT',
      label: 'v1.0 — Initial prompt',
      changeNote: 'Initial deployment prompt',
    },
    {
      agentKey: 'CONTENT',
      label: 'v1.1 — SEO optimization added',
      changeNote: 'Added SEO best practices to prompt',
    },
    {
      agentKey: 'CONTENT',
      label: 'v1.2 — Google Drive integration',
      changeNote: 'Now saves outputs directly to Google Drive',
    },
    {
      agentKey: 'CAMPAIGN',
      label: 'v1.0 — Campaign base',
      changeNote: 'Basic campaign management',
    },
    {
      agentKey: 'CAMPAIGN',
      label: 'v1.1 — Q2 launch config',
      changeNote: 'Optimized for Q2 multi-campaign launch',
    },
    {
      agentKey: 'PERF',
      label: 'v1.0 — Analytics base',
      changeNote: 'Initial release',
    },
    {
      agentKey: 'PERF',
      label: 'v1.1 — Attribution models',
      changeNote: 'Added multi-touch attribution support',
    },
  ];
  for (const v of versionsToCreate) {
    const aId = agentIdMap[v.agentKey];
    if (!aId) {
      warn(`Agent ${v.agentKey} not found for version snapshot`);
      continue;
    }
    const res = await apiCall(
      'POST',
      `/agents/${aId}/versions`,
      {
        label: v.label,
        changeNote: v.changeNote,
      },
      token,
    );
    if (res?.data?.id || res?.data?.data?.id) {
      pass(`Version snapshot: ${v.agentKey} ${v.label}`);
    } else {
      warn(
        `Version snapshot: ${v.agentKey} | ${JSON.stringify(res).slice(0, 80)}`,
      );
    }
  }

  // Step 12: Final summary
  section('Summary');
  const finalTasksRes = await apiCall('GET', '/tasks', null, token);
  let finalTasks = finalTasksRes?.data?.data ?? finalTasksRes?.data ?? [];
  if (!Array.isArray(finalTasks)) finalTasks = [];

  const finalWfRes = await apiCall('GET', '/workflows', null, token);
  let finalWfs = finalWfRes?.data?.data ?? finalWfRes?.data ?? [];
  if (!Array.isArray(finalWfs)) finalWfs = [];

  console.log('');
  console.log('  📊 Demo State:');
  console.log(`     Agents:    ${agentsArr.length} deployed`);
  console.log(`     Tasks:     ${finalTasks.length} total`);
  console.log(`     Workflows: ${finalWfs.length} total`);
  console.log(`     New tasks: ${taskCreated} (this run)`);
  console.log(`     Approvals: ${approvalCreated} pending`);
  console.log('');
  console.log('  ✅ Passed:', PASS);
  console.log('  ⚠️  Warned:', WARN);
  console.log('  ❌ Failed:', FAIL);

  if (FAIL === 0 && WARN <= 5) {
    console.log(
      '\n  🎉 Demo ready! Login: demo@marketing-agency.local / Marketing@123!',
    );
  } else {
    console.log('\n  ⚠️  Some issues found — review warnings above');
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});

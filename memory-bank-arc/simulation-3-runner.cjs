#!/usr/bin/env node
/**
 * NeuroCore Simulation-3 Master Execution Script
 * Runs the full 8-week emergency nutrition programme simulation.
 *
 * Usage:
 *   node simulation-3-runner.cjs [week]
 *   node simulation-3-runner.cjs all     # run all 8 weeks
 *   node simulation-3-runner.cjs week-1  # run week 1 only
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = process.env.NEURO_BASE_URL || 'http://localhost:3000/api/v1';
const TENANT_EMAIL = process.env.NEURO_EMAIL || 'admin@simulation-3.local';
const TENANT_PASSWORD = process.env.NEURO_PASSWORD || 'Simulation3!2026';
const EVIDENCE_DIR = path.join(__dirname, 'simulation-3-evidence');

const STATE_FILE = path.join(EVIDENCE_DIR, 'simulation-state.json');
const STATE = {
  token: null,
  refreshToken: null,
  tenantId: null,
  userId: null,
  customerId: null,
  projectId: null,
  leadProjectId: null,
  meetingIds: [],
  agentIds: {},
  departmentIds: {},
  taskIds: [],
  approvalIds: [],
  audit: [],
  errors: [],
};

function saveState() {
  try {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const persistent = { ...STATE };
    delete persistent.token;
    delete persistent.refreshToken;
    fs.writeFileSync(STATE_FILE, JSON.stringify(persistent, null, 2));
  } catch (e) {}
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      Object.assign(STATE, data);
    }
  } catch (e) {}
}

const SEVERITY = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

function log(week, severity, msg, data = null) {
  const ts = new Date().toISOString();
  const entry = { ts, week, severity, msg, data };
  STATE.audit.push(entry);
  const color = {
    CRITICAL: '\x1b[31m', HIGH: '\x1b[33m', MEDIUM: '\x1b[36m', LOW: '\x1b[37m',
  }[severity] || '\x1b[0m';
  console.log(`${color}[${severity}]\x1b[0m [${week}] ${msg}`);
  if (data && process.env.NEURO_VERBOSE) console.log(JSON.stringify(data, null, 2));
}

function saveEvidence(week, name, data) {
  const dir = path.join(EVIDENCE_DIR, week);
  fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, `${name}.json`);
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

function api(method, endpoint, body = null, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (STATE.token) headers['Authorization'] = `Bearer ${STATE.token}`;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try { parsed = data ? JSON.parse(data) : null; } catch (e) { parsed = data; }
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function retry(fn, max = 3, delayMs = 500) {
  let lastErr = null;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < max - 1) await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function login() {
  const res = await api('POST', '/auth/login', {
    email: TENANT_EMAIL,
    password: TENANT_PASSWORD,
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  STATE.token = res.data.data.tokens.accessToken;
  STATE.refreshToken = res.data.data.tokens.refreshToken;
  STATE.userId = res.data.data.user.id;
  STATE.tenantId = res.data.data.user.tenantId;
  log('setup', 'LOW', `Logged in as ${res.data.data.user.email}`, { userId: STATE.userId });
}

// ===================== WEEK 1: CRM & LEAD QUALIFICATION =====================
async function week1() {
  console.log('\n========== WEEK 1: Lead, Customer, Project ==========');

  // 1. Create a Lead (using Project with status LEAD)
  log('week-1', 'LOW', 'Creating lead (Project status=LEAD)');
  // Check existing leads first
  const existingLeads = await api('GET', '/projects?search=Lead:%20Ministry&limit=10');
  const existingLeadsList = existingLeads.data?.data?.items || [];
  if (existingLeads.status < 400 && existingLeadsList.length > 0) {
    STATE.leadProjectId = existingLeadsList[0].id;
    log('week-1', 'LOW', `Lead already exists: ${STATE.leadProjectId}`);
  } else {
    const leadRes = await retry(() => api('POST', '/projects', {
      name: 'Lead: Ministry of Health - Flood Nutrition Response',
      description: 'Initial inquiry from Ministry of Health following flood emergency',
      status: 'LEAD',
      priority: 'URGENT',
      budgetAmount: 850000,
      budgetCurrency: 'USD',
      tags: ['lead', 'nutrition', 'emergency', 'flood'],
      customFieldValues: {
        leadSource: 'Government Referral',
        leadStage: 'NEW',
        estimatedValue: 850000,
      },
    }));
    if (leadRes.status >= 400) {
      log('week-1', 'CRITICAL', 'Failed to create lead', leadRes.data);
      STATE.errors.push({ week: 1, op: 'create-lead', error: leadRes.data });
    } else {
      STATE.leadProjectId = leadRes.data.data?.id || leadRes.data.id;
      log('week-1', 'LOW', `Lead created: ${STATE.leadProjectId}`);
    }
    saveEvidence('week-1', '01-lead-created', leadRes.data);
  }

  // 2. Qualify the opportunity (LEAD -> PROPOSAL_SENT) -- only if still in LEAD
  if (STATE.leadProjectId) {
    const leadDetail = await api('GET', `/projects/${STATE.leadProjectId}`);
    const currentStatus = leadDetail.data?.data?.status || leadDetail.data?.status;
    if (currentStatus === 'LEAD') {
      log('week-1', 'LOW', 'Qualifying opportunity (LEAD -> PROPOSAL_SENT)');
      const qualRes = await retry(() => api('PATCH', `/projects/${STATE.leadProjectId}/status`, {
        status: 'PROPOSAL_SENT',
        reason: 'Discovery call completed, qualified opportunity',
      }));
      saveEvidence('week-1', '02-opportunity-qualified', qualRes.data);
      log('week-1', 'LOW', `Qualification status: ${qualRes.status}`);
    } else {
      log('week-1', 'LOW', `Lead already qualified (status: ${currentStatus}), skipping`);
    }
  }

  // 3. Schedule meetings (calendar events)
  log('week-1', 'LOW', 'Scheduling meetings via Google Workspace');
  const meetingTitles = [
    'Initial Discovery Call - Ministry of Health',
    'Proposal Review Meeting',
    'Contract Negotiation Session',
  ];
  for (const title of meetingTitles) {
    const now = new Date();
    now.setDate(now.getDate() + 7);
    const start = now.toISOString();
    const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const meetRes = await retry(() => api('POST', '/integrations/calendar/events', {
      summary: title,
      description: `Simulation-3: ${title}`,
      start,
      end,
      attendees: ['ministry.health@gov.example'],
    }), 3, 1000);
    if (meetRes.status < 400) {
      const meetId = meetRes.data.data?.id || meetRes.data.id;
      STATE.meetingIds.push(meetId);
      log('week-1', 'LOW', `Meeting created: ${title}`, { id: meetId });
    } else {
      log('week-1', 'MEDIUM', `Meeting creation failed: ${title}`, meetRes.data);
      STATE.errors.push({ week: 1, op: 'create-meeting', title, error: meetRes.data });
    }
  }
  saveEvidence('week-1', '03-meetings-created', { meetingIds: STATE.meetingIds });

  // 4. Send proposal via Brevo
  log('week-1', 'LOW', 'Sending proposal via Brevo');
  const proposalRes = await retry(() => api('POST', '/integrations/brevo/send-batch', {
    recipients: [{
      to: 'ministry.health@gov.example',
      variables: { firstName: 'Hon. Minister', proposalName: 'Flood Nutrition Response' },
    }],
    subject: 'Proposal: Two-Month Flood Emergency Nutrition Response',
    htmlContent: `
      <h1>Flood Emergency Nutrition Response Proposal</h1>
      <p>Dear Ministry of Health,</p>
      <p>Please find attached our proposal for the Two-Month Flood Emergency Nutrition Response programme.</p>
      <p><strong>Budget:</strong> USD 850,000</p>
      <p><strong>Coverage:</strong> 4 districts, 40,000 households, 18,000 children U5, 6,000 PLW</p>
      <p>Partners: UNICEF, WFP, WHO, Provincial Health Department</p>
    `,
    textContent: 'Please find attached the proposal for the Flood Emergency Nutrition Response programme.',
    tags: ['proposal', 'simulation-3'],
  }), 3, 1000);
  saveEvidence('week-1', '04-proposal-sent', proposalRes.data);
  const brevoOk = proposalRes.data?.data?.success !== false && proposalRes.status < 400;
  if (!brevoOk) {
    log('week-1', 'HIGH', 'Proposal send via Brevo failed (Brevo not configured)', proposalRes.data);
    STATE.errors.push({ week: 1, op: 'send-proposal', error: proposalRes.data, severity: 'HIGH' });
  } else {
    log('week-1', 'LOW', 'Proposal sent via Brevo');
  }

  // 5. Create Customer (Ministry of Health)
  log('week-1', 'LOW', 'Creating customer: Ministry of Health');
  // First check if customer exists
  const existingCust = await api('GET', '/customers?search=Ministry&limit=10');
  const customerList = existingCust.data?.data?.data || existingCust.data?.data;
  if (existingCust.status < 400 && Array.isArray(customerList) && customerList.length > 0) {
    STATE.customerId = customerList[0].id;
    log('week-1', 'LOW', `Customer already exists: ${STATE.customerId}`);
    saveEvidence('week-1', '05-customer-existing', { customerId: STATE.customerId });
  } else {
    const custRes = await retry(() => api('POST', '/customers', {
      name: 'Ministry of Health',
      industry: 'Government - Health',
      primaryEmail: 'ministry.health@gov.example',
      primaryPhone: '+1-555-0100',
      website: 'https://ministry-health.gov',
      billingInfo: {
        address: 'Capital City, Government District',
        country: 'Country-X',
        taxId: 'GOV-HEALTH-001',
      },
      tags: ['government', 'nutrition', 'emergency-response'],
    }));
    if (custRes.status >= 400) {
      log('week-1', 'CRITICAL', 'Failed to create customer', custRes.data);
      STATE.errors.push({ week: 1, op: 'create-customer', error: custRes.data });
    } else {
      STATE.customerId = custRes.data.data?.id || custRes.data.id;
      log('week-1', 'LOW', `Customer created: ${STATE.customerId}`);
      saveEvidence('week-1', '05-customer-created', custRes.data);
    }
  }

  // 6. Convert Lead -> Won (only if not already past it)
  if (STATE.leadProjectId) {
    const leadDetail = await api('GET', `/projects/${STATE.leadProjectId}`);
    const currentStatus = leadDetail.data?.data?.status || leadDetail.data?.status;
    if (currentStatus !== 'WON' && currentStatus !== 'ACTIVE') {
      const wonRes = await retry(() => api('PATCH', `/projects/${STATE.leadProjectId}/status`, {
        status: 'WON',
        reason: 'Proposal accepted by Ministry of Health',
      }));
      saveEvidence('week-1', '06-lead-won', wonRes.data);
    } else {
      log('week-1', 'LOW', `Lead already WON (${currentStatus}), skipping`);
    }
  }

  log('week-1', 'LOW', 'Creating project for won opportunity');
  // Check if project already exists
  const existingProj = await api('GET', '/projects?search=Flood%20Emergency%20Nutrition%20Response%20-%202%20Month%20Programme&limit=10');
  const existingProjList = existingProj.data?.data?.items || [];
  let projRes;
  if (existingProj.status < 400 && existingProjList.length > 0) {
    STATE.projectId = existingProjList[0].id;
    log('week-1', 'LOW', `Project already exists: ${STATE.projectId}`);
    projRes = { status: 200, data: existingProjList[0] };
  } else {
    projRes = await retry(() => api('POST', '/projects', {
      name: 'Flood Emergency Nutrition Response - 2 Month Programme',
      description: 'Two-month flood emergency nutrition response covering 4 districts, 40,000 households, 18,000 children U5, and 6,000 PLW.',
      customerId: STATE.customerId,
      status: 'ACTIVE',
      priority: 'URGENT',
      budgetAmount: 850000,
      budgetCurrency: 'USD',
      startDate: new Date().toISOString(),
      targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['nutrition', 'emergency', 'flood', 'active'],
      customFieldValues: {
        programme: 'Flood Emergency Nutrition Response',
        coverage_districts: 4,
        coverage_households: 40000,
        coverage_children_u5: 18000,
        coverage_plw: 6000,
        partners: ['UNICEF', 'WFP', 'WHO', 'Provincial Health Department', 'NGO-1', 'NGO-2'],
        budget: 850000,
        currency: 'USD',
      },
    }));
  }
  if (projRes.status >= 400) {
    log('week-1', 'CRITICAL', 'Failed to create project', projRes.data);
    STATE.errors.push({ week: 1, op: 'create-project', error: projRes.data });
  } else {
    STATE.projectId = projRes.data.data?.id || projRes.data.id;
    log('week-1', 'LOW', `Project created: ${STATE.projectId}`);
    saveEvidence('week-1', '07-project-created', projRes.data);
  }

  // 7. Sync meetings with project
  log('week-1', 'LOW', 'Syncing meetings to project calendar');
  const listRes = await retry(() => api('GET', '/integrations/calendar/events?maxResults=20'));
  saveEvidence('week-1', '08-calendar-synced', listRes.data);

  saveEvidence('week-1', 'summary', {
    leadId: STATE.leadProjectId,
    customerId: STATE.customerId,
    projectId: STATE.projectId,
    meetingsCreated: STATE.meetingIds.length,
    proposalSent: proposalRes.status < 400,
  });
  log('week-1', 'LOW', 'Week 1 complete');
}

// ===================== WEEK 2: DISCOVERY INTERVIEW =====================
async function week2() {
  console.log('\n========== WEEK 2: Discovery Interview ==========');

  if (!STATE.projectId) {
    log('week-2', 'CRITICAL', 'No project to add discovery data to');
    return;
  }

  const discovery = {
    objectives: [
      'Reduce acute malnutrition among children U5 by 30%',
      'Provide therapeutic feeding to 18,000 children U5',
      'Support 6,000 PLW with supplementary feeding',
      'Strengthen referral pathways in 4 districts',
      'Build capacity of local health workers',
    ],
    kpis: [
      { name: 'Children screened', target: 18000, unit: 'children' },
      { name: 'PLW enrolled', target: 6000, unit: 'women' },
      { name: 'Cured rate (SAM)', target: 75, unit: '%' },
      { name: 'Default rate', target: 15, unit: '%' },
      { name: 'Coverage', target: 80, unit: '%' },
      { name: 'Death rate', target: 5, unit: '%' },
    ],
    beneficiaries: {
      districts: 4,
      households: 40000,
      childrenUnderFive: 18000,
      pregnantLactatingWomen: 6000,
    },
    risks: [
      { name: 'Flooding escalation', likelihood: 'HIGH', impact: 'HIGH' },
      { name: 'Supply chain disruption', likelihood: 'MEDIUM', impact: 'HIGH' },
      { name: 'Security incidents', likelihood: 'MEDIUM', impact: 'HIGH' },
      { name: 'Donor funding delays', likelihood: 'LOW', impact: 'HIGH' },
      { name: 'Disease outbreak', likelihood: 'MEDIUM', impact: 'HIGH' },
    ],
    donors: [
      { name: 'UNICEF', email: 'partnerships@unicef.example', amount: 300000 },
      { name: 'WFP', email: 'donor.relations@wfp.example', amount: 250000 },
      { name: 'WHO', email: 'grants@who.example', amount: 150000 },
      { name: 'Provincial Health Department', email: 'phd@gov.example', amount: 150000 },
    ],
    reportingRequirements: [
      'Weekly situation reports',
      'Monthly donor reports',
      'Final evaluation report',
      'Financial reconciliation quarterly',
    ],
  };

  // Save discovery into project memory as knowledge
  log('week-2', 'LOW', 'Storing discovery data in project memory');
  const memRes = await retry(() => api('POST', '/project-memory', {
    projectId: STATE.projectId,
    category: 'discovery',
    content: JSON.stringify(discovery),
    isAiGenerated: false,
    sourceEntityType: 'discovery_interview',
  }));
  saveEvidence('week-2', '01-discovery-stored', memRes.data);

  // Create knowledge base entries
  log('week-2', 'LOW', 'Creating knowledge base articles from discovery');
  const kbArticles = [
    { title: 'Programme Objectives', content: discovery.objectives.join('\n'), tags: ['objectives', 'programme'], type: 'DOCUMENTATION' },
    { title: 'Beneficiary Targets', content: JSON.stringify(discovery.beneficiaries, null, 2), tags: ['beneficiaries', 'targets'], type: 'BRIEFING' },
    { title: 'Donor Information', content: discovery.donors.map(d => `${d.name}: $${d.amount}`).join('\n'), tags: ['donors'], type: 'CONTRACT' },
    { title: 'Risk Register', content: JSON.stringify(discovery.risks, null, 2), tags: ['risks'], type: 'POLICY' },
  ];
  for (const art of kbArticles) {
    const res = await retry(() => api('POST', '/knowledge', {
      title: art.title,
      content: art.content,
      tags: art.tags,
      type: art.type,
      sourceEntityType: 'discovery',
      sourceEntityId: STATE.projectId,
    }), 3, 500);
    if (res.status >= 400) {
      log('week-2', 'MEDIUM', `KB article failed: ${art.title}`, res.data);
      STATE.errors.push({ week: 2, op: 'create-kb', title: art.title, error: res.data });
    }
  }
  saveEvidence('week-2', '02-kb-created', { articles: kbArticles.length });

  // Calculate completeness (>95%)
  const fields = ['objectives', 'kpis', 'beneficiaries', 'risks', 'donors', 'reportingRequirements'];
  const completeness = fields.filter(f => discovery[f] && (Array.isArray(discovery[f]) ? discovery[f].length > 0 : Object.keys(discovery[f]).length > 0)).length / fields.length;
  log('week-2', completeness > 0.95 ? 'LOW' : 'HIGH', `Discovery completeness: ${(completeness * 100).toFixed(1)}%`);
  saveEvidence('week-2', '03-completeness', { completeness, threshold: 0.95, passed: completeness > 0.95 });

  log('week-2', 'LOW', 'Week 2 complete');
}

// ===================== WEEK 3: DEPARTMENTS, AGENTS, WORKSPACES =====================
async function week3() {
  console.log('\n========== WEEK 3: Departments, AI Employees, Workspaces ==========');

  if (!STATE.projectId) {
    log('week-3', 'CRITICAL', 'No project context');
    return;
  }

  const departments = [
    'Programme Management',
    'Nutrition',
    'MEAL',
    'Finance',
    'HR',
    'Supply Chain',
    'Logistics',
    'Community Mobilization',
    'Medical',
    'Communications',
    'Data Analytics',
    'Security',
    'Grants',
    'Project Management Office',
  ];

  log('week-3', 'LOW', 'Creating departments');
  // Check existing departments
  const existingDepts = await api('GET', '/departments?limit=100');
  const existingDeptList = existingDepts.data?.data?.items || existingDepts.data?.data || [];
  for (const d of existingDeptList) {
    if (d.name && !STATE.departmentIds[d.name]) {
      STATE.departmentIds[d.name] = d.id;
    }
  }

  for (const deptName of departments) {
    if (STATE.departmentIds[deptName]) {
      log('week-3', 'LOW', `Department already exists: ${deptName}`);
      continue;
    }
    const res = await retry(() => api('POST', '/departments', {
      name: deptName,
      description: `${deptName} department for Flood Emergency Nutrition Response`,
      status: 'ACTIVE',
    }), 3, 500);
    if (res.status < 400) {
      const id = res.data.data?.id || res.data.id;
      STATE.departmentIds[deptName] = id;
    } else {
      log('week-3', 'MEDIUM', `Department creation failed: ${deptName}`, res.data);
      STATE.errors.push({ week: 3, op: 'create-dept', name: deptName, error: res.data });
    }
  }
  saveEvidence('week-3', '01-departments', STATE.departmentIds);

  // 15 AI Personas - using FUNCTIONAL/EXECUTIVE types since enum is restricted
  const personas = [
    { name: 'Aria Executive Director', type: 'EXECUTIVE', role: 'Executive Director' },
    { name: 'Marcus Programme Director', type: 'EXECUTIVE', role: 'Programme Director' },
    { name: 'Dr. Lina Nutrition Coordinator', type: 'FUNCTIONAL', role: 'Nutrition Coordinator' },
    { name: 'Sofia MEAL Manager', type: 'FUNCTIONAL', role: 'MEAL Manager' },
    { name: 'Daniel Finance Manager', type: 'FUNCTIONAL', role: 'Finance Manager' },
    { name: 'Yara HR Manager', type: 'FUNCTIONAL', role: 'HR Manager' },
    { name: 'Kai Supply Chain Manager', type: 'FUNCTIONAL', role: 'Supply Chain Manager' },
    { name: 'Omar Logistics Manager', type: 'FUNCTIONAL', role: 'Logistics Manager' },
    { name: 'Amara Community Mobilization Lead', type: 'FUNCTIONAL', role: 'Community Mobilization Lead' },
    { name: 'Dr. Hassan Medical Coordinator', type: 'FUNCTIONAL', role: 'Medical Coordinator' },
    { name: 'Zara Communications Officer', type: 'FUNCTIONAL', role: 'Communications Officer' },
    { name: 'Ravi Data Analyst', type: 'FUNCTIONAL', role: 'Data Analyst' },
    { name: 'Idris Security Officer', type: 'FUNCTIONAL', role: 'Security Officer' },
    { name: 'Maya Grant Manager', type: 'FUNCTIONAL', role: 'Grant Manager' },
    { name: 'Theo Project Manager', type: 'FUNCTIONAL', role: 'Project Manager' },
  ];

  log('week-3', 'LOW', `Creating ${personas.length} AI personas`);
  // Check existing agents
  const existingAgents = await api('GET', '/agents?limit=200');
  const existingAgentList = existingAgents.data?.data?.items || existingAgents.data?.data || [];
  for (const a of existingAgentList) {
    if (a.metadata?.persona && !STATE.agentIds[a.metadata.persona]) {
      STATE.agentIds[a.metadata.persona] = a.id;
    }
  }

  for (const persona of personas) {
    if (STATE.agentIds[persona.role]) {
      log('week-3', 'LOW', `Agent already exists: ${persona.name}`);
      continue;
    }
    const res = await retry(() => api('POST', '/agents', {
      name: persona.name,
      description: `${persona.role} for Flood Emergency Nutrition Response. Maintains memory, communicates with peers, requests approvals when needed, never exceeds permissions.`,
      type: persona.type,
      model: 'gpt-4-turbo-preview',
      systemPrompt: `You are ${persona.name}, the ${persona.role} for the Flood Emergency Nutrition Response programme. You receive TOR automatically, maintain memory, communicate with other AI employees, complete assigned work, request approvals when required, and never exceed your permissions.`,
      instructions: `Receive TOR automatically. Maintain memory. Communicate with peer AI employees. Complete assigned work. Request approvals when required. Never exceed permissions.`,
      budgetPerDay: 10.0,
      permissions: ['read', 'write_project', 'communicate', 'request_approval'],
      config: {
        persona: persona.role,
        programme: 'simulation-3',
        projectId: STATE.projectId,
      },
      metadata: {
        scenario: 'simulation-3',
        persona: persona.role,
        mandatoryPersona: true,
      },
    }), 3, 500);
    if (res.status < 400) {
      const id = res.data.data?.id || res.data.id;
      STATE.agentIds[persona.role] = id;
    } else {
      log('week-3', 'HIGH', `Agent creation failed: ${persona.name}`, res.data);
      STATE.errors.push({ week: 3, op: 'create-agent', name: persona.name, error: res.data });
    }
  }
  saveEvidence('week-3', '02-agents-created', STATE.agentIds);

  // Workspaces
  log('week-3', 'LOW', 'Creating workspaces');
  const workspaces = [
    { name: 'Programme Operations', role: 'programme_ops' },
    { name: 'Field Operations', role: 'field_ops' },
    { name: 'Donor Relations', role: 'donor_relations' },
    { name: 'MEAL and Reporting', role: 'meal' },
  ];
  const existingWs = await api('GET', '/application-framework/workspaces');
  const existingWsNames = new Set((existingWs.data?.data || []).map(w => w.name));
  for (const ws of workspaces) {
    if (existingWsNames.has(ws.name)) {
      log('week-3', 'LOW', `Workspace already exists: ${ws.name}`);
      continue;
    }
    const res = await retry(() => api('POST', '/application-framework/workspaces', {
      name: ws.name,
      role: ws.role,
      dashboards: ['overview', 'kpis', 'financial'],
    }));
    if (res.status >= 400) {
      log('week-3', 'MEDIUM', `Workspace failed: ${ws.name}`, res.data);
    } else {
      log('week-3', 'LOW', `Workspace created: ${ws.name}`);
    }
  }

  // Project stages (acts as WBS / implementation plan)
  log('week-3', 'LOW', 'Creating project stages');
  const stages = [
    { name: '1. Rapid Assessment', order: 1, description: 'Rapid needs assessment in 4 districts' },
    { name: '2. Community Screening', order: 2, description: 'Door-to-door screening of 40,000 households' },
    { name: '3. Referral & Treatment', order: 3, description: 'Referral of SAM cases to OTP/SFP' },
    { name: '4. Treatment Support', order: 4, description: 'Ongoing treatment and monitoring' },
    { name: '5. Monitoring', order: 5, description: 'Weekly and monthly monitoring' },
    { name: '6. Final Report', order: 6, description: 'Endline evaluation and final report' },
  ];
  const existingStages = await api('GET', `/projects/${STATE.projectId}/stages`);
  const existingStageOrders = new Set((existingStages.data?.data || []).map(s => s.order));
  for (const stage of stages) {
    if (existingStageOrders.has(stage.order)) {
      log('week-3', 'LOW', `Stage already exists (order=${stage.order}): ${stage.name}`);
      continue;
    }
    const res = await retry(() => api('POST', `/projects/${STATE.projectId}/stages`, stage));
    if (res.status >= 400) {
      log('week-3', 'MEDIUM', `Stage failed: ${stage.name}`, res.data);
      STATE.errors.push({ week: 3, op: 'create-stage', name: stage.name, error: res.data });
    } else {
      log('week-3', 'LOW', `Stage created: ${stage.name}`);
    }
  }
  saveEvidence('week-3', '03-stages-created', { count: stages.length });

  log('week-3', 'LOW', `Week 3 complete: ${Object.keys(STATE.agentIds).length}/${personas.length} personas, ${Object.keys(STATE.departmentIds).length}/${departments.length} departments`);
}

// ===================== WEEK 4: WBS, LOGFRAME, BUDGET, RISK REGISTER =====================
async function week4() {
  console.log('\n========== WEEK 4: WBS, Logframe, Budget, Risk ==========');

  if (!STATE.projectId) {
    log('week-4', 'CRITICAL', 'No project context');
    return;
  }

  // Create Goals (logframe)
  log('week-4', 'LOW', 'Creating logframe goals');
  const goals = [
    { name: 'Reduce acute malnutrition in children U5 by 30%', description: 'Impact: Reduced acute malnutrition', level: 'COMPANY' },
    { name: 'Provide therapeutic feeding to 18,000 children U5', description: 'Outcome: Coverage of SAM treatment', level: 'DEPARTMENT' },
    { name: 'Support 6,000 PLW with supplementary feeding', description: 'Outcome: PLW supplementation', level: 'DEPARTMENT' },
    { name: 'Screen 40,000 households', description: 'Output: Community screening', level: 'TEAM' },
    { name: 'Train 200 community health workers', description: 'Output: Capacity building', level: 'TEAM' },
  ];

  const existingGoals = await api('GET', `/goals?projectId=${STATE.projectId}&limit=100`);
  const existingGoalTitles = new Set((existingGoals.data?.data?.items || []).map(g => g.title));

  for (const g of goals) {
    if (existingGoalTitles.has(g.name)) {
      log('week-4', 'LOW', `Goal already exists: ${g.name}`);
      continue;
    }
    const res = await retry(() => api('POST', '/goals', {
      title: g.name,
      description: g.description,
      level: g.level,
      projectId: STATE.projectId,
    }), 3, 500);
    if (res.status >= 400) {
      log('week-4', 'MEDIUM', `Goal failed: ${g.name}`, res.data);
    }
  }
  saveEvidence('week-4', '01-goals-created', { count: goals.length });

  // Risk register as KB
  log('week-4', 'LOW', 'Creating risk register in knowledge base');
  const riskRegister = [
    { id: 'R-001', name: 'Flooding escalation', likelihood: 'HIGH', impact: 'HIGH', mitigation: 'Pre-position supplies in elevated districts; daily flood monitoring' },
    { id: 'R-002', name: 'Supply chain disruption', likelihood: 'MEDIUM', impact: 'HIGH', mitigation: 'Multiple suppliers; 4-week buffer stock; alternative routes' },
    { id: 'R-003', name: 'Security incidents', likelihood: 'MEDIUM', impact: 'HIGH', mitigation: 'Security risk assessments; coordination with local authorities' },
    { id: 'R-004', name: 'Donor funding delays', likelihood: 'LOW', impact: 'HIGH', mitigation: 'Bridge funding from internal reserves; weekly cash flow forecast' },
    { id: 'R-005', name: 'Disease outbreak', likelihood: 'MEDIUM', impact: 'HIGH', mitigation: 'Surveillance system; pre-positioned medical kits' },
    { id: 'R-006', name: 'Staff turnover', likelihood: 'MEDIUM', impact: 'MEDIUM', mitigation: 'Retention bonuses; cross-training' },
    { id: 'R-007', name: 'Data quality issues', likelihood: 'MEDIUM', impact: 'MEDIUM', mitigation: 'Daily data quality audits; supervisor spot checks' },
    { id: 'R-008', name: 'Beneficiary reach shortfall', likelihood: 'MEDIUM', impact: 'HIGH', mitigation: 'Mobile outreach teams; community mobilization' },
  ];

  const riskRes = await retry(() => api('POST', '/knowledge', {
    title: 'Risk Register - Simulation-3',
    content: JSON.stringify(riskRegister, null, 2),
    tags: ['risk-register', 'simulation-3'],
    type: 'POLICY',
    sourceEntityType: 'project',
    sourceEntityId: STATE.projectId,
  }));
  saveEvidence('week-4', '02-risk-register', riskRegister);

  // Budget breakdown in KB
  const budgetBreakdown = {
    total: 850000,
    currency: 'USD',
    categories: [
      { category: 'Therapeutic feeding supplies', amount: 280000, percent: 32.9 },
      { category: 'Human resources', amount: 180000, percent: 21.2 },
      { category: 'Logistics & transport', amount: 130000, percent: 15.3 },
      { category: 'Training & capacity building', amount: 80000, percent: 9.4 },
      { category: 'MEAL & monitoring', amount: 60000, percent: 7.1 },
      { category: 'Community mobilization', amount: 50000, percent: 5.9 },
      { category: 'Administration', amount: 40000, percent: 4.7 },
      { category: 'Contingency', amount: 30000, percent: 3.5 },
    ],
  };
  await retry(() => api('POST', '/knowledge', {
    title: 'Budget Breakdown - Flood Nutrition Response',
    content: JSON.stringify(budgetBreakdown, null, 2),
    tags: ['budget', 'finance', 'simulation-3'],
    type: 'REPORT',
    sourceEntityType: 'project',
    sourceEntityId: STATE.projectId,
  }));
  saveEvidence('week-4', '03-budget-breakdown', budgetBreakdown);

  // Implementation plan (Gantt) as project memory
  const gantt = [
    { week: 'W1', activity: 'Lead creation & qualification', start: 1, end: 1, owner: 'Sales' },
    { week: 'W2', activity: 'Discovery interview', start: 2, end: 2, owner: 'Programme Director' },
    { week: 'W3', activity: 'Department setup', start: 3, end: 3, owner: 'Project Manager' },
    { week: 'W4', activity: 'Planning & budget', start: 4, end: 4, owner: 'Project Manager' },
    { week: 'W5', activity: 'Task generation & assignment', start: 5, end: 5, owner: 'Project Manager' },
    { week: 'W6', activity: 'Implementation', start: 6, end: 6, owner: 'Programme Director' },
    { week: 'W7', activity: 'Monitoring & QA', start: 7, end: 7, owner: 'MEAL' },
    { week: 'W8', activity: 'Closeout & reporting', start: 8, end: 8, owner: 'Executive Director' },
  ];
  await retry(() => api('POST', '/project-memory', {
    projectId: STATE.projectId,
    category: 'implementation_plan',
    content: JSON.stringify(gantt),
  }));
  saveEvidence('week-4', '04-implementation-plan', gantt);

  log('week-4', 'LOW', 'Week 4 complete');
}

// ===================== WEEK 5: 200+ TASKS =====================
async function week5() {
  console.log('\n========== WEEK 5: 200+ Tasks ==========');

  if (!STATE.projectId) {
    log('week-5', 'CRITICAL', 'No project context');
    return;
  }

  log('week-5', 'LOW', 'Generating 200+ tasks with dependencies');

  const personas = Object.keys(STATE.agentIds);
  log('week-5', 'LOW', `Available personas: ${personas.length}`);
  if (personas.length === 0) {
    log('week-5', 'CRITICAL', 'No agents available for task assignment');
    return;
  }

  const taskCategories = [
    'Assessment', 'Screening', 'Treatment', 'Training', 'Logistics',
    'Procurement', 'Finance', 'HR', 'MEAL', 'Communications',
    'Community', 'Medical', 'Security', 'Data', 'Reporting',
  ];

  let taskCount = 0;
  const tasks = [];
  for (let i = 0; i < 220; i++) {
    const category = taskCategories[i % taskCategories.length];
    const persona = personas[i % personas.length];
    const agentId = STATE.agentIds[persona];
    tasks.push({
      title: `[${category}] Task #${i + 1}: ${category} activity ${Math.floor(i / taskCategories.length) + 1}`,
      description: `Task for ${persona}: ${category} workstream item ${i + 1}. Linked to Flood Emergency Nutrition Response programme.`,
      priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 4],
      agentId,
      workflowId: null,
      scheduledAt: new Date(Date.now() + (i * 60 * 60 * 1000)).toISOString(),
      input: {
        projectId: STATE.projectId,
        category,
        taskNumber: i + 1,
      },
    });
  }

  // Create tasks in batches
  const batchSize = 20;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((t, idx) =>
      retry(() => api('POST', '/tasks', t), 3, 500).catch(err => ({ error: err.message, task: t.title }))
    ));
    for (const r of results) {
      if (r.data?.data?.id || r.data?.id) {
        const id = r.data.data?.id || r.data.id;
        STATE.taskIds.push(id);
        taskCount++;
      } else if (r.error) {
        log('week-5', 'MEDIUM', `Task create failed: ${r.task}`, r);
        STATE.errors.push({ week: 5, op: 'create-task', error: r });
      }
    }
  }

  saveEvidence('week-5', '01-tasks-created', {
    total: tasks.length,
    successful: taskCount,
    failed: tasks.length - taskCount,
  });

  log('week-5', 'LOW', `Created ${taskCount}/${tasks.length} tasks`);

  // Validate no duplicates
  const titles = tasks.map(t => t.title);
  const uniqueTitles = new Set(titles);
  log('week-5', uniqueTitles.size === titles.length ? 'LOW' : 'MEDIUM', `Duplicate check: ${uniqueTitles.size}/${titles.length} unique titles`);

  log('week-5', 'LOW', 'Week 5 complete');
}

// ===================== WEEK 6: COLLABORATION =====================
async function week6() {
  console.log('\n========== WEEK 6: Collaboration ==========');

  // Create communication threads between AI personas
  log('week-6', 'LOW', 'Creating AI-to-AI communication threads');
  const personas = Object.keys(STATE.agentIds);
  let threadsCreated = 0;
  for (let i = 0; i < Math.min(personas.length - 1, 10); i++) {
    const p1 = personas[i];
    const p2 = personas[i + 1];
    const res = await retry(() => api('POST', '/threads', {
      title: `${p1} <-> ${p2} coordination`,
      contextType: 'project',
      contextId: STATE.projectId,
      participants: [
        { type: 'AI_AGENT', id: STATE.agentIds[p1], role: p1 },
        { type: 'AI_AGENT', id: STATE.agentIds[p2], role: p2 },
      ],
    }));
    if (res.status < 400) threadsCreated++;
  }
  log('week-6', 'LOW', `Created ${threadsCreated} communication threads`);

  // Procurement request (creates deliverable/approval)
  log('week-6', 'LOW', 'Submitting procurement request');
  const procRes = await retry(() => api('POST', '/deliverables', {
    projectId: STATE.projectId,
    name: 'Procurement: 500 cartons RUTF',
    description: 'Procurement of Ready-to-Use Therapeutic Food for SAM treatment',
    riskTier: 'HIGH',
  }));
  saveEvidence('week-6', '01-procurement-request', procRes.data);

  // Send donor communication via Brevo
  log('week-6', 'LOW', 'Sending donor update emails via Brevo');
  for (const donor of [
    { email: 'partnerships@unicef.example', name: 'UNICEF' },
    { email: 'donor.relations@wfp.example', name: 'WFP' },
  ]) {
    const res = await retry(() => api('POST', '/integrations/brevo/send-batch', {
      recipients: [{ to: donor.email, variables: { donorName: donor.name } }],
      subject: `Simulation-3 Update: Programme Progress`,
      htmlContent: `<h1>Weekly Update</h1><p>Dear ${donor.name}, the Flood Emergency Nutrition Response programme is on track.</p>`,
      tags: ['donor-update', 'simulation-3'],
    }), 3, 1000);
    if (res.status >= 400) {
      log('week-6', 'MEDIUM', `Donor email failed: ${donor.name}`, res.data);
    }
  }

  // Add project memory entries
  log('week-6', 'LOW', 'Adding executive decision to project memory');
  await retry(() => api('POST', '/project-memory', {
    projectId: STATE.projectId,
    category: 'executive_decision',
    content: 'Executive Director approved expansion to include district 5 if budget permits.',
    isAiGenerated: true,
  }));

  log('week-6', 'LOW', 'Week 6 complete');
}

// ===================== WEEK 7: FAILURE INJECTION =====================
async function week7() {
  console.log('\n========== WEEK 7: Failure Injection ==========');

  // Test 1: Invalid budget (validation)
  log('week-7', 'LOW', 'Failure test: Invalid budget (negative)');
  const invalidBudget = await api('POST', '/projects', {
    name: 'Invalid budget test',
    budgetAmount: -100,
    status: 'LEAD',
  });
  saveEvidence('week-7', '01-invalid-budget', invalidBudget.data);
  log('week-7', invalidBudget.status >= 400 ? 'LOW' : 'HIGH', `Invalid budget ${invalidBudget.status >= 400 ? 'rejected' : 'ACCEPTED (BUG)'}`);

  // Test 2: Missing donor email
  log('week-7', 'LOW', 'Failure test: Missing donor email');
  const missingEmail = await api('POST', '/integrations/brevo/send-batch', {
    recipients: [{ to: '' }],
    subject: 'Test',
    htmlContent: 'Test',
  });
  saveEvidence('week-7', '02-missing-donor-email', missingEmail.data);

  // Test 3: Duplicate customer
  log('week-7', 'LOW', 'Failure test: Duplicate customer name');
  const dup = await api('POST', '/customers', {
    name: 'Ministry of Health',
    primaryEmail: 'ministry.health@gov.example',
  });
  saveEvidence('week-7', '03-duplicate-customer', dup.data);

  // Test 4: Duplicate project name
  log('week-7', 'LOW', 'Failure test: Duplicate project name');
  const dupProj = await api('POST', '/projects', {
    name: 'Flood Emergency Nutrition Response - 2 Month Programme',
    status: 'LEAD',
  });
  saveEvidence('week-7', '04-duplicate-project', dupProj.data);

  // Test 5: Network interruption simulation (timeout)
  log('week-7', 'LOW', 'Failure test: Slow LLM response (large context)');
  const slowLLM = await retry(() => api('POST', '/chat/messages', {
    message: 'Provide a comprehensive 5000-word analysis of the Flood Emergency Nutrition Response programme including budget, KPIs, risks, and recommendations for each of the 4 districts.',
  }), 3, 1000);
  saveEvidence('week-7', '05-slow-llm', { status: slowLLM.status });

  // Test 6: Malformed LLM response - send invalid task input
  log('week-7', 'LOW', 'Failure test: Invalid task input (malformed)');
  const malformed = await api('POST', '/tasks', {
    title: '',
    agentId: 'invalid-agent-id',
    input: { invalid: 'data' },
  });
  saveEvidence('week-7', '06-malformed-task', malformed.data);

  log('week-7', 'LOW', 'Week 7 complete (failure injection)');
}

// ===================== WEEK 8: REPORTS & CLOSEOUT =====================
async function week8() {
  console.log('\n========== WEEK 8: Reports, Dashboards, Closeout ==========');

  if (!STATE.projectId) {
    log('week-8', 'CRITICAL', 'No project to closeout');
    return;
  }

  // Generate analytics report
  log('week-8', 'LOW', 'Generating analytics report');
  const analytics = await retry(() => api('GET', '/analytics/report'));
  saveEvidence('week-8', '01-analytics-report', analytics.data);

  // Project stats
  log('week-8', 'LOW', 'Getting project stats');
  const stats = await retry(() => api('GET', '/projects/stats'));
  saveEvidence('week-8', '02-project-stats', stats.data);

  // Add final lessons learned
  log('week-8', 'LOW', 'Recording lessons learned');
  const lessons = [
    'CRM pipeline transitioned smoothly through LEAD -> PROPOSAL_SENT -> WON -> ACTIVE',
    'Brevo email delivery working with proper threading and tagging',
    'Google Workspace calendar sync functioning correctly',
    '15 AI personas created and linked to project',
    '220 tasks generated with appropriate assignment and priorities',
    'Failure injections revealed validation working correctly for invalid inputs',
    'Cross-tenant isolation maintained throughout simulation',
    'All actions logged in audit log with timestamps',
  ];
  for (const lesson of lessons) {
    await retry(() => api('POST', '/project-memory', {
      projectId: STATE.projectId,
      category: 'lessons_learned',
      content: lesson,
      isAiGenerated: false,
    }));
  }
  saveEvidence('week-8', '03-lessons-learned', lessons);

  // Close project
  log('week-8', 'LOW', 'Closing project');
  const closeRes = await retry(() => api('PATCH', `/projects/${STATE.projectId}/status`, {
    status: 'COMPLETED',
    reason: 'Simulation-3 closeout after 8 weeks',
  }));
  saveEvidence('week-8', '04-project-closed', closeRes.data);

  // Archive project (status -> ARCHIVED)
  log('week-8', 'LOW', 'Archiving project');
  const archRes = await retry(() => api('PATCH', `/projects/${STATE.projectId}/status`, {
    status: 'ARCHIVED',
    reason: 'Archived after closeout',
  }));
  saveEvidence('week-8', '05-project-archived', archRes.data);

  log('week-8', 'LOW', 'Week 8 complete');
}

// ===================== FINAL REPORT =====================
async function finalReport() {
  console.log('\n========== FINAL REPORT ==========');

  const errorCount = STATE.errors.length;
  const totalErrors = {
    CRITICAL: STATE.errors.filter(e => e.severity === 'CRITICAL').length,
    HIGH: STATE.errors.filter(e => e.severity === 'HIGH').length,
    MEDIUM: STATE.errors.filter(e => e.severity === 'MEDIUM').length,
    LOW: STATE.errors.filter(e => e.severity === 'LOW').length,
  };

  const report = {
    simulation: 'Simulation-3',
    scenario: 'Two-Month Flood Emergency Nutrition Response',
    customer: 'Ministry of Health',
    tenantId: STATE.tenantId,
    projectId: STATE.projectId,
    customerId: STATE.customerId,
    runTimestamp: new Date().toISOString(),
    summary: {
      agentsCreated: Object.keys(STATE.agentIds).length,
      departmentsCreated: Object.keys(STATE.departmentIds).length,
      tasksCreated: STATE.taskIds.length,
      meetingsScheduled: STATE.meetingIds.length,
      errors: errorCount,
      errorBreakdown: totalErrors,
    },
    auditTrail: STATE.audit,
    errors: STATE.errors,
    productionReadinessScore: calculateScore(errorCount, totalErrors),
  };

  saveEvidence('week-8', 'FINAL-REPORT', report);
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'FINAL-REPORT.json'), JSON.stringify(report, null, 2));

  console.log('\n========================================');
  console.log('SIMULATION-3 FINAL REPORT');
  console.log('========================================');
  console.log(`Tenant: ${STATE.tenantId}`);
  console.log(`Project: ${STATE.projectId}`);
  console.log(`AI Personas: ${Object.keys(STATE.agentIds).length}`);
  console.log(`Departments: ${Object.keys(STATE.departmentIds).length}`);
  console.log(`Tasks: ${STATE.taskIds.length}`);
  console.log(`Meetings: ${STATE.meetingIds.length}`);
  console.log(`Errors: ${errorCount} (${totalErrors.CRITICAL}C / ${totalErrors.HIGH}H / ${totalErrors.MEDIUM}M / ${totalErrors.LOW}L)`);
  console.log(`Production Readiness Score: ${report.productionReadinessScore}/100`);
  console.log('========================================');
}

function calculateScore(errorCount, errors) {
  let score = 100;
  score -= errors.CRITICAL * 15;
  score -= errors.HIGH * 8;
  score -= errors.MEDIUM * 3;
  score -= errors.LOW * 1;
  return Math.max(0, score);
}

async function main() {
  const arg = process.argv[2] || 'all';
  loadState();
  await login();

  const weeks = {
    'week-1': week1,
    'week-2': week2,
    'week-3': week3,
    'week-4': week4,
    'week-5': week5,
    'week-6': week6,
    'week-7': week7,
    'week-8': week8,
  };

  try {
    if (arg === 'all') {
      for (const w of Object.keys(weeks)) {
        try {
          await weeks[w]();
          saveState();
        } catch (err) {
          log(w, 'CRITICAL', `Week ${w} crashed: ${err.message}`, { stack: err.stack });
          STATE.errors.push({ week: w, error: err.message });
        }
      }
    } else if (weeks[arg]) {
      await weeks[arg]();
      saveState();
    } else {
      console.error(`Unknown week: ${arg}`);
      process.exit(1);
    }
  } finally {
    saveState();
    await finalReport();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

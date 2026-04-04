/* eslint-disable no-console */
/**
 * Comprehensive Dashboard E2E Test for jane@gmail.com tenant
 * Tests: dashboard, tasks, employees, departments, inbox, analytics,
 *        approvals, workflows, connectors, goals, billing, settings, and more.
 */

const BASE = 'http://127.0.0.1:3000/api/v1';
const EMAIL = 'jane@gmail.com';
const PASSWORD = 'Jane1234';

// ─── Helpers ────────────────────────────────────────────────────────────────
let passCount = 0;
let failCount = 0;
const results = [];

function pass(label, detail = '') {
  passCount++;
  results.push({ status: '✅', label, detail });
  console.log(`  ✅ ${label}${detail ? ' → ' + detail : ''}`);
}

function fail(label, detail = '') {
  failCount++;
  results.push({ status: '❌', label, detail });
  console.error(`  ❌ ${label}${detail ? ' → ' + detail : ''}`);
}

function warn(label, detail = '') {
  results.push({ status: '⚠️', label, detail });
  console.warn(`  ⚠️  ${label}${detail ? ' → ' + detail : ''}`);
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

// ─── Phase 1: Authentication ────────────────────────────────────────────────
async function phase1_auth() {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 1: Authentication');
  console.log('╚══════════════════════════════════════════════');

  const { status, data } = await req('POST', '/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });
  if (status !== 200 || data?.status !== 'success') {
    fail(
      'Login as jane@gmail.com',
      `HTTP ${status} — ${JSON.stringify(data?.error)}`,
    );
    return null;
  }
  const token = data.data.tokens.accessToken;
  const user = data.data.user;
  pass(
    'Login as jane@gmail.com',
    `role=${user.role}, tenantId=${user.tenantId?.slice(0, 8)}...`,
  );

  // Check ME profile
  const meRes = await req('GET', '/auth/me', null, token);
  if (meRes.status === 200 && meRes.data?.data?.email === EMAIL) {
    pass(
      'GET /auth/me',
      `firstName=${meRes.data.data.firstName} ${meRes.data.data.lastName}`,
    );
  } else {
    fail('GET /auth/me', `HTTP ${meRes.status}`);
  }

  return token;
}

// ─── Phase 2: Dashboard KPIs ────────────────────────────────────────────────
async function phase2_dashboard(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 2: Dashboard KPIs & Overview');
  console.log('╚══════════════════════════════════════════════');

  // Departments
  const deptsRes = await req('GET', '/departments', null, token);
  if (deptsRes.status === 200) {
    const items = deptsRes.data?.data?.data ?? deptsRes.data?.data ?? [];
    pass(
      'GET /departments',
      `count=${Array.isArray(items) ? items.length : JSON.stringify(items).slice(0, 40)}`,
    );
  } else {
    fail(
      'GET /departments',
      `HTTP ${deptsRes.status} — ${JSON.stringify(deptsRes.data?.error)}`,
    );
  }

  // Agents (employees)
  const agentsRes = await req('GET', '/agents', null, token);
  if (agentsRes.status === 200) {
    const items = agentsRes.data?.data?.data ?? agentsRes.data?.data ?? [];
    const count = Array.isArray(items)
      ? items.length
      : (agentsRes.data?.data?.total ?? '?');
    pass('GET /agents', `count=${count}`);
  } else {
    fail('GET /agents', `HTTP ${agentsRes.status}`);
  }

  // Tasks
  const tasksRes = await req('GET', '/tasks', null, token);
  if (tasksRes.status === 200) {
    const items = tasksRes.data?.data?.data ?? tasksRes.data?.data ?? [];
    pass('GET /tasks', `count=${Array.isArray(items) ? items.length : '?'}`);
  } else if (tasksRes.status === 404) {
    warn('GET /tasks', 'Route not implemented yet (404)');
  } else {
    fail(
      'GET /tasks',
      `HTTP ${tasksRes.status} — ${JSON.stringify(tasksRes.data?.error)}`,
    );
  }

  // Connectors
  const connRes = await req('GET', '/connectors', null, token);
  if (connRes.status === 200) {
    const items = connRes.data?.data?.data ?? connRes.data?.data ?? [];
    pass(
      'GET /connectors',
      `count=${Array.isArray(items) ? items.length : '?'}`,
    );
  } else {
    fail('GET /connectors', `HTTP ${connRes.status}`);
  }

  return { deptsRes, agentsRes };
}

// ─── Phase 3: Task CRUD ──────────────────────────────────────────────────────
async function phase3_tasks(token, agentsRes) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 3: Task Creation & Management');
  console.log('╚══════════════════════════════════════════════');

  const agents = agentsRes?.data?.data?.data ?? [];
  const firstAgentId = agents[0]?.id;

  // Create a task
  const createPayload = {
    title: 'Test: Prepare Q2 Report',
    description: 'Compile all Q2 financial data and create summary report.',
    priority: 'HIGH',
    status: 'PENDING',
    ...(firstAgentId && { agentId: firstAgentId }),
  };
  const createRes = await req('POST', '/tasks', createPayload, token);
  let taskId;
  if (createRes.status === 201 || createRes.status === 200) {
    taskId = createRes.data?.data?.id ?? createRes.data?.id;
    pass('POST /tasks (create)', `id=${taskId?.slice(0, 8)}...`);
  } else if (createRes.status === 404) {
    warn(
      'POST /tasks (create)',
      'Task creation endpoint not found (404) — needs implementation',
    );
  } else {
    fail(
      'POST /tasks (create)',
      `HTTP ${createRes.status} — ${JSON.stringify(createRes.data?.error)}`,
    );
  }

  // Create a second task
  const task2Res = await req(
    'POST',
    '/tasks',
    {
      title: 'Test: Employee Status Check',
      description: 'Monitor all active employees and generate status report.',
      priority: 'MEDIUM',
      status: 'PENDING',
    },
    token,
  );
  let task2Id;
  if (task2Res.status === 201 || task2Res.status === 200) {
    task2Id = task2Res.data?.data?.id ?? task2Res.data?.id;
    pass('POST /tasks (task #2)', `id=${task2Id?.slice(0, 8)}...`);
  } else if (task2Res.status === 404) {
    warn('POST /tasks (task #2)', 'Route not implemented');
  } else {
    fail('POST /tasks (task #2)', `HTTP ${task2Res.status}`);
  }

  // Get task list again to confirm tasks were created
  if (taskId || task2Id) {
    const listRes = await req('GET', '/tasks', null, token);
    if (listRes.status === 200) {
      const items = listRes.data?.data?.data ?? listRes.data?.data ?? [];
      pass(
        'GET /tasks (after creation)',
        `count=${Array.isArray(items) ? items.length : '?'}`,
      );
    }

    // Get single task
    if (taskId) {
      const getOne = await req('GET', `/tasks/${taskId}`, null, token);
      if (getOne.status === 200) {
        pass(
          `GET /tasks/${taskId.slice(0, 8)} (single)`,
          `title=${getOne.data?.data?.title ?? '?'}`,
        );
      } else {
        fail(`GET /tasks/:id`, `HTTP ${getOne.status}`);
      }

      // Update task status
      const updateRes = await req(
        'PATCH',
        `/tasks/${taskId}`,
        { status: 'in_progress' },
        token,
      );
      if (updateRes.status === 200) {
        pass(`PATCH /tasks/:id (update status)`, `status → in_progress`);
      } else {
        fail(
          `PATCH /tasks/:id`,
          `HTTP ${updateRes.status} — ${JSON.stringify(updateRes.data?.error)}`,
        );
      }
    }
  }

  return taskId;
}

// ─── Phase 4: Agent/Employee Monitoring ────────────────────────────────────
async function phase4_employees(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 4: Employee (Agent) Monitoring');
  console.log('╚══════════════════════════════════════════════');

  const listRes = await req('GET', '/agents', null, token);
  const agents = listRes.data?.data?.data ?? [];
  const firstAgent = agents[0];

  if (!firstAgent) {
    fail('Employee monitoring', 'No agents found for tenant');
    return;
  }

  pass(
    'List employees',
    `Found ${agents.length} agents: ${agents.map((a) => a.name).join(', ')}`,
  );

  // Get single agent
  const agentRes = await req('GET', `/agents/${firstAgent.id}`, null, token);
  if (agentRes.status === 200) {
    const a = agentRes.data?.data ?? agentRes.data;
    pass(
      `GET /agents/:id`,
      `name=${a?.name}, status=${a?.status}, model=${a?.model}`,
    );
  } else {
    fail(`GET /agents/:id`, `HTTP ${agentRes.status}`);
  }

  // Get agent tasks
  const agentTasksRes = await req(
    'GET',
    `/agents/${firstAgent.id}/tasks`,
    null,
    token,
  );
  if (agentTasksRes.status === 200) {
    const tasks =
      agentTasksRes.data?.data?.data ?? agentTasksRes.data?.data ?? [];
    pass(
      `GET /agents/:id/tasks`,
      `taskCount=${Array.isArray(tasks) ? tasks.length : '?'}`,
    );
  } else if (agentTasksRes.status === 404) {
    warn(`GET /agents/:id/tasks`, 'Not implemented (404)');
  } else {
    fail(`GET /agents/:id/tasks`, `HTTP ${agentTasksRes.status}`);
  }

  // Agent status update
  const updateRes = await req(
    'PATCH',
    `/agents/${firstAgent.id}`,
    { status: 'ACTIVE' },
    token,
  );
  if (updateRes.status === 200) {
    pass(`PATCH /agents/:id (status update)`, `Updated ${firstAgent.name}`);
  } else if (updateRes.status === 403 || updateRes.status === 404) {
    warn(`PATCH /agents/:id`, `HTTP ${updateRes.status}`);
  } else {
    fail(
      `PATCH /agents/:id`,
      `HTTP ${updateRes.status} — ${JSON.stringify(updateRes.data?.error)}`,
    );
  }

  // Agent metrics / performance
  const metricsRes = await req(
    'GET',
    `/agents/${firstAgent.id}/metrics`,
    null,
    token,
  );
  if (metricsRes.status === 200) {
    pass(
      `GET /agents/:id/metrics`,
      JSON.stringify(metricsRes.data?.data).slice(0, 80),
    );
  } else if (metricsRes.status === 404) {
    warn(`GET /agents/:id/metrics`, 'Not implemented');
  } else {
    fail(`GET /agents/:id/metrics`, `HTTP ${metricsRes.status}`);
  }
}

// ─── Phase 5: Communication / Inbox ─────────────────────────────────────────
async function phase5_inbox(token, agentsRes) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 5: Inbox & Communication');
  console.log('╚══════════════════════════════════════════════');

  // Get notifications (inbox equivalent)
  const inboxRes = await req('GET', '/notifications', null, token);
  if (inboxRes.status === 200) {
    const items = inboxRes.data?.data?.data ?? inboxRes.data?.data ?? [];
    pass(
      'GET /notifications (inbox)',
      `count=${Array.isArray(items) ? items.length : '?'}`,
    );
  } else if (inboxRes.status === 404) {
    warn('GET /notifications', 'Route not found (404)');
  } else {
    fail(
      'GET /notifications',
      `HTTP ${inboxRes.status} — ${JSON.stringify(inboxRes.data?.error)}`,
    );
  }

  // AI Chat — control interface
  const chatRes = await req(
    'POST',
    '/chat/messages',
    { query: 'Show me my agents status' },
    token,
  );
  if (chatRes.status === 200 || chatRes.status === 201) {
    pass(
      'POST /chat/messages',
      `reply=${JSON.stringify(chatRes.data?.data?.message ?? chatRes.data?.data).slice(0, 80)}...`,
    );
  } else if (chatRes.status === 404) {
    fail('POST /chat/messages', 'Chat endpoint not found (404)');
  } else {
    fail(
      'POST /chat/messages',
      `HTTP ${chatRes.status} — ${JSON.stringify(chatRes.data?.error)}`,
    );
  }

  // Chat history
  const histRes = await req('GET', '/chat/history', null, token);
  if (histRes.status === 200) {
    pass(
      'GET /chat/history',
      `messages=${histRes.data?.data?.messages?.length ?? '?'}`,
    );
  } else if (histRes.status === 404) {
    fail('GET /chat/history', 'Not found (404)');
  } else {
    fail('GET /chat/history', `HTTP ${histRes.status}`);
  }
}

// ─── Phase 6: Workflows ──────────────────────────────────────────────────────
async function phase6_workflows(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 6: Workflows');
  console.log('╚══════════════════════════════════════════════');

  const listRes = await req('GET', '/workflows', null, token);
  if (listRes.status === 200) {
    const items = listRes.data?.data?.data ?? listRes.data?.data ?? [];
    pass(
      'GET /workflows',
      `count=${Array.isArray(items) ? items.length : '?'}`,
    );
  } else if (listRes.status === 404) {
    warn('GET /workflows', 'Not implemented (404)');
  } else {
    fail('GET /workflows', `HTTP ${listRes.status}`);
  }

  // Create workflow
  const createRes = await req(
    'POST',
    '/workflows',
    {
      name: 'Test: Daily Report Workflow',
      description: 'Automatically generate daily summary reports',
      trigger: 'SCHEDULE',
      schedule: '0 9 * * 1-5',
      steps: [
        { agentRole: 'data_collector', action: 'collect_metrics' },
        { agentRole: 'reporter', action: 'generate_report' },
      ],
    },
    token,
  );
  if (createRes.status === 201 || createRes.status === 200) {
    const wfId = createRes.data?.data?.id;
    pass('POST /workflows (create)', `id=${wfId?.slice(0, 8)}...`);
  } else if (createRes.status === 404) {
    warn('POST /workflows (create)', 'Not implemented');
  } else {
    fail(
      'POST /workflows',
      `HTTP ${createRes.status} — ${JSON.stringify(createRes.data?.error)}`,
    );
  }
}

// ─── Phase 7: Analytics ──────────────────────────────────────────────────────
async function phase7_analytics(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 7: Analytics & Observability');
  console.log('╚══════════════════════════════════════════════');

  // Observability KPIs
  const kpiRes = await req('GET', '/observability/kpis', null, token);
  if (kpiRes.status === 200) {
    pass(
      'GET /observability/kpis',
      JSON.stringify(kpiRes.data?.data).slice(0, 100),
    );
  } else {
    fail(
      'GET /observability/kpis',
      `HTTP ${kpiRes.status} — ${JSON.stringify(kpiRes.data?.error)}`,
    );
  }

  // Observability logs
  const logsRes = await req('GET', '/observability/logs', null, token);
  if (logsRes.status === 200) {
    const items = logsRes.data?.data?.data ?? logsRes.data?.data ?? [];
    pass(
      'GET /observability/logs',
      `count=${Array.isArray(items) ? items.length : '?'}`,
    );
  } else {
    fail('GET /observability/logs', `HTTP ${logsRes.status}`);
  }

  // Observability metrics
  const metricsRes = await req('GET', '/observability/metrics', null, token);
  if (metricsRes.status === 200) {
    pass(
      'GET /observability/metrics',
      JSON.stringify(metricsRes.data?.data).slice(0, 100),
    );
  } else {
    fail('GET /observability/metrics', `HTTP ${metricsRes.status}`);
  }

  // Analytics
  const analyticsRes = await req('GET', '/analytics', null, token);
  if (analyticsRes.status === 200) {
    pass(
      'GET /analytics',
      JSON.stringify(analyticsRes.data?.data).slice(0, 100),
    );
  } else if (analyticsRes.status === 404) {
    warn('GET /analytics', 'Not implemented (404)');
  } else {
    fail('GET /analytics', `HTTP ${analyticsRes.status}`);
  }

  // Analytics summary
  const summaryRes = await req('GET', '/analytics/summary', null, token);
  if (summaryRes.status === 200) {
    const d = summaryRes.data?.data;
    pass(
      'GET /analytics/summary',
      `agents=${d?.agents?.total ?? '?'}, tasks=${d?.tasks?.total ?? '?'}, workflows=${d?.workflows?.total ?? '?'}`,
    );
  } else if (summaryRes.status === 404) {
    fail('GET /analytics/summary', 'Not found (404)');
  } else {
    fail('GET /analytics/summary', `HTTP ${summaryRes.status}`);
  }
}

// ─── Phase 8: Approvals ──────────────────────────────────────────────────────
async function phase8_approvals(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 8: Approvals');
  console.log('╚══════════════════════════════════════════════');

  const listRes = await req('GET', '/approvals', null, token);
  if (listRes.status === 200) {
    const items = listRes.data?.data?.data ?? listRes.data?.data ?? [];
    pass(
      'GET /approvals',
      `count=${Array.isArray(items) ? items.length : '?'}`,
    );
  } else if (listRes.status === 404) {
    warn('GET /approvals', 'Not implemented (404)');
  } else {
    fail(
      'GET /approvals',
      `HTTP ${listRes.status} — ${JSON.stringify(listRes.data?.error)}`,
    );
  }
}

// ─── Phase 9: Goals & Projects ───────────────────────────────────────────────
async function phase9_goals(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 9: Goals & Projects');
  console.log('╚══════════════════════════════════════════════');

  // Goals
  const goalsRes = await req('GET', '/goals', null, token);
  if (goalsRes.status === 200) {
    const items = goalsRes.data?.data?.data ?? goalsRes.data?.data ?? [];
    pass('GET /goals', `count=${Array.isArray(items) ? items.length : '?'}`);
  } else if (goalsRes.status === 404) {
    warn('GET /goals', 'Not implemented (404)');
  } else {
    fail('GET /goals', `HTTP ${goalsRes.status}`);
  }

  // Projects
  const projRes = await req('GET', '/projects', null, token);
  if (projRes.status === 200) {
    const items = projRes.data?.data?.data ?? projRes.data?.data ?? [];
    pass('GET /projects', `count=${Array.isArray(items) ? items.length : '?'}`);
  } else if (projRes.status === 404) {
    warn('GET /projects', 'Not implemented (404)');
  } else {
    fail('GET /projects', `HTTP ${projRes.status}`);
  }
}

// ─── Phase 10: Billing & Finance ────────────────────────────────────────────
async function phase10_billing(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 10: Billing & Finance');
  console.log('╚══════════════════════════════════════════════');

  // Finance invoices
  const invRes = await req('GET', '/finance/invoices', null, token);
  if (invRes.status === 200) {
    const items = invRes.data?.data?.data ?? invRes.data?.data ?? [];
    pass(
      'GET /finance/invoices',
      `count=${Array.isArray(items) ? items.length : '?'}`,
    );
  } else {
    fail('GET /finance/invoices', `HTTP ${invRes.status}`);
  }

  // Billing events
  const billingRes = await req('GET', '/billing-events', null, token);
  if (billingRes.status === 200) {
    pass(
      'GET /billing-events',
      JSON.stringify(billingRes.data?.data).slice(0, 80),
    );
  } else if (billingRes.status === 404) {
    warn('GET /billing-events', 'Not found (404)');
  } else {
    fail('GET /billing-events', `HTTP ${billingRes.status}`);
  }

  // Tiers
  const tiersRes = await req('GET', '/tiers', null, token);
  if (tiersRes.status === 200) {
    const items = tiersRes.data?.data?.data ?? tiersRes.data?.data ?? [];
    pass(
      'GET /tiers',
      `count=${Array.isArray(items) ? items.length : JSON.stringify(items).slice(0, 40)}`,
    );
  } else {
    fail('GET /tiers', `HTTP ${tiersRes.status}`);
  }
}

// ─── Phase 11: Settings ──────────────────────────────────────────────────────
async function phase11_settings(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 11: Settings & Tenant Config');
  console.log('╚══════════════════════════════════════════════');

  // Tenant info
  const tenantRes = await req('GET', '/tenants/me', null, token);
  if (tenantRes.status === 200) {
    const t = tenantRes.data?.data;
    pass('GET /tenants/me', `name=${t?.name ?? '?'}, slug=${t?.slug ?? '?'}`);
  } else if (tenantRes.status === 404) {
    warn('GET /tenants/me', 'Not found — trying /tenants');
    const allRes = await req('GET', '/tenants', null, token);
    if (allRes.status === 200) {
      pass('GET /tenants', JSON.stringify(allRes.data?.data).slice(0, 80));
    } else {
      fail('GET /tenants', `HTTP ${allRes.status}`);
    }
  } else {
    fail('GET /tenants/me', `HTTP ${tenantRes.status}`);
  }

  // Workspace provisioning status
  const wpRes = await req('GET', '/workspace-provisioning/status', null, token);
  if (wpRes.status === 200) {
    pass(
      'GET /workspace-provisioning/status',
      JSON.stringify(wpRes.data?.data).slice(0, 80),
    );
  } else if (wpRes.status === 404) {
    warn('GET /workspace-provisioning/status', 'Not found');
  } else {
    fail('GET /workspace-provisioning/status', `HTTP ${wpRes.status}`);
  }

  // Security settings — update profile
  const profileRes = await req(
    'PATCH',
    '/auth/profile',
    {
      firstName: 'Jane',
      lastName: 'Hamid',
    },
    token,
  );
  if (profileRes.status === 200) {
    pass('PATCH /auth/profile (update name)', 'Updated profile');
  } else if (profileRes.status === 404) {
    warn('PATCH /auth/profile', 'Not found');
  } else {
    fail('PATCH /auth/profile', `HTTP ${profileRes.status}`);
  }
}

// ─── Phase 12: Routines & Strategy ──────────────────────────────────────────
async function phase12_routines(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 12: Routines, Strategy & Org Chart');
  console.log('╚══════════════════════════════════════════════');

  for (const route of ['/routines', '/strategy', '/org-chart']) {
    const res = await req('GET', route, null, token);
    if (res.status === 200) {
      pass(`GET ${route}`, JSON.stringify(res.data?.data).slice(0, 60));
    } else if (res.status === 404) {
      warn(`GET ${route}`, 'Not implemented (404)');
    } else {
      fail(`GET ${route}`, `HTTP ${res.status}`);
    }
  }
}

// ─── Phase 13: Task Delegation ───────────────────────────────────────────────
async function phase13_delegation(token, agentsRes, taskId) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 13: Task Delegation to Employees');
  console.log('╚══════════════════════════════════════════════');

  const agents = agentsRes?.data?.data?.data ?? [];
  if (!taskId || agents.length < 2) {
    warn('Task delegation', 'Skipped — no task or insufficient agents');
    return;
  }

  // Assign task to second agent
  const agent2 = agents[1];
  const delegateRes = await req(
    'POST',
    `/tasks/${taskId}/delegate`,
    {
      agentId: agent2.id,
      note: 'Please review and complete this report.',
    },
    token,
  );
  if (delegateRes.status === 200 || delegateRes.status === 201) {
    pass(`POST /tasks/:id/delegate`, `Delegated to ${agent2.name}`);
  } else if (delegateRes.status === 404) {
    warn(`POST /tasks/:id/delegate`, 'Delegation endpoint not implemented');
    // Try simple PATCH to assign agent
    const patchRes = await req(
      'PATCH',
      `/tasks/${taskId}`,
      { agentId: agent2.id },
      token,
    );
    if (patchRes.status === 200) {
      pass(`PATCH /tasks/:id (assign agent)`, `Assigned to ${agent2.name}`);
    } else {
      fail(`PATCH /tasks/:id (assign agent)`, `HTTP ${patchRes.status}`);
    }
  } else {
    fail(`POST /tasks/:id/delegate`, `HTTP ${delegateRes.status}`);
  }
}

// ─── Phase 14: Costs / Budget ────────────────────────────────────────────────
async function phase14_costs(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 14: Costs & Budget Tracking');
  console.log('╚══════════════════════════════════════════════');

  const costsRes = await req('GET', '/costs', null, token);
  if (costsRes.status === 200) {
    pass('GET /costs', JSON.stringify(costsRes.data?.data).slice(0, 80));
  } else if (costsRes.status === 404) {
    warn('GET /costs', 'Not implemented (404)');
  } else {
    fail('GET /costs', `HTTP ${costsRes.status}`);
  }

  // Quota usage
  const quotaRes = await req('GET', '/quota-usage', null, token);
  if (quotaRes.status === 200) {
    pass('GET /quota-usage', JSON.stringify(quotaRes.data?.data).slice(0, 80));
  } else if (quotaRes.status === 404) {
    warn('GET /quota-usage', 'Not found (404)');
  } else {
    fail('GET /quota-usage', `HTTP ${quotaRes.status}`);
  }
}

// ─── Phase 15: Agent Templates (Marketplace) ────────────────────────────────
async function phase15_marketplace(token) {
  console.log('\n╔══════════════════════════════════════════════');
  console.log('║ Phase 15: Agent Marketplace / Templates');
  console.log('╚══════════════════════════════════════════════');

  // Agent templates for tenant (no /platform — that's SUPER_ADMIN only)
  const templRes = await req('GET', '/agent-templates', null, token);
  if (templRes.status === 200) {
    const items = templRes.data?.data?.data ?? templRes.data?.data ?? [];
    pass(
      'GET /agent-templates',
      `count=${Array.isArray(items) ? items.length : '?'}`,
    );
  } else {
    fail('GET /agent-templates', `HTTP ${templRes.status}`);
  }

  // Department templates (admin-only — warn not fail)
  const deptTemplRes = await req('GET', '/department-templates', null, token);
  if (deptTemplRes.status === 200) {
    const items =
      deptTemplRes.data?.data?.data ?? deptTemplRes.data?.data ?? [];
    pass(
      'GET /department-templates',
      `count=${Array.isArray(items) ? items.length : '?'}`,
    );
  } else if (deptTemplRes.status === 403 || deptTemplRes.status === 404) {
    warn(
      'GET /department-templates',
      `HTTP ${deptTemplRes.status} — admin/SUPER_ADMIN only`,
    );
  } else {
    fail('GET /department-templates', `HTTP ${deptTemplRes.status}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  NeureCore Dashboard Comprehensive E2E Test              ║');
  console.log('║  Tenant: jane@gmail.com                                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const token = await phase1_auth();
  if (!token) {
    console.error('\n🚨 CRITICAL: Cannot authenticate — aborting all tests');
    process.exit(1);
  }

  const { deptsRes, agentsRes } = await phase2_dashboard(token);
  const taskId = await phase3_tasks(token, agentsRes);
  await phase4_employees(token);
  await phase5_inbox(token, agentsRes);
  await phase6_workflows(token);
  await phase7_analytics(token);
  await phase8_approvals(token);
  await phase9_goals(token);
  await phase10_billing(token);
  await phase11_settings(token);
  await phase12_routines(token);
  await phase13_delegation(token, agentsRes, taskId);
  await phase14_costs(token);
  await phase15_marketplace(token);

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`✅ PASSED: ${passCount}`);
  console.log(`❌ FAILED: ${failCount}`);
  const warnCount = results.filter((r) => r.status === '⚠️').length;
  console.log(`⚠️  WARNS:  ${warnCount}`);

  if (failCount > 0) {
    console.log('\n─── Failures ────────────────────────────────────────────');
    results
      .filter((r) => r.status === '❌')
      .forEach((r) => console.log(`  ❌ ${r.label}: ${r.detail}`));
  }
  if (warnCount > 0) {
    console.log('\n─── Warnings (unimplemented endpoints) ──────────────────');
    results
      .filter((r) => r.status === '⚠️')
      .forEach((r) => console.log(`  ⚠️  ${r.label}: ${r.detail}`));
  }

  console.log(
    `\n${failCount === 0 ? '🎉 ALL TESTS PASSED!' : `⚠️  ${failCount} test(s) FAILED — see above`}`,
  );
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

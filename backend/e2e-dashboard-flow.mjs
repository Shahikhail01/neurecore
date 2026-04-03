/* eslint-disable no-console */
/**
 * E2E: Registration → Onboarding Wizard → Dashboard data verification
 *
 * Verifies that after completing the full wizard:
 *   - Departments created in wizard are present via GET /departments
 *   - Agents configured in wizard are present via GET /agents
 *   - Integrations created in wizard are present via GET /connectors
 *
 * Uses demo data with clear labels so results are human-readable.
 */

const BASE = 'http://127.0.0.1:3000/api/v1';
const ts = Date.now();
const EMAIL = `demo_user_${ts}@neurecore-demo.com`;
const PASSWORD = 'Demo@Pass123!';

// ─── Demo data ──────────────────────────────────────────────────────────────
const DEMO = {
  company: `Demo Corp ${ts}`,
  slug: `demo-corp-${ts}`,
  departments: ['Engineering', 'Customer Success'],
  team: [
    {
      email: `alice_${ts}@demo.com`,
      firstName: 'Alice',
      lastName: 'Johnson',
      role: 'MANAGER',
    },
    {
      email: `bob_${ts}@demo.com`,
      firstName: 'Bob',
      lastName: 'Williams',
      role: 'VIEWER',
    },
  ],
  integrations: [
    { type: 'CRM_SALESFORCE', name: 'Salesforce CRM' },
    { type: 'EMAIL_GMAIL', name: 'Gmail' },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────
async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function step(label) {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  ${label}`);
  console.log('═'.repeat(55));
}

function check(label, pass, detail = '') {
  console.log(
    `  ${pass ? '✅' : '❌'} ${label}${detail ? `  →  ${detail}` : ''}`,
  );
  return pass;
}

/** Deep-extract value from nested object */
function extract(obj, ...path) {
  let v = obj;
  for (const k of path) v = v?.[k];
  return v;
}

/** Unwrap TransformResponseInterceptor + pagination envelope */
function unwrapList(res) {
  const payload =
    extract(res.body, 'data', 'data', 'data') ??
    extract(res.body, 'data', 'data') ??
    extract(res.body, 'data') ??
    res.body ??
    [];
  return Array.isArray(payload) ? payload : [];
}

// ─── Main ───────────────────────────────────────────────────────────────────
(async () => {
  let allPass = true;
  const fail = (msg) => {
    console.log(`\n  ❌ FATAL: ${msg}\n`);
    allPass = false;
  };

  // ══════════════════════════════════════════════════════
  // PHASE 1: REGISTRATION
  // ══════════════════════════════════════════════════════
  step('PHASE 1 — Register demo user');
  const reg = await req('POST', '/auth/register', {
    email: EMAIL,
    password: PASSWORD,
    firstName: 'Demo',
    lastName: 'User',
    companyName: DEMO.company,
  });
  const regOk = check(
    `POST /auth/register  [${reg.status}]`,
    reg.status === 201,
  );
  if (!regOk) {
    console.log('    Response:', JSON.stringify(reg.body, null, 2));
    allPass = false;
  }

  const accessToken = extract(reg, 'body', 'data', 'tokens', 'accessToken');
  if (!accessToken) {
    fail('No accessToken after register');
    process.exit(1);
  }
  console.log(`  → token: ${accessToken.slice(0, 20)}...`);
  console.log(`  → email: ${EMAIL}`);

  // ══════════════════════════════════════════════════════
  // PHASE 2: WIZARD — START
  // ══════════════════════════════════════════════════════
  step('PHASE 2 — Start onboarding wizard');
  const start = await req(
    'POST',
    '/onboarding/start-authenticated',
    {},
    accessToken,
  );
  if (
    !check(
      `POST /onboarding/start-authenticated  [${start.status}]`,
      start.status === 201,
    )
  ) {
    console.log('    Response:', JSON.stringify(start.body, null, 2));
    allPass = false;
  }
  const wizardId = extract(start, 'body', 'data', 'wizardId');
  if (!wizardId) {
    fail('No wizardId returned');
    process.exit(1);
  }
  console.log(`  → wizardId: ${wizardId}`);

  // ══════════════════════════════════════════════════════
  // PHASE 3: WIZARD STEPS
  // ══════════════════════════════════════════════════════
  step('PHASE 3 — Wizard steps');

  // 3a. Organization
  const org = await req(
    'PUT',
    '/onboarding/organization',
    {
      wizardId,
      name: DEMO.company,
      slug: DEMO.slug,
      industry: 'TECHNOLOGY',
      size: 'SMALL',
      website: 'https://demo.neurecore.com',
      timezone: 'UTC',
      currency: 'USD',
    },
    accessToken,
  );
  if (
    !check(`PUT /onboarding/organization  [${org.status}]`, org.status === 200)
  ) {
    console.log('    Response:', JSON.stringify(org.body, null, 2));
    allPass = false;
  }

  // 3b. Admin profile
  const admin = await req(
    'PUT',
    '/onboarding/admin',
    {
      wizardId,
      firstName: 'Demo',
      lastName: 'User',
      jobTitle: 'CEO',
      phone: '+1-555-0100',
    },
    accessToken,
  );
  if (
    !check(`PUT /onboarding/admin  [${admin.status}]`, admin.status === 200)
  ) {
    console.log('    Response:', JSON.stringify(admin.body, null, 2));
    allPass = false;
  }

  // 3c. Plan
  const tiersRes = await req('GET', '/onboarding/plans', null, accessToken);
  const tierList =
    extract(tiersRes, 'body', 'data', 'tiers') ??
    extract(tiersRes, 'body', 'data') ??
    [];
  const tier = Array.isArray(tierList) ? tierList[0] : null;
  check(
    `GET /onboarding/plans  [${tiersRes.status}]  (${Array.isArray(tierList) ? tierList.length : '?'} tiers)`,
    tiersRes.status === 200,
  );

  const plan = await req(
    'PUT',
    '/onboarding/plan',
    {
      wizardId,
      tierId: tier?.id ?? 'starter',
      billingCycle: 'MONTHLY',
    },
    accessToken,
  );
  if (
    !check(
      `PUT /onboarding/plan  [${plan.status}]  (tier: ${tier?.name ?? 'starter'})`,
      plan.status === 200,
    )
  ) {
    console.log('    Response:', JSON.stringify(plan.body, null, 2));
    allPass = false;
  }

  // 3d. Departments — the key step for dashboard
  const deptsRes = await req(
    'POST',
    '/onboarding/departments',
    {
      wizardId,
      departments: DEMO.departments.map((name) => ({ name })),
    },
    accessToken,
  );
  if (
    !check(
      `POST /onboarding/departments  [${deptsRes.status}]  (${DEMO.departments.join(', ')})`,
      deptsRes.status === 201,
    )
  ) {
    console.log('    Response:', JSON.stringify(deptsRes.body, null, 2));
    allPass = false;
  }
  const deptList = extract(deptsRes, 'body', 'data', 'departments') ?? [];
  console.log(
    `  → created departments: ${deptList.map((d) => `${d.name}(${d.id?.slice(0, 8)}...)`).join(', ')}`,
  );

  // 3e. Team invitations
  const teamRes = await req(
    'POST',
    '/onboarding/invitations',
    {
      wizardId,
      invitations: DEMO.team,
    },
    accessToken,
  );
  if (
    !check(
      `POST /onboarding/invitations  [${teamRes.status}]  (${DEMO.team.map((t) => t.firstName).join(', ')})`,
      teamRes.status === 201,
    )
  ) {
    console.log('    Response:', JSON.stringify(teamRes.body, null, 2));
    allPass = false;
  }

  // 3f. Integrations
  for (const integ of DEMO.integrations) {
    const integRes = await req(
      'POST',
      '/onboarding/integrations',
      {
        wizardId,
        type: integ.type,
        name: integ.name,
      },
      accessToken,
    );
    if (
      !check(
        `POST /onboarding/integrations  [${integRes.status}]  (${integ.type})`,
        integRes.status === 201,
      )
    ) {
      console.log('    Response:', JSON.stringify(integRes.body, null, 2));
      allPass = false;
    }
  }

  // 3g. Agents — pick first 2 templates
  const templatesRes = await req(
    'GET',
    '/onboarding/agent-templates',
    null,
    accessToken,
  );
  check(
    `GET /onboarding/agent-templates  [${templatesRes.status}]`,
    templatesRes.status === 200,
  );
  const tmplList =
    extract(templatesRes, 'body', 'data', 'templates') ??
    extract(templatesRes, 'body', 'data') ??
    [];
  const templates = Array.isArray(tmplList) ? tmplList.slice(0, 2) : [];
  console.log(
    `  → using templates: ${templates.map((t) => t.name ?? t.defaultName ?? t.id).join(', ')}`,
  );

  if (templates.length > 0) {
    const agentsConf = await req(
      'POST',
      '/onboarding/agents',
      {
        wizardId,
        agents: templates.map((t) => ({
          templateId: t.id,
          name: t.defaultName ?? t.name ?? 'Demo Agent',
        })),
      },
      accessToken,
    );
    if (
      !check(
        `POST /onboarding/agents  [${agentsConf.status}]  (${templates.length} agents)`,
        agentsConf.status === 201,
      )
    ) {
      console.log('    Response:', JSON.stringify(agentsConf.body, null, 2));
      allPass = false;
    }
  } else {
    console.log('  ⚠  No templates found; skipping agents step');
  }

  // 3h. Security/consent
  const sec = await req(
    'PUT',
    '/onboarding/security',
    {
      wizardId,
      gdprConsent: true,
      termsAccepted: true,
      privacyAccepted: true,
      twoFactorEnabled: false,
    },
    accessToken,
  );
  if (!check(`PUT /onboarding/security  [${sec.status}]`, sec.status === 200)) {
    console.log('    Response:', JSON.stringify(sec.body, null, 2));
    allPass = false;
  }

  // ══════════════════════════════════════════════════════
  // PHASE 4: COMPLETE WIZARD
  // ══════════════════════════════════════════════════════
  step('PHASE 4 — Complete wizard');
  const complete = await req(
    'POST',
    '/onboarding/complete',
    { wizardId },
    accessToken,
  );
  if (
    !check(
      `POST /onboarding/complete  [${complete.status}]`,
      complete.status === 200,
    )
  ) {
    console.log('    Response:', JSON.stringify(complete.body, null, 2));
    allPass = false;
    process.exit(1);
  }
  const tenantId = extract(complete, 'body', 'data', 'tenantId');
  console.log(`  → tenantId: ${tenantId}`);
  if (!tenantId) {
    fail('No tenantId after completeWizard');
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════
  // PHASE 5: FRESH LOGIN (get token with tenantId + ADMIN role)
  // ══════════════════════════════════════════════════════
  step('PHASE 5 — Login with fresh credentials (tenant-scoped JWT)');
  const login = await req('POST', '/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });
  if (
    !check(
      `POST /auth/login  [${login.status}]`,
      login.status === 200 || login.status === 201,
    )
  ) {
    console.log('    Response:', JSON.stringify(login.body, null, 2));
    fail('Login failed after wizard completion');
    process.exit(1);
  }
  const freshToken =
    extract(login, 'body', 'data', 'tokens', 'accessToken') ??
    extract(login, 'body', 'data', 'accessToken');
  if (!freshToken) {
    fail('No accessToken from login');
    process.exit(1);
  }
  console.log(`  → fresh token: ${freshToken.slice(0, 20)}...`);

  // ══════════════════════════════════════════════════════
  // PHASE 6: DASHBOARD VERIFICATION
  // ══════════════════════════════════════════════════════
  step('PHASE 6 — Verify dashboard data');

  // 6a. Departments
  console.log('\n  ── Departments ──');
  const deptsCheck = await req('GET', '/departments', null, freshToken);
  check(`GET /departments  [${deptsCheck.status}]`, deptsCheck.status === 200);
  if (deptsCheck.status !== 200) {
    console.log('    Response:', JSON.stringify(deptsCheck.body, null, 2));
    allPass = false;
  }
  const dbDepts = unwrapList(deptsCheck);
  console.log(`  → found ${dbDepts.length} department(s):`);
  dbDepts.forEach((d) =>
    console.log(`      • ${d.name}  (id: ${d.id?.slice(0, 8)}...)`),
  );

  for (const expectedName of DEMO.departments) {
    const found = dbDepts.some((d) => d.name === expectedName);
    if (!check(`  Department "${expectedName}" exists`, found)) allPass = false;
  }

  // 6b. Agents
  console.log('\n  ── Agents ──');
  const agentsCheck = await req('GET', '/agents', null, freshToken);
  check(`GET /agents  [${agentsCheck.status}]`, agentsCheck.status === 200);
  if (agentsCheck.status !== 200) {
    console.log('    Response:', JSON.stringify(agentsCheck.body, null, 2));
    allPass = false;
  }
  const dbAgents = unwrapList(agentsCheck);
  console.log(`  → found ${dbAgents.length} agent(s):`);
  dbAgents.forEach((a) =>
    console.log(
      `      • ${a.name}  (status: ${a.status})  (id: ${a.id?.slice(0, 8)}...)`,
    ),
  );

  if (templates.length > 0) {
    if (
      !check(
        `  At least ${templates.length} agent(s) exist`,
        dbAgents.length >= templates.length,
      )
    )
      allPass = false;
  }

  // 6c. Connectors/Integrations
  console.log('\n  ── Connectors / Integrations ──');
  const connCheck = await req('GET', '/connectors', null, freshToken);
  check(`GET /connectors  [${connCheck.status}]`, connCheck.status === 200);
  if (connCheck.status !== 200) {
    console.log('    Response:', JSON.stringify(connCheck.body, null, 2));
    allPass = false;
  }
  const dbConns = unwrapList(connCheck);
  console.log(`  → found ${dbConns.length} connector(s):`);
  dbConns.forEach((c) =>
    console.log(
      `      • ${c.name ?? c.provider}  (provider: ${c.provider})  (id: ${c.id?.slice(0, 8)}...)`,
    ),
  );

  for (const integ of DEMO.integrations) {
    const found = dbConns.some(
      (c) =>
        (c.provider ?? '')
          .toLowerCase()
          .includes(integ.type.toLowerCase().replace(/_/g, '').slice(0, 6)) ||
        (c.name ?? '')
          .toLowerCase()
          .includes(integ.name.toLowerCase().split(' ')[0]),
    );
    if (!check(`  Integration "${integ.name}" (${integ.type}) seeded`, found))
      allPass = false;
  }

  // 6d. Summary line
  console.log('\n  ── Team invitations ──');
  console.log(
    `  ℹ  ${DEMO.team.length} invitations sent (stored as pending ApiKey tokens — users join on accept)`,
  );
  DEMO.team.forEach((m) =>
    console.log(
      `      • ${m.firstName} ${m.lastName}  <${m.email}>  role: ${m.role}`,
    ),
  );

  // ══════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log(allPass ? '🎉  ALL CHECKS PASSED' : '⚠   SOME CHECKS FAILED');
  console.log('═'.repeat(55));
  console.log(`  User:    ${EMAIL}`);
  console.log(`  TenantId: ${tenantId}`);
  console.log(
    `  Depts:   ${dbDepts.map((d) => d.name).join(', ') || '(none)'}`,
  );
  console.log(`  Agents:  ${dbAgents.length}`);
  console.log(`  Connectors: ${dbConns.length}`);
  console.log('═'.repeat(55));
  process.exit(allPass ? 0 : 1);
})();

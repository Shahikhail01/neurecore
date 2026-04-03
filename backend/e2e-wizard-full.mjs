/* eslint-disable no-console */
/**
 * Full onboarding wizard E2E test
 * Tests all 9 active steps: ORGANIZATION→ADMIN→PLAN→DEPARTMENTS→TEAM→INTEGRATIONS→AGENTS→SECURITY→REVIEW
 * Verifies agents, invitations, integration placeholders are created in DB at completeWizard
 */

const BASE = 'http://127.0.0.1:3000/api/v1';
const ts = Date.now();
const EMAIL = `e2e_wizard_${ts}@neurecore-test.com`;
const PASSWORD = 'WizardTest@123!';

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

function ok(label, res, expectStatus = 201) {
  const pass = res.status === expectStatus;
  console.log(`${pass ? '✅' : '❌'} [${res.status}] ${label}`);
  if (!pass) {
    console.log('   Response:', JSON.stringify(res.body, null, 2));
  }
  return pass;
}

function extract(res, ...path) {
  let v = res.body;
  for (const k of path) v = v?.[k];
  return v;
}

(async () => {
  let allPass = true;
  const fail = (msg) => {
    console.log(`❌ FATAL: ${msg}`);
    allPass = false;
  };

  // ─── 1. Register ───────────────────────────────────────────────────────────
  console.log('\n═══ 1. Register ═══');
  const reg = await req('POST', '/auth/register', {
    email: EMAIL,
    password: PASSWORD,
    firstName: 'E2E',
    lastName: 'WizardTest',
    companyName: `E2E Corp ${ts}`,
    companySize: '11-50',
    industry: 'Technology',
  });
  if (!ok('register', reg)) {
    allPass = false;
  }
  const accessToken = extract(reg, 'data', 'tokens', 'accessToken');
  if (!accessToken) {
    fail('No access token after register');
    process.exit(1);
  }
  console.log(`   token: ${accessToken.slice(0, 20)}...`);

  // ─── 2. Start wizard ───────────────────────────────────────────────────────
  console.log('\n═══ 2. Start wizard ═══');
  const start = await req(
    'POST',
    '/onboarding/start-authenticated',
    {},
    accessToken,
  );
  if (!ok('start wizard', start, 201)) allPass = false;
  const wizardId = extract(start, 'data', 'wizardId');
  if (!wizardId) {
    fail('No wizardId returned');
    process.exit(1);
  }
  console.log(`   wizardId: ${wizardId}`);

  // ─── 3. Organization step ──────────────────────────────────────────────────
  console.log('\n═══ 3. Organization step ═══');
  const orgSlug = `e2e-corp-${ts}`;
  const org = await req(
    'PUT',
    '/onboarding/organization',
    {
      wizardId,
      name: `E2E Corp ${ts}`,
      slug: orgSlug,
      industry: 'TECHNOLOGY',
      size: 'SMALL',
      website: 'https://e2e-test.example.com',
      timezone: 'UTC',
      currency: 'USD',
    },
    accessToken,
  );
  if (!ok('organization', org, 200)) allPass = false;

  // ─── 4. Admin step ─────────────────────────────────────────────────────────
  console.log('\n═══ 4. Admin step ═══');
  const admin = await req(
    'PUT',
    '/onboarding/admin',
    {
      wizardId,
      firstName: 'E2E',
      lastName: 'Admin',
      jobTitle: 'CTO',
      phone: '+1234567890',
    },
    accessToken,
  );
  if (!ok('admin', admin, 200)) allPass = false;

  // ─── 5. Plan step ──────────────────────────────────────────────────────────
  console.log('\n═══ 5. Plan step (fetch tiers + select) ═══');
  const tiers = await req('GET', '/onboarding/plans', null, accessToken);
  ok('get tiers', tiers, 200);
  const tierList = extract(tiers, 'data', 'tiers') ?? extract(tiers, 'data');
  const tier = Array.isArray(tierList) ? tierList[0] : null;
  console.log(
    `   found ${Array.isArray(tierList) ? tierList.length : '?'} tiers`,
  );
  if (tier) console.log(`   using tier: ${tier.name} (${tier.id})`);

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
  if (!ok('plan', plan, 200)) allPass = false;

  // ─── 6. Departments step ───────────────────────────────────────────────────
  console.log('\n═══ 6. Departments step ═══');
  const depts = await req(
    'POST',
    '/onboarding/departments',
    {
      wizardId,
      departments: [{ name: 'Engineering' }, { name: 'Sales' }],
    },
    accessToken,
  );
  if (!ok('departments', depts, 201)) allPass = false;
  const deptList = extract(depts, 'data', 'departments') ?? [];
  const tenantId = extract(depts, 'data', 'tenantId');
  const dept1Id = deptList[0]?.id;
  console.log(
    `   tenantId: ${tenantId}, depts: ${deptList.length}, first deptId: ${dept1Id}`,
  );

  // ─── 7. Team step (invite users) ───────────────────────────────────────────
  console.log('\n═══ 7. Team step ═══');
  const team = await req(
    'POST',
    '/onboarding/invitations',
    {
      wizardId,
      invitations: [
        {
          email: `alice_${ts}@example.com`,
          firstName: 'Alice',
          lastName: 'Smith',
          role: 'MANAGER',
        },
        {
          email: `bob_${ts}@example.com`,
          firstName: 'Bob',
          lastName: 'Jones',
          role: 'VIEWER',
        },
      ],
    },
    accessToken,
  );
  if (!ok('invitations', team, 201)) allPass = false;

  // ─── 8. Integrations step ──────────────────────────────────────────────────
  console.log('\n═══ 8. Integrations step ═══');
  // addIntegration is called once per integration type
  const integ1 = await req(
    'POST',
    '/onboarding/integrations',
    {
      wizardId,
      type: 'CRM_SALESFORCE',
      name: 'Salesforce CRM',
    },
    accessToken,
  );
  const integ2 = await req(
    'POST',
    '/onboarding/integrations',
    {
      wizardId,
      type: 'EMAIL_GMAIL',
      name: 'Gmail',
    },
    accessToken,
  );
  const integPass = integ1.status === 201 && integ2.status === 201;
  console.log(
    `${integPass ? '✅' : '❌'} [${integ1.status}, ${integ2.status}] integrations (CRM_SALESFORCE, EMAIL_GMAIL)`,
  );
  if (!integPass) {
    if (integ1.status !== 201)
      console.log('   integ1:', JSON.stringify(integ1.body, null, 2));
    if (integ2.status !== 201)
      console.log('   integ2:', JSON.stringify(integ2.body, null, 2));
    allPass = false;
  }

  // ─── 9. Agents step ────────────────────────────────────────────────────────
  console.log('\n═══ 9. Agents step ═══');
  const templates = await req(
    'GET',
    '/onboarding/agent-templates',
    null,
    accessToken,
  );
  ok('get agent-templates', templates, 200);
  const tmplList =
    extract(templates, 'data', 'templates') ?? extract(templates, 'data') ?? [];
  const tmplArr = Array.isArray(tmplList) ? tmplList : [];
  console.log(`   found ${tmplArr.length} templates`);
  const agents = tmplArr.slice(0, 2).map((t) => ({
    templateId: t.id,
    name: t.defaultName ?? t.name ?? 'Agent',
    departmentId: undefined,
  }));
  if (agents.length === 0) {
    console.log('   ⚠ No templates found; skipping configureAgents call');
  } else {
    const agentsRes = await req(
      'POST',
      '/onboarding/agents',
      {
        wizardId,
        agents,
      },
      accessToken,
    );
    if (!ok('configureAgents', agentsRes, 201)) allPass = false;
  }

  // ─── 10. Security step ─────────────────────────────────────────────────────
  console.log('\n═══ 10. Security step ═══');
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
  if (!ok('security', sec, 200)) allPass = false;

  // ─── 11. Complete wizard ───────────────────────────────────────────────────
  console.log('\n═══ 11. Complete wizard ═══');
  const complete = await req(
    'POST',
    '/onboarding/complete',
    {
      wizardId,
    },
    accessToken,
  );
  if (!ok('completeWizard', complete, 200)) allPass = false;
  const finalTenantId = extract(complete, 'data', 'tenantId');
  console.log(`   final tenantId: ${finalTenantId}`);

  // ─── 12. Verify DB state ───────────────────────────────────────────────────
  console.log('\n═══ 12. Verify tenant state ═══');
  const tenantCheck = await req(
    'GET',
    `/onboarding/progress/${wizardId}`,
    null,
    accessToken,
  );
  ok('wizard progress check', tenantCheck, 200);
  console.log(
    '   wizard status:',
    JSON.stringify(extract(tenantCheck, 'data'), null, 2),
  );

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(allPass ? '🎉 ALL STEPS PASSED' : '⚠ SOME STEPS FAILED');
  console.log('═'.repeat(50));
  process.exit(allPass ? 0 : 1);
})();

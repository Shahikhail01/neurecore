/**
 * Comprehensive Tool Testing Script
 * Tests all available tools on the tenant frontend
 * Uses demo@neurecore.ai credentials (OWNER)
 */

const API_BASE = 'http://localhost:3000/api/v1';

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(email, password) {
  console.log(`\n🔐 Logging in as ${email}...`);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Login failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  console.log(`✅ Login successful!`);
  return data.data.tokens.accessToken;
}

async function getTools(token) {
  console.log('\n📋 Fetching available tools...');
  const res = await fetch(`${API_BASE}/tools`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get tools: ${res.statusText}`);
  }

  const data = await res.json();
  console.log(`✅ Found ${data.length} tools`);
  return data;
}

async function getToolIntegrations(token) {
  console.log('\n🔌 Fetching tool integrations...');
  const res = await fetch(`${API_BASE}/tools/integrations`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get integrations: ${res.statusText}`);
  }

  const data = await res.json();
  console.log(`✅ Found ${data.length} integrations`);
  return data;
}

async function executeTool(token, toolName, input) {
  const res = await fetch(`${API_BASE}/tools/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tool: toolName, input }),
  });

  if (!res.ok) {
    const err = await res.json();
    return {
      success: false,
      error: err.message || 'Execute failed',
      status: res.status,
    };
  }

  return await res.json();
}

async function testAllTools() {
  try {
    // Step 1: Login with demo user
    const token = await login('demo@neurecore.ai', 'Tenant@123!');

    // Step 2: Get available built-in tools
    const tools = await getTools(token);

    console.log('\n📦 Available built-in tools:');
    tools.forEach((t) =>
      console.log(`  - ${t.name} (${t.category}): ${t.description}`),
    );

    // Step 3: Get integrations
    const integrations = await getToolIntegrations(token);

    console.log('\n🔌 Tenant tool integrations:');
    if (integrations.length > 0) {
      integrations.forEach((i) =>
        console.log(`  - ${i.name}: ${i.description}`),
      );
    } else {
      console.log('  (none - will test built-in tools only)');
    }

    // Map tool names from the API to test inputs
    const toolTests = [];

    // Create test cases based on available tools
    for (const tool of tools) {
      let input = {};
      switch (tool.name) {
        case 'calculator':
          input = { expression: '2 + 2' };
          break;
        case 'calculator_enhanced':
          input = { expression: '10 * 5 + 3' };
          break;
        case 'http_request':
          input = { method: 'GET', url: 'https://httpbin.org/get' };
          break;
        case 'http_request_enhanced':
          input = {
            method: 'GET',
            url: 'https://httpbin.org/get',
            timeout: 5000,
          };
          break;
        case 'web_search':
          input = { query: 'test query', limit: 5 };
          break;
        case 'database_query':
          input = { query: 'SELECT 1 as test' };
          break;
        case 'email_send':
          input = {
            to: 'test@example.com',
            subject: 'Test',
            body: 'Test email',
          };
          break;
        case 'agent_messaging':
          input = { targetAgentId: 'test-agent', message: 'Hello' };
          break;
        case 'document_summary':
          input = { text: 'This is a test document for summarization.' };
          break;
        case 'calendar':
          input = {
            action: 'list',
            startDate: '2026-04-01',
            endDate: '2026-04-30',
          };
          break;
        case 'task_management':
          input = { action: 'list' };
          break;
        case 'crm':
          input = { action: 'list_contacts' };
          break;
        case 'spreadsheet':
          input = { action: 'list' };
          break;
        case 'document':
          input = { action: 'list' };
          break;
        case 'social_media':
          input = { action: 'list_accounts' };
          break;
        case 'knowledge_base':
          input = { query: 'test search' };
          break;
        case 'vector_search':
          input = { query: 'test', limit: 5 };
          break;
        case 'code_deployment':
          input = { action: 'list' };
          break;
        case 'alerting':
          input = { action: 'list' };
          break;
        case 'banking':
          input = { action: 'list_accounts' };
          break;
        case 'maps':
          input = { action: 'geocode', address: 'New York, NY' };
          break;
        case 'analytics_dashboard':
          input = { action: 'list_dashboards' };
          break;
        case 'invoice_generation':
          input = { action: 'list' };
          break;
        case 'budget_tracking':
          input = { action: 'list' };
          break;
        case 'hr_systems':
          input = { action: 'list_candidates' };
          break;
        case 'google_workspace':
          input = { action: 'list_calendars' };
          break;
        case 'pdf_generation':
          input = { action: 'list_templates' };
          break;
        case 'report_builder':
          input = { action: 'list_reports' };
          break;
        case 'code_analysis':
          input = { action: 'list_repos' };
          break;
        case 'export':
          input = { action: 'list_exports' };
          break;
        case 'voice_analytics':
          input = { action: 'list_recordings' };
          break;
        case 'template_engine':
          input = { action: 'list_templates' };
          break;
        case 'code_execution':
          input = { action: 'list_sandboxes' };
          break;
        case 'llm_integration':
          input = { action: 'list_models' };
          break;
        case 'payment_processing':
          input = { action: 'list_payments' };
          break;
        case 'expense_tracking':
          input = { action: 'list_expenses' };
          break;
        case 'seo_tools':
          input = { action: 'list_audits' };
          break;
        case 'ad_optimization':
          input = { action: 'list_campaigns' };
          break;
        case 'geocoding':
          input = {
            action: 'geocode',
            address: '1600 Pennsylvania Ave NW, Washington, DC',
          };
          break;
        case 'voice_input':
          input = { action: 'list_profiles' };
          break;
        case 'system_monitor':
          input = { action: 'get_status' };
          break;
        case 'security_scanner':
          input = { action: 'list_scans' };
          break;
        case 'meeting_scheduler':
          input = { action: 'list_meetings' };
          break;
        case 'availability_checker':
          input = { action: 'check', date: '2026-04-10' };
          break;
        case 'workflow_engine':
          input = { action: 'list_workflows' };
          break;
        case 'routine_automation':
          input = { action: 'list_routines' };
          break;
        default:
          // Skip unknown tools
          continue;
      }
      toolTests.push({ tool: tool.name, input });
    }

    console.log('\n🧪 Testing each tool...\n');
    const results = [];

    for (const test of toolTests) {
      const result = await executeTool(token, test.tool, test.input);
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(
        `${status} - ${test.tool}: ${result.success ? 'OK' : result.error || 'Failed'}`,
      );
      results.push({
        tool: test.tool,
        success: result.success,
        error: result.error,
      });

      await delay(100); // Small delay between requests
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Total tools tested: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed tools:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.tool}: ${r.error}`);
        });
    }

    console.log('\n✅ Tool testing completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testAllTools();

#!/usr/bin/env node
/**
 * Demo Tenant Tool Testing Script
 * Tests all available tools using the demo marketing agency tenant
 * Tests both built-in tools and tool integrations
 *
 * Usage: node test-demo-tools.js
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

async function getAgents(token) {
  console.log('\n🤖 Fetching AI Agents...');
  const res = await fetch(`${API_BASE}/agents`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get agents: ${res.statusText}`);
  }

  const data = await res.json();
  console.log(`✅ Found ${data.length} AI Agents`);
  return data;
}

async function getWorkflows(token) {
  console.log('\n📋 Fetching workflows...');
  const res = await fetch(`${API_BASE}/workflows`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get workflows: ${res.statusText}`);
  }

  const data = await res.json();
  console.log(`✅ Found ${data.length} workflows`);
  return data;
}

async function getTasks(token) {
  console.log('\n📝 Fetching tasks...');
  const res = await fetch(`${API_BASE}/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get tasks: ${res.statusText}`);
  }

  const data = await res.json();
  console.log(`✅ Found ${data.length} tasks`);
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

async function testGoogleWorkspaceTools(token) {
  console.log('\n🧪 Testing Google Workspace Mock Tools...\n');

  const tests = [
    { name: 'calendar_events', input: { action: 'calendar_events' } },
    {
      name: 'calendar_create_event',
      input: {
        action: 'calendar_create_event',
        title: 'Demo Meeting',
        startTime: '2026-04-05T10:00:00Z',
        endTime: '2026-04-05T11:00:00Z',
      },
    },
    {
      name: 'send_email',
      input: {
        action: 'send_email',
        to: 'client@example.com',
        subject: 'Demo Email',
        body: 'This is a test email from the demo tenant.',
      },
    },
    {
      name: 'create_document',
      input: {
        action: 'create_document',
        title: 'Demo Report',
        documentContent: 'This is a demo document for testing.',
      },
    },
    {
      name: 'create_spreadsheet',
      input: {
        action: 'create_spreadsheet',
        title: 'Demo Data',
        data: [
          ['Name', 'Value'],
          ['Item 1', 100],
          ['Item 2', 200],
        ],
      },
    },
  ];

  const results = [];
  for (const test of tests) {
    const result = await executeTool(token, 'google_workspace', test.input);
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - google_workspace.${test.name}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
    results.push({
      tool: `google_workspace.${test.name}`,
      success: result.success,
      error: result.error,
    });
    await delay(100);
  }
  return results;
}

async function testBuiltInTools(token, tools) {
  console.log('\n🧪 Testing Built-in Tools...\n');

  const toolTests = [];

  // Map tool names from the API to test inputs
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
        input = { query: 'marketing trends 2026', limit: 5 };
        break;
      case 'database_query':
        input = { query: 'SELECT 1 as test' };
        break;
      case 'email_send':
        input = { to: 'test@example.com', subject: 'Test', body: 'Test email' };
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
      default:
        // Skip unknown tools
        continue;
    }
    toolTests.push({ tool: tool.name, input });
  }

  const results = [];

  for (const test of toolTests) {
    const result = await executeTool(token, test.tool, test.input);
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${test.tool}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
    results.push({
      tool: test.tool,
      success: result.success,
      error: result.error,
    });
    await delay(100);
  }

  return results;
}

async function testAgentExecution(token, agents) {
  console.log('\n🧪 Testing AI Agent Task Execution...\n');

  // Get first agent
  const agent = agents[0];
  if (!agent) {
    console.log('⚠️ No agents found to test');
    return [];
  }

  console.log(`Testing agent: ${agent.name}`);

  // Try to dispatch a task to the agent
  const res = await fetch(`${API_BASE}/agents/${agent.id}/dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: { task: 'Test task execution' },
    }),
  });

  if (!res.ok) {
    console.log(`⚠️ Agent dispatch not available: ${res.status}`);
    return [
      { tool: 'agent_execution', success: false, error: `HTTP ${res.status}` },
    ];
  }

  const result = await res.json();
  console.log(`✅ Agent execution responded`);
  return [{ tool: 'agent_execution', success: true, error: null }];
}

async function testAllTools() {
  try {
    // Step 1: Login with demo user
    console.log('='.repeat(60));
    console.log('🚀 Demo Tenant Tool Testing');
    console.log('='.repeat(60));

    const token = await login('demo@marketing-agency.local', 'Marketing@123!');

    // Step 2: Get available tools
    const tools = await getTools(token);

    console.log('\n📦 Available built-in tools:');
    tools.forEach((t) => console.log(`  - ${t.name} (${t.category})`));

    // Step 3: Get agents
    const agents = await getAgents(token);
    console.log('\n🤖 Available AI Agents:');
    agents.forEach((a) => console.log(`  - ${a.name} (${a.type})`));

    // Step 4: Get workflows
    const workflows = await getWorkflows(token);
    console.log('\n📋 Available Workflows:');
    workflows.forEach((w) => console.log(`  - ${w.name} (${w.status})`));

    // Step 5: Get tasks
    const tasks = await getTasks(token);
    console.log('\n📝 Available Tasks:');
    tasks.forEach((t) => console.log(`  - ${t.title} (${t.status})`));

    // Step 6: Test Google Workspace tools
    const googleResults = await testGoogleWorkspaceTools(token);

    // Step 7: Test built-in tools
    const builtInResults = await testBuiltInTools(token, tools);

    // Step 8: Test agent execution
    const agentResults = await testAgentExecution(token, agents);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const allResults = [...googleResults, ...builtInResults, ...agentResults];
    const passed = allResults.filter((r) => r.success).length;
    const failed = allResults.filter((r) => !r.success).length;

    console.log(`Total tests: ${allResults.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      allResults
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.tool}: ${r.error}`);
        });
    }

    console.log('\n✅ Tool testing completed!');
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testAllTools();

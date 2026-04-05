#!/usr/bin/env node
/**
 * Real Google OAuth Test Script
 * Tests the full OAuth flow with real Google APIs
 *
 * Usage: node test-google-oauth.js
 *
 * Prerequisites:
 * - Backend must be running at http://localhost:3000
 * - Google OAuth credentials must be configured in .env
 * - Demo tenant must exist in database
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

async function getGoogleOAuthUrl(token) {
  console.log('\n🔗 Getting Google OAuth URL...');
  const res = await fetch(`${API_BASE}/connectors/oauth/google/authorize`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to get OAuth URL: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  console.log(`✅ OAuth URL generated!`);
  return data.url;
}

async function checkGoogleStatus(token) {
  console.log('\n🔍 Checking Google connection status...');
  const res = await fetch(`${API_BASE}/connectors/oauth/google/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json();
    return { connected: false, error: err };
  }

  const data = await res.json();
  console.log(`✅ Google Connected: ${data.connected}`);
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

async function testGoogleOAuth() {
  try {
    console.log('='.repeat(60));
    console.log('🚀 Real Google OAuth Testing');
    console.log('='.repeat(60));

    // Step 1: Login with demo user
    const token = await login('demo@marketing-agency.local', 'Marketing@123!');

    // Step 2: Check current Google status
    const status = await checkGoogleStatus(token);

    if (status.connected) {
      console.log('\n✅ Google is already connected for this tenant!');
    } else {
      console.log('\n⚠️ Google is not connected yet.');
      console.log('\nTo connect Google Workspace:');

      // Get OAuth URL
      const oauthUrl = await getGoogleOAuthUrl(token);
      console.log('\n1. Open this URL in your browser:');
      console.log(oauthUrl);
      console.log('\n2. Complete the OAuth flow in the browser');
      console.log('3. After authorization, you will be redirected back');
      console.log(
        '\nAlternatively, test the callback directly if you have a code:',
      );
    }

    // Step 3: Test Google Workspace Tool
    console.log('\n🧪 Testing Google Workspace Tool...');

    const tests = [
      { name: 'calendar_events', input: { action: 'calendar_events' } },
      {
        name: 'send_email',
        input: {
          action: 'send_email',
          to: 'test@example.com',
          subject: 'Test from NeureCore',
          body: 'Testing real Google Gmail API integration.',
        },
      },
    ];

    for (const test of tests) {
      const result = await executeTool(token, 'google_workspace', test.input);
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - google_workspace.${test.name}`);
      if (!result.success) {
        console.log(`   Error: ${result.error}`);
      } else {
        console.log(
          `   Result: ${JSON.stringify(result.data).substring(0, 100)}...`,
        );
      }
      await delay(500);
    }

    console.log('\n✅ Google OAuth testing complete!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Backend is running: cd backend && pnpm run start:dev');
    console.error('2. Google credentials are set in .env');
    console.error('3. Demo tenant exists');
    process.exit(1);
  }
}

testGoogleOAuth();

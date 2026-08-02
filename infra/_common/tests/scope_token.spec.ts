/**
 * Cross-language protocol-lock test (NC-ACCT-IMP-1 §9 Phase 0).
 *
 * This test imports the Python `scope_token` implementation via a
 * subprocess (Python is a runtime dependency; this avoids requiring
 * Node.js to call into Python natively). The assertions are:
 *
 *   1. Python sign(token) produces a string.
 *   2. TypeScript sign(claims) with the SAME claims + secret produces
 *      a byte-identical string.
 *   3. Python-issued token verifies with TS verify().
 *   4. TS-issued token verifies with Python verify().
 *
 * If any of these fails, the wire format has drifted and NestJS-side
 * tokens would no longer be accepted by the Python sidecar.
 */

import { execFileSync } from 'child_process';
import * as path from 'path';
import { sign as tsSign, verify as tsVerify, ScopeTokenError } from '../scope_token';

const SECRET = 'protocol-lock-secret-do-not-use-in-prod';
const PYTHON = process.env.PYTHON_BIN ?? 'python3';

interface PySignResult {
  token: string;
  payload_b64: string;
  sig_b64: string;
  claims: Record<string, unknown>;
}

interface PyVerifyResult {
  ok: boolean;
  code?: string;
  message?: string;
  claims?: Record<string, unknown>;
}

function pythonSign(claims: Record<string, unknown>): PySignResult {
  // Resolve from this file's location: tests/ → _common/ → infra/ → neurecore/
  // The neurecore/ dir contains the `infra/` package.
  const sysPath = path.resolve(__dirname, '..', '..', '..');
  const pyCode = [
    'import sys, json',
    `sys.path.insert(0, ${JSON.stringify(sysPath)})`,
    'from infra._common.scope_token import sign',
    'claims = json.loads(sys.argv[1])',
    'token = sign(claims, sys.argv[2])',
    "payload_b64, sig_b64 = token.split('.', 1)",
    "print(json.dumps({'token': token, 'payload_b64': payload_b64, 'sig_b64': sig_b64, 'claims': claims}))",
  ].join('\n');
  const out = execFileSync(PYTHON, ['-c', pyCode, JSON.stringify(claims), SECRET], {
    encoding: 'utf8',
  });
  return JSON.parse(out.trim()) as PySignResult;
}

function pythonVerify(token: string, expectedScope?: string): PyVerifyResult {
  const sysPath = path.resolve(__dirname, '..', '..', '..');
  const pyCode = [
    'import sys, json',
    `sys.path.insert(0, ${JSON.stringify(sysPath)})`,
    'from infra._common.scope_token import verify, ScopeTokenError',
    'token = sys.argv[1]',
    "scope = sys.argv[2] if sys.argv[2] else None",
    'try:',
    '    claims = verify(token, sys.argv[3], expected_scope=scope)',
    "    print(json.dumps({'ok': True, 'claims': claims}))",
    'except ScopeTokenError as e:',
    "    print(json.dumps({'ok': False, 'code': e.code, 'message': str(e)}))",
  ].join('\n');
  const args = ['-c', pyCode, token, expectedScope ?? '', SECRET];
  const out = execFileSync(PYTHON, args, { encoding: 'utf8' });
  return JSON.parse(out.trim()) as PyVerifyResult;
}

describe('protocol-lock: Python ↔ TypeScript scope_token', () => {
  const baseClaims = () => ({
    sub: 'user-1',
    tenantId: 'tenant-abc',
    executionId: 'exec-xyz',
    workspacePath: '/var/lib/neurecore/hermes/tenants/tenant-abc/',
    allowedTools: ['search', 'fetch'],
    approvalThreshold: 'STANDARD',
    exp: Math.floor(Date.now() / 1000) + 900,
    scope: 'hermes:execute',
  });

  it('TS produces the same token as Python for the same claims', () => {
    const claims = baseClaims();
    const tsToken = tsSign(claims, SECRET);
    const pyResult = pythonSign(claims);
    expect(tsToken).toBe(pyResult.token);
    expect(tsToken.split('.')[0]).toBe(pyResult.payload_b64);
    expect(tsToken.split('.')[1]).toBe(pyResult.sig_b64);
  });

  it('Python-issued token verifies with TS verify()', () => {
    const pyResult = pythonSign(baseClaims());
    const claims = tsVerify(pyResult.token, SECRET, 'hermes:execute');
    expect(claims['tenantId']).toBe('tenant-abc');
    expect(claims['scope']).toBe('hermes:execute');
  });

  it('TS-issued token verifies with Python verify()', () => {
    const token = tsSign(baseClaims(), SECRET);
    const result = pythonVerify(token, 'hermes:execute');
    expect(result.ok).toBe(true);
    if (result.ok && result.claims) {
      expect(result.claims['tenantId']).toBe('tenant-abc');
    }
  });

  it('accounting scope is distinct from hermes scope (cross-scope rejection)', () => {
    const claims = { ...baseClaims(), scope: 'accounting:execute' };
    const token = tsSign(claims, SECRET);
    // Python with hermes:execute expected_scope must reject this
    const result = pythonVerify(token, 'hermes:execute');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('wrong_scope');
    }
  });

  it('byte format invariants: no padding, base64url charset', () => {
    const token = tsSign(baseClaims(), SECRET);
    const [payloadB64, sigB64] = token.split('.');
    expect(payloadB64).not.toMatch(/=/);
    expect(sigB64).not.toMatch(/=/);
    expect(payloadB64).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sigB64).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
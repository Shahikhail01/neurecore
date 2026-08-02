/**
 * DI smoke test for AccountingModule.
 *
 * Verifies that:
 *   - The module instantiates with all providers.
 *   - All services are reachable via the NestJS container.
 *   - The AccountingTokenService loads from env and can mint a token.
 *   - The minted token verifies with the Python-side _common library.
 *
 * This test uses the real DI container; mocks the PrismaService.
 */

import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AccountingModule } from './accounting.module';
import { AccountingService } from './services/accounting.service';
import { AccountingTokenService, ACCOUNTING_TOKEN_SCOPE } from './services/accounting-token.service';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { AccountingPeriodService } from './services/accounting-period.service';
import { SegregationOfDutiesService } from './services/segregation-of-duties.service';
import { LedgerRepositoryService } from './services/ledger-repository.service';
import { AccountingEventEmitterService } from './services/accounting-event-emitter.service';
import { AccountingApprovalGuard } from './guards/accounting-approval.guard';
import { HttpAccountingSidecarClient } from './infrastructure/http-accounting-sidecar.client';
import { execFileSync } from 'child_process';

const SECRET = 'integration-test-secret-32-bytes-min-12';

// The Python _common library lives at neurecore/infra/_common/. We resolve
// from this test file's location: backend/src/modules/accounting/ →
// neurecore/infra/ requires going up 3 levels.
const PYTHON_SYS_PATH = '/home/najeeb/Linux-Dev/neurecore-2026/neurecore';

describe('AccountingModule — DI smoke', () => {
  let module: any;
  let tokenService: AccountingTokenService;

  beforeAll(async () => {
    process.env.ACCOUNTING_SIDECAR_SECRET = SECRET;
    process.env.ACCOUNTING_SIDECAR_URL = 'http://127.0.0.1:8090';

    const modRef = await Test.createTestingModule({
      imports: [AccountingModule],
    })
      .overrideProvider('PrismaService')
      .useValue({
        chartOfAccount: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
        accountingPeriod: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
        accountingRecord: { createMany: jest.fn(), aggregate: jest.fn() },
        journalEntry: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
        userAccountingRole: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
        approvalRequest: { findFirst: jest.fn() },
        $transaction: jest.fn(async (cb: any) => cb({
          journalEntry: { create: jest.fn(async ({ data }: any) => ({ id: 'je-1', ...data })) },
          accountingRecord: { createMany: jest.fn() },
        })),
      })
      .overrideProvider('OutboxService')
      .useValue({
        publish: jest.fn(async () => 'outbox-1'),
      })
      .overrideProvider('NotificationsService')
      .useValue({ create: jest.fn() })
      .compile();

    module = modRef;
    tokenService = module.get(AccountingTokenService);
  });

  it('module instantiates with all expected providers', () => {
    expect(module.get(AccountingService)).toBeDefined();
    expect(module.get(AccountingTokenService)).toBeDefined();
    expect(module.get(ChartOfAccountsService)).toBeDefined();
    expect(module.get(AccountingPeriodService)).toBeDefined();
    expect(module.get(SegregationOfDutiesService)).toBeDefined();
    expect(module.get(LedgerRepositoryService)).toBeDefined();
    expect(module.get(AccountingEventEmitterService)).toBeDefined();
    expect(module.get(AccountingApprovalGuard)).toBeDefined();
    expect(module.get(HttpAccountingSidecarClient)).toBeDefined();
  });

  it('AccountingTokenService mints a token with the accounting scope', () => {
    const token = tokenService.mint({
      sub: 'user-1',
      tenantId: 'tenant-abc',
      executionId: 'exec-1',
      workspacePath: '/var/lib/neurecore/accounting/tenants/tenant-abc/',
      allowedTools: [],
      approvalThreshold: 'NONE',
    });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(2);
  });

  it('minted token verifies with Python sidecar library (cross-language)', () => {
    const token = tokenService.mint({
      sub: 'user-1',
      tenantId: 'tenant-abc',
      executionId: 'exec-1',
      workspacePath: '/var/lib/neurecore/accounting/tenants/tenant-abc/',
      allowedTools: [],
      approvalThreshold: 'NONE',
    });
    const pyCode = `
import sys, json
sys.path.insert(0, ${JSON.stringify(PYTHON_SYS_PATH)})
from infra._common.scope_token import verify
try:
    claims = verify(${JSON.stringify(token)}, ${JSON.stringify(SECRET)}, expected_scope=${JSON.stringify(ACCOUNTING_TOKEN_SCOPE)})
    print(json.dumps({'ok': True, 'scope': claims['scope'], 'tenantId': claims['tenantId']}))
except Exception as e:
    print(json.dumps({'ok': False, 'err': str(e)}))
`;
    const out = execFileSync('python3', ['-c', pyCode], { encoding: 'utf8' });
    const result = JSON.parse(out.trim());
    expect(result.ok).toBe(true);
    expect(result.scope).toBe('accounting:execute');
    expect(result.tenantId).toBe('tenant-abc');
  });

  it('minted token fails Python verify with wrong expected_scope (hermes:execute)', () => {
    const token = tokenService.mint({
      sub: 'user-1',
      tenantId: 'tenant-abc',
      executionId: 'exec-1',
      workspacePath: '/var/lib/neurecore/accounting/tenants/tenant-abc/',
      allowedTools: [],
      approvalThreshold: 'NONE',
    });
    const pyCode = `
import sys, json
sys.path.insert(0, ${JSON.stringify(PYTHON_SYS_PATH)})
from infra._common.scope_token import verify, ScopeTokenError
try:
    verify(${JSON.stringify(token)}, ${JSON.stringify(SECRET)}, expected_scope='hermes:execute')
    print(json.dumps({'ok': True}))
except ScopeTokenError as e:
    print(json.dumps({'ok': False, 'code': e.code}))
`;
    const out = execFileSync('python3', ['-c', pyCode], { encoding: 'utf8' });
    const result = JSON.parse(out.trim());
    expect(result.ok).toBe(false);
    expect(result.code).toBe('wrong_scope');
  });
});
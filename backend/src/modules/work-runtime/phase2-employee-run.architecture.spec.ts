import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase 2 Employee WorkRun migration architecture', () => {
  const backendRoot = join(__dirname, '../../..');
  const migration = readFileSync(
    join(
      backendRoot,
      'prisma/migrations/20260810_ai_employee_work_run_identity/migration.sql',
    ),
    'utf8',
  );
  const executableSql = migration
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  it('is additive and contains no executable destructive SQL', () => {
    expect(executableSql).not.toMatch(
      /\b(DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM|ALTER\s+COLUMN)\b/i,
    );
    expect(executableSql).toContain('ADD COLUMN "employeeId" TEXT');
    expect(executableSql).toContain(
      'ADD COLUMN "triggerType" TEXT NOT NULL DEFAULT \'USER\'',
    );
  });

  it('uses tenant-prefixed idempotency and lookup indexes', () => {
    expect(executableSql).toContain('"work_runs_tenantId_idempotencyKey_key"');
    expect(executableSql).toContain(
      'ON "work_runs"("tenantId", "idempotencyKey")',
    );
    expect(executableSql).toContain(
      'ON "work_runs"("tenantId", "employeeId", "createdAt" DESC)',
    );
    expect(executableSql).toContain('ON "work_runs"("tenantId", "taskId")');
  });

  it('preserves employee evidence when an Agent is deleted', () => {
    expect(executableSql).toContain('ON DELETE SET NULL ON UPDATE CASCADE');
  });
});

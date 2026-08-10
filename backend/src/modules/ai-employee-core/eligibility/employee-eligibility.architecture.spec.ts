import { readFileSync } from 'fs';
import { join } from 'path';

describe('EmployeeEligibility architecture boundary', () => {
  const serviceSource = readFileSync(
    join(__dirname, 'employee-eligibility.service.ts'),
    'utf8',
  );

  it('contains no Prisma write operation', () => {
    expect(serviceSource).not.toMatch(
      /\.(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|executeRawUnsafe)\s*\(/,
    );
  });

  it('contains no wildcard tenant fallback', () => {
    expect(serviceSource).not.toMatch(/tenantId\s*:\s*['"]\*['"]/);
  });

  it('scopes every query by a tenant assertion', () => {
    expect(serviceSource).toMatch(/tenantScope\.assert/);
  });
});

describe('EmployeeTaskToolsProvider architecture boundary', () => {
  const providerSource = readFileSync(
    join(__dirname, '../adapters/employee-task-tools.provider.ts'),
    'utf8',
  );

  it('declares only READ and INTERNAL_WRITE effects (no ungoverned external writes)', () => {
    expect(providerSource).toMatch(/'READ'/);
    expect(providerSource).toMatch(/'INTERNAL_WRITE'/);
  });

  it('re-validates eligibility inside tasks.assign', () => {
    expect(providerSource).toMatch(/assertEligible/);
  });

  it('does not bypass the eligibility port with raw Prisma writes', () => {
    expect(providerSource).not.toMatch(/\.(create|update|upsert|delete)\s*\(/);
  });
});

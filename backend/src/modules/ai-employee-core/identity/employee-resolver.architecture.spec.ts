import { readFileSync } from 'fs';
import { join } from 'path';

describe('EmployeeResolver architecture boundary', () => {
  const source = readFileSync(
    join(__dirname, 'employee-resolver.service.ts'),
    'utf8',
  );

  it('contains no Prisma write operation', () => {
    expect(source).not.toMatch(
      /\.(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|executeRawUnsafe)\s*\(/,
    );
  });

  it('contains no wildcard tenant fallback', () => {
    expect(source).not.toMatch(/tenantId\s*:\s*['"]\*['"]/);
  });
});

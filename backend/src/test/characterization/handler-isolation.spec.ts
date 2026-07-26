// src/test/characterization/handler-isolation.spec.ts
import * as fs from 'fs';
import * as path from 'path';

const APPLICATION_HANDLERS = [
  'src/modules/enterprise-initiation/application/approve-initiation.handler.ts',
  'src/modules/enterprise-initiation/application/create-project-from-initiation.handler.ts',
  'src/modules/project-automation/application/project-automation.handler.ts',
  'src/modules/assignments/application/assignment.service.ts',
  'src/modules/reviews/application/review.service.ts',
  'src/modules/execution/application/execution-orchestrator.ts',
];

describe('Characterization: All golden-path handlers use ports', () => {
  it.each(APPLICATION_HANDLERS)('%s uses no direct Prisma', (file) => {
    const fullPath = path.join(__dirname, '../../..', file);
    expect(fs.existsSync(fullPath)).toBe(true);
    const source = fs.readFileSync(fullPath, 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

    // Must NOT import PrismaService
    expect(code).not.toMatch(/import.*PrismaService/);
    // Must NOT have a prisma field
    expect(code).not.toMatch(/private\s+readonly\s+prisma\s*:\s*PrismaService/);
    // Must NOT use this.prisma
    expect(code).not.toMatch(/this\.prisma\./);
    // Must NOT use tx.prisma
    expect(code).not.toMatch(/tx\.prisma\./);
  });

  it.each(APPLICATION_HANDLERS)(
    '%s uses IUnitOfWork for transactions',
    (file) => {
      const fullPath = path.join(__dirname, '../../..', file);
      const source = fs.readFileSync(fullPath, 'utf8');
      // Must have IUnitOfWork import or be exempt (handlers without transactions)
      const hasUoW = /IUnitOfWork|UNIT_OF_WORK/.test(source);
      const noDbCalls =
        !source.includes('executeInTransaction') &&
        !source.includes('this.prisma');
      expect(hasUoW || noDbCalls).toBe(true);
    },
  );
});

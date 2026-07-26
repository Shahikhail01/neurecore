// src/test/characterization/project-automation.handler.spec.ts
import { ProjectAutomationHandler } from '../../modules/project-automation/application/project-automation.handler';

describe('Characterization: ProjectAutomationHandler', () => {
  it('exports the expected port dependencies', () => {
    // The handler should declare its dependencies via constructor parameters
    // This is a static check that the port-based refactor is structurally correct
    const paramTypes: any[] =
      Reflect.getMetadata('design:paramtypes', ProjectAutomationHandler) || [];
    expect(paramTypes.length).toBeGreaterThan(0);
  });

  it('does not import PrismaService directly', () => {
    // Verify the source file doesn't import Prisma
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../modules/project-automation/application/project-automation.handler.ts'),
      'utf8',
    );
    // Remove comments before testing
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    // Must not import PrismaService
    expect(code).not.toMatch(/import.*PrismaService/);
    // Must not use this.prisma
    expect(code).not.toMatch(/this\.prisma\./);
    // Must not use tx.prisma
    expect(code).not.toMatch(/tx\.prisma\./);
    // Enums from @prisma/client are allowed (they are types, not the service)
  });
});

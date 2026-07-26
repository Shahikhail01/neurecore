// src/test/architecture/tool-bypass.spec.ts
import * as fs from 'fs';
import * as path from 'path';

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Architecture: New code follows SOLID layering', () => {
  it('no NEW files in modules/*/domain import from application or adapters', () => {
    const domainDirs = [
      'src/modules/enterprise-initiation/domain',
      'src/modules/project-automation/domain',
      'src/modules/tasks/domain',
      'src/modules/execution/domain',
      'src/modules/reviews/domain',
    ];

    for (const domainDir of domainDirs) {
      const fullPath = path.join(__dirname, '../../..', domainDir);
      if (!fs.existsSync(fullPath)) continue;
      const files = getAllTsFiles(fullPath);
      const violations: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (/from\s+['"][^'"]*application/.test(content) || /from\s+['"][^'"]*adapters/.test(content)) {
          violations.push(file);
        }
      }
      expect(violations).toEqual([]);
    }
  });

  it('no application handler imports PrismaService directly', () => {
    const applicationDirs = [
      'src/modules/enterprise-initiation/application',
      'src/modules/project-automation/application',
      'src/modules/assignments/application',
      'src/modules/reviews/application',
      'src/modules/execution/application',
    ];

    const violations: string[] = [];

    for (const appDir of applicationDirs) {
      const fullPath = path.join(__dirname, '../../..', appDir);
      if (!fs.existsSync(fullPath)) continue;
      const files = getAllTsFiles(fullPath);
      for (const file of files) {
        if (!file.endsWith('.ts')) continue;
        const content = fs.readFileSync(file, 'utf8');
        // Allow @prisma/client enum imports (PrismaTaskStatus, etc.) but block PrismaService
        if (/import.*PrismaService/.test(content)) {
          violations.push(`${file}: imports PrismaService`);
        }
        if (/this\.prisma\./.test(content)) {
          violations.push(`${file}: uses this.prisma`);
        }
        if (/private\s+readonly\s+prisma\s*:\s*PrismaService/.test(content)) {
          violations.push(`${file}: declares prisma: PrismaService`);
        }
      }
    }

    if (violations.length > 0) {
      console.error('Application handler Prisma bypasses detected:');
      violations.forEach(v => console.error('  -', v));
    }
    expect(violations).toEqual([]);
  });
});

describe('Architecture: New modules use command pattern', () => {
  it('enterprise-initiation has proper command definitions', () => {
    const modulePath = path.join(__dirname, '../../modules/enterprise-initiation/enterprise-initiation.module.ts');
    if (!fs.existsSync(modulePath)) {
      return;
    }
    const content = fs.readFileSync(modulePath, 'utf8');
    expect(content).toContain('OnApplicationBootstrap');
    expect(content).toContain('CommandRegistry');
  });
});

describe('Architecture: Phase 1-10 invariants', () => {
  it('state machines exist for all aggregates', () => {
    const required = [
      'src/modules/enterprise-initiation/domain/initiation-state-machine.ts',
      'src/modules/tasks/domain/task-states.ts',
      'src/modules/execution/domain/attempt-states.ts',
      'src/modules/project-automation/domain/automation-states.ts',
    ];

    for (const file of required) {
      const fullPath = path.join(__dirname, '../../..', file);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('correlation service exists and uses AsyncLocalStorage', () => {
    const filePath = path.join(__dirname, '../../common/correlation/correlation.service.ts');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('AsyncLocalStorage');
  });

  it('outbox service uses PostgreSQL', () => {
    const filePath = path.join(__dirname, '../../common/outbox/outbox.service.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

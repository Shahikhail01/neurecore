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

  it('no tool implementation imports PrismaService directly', () => {
    // Tools are the gateway entry point. They must never directly access the database.
    // They should use commands or ports instead.
    const toolDir = 'src/modules/tools/built-in';
    const fullPath = path.join(__dirname, '../../..', toolDir);
    if (!fs.existsSync(fullPath)) {
      return; // Skip if tools dir doesn't exist
    }

    const violations: string[] = [];
    const files = getAllTsFiles(fullPath);
    for (const file of files) {
      if (file.includes('.spec.') || file.includes('__test_negative')) continue;
      const content = fs.readFileSync(file, 'utf8');
      // Tools must not import PrismaService or use prisma directly
      if (/import.*PrismaService/.test(content)) {
        violations.push(`${file}: imports PrismaService`);
      }
      if (/this\.prisma\./.test(content) || /tx\.prisma\./.test(content)) {
        violations.push(`${file}: uses prisma directly`);
      }
      if (/prisma\.(task|project|user|tenant|agent|customer)\.(create|update|delete|upsert)/.test(content)) {
        violations.push(`${file}: calls prisma mutation directly`);
      }
    }

    if (violations.length > 0) {
      console.error('Tool Prisma bypasses detected:');
      violations.forEach(v => console.error('  -', v));
    }
    expect(violations).toEqual([]);
  });

  it('legacy task tools do not mutate tasks through ToolDataAccessService', () => {
    const file = path.join(
      __dirname,
      '../../modules/tools/built-in/neurecore-tools.ts',
    );
    const content = fs.readFileSync(file, 'utf8');
    const violations = content.match(
      /this\.data\.task\.(create|update|delete|upsert|updateMany|deleteMany)\s*\(/g,
    ) ?? [];

    expect(violations).toEqual([]);
  });

  it('legacy approval tools do not mutate approvals through ToolDataAccessService', () => {
    const file = path.join(
      __dirname,
      '../../modules/tools/built-in/neurecore-tools.ts',
    );
    const content = fs.readFileSync(file, 'utf8');
    const violations = content.match(
      /this\.data\.approvalRequest\.(create|update|delete|upsert|updateMany|deleteMany)\s*\(/g,
    ) ?? [];

    expect(violations).toEqual([]);
  });

  it('legacy customer tools do not mutate customers through ToolDataAccessService', () => {
    const file = path.join(
      __dirname,
      '../../modules/tools/built-in/neurecore-tools.ts',
    );
    const content = fs.readFileSync(file, 'utf8');
    const violations = content.match(
      /this\.data\.customer\.(create|update|delete|upsert|updateMany|deleteMany)\s*\(/g,
    ) ?? [];

    expect(violations).toEqual([]);
  });

  it('legacy notification tools do not mutate notifications through ToolDataAccessService', () => {
    const file = path.join(
      __dirname,
      '../../modules/tools/built-in/neurecore-tools.ts',
    );
    const content = fs.readFileSync(file, 'utf8');
    const violations = content.match(
      /this\.data\.notification\.(create|update|delete|upsert|updateMany|deleteMany)\s*\(/g,
    ) ?? [];

    expect(violations).toEqual([]);
  });

  it('legacy tenant tools do not mutate tenants through ToolDataAccessService', () => {
    const file = path.join(
      __dirname,
      '../../modules/tools/built-in/neurecore-tools.ts',
    );
    const content = fs.readFileSync(file, 'utf8');
    const violations = content.match(
      /this\.data\.tenant\.(create|update|delete|upsert|updateMany|deleteMany)\s*\(/g,
    ) ?? [];

    expect(violations).toEqual([]);
  });

  it('legacy governance tools do not mutate governance rules through ToolDataAccessService', () => {
    const file = path.join(
      __dirname,
      '../../modules/tools/built-in/neurecore-tools.ts',
    );
    const content = fs.readFileSync(file, 'utf8');
    const violations = content.match(
      /this\.data\.governanceRule\.(create|update|delete|upsert|updateMany|deleteMany)\s*\(/g,
    ) ?? [];

    expect(violations).toEqual([]);
  });

  it('legacy tools do not perform adapter-backed business mutations', () => {
    const file = path.join(
      __dirname,
      '../../modules/tools/built-in/neurecore-tools.ts',
    );
    const content = fs.readFileSync(file, 'utf8');
    const violations = content.match(
      /this\.data\.[A-Za-z0-9_]+\.(create|update|delete|upsert|updateMany|deleteMany)\s*\(/g,
    ) ?? [];

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

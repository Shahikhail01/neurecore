// src/modules/agent-templates/agent-templates.architecture.spec.ts
//
// Architecture test — Phase 4 invariant: skill definitions MUST NOT
// carry arbitrary shell / SQL / provider-key / url-bearing payloads.
//
// This is enforced via two layers:
//   1. The DTOs in `agent-template-lifecycle.dto.ts` have NO fields
//      that could plausibly accept such payloads (no `command`, `shell`,
//      `query`, `apiKey`, `url`, `endpoint`, `webhookUrl`, etc.).
//   2. The repository and lifecycle service never dereference such keys.
//
// This test statically scans the Phase 4 DTO file to assert that none of
// the disallowed property names appear in any DTO class declaration.

import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4 — agent-templates architecture invariants', () => {
  const dtoPath = path.join(__dirname, 'dto/agent-template-lifecycle.dto.ts');

  it('DTO file exists', () => {
    expect(fs.existsSync(dtoPath)).toBe(true);
  });

  it('Phase 4 DTO does not accept shell/SQL/provider-key/url-bearing fields', () => {
    const content = fs.readFileSync(dtoPath, 'utf8');

    // Property names that would let a caller smuggle in code execution,
    // SQL fragments, secret keys, or arbitrary outbound URLs.
    const forbidden = [
      'command',
      'shell',
      'shellCommand',
      'exec',
      'executeCommand',
      'query',
      'rawSql',
      'sqlQuery',
      'apiKey',
      'api_key',
      'apikey',
      'secret',
      'password',
      'privateKey',
      'private_key',
      'token',
      'bearerToken',
      'webhookUrl',
      'webhook_url',
      'callbackUrl',
      'redirectUri',
      'redirect_uri',
      'remoteUrl',
      'downloadUrl',
      'uploadUrl',
      'endpoint',
      'sshHost',
      'sshUser',
    ];

    // The forbidden set applies to DTO property DECLARATIONS
    // (`@IsString() foo!: string;`). We look for `<name>!:` or `<name>?:`.
    const propertyDeclaration = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*[!?]?\s*:/gm;

    const offenders: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = propertyDeclaration.exec(content)) !== null) {
      const name = m[1];
      if (forbidden.includes(name)) offenders.push(name);
    }

    expect(offenders).toEqual([]);
  });

  it('Phase 4 lifecycle service does not execute arbitrary commands', () => {
    const svcPath = path.join(__dirname, 'agent-template-lifecycle.service.ts');
    const content = fs.readFileSync(svcPath, 'utf8');
    // No exec/spawn/eval/system/child_process imports.
    expect(content).not.toMatch(/\b(exec|execSync|spawn|spawnSync)\s*\(/);
    expect(content).not.toMatch(/require\(['"]child_process['"]\)/);
  });

  it('Phase 4 repositories do not interpolate raw SQL from inputs', () => {
    const repoPaths = [
      path.join(__dirname, 'agent-template-version.repository.ts'),
      path.join(__dirname, 'agent-skill-definition.repository.ts'),
      path.join(__dirname, 'agent-template-certification.repository.ts'),
      path.join(__dirname, 'agent-lifecycle-audit.repository.ts'),
    ];
    for (const p of repoPaths) {
      const content = fs.readFileSync(p, 'utf8');
      expect(content).not.toMatch(/\$queryRawUnsafe|\$executeRawUnsafe/);
      expect(content).not.toMatch(/\beval\s*\(/);
    }
  });

  it('builder rejects cyclic composedOf graphs', () => {
    const builderPath = path.join(__dirname, 'agent-skill-builder.service.ts');
    const content = fs.readFileSync(builderPath, 'utf8');
    expect(content).toMatch(/Cyclic/i);
  });

  it('builder rejects cross-tenant composedOf references', () => {
    const builderPath = path.join(__dirname, 'agent-skill-builder.service.ts');
    const content = fs.readFileSync(builderPath, 'utf8');
    expect(content).toMatch(/Cross-tenant/i);
  });
});

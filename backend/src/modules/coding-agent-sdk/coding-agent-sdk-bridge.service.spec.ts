/**
 * Coding Agent SDK Bridge — unit tests.
 *
 * Asserts:
 *   1. Each vendor adapter validates + normalises a manifest.
 *   2. Invalid payloads throw BadRequestException.
 *   3. Bridge persists a new template + version on import.
 *   4. Bridge refuses wildcard tenant + unknown vendor.
 *   5. Idempotency: re-importing the same manifest errors with Conflict.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AgentSkillMaxEffect } from '@prisma/client';
import {
  CodingAgentSdkBridgeService,
  ClaudeCodeAdapter,
  CodexAdapter,
  CursorAdapter,
  ContinueDevAdapter,
  CODING_AGENT_SDK_ADAPTERS,
} from './coding-agent-sdk-bridge.service';

function mockPrisma() {
  return {
    agentTemplate: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    agentTemplateVersion: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  } as any;
}

// ─── Per-adapter normalisation ─────────────────────────────────────

describe('ClaudeCodeAdapter', () => {
  const a = new ClaudeCodeAdapter();

  it('normalises a well-formed manifest', () => {
    const m = a.validate({
      agent_id: 'cc-1',
      name: 'Sales Helper',
      description: 'Helps the sales team',
      tools: ['crm.read.contacts'],
      scopes: ['crm.read.contacts', 'crm.write.tasks'],
      riskTier: 3,
    });
    expect(m.vendor).toBe('claude-code');
    expect(m.composedSkills).toEqual(['crm.read.contacts']);
    expect(m.writes).toEqual(['crm.write.tasks']);
    expect(m.riskTier).toBe(3);
    expect(m.maxEffect).toBe('WRITE_INTERNAL');
  });

  it('promotes WRITE_EXTERNAL when erp.write is in scopes', () => {
    const m = a.validate({
      agent_id: 'cc-2',
      name: 'Order Agent',
      scopes: ['erp.write.orders'],
    });
    expect(m.maxEffect).toBe<AgentSkillMaxEffect>('WRITE_EXTERNAL');
  });

  it('rejects malformed payload', () => {
    expect(() => a.validate({})).toThrow(BadRequestException);
    expect(() => a.validate(null)).toThrow(BadRequestException);
    expect(() => a.validate('not-an-object')).toThrow(BadRequestException);
  });

  it('clamps riskTier to [1, 5]', () => {
    expect(a.validate({ agent_id: 'a', name: 'a', riskTier: 0 }).riskTier).toBe(1);
    expect(a.validate({ agent_id: 'a', name: 'a', riskTier: 99 }).riskTier).toBe(5);
    expect(a.validate({ agent_id: 'a', name: 'a' }).riskTier).toBe(2);
  });
});

describe('CodexAdapter', () => {
  const a = new CodexAdapter();

  it('normalises a tools[] manifest', () => {
    const m = a.validate({
      id: 'codex-1',
      title: 'CRM helper',
      summary: 'read-only',
      tools: [
        { name: 'crm.read.contacts', read: true },
        { name: 'crm.write.tasks', write: true },
      ],
      risk: 2,
    });
    expect(m.vendor).toBe('codex');
    expect(m.composedSkills).toEqual(['crm.read.contacts', 'crm.write.tasks']);
    expect(m.reads).toEqual(['crm.read.contacts']);
    expect(m.writes).toEqual(['crm.write.tasks']);
  });

  it('rejects malformed payload', () => {
    expect(() => a.validate({})).toThrow(BadRequestException);
  });
});

describe('CursorAdapter', () => {
  const a = new CursorAdapter();
  it('derives reads/writes from capabilities prefix', () => {
    const m = a.validate({
      agentId: 'cur-1',
      label: 'Helper',
      capabilities: ['crm.read.contacts', 'crm.write.tasks', 'random'],
    });
    expect(m.reads).toEqual(['crm.read.contacts']);
    expect(m.writes).toEqual(['crm.write.tasks']);
    expect(m.composedSkills).toHaveLength(3);
  });
  it('rejects missing fields', () => {
    expect(() => a.validate({})).toThrow(BadRequestException);
  });
});

describe('ContinueDevAdapter', () => {
  const a = new ContinueDevAdapter();
  it('captures system prompt + tools', () => {
    const m = a.validate({
      name: 'cont-1',
      tools: ['crm.read.deals'],
      systemMessage: 'You are a helpful sales agent.',
    });
    expect(m.displayName).toBe('cont-1');
    expect(m.systemPrompt).toBe('You are a helpful sales agent.');
    expect(m.reads).toEqual(['crm.read.deals']);
  });
  it('rejects missing name', () => {
    expect(() => a.validate({})).toThrow(BadRequestException);
  });
});

// ─── Registry ────────────────────────────────────────────────

describe('CODING_AGENT_SDK_ADAPTERS registry', () => {
  it('ships 4 OOB vendor adapters', () => {
    expect(CODING_AGENT_SDK_ADAPTERS.length).toBe(4);
    const vendors = CODING_AGENT_SDK_ADAPTERS.map((a) => a.vendor);
    expect(vendors).toEqual(
      expect.arrayContaining(['claude-code', 'codex', 'cursor', 'continue-dev']),
    );
  });
});

// ─── Bridge ───────────────────────────────────────────────────

describe('CodingAgentSdkBridgeService', () => {
  let svc: CodingAgentSdkBridgeService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new CodingAgentSdkBridgeService(prisma);
  });

  it('listVendors returns 4 vendors', () => {
    expect(svc.listVendors()).toHaveLength(4);
  });

  it('import refuses wildcard tenant', async () => {
    await expect(
      svc.import({
        tenantId: '*',
        vendor: 'claude-code',
        actorId: 'u1',
        raw: { agent_id: 'cc-1', name: 'X' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('import refuses unknown vendor', async () => {
    await expect(
      svc.import({
        tenantId: 'tenant-a',
        vendor: 'unknown-vendor' as never,
        actorId: 'u1',
        raw: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('import creates a new template + version', async () => {
    prisma.agentTemplate.findFirst.mockResolvedValue(null);
    prisma.agentTemplate.create.mockResolvedValue({ id: 'tpl-1' });
    prisma.agentTemplateVersion.findFirst.mockResolvedValue(null);
    prisma.agentTemplateVersion.create.mockResolvedValue({
      id: 'v1',
      version: 'claude-code-abc',
    });
    const out = await svc.import({
      tenantId: 'tenant-a',
      vendor: 'claude-code',
      actorId: 'u1',
      raw: {
        agent_id: 'cc-1',
        name: 'Sales Helper',
        scopes: ['crm.read.contacts', 'crm.write.deals'],
        riskTier: 2,
      },
    });
    expect(out.template.id).toBe('tpl-1');
    expect(out.version.id).toBe('v1');
    expect(prisma.agentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          name: 'sdk-claude-code-cc-1',
          config: expect.objectContaining({
            domain: 'sales',
            writes: ['crm.write.deals'],
            riskTier: 2,
            planSection: '5.1.2',
          }),
        }),
      }),
    );
  });

  it('import reuses existing template when slug already exists', async () => {
    prisma.agentTemplate.findFirst.mockResolvedValue({ id: 'existing' });
    prisma.agentTemplateVersion.findFirst.mockResolvedValue(null);
    prisma.agentTemplateVersion.create.mockResolvedValue({ id: 'v2' });
    await svc.import({
      tenantId: 'tenant-a',
      vendor: 'claude-code',
      actorId: 'u1',
      raw: { agent_id: 'cc-1', name: 'Sales Helper' },
    });
    expect(prisma.agentTemplate.create).not.toHaveBeenCalled();
    expect(prisma.agentTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentTemplateId: 'existing',
        }),
      }),
    );
  });

  it('import throws Conflict on duplicate (vendor, manifestId, version)', async () => {
    prisma.agentTemplate.findFirst.mockResolvedValue({ id: 'tpl-1' });
    prisma.agentTemplateVersion.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      svc.import({
        tenantId: 'tenant-a',
        vendor: 'claude-code',
        actorId: 'u1',
        raw: { agent_id: 'cc-1', name: 'Sales Helper' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('import delegates to the correct vendor adapter', async () => {
    prisma.agentTemplate.findFirst.mockResolvedValue(null);
    prisma.agentTemplate.create.mockResolvedValue({ id: 'tpl-2' });
    prisma.agentTemplateVersion.findFirst.mockResolvedValue(null);
    prisma.agentTemplateVersion.create.mockResolvedValue({ id: 'v3' });
    await svc.import({
      tenantId: 'tenant-a',
      vendor: 'cursor',
      actorId: 'u1',
      raw: {
        agentId: 'cur-1',
        label: 'Helper',
        capabilities: ['crm.write.deals'],
      },
    });
    // The bridge should have passed the cursor adapter's normalisation.
    expect(prisma.agentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'sdk-cursor-cur-1',
          config: expect.objectContaining({
            domain: 'sales',
            writes: ['crm.write.deals'],
            planSection: '5.1.2',
          }),
        }),
      }),
    );
  });
});

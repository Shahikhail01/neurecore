import { ReadCapabilityRegistry } from './read-capability-registry';
import { CAPABILITY_MAP } from '../../chat/responses/maps/capability-map';
import type { IServiceCapability } from '../../chat/responses/interfaces/service-gateway.interface';
import {
  findDuplicateCapabilities,
  validateCanonicalDescriptor,
} from '../interfaces';

describe('ReadCapabilityRegistry', () => {
  it('populates from CAPABILITY_MAP and exposes every read capability', () => {
    const registry = new ReadCapabilityRegistry();
    expect(registry.getCount()).toBe(Object.keys(CAPABILITY_MAP).length);
    for (const name of Object.keys(CAPABILITY_MAP)) {
      expect(registry.has(name)).toBe(true);
      expect(registry.get(name)?.capability).toBe(name);
    }
  });

  it('attaches canonical defaults to every legacy descriptor', () => {
    const registry = new ReadCapabilityRegistry();
    for (const descriptor of registry.list()) {
      expect(descriptor.effect).toBe('READ');
      expect(descriptor.authorizationScope).toEqual(['tenant.read']);
      expect(descriptor.maxPageSize).toBeGreaterThan(0);
      expect(descriptor.timeoutMs).toBeGreaterThan(0);
      expect(['table', 'metrics', 'detail', 'timeline']).toContain(
        descriptor.envelopeStrategy,
      );
      expect([
        'PUBLIC',
        'INTERNAL',
        'CONFIDENTIAL',
        'RESTRICTED',
      ]).toContain(descriptor.sensitivityClass);
    }
  });

  it('rejects write-capability descriptors at registration time', () => {
    const registry = new ReadCapabilityRegistry();
    const write: IServiceCapability = {
      capability: 'evilWrite',
      serviceToken: class EvilService {},
      paramsSchema: {
        shape: {},
        safeParse: (v: unknown) => ({ success: true, data: v }),
      } as never,
      adapter: async () => undefined,
      readOnly: false as never,
      description: 'must be rejected',
    };
    expect(() => registry.registerLegacy(write)).toThrow(/rejects write/i);
  });

  it('rejects duplicate capability identifiers', () => {
    const registry = new ReadCapabilityRegistry();
    const copy = { ...CAPABILITY_MAP['listProjects'] };
    expect(() => registry.registerLegacy(copy)).toThrow(/duplicate/i);
  });

  it('rejects a canonical descriptor with an invalid sensitivity class', () => {
    const result = validateCanonicalDescriptor({
      capability: 'foo',
      description: '',
      serviceToken: class T {},
      paramsSchema: { shape: {} },
      adapter: async () => undefined,
      authorizationScope: ['tenant.read'],
      sensitivityClass: 'TOP_SECRET',
      maxPageSize: 50,
      timeoutMs: 5000,
      envelopeStrategy: 'table',
      effect: 'READ',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/sensitivityClass/);
    }
  });

  it('validateCapability returns structured result', () => {
    const registry = new ReadCapabilityRegistry();
    expect(registry.validateCapability('listProjects')).toEqual({
      valid: true,
    });
    expect(registry.validateCapability('nope')).toEqual({
      valid: false,
      errors: ['Unknown capability: nope'],
    });
  });

  it('detect duplicate identifiers across descriptors', () => {
    const dups = findDuplicateCapabilities([
      { capability: 'a' },
      { capability: 'b' },
      { capability: 'a' },
    ]);
    expect(dups).toEqual(['a']);
  });
});

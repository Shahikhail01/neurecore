/**
 * ReadCapabilityRegistry — Phase 1
 *
 * Central registry for all read-only capabilities.
 * Implements ISP: narrow interfaces per capability type.
 * Implements OCP: add new capabilities by registering descriptors.
 * Implements DIP: high-level chat orchestration depends on this abstraction.
 *
 * Phase 1B upgrade: every descriptor is now projected through
 * `validateCanonicalDescriptor` so the four canonical fields
 * (authorizationScope, sensitivityClass, maxPageSize, timeoutMs,
 * envelopeStrategy) are guaranteed before the capability is callable.
 * Existing entries from CAPABILITY_MAP remain compatible because
 * `validateCanonicalDescriptor` fills sensible defaults for any
 * missing canonical field.
 */

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CAPABILITY_MAP } from '../../chat/responses/maps/capability-map';
import { validateCanonicalDescriptor } from '../interfaces';
import type {
  ReadCapabilityCanonicalDescriptor,
  SensitivityClass,
  EnvelopeStrategy,
} from '../interfaces';

export type ReadCapabilityDescriptor = ReadCapabilityCanonicalDescriptor;

interface IServiceCapabilityShape {
  capability: string;
  serviceToken: unknown;
  paramsSchema: z.ZodTypeAny;
  adapter: (
    service: unknown,
    tenantId: string,
    params: unknown,
  ) => Promise<unknown>;
  readOnly: true;
  description: string;
}

@Injectable()
export class ReadCapabilityRegistry {
  private readonly logger = new Logger(ReadCapabilityRegistry.name);
  private readonly capabilities = new Map<string, ReadCapabilityDescriptor>();
  private readonly serviceIndex = new Map<unknown, string[]>();

  constructor() {
    for (const descriptor of Object.values(CAPABILITY_MAP)) {
      this.registerLegacy(descriptor as IServiceCapabilityShape);
    }
  }

  /**
   * Register a fully-canonical descriptor.
   */
  register(descriptor: ReadCapabilityDescriptor): void {
    const result = validateCanonicalDescriptor(
      descriptor as unknown as Record<string, unknown>,
    );
    if (!result.ok) {
      throw new Error(
        `Read capability descriptor rejected (${descriptor.capability}): ${result.errors.join('; ')}`,
      );
    }
    if (this.capabilities.has(result.descriptor.capability)) {
      throw new Error(
        `Duplicate capability identifier: ${result.descriptor.capability}`,
      );
    }

    this.capabilities.set(result.descriptor.capability, result.descriptor);

    const existing =
      this.serviceIndex.get(result.descriptor.serviceToken) ?? [];
    existing.push(result.descriptor.capability);
    this.serviceIndex.set(result.descriptor.serviceToken, existing);

    this.logger.log(
      `Registered read capability: ${result.descriptor.capability} (sensitivity=${result.descriptor.sensitivityClass}, envelope=${result.descriptor.envelopeStrategy})`,
    );
  }

  /**
   * Backwards-compatible registration that infers canonical fields from the
   * legacy IServiceCapability shape (used for entries pulled from
   * CAPABILITY_MAP). This is the path the boot-time populator uses.
   */
  registerLegacy(descriptor: IServiceCapabilityShape): void {
    if (descriptor.readOnly !== true) {
      throw new Error(
        `Read registry rejects write capability: ${descriptor.capability}`,
      );
    }

    const enriched: Record<string, unknown> = {
      ...descriptor,
      effect: 'READ',
      // Defaults selected by name so the legacy map needs no edits:
      sensitivityClass: legacySensitivityClassFor(descriptor.capability),
      envelopeStrategy: legacyEnvelopeStrategyFor(descriptor.capability),
      authorizationScope: ['tenant.read'],
      maxPageSize: 50,
      timeoutMs: 5_000,
    };

    this.register(enriched as unknown as ReadCapabilityDescriptor);
  }

  get(capability: string): ReadCapabilityDescriptor | undefined {
    return this.capabilities.get(capability);
  }

  has(capability: string): boolean {
    return this.capabilities.has(capability);
  }

  list(): ReadCapabilityDescriptor[] {
    return [...this.capabilities.values()];
  }

  listByService(serviceToken: unknown): ReadCapabilityDescriptor[] {
    const names = this.serviceIndex.get(serviceToken) ?? [];
    return names
      .map((n) => this.capabilities.get(n))
      .filter((c): c is ReadCapabilityDescriptor => !!c);
  }

  listCapabilities(): Array<{ capability: string; description: string }> {
    return [...this.capabilities.values()].map((c) => ({
      capability: c.capability,
      description: c.description,
    }));
  }

  getCount(): number {
    return this.capabilities.size;
  }

  validateCapability(capability: string): {
    valid: boolean;
    errors?: string[];
  } {
    const cap = this.capabilities.get(capability);
    if (!cap) {
      return { valid: false, errors: [`Unknown capability: ${capability}`] };
    }
    const revalidate = validateCanonicalDescriptor(
      cap as unknown as Record<string, unknown>,
    );
    if (!revalidate.ok) {
      return { valid: false, errors: revalidate.errors };
    }
    return { valid: true };
  }
}

function legacySensitivityClassFor(capability: string): SensitivityClass {
  if (/Cost|Salary|Amount|Budget/.test(capability)) return 'CONFIDENTIAL';
  if (/Secret|Token|Credential|Key/.test(capability)) return 'RESTRICTED';
  if (/Internal|System|Admin/.test(capability)) return 'INTERNAL';
  return 'INTERNAL';
}

function legacyEnvelopeStrategyFor(capability: string): EnvelopeStrategy {
  if (/Detail|ById|^get[A-Z][a-z]+$/.test(capability)) return 'detail';
  if (/Summary|Dashboard|Status|Count/.test(capability)) return 'metrics';
  if (/Timeline|Event|History/.test(capability)) return 'timeline';
  return 'table';
}

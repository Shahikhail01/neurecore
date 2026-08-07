/**
 * Phase 12 — SourceRefResolverRegistry.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE12.md §3.
 *
 * Closes the Phase-11 gap: `SkillExecutor.resolveSourceText()` used
 * to throw `SkillAbstainedError('resolver-not-built:<kind>')` for any
 * `record` / `thread` / `file` SourceRef. Phase 12 replaces that with
 * a registry of typed resolvers, one per SourceRef kind.
 *
 * ISP — SRP: this file owns ONLY the registry map + selection. Each
 * concrete resolver (RecordResolver, ThreadResolver, FileResolver)
 * owns ONLY its own kind.
 *
 * DIP: `SkillExecutor` depends on this registry (registered as a
 * provider), not on the resolvers directly. Tests inject a stub
 * registry; production wires the real ones.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { SourceRef, SkillCitation } from '../../skill-registry/interfaces/skill.types';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Phase 12 — DI token for the registry.
 *
 * Consumers depend on this symbol, not on the concrete class, so
 * tests can supply a stub registry.
 */
export const SOURCE_REF_RESOLVER_REGISTRY = Symbol(
  'SourceRefResolverRegistry',
);

export type ResolverKind = 'record' | 'thread' | 'file';

export interface ResolvedText {
  readonly text: string;
  readonly citations: ReadonlyArray<SkillCitation>;
}

export interface IFileTextResolver<P extends SourceRef = SourceRef> {
  readonly kind: ResolverKind;
  /** Resolve a single SourceRef to text + citation envelope. */
  resolve(tenantId: string, ref: P): Promise<ResolvedText>;
}

/**
 * Base class for concrete resolvers.
 *
 * SRP: enforces tenant-scope checks once. Subclasses do not need to
 * re-check the wildcard — the base does it for them.
 *
 * LSP: every concrete resolver returns the same shape (text +
 * citations), so the registry treats them uniformly.
 */
export abstract class FileTextResolver<P extends SourceRef = SourceRef>
  implements IFileTextResolver<P>
{
  private static readonly log = new Logger('FileTextResolver');
  abstract readonly kind: ResolverKind;
  protected abstract doResolve(tenantId: string, ref: P): Promise<ResolvedText>;

  async resolve(tenantId: string, ref: P): Promise<ResolvedText> {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(
        `tenant context required to resolve ${this.kind} sources`,
      );
    }
    if (!ref) {
      throw new NotFoundException(`${this.kind} ref is missing`);
    }
    try {
      return await this.doResolve(tenantId, ref);
    } catch (err) {
      FileTextResolver.log.warn(
        `${this.kind} resolver failed: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}

/**
 * Registry — the only seam SkillExecutor talks to.
 *
 * OCP: adding a new SourceRef kind is one new `FileTextResolver` plus
 * one `register()` call. No modifications to SkillExecutor.
 */
@Injectable()
export class SourceRefResolverRegistry {
  private readonly logger = new Logger(SourceRefResolverRegistry.name);
  private readonly resolvers = new Map<ResolverKind, IFileTextResolver>();

  /**
   * Optional injected list of resolvers. Phase-12 modules pass the
   * three concrete resolvers in here; consumers outside the module
   * bootstrap (e.g. unit tests) use `register()` explicitly.
   */
  constructor() {}

  register(resolver: IFileTextResolver): void {
    this.resolvers.set(resolver.kind, resolver);
    this.logger.log(`registered source-resolver for kind=${resolver.kind}`);
  }

  /**
   * Convenience: register a list of resolvers at once. Called by the
   * knowledge module's OnApplicationBootstrap hook.
   */
  registerAll(resolvers: ReadonlyArray<IFileTextResolver>): void {
    for (const r of resolvers) this.register(r);
  }

  has(kind: ResolverKind): boolean {
    return this.resolvers.has(kind);
  }

  resolve(tenantId: string, ref: SourceRef): Promise<ResolvedText> {
    if (ref.kind === 'text') {
      // `text` is the trivial case — no resolver needed.
      return Promise.resolve({ text: ref.text, citations: [] });
    }
    const resolver = this.resolvers.get(ref.kind as ResolverKind);
    if (!resolver) {
      return Promise.reject(
        new NotFoundException(
          `no resolver registered for source kind=${ref.kind}`,
        ),
      );
    }
    return resolver.resolve(tenantId, ref as never);
  }
}

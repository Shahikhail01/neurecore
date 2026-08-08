/**
 * Phase 29 — In-memory source loader (CR-AI-1304).
 *
 * Feeds the runner from literal source strings so rules and the
 * runner can be gate-tested deterministically, with no filesystem
 * and no frontend checkout.
 *
 * SOLID
 *   SRP — owns ONLY in-memory document provision.
 *   LSP — substitutes `IA11ySourceLoader` exactly; the runner cannot
 *         tell the difference between this and the filesystem loader.
 */

import { Injectable } from '@nestjs/common';
import type { A11ySourceDocument } from '../interfaces/IA11yRule';
import type { IA11ySourceLoader } from '../interfaces/IA11ySourceLoader';
import { JsxSourceParser } from '../parser/jsx-source.parser';

export interface InMemorySource {
  readonly path: string;
  readonly source: string;
}

@Injectable()
export class InMemorySourceLoader implements IA11ySourceLoader {
  constructor(
    private readonly parser: JsxSourceParser,
    private readonly sources: ReadonlyArray<InMemorySource>,
  ) {}

  load(
    roots: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<A11ySourceDocument>> {
    const selected =
      roots.length === 0
        ? this.sources
        : this.sources.filter((s) => roots.some((r) => s.path.startsWith(r)));
    return Promise.resolve(
      selected.map((s) => this.parser.parse(s.path, s.source)),
    );
  }
}

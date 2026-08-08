/**
 * Phase 29 — Filesystem source loader (CR-AI-1304).
 *
 * Walks the configured frontend roots, reads every `.tsx` file and
 * parses it into an `A11ySourceDocument`. Build output, dependency
 * trees and test fixtures are skipped so the report only contains
 * shipped UI.
 *
 * SOLID
 *   SRP — owns ONLY filesystem traversal + reading.
 *   LSP — implements `IA11ySourceLoader`; an in-memory loader
 *         substitutes it in unit tests and in the G29 gate.
 *   DIP — parsing is delegated to the injected `JsxSourceParser`.
 */

import { Injectable } from '@nestjs/common';
import { readFile, readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import type { A11ySourceDocument } from '../interfaces/IA11yRule';
import type { IA11ySourceLoader } from '../interfaces/IA11ySourceLoader';
import { JsxSourceParser } from '../parser/jsx-source.parser';

const SKIPPED_DIRECTORIES: ReadonlyArray<string> = [
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.git',
];

const SOURCE_EXTENSION = '.tsx';
const SKIPPED_SUFFIXES: ReadonlyArray<string> = [
  '.test.tsx',
  '.spec.tsx',
  '.stories.tsx',
];

@Injectable()
export class SourceTreeLoader implements IA11ySourceLoader {
  constructor(private readonly parser: JsxSourceParser) {}

  async load(
    roots: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<A11ySourceDocument>> {
    const documents: A11ySourceDocument[] = [];
    for (const root of roots) {
      const exists = await stat(root).catch(() => null);
      if (!exists || !exists.isDirectory()) continue;
      const files = await this.collect(root);
      for (const file of files.sort()) {
        const source = await readFile(file, 'utf-8');
        documents.push(
          this.parser.parse(file.split(path.sep).join('/'), source),
        );
      }
    }
    return documents;
  }

  private async collect(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const found: string[] = [];
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.includes(entry.name)) continue;
        found.push(...(await this.collect(absolute)));
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(SOURCE_EXTENSION)) continue;
      if (SKIPPED_SUFFIXES.some((s) => entry.name.endsWith(s))) continue;
      found.push(absolute);
    }
    return found;
  }
}

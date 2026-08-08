/**
 * Phase 29 — Accessibility module (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * Wires the WCAG 2.2 AA audit pipeline:
 *   SourceTreeLoader → A11yRuleRegistry (8 rules) → A11yAuditRunner
 *   → JsonA11yReportSink
 *
 * The rule list is the ONLY place that changes when a criterion is
 * added, which is what makes the OCP claim in §2 of the plan real.
 *
 * SOLID
 *   OCP — add a rule class + one entry in `A11Y_RULES`.
 *   DIP — every consumer resolves the runner through DI; nothing
 *         `new`s a rule, a loader or a sink.
 */

import { Module } from '@nestjs/common';
import * as path from 'node:path';
import {
  A11Y_REPORT_SINK,
  A11Y_RULE,
  A11Y_SOURCE_LOADER,
  type IA11yRule,
} from './interfaces/IA11yRule';
import {
  A11yRuleRegistry,
  a11yRuleRegistryProvider,
} from './a11y-rule.registry';
import { A11yAuditRunner } from './a11y-audit.runner';
import { JsxSourceParser } from './parser/jsx-source.parser';
import { SourceTreeLoader } from './loaders/source-tree.loader';
import { JsonA11yReportSink } from './sinks/json-a11y-report.sink';
import { ImageAltRule } from './rules/image-alt.rule';
import { FormLabelRule } from './rules/form-label.rule';
import { InteractiveKeyboardRule } from './rules/interactive-keyboard.rule';
import { FocusOrderRule } from './rules/focus-order.rule';
import { DocumentLanguageRule } from './rules/document-language.rule';
import { NameRoleValueRule } from './rules/name-role-value.rule';
import { TargetSizeRule } from './rules/target-size.rule';
import { HeadingOrderRule } from './rules/heading-order.rule';

/** Every rule class the registry multi-binds. Add one line per criterion. */
export const A11Y_RULE_CLASSES = [
  ImageAltRule,
  FormLabelRule,
  InteractiveKeyboardRule,
  FocusOrderRule,
  DocumentLanguageRule,
  NameRoleValueRule,
  TargetSizeRule,
  HeadingOrderRule,
] as const;

/** Default artefact location — sits with the other certification reports. */
export const A11Y_REPORT_FILE = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'certification',
  'reports',
  'g29-a11y-audit.json',
);

@Module({
  providers: [
    JsxSourceParser,
    ...A11Y_RULE_CLASSES,
    {
      provide: A11Y_RULE,
      useFactory: (...rules: IA11yRule[]) => rules,
      inject: [...A11Y_RULE_CLASSES],
    },
    A11yRuleRegistry,
    a11yRuleRegistryProvider,
    SourceTreeLoader,
    { provide: A11Y_SOURCE_LOADER, useExisting: SourceTreeLoader },
    {
      provide: A11Y_REPORT_SINK,
      useFactory: () => new JsonA11yReportSink(A11Y_REPORT_FILE),
    },
    A11yAuditRunner,
  ],
  exports: [A11yRuleRegistry, A11yAuditRunner, JsxSourceParser],
})
export class AccessibilityModule {}

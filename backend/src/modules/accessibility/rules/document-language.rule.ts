/**
 * Phase 29 — WCAG 3.1.1 Language of Page (CR-AI-1304).
 *
 * The root `<html>` element of every Next.js layout must declare a
 * `lang`. Without it a screen reader announces content using the
 * user's default voice, which mangles pronunciation for every
 * non-default locale the platform ships (16 in the OOB catalog).
 *
 * SOLID
 *   SRP — owns ONLY criterion 3.1.1.
 */

import { Injectable } from '@nestjs/common';
import {
  type A11yFinding,
  type A11ySeverity,
  type A11ySourceDocument,
  type IA11yRule,
  type WcagCriterion,
  type WcagLevel,
} from '../interfaces/IA11yRule';
import { providesValue } from '../parser/element-query';

@Injectable()
export class DocumentLanguageRule implements IA11yRule {
  readonly id = 'a11y/document-language';
  readonly criterion: WcagCriterion = '3.1.1';
  readonly level: WcagLevel = 'A';
  readonly severity: A11ySeverity = 'serious';

  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding> {
    const findings: A11yFinding[] = [];
    for (const element of doc.elements) {
      if (element.tag !== 'html') continue;
      if (providesValue(element, 'lang')) continue;
      findings.push({
        ruleId: this.id,
        criterion: this.criterion,
        level: this.level,
        severity: this.severity,
        path: doc.path,
        line: element.line,
        message: '<html> does not declare a lang attribute',
        remediation:
          'Set lang on <html> from the resolved tenant/user locale (see LocaleFormatPolicyService).',
      });
    }
    return findings;
  }
}

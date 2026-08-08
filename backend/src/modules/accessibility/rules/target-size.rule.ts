/**
 * Phase 29 — WCAG 2.5.8 Target Size (Minimum) (CR-AI-1304).
 *
 * New in WCAG 2.2 (Level AA): a pointer target must be at least
 * 24 × 24 CSS pixels unless it is inline in a sentence or has an
 * equivalent alternative.
 *
 * The design system is Tailwind, whose spacing scale is 4 px per
 * unit, so `h-6 w-6` is exactly the 24 px minimum and anything below
 * `6` on both axes — with no padding and no explicit `min-h`/`min-w`
 * override — is a real, provable violation.
 *
 * SOLID
 *   SRP — owns ONLY criterion 2.5.8.
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
import { classTokens, isHtmlTag, tailwindScale } from '../parser/element-query';

/** 24 CSS px at the Tailwind 4 px scale. */
const MINIMUM_SCALE = 6;
const POINTER_TAGS: ReadonlyArray<string> = ['button', 'a'];
const ENLARGING_PREFIXES: ReadonlyArray<string> = [
  'p',
  'px',
  'py',
  'min-h',
  'min-w',
];

@Injectable()
export class TargetSizeRule implements IA11yRule {
  readonly id = 'a11y/target-size';
  readonly criterion: WcagCriterion = '2.5.8';
  readonly level: WcagLevel = 'AA';
  readonly severity: A11ySeverity = 'moderate';

  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding> {
    const findings: A11yFinding[] = [];
    for (const element of doc.elements) {
      if (!isHtmlTag(element) || !POINTER_TAGS.includes(element.tag)) continue;

      const tokens = classTokens(element);
      if (tokens.length === 0) continue;
      if (ENLARGING_PREFIXES.some((p) => tailwindScale(tokens, p) !== null)) {
        continue;
      }

      const height = tailwindScale(tokens, 'h');
      const width = tailwindScale(tokens, 'w');
      if (height === null || width === null) continue;
      if (height >= MINIMUM_SCALE && width >= MINIMUM_SCALE) continue;

      findings.push({
        ruleId: this.id,
        criterion: this.criterion,
        level: this.level,
        severity: this.severity,
        path: doc.path,
        line: element.line,
        message: `<${element.tag}> pointer target is ${width * 4}×${height * 4}px, below the 24×24px minimum`,
        remediation:
          'Grow the target to at least h-6 w-6, or add padding (p-*) around the icon.',
      });
    }
    return findings;
  }
}

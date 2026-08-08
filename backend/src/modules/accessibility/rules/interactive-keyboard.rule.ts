/**
 * Phase 29 — WCAG 2.1.1 Keyboard (CR-AI-1304).
 *
 * A non-interactive element that carries `onClick` is unreachable by
 * keyboard users unless it is also focusable and responds to a key
 * event. The rule requires the full triad on such elements:
 * `role`, `tabIndex`, and one of the keyboard handlers.
 *
 * Native interactive tags (`button`, `a[href]`, `input`, …) are
 * exempt — the user agent already provides keyboard operation.
 *
 * SOLID
 *   SRP — owns ONLY criterion 2.1.1.
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
import {
  hasAnyAttribute,
  hasAttribute,
  isAriaExempt,
  isHtmlTag,
  KEYBOARD_HANDLERS,
} from '../parser/element-query';

const NATIVELY_INTERACTIVE: ReadonlyArray<string> = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'details',
  'option',
];

@Injectable()
export class InteractiveKeyboardRule implements IA11yRule {
  readonly id = 'a11y/interactive-keyboard';
  readonly criterion: WcagCriterion = '2.1.1';
  readonly level: WcagLevel = 'A';
  readonly severity: A11ySeverity = 'serious';

  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding> {
    const findings: A11yFinding[] = [];
    for (const element of doc.elements) {
      if (!isHtmlTag(element)) continue;
      if (NATIVELY_INTERACTIVE.includes(element.tag)) continue;
      if (!hasAttribute(element, 'onClick')) continue;
      if (isAriaExempt(element)) continue;

      const missing: string[] = [];
      if (!hasAttribute(element, 'role')) missing.push('role');
      if (!hasAttribute(element, 'tabIndex')) missing.push('tabIndex');
      if (!hasAnyAttribute(element, KEYBOARD_HANDLERS)) {
        missing.push(KEYBOARD_HANDLERS.join('|'));
      }
      if (missing.length === 0) continue;

      findings.push({
        ruleId: this.id,
        criterion: this.criterion,
        level: this.level,
        severity: this.severity,
        path: doc.path,
        line: element.line,
        message: `<${element.tag} onClick> is not keyboard operable (missing ${missing.join(', ')})`,
        remediation:
          'Use a <button>, or add role, tabIndex and an onKeyDown handler to the element.',
      });
    }
    return findings;
  }
}

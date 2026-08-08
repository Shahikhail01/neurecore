/**
 * Phase 29 — WCAG 3.3.2 Labels or Instructions (CR-AI-1304).
 *
 * Every form control must expose a programmatic name. Accepted
 * sources, in the order assistive technology resolves them:
 *   1. `aria-label` / `aria-labelledby` / `title`
 *   2. an `id` referenced by a `<label htmlFor="…">` in the same file
 *   3. the control being wrapped by a `<label>` element
 *
 * A `placeholder` is deliberately NOT accepted: it disappears on
 * input and is not a label.
 *
 * SOLID
 *   SRP — owns ONLY criterion 3.3.2 (form-control naming).
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
  hasAccessibleNameAttribute,
  isAriaExempt,
  isHtmlTag,
  literalValue,
} from '../parser/element-query';

const CONTROL_TAGS: ReadonlyArray<string> = ['input', 'select', 'textarea'];
/** Controls whose visible value already provides the accessible name. */
const SELF_LABELLING_INPUT_TYPES: ReadonlyArray<string> = [
  'hidden',
  'submit',
  'reset',
  'button',
  'image',
];

@Injectable()
export class FormLabelRule implements IA11yRule {
  readonly id = 'a11y/form-label';
  readonly criterion: WcagCriterion = '3.3.2';
  readonly level: WcagLevel = 'A';
  readonly severity: A11ySeverity = 'serious';

  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding> {
    const labelledIds = this.labelTargets(doc);
    const wrappedLines = this.labelWrappedLines(doc.source);
    const findings: A11yFinding[] = [];

    for (const element of doc.elements) {
      if (!isHtmlTag(element)) continue;
      if (!CONTROL_TAGS.includes(element.tag)) continue;

      const type = literalValue(element, 'type');
      if (type !== null && SELF_LABELLING_INPUT_TYPES.includes(type)) continue;
      if (isAriaExempt(element)) continue;
      if (hasAccessibleNameAttribute(element)) continue;

      const id = literalValue(element, 'id');
      if (id !== null && labelledIds.has(id)) continue;
      if (wrappedLines.has(element.line)) continue;

      findings.push({
        ruleId: this.id,
        criterion: this.criterion,
        level: this.level,
        severity: this.severity,
        path: doc.path,
        line: element.line,
        message: `<${element.tag}> has no programmatic label`,
        remediation:
          'Add aria-label, or give the control an id referenced by a <label htmlFor="…">.',
      });
    }
    return findings;
  }

  /** Every `htmlFor`/`for` literal declared by a `<label>` in the file. */
  private labelTargets(doc: A11ySourceDocument): ReadonlySet<string> {
    const targets = new Set<string>();
    for (const element of doc.elements) {
      if (element.tag !== 'label' && element.tag !== 'Label') continue;
      const target =
        literalValue(element, 'htmlFor') ?? literalValue(element, 'for');
      if (target !== null && target.length > 0) targets.add(target);
    }
    return targets;
  }

  /**
   * 1-based line numbers that sit inside an open `<label>` element.
   * A control wrapped by its label needs no `htmlFor` binding.
   */
  private labelWrappedLines(source: string): ReadonlySet<number> {
    const wrapped = new Set<number>();
    const lines = source.split('\n');
    let depth = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i] ?? '';
      const opens = (text.match(/<label\b(?![^>]*\/>)/gi) ?? []).length;
      const closes = (text.match(/<\/label>/gi) ?? []).length;
      if (depth > 0) wrapped.add(i + 1);
      depth += opens - closes;
      if (depth < 0) depth = 0;
      if (opens > 0 && depth > 0) wrapped.add(i + 1);
    }
    return wrapped;
  }
}

/**
 * Phase 29 — WCAG 4.1.2 Name, Role, Value (CR-AI-1304).
 *
 * Two structural cases the static engine can prove:
 *   • `<iframe>` without a `title` — the frame is announced as
 *     "frame" with no way to know what it contains.
 *   • an element with `role="dialog"` / `role="alertdialog"` /
 *     `aria-modal` and no accessible name — the dialog opens with no
 *     announcement of what it is.
 *
 * SOLID
 *   SRP — owns ONLY criterion 4.1.2.
 */

import { Injectable } from '@nestjs/common';
import {
  type A11yElement,
  type A11yFinding,
  type A11ySeverity,
  type A11ySourceDocument,
  type IA11yRule,
  type WcagCriterion,
  type WcagLevel,
} from '../interfaces/IA11yRule';
import {
  hasAccessibleNameAttribute,
  hasAttribute,
  literalValue,
  providesValue,
} from '../parser/element-query';

const DIALOG_ROLES: ReadonlyArray<string> = ['dialog', 'alertdialog'];

@Injectable()
export class NameRoleValueRule implements IA11yRule {
  readonly id = 'a11y/name-role-value';
  readonly criterion: WcagCriterion = '4.1.2';
  readonly level: WcagLevel = 'A';
  readonly severity: A11ySeverity = 'serious';

  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding> {
    const findings: A11yFinding[] = [];
    for (const element of doc.elements) {
      if (element.tag === 'iframe' && !providesValue(element, 'title')) {
        findings.push(
          this.finding(
            doc.path,
            element.line,
            '<iframe> has no title attribute',
            'Add title="…" describing the embedded content.',
          ),
        );
        continue;
      }
      if (!this.isDialog(element)) continue;
      if (hasAccessibleNameAttribute(element)) continue;
      findings.push(
        this.finding(
          doc.path,
          element.line,
          `<${element.tag}> declares a dialog role with no accessible name`,
          'Add aria-label, or aria-labelledby pointing at the dialog heading id.',
        ),
      );
    }
    return findings;
  }

  private isDialog(element: A11yElement): boolean {
    const role = literalValue(element, 'role');
    if (role !== null && DIALOG_ROLES.includes(role)) return true;
    return hasAttribute(element, 'aria-modal');
  }

  private finding(
    path: string,
    line: number,
    message: string,
    remediation: string,
  ): A11yFinding {
    return {
      ruleId: this.id,
      criterion: this.criterion,
      level: this.level,
      severity: this.severity,
      path,
      line,
      message,
      remediation,
    };
  }
}

/**
 * NeureCore Harness - Redaction Types
 */

export interface RedactionRule {
  pattern: RegExp;
  replacement?: string;
  preserve?: boolean;
}
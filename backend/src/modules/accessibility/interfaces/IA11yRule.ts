/**
 * Phase 29 — Accessibility audit contracts (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * SOLID
 *   SRP — this file owns ONLY the audit vocabulary (types + the
 *         narrow rule contract). No rule logic, no IO, no DI wiring.
 *   OCP — a new WCAG criterion check = one `IA11yRule` implementation
 *         plus one registry key. The runner never changes.
 *   LSP — every rule substitutes `IA11yRule`; the runner invokes every
 *         rule uniformly and never special-cases a criterion.
 *   ISP — `IA11yRule` declares a single method (`evaluate`). Loading
 *         source and publishing reports are separate contracts
 *         (`IA11ySourceLoader`, `IA11yReportSink`).
 *   DIP — rules depend on the typed `A11ySourceDocument` value object,
 *         never on the filesystem or on a framework.
 */

/** WCAG 2.2 success criteria covered by the audit runner. */
export type WcagCriterion =
  | '1.1.1'
  | '1.3.1'
  | '2.1.1'
  | '2.4.3'
  | '2.5.8'
  | '3.1.1'
  | '3.3.2'
  | '4.1.2';

/** Conformance level a criterion belongs to. WCAG 2.2 AA = A + AA. */
export type WcagLevel = 'A' | 'AA';

/**
 * Severity taxonomy, aligned with the axe-core impact vocabulary so
 * findings from the static engine and the runtime engine can be
 * merged into a single report without translation.
 */
export type A11ySeverity = 'critical' | 'serious' | 'moderate' | 'minor';

/** Severities that block the G29 gate. */
export const BLOCKING_SEVERITIES: ReadonlyArray<A11ySeverity> = [
  'critical',
  'serious',
];

/** A single JSX attribute as written in source. */
export interface A11yAttribute {
  readonly name: string;
  /** `null` for a bare attribute (`disabled`), else the literal or expression text. */
  readonly value: string | null;
  /** True when the value was written as a `{…}` expression. */
  readonly expression: boolean;
}

/** A single JSX element occurrence in a source document. */
export interface A11yElement {
  readonly tag: string;
  readonly line: number;
  readonly selfClosing: boolean;
  readonly attributes: ReadonlyMap<string, A11yAttribute>;
}

/** A parsed source document handed to every rule. */
export interface A11ySourceDocument {
  /** Repository-relative path, POSIX separators. */
  readonly path: string;
  readonly source: string;
  readonly elements: ReadonlyArray<A11yElement>;
}

/** One violation of one criterion at one source location. */
export interface A11yFinding {
  readonly ruleId: string;
  readonly criterion: WcagCriterion;
  readonly level: WcagLevel;
  readonly severity: A11ySeverity;
  readonly path: string;
  readonly line: number;
  readonly message: string;
  readonly remediation: string;
}

/** The aggregate result of one audit run. */
export interface A11yAuditReport {
  readonly generatedAt: string;
  readonly roots: ReadonlyArray<string>;
  readonly documentsScanned: number;
  readonly rulesApplied: ReadonlyArray<string>;
  readonly findings: ReadonlyArray<A11yFinding>;
  readonly blockingCount: number;
  readonly verdict: 'PASS' | 'FAIL';
}

/**
 * A single WCAG rule. One method — the smallest possible surface, so
 * a consumer that only needs evaluation never depends on reporting,
 * loading, or configuration concerns (ISP).
 */
export interface IA11yRule {
  readonly id: string;
  readonly criterion: WcagCriterion;
  readonly level: WcagLevel;
  readonly severity: A11ySeverity;
  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding>;
}

/** DI token — multi-bound array of every registered rule. */
export const A11Y_RULE = Symbol('A11yRule');
/** DI token — the criterion-keyed rule registry. */
export const A11Y_RULE_REGISTRY = Symbol('A11yRuleRegistry');
/** DI token — the source loader used by the runner. */
export const A11Y_SOURCE_LOADER = Symbol('A11ySourceLoader');
/** DI token — the report sink used by the runner. */
export const A11Y_REPORT_SINK = Symbol('A11yReportSink');

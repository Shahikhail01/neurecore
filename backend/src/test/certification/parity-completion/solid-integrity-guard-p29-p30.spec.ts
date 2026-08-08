/**
 * Phase 29/30 — SOLID integrity guard.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §2
 * (100 % SOLID, enforced by an automated source-scan guard).
 *
 * This guard enforces the five principles on every NEW file
 * introduced by P29 (WCAG 2.2 AA audit + localization) and P30
 * (per-tenant cost ceiling + resilience dashboard). It reads source
 * at test time and fails CI if any rule is violated — the same
 * mechanism as `solid-integrity-guard.spec.ts` (P22/P24),
 * `skill-registry-integrity.spec.ts` and `platform-integrity-guard.spec.ts`.
 *
 *   SRP — no file > 400 LOC; exactly one exported class per file
 *         (value-object and registry-provider files excepted).
 *   OCP — rules/formatters live behind a keyed registry, never behind
 *         a switch in the caller.
 *   LSP — every concrete rule / formatter / sink / loader / reporter
 *         implements its `I…` interface.
 *   ISP — no `I…` interface declares more than 5 methods.
 *   DIP — domain files import interfaces, not PrismaService; only the
 *         designated adapter files touch Prisma.
 */

import * as path from 'node:path';
import { readFileSync, statSync } from 'node:fs';

const MAX_FILE_LOC = 400;
const MAX_INTERFACE_METHODS = 5;

/** Every file the two phases introduced, relative to `backend/`. */
const P29_FILES: ReadonlyArray<string> = [
  'src/modules/accessibility/interfaces/IA11yRule.ts',
  'src/modules/accessibility/interfaces/IA11ySourceLoader.ts',
  'src/modules/accessibility/interfaces/IA11yReportSink.ts',
  'src/modules/accessibility/parser/jsx-source.parser.ts',
  'src/modules/accessibility/parser/element-query.ts',
  'src/modules/accessibility/rules/image-alt.rule.ts',
  'src/modules/accessibility/rules/form-label.rule.ts',
  'src/modules/accessibility/rules/interactive-keyboard.rule.ts',
  'src/modules/accessibility/rules/focus-order.rule.ts',
  'src/modules/accessibility/rules/document-language.rule.ts',
  'src/modules/accessibility/rules/name-role-value.rule.ts',
  'src/modules/accessibility/rules/target-size.rule.ts',
  'src/modules/accessibility/rules/heading-order.rule.ts',
  'src/modules/accessibility/a11y-rule.registry.ts',
  'src/modules/accessibility/a11y-audit.runner.ts',
  'src/modules/accessibility/key-screens.ts',
  'src/modules/accessibility/loaders/source-tree.loader.ts',
  'src/modules/accessibility/loaders/in-memory-source.loader.ts',
  'src/modules/accessibility/sinks/json-a11y-report.sink.ts',
  'src/modules/accessibility/sinks/in-memory-a11y-report.sink.ts',
  'src/modules/accessibility/accessibility.module.ts',
  'src/modules/localization/format/interfaces/ILocaleFormatter.ts',
  'src/modules/localization/format/interfaces/ILocaleResolver.ts',
  'src/modules/localization/format/formatters/temporal-locale.formatter.ts',
  'src/modules/localization/format/formatters/currency-locale.formatter.ts',
  'src/modules/localization/format/formatters/number-locale.formatter.ts',
  'src/modules/localization/format/locale-formatter.registry.ts',
  'src/modules/localization/format/locale-format.policy.ts',
  'src/modules/localization/format/resolvers/tenant-locale.resolver.ts',
  'src/modules/localization/format/accept-language.ts',
];

const P30_FILES: ReadonlyArray<string> = [
  'src/modules/cost-ceiling/interfaces/ICeilingRule.ts',
  'src/modules/cost-ceiling/interfaces/IUsageReporter.ts',
  'src/modules/cost-ceiling/interfaces/IAlertSink.ts',
  'src/modules/cost-ceiling/interfaces/ISpendRecorder.ts',
  'src/modules/cost-ceiling/interfaces/ICostCeilingEnforcer.ts',
  'src/modules/cost-ceiling/cost-ceiling.errors.ts',
  'src/modules/cost-ceiling/rules/ceiling-evaluation.ts',
  'src/modules/cost-ceiling/rules/monthly-spend-ceiling.rule.ts',
  'src/modules/cost-ceiling/rules/daily-spend-ceiling.rule.ts',
  'src/modules/cost-ceiling/rules/monthly-token-ceiling.rule.ts',
  'src/modules/cost-ceiling/rules/request-rate-ceiling.rule.ts',
  'src/modules/cost-ceiling/ceiling-rule.registry.ts',
  'src/modules/cost-ceiling/config/tenant-cost-ceiling.repository.ts',
  'src/modules/cost-ceiling/usage/request-rate.window.ts',
  'src/modules/cost-ceiling/usage/prisma-usage.reporter.ts',
  'src/modules/cost-ceiling/usage/prisma-spend.recorder.ts',
  'src/modules/cost-ceiling/alerts/audit-cost-alert.sink.ts',
  'src/modules/cost-ceiling/cost-ceiling.service.ts',
  'src/modules/cost-ceiling/cost-ceiling.tenant-scope.service.ts',
  'src/modules/cost-ceiling/cost-dashboard.service.ts',
  'src/modules/cost-ceiling/dto/cost-ceiling.dto.ts',
  'src/modules/cost-ceiling/controllers/cost-ceiling.controller.ts',
  'src/modules/cost-ceiling/cost-ceiling.module.ts',
];

const NEW_FILES: ReadonlyArray<string> = [...P29_FILES, ...P30_FILES];

/**
 * The ONLY files allowed to import PrismaService. Everything else in
 * the two modules must reach persistence through an interface.
 */
const PRISMA_ADAPTERS: ReadonlySet<string> = new Set([
  'src/modules/localization/format/resolvers/tenant-locale.resolver.ts',
  'src/modules/cost-ceiling/config/tenant-cost-ceiling.repository.ts',
  'src/modules/cost-ceiling/usage/prisma-usage.reporter.ts',
  'src/modules/cost-ceiling/usage/prisma-spend.recorder.ts',
]);

/**
 * Files that legitimately export more than one class:
 *   • DTO bundles and formatter families whose members share a single
 *     concern and would otherwise be split into near-empty files.
 *   • A registry or adapter colocated with the typed error it throws
 *     — the platform convention set by `KillSwitchTenantScopeError`,
 *     which keeps the error next to its only thrower.
 */
const MULTI_EXPORT_ALLOWED: ReadonlySet<string> = new Set([
  'src/modules/cost-ceiling/cost-ceiling.errors.ts',
  'src/modules/cost-ceiling/dto/cost-ceiling.dto.ts',
  'src/modules/localization/format/formatters/temporal-locale.formatter.ts',
  'src/modules/localization/format/locale-formatter.registry.ts',
  'src/modules/localization/format/resolvers/tenant-locale.resolver.ts',
  'src/modules/cost-ceiling/ceiling-rule.registry.ts',
]);

/**
 * DIP: a collaborator is a service, repository, registry, adapter or
 * transport. Constructing one inside domain code hard-wires the
 * dependency. Value objects (`Date`, `Map`, `Set`, `Error`) are not
 * collaborators and are deliberately not matched.
 */
const COLLABORATOR_CONSTRUCTION =
  /new\s+\w*(Service|Repository|Registry|Runner|Reporter|Sink|Loader|Recorder|Resolver|Client|Window|Parser)\s*\(/;

function absolute(rel: string): string {
  return path.join(__dirname, '..', '..', '..', '..', rel);
}

function read(rel: string): string {
  const file = absolute(rel);
  if (!statSync(file, { throwIfNoEntry: false })) return '';
  return readFileSync(file, 'utf-8');
}

function countInterfaceMethods(src: string): Map<string, number> {
  const counts = new Map<string, number>();
  const re = /interface\s+(I[A-Z]\w*)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src)) !== null) {
    const body = match[2] ?? '';
    const methods = (body.match(/^\s*[a-zA-Z_]\w*\s*[<(]/gm) ?? []).length;
    counts.set(match[1], methods);
  }
  return counts;
}

function exportedClassCount(src: string): number {
  return (src.match(/^export\s+(?:abstract\s+)?class\s+/gm) ?? []).length;
}

describe('Phase 29/30 — SOLID integrity guard', () => {
  describe('SRP — every new file is small and single-purpose', () => {
    for (const rel of NEW_FILES) {
      it(`${rel} exists and is <= ${MAX_FILE_LOC} LOC`, () => {
        const file = absolute(rel);
        const stat = statSync(file, { throwIfNoEntry: false });
        if (!stat) throw new Error(`Missing file: ${rel}`);
        const loc = readFileSync(file, 'utf-8').split('\n').length;
        expect(loc).toBeLessThanOrEqual(MAX_FILE_LOC);
      });
    }

    it('each new file exports at most one class (documented exceptions aside)', () => {
      const offenders = NEW_FILES.filter(
        (rel) =>
          !MULTI_EXPORT_ALLOWED.has(rel) && exportedClassCount(read(rel)) > 1,
      );
      expect(offenders).toEqual([]);
    });
  });

  describe('OCP — behaviour is extended through keyed registries', () => {
    it('A11yRuleRegistry is keyed by WcagCriterion, not a switch', () => {
      const src = read('src/modules/accessibility/a11y-rule.registry.ts');
      expect(src).toMatch(/new Map<WcagCriterion, IA11yRule\[\]>/);
      expect(src).not.toMatch(/switch\s*\(/);
    });

    it('AccessibilityModule declares the rule list as the single extension point', () => {
      const src = read('src/modules/accessibility/accessibility.module.ts');
      expect(src).toMatch(/export const A11Y_RULE_CLASSES = \[/);
      expect(src).toMatch(/provide: A11Y_RULE/);
    });

    it('LocaleFormatterRegistry is keyed by LocaleFormatKind', () => {
      const src = read(
        'src/modules/localization/format/locale-formatter.registry.ts',
      );
      expect(src).toMatch(/new Map<LocaleFormatKind, ILocaleFormatter>/);
      expect(src).not.toMatch(/switch\s*\(/);
    });

    it('CeilingRuleRegistry is keyed by CostDimension', () => {
      const src = read('src/modules/cost-ceiling/ceiling-rule.registry.ts');
      expect(src).toMatch(/new Map<CostDimension, ICeilingRule>/);
      expect(src).not.toMatch(/switch\s*\(/);
    });

    it('CostCeilingModule declares the rule list as the single extension point', () => {
      const src = read('src/modules/cost-ceiling/cost-ceiling.module.ts');
      expect(src).toMatch(/export const CEILING_RULE_CLASSES = \[/);
      expect(src).toMatch(/provide: CEILING_RULE/);
    });

    it('CostCeilingService contains no per-dimension branch', () => {
      const src = read('src/modules/cost-ceiling/cost-ceiling.service.ts');
      expect(src).not.toMatch(/MONTHLY_SPEND_CENTS|REQUESTS_PER_MINUTE/);
      expect(src).not.toMatch(/switch\s*\(/);
    });

    it('A11yAuditRunner contains no per-criterion branch', () => {
      const src = read('src/modules/accessibility/a11y-audit.runner.ts');
      expect(src).not.toMatch(/1\.1\.1|3\.3\.2|2\.5\.8/);
      expect(src).not.toMatch(/switch\s*\(/);
    });
  });

  describe('LSP — every concrete type implements its interface', () => {
    const implementations: ReadonlyArray<[string, RegExp]> = [
      [
        'src/modules/accessibility/rules/image-alt.rule.ts',
        /class ImageAltRule implements IA11yRule/,
      ],
      [
        'src/modules/accessibility/rules/form-label.rule.ts',
        /class FormLabelRule implements IA11yRule/,
      ],
      [
        'src/modules/accessibility/rules/interactive-keyboard.rule.ts',
        /class InteractiveKeyboardRule implements IA11yRule/,
      ],
      [
        'src/modules/accessibility/rules/focus-order.rule.ts',
        /class FocusOrderRule implements IA11yRule/,
      ],
      [
        'src/modules/accessibility/rules/document-language.rule.ts',
        /class DocumentLanguageRule implements IA11yRule/,
      ],
      [
        'src/modules/accessibility/rules/name-role-value.rule.ts',
        /class NameRoleValueRule implements IA11yRule/,
      ],
      [
        'src/modules/accessibility/rules/target-size.rule.ts',
        /class TargetSizeRule implements IA11yRule/,
      ],
      [
        'src/modules/accessibility/rules/heading-order.rule.ts',
        /class HeadingOrderRule implements IA11yRule/,
      ],
      [
        'src/modules/accessibility/parser/jsx-source.parser.ts',
        /class JsxSourceParser implements IJsxSourceParser/,
      ],
      [
        'src/modules/accessibility/loaders/source-tree.loader.ts',
        /class SourceTreeLoader implements IA11ySourceLoader/,
      ],
      [
        'src/modules/accessibility/loaders/in-memory-source.loader.ts',
        /class InMemorySourceLoader implements IA11ySourceLoader/,
      ],
      [
        'src/modules/accessibility/sinks/json-a11y-report.sink.ts',
        /class JsonA11yReportSink implements IA11yReportSink/,
      ],
      [
        'src/modules/accessibility/sinks/in-memory-a11y-report.sink.ts',
        /class InMemoryA11yReportSink implements IA11yReportSink/,
      ],
      [
        'src/modules/localization/format/formatters/temporal-locale.formatter.ts',
        /class DateLocaleFormatter implements ILocaleFormatter/,
      ],
      [
        'src/modules/localization/format/formatters/currency-locale.formatter.ts',
        /class CurrencyLocaleFormatter implements ILocaleFormatter/,
      ],
      [
        'src/modules/localization/format/formatters/number-locale.formatter.ts',
        /class NumberLocaleFormatter implements ILocaleFormatter/,
      ],
      [
        'src/modules/localization/format/resolvers/tenant-locale.resolver.ts',
        /class TenantLocaleResolver implements ILocaleResolver/,
      ],
      [
        'src/modules/cost-ceiling/rules/monthly-spend-ceiling.rule.ts',
        /class MonthlySpendCeilingRule implements ICeilingRule/,
      ],
      [
        'src/modules/cost-ceiling/rules/daily-spend-ceiling.rule.ts',
        /class DailySpendCeilingRule implements ICeilingRule/,
      ],
      [
        'src/modules/cost-ceiling/rules/monthly-token-ceiling.rule.ts',
        /class MonthlyTokenCeilingRule implements ICeilingRule/,
      ],
      [
        'src/modules/cost-ceiling/rules/request-rate-ceiling.rule.ts',
        /class RequestRateCeilingRule implements ICeilingRule/,
      ],
      [
        'src/modules/cost-ceiling/usage/prisma-usage.reporter.ts',
        /class PrismaUsageReporter implements IUsageReporter/,
      ],
      [
        'src/modules/cost-ceiling/usage/prisma-spend.recorder.ts',
        /class PrismaSpendRecorder implements ISpendRecorder/,
      ],
      [
        'src/modules/cost-ceiling/alerts/audit-cost-alert.sink.ts',
        /class AuditCostAlertSink implements IAlertSink/,
      ],
      [
        'src/modules/cost-ceiling/cost-ceiling.service.ts',
        /class CostCeilingService implements ICostCeilingEnforcer/,
      ],
    ];
    for (const [rel, pattern] of implementations) {
      it(`${rel} implements its interface`, () => {
        expect(read(rel)).toMatch(pattern);
      });
    }
  });

  describe(`ISP — no interface declares more than ${MAX_INTERFACE_METHODS} methods`, () => {
    for (const rel of NEW_FILES) {
      it(`${rel} keeps every I… interface narrow`, () => {
        const counts = countInterfaceMethods(read(rel));
        const wide = [...counts.entries()].filter(
          ([, n]) => n > MAX_INTERFACE_METHODS,
        );
        expect(wide).toEqual([]);
      });
    }

    it('the single-method contracts really declare one method', () => {
      const singles: ReadonlyArray<[string, string]> = [
        [
          'src/modules/accessibility/interfaces/IA11ySourceLoader.ts',
          'IA11ySourceLoader',
        ],
        [
          'src/modules/accessibility/interfaces/IA11yReportSink.ts',
          'IA11yReportSink',
        ],
        ['src/modules/accessibility/interfaces/IA11yRule.ts', 'IA11yRule'],
        [
          'src/modules/localization/format/interfaces/ILocaleFormatter.ts',
          'ILocaleFormatter',
        ],
        [
          'src/modules/localization/format/interfaces/ILocaleResolver.ts',
          'ILocaleResolver',
        ],
        [
          'src/modules/cost-ceiling/interfaces/IUsageReporter.ts',
          'IUsageReporter',
        ],
        ['src/modules/cost-ceiling/interfaces/IAlertSink.ts', 'IAlertSink'],
        [
          'src/modules/cost-ceiling/interfaces/ISpendRecorder.ts',
          'ISpendRecorder',
        ],
        ['src/modules/cost-ceiling/interfaces/ICeilingRule.ts', 'ICeilingRule'],
      ];
      for (const [rel, name] of singles) {
        const counts = countInterfaceMethods(read(rel));
        expect(`${name}=${counts.get(name)}`).toBe(`${name}=1`);
      }
    });
  });

  describe('DIP — domain code depends on abstractions, not Prisma', () => {
    for (const rel of NEW_FILES) {
      if (PRISMA_ADAPTERS.has(rel)) continue;
      it(`${rel} does not import PrismaService`, () => {
        expect(read(rel)).not.toMatch(/import[^;]*PrismaService/);
      });
    }

    it('CostCeilingService collaborates only through injected tokens', () => {
      const src = read('src/modules/cost-ceiling/cost-ceiling.service.ts');
      expect(src).toMatch(/@Inject\(CEILING_RULE_REGISTRY\)/);
      expect(src).toMatch(/@Inject\(USAGE_REPORTER\)/);
      expect(src).toMatch(/@Inject\(COST_ALERT_SINK\)/);
      expect(src).toMatch(/@Inject\(SPEND_RECORDER\)/);
      expect(src).not.toMatch(COLLABORATOR_CONSTRUCTION);
    });

    it('A11yAuditRunner collaborates only through injected tokens', () => {
      const src = read('src/modules/accessibility/a11y-audit.runner.ts');
      expect(src).toMatch(/@Inject\(A11Y_SOURCE_LOADER\)/);
      expect(src).toMatch(/@Inject\(A11Y_RULE_REGISTRY\)/);
      expect(src).toMatch(/@Inject\(A11Y_REPORT_SINK\)/);
      expect(src).not.toMatch(COLLABORATOR_CONSTRUCTION);
    });

    it('LlmModelRunner depends on the enforcer interface, not the module', () => {
      const src = read(
        'src/modules/analytics/services/model-runner/llm-model-runner.ts',
      );
      expect(src).toMatch(/@Inject\(COST_CEILING_ENFORCER\)/);
      expect(src).toMatch(/ICostCeilingEnforcer \| null/);
      expect(src).not.toMatch(/import[^;]*CostCeilingService/);
    });

    it('every ceiling rule is free of IO', () => {
      for (const rel of P30_FILES.filter((f) => f.endsWith('.rule.ts'))) {
        const src = read(rel);
        expect(src).not.toMatch(/PrismaService|fetch\(|axios/);
      }
    });

    it('every a11y rule is free of IO', () => {
      for (const rel of P29_FILES.filter((f) => f.endsWith('.rule.ts'))) {
        const src = read(rel);
        expect(src).not.toMatch(/node:fs|PrismaService|fetch\(/);
      }
    });
  });

  describe('Typed-error taxonomy — no bare Error is thrown by new code', () => {
    const errorOwners: ReadonlyArray<[string, RegExp]> = [
      [
        'src/modules/cost-ceiling/cost-ceiling.errors.ts',
        /class CostCeilingExceededError extends HttpException/,
      ],
      [
        'src/modules/cost-ceiling/cost-ceiling.errors.ts',
        /class CostCeilingScopeError extends ForbiddenException/,
      ],
      [
        'src/modules/cost-ceiling/cost-ceiling.errors.ts',
        /class InvalidCeilingLimitError extends Error/,
      ],
      [
        'src/modules/localization/format/resolvers/tenant-locale.resolver.ts',
        /class LocaleResolutionScopeError extends ForbiddenException/,
      ],
      [
        'src/modules/localization/format/locale-formatter.registry.ts',
        /class UnknownLocaleFormatKindError extends Error/,
      ],
      [
        'src/modules/cost-ceiling/ceiling-rule.registry.ts',
        /class UnknownCostDimensionError extends Error/,
      ],
    ];
    for (const [rel, pattern] of errorOwners) {
      it(`${rel} declares ${String(pattern).slice(0, 48)}…`, () => {
        expect(read(rel)).toMatch(pattern);
      });
    }

    it('no P30 service throws a bare Error', () => {
      const services = P30_FILES.filter(
        (f) => f.endsWith('.service.ts') || f.endsWith('.repository.ts'),
      );
      for (const rel of services) {
        expect(read(rel)).not.toMatch(/throw new Error\(/);
      }
    });
  });
});

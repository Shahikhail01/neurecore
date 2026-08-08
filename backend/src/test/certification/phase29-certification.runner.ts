/**
 * Phase 29 — G29 WCAG 2.2 AA + localization certification runner.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G29-A-001 — Phase 26 G26 still APPROVED (no regression)
 *   G29-A-002 — A11yRuleRegistry wires 8 rules across 8 WCAG criteria
 *   G29-A-003 — Static engine detects every seeded violation class
 *   G29-A-004 — Static engine reports nothing on a conformant document
 *   G29-A-005 — Markup written inside comments is never reported
 *   G29-A-006 — Key screens carry ZERO findings of any severity
 *   G29-A-007 — Repo-wide blocking backlog is at or below the ratchet
 *   G29-A-008 — LocaleFormatterRegistry wires 5 kinds + typed error
 *   G29-A-009 — Currency renders per locale from integer cents
 *   G29-A-010 — Temporal formatting honours the resolved time zone
 *   G29-A-011 — TenantLocaleResolver ladder + wildcard refusal
 *   G29-A-012 — Accept-Language negotiation picks a supported locale
 *   G29-A-013 — FE a11y + locale primitives are wired into both shells
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Phase26CertificationRunner } from './phase26-certification.runner';
import { A11yRuleRegistry } from '../../modules/accessibility/a11y-rule.registry';
import { A11yAuditRunner } from '../../modules/accessibility/a11y-audit.runner';
import { JsxSourceParser } from '../../modules/accessibility/parser/jsx-source.parser';
import { SourceTreeLoader } from '../../modules/accessibility/loaders/source-tree.loader';
import { InMemorySourceLoader } from '../../modules/accessibility/loaders/in-memory-source.loader';
import { InMemoryA11yReportSink } from '../../modules/accessibility/sinks/in-memory-a11y-report.sink';
import { A11Y_RULE_CLASSES } from '../../modules/accessibility/accessibility.module';
import {
  A11Y_BLOCKING_BASELINE,
  isKeyScreenPath,
} from '../../modules/accessibility/key-screens';
import { LocaleFormatterRegistry } from '../../modules/localization/format/locale-formatter.registry';
import { LOCALE_FORMATTER_CLASSES } from '../../modules/localization/localization.module';
import { TenantLocaleResolver } from '../../modules/localization/format/resolvers/tenant-locale.resolver';
import { LocaleFormatPolicyService } from '../../modules/localization/format/locale-format.policy';
import { negotiateLocale } from '../../modules/localization/format/accept-language';
import {
  VIOLATING_FIXTURE,
  CONFORMANT_FIXTURE,
  COMMENT_FIXTURE,
} from './fixtures/a11y-fixtures';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

const NEURECORE_ROOT = path.join(__dirname, '..', '..', '..', '..');
const FRONTEND_ROOTS: ReadonlyArray<string> = [
  path.join(NEURECORE_ROOT, 'frontend-tenant', 'src'),
  path.join(NEURECORE_ROOT, 'frontend-admin', 'src'),
];

function buildRegistry(): A11yRuleRegistry {
  const registry = new A11yRuleRegistry(
    A11Y_RULE_CLASSES.map((Rule) => new Rule()),
  );
  registry.onModuleInit();
  return registry;
}

function buildFormatterRegistry(): LocaleFormatterRegistry {
  const registry = new LocaleFormatterRegistry(
    LOCALE_FORMATTER_CLASSES.map((Formatter) => new Formatter()),
  );
  registry.onModuleInit();
  return registry;
}

@Injectable()
export class Phase29CertificationRunner {
  private readonly logger = new Logger(Phase29CertificationRunner.name);

  async run(): Promise<{
    readonly verdict: 'APPROVED' | 'BLOCKED';
    readonly gates: ReadonlyArray<GateResult>;
  }> {
    const gates: GateResult[] = [];
    let allPassed = true;
    const record = (
      id: string,
      name: string,
      passed: boolean,
      detail?: string,
    ) => {
      gates.push({ id, name, passed, detail });
      if (!passed) allPassed = false;
    };

    // G29-A-001 — Phase 26 G26 still APPROVED
    try {
      const p26 = await new Phase26CertificationRunner().run();
      record(
        'G29-A-001',
        'Phase 26 G26 still APPROVED',
        p26.verdict === 'APPROVED',
      );
    } catch (err) {
      record(
        'G29-A-001',
        'Phase 26 G26 still APPROVED',
        false,
        (err as Error).message,
      );
    }

    // G29-A-002 — registry wires every rule
    {
      const registry = buildRegistry();
      const rules = registry.ordered();
      const criteria = new Set(rules.map((r) => r.criterion));
      const ok = rules.length === 8 && criteria.size === 8;
      record(
        'G29-A-002',
        'A11yRuleRegistry wires 8 rules across 8 WCAG criteria',
        ok,
        `rules=${rules.length} criteria=${[...criteria].sort().join(',')}`,
      );
    }

    // G29-A-003 — every seeded violation class is detected
    {
      const report = await this.auditInMemory(VIOLATING_FIXTURE);
      const found = new Set(report.findings.map((f) => f.ruleId));
      const expected = [
        'a11y/image-alt',
        'a11y/form-label',
        'a11y/interactive-keyboard',
        'a11y/focus-order',
        'a11y/document-language',
        'a11y/name-role-value',
        'a11y/target-size',
        'a11y/heading-order',
      ];
      const missing = expected.filter((id) => !found.has(id));
      record(
        'G29-A-003',
        'Static engine detects every seeded violation class',
        missing.length === 0,
        `missing=${missing.join(',') || 'none'} found=${found.size}`,
      );
    }

    // G29-A-004 — no false positive on a conformant document
    {
      const report = await this.auditInMemory(CONFORMANT_FIXTURE);
      record(
        'G29-A-004',
        'Static engine reports nothing on a conformant document',
        report.findings.length === 0,
        report.findings.map((f) => `${f.ruleId}:${f.line}`).join(',') ||
          'clean',
      );
    }

    // G29-A-005 — markup inside comments is ignored
    {
      const report = await this.auditInMemory(COMMENT_FIXTURE);
      record(
        'G29-A-005',
        'Markup written inside comments is never reported',
        report.findings.length === 0,
        report.findings.map((f) => `${f.ruleId}:${f.line}`).join(',') ||
          'clean',
      );
    }

    // G29-A-006 / G29-A-007 — real audit over both frontends
    try {
      const parser = new JsxSourceParser();
      const sink = new InMemoryA11yReportSink();
      const runner = new A11yAuditRunner(
        new SourceTreeLoader(parser),
        buildRegistry(),
        sink,
      );
      const report = await runner.audit({
        roots: FRONTEND_ROOTS,
        publish: false,
      });
      const keyFindings = report.findings.filter((f) =>
        isKeyScreenPath(f.path),
      );
      record(
        'G29-A-006',
        'Key screens carry zero findings of any severity',
        keyFindings.length === 0,
        keyFindings
          .map((f) => `${path.basename(f.path)}:${f.line} ${f.ruleId}`)
          .join(', ') || `documents=${report.documentsScanned}`,
      );
      record(
        'G29-A-007',
        `Repo-wide blocking backlog <= ratchet (${A11Y_BLOCKING_BASELINE})`,
        report.blockingCount <= A11Y_BLOCKING_BASELINE,
        `blocking=${report.blockingCount} baseline=${A11Y_BLOCKING_BASELINE}`,
      );
    } catch (err) {
      record(
        'G29-A-006',
        'Key screens carry zero findings of any severity',
        false,
        (err as Error).message,
      );
      record(
        'G29-A-007',
        'Repo-wide blocking backlog <= ratchet',
        false,
        (err as Error).message,
      );
    }

    // G29-A-008 — formatter registry + typed error
    {
      const registry = buildFormatterRegistry();
      let threw = false;
      try {
        registry.get('percent' as never);
      } catch (err) {
        threw = (err as Error).name === 'UnknownLocaleFormatKindError';
      }
      const kinds = registry.kinds();
      record(
        'G29-A-008',
        'LocaleFormatterRegistry wires 5 kinds + typed unknown-kind error',
        kinds.length === 5 && threw,
        `kinds=${kinds.join(',')} typedError=${threw}`,
      );
    }

    // G29-A-009 — currency renders per locale from integer cents
    {
      const registry = buildFormatterRegistry();
      const usd = registry.get('currency').format(123456, {
        locale: 'en-US',
        timeZone: 'UTC',
        currency: 'USD',
        rtl: false,
      });
      const eur = registry.get('currency').format(123456, {
        locale: 'de-DE',
        timeZone: 'Europe/Berlin',
        currency: 'EUR',
        rtl: false,
      });
      const jpy = registry.get('currency').format(123456, {
        locale: 'ja-JP',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
        rtl: false,
      });
      const ok =
        usd.includes('1,234.56') &&
        usd.includes('$') &&
        eur.includes('1.234,56') &&
        eur.includes('€') &&
        /1,23[45]/.test(jpy) &&
        !jpy.includes('.');
      record(
        'G29-A-009',
        'Currency renders per locale from integer cents',
        ok,
        `usd=${usd} eur=${eur} jpy=${jpy}`,
      );
    }

    // G29-A-010 — temporal formatting honours the resolved time zone
    {
      const registry = buildFormatterRegistry();
      const instant = new Date('2026-08-08T23:30:00.000Z');
      const utc = registry.get('datetime').format(instant, {
        locale: 'en-US',
        timeZone: 'UTC',
        currency: 'USD',
        rtl: false,
      });
      const tokyo = registry.get('datetime').format(instant, {
        locale: 'en-US',
        timeZone: 'Asia/Tokyo',
        currency: 'JPY',
        rtl: false,
      });
      const ok = utc !== tokyo && utc.includes('8') && tokyo.includes('9');
      record(
        'G29-A-010',
        'Temporal formatting honours the resolved time zone',
        ok,
        `utc=${utc} tokyo=${tokyo}`,
      );
    }

    // G29-A-011 — resolver ladder + wildcard refusal
    {
      const prisma = {
        tenant: {
          findUnique: async () => ({
            locale: 'de-DE',
            timezone: 'Europe/Berlin',
            currency: 'EUR',
          }),
        },
        user: {
          findUnique: async () => ({
            locale: 'fr-FR',
            timezone: 'Europe/Paris',
          }),
        },
      };
      const resolver = new TenantLocaleResolver(prisma as never);
      const policy = new LocaleFormatPolicyService(
        resolver,
        buildFormatterRegistry(),
      );

      const tenantOnly = await policy.contextFor({ tenantId: 't1' });
      const withUser = await policy.contextFor({
        tenantId: 't1',
        userId: 'u1',
      });
      const withHeader = await policy.contextFor({
        tenantId: 't1',
        userId: 'u1',
        acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8',
      });
      const withOverride = await policy.contextFor({
        tenantId: 't1',
        userId: 'u1',
        acceptLanguage: 'ja-JP',
        localeOverride: 'ar-SA',
      });

      let wildcardRejected = false;
      try {
        await policy.contextFor({ tenantId: '*' });
      } catch {
        wildcardRejected = true;
      }

      const ok =
        tenantOnly.locale === 'de-DE' &&
        tenantOnly.timeZone === 'Europe/Berlin' &&
        tenantOnly.currency === 'EUR' &&
        withUser.locale === 'fr-FR' &&
        withUser.timeZone === 'Europe/Paris' &&
        withHeader.locale === 'ja-JP' &&
        withOverride.locale === 'ar-SA' &&
        withOverride.rtl === true &&
        wildcardRejected;
      record(
        'G29-A-011',
        'TenantLocaleResolver ladder + wildcard refusal',
        ok,
        `tenant=${tenantOnly.locale} user=${withUser.locale} header=${withHeader.locale} override=${withOverride.locale} rtl=${withOverride.rtl} wildcardRejected=${wildcardRejected}`,
      );
    }

    // G29-A-012 — Accept-Language negotiation
    {
      const exact = negotiateLocale('fr-FR,fr;q=0.9');
      const partial = negotiateLocale('fr;q=0.9');
      const quality = negotiateLocale('xx-XX;q=0.9, ja-JP;q=0.8');
      const none = negotiateLocale('xx-XX');
      const ok =
        exact === 'fr-FR' &&
        partial === 'fr-FR' &&
        quality === 'ja-JP' &&
        none === null;
      record(
        'G29-A-012',
        'Accept-Language negotiation picks a supported locale',
        ok,
        `exact=${exact} partial=${partial} quality=${quality} none=${none}`,
      );
    }

    // G29-A-013 — FE primitives + shell wiring
    {
      const required: ReadonlyArray<[string, RegExp]> = [
        [
          'frontend-tenant/src/shared/a11y/SkipLink.tsx',
          /export function SkipLink/,
        ],
        [
          'frontend-tenant/src/shared/a11y/Announcer.tsx',
          /export function AnnouncerProvider/,
        ],
        [
          'frontend-tenant/src/shared/a11y/VisuallyHidden.tsx',
          /export function VisuallyHidden/,
        ],
        [
          'frontend-tenant/src/shared/a11y/audit/axe-runtime.engine.ts',
          /class AxeRuntimeEngine implements IA11yRuntimeEngine/,
        ],
        [
          'frontend-tenant/src/shared/i18n/LocaleProvider.tsx',
          /export function LocaleProvider/,
        ],
        [
          'frontend-tenant/src/shared/i18n/locale-formatter.registry.ts',
          /class LocaleFormatterRegistry/,
        ],
        ['frontend-tenant/src/components/TenantShell.tsx', /<SkipLink \/>/],
        [
          'frontend-tenant/src/components/TenantShell.tsx',
          /<LocaleProvider preferences=/,
        ],
        [
          'frontend-tenant/src/components/TenantShell.tsx',
          /id=\{MAIN_CONTENT_ID\}/,
        ],
        [
          'frontend-admin/src/shared/a11y/SkipLink.tsx',
          /export function SkipLink/,
        ],
        [
          'frontend-admin/src/shared/a11y/audit/axe-runtime.engine.ts',
          /class AxeRuntimeEngine implements IA11yRuntimeEngine/,
        ],
        [
          'frontend-admin/src/shared/i18n/LocaleProvider.tsx',
          /export function LocaleProvider/,
        ],
        ['frontend-admin/src/components/AdminShell.tsx', /<SkipLink \/>/],
        [
          'frontend-admin/src/components/AdminShell.tsx',
          /id=\{MAIN_CONTENT_ID\}/,
        ],
      ];
      const failures: string[] = [];
      for (const [relative, pattern] of required) {
        const absolute = path.join(NEURECORE_ROOT, relative);
        const source = fs.existsSync(absolute)
          ? fs.readFileSync(absolute, 'utf-8')
          : '';
        if (!pattern.test(source)) failures.push(`${relative} !~ ${pattern}`);
      }
      record(
        'G29-A-013',
        'FE a11y + locale primitives are wired into both shells',
        failures.length === 0,
        failures.join(' | ') || 'all wired',
      );
    }

    this.logger.log(
      `Phase 29 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return { verdict: allPassed ? 'APPROVED' : 'BLOCKED', gates };
  }

  private async auditInMemory(source: { path: string; source: string }) {
    const parser = new JsxSourceParser();
    const runner = new A11yAuditRunner(
      new InMemorySourceLoader(parser, [source]),
      buildRegistry(),
      new InMemoryA11yReportSink(),
    );
    return runner.audit({ roots: [], publish: false });
  }
}

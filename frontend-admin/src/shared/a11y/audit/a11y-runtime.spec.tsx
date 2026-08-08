/**
 * Phase 29 — Runtime WCAG 2.2 AA audit, admin console (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29)
 * — "Add axe-core-based audit runner to CI on the tenant + admin
 * apps."
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AxeRuntimeEngine } from './axe-runtime.engine';
import { BLOCKING_IMPACTS } from './IA11yRuntimeEngine';
import { SkipLink } from '../SkipLink';
import { VisuallyHidden } from '../VisuallyHidden';
import { AnnouncerProvider } from '../Announcer';
import { MAIN_CONTENT_ID, PRIMARY_NAV_ID } from '../landmarks';

const engine = new AxeRuntimeEngine();

async function expectNoBlockingViolations(container: Element): Promise<void> {
  const violations = await engine.analyze(container);
  const blocking = violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact));
  expect(
    blocking.map((v) => `${v.id} [${v.impact}] ${v.help} @ ${v.targets.join(', ')}`),
  ).toEqual([]);
}

describe('Phase 29 — admin runtime WCAG 2.2 AA audit', () => {
  it('admin shell landmarks have no blocking violation', async () => {
    const { container } = render(
      <AnnouncerProvider>
        <SkipLink />
        <nav id={PRIMARY_NAV_ID} aria-label="Admin console navigation">
          <a href="/overview">Overview</a>
        </nav>
        <main id={MAIN_CONTENT_ID} tabIndex={-1}>
          <h1>Command Center</h1>
          <p>Platform status</p>
        </main>
      </AnnouncerProvider>,
    );
    await expectNoBlockingViolations(container);
  }, 30_000);

  it('VisuallyHidden keeps content in the accessibility tree', async () => {
    const { container, getByText } = render(
      <main id={MAIN_CONTENT_ID}>
        <h1>
          Tenants <VisuallyHidden>across the platform</VisuallyHidden>
        </h1>
      </main>,
    );
    expect(getByText('across the platform')).toBeTruthy();
    await expectNoBlockingViolations(container);
  }, 30_000);
});

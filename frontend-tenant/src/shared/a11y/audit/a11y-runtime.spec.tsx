/**
 * Phase 29 — Runtime WCAG 2.2 AA audit (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * G29 requires "0 critical/serious violations". This suite renders
 * the shared accessibility primitives and the chat surface shared by
 * every key screen, and asserts axe-core reports no blocking WCAG
 * 2.2 A/AA violation in the *rendered* tree.
 */

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AxeRuntimeEngine } from './axe-runtime.engine';
import { BLOCKING_IMPACTS } from './IA11yRuntimeEngine';
import { SkipLink } from '../SkipLink';
import { VisuallyHidden } from '../VisuallyHidden';
import { AnnouncerProvider } from '../Announcer';
import { MAIN_CONTENT_ID } from '../landmarks';

vi.mock('@/shared/contexts/page-context', () => ({
  usePageContext: () => ({
    pageContext: {
      entityType: 'Customer',
      recordId: 'acme-1',
      selectedFields: ['name'],
      userLocale: 'en-US',
      userTimeZone: 'UTC',
      allowedActions: [],
      pagePath: '/customers/acme-1',
    },
    setPageContext: () => undefined,
    clearPageContext: () => undefined,
    setUserLocale: () => undefined,
    setUserTimeZone: () => undefined,
  }),
}));

import { ContextChips } from '@/shared/components/chat/ContextChips';

const engine = new AxeRuntimeEngine();

async function expectNoBlockingViolations(container: Element): Promise<void> {
  const violations = await engine.analyze(container);
  const blocking = violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact));
  expect(
    blocking.map((v) => `${v.id} [${v.impact}] ${v.help} @ ${v.targets.join(', ')}`),
  ).toEqual([]);
}

describe('Phase 29 — runtime WCAG 2.2 AA audit', () => {
  it('SkipLink + main landmark has no blocking violation', async () => {
    const { container } = render(
      <div>
        <SkipLink />
        <main id={MAIN_CONTENT_ID} tabIndex={-1}>
          <h1>Customers</h1>
          <p>Content</p>
        </main>
      </div>,
    );
    await expectNoBlockingViolations(container);
  }, 30_000);

  it('AnnouncerProvider live regions have no blocking violation', async () => {
    const { container } = render(
      <AnnouncerProvider>
        <main id={MAIN_CONTENT_ID}>
          <h1>Dashboard</h1>
        </main>
      </AnnouncerProvider>,
    );
    await expectNoBlockingViolations(container);
  }, 30_000);

  it('VisuallyHidden keeps content in the accessibility tree', async () => {
    const { container, getByText } = render(
      <main id={MAIN_CONTENT_ID}>
        <h1>
          Reports <VisuallyHidden>for the current tenant</VisuallyHidden>
        </h1>
      </main>,
    );
    expect(getByText('for the current tenant')).toBeTruthy();
    await expectNoBlockingViolations(container);
  }, 30_000);

  it('chat ContextChips remove buttons have accessible names', async () => {
    const { container } = render(
      <main id={MAIN_CONTENT_ID}>
        <h1>Chat</h1>
        <ContextChips />
      </main>,
    );
    await expectNoBlockingViolations(container);
  }, 30_000);
});

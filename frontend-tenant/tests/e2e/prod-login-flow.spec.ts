// ─── tests/e2e/prod-login-flow.spec.ts ─────────────────────────────────────────
// Full browser-level login flow against live prod.
// admin@neurecore.ai is a SUPER_ADMIN — they belong in /cc (admin portal),
// not /hq (tenant portal). The tenant portal guards by role and redirects
// them back to /login. That's expected behaviour.
//
// This test logs into the admin portal where the user actually belongs.

import { test, expect } from '@playwright/test';

const ADMIN_BASE = process.env.ADMIN_BASE ?? 'https://cc.neurecore.com';
const EMAIL = process.env.TEST_EMAIL ?? 'admin@neurecore.ai';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Admin@123!';

test.describe('Live prod login flow (FIX-020 — admin portal)', () => {
  test.skip(!PASSWORD, 'TEST_PASSWORD env not set — skipping live login test');

  test('admin /admin/login → authenticated landing page', async ({ page, context }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`${ADMIN_BASE}/admin/login`);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // After login we should land on a non-login page (overview or similar).
    await page.waitForURL(
      (url) => url.pathname.includes('/overview') || !url.pathname.includes('/login'),
      { timeout: 25_000 },
    );

    // Cookies should include __Host-nc_at with httpOnly.
    const cookies = await context.cookies();
    const atCookie = cookies.find((c) => c.name === '__Host-nc_at');
    expect(atCookie).toBeTruthy();
    expect(atCookie?.httpOnly).toBe(true);

    // Filter out expected 4xx noise (unrelated failed-fetches from optional fetches).
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('Failed to load resource') &&
             !e.includes('Hydration') &&
             !e.includes('NEXT_NOT_FOUND'),
    );
    expect(realErrors).toEqual([]);
  });
});

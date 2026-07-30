import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';
const PROMPT =
  'Onboard Acme Corp, prepare its Q3 return workflow and notify me when it is ready for review.';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  const email = page.locator('input[type="email"]');
  const password = page.locator('#password');
  await email.fill(EMAIL);
  await password.fill(PASSWORD);
  await expect(email).toHaveValue(EMAIL);
  await expect(password).toHaveValue(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,
  });
}

test.describe('Phase 2 production autonomous work slice', () => {
  test.skip(!EMAIL || !PASSWORD, 'TEST_EMAIL and TEST_PASSWORD are required');
  test.setTimeout(600_000);

  test('natural language pauses for approval and resumes through the UI', async ({ page }) => {
    const pageErrors: string[] = [];
    let terminalStatusBody: any;
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', async (response) => {
      if (
        response.request().method() === 'GET'
        && response.url().includes('/hermes-adapter/executions/')
        && response.ok()
      ) {
        const body = await response.json().catch(() => undefined);
        const state = body?.data ?? body;
        if (state?.status === 'COMPLETED') terminalStatusBody = state;
      }
    });

    await login(page);
    await page.goto('/home');
    await page.getByRole('button', { name: /toggle conversation panel/i }).click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    const chatResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/v1/chat/messages'),
      { timeout: 180_000 },
    );
    await page.getByTestId('chat-input').fill(PROMPT);
    await page.getByTestId('chat-submit').click();

    const response = await chatResponse;
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    let execution = body?.data?.autonomousExecution ?? body?.autonomousExecution;
    expect(execution?.executionId).toMatch(/-autonomous$/);
    expect(execution?.status).toBe('WAITING_APPROVAL');
    expect(execution?.pendingApproval?.toolName).toMatch(/^nc\./);

    const card = page.getByTestId('autonomous-approval-card');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: 'test-results/phase2-approval-pending.png',
      fullPage: true,
    });

    let approvalCount = 0;
    let currentTool = execution.pendingApproval.toolName as string;
    while (true) {
      await expect(card).toContainText(currentTool);
      const approvalResponse = page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' &&
          candidate.url().includes(`/hermes-adapter/executions/${execution.executionId}/approvals/`),
        { timeout: 180_000 },
      );
      await card.getByRole('button', { name: /^approve$/i }).click();
      const approvalResult = await approvalResponse;
      expect(approvalResult.ok()).toBeTruthy();
      approvalCount += 1;
      expect(approvalCount).toBeLessThanOrEqual(5);
      await expect.poll(async () => {
        const text = await card.textContent();
        if (text?.includes('Approved and resumed')) return 'done';
        const tool = await card.locator('.break-words').textContent();
        return tool && tool !== currentTool ? 'next' : 'waiting';
      }, { timeout: 180_000 }).not.toBe('waiting');
      const text = await card.textContent();
      if (text?.includes('Approved and resumed')) break;
      currentTool = (await card.locator('.break-words').textContent()) ?? '';
      expect(currentTool).toMatch(/^nc\./);
    }
    await expect(card).toContainText('Approved and resumed', { timeout: 15_000 });
    await expect.poll(() => terminalStatusBody?.status, { timeout: 15_000 }).toBe('COMPLETED');
    const toolStarts = (terminalStatusBody.events ?? [])
      .filter((event: any) => event.type === 'tool.start')
      .map((event: any) => event.payload?.toolName);
    expect(toolStarts.filter((name: string) => name === 'nc.create_goal').length).toBeGreaterThanOrEqual(2);
    expect(toolStarts).toEqual(expect.arrayContaining([
      'nc.create_task',
      'nc.assign_task',
      'nc.submit_for_approval',
      'nc.send_notification',
    ]));
    await page.screenshot({
      path: 'test-results/phase2-approval-resumed.png',
      fullPage: true,
    });

    expect(pageErrors).toEqual([]);
  });
});

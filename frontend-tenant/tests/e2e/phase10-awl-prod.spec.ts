import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const TENANT_BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'https://hq.neurecore.com';
const EMAIL = process.env.TEST_EMAIL ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

interface ProjectListItem {
  id: string;
  name: string;
  initiationId?: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  initiationId?: string | null;
}

async function login(page: Page): Promise<void> {
  await page.goto(`${TENANT_BASE}/login`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/v1/auth/login'),
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /sign in/i }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok()).toBeTruthy();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,
  });
}

function unwrap<T>(raw: any): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return raw.data as T;
  }
  return raw as T;
}

async function findProjectWithInitiation(
  request: APIRequestContext,
): Promise<ProjectDetail> {
  const listResponse = await request.get(`${TENANT_BASE}/api/v1/projects?limit=50`);
  expect(listResponse.ok()).toBeTruthy();
  const listBody = await listResponse.json();
  const listData = unwrap<{ items?: ProjectListItem[] } | ProjectListItem[]>(
    listBody,
  );
  const items = Array.isArray(listData)
    ? listData
    : Array.isArray(listData?.items)
    ? listData.items
    : [];

  for (const project of items) {
    if (project.initiationId) {
      return {
        id: project.id,
        name: project.name,
        initiationId: project.initiationId,
      };
    }

    try {
      const detailResponse = await request.get(
        `${TENANT_BASE}/api/v1/projects/${project.id}`,
      );
      if (!detailResponse.ok()) continue;
      const detailBody = await detailResponse.json();
      const detail = unwrap<ProjectDetail>(detailBody);
      if (detail?.initiationId) {
        return detail;
      }
    } catch {
      // Production verification should keep scanning if one project
      // detail request is transiently reset by the server.
      continue;
    }
  }

  throw new Error(
    'No production project with initiationId was found for tenant alipiracha@live.com',
  );
}

test.describe('Phase 10 live tenant verification — AWL capabilities', () => {
  test.skip(!EMAIL || !PASSWORD, 'TEST_EMAIL and TEST_PASSWORD are required');
  test.setTimeout(180_000);

  test('3.1.3 and 3.1.4 are tenant-usable on hq.neurecore.com', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await login(page);

    const request = page.context().request;
    const project = await findProjectWithInitiation(request);

    await page.goto(`${TENANT_BASE}/projects/${project.id}`);
    await expect(
      page.getByRole('heading', { name: new RegExp(project.name, 'i') }),
    ).toBeVisible({ timeout: 20_000 });

    // 3.1.3 Transactional Outbox — tenant-visible effect is the automation surface.
    await expect(page.getByLabelText(/project automation status/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabelText(/task board/i)).toBeVisible();
    await expect(page.getByText(/automation/i)).toBeVisible();

    // 3.1.4 Enterprise Initiation Module — production route must be reachable from the project.
    const initiationLink = page.getByRole('link', { name: /view initiation/i });
    await expect(initiationLink).toBeVisible({ timeout: 15_000 });
    const href = await initiationLink.getAttribute('href');
    expect(href).toBe(`/initiations/${project.initiationId}`);

    await initiationLink.click();
    await page.waitForURL(
      (url) => url.pathname === `/initiations/${project.initiationId}`,
      { timeout: 20_000 },
    );
    await expect(
      page.getByRole('heading', { name: /enterprise initiation/i }),
    ).toBeVisible();
    await expect(page.getByText(/history/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /view project/i })).toBeVisible();

    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('Failed to load resource') &&
        !e.includes('Hydration') &&
        !e.includes('NEXT_NOT_FOUND'),
    );
    expect(realErrors).toEqual([]);
  });
});

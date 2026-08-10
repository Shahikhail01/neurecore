import { test, expect, type Page } from '@playwright/test';

const AUTH_USER = {
  id: 'user-1',
  email: 'owner@alipiracha.com',
  firstName: 'Ali',
  lastName: 'Piracha',
  role: 'OWNER',
  tenantId: 'tenant-1',
  isActive: true,
};

const META = {
  timestamp: '2026-08-09T12:00:00.000Z',
  requestId: 'phase10-browser-pass',
};

async function bootstrapAuthenticatedTenant(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user,
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
    document.cookie = '__Host-nc_csrf=test-csrf; path=/; Secure';
  }, AUTH_USER);
}

async function mockAuth(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: AUTH_USER,
        meta: META,
      }),
    });
  });
}

test.describe('Phase 10 browser pass — capabilities 3.1.3 and 3.1.4', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapAuthenticatedTenant(page);
    await mockAuth(page);
  });

  test('3.1.4 Enterprise Initiation Module renders the initiation route in-browser', async ({
    page,
  }) => {
    await page.route('**/api/v1/enterprise-initiation/init-1/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            initiationId: 'init-1',
            status: 'APPROVED',
            projectId: 'proj-1',
            projectStatus: 'ACTIVE',
            automationStatus: 'REQUESTED_OR_COMPLETED',
            approvedAt: '2026-08-09T12:10:00.000Z',
            updatedAt: '2026-08-09T12:11:00.000Z',
            correlationId: 'corr-init-1',
          },
          meta: META,
        }),
      });
    });

    await page.route('**/api/v1/timeline/Initiation/init-1**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            {
              id: 'evt-init-1',
              tenantId: 'tenant-1',
              entityType: 'Initiation',
              entityId: 'init-1',
              eventType: 'InitiationApproved',
              title: 'Initiation approved',
              description: 'Ali approved the initiation for project materialization.',
              actorType: 'HUMAN',
              actorId: 'user-1',
              actorName: 'Ali Piracha',
              severity: 'LOW',
              correlationId: 'corr-init-1',
              occurredAt: '2026-08-09T12:10:00.000Z',
              metadata: {},
            },
          ],
          meta: META,
        }),
      });
    });

    await page.goto('/initiations/init-1');

    await expect(
      page.getByRole('heading', { name: /enterprise initiation/i }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /approved/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view project/i })).toHaveAttribute(
      'href',
      '/projects/proj-1',
    );
    await expect(page.getByText(/approved at/i)).toBeVisible();
    await expect(page.getByTestId('timeline-event')).toHaveCount(1);
    await expect(page.getByTestId('timeline-transport')).toBeVisible();
  });

  test('3.1.3 Transactional Outbox surfaces automation progress in the project workspace', async ({
    page,
  }) => {
    await page.route('**/api/v1/projects/proj-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            id: 'proj-1',
            tenantId: 'tenant-1',
            name: 'Accounting Close Automation',
            description: 'Phase 10 browser verification project',
            status: 'ACTIVE',
            customerId: 'cust-1',
            customer: { id: 'cust-1', name: 'Alipiracha Accounting' },
            initiationId: 'init-1',
            projectTypeId: null,
            projectTypeVersion: null,
            budgetType: null,
            budgetAmount: null,
            budgetCurrency: null,
            priority: 'HIGH',
            tags: [],
            targetDate: null,
            startDate: null,
            completedAt: null,
            lostReason: null,
            parentProjectId: null,
            clonedFromProjectId: null,
            goalIds: [],
            customFieldValues: null,
            createdAt: '2026-08-09T11:00:00.000Z',
            updatedAt: '2026-08-09T12:00:00.000Z',
          },
          meta: META,
        }),
      });
    });

    await page.route('**/api/v1/project-automation/proj-1/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            projectId: 'proj-1',
            tenantId: 'tenant-1',
            canonical: 'PROCESSING',
            lastLog: {
              id: 'log-1',
              event: 'AutomationStarted',
              status: 'COMPLETED',
              error: null,
              triggeredBy: 'system',
              createdAt: '2026-08-09T12:01:00.000Z',
            },
            progress: {
              goalsCreated: 2,
              tasksCreated: 6,
              assignmentsCreated: 4,
            },
            tasks: [
              {
                id: 'task-1',
                title: 'Collect close checklist',
                status: 'READY',
                priority: 'HIGH',
                templateKey: 'close-checklist',
                agentId: null,
                updatedAt: '2026-08-09T12:02:00.000Z',
              },
            ],
            history: [
              {
                id: 'log-1',
                event: 'AutomationStarted',
                status: 'COMPLETED',
                triggeredBy: 'system',
                error: null,
                createdAt: '2026-08-09T12:01:00.000Z',
              },
            ],
          },
          meta: META,
        }),
      });
    });

    await page.route('**/api/v1/timeline/Project/proj-1**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            {
              id: 'evt-proj-1',
              tenantId: 'tenant-1',
              entityType: 'Project',
              entityId: 'proj-1',
              eventType: 'AutomationStarted',
              title: 'Automation started',
              description: 'The outbox worker picked up project automation.',
              actorType: 'SYSTEM',
              actorId: 'system',
              actorName: 'System',
              severity: 'LOW',
              correlationId: 'corr-proj-1',
              occurredAt: '2026-08-09T12:01:00.000Z',
              metadata: {},
            },
          ],
          meta: META,
        }),
      });
    });

    await page.goto('/projects/proj-1');

    await expect(
      page.getByRole('heading', { name: /accounting close automation/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /view initiation/i })).toHaveAttribute(
      'href',
      '/initiations/init-1',
    );
    await expect(page.getByLabel(/project automation status/i)).toBeVisible();
    await expect(page.getByText(/processing/i)).toBeVisible();
    await expect(page.getByText('2')).toBeVisible();
    await expect(page.getByText('6')).toBeVisible();
    await expect(page.getByText('4')).toBeVisible();
    await expect(page.getByLabel(/task board/i)).toBeVisible();
    await expect(page.getByTestId('task-card-task-1')).toBeVisible();
    await expect(page.getByText(/collect close checklist/i)).toBeVisible();
    await expect(page.getByTestId('timeline-event')).toHaveCount(1);
  });
});

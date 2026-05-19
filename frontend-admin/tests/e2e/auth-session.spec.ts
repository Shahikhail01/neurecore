import { expect, test } from "@playwright/test";

const adminEmail = process.env.SUPERADMIN_EMAIL ?? "noreply@neurecore.ai";
const adminPassword = process.env.SUPERADMIN_PASSWORD ?? "Admin@2026!";
const hydrationDelayMs = process.env.CI ? 5_000 : 3_000;

async function waitForLoginForm(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  await page.waitForTimeout(hydrationDelayMs);
}

async function login(page: Parameters<typeof test>[0]["page"]) {
  await waitForLoginForm(page);
  await page.getByPlaceholder("Enter your email").fill(adminEmail);
  await page.getByPlaceholder("Enter your password").fill(adminPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: /Welcome back,/ }),
  ).toBeVisible();
}

test.describe("admin auth session", () => {
  test("logs in, refreshes on expired access token, and clears session on logout", async ({
    page,
  }) => {
    await login(page);

    const initialSession = await page.evaluate(() => ({
      accessToken: window.localStorage.getItem("admin_accessToken"),
      refreshToken: window.localStorage.getItem("admin_refreshToken"),
    }));

    expect(initialSession.accessToken).toBeTruthy();
    expect(initialSession.refreshToken).toBeTruthy();

    await page.evaluate(() => {
      window.localStorage.setItem("admin_accessToken", "invalid.test.token");
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(hydrationDelayMs);
    await page.waitForURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Welcome back,/ }),
    ).toBeVisible();

    const refreshedSession = await page.evaluate(() => ({
      accessToken: window.localStorage.getItem("admin_accessToken"),
      refreshToken: window.localStorage.getItem("admin_refreshToken"),
    }));

    expect(refreshedSession.accessToken).toBeTruthy();
    expect(refreshedSession.accessToken).not.toBe("invalid.test.token");
    expect(refreshedSession.refreshToken).toBeTruthy();

    await page.locator(".ant-dropdown-trigger").click();
    await page.getByText("Logout", { exact: true }).click();
    await page.waitForURL(/\/login/);

    const clearedSession = await page.evaluate(() => ({
      accessToken: window.localStorage.getItem("admin_accessToken"),
      refreshToken: window.localStorage.getItem("admin_refreshToken"),
      user: window.localStorage.getItem("user"),
    }));

    expect(clearedSession.accessToken).toBeNull();
    expect(clearedSession.refreshToken).toBeNull();
    expect(clearedSession.user).toBeNull();
  });
});
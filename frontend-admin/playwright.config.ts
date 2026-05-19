import { defineConfig, devices } from "@playwright/test";

const backendEnv = {
  NODE_ENV: "test",
  PORT: process.env.PORT ?? "3000",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/neurecore_e2e?schema=public",
  DATABASE_URL_UNPOOLED:
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/neurecore_e2e?schema=public",
  REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  JWT_SECRET:
    process.env.JWT_SECRET ?? "neurecore-auth-e2e-secret-min-32-chars",
  SUPERADMIN_EMAIL:
    process.env.SUPERADMIN_EMAIL ?? "noreply@neurecore.ai",
  SUPERADMIN_PASSWORD:
    process.env.SUPERADMIN_PASSWORD ?? "Admin@2026!",
  OPENCLAW_API_KEY:
    process.env.OPENCLAW_API_KEY ?? "e2e-openclaw-placeholder",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "e2e-openai-placeholder",
  MINIMAX_API_KEY:
    process.env.MINIMAX_API_KEY ?? "e2e-minimax-placeholder",
  DEEPSEEK_API_KEY:
    process.env.DEEPSEEK_API_KEY ?? "e2e-deepseek-placeholder",
  MIMO_API_KEY: process.env.MIMO_API_KEY ?? "e2e-mimo-placeholder",
};

const frontendEnv = {
  NODE_ENV: "test",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3000/api/v1",
};

const webServers = process.env.PLAYWRIGHT_SKIP_WEBSERVER
  ? undefined
  : [
      {
        command:
          "bash ../backend/scripts/prepare-auth-e2e.sh && pnpm --dir ../backend start",
        url: "http://127.0.0.1:3000/api/v1/auth/health",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: backendEnv,
      },
      {
        command: "pnpm dev",
        url: "http://127.0.0.1:3002/login",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: frontendEnv,
      },
    ];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results",
  webServer: webServers,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
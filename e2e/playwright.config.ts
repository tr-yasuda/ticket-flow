import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @ticket-flow/api dev",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: "file:./prisma/e2e-test.db",
        JWT_SECRET: "test-jwt-secret-for-e2e-tests-only-minimum-32-bytes",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
        PORT: "3000",
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120 * 1000,
    },
    {
      command: "pnpm --filter @ticket-flow/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_BASE_URL: "/api",
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60 * 1000,
    },
  ],
});

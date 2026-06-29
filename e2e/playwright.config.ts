import { randomBytes } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

const E2E_API_PORT = Number(process.env.E2E_API_PORT ?? "3000");
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT ?? "5173");
const E2E_API_URL =
  process.env.E2E_API_URL ?? `http://localhost:${E2E_API_PORT}`;
const E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? `http://localhost:${E2E_WEB_PORT}`;

// SQLite を使うため workers=1・fullyParallel=false で順次実行し、テスト間で DB 状態が混在しないようにしている。
// E2E 用 DB のクリーンアップは `test:e2e` / `test:e2e:ui` スクリプトで Playwright 起動前に実施する。
export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { outputFolder: "../playwright-report" }]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: process.env.CI ? "off" : "on-first-retry",
    screenshot: process.env.CI ? "off" : "only-on-failure",
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
      url: `${E2E_API_URL}/api/health`,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: "file:./e2e-test.db",
        JWT_SECRET:
          process.env.E2E_JWT_SECRET ?? randomBytes(32).toString("hex"),
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
        PORT: String(E2E_API_PORT),
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120 * 1000,
    },
    {
      command: `pnpm --filter @ticket-flow/web dev --port ${E2E_WEB_PORT} --strictPort`,
      url: E2E_BASE_URL,
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL: "/api",
        E2E_API_PORT: String(E2E_API_PORT),
        E2E_WEB_PORT: String(E2E_WEB_PORT),
        VITE_API_PROXY_TARGET: E2E_API_URL,
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60 * 1000,
    },
  ],
});

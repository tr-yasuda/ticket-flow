import type { Page } from "@playwright/test";

export const DEMO_USER = {
  email: "demo@example.com",
  password: "demo1234",
} as const;

export const DEMO_ORGANIZATION = {
  id: "demo-organization-001",
  slug: "demo-organization",
} as const;

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(DEMO_USER.email);
  await page.getByTestId("login-password").fill(DEMO_USER.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("/app");
}

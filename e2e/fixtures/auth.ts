import { expect, type Page } from "@playwright/test";

import { DEMO_USER } from "./demo-credentials.js";

export async function loginAsDemoUser(page: Page): Promise<void> {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "メールアドレス" })
    .fill(DEMO_USER.email);
  await page
    .getByRole("textbox", { name: "パスワード" })
    .fill(DEMO_USER.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("/app");
  await expect(
    page.getByRole("heading", { name: "アプリトップ" }),
  ).toBeVisible();
}

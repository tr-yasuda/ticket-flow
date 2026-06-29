import { expect, test } from "@playwright/test";

import { login } from "../fixtures/auth.js";

test("ログイン後、アプリトップが表示される", async ({ page }) => {
  await login(page);

  await expect(
    page.getByRole("heading", { name: "アプリトップ" }),
  ).toBeVisible();
});

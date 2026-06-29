import { expect, test } from "@playwright/test";

import { loginAsDemoUser } from "../fixtures/auth.js";

test("ログイン後、アプリトップが表示される", async ({ page }) => {
  await loginAsDemoUser(page);

  await expect(
    page.getByRole("heading", { name: "アプリトップ" }),
  ).toBeVisible();
});

import { expect, test } from "@playwright/test";

import { DEMO_ORGANIZATION, login } from "../fixtures/auth.js";

test("ログイン後、チケット一覧が表示される", async ({ page }) => {
  await login(page);

  await page.goto(`/app/${DEMO_ORGANIZATION.id}/tickets`);

  await expect(page.getByRole("heading", { name: "チケット" })).toBeVisible();
  await expect(page.getByTestId("organization-id")).toHaveText(
    DEMO_ORGANIZATION.id,
  );
  await expect(
    page.getByRole("cell", { name: "ログイン画面の UI 改善" }),
  ).toBeVisible();
});

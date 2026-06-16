import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../../../src/domain/password";

describe("パスワードハッシュ化", () => {
  it("正しいパスワードで検証が成功する", async () => {
    const plainPassword = "correct-password";
    const hashedPassword = await hashPassword(plainPassword);

    const isValid = await verifyPassword(plainPassword, hashedPassword);

    expect(isValid).toBe(true);
  });

  it("誤ったパスワードで検証が失敗する", async () => {
    const plainPassword = "correct-password";
    const hashedPassword = await hashPassword(plainPassword);

    const isValid = await verifyPassword("wrong-password", hashedPassword);

    expect(isValid).toBe(false);
  });

  it("ハッシュ値は平文パスワードと異なる", async () => {
    const plainPassword = "my-secret-password";

    const hashedPassword = await hashPassword(plainPassword);

    expect(hashedPassword).not.toBe(plainPassword);
  });
});

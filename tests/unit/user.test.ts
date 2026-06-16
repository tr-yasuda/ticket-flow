import { describe, expect, it } from "vitest";

import { createUser } from "../../src/domain/user";

describe("ユーザー登録", () => {
  it("有効なメールアドレスでユーザーが作成できる", () => {
    const user = createUser("user@example.com");
    expect(user.email).toBe("user@example.com");
  });

  it("無効なメールアドレスではエラーになる", () => {
    expect(() => createUser("invalid-email")).toThrow("Invalid email address");
  });

  it("末尾に改行があるメールアドレスは拒否される", () => {
    expect(() => createUser("user@example.com\n")).toThrow(
      "Invalid email address",
    );
  });

  it("前後に空白があるメールアドレスは拒否される", () => {
    expect(() => createUser("  user@example.com  ")).toThrow(
      "Invalid email address",
    );
  });

  it.each([
    ["タブと改行", "\tuser@example.com\n"],
    ["全角スペース", "　user@example.com　"],
    ["末尾タブ", "user@example.com\t"],
    ["末尾半角スペース", "user@example.com "],
  ])("%s を含むメールアドレスは拒否される", (_label, input) => {
    expect(() => createUser(input)).toThrow("Invalid email address");
  });
});

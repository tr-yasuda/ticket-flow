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

  it("前後に空白があるメールアドレスはトリムされてユーザーが作成できる", () => {
    const user = createUser("  user@example.com  ");
    expect(user.email).toBe("user@example.com");
  });
});

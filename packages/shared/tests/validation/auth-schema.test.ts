import { describe, expect, it } from "vitest";

import {
  emailSchema,
  loginInputSchema,
  passwordSchema,
  registerInputSchema,
} from "../../src/validation/auth-schema.js";

describe("emailSchema", () => {
  it("有効なメールアドレスを受け入れる", () => {
    const result = emailSchema.safeParse("user@example.com");
    expect(result.success).toBe(true);
  });

  it("空のメールアドレスを拒否する", () => {
    const result = emailSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "メールアドレスを入力してください",
      );
    }
  });

  it("不正な形式のメールアドレスを拒否する", () => {
    const result = emailSchema.safeParse("invalid");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "メールアドレスの形式が正しくありません",
      );
    }
  });
});

describe("passwordSchema", () => {
  it("8バイトのパスワードを受け入れる", () => {
    const result = passwordSchema.safeParse("password");
    expect(result.success).toBe(true);
  });

  it("空のパスワードを拒否する", () => {
    const result = passwordSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "パスワードを入力してください",
      );
    }
  });

  it("8バイト未満のパスワードを拒否する", () => {
    const result = passwordSchema.safeParse("short");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "パスワードは8バイト以上で入力してください",
      );
    }
  });

  it("72バイトを超えるパスワードを拒否する", () => {
    const result = passwordSchema.safeParse("a".repeat(73));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "パスワードは72バイト以内で入力してください",
      );
    }
  });
});

describe("loginInputSchema", () => {
  it("有効な入力を受け入れる", () => {
    const result = loginInputSchema.safeParse({
      email: "user@example.com",
      password: "password",
    });
    expect(result.success).toBe(true);
  });

  it("無効な入力を拒否する", () => {
    const result = loginInputSchema.safeParse({
      email: "",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("registerInputSchema", () => {
  it("有効な入力を受け入れる", () => {
    const result = registerInputSchema.safeParse({
      email: "user@example.com",
      password: "password",
    });
    expect(result.success).toBe(true);
  });
});

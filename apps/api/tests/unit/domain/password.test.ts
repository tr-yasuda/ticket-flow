import { describe, expect, it } from "vitest";

import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "../../../src/domain/password";

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

  it("72バイトを超える ASCII パスワードはハッシュ化できない", async () => {
    const plainPassword = "a".repeat(73);

    await expect(hashPassword(plainPassword)).rejects.toThrow(
      "Password must be 72 bytes or fewer",
    );
  });

  it("72バイトを超えるマルチバイト文字のパスワードはハッシュ化できない", async () => {
    // "あ" は UTF-8 で 3 バイトなので、25 文字で 75 バイト
    const plainPassword = "あ".repeat(25);

    await expect(hashPassword(plainPassword)).rejects.toThrow(
      "Password must be 72 bytes or fewer",
    );
  });

  it("ハッシュ形式が不正な場合は検証が失敗する", async () => {
    const isValid = await verifyPassword("correct-password", "invalid-hash");

    expect(isValid).toBe(false);
  });

  it("コストが不正な bcrypt 形式のハッシュは検証が失敗する", async () => {
    // bcrypt のコスト係数は 04–31 が有効。32 は無効。
    const invalidCostHash =
      "$2b$32$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW";

    const isValid = await verifyPassword("correct-password", invalidCostHash);

    expect(isValid).toBe(false);
  });

  it("72バイトを超えるパスワードは検証が失敗する", async () => {
    const longPassword = "a".repeat(73);
    const hashedPassword = await hashPassword("correct-password");

    const isValid = await verifyPassword(longPassword, hashedPassword);

    expect(isValid).toBe(false);
  });
});

describe("パスワード検証", () => {
  it("8バイト以上72バイト以下のパスワードは有効", () => {
    const result = validatePassword("password");

    expect(result.valid).toBe(true);
  });

  it("7バイト以下のパスワードは無効", () => {
    const result = validatePassword("passwor");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Password must be at least 8 bytes");
  });

  it("72バイトを超えるパスワードは無効", () => {
    const result = validatePassword("a".repeat(73));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Password must be 72 bytes or fewer");
  });
});

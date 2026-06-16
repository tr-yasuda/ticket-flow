import { describe, expect, it } from "vitest";

import { createUser, validateEmail } from "../../../src/domain/user";

describe("メールアドレス検証", () => {
  it("有効なメールアドレスは小文字に正規化されて返される", () => {
    const email = validateEmail("USER@EXAMPLE.COM");

    expect(email).toBe("user@example.com");
  });

  it("無効なメールアドレスはエラーになる", () => {
    expect(() => validateEmail("invalid-email")).toThrow(
      "Invalid email address",
    );
  });

  it("末尾に改行があるメールアドレスは拒否される", () => {
    expect(() => validateEmail("user@example.com\n")).toThrow(
      "Invalid email address",
    );
  });

  it("前後に空白があるメールアドレスは拒否される", () => {
    expect(() => validateEmail("  user@example.com  ")).toThrow(
      "Invalid email address",
    );
  });

  it.each([
    ["タブと改行", "\tuser@example.com\n"],
    ["全角スペース", "　user@example.com　"],
    ["末尾タブ", "user@example.com\t"],
    ["末尾半角スペース", "user@example.com "],
  ])("%s を含むメールアドレスは拒否される", (_label, input) => {
    expect(() => validateEmail(input)).toThrow("Invalid email address");
  });
});

describe("ユーザー登録", () => {
  it("有効なメールアドレスとパスワードハッシュでユーザーが作成できる", () => {
    const user = createUser("user@example.com", "hashed-password");

    expect(user.email).toBe("user@example.com");
    expect(user.passwordHash).toBe("hashed-password");
    expect(typeof user.id).toBe("string");
    expect(user.id).not.toBe("");
  });

  it("無効なメールアドレスではエラーになる", () => {
    expect(() => createUser("invalid-email", "hashed-password")).toThrow(
      "Invalid email address",
    );
  });

  it("末尾に改行があるメールアドレスは拒否される", () => {
    expect(() => createUser("user@example.com\n", "hashed-password")).toThrow(
      "Invalid email address",
    );
  });

  it("前後に空白があるメールアドレスは拒否される", () => {
    expect(() => createUser("  user@example.com  ", "hashed-password")).toThrow(
      "Invalid email address",
    );
  });

  it("大文字のメールアドレスは小文字に正規化される", () => {
    const user = createUser("USER@EXAMPLE.COM", "hashed-password");

    expect(user.email).toBe("user@example.com");
  });

  it("大文字小文字が異なる同一メールアドレスは同じ email 値に正規化される", () => {
    const upperCaseUser = createUser("USER@EXAMPLE.COM", "hashed-password");
    const lowerCaseUser = createUser("user@example.com", "hashed-password");
    const mixedCaseUser = createUser("User@Example.Com", "hashed-password");

    expect(upperCaseUser.email).toBe(lowerCaseUser.email);
    expect(mixedCaseUser.email).toBe(lowerCaseUser.email);
  });

  it.each([
    ["タブと改行", "\tuser@example.com\n"],
    ["全角スペース", "　user@example.com　"],
    ["末尾タブ", "user@example.com\t"],
    ["末尾半角スペース", "user@example.com "],
  ])("%s を含むメールアドレスは拒否される", (_label, input) => {
    expect(() => createUser(input, "hashed-password")).toThrow(
      "Invalid email address",
    );
  });
});

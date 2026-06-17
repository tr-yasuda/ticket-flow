import { describe, expect, it, vi } from "vitest";

import { loginUser } from "../../../src/application/login-user";
import { createUser } from "../../../src/domain/user";
import type { UserRepository } from "../../../src/domain/user-repository";
import { InMemoryUserRepository } from "../../../src/infrastructure/database/in-memory-user-repository";

function createTestDependencies(overrides?: {
  repository?: UserRepository;
  verifyPassword?: (
    plainPassword: string,
    hashedPassword: string,
  ) => Promise<boolean>;
  generateAccessToken?: (userId: string) => Promise<string>;
  generateRefreshToken?: (userId: string) => Promise<string>;
}) {
  const repository = overrides?.repository ?? new InMemoryUserRepository();
  return {
    userRepository: repository,
    verifyPassword: overrides?.verifyPassword ?? (async () => true),
    generateAccessToken:
      overrides?.generateAccessToken ?? (async () => "access-token"),
    generateRefreshToken:
      overrides?.generateRefreshToken ?? (async () => "refresh-token"),
  };
}

describe("ユーザーログイン", () => {
  it("有効なメールアドレスとパスワードでログインできる", async () => {
    const repository = new InMemoryUserRepository();
    await repository.save(createUser("user@example.com", "hashed-password"));
    const deps = createTestDependencies({ repository });

    const result = await loginUser(
      { email: "user@example.com", password: "password" },
      deps,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.user.email).toBe("user@example.com");
    expect(result.data.user.passwordHash).toBe("hashed-password");
    expect(result.data.accessToken).toBe("access-token");
    expect(result.data.refreshToken).toBe("refresh-token");
  });

  it("無効なメールアドレスではログインに失敗する", async () => {
    const deps = createTestDependencies();

    const result = await loginUser(
      { email: "invalid-email", password: "password" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-email");
  });

  it("存在しないメールアドレスでは認証に失敗する", async () => {
    const deps = createTestDependencies();

    const result = await loginUser(
      { email: "unknown@example.com", password: "password" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("authentication-failed");
  });

  it("誤ったパスワードでは認証に失敗する", async () => {
    const repository = new InMemoryUserRepository();
    await repository.save(createUser("user@example.com", "hashed-password"));
    const deps = createTestDependencies({
      repository,
      verifyPassword: async () => false,
    });

    const result = await loginUser(
      { email: "user@example.com", password: "wrong-password" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("authentication-failed");
  });

  it("大文字小文字が異なるメールアドレスでもログインできる", async () => {
    const repository = new InMemoryUserRepository();
    await repository.save(createUser("user@example.com", "hashed-password"));
    const deps = createTestDependencies({ repository });

    const result = await loginUser(
      { email: "USER@EXAMPLE.COM", password: "password" },
      deps,
    );

    expect(result.success).toBe(true);
  });

  it("認証失敗時のメッセージはメールアドレスの存在有無を区別しない", async () => {
    const repository = new InMemoryUserRepository();
    await repository.save(createUser("user@example.com", "hashed-password"));
    const depsMissing = createTestDependencies({ repository });
    const depsWrong = createTestDependencies({
      repository,
      verifyPassword: async () => false,
    });

    const missingResult = await loginUser(
      { email: "unknown@example.com", password: "password" },
      depsMissing,
    );
    const wrongResult = await loginUser(
      { email: "user@example.com", password: "wrong-password" },
      depsWrong,
    );

    expect(missingResult.success).toBe(false);
    expect(wrongResult.success).toBe(false);
    if (missingResult.success || wrongResult.success) return;
    expect(missingResult.error.message).toBe(wrongResult.error.message);
  });

  it("無効なメールアドレスではパスワード検証が実行されない", async () => {
    const verifyPassword = vi.fn(async () => true);
    const deps = createTestDependencies({ verifyPassword });

    await loginUser({ email: "invalid-email", password: "password" }, deps);

    expect(verifyPassword).not.toHaveBeenCalled();
  });
});

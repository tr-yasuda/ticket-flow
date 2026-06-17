import { describe, expect, it, vi } from "vitest";

import { registerUser } from "../../../src/application/register-user";
import { hashRefreshToken } from "../../../src/domain/refresh-token";
import type { RefreshTokenRepository } from "../../../src/domain/refresh-token-repository";
import { DuplicateEmailError } from "../../../src/domain/repository-error";
import type { UserRepository } from "../../../src/domain/user-repository";
import { InMemoryRefreshTokenRepository } from "../../../src/infrastructure/database/in-memory-refresh-token-repository";
import { InMemoryUserRepository } from "../../../src/infrastructure/database/in-memory-user-repository";

function createTestDependencies(overrides?: {
  repository?: UserRepository;
  refreshTokenRepository?: RefreshTokenRepository;
  hashPassword?: (password: string) => Promise<string>;
  generateAccessToken?: (userId: string) => Promise<string>;
  generateRefreshToken?: (userId: string) => Promise<string>;
  hashRefreshToken?: (token: string) => string;
}) {
  const repository = overrides?.repository ?? new InMemoryUserRepository();
  return {
    userRepository: repository,
    refreshTokenRepository:
      overrides?.refreshTokenRepository ?? new InMemoryRefreshTokenRepository(),
    hashPassword: overrides?.hashPassword ?? (async () => "hashed-password"),
    generateAccessToken:
      overrides?.generateAccessToken ?? (async () => "access-token"),
    generateRefreshToken:
      overrides?.generateRefreshToken ?? (async () => "refresh-token"),
    hashRefreshToken: overrides?.hashRefreshToken ?? hashRefreshToken,
  };
}

describe("ユーザー登録ユースケース", () => {
  it("有効なメールアドレスとパスワードでユーザーが登録できる", async () => {
    const refreshTokenRepository = new InMemoryRefreshTokenRepository();
    const deps = createTestDependencies({ refreshTokenRepository });

    const result = await registerUser(
      { email: "user@example.com", password: "password" },
      deps,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.user.email).toBe("user@example.com");
    expect(result.data.user.passwordHash).toBe("hashed-password");
    expect(result.data.accessToken).toBe("access-token");
    expect(result.data.refreshToken).toBe("refresh-token");

    const storedToken = await refreshTokenRepository.findByTokenHash(
      hashRefreshToken(result.data.refreshToken),
    );
    expect(storedToken).not.toBeNull();
    expect(storedToken?.userId).toBe(result.data.user.id);
  });

  it("無効なメールアドレスでは登録に失敗する", async () => {
    const deps = createTestDependencies();

    const result = await registerUser(
      { email: "invalid-email", password: "password" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-email");
  });

  it("8バイト未満のパスワードでは登録に失敗する", async () => {
    const deps = createTestDependencies();

    const result = await registerUser(
      { email: "user@example.com", password: "short" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-password");
  });

  it("既存のメールアドレスでは登録に失敗する", async () => {
    const repository = new InMemoryUserRepository();
    await repository.save({
      id: "existing-id",
      email: "user@example.com",
      passwordHash: "existing-hash",
    });
    const deps = createTestDependencies({ repository });

    const result = await registerUser(
      { email: "user@example.com", password: "password" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("email-already-exists");
  });

  it("大文字小文字が異なる同一メールアドレスも重複として扱う", async () => {
    const repository = new InMemoryUserRepository();
    await repository.save({
      id: "existing-id",
      email: "user@example.com",
      passwordHash: "existing-hash",
    });
    const deps = createTestDependencies({ repository });

    const result = await registerUser(
      { email: "USER@EXAMPLE.COM", password: "password" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("email-already-exists");
  });

  it("リポジトリの重複エラーは 409 として扱う", async () => {
    const deps = createTestDependencies({
      repository: {
        findById: async () => null,
        findByEmail: async () => null,
        findAll: async () => [],
        save: async () => {
          throw new DuplicateEmailError();
        },
        delete: async () => {},
      },
    });

    const result = await registerUser(
      { email: "user@example.com", password: "password" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("email-already-exists");
  });

  it("無効なメールアドレスではハッシュ化処理が実行されない", async () => {
    const hashPassword = vi.fn(async () => "hashed-password");
    const deps = createTestDependencies({ hashPassword });

    await registerUser({ email: "invalid-email", password: "password" }, deps);

    expect(hashPassword).not.toHaveBeenCalled();
  });

  it("登録失敗時はリフレッシュトークンが保存されない", async () => {
    const repository = new InMemoryUserRepository();
    await repository.save({
      id: "existing-id",
      email: "user@example.com",
      passwordHash: "existing-hash",
    });
    const refreshTokenRepository = new InMemoryRefreshTokenRepository();
    const deps = createTestDependencies({
      repository,
      refreshTokenRepository,
    });

    await registerUser(
      { email: "user@example.com", password: "password" },
      deps,
    );

    const tokens = await refreshTokenRepository.findAll();
    expect(tokens).toHaveLength(0);
  });
});

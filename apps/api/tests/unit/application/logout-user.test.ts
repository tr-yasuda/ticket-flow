import { describe, expect, it, vi } from "vitest";

import { logoutUser } from "../../../src/application/logout-user";
import { hashRefreshToken } from "../../../src/domain/refresh-token";
import { InMemoryRefreshTokenRepository } from "../../../src/infrastructure/database/in-memory-refresh-token-repository";

function createTestDependencies(overrides?: {
  refreshTokenRepository?: InMemoryRefreshTokenRepository;
  verifyRefreshToken?: (token: string) => Promise<{ userId: string }>;
  hashRefreshToken?: (token: string) => string;
}) {
  return {
    refreshTokenRepository:
      overrides?.refreshTokenRepository ?? new InMemoryRefreshTokenRepository(),
    verifyRefreshToken:
      overrides?.verifyRefreshToken ??
      (async (token: string) => ({
        userId: token.startsWith("valid-") ? "user-id" : "other-user-id",
      })),
    hashRefreshToken: overrides?.hashRefreshToken ?? hashRefreshToken,
  };
}

describe("ユーザーログアウト", () => {
  it("有効なリフレッシュトークンを無効化する", async () => {
    const refreshTokenRepository = new InMemoryRefreshTokenRepository();
    await refreshTokenRepository.save({
      tokenHash: hashRefreshToken("valid-token"),
      userId: "user-id",
    });
    const deps = createTestDependencies({ refreshTokenRepository });

    const result = await logoutUser({ refreshToken: "valid-token" }, deps);

    expect(result.success).toBe(true);
    const storedToken = await refreshTokenRepository.findByTokenHash(
      hashRefreshToken("valid-token"),
    );
    expect(storedToken).toBeNull();
  });

  it("無効なリフレッシュトークンでは削除を試みない", async () => {
    const refreshTokenRepository = new InMemoryRefreshTokenRepository();
    const deleteSpy = vi.spyOn(refreshTokenRepository, "delete");
    const deps = createTestDependencies({
      refreshTokenRepository,
      verifyRefreshToken: async () => {
        throw new Error("Invalid token");
      },
    });

    const result = await logoutUser({ refreshToken: "invalid-token" }, deps);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-token");
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("トークンが保存されていなくても成功する", async () => {
    const refreshTokenRepository = new InMemoryRefreshTokenRepository();
    const deps = createTestDependencies({ refreshTokenRepository });

    const result = await logoutUser({ refreshToken: "valid-token" }, deps);

    expect(result.success).toBe(true);
  });
});

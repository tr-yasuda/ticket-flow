import { describe, expect, it } from "vitest";

import { refreshAccessToken } from "../../../src/application/refresh-token.js";
import { hashRefreshToken } from "../../../src/domain/refresh-token.js";
import { InMemoryRefreshTokenRepository } from "../../../src/infrastructure/database/in-memory-refresh-token-repository.js";

function createTestDependencies(
  overrides?: Partial<{
    refreshTokenRepository: InMemoryRefreshTokenRepository;
    verifyRefreshToken: (token: string) => Promise<{ userId: string }>;
    generateAccessToken: (userId: string) => Promise<string>;
    hashRefreshToken: (token: string) => string;
  }>,
) {
  return {
    refreshTokenRepository: new InMemoryRefreshTokenRepository(),
    verifyRefreshToken: async () => ({ userId: "user-1" }),
    generateAccessToken: async () => "new-access-token",
    hashRefreshToken,
    ...overrides,
  };
}

describe("refreshAccessToken", () => {
  it("有効なリフレッシュトークンで新しいアクセストークンを発行する", async () => {
    const refreshTokenRepository = new InMemoryRefreshTokenRepository();
    await refreshTokenRepository.save({
      tokenHash: hashRefreshToken("valid-token"),
      userId: "user-1",
    });
    const deps = createTestDependencies({ refreshTokenRepository });

    const result = await refreshAccessToken(
      { refreshToken: "valid-token" },
      deps,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.accessToken).toBe("new-access-token");
  });

  it("トークン検証に失敗した場合は invalid-token エラーを返す", async () => {
    const deps = createTestDependencies({
      verifyRefreshToken: async () => {
        throw new Error("expired");
      },
    });

    const result = await refreshAccessToken(
      { refreshToken: "invalid-token" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-token");
  });

  it("DB に存在しないトークンは invalid-token エラーを返す", async () => {
    const deps = createTestDependencies();

    const result = await refreshAccessToken(
      { refreshToken: "unknown-token" },
      deps,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-token");
  });
});

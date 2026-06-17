import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { hashRefreshToken } from "../../../../src/domain/refresh-token.js";
import { createRefreshHandler } from "../../../../src/presentation/handlers/refresh-handler.js";

function createTestHandler(
  overrides?: Partial<{
    verifyRefreshToken: (token: string) => Promise<{ userId: string }>;
    generateAccessToken: (userId: string) => Promise<string>;
  }>,
) {
  const deps = {
    refreshTokenRepository: {
      findById: async () => null,
      findByTokenHash: async () => ({
        tokenHash: hashRefreshToken("valid-token"),
        userId: "user-1",
      }),
      findAll: async () => [],
      save: async () => {},
      delete: async () => {},
    },
    verifyRefreshToken: async () => ({ userId: "user-1" }),
    generateAccessToken: async () => "new-access-token",
    hashRefreshToken,
    ...overrides,
  };
  const app = new Hono();
  app.post("/api/auth/refresh", createRefreshHandler(deps));
  return app;
}

describe("refresh-handler", () => {
  it("有効なリフレッシュトークンで新しいアクセストークンを返す", async () => {
    const app = createTestHandler();
    const response = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.accessToken).toBe("new-access-token");
  });

  it("Authorization ヘッダーがない場合は 401", async () => {
    const app = createTestHandler();
    const response = await app.request("/api/auth/refresh", {
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("無効なリフレッシュトークンは 401", async () => {
    const app = createTestHandler({
      verifyRefreshToken: async () => {
        throw new Error("invalid");
      },
    });
    const response = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(response.status).toBe(401);
  });
});

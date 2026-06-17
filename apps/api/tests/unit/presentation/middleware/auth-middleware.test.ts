import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
} from "../../../../src/domain/token.js";
import { createAuthMiddleware } from "../../../../src/presentation/middleware/auth-middleware.js";

const testConfig = {
  secret: "test-secret-at-least-32-bytes-long!",
  accessExpiresIn: "1h",
  refreshExpiresIn: "7d",
};

const expiredConfig = {
  ...testConfig,
  accessExpiresIn: "-1s",
};

const invalidConfig = {
  ...testConfig,
  secret: "different-secret-at-least-32-bytes!",
};

function createTestApp() {
  const app = new Hono();
  app.use(
    "/api/protected/*",
    createAuthMiddleware({
      verifyAccessToken: async (token) => verifyAccessToken(token, testConfig),
    }),
  );
  app.get("/api/protected/me", (c) => {
    const userId = c.get("userId");
    if (userId === undefined) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_UNAUTHORIZED,
          "認証が必要です",
        ),
        401,
      );
    }
    return c.json({ userId }, 200);
  });
  return app;
}

async function createAccessToken(userId: string): Promise<string> {
  return generateAccessToken({ userId }, testConfig);
}

function expectUnauthorized(body: unknown) {
  expect(body).toEqual({
    success: false,
    error: {
      code: ApiErrorCode.AUTH_UNAUTHORIZED,
      message: "認証が必要です",
    },
  });
}

describe("認証ミドルウェア", () => {
  it("有効なアクセストークンでユーザー ID がコンテキストに設定される", async () => {
    const app = createTestApp();
    const token = await createAccessToken("user-123");

    const response = await app.request("/api/protected/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.userId).toBe("user-123");
  });

  it("Authorization ヘッダーがない場合は 401 を返す", async () => {
    const app = createTestApp();

    const response = await app.request("/api/protected/me");

    expect(response.status).toBe(401);
    const body = await response.json();
    expectUnauthorized(body);
  });

  it("Bearer スキームでない場合は 401 を返す", async () => {
    const app = createTestApp();

    const response = await app.request("/api/protected/me", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expectUnauthorized(body);
  });

  it("無効なアクセストークンでは 401 を返す", async () => {
    const app = createTestApp();
    const token = await generateAccessToken(
      { userId: "user-123" },
      invalidConfig,
    );

    const response = await app.request("/api/protected/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expectUnauthorized(body);
  });

  it("期限切れのアクセストークンでは 401 を返す", async () => {
    const app = createTestApp();
    const token = await generateAccessToken(
      { userId: "user-123" },
      expiredConfig,
    );

    const response = await app.request("/api/protected/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("リフレッシュトークンでは 401 を返す", async () => {
    const app = createTestApp();
    const token = await generateRefreshToken(
      { userId: "user-123" },
      testConfig,
    );

    const response = await app.request("/api/protected/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expectUnauthorized(body);
  });

  it("Bearer とトークンの間に複数スペースがあってもトークンを抽出する", async () => {
    const app = createTestApp();
    const token = await createAccessToken("user-123");

    const response = await app.request("/api/protected/me", {
      headers: { Authorization: `Bearer   ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.userId).toBe("user-123");
  });
});

import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { RegisterUserDependencies } from "../../../../src/application/register-user";
import { hashRefreshToken } from "../../../../src/domain/refresh-token";
import { createRegisterHandler } from "../../../../src/presentation/handlers/register-handler";

function createTestHandler(overrides?: Partial<RegisterUserDependencies>) {
  const deps: RegisterUserDependencies = {
    userRepository: {
      findById: async () => null,
      findByEmail: async () => null,
      findAll: async () => [],
      save: async () => {},
      delete: async () => {},
    },
    refreshTokenRepository: {
      findById: async () => null,
      findByTokenHash: async () => null,
      findAll: async () => [],
      save: async () => {},
      delete: async () => {},
    },
    hashPassword: async () => "hashed-password",
    generateAccessToken: async () => "access-token",
    generateRefreshToken: async () => "refresh-token",
    hashRefreshToken,
    ...overrides,
  };

  const app = new Hono();
  app.post("/api/auth/register", createRegisterHandler(deps));
  return app;
}

describe("ユーザー登録ハンドラ", () => {
  it("有効なメールアドレスとパスワードで登録に成功する", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe("user@example.com");
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.accessToken).toBe("access-token");
    expect(body.refreshToken).toBe("refresh-token");
  });

  it("無効なメールアドレスでは 400 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email", password: "password" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "email",
          message: expect.any(String),
        }),
      ]),
    );
  });

  it("8バイト未満のパスワードでは 400 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "short" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "password",
          message: expect.any(String),
        }),
      ]),
    );
  });

  it("既存のメールアドレスでは 409 を返す", async () => {
    const app = createTestHandler({
      userRepository: {
        findById: async () => null,
        findByEmail: async () => ({
          id: "existing-id",
          email: "user@example.com",
          passwordHash: "existing-hash",
        }),
        findAll: async () => [],
        save: async () => {},
        delete: async () => {},
      },
    });

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password" }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("JSON ボディが不正な場合は 400 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    expect(response.status).toBe(400);
  });

  it("email または password が文字列でない場合は 400 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: 123, password: "password" }),
    });

    expect(response.status).toBe(400);
  });
});

import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { LoginUserDependencies } from "../../../../src/application/login-user";
import { createLoginHandler } from "../../../../src/presentation/handlers/login-handler";

function createTestHandler(overrides?: Partial<LoginUserDependencies>) {
  const deps: LoginUserDependencies = {
    userRepository: {
      findById: async () => null,
      findByEmail: async () => null,
      findAll: async () => [],
      save: async () => {},
      delete: async () => {},
    },
    verifyPassword: async () => false,
    generateAccessToken: async () => "access-token",
    generateRefreshToken: async () => "refresh-token",
    ...overrides,
  };

  const app = new Hono();
  app.post("/api/auth/login", createLoginHandler(deps));
  return app;
}

describe("ユーザーログインハンドラ", () => {
  it("正しい認証情報でログインに成功する", async () => {
    const app = createTestHandler({
      userRepository: {
        findById: async () => null,
        findByEmail: async () => ({
          id: "user-id",
          email: "user@example.com",
          passwordHash: "hashed-password",
        }),
        findAll: async () => [],
        save: async () => {},
        delete: async () => {},
      },
      verifyPassword: async () => true,
    });

    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe("user@example.com");
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.accessToken).toBe("access-token");
    expect(body.refreshToken).toBe("refresh-token");
  });

  it("無効なメールアドレスでは 400 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email", password: "password" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("存在しないメールアドレスでは 401 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "unknown@example.com",
        password: "password",
      }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("誤ったパスワードでは 401 を返す", async () => {
    const app = createTestHandler({
      userRepository: {
        findById: async () => null,
        findByEmail: async () => ({
          id: "user-id",
          email: "user@example.com",
          passwordHash: "hashed-password",
        }),
        findAll: async () => [],
        save: async () => {},
        delete: async () => {},
      },
      verifyPassword: async () => false,
    });

    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "wrong-password",
      }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("JSON ボディが不正な場合は 400 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    expect(response.status).toBe(400);
  });

  it("email または password が文字列でない場合は 400 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: 123, password: "password" }),
    });

    expect(response.status).toBe(400);
  });

  it("認証失敗時のエラーメッセージはメールアドレスの存在有無を区別しない", async () => {
    const repository = {
      findById: async () => null,
      findByEmail: async () => ({
        id: "user-id",
        email: "user@example.com",
        passwordHash: "hashed-password",
      }),
      findAll: async () => [],
      save: async () => {},
      delete: async () => {},
    };
    const missingResponse = await createTestHandler().request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "unknown@example.com",
          password: "password",
        }),
      },
    );
    const wrongResponse = await createTestHandler({
      userRepository: repository,
      verifyPassword: async () => false,
    }).request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "wrong" }),
    });

    expect(missingResponse.status).toBe(401);
    expect(wrongResponse.status).toBe(401);
    const missingBody = await missingResponse.json();
    const wrongBody = await wrongResponse.json();
    expect(missingBody.error).toBe(wrongBody.error);
  });
});

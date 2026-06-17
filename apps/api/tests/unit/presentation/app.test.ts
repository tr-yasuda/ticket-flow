import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthDependencies } from "../../../src/presentation/app";
import { createApp } from "../../../src/presentation/app";

afterEach(() => {
  vi.restoreAllMocks();
});

function createTestApp(overrides?: Partial<AuthDependencies>) {
  return createApp({
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
    hashPassword: async () => "hashed",
    verifyPassword: async () => false,
    generateAccessToken: async () => "access-token",
    generateRefreshToken: async () => "refresh-token",
    verifyAccessToken: async () => ({ userId: "user-id" }),
    verifyRefreshToken: async () => ({ userId: "user-id" }),
    hashRefreshToken: (token) => token,
    ...overrides,
  });
}

describe("createApp", () => {
  it("HTTPException はそのレスポンスが返される", async () => {
    const app = createTestApp();
    app.get("/api/test/http-exception", () => {
      throw new HTTPException(400, { message: "Bad Request" });
    });

    const response = await app.request("/api/test/http-exception");

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Bad Request");
  });

  it("予期しないエラーは 500 Internal Server Error として返される", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createTestApp();
    app.get("/api/test/unexpected", () => {
      throw new Error("Something went wrong");
    });

    const response = await app.request("/api/test/unexpected");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal Server Error" });
  });

  it("GET /api/me は認証済みユーザー情報を返す", async () => {
    const app = createTestApp({
      userRepository: {
        findById: async (id) =>
          id === "user-id"
            ? { id: "user-id", email: "user@example.com", passwordHash: "hash" }
            : null,
        findByEmail: async () => null,
        findAll: async () => [],
        save: async () => {},
        delete: async () => {},
      },
    });

    const response = await app.request("/api/me", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.user).toEqual({
      id: "user-id",
      email: "user@example.com",
    });
  });

  it("GET /api/me は未認証時に 401 を返す", async () => {
    const app = createTestApp();

    const response = await app.request("/api/me");

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("GET /api/me は無効なトークン時に 401 を返す", async () => {
    const app = createTestApp({
      verifyAccessToken: async () => {
        throw new Error("Invalid token");
      },
    });

    const response = await app.request("/api/me", {
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
    expect(body.error.message).toBe("認証が必要です");
  });
});

import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../../src/presentation/app";

afterEach(() => {
  vi.restoreAllMocks();
});

function createTestApp() {
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
});

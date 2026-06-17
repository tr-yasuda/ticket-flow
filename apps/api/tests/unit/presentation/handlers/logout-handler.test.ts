import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { LogoutUserDependencies } from "../../../../src/application/logout-user";
import { hashRefreshToken } from "../../../../src/domain/refresh-token";
import { createLogoutHandler } from "../../../../src/presentation/handlers/logout-handler";

function createTestHandler(overrides?: Partial<LogoutUserDependencies>) {
  const tokens = new Set<string>();
  const deps: LogoutUserDependencies = {
    refreshTokenRepository: {
      findById: async (tokenHash) =>
        tokens.has(tokenHash) ? { tokenHash, userId: "user-id" } : null,
      findByTokenHash: async (tokenHash) =>
        tokens.has(tokenHash) ? { tokenHash, userId: "user-id" } : null,
      findAll: async () => [],
      save: async ({ tokenHash }) => {
        tokens.add(tokenHash);
      },
      delete: async (tokenHash) => {
        tokens.delete(tokenHash);
      },
    },
    verifyRefreshToken: async (token) => {
      if (!token.startsWith("valid-")) {
        throw new Error("Invalid token");
      }
      return { userId: "user-id" };
    },
    hashRefreshToken,
    ...overrides,
  };

  const app = new Hono();
  app.post("/api/auth/logout", createLogoutHandler(deps));
  return { app, deps };
}

describe("ユーザーログアウトハンドラ", () => {
  it("有効なリフレッシュトークンで 204 を返しトークンを無効化する", async () => {
    const { app, deps } = createTestHandler();
    await deps.refreshTokenRepository.save({
      tokenHash: hashRefreshToken("valid-token"),
      userId: "user-id",
    });

    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(204);
    const storedToken = await deps.refreshTokenRepository.findByTokenHash(
      hashRefreshToken("valid-token"),
    );
    expect(storedToken).toBeNull();
  });

  it("無効なリフレッシュトークンでも 204 を返す", async () => {
    const { app } = createTestHandler();

    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(response.status).toBe(204);
  });

  it("Authorization ヘッダーがない場合も 204 を返す", async () => {
    const { app } = createTestHandler();

    const response = await app.request("/api/auth/logout", {
      method: "POST",
    });

    expect(response.status).toBe(204);
  });

  it("Bearer スキーム以外の Authorization ヘッダーでも 204 を返す", async () => {
    const { app } = createTestHandler();

    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });

    expect(response.status).toBe(204);
  });

  it("トークンが保存されていなくても 204 を返す", async () => {
    const { app } = createTestHandler();

    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(204);
  });

  it("Bearer とトークンの間に複数スペースがあってもトークンを抽出する", async () => {
    const { app, deps } = createTestHandler();
    await deps.refreshTokenRepository.save({
      tokenHash: hashRefreshToken("valid-token"),
      userId: "user-id",
    });

    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer   valid-token" },
    });

    expect(response.status).toBe(204);
    const storedToken = await deps.refreshTokenRepository.findByTokenHash(
      hashRefreshToken("valid-token"),
    );
    expect(storedToken).toBeNull();
  });

  it("Authorization ヘッダーの前後空白を無視してトークンを抽出する", async () => {
    const { app, deps } = createTestHandler();
    await deps.refreshTokenRepository.save({
      tokenHash: hashRefreshToken("valid-token"),
      userId: "user-id",
    });

    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: "  Bearer valid-token  " },
    });

    expect(response.status).toBe(204);
    const storedToken = await deps.refreshTokenRepository.findByTokenHash(
      hashRefreshToken("valid-token"),
    );
    expect(storedToken).toBeNull();
  });
});

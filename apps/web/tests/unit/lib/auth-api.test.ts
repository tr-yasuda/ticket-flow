import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { login, logout, register } from "@/lib/auth-api";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/token-storage";

describe("auth-api", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearTokens();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("register はユーザー情報とトークンを返す", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: "user-1", email: "user@example.com" },
          accessToken: "access-token",
          refreshToken: "refresh-token",
        }),
        { status: 201 },
      ),
    );

    const result = await register({
      email: "user@example.com",
      password: "password",
    });

    expect(result.user.email).toBe("user@example.com");
    expect(result.accessToken).toBe("access-token");
    expect(getAccessToken()).toBe("access-token");
    expect(getRefreshToken()).toBe("refresh-token");
  });

  it("login 成功時にトークンを保存する", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: "user-1", email: "user@example.com" },
          accessToken: "access-token",
          refreshToken: "refresh-token",
        }),
        { status: 200 },
      ),
    );

    const result = await login({
      email: "user@example.com",
      password: "password",
    });

    expect(result.accessToken).toBe("access-token");
    expect(getAccessToken()).toBe("access-token");
    expect(getRefreshToken()).toBe("refresh-token");
  });

  it("logout 成功時にトークンをクリアする", async () => {
    setTokens("access-token", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock;

    await logout();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.headers.get("Authorization")).toBe("Bearer refresh-token");
  });
});

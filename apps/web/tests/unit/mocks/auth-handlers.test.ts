import { afterEach, describe, expect, it } from "vitest";

import { getCurrentUser, login, register } from "@/lib/auth-api";
import { clearTokens, getAccessToken, setTokens } from "@/lib/token-storage";

describe("auth mock handlers", () => {
  afterEach(() => {
    clearTokens();
  });

  it("デモユーザーでログインできる", async () => {
    const response = await login({
      email: "demo@example.com",
      password: "demo1234",
    });

    expect(response.user.email).toBe("demo@example.com");
    expect(response.accessToken).toBeDefined();
    expect(getAccessToken()).toBe(response.accessToken);
  });

  it("誤ったパスワードでは 401 エラー", async () => {
    await expect(
      login({ email: "demo@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("新規登録ができる", async () => {
    const response = await register({
      email: "new@example.com",
      password: "password123",
    });

    expect(response.user.email).toBe("new@example.com");
    expect(response.accessToken).toBeDefined();
  });

  it("既存メールアドレスでは 409 エラー", async () => {
    await expect(
      register({ email: "demo@example.com", password: "password123" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  describe("GET /api/me", () => {
    it("有効なアクセストークンで current user を返す", async () => {
      const loginResponse = await login({
        email: "demo@example.com",
        password: "demo1234",
      });
      setTokens(loginResponse.accessToken, loginResponse.refreshToken);

      const user = await getCurrentUser();

      expect(user.email).toBe("demo@example.com");
    });

    it("無効なアクセストークンでは 401 エラー", async () => {
      setTokens("invalid-token", "invalid-refresh-token");

      await expect(getCurrentUser()).rejects.toMatchObject({ status: 401 });
    });
  });
});

import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loginController,
  logoutController,
  refreshController,
  registerController,
} from "../../../src/controllers/auth-controller.js";
import * as authService from "../../../src/services/auth-service.js";

function createTestContext({
  body,
  authorization,
}: {
  body?: unknown;
  authorization?: string;
} = {}): Context {
  const json = vi.fn();
  const c = {
    req: {
      json: vi.fn().mockResolvedValue(body),
      header: vi.fn().mockImplementation((name: string) => {
        if (name === "Authorization") {
          return authorization;
        }
        return undefined;
      }),
    },
    json,
    body: vi.fn(),
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as Context;
  return c;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth-controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerController", () => {
    it("登録成功時に 201 を返す", async () => {
      vi.spyOn(authService, "registerUser").mockResolvedValue({
        success: true,
        data: {
          user: { id: "user-id", email: "user@example.com" },
          accessToken: "access-token",
          refreshToken: "refresh-token",
        },
      });
      const c = createTestContext({
        body: { email: "user@example.com", password: "password123" },
      });

      await registerController(c);

      expect(c.json).toHaveBeenCalledWith(
        {
          success: true,
          data: {
            user: { id: "user-id", email: "user@example.com" },
            accessToken: "access-token",
            refreshToken: "refresh-token",
          },
        },
        201,
      );
    });

    it("バリデーションエラー時に 400 を返す", async () => {
      const c = createTestContext({
        body: { email: "invalid", password: "short" },
      });

      await registerController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        400,
      );
    });

    it("メール重複時に 409 を返す", async () => {
      vi.spyOn(authService, "registerUser").mockResolvedValue({
        success: false,
        error: {
          type: "email-already-exists",
          message: "Email already exists",
        },
      });
      const c = createTestContext({
        body: { email: "user@example.com", password: "password123" },
      });

      await registerController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "CONFLICT" }),
        }),
        409,
      );
    });
  });

  describe("loginController", () => {
    it("ログイン成功時に 200 を返す", async () => {
      vi.spyOn(authService, "loginUser").mockResolvedValue({
        success: true,
        data: {
          user: { id: "user-id", email: "user@example.com" },
          accessToken: "access-token",
          refreshToken: "refresh-token",
        },
      });
      const c = createTestContext({
        body: { email: "user@example.com", password: "password123" },
      });

      await loginController(c);

      expect(c.json).toHaveBeenCalledWith(
        {
          success: true,
          data: {
            user: { id: "user-id", email: "user@example.com" },
            accessToken: "access-token",
            refreshToken: "refresh-token",
          },
        },
        200,
      );
    });

    it("認証失敗時に 401 を返す", async () => {
      vi.spyOn(authService, "loginUser").mockResolvedValue({
        success: false,
        error: {
          type: "authentication-failed",
          message: "Invalid email or password",
        },
      });
      const c = createTestContext({
        body: { email: "user@example.com", password: "wrong" },
      });

      await loginController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "AUTH_UNAUTHORIZED" }),
        }),
        401,
      );
    });
  });

  describe("logoutController", () => {
    it("Authorization ヘッダーがある場合は service を呼び 204 を返す", async () => {
      vi.spyOn(authService, "logoutUser").mockResolvedValue({ success: true });
      const c = createTestContext({
        authorization: "Bearer refresh-token",
      });

      await logoutController(c);

      expect(authService.logoutUser).toHaveBeenCalledWith({
        refreshToken: "refresh-token",
      });
      expect(c.body).toHaveBeenCalledWith(null, 204);
    });

    it("Authorization ヘッダーがない場合も 204 を返す", async () => {
      const c = createTestContext();

      await logoutController(c);

      expect(c.body).toHaveBeenCalledWith(null, 204);
    });
  });

  describe("refreshController", () => {
    it("リフレッシュ成功時にアクセストークンを返す", async () => {
      vi.spyOn(authService, "refreshAccessToken").mockResolvedValue({
        success: true,
        data: { accessToken: "new-access-token" },
      });
      const c = createTestContext({
        authorization: "Bearer refresh-token",
      });

      await refreshController(c);

      expect(c.json).toHaveBeenCalledWith(
        { accessToken: "new-access-token" },
        200,
      );
    });

    it("Authorization ヘッダーがない場合は 401 を返す", async () => {
      const c = createTestContext();

      await refreshController(c);

      expect(c.json).toHaveBeenCalledWith(
        { error: "Authorization header is required" },
        401,
      );
    });
  });
});

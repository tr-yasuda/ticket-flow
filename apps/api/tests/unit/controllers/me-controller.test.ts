import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { meController } from "../../../src/controllers/me-controller.js";
import * as userService from "../../../src/services/user-service.js";

function createTestContext(userId?: string): Context {
  const json = vi.fn();
  const c = {
    req: {
      json: vi.fn().mockResolvedValue({}),
      header: vi.fn().mockReturnValue(undefined),
    },
    json,
    body: vi.fn(),
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "userId") {
        return userId;
      }
      return undefined;
    }),
  } as unknown as Context;
  return c;
}

describe("me-controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("認証済みユーザー情報を返す", async () => {
    vi.spyOn(userService, "getCurrentUser").mockResolvedValue({
      success: true,
      data: { user: { id: "user-id", email: "user@example.com" } },
    });
    const c = createTestContext("user-id");

    await meController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { user: { id: "user-id", email: "user@example.com" } },
      }),
      200,
    );
  });

  it("userId が未設定の場合は 401 を返す", async () => {
    const c = createTestContext();

    await meController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      401,
    );
  });

  it("ユーザーが見つからない場合は 401 を返す", async () => {
    vi.spyOn(userService, "getCurrentUser").mockResolvedValue({
      success: false,
      error: { type: "user-not-found" },
    });
    const c = createTestContext("user-id");

    await meController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      401,
    );
  });
});

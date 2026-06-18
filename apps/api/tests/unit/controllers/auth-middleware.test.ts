import type { Context, Next } from "hono";
import { describe, expect, it, vi } from "vitest";

import { authMiddleware } from "../../../src/controllers/auth-middleware.js";
import * as tokenModule from "../../../src/domain/token.js";

function createTestContext(authorization?: string): {
  c: Context;
  next: Next;
} {
  const set = vi.fn();
  const json = vi.fn();
  const c = {
    req: {
      header: vi.fn().mockImplementation((name: string) => {
        if (name === "Authorization") {
          return authorization;
        }
        return undefined;
      }),
    },
    set,
    json,
  } as unknown as Context;
  const next = vi.fn() as Next;
  return { c, next };
}

describe("auth-middleware", () => {
  it("有効なトークンで next を呼び userId を設定する", async () => {
    vi.spyOn(tokenModule, "verifyAccessToken").mockResolvedValue({
      userId: "user-id",
    });
    const { c, next } = createTestContext("Bearer valid-token");

    await authMiddleware(c, next);

    expect(c.set).toHaveBeenCalledWith("userId", "user-id");
    expect(next).toHaveBeenCalled();
  });

  it("Authorization ヘッダーがない場合は 401 を返す", async () => {
    const { c, next } = createTestContext();

    await authMiddleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("Bearer 以外の形式では 401 を返す", async () => {
    const { c, next } = createTestContext("Basic invalid");

    await authMiddleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("無効なトークンでは 401 を返す", async () => {
    vi.spyOn(tokenModule, "verifyAccessToken").mockRejectedValue(
      new Error("Invalid token"),
    );
    const { c, next } = createTestContext("Bearer invalid-token");

    await authMiddleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });
});

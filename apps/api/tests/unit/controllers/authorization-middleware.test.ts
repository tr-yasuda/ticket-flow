import type { Context, Next } from "hono";
import { describe, expect, it, vi } from "vitest";

import {
  createRequireRoleMiddleware,
  FORBIDDEN_MESSAGE,
} from "../../../src/controllers/authorization-middleware.js";
import type { OrganizationMemberRole } from "../../../src/domain/organization-member.js";

function createTestContext(role?: OrganizationMemberRole): {
  c: Context;
  next: Next;
} {
  const c = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "organizationRole") {
        return role;
      }
      return undefined;
    }),
    json: vi.fn(),
  } as unknown as Context;
  const next = vi.fn() as Next;
  return { c, next };
}

describe("authorization-middleware", () => {
  it.each([
    ["owner", "owner", true],
    ["owner", "admin", true],
    ["owner", "member", true],
    ["owner", "viewer", true],
    ["admin", "owner", false],
    ["admin", "admin", true],
    ["admin", "member", true],
    ["admin", "viewer", true],
    ["member", "owner", false],
    ["member", "admin", false],
    ["member", "member", true],
    ["member", "viewer", true],
    ["viewer", "owner", false],
    ["viewer", "admin", false],
    ["viewer", "member", false],
    ["viewer", "viewer", true],
  ] as const)(
    "現在のロールが %s で要求ロールが %s の場合は next の呼び出しが %s になる",
    async (currentRole, requiredRole, allowed) => {
      const middleware = createRequireRoleMiddleware(requiredRole);
      const { c, next } = createTestContext(currentRole);

      await middleware(c, next);

      if (allowed) {
        expect(next).toHaveBeenCalled();
        expect(c.json).not.toHaveBeenCalled();
      } else {
        expect(next).not.toHaveBeenCalled();
        expect(c.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
          }),
          403,
        );
      }
    },
  );

  it("organizationRole が未設定の場合は 403 を返す", async () => {
    const middleware = createRequireRoleMiddleware("member");
    const { c, next } = createTestContext(undefined);

    await middleware(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "AUTH_FORBIDDEN",
          message: FORBIDDEN_MESSAGE,
        }),
      }),
      403,
    );
  });

  it("organizationRole に不正な値が設定されている場合は 403 を返す", async () => {
    const middleware = createRequireRoleMiddleware("member");
    const { c, next } = createTestContext("unknown" as OrganizationMemberRole);

    await middleware(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "AUTH_FORBIDDEN",
          message: FORBIDDEN_MESSAGE,
        }),
      }),
      403,
    );
  });
});

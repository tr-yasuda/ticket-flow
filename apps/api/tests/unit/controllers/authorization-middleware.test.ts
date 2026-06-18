import type { Context, Next } from "hono";
import { describe, expect, it, vi } from "vitest";

import {
  createRequireRoleMiddleware,
  FORBIDDEN_MESSAGE,
} from "../../../src/controllers/authorization-middleware.js";
import type { OrganizationMemberRole } from "../../../src/domain/organization-member.js";

function createTestContext(role?: OrganizationMemberRole | string): {
  c: Context;
  next: Next;
  jsonResponse: Response;
} {
  const jsonResponse = new Response();
  const c = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "organizationRole") {
        return role;
      }
      return undefined;
    }),
    json: vi.fn().mockReturnValue(jsonResponse),
  } as unknown as Context;
  const next = vi.fn() as Next;
  return { c, next, jsonResponse };
}

describe("authorization-middleware", () => {
  it.each([
    ["owner", "owner", "許可される"],
    ["owner", "admin", "許可される"],
    ["owner", "member", "許可される"],
    ["owner", "viewer", "許可される"],
    ["admin", "owner", "拒否される"],
    ["admin", "admin", "許可される"],
    ["admin", "member", "許可される"],
    ["admin", "viewer", "許可される"],
    ["member", "owner", "拒否される"],
    ["member", "admin", "拒否される"],
    ["member", "member", "許可される"],
    ["member", "viewer", "許可される"],
    ["viewer", "owner", "拒否される"],
    ["viewer", "admin", "拒否される"],
    ["viewer", "member", "拒否される"],
    ["viewer", "viewer", "許可される"],
  ] as const)(
    "現在のロールが %s で要求ロールが %s の場合は操作が %s",
    async (currentRole, requiredRole, outcome) => {
      const middleware = createRequireRoleMiddleware(requiredRole);
      const { c, next, jsonResponse } = createTestContext(currentRole);

      const result = await middleware(c, next);

      if (outcome === "許可される") {
        expect(next).toHaveBeenCalled();
        expect(c.json).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
      } else {
        expect(next).not.toHaveBeenCalled();
        expect(c.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
          }),
          403,
        );
        expect(result).toBe(jsonResponse);
      }
    },
  );

  it("organizationRole が未設定の場合は 403 を返す", async () => {
    const middleware = createRequireRoleMiddleware("member");
    const { c, next, jsonResponse } = createTestContext(undefined);

    const result = await middleware(c, next);

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
    expect(result).toBe(jsonResponse);
  });

  it("organizationRole に不正な値が設定されている場合は 403 を返す", async () => {
    const middleware = createRequireRoleMiddleware("member");
    const { c, next, jsonResponse } = createTestContext(
      "unknown" as OrganizationMemberRole,
    );

    const result = await middleware(c, next);

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
    expect(result).toBe(jsonResponse);
  });

  it("不正な requiredRole を指定するとミドルウェア生成時にエラーを投げる", () => {
    expect(() =>
      createRequireRoleMiddleware("unknown" as OrganizationMemberRole),
    ).toThrow();
  });
});

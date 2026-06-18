import type { Context, Next } from "hono";
import { describe, expect, it, vi } from "vitest";

import { createOrganizationScopeMiddleware } from "../../../src/controllers/organization-scope-middleware.js";
import type { OrganizationMemberRole } from "../../../src/domain/organization-member.js";

function createMockPrisma(
  membership: {
    role: OrganizationMemberRole;
  } | null,
  findUniqueImplementation?: () => Promise<unknown>,
) {
  return {
    organizationMember: {
      findUnique:
        findUniqueImplementation ?? vi.fn().mockResolvedValue(membership),
    },
  } as unknown as Parameters<typeof createOrganizationScopeMiddleware>[0];
}

function createFailingMockPrisma(error: Error) {
  return createMockPrisma(null, vi.fn().mockRejectedValue(error));
}

function createTestContext({
  userId,
  organizationId,
}: {
  userId?: string;
  organizationId?: string;
}): {
  c: Context;
  next: Next;
} {
  const set = vi.fn();
  const json = vi.fn();
  const c = {
    req: {
      param: vi.fn().mockImplementation((name: string) => {
        if (name === "organizationId") {
          return organizationId;
        }
        return undefined;
      }),
    },
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "userId") {
        return userId;
      }
      return undefined;
    }),
    set,
    json,
  } as unknown as Context;
  const next = vi.fn() as Next;
  return { c, next };
}

describe("organization-scope-middleware", () => {
  it("userId と membership がある場合は next を呼び context を設定する", async () => {
    const db = createMockPrisma({ role: "owner" });
    const middleware = createOrganizationScopeMiddleware(db);
    const { c, next } = createTestContext({
      userId: "user-id",
      organizationId: "550e8400-e29b-41d4-a716-446655440000",
    });

    await middleware(c, next);

    expect(db.organizationMember.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "550e8400-e29b-41d4-a716-446655440000",
          userId: "user-id",
        },
      },
      select: { role: true },
    });
    expect(next).toHaveBeenCalled();
    expect(c.set).toHaveBeenCalledWith(
      "organizationId",
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(c.set).toHaveBeenCalledWith("organizationRole", "owner");
  });

  it("大文字の organizationId は小文字に正規化される", async () => {
    const db = createMockPrisma({ role: "owner" });
    const middleware = createOrganizationScopeMiddleware(db);
    const { c, next } = createTestContext({
      userId: "user-id",
      organizationId: "550E8400-E29B-41D4-A716-446655440000",
    });

    await middleware(c, next);

    expect(db.organizationMember.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "550e8400-e29b-41d4-a716-446655440000",
          userId: "user-id",
        },
      },
      select: { role: true },
    });
    expect(c.set).toHaveBeenCalledWith(
      "organizationId",
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("userId が設定されていない場合は 401 を返す", async () => {
    const db = createMockPrisma(null);
    const middleware = createOrganizationScopeMiddleware(db);
    const { c, next } = createTestContext({
      organizationId: "550e8400-e29b-41d4-a716-446655440000",
    });

    await middleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "AUTH_UNAUTHORIZED" }),
      }),
      401,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("organizationId が UUID 形式でない場合は 400 を返す", async () => {
    const db = createMockPrisma(null);
    const middleware = createOrganizationScopeMiddleware(db);
    const { c, next } = createTestContext({
      userId: "user-id",
      organizationId: "invalid-id",
    });

    await middleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          details: [
            {
              field: "organizationId",
              message: "組織IDの形式が正しくありません",
            },
          ],
        }),
      }),
      400,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("membership が存在しない場合は 403 を返す", async () => {
    const db = createMockPrisma(null);
    const middleware = createOrganizationScopeMiddleware(db);
    const { c, next } = createTestContext({
      userId: "user-id",
      organizationId: "550e8400-e29b-41d4-a716-446655440000",
    });

    await middleware(c, next);

    expect(db.organizationMember.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "550e8400-e29b-41d4-a716-446655440000",
          userId: "user-id",
        },
      },
      select: { role: true },
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
      }),
      403,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("membership 検索時に DB エラーが発生した場合は例外を投げる", async () => {
    const db = createFailingMockPrisma(new Error("DB error"));
    const middleware = createOrganizationScopeMiddleware(db);
    const { c, next } = createTestContext({
      userId: "user-id",
      organizationId: "550e8400-e29b-41d4-a716-446655440000",
    });

    await expect(middleware(c, next)).rejects.toThrow("DB error");
  });
});

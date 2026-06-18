import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { OrganizationMemberRepository } from "../../../../src/domain/organization-member-repository.js";
import { createListOrganizationsHandler } from "../../../../src/presentation/handlers/list-organizations-handler.js";

function createMockRepository(
  userIdToMatch: string,
): OrganizationMemberRepository {
  return {
    findById: async () => null,
    findByOrganizationIdAndUserId: async () => null,
    findByUserId: async (userId) =>
      userId === userIdToMatch
        ? [
            {
              membershipId: "member-1",
              organizationId: "org-1",
              userId,
              role: "owner",
              organizationName: "Acme",
              organizationSlug: "acme",
            },
          ]
        : [],
    findAll: async () => [],
    save: async () => {},
    delete: async () => {},
    withTransaction() {
      return this;
    },
  };
}

function createTestApp(userId: string | undefined) {
  const app = new Hono();
  app.use(async (c, next) => {
    if (userId !== undefined) {
      c.set("userId", userId);
    }
    await next();
  });
  app.get(
    "/api/organizations",
    createListOrganizationsHandler({
      organizationMemberRepository: createMockRepository("user-1"),
    }),
  );
  return app;
}

describe("listOrganizationsHandler", () => {
  it("認証済みユーザーが所属組織一覧を取得できる", async () => {
    const app = createTestApp("user-1");

    const res = await app.request("/api/organizations");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.organizations).toEqual([
      { id: "org-1", name: "Acme", slug: "acme", role: "owner" },
    ]);
  });

  it("userId が設定されていない場合は 401 を返す", async () => {
    const app = createTestApp(undefined);

    const res = await app.request("/api/organizations");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("所属組織がない場合は空配列を返す", async () => {
    const app = createTestApp("user-2");

    const res = await app.request("/api/organizations");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.organizations).toEqual([]);
  });
});

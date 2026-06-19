import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createOrganizationController,
  getOrganizationController,
  getOrganizationMembersController,
  getOrganizationsController,
} from "../../../src/controllers/organizations-controller.js";
import type { OrganizationMemberRole } from "../../../src/domain/organization-member.js";
import * as organizationsService from "../../../src/services/organizations-service.js";

function createTestContext({
  body,
  query,
  userId,
  organizationId,
  organizationRole,
}: {
  body?: unknown;
  query?: unknown;
  userId?: string;
  organizationId?: string;
  organizationRole?: OrganizationMemberRole;
} = {}): Context {
  const json = vi.fn();
  const c = {
    req: {
      valid: vi.fn().mockImplementation((target: string) => {
        if (target === "json") {
          return body;
        }
        if (target === "query") {
          return query;
        }
        return undefined;
      }),
      header: vi.fn().mockReturnValue(undefined),
    },
    json,
    body: vi.fn(),
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "userId") {
        return userId;
      }
      if (key === "organizationId") {
        return organizationId;
      }
      if (key === "organizationRole") {
        return organizationRole;
      }
      return undefined;
    }),
  } as unknown as Context;
  return c;
}

describe("organizations-controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("組織作成成功時に 201 を返す", async () => {
    vi.spyOn(organizationsService, "createOrganization").mockResolvedValue({
      success: true,
      data: { id: "org-id", name: "Acme Inc.", slug: "acme-inc" },
    });
    const c = createTestContext({
      body: { name: "Acme Inc.", slug: "acme-inc" },
      userId: "user-id",
    });

    await createOrganizationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { id: "org-id", name: "Acme Inc.", slug: "acme-inc" },
      }),
      201,
    );
  });

  it("未認証時に 401 を返す", async () => {
    const c = createTestContext({
      body: { name: "Acme Inc.", slug: "acme-inc" },
    });

    await createOrganizationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      401,
    );
  });

  it("スラッグ重複時に 409 を返す", async () => {
    vi.spyOn(organizationsService, "createOrganization").mockResolvedValue({
      success: false,
      error: { type: "slug-already-exists", message: "Slug already exists" },
    });
    const c = createTestContext({
      body: { name: "Acme Inc.", slug: "acme-inc" },
      userId: "user-id",
    });

    await createOrganizationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CONFLICT" }),
      }),
      409,
    );
  });

  it("認証済みユーザーが所属組織一覧を取得できる", async () => {
    const getOrganizationsByUserIdSpy = vi
      .spyOn(organizationsService, "getOrganizationsByUserId")
      .mockResolvedValue({
        success: true,
        data: {
          organizations: [
            {
              id: "org-1",
              name: "Acme Inc.",
              slug: "acme-inc",
              role: "owner",
            },
          ],
        },
      });
    const c = createTestContext({ userId: "user-id" });

    await getOrganizationsController(c);

    expect(getOrganizationsByUserIdSpy).toHaveBeenCalledWith({
      userId: "user-id",
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          organizations: [
            {
              id: "org-1",
              name: "Acme Inc.",
              slug: "acme-inc",
              role: "owner",
            },
          ],
        },
      }),
      200,
    );
  });

  it("所属組織がない場合は空配列を返す", async () => {
    const getOrganizationsByUserIdSpy = vi
      .spyOn(organizationsService, "getOrganizationsByUserId")
      .mockResolvedValue({
        success: true,
        data: { organizations: [] },
      });
    const c = createTestContext({ userId: "user-id" });

    await getOrganizationsController(c);

    expect(getOrganizationsByUserIdSpy).toHaveBeenCalledWith({
      userId: "user-id",
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { organizations: [] },
      }),
      200,
    );
  });

  it("組織スコープ情報を返す", async () => {
    const c = createTestContext({
      organizationId: "org-id",
      organizationRole: "owner",
    });

    await getOrganizationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { organizationId: "org-id", organizationRole: "owner" },
      }),
      200,
    );
  });

  it("メンバー一覧をページネーション付きで返す", async () => {
    const getOrganizationMembersSpy = vi
      .spyOn(organizationsService, "getOrganizationMembers")
      .mockResolvedValue({
        success: true,
        data: {
          members: [
            {
              id: "member-1",
              userId: "user-1",
              name: null,
              email: "user1@example.com",
              role: "owner",
              joinedAt: "2026-06-18T00:00:00.000Z",
            },
          ],
          total: 1,
        },
      });
    const c = createTestContext({
      organizationId: "org-id",
      query: { page: 2, perPage: 10 },
    });

    await getOrganizationMembersController(c);

    expect(getOrganizationMembersSpy).toHaveBeenCalledWith({
      organizationId: "org-id",
      page: 2,
      perPage: 10,
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          members: [
            {
              id: "member-1",
              userId: "user-1",
              name: null,
              email: "user1@example.com",
              role: "owner",
              joinedAt: "2026-06-18T00:00:00.000Z",
            },
          ],
        },
        meta: {
          page: 2,
          perPage: 10,
          total: 1,
          totalPages: 1,
        },
      }),
      200,
    );
  });
});

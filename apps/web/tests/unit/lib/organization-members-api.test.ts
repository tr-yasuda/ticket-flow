import { createApiPaginatedSuccessResponse } from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getOrganizationMembers } from "@/lib/organization-members-api";
import { server } from "@/mocks/server.js";

describe("organization-members-api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("組織メンバー一覧を取得できる", async () => {
    const result = await getOrganizationMembers("demo-org-001");

    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toMatchObject({
      userId: "demo-user-001",
      email: "demo@example.com",
      role: "owner",
    });
  });

  it("organizationId を URL エンコードする", async () => {
    const organizationId = "org/with/slash";
    let capturedUrl = "";

    server.use(
      http.get("/api/organizations/:id/members", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { members: [] },
            { page: 1, perPage: 100, total: 0, totalPages: 1 },
          ),
          { status: 200 },
        );
      }),
    );

    await getOrganizationMembers(organizationId);

    expect(capturedUrl).toContain(
      `/api/organizations/${encodeURIComponent(organizationId)}/members`,
    );
  });

  it("不正なメンバーレスポンスの場合はエラーを投げる", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () => {
        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            {
              members: [
                {
                  id: "member-1",
                  userId: "user-1",
                  name: null,
                  email: "user@example.com",
                  role: "invalid-role",
                  joinedAt: new Date().toISOString(),
                },
              ],
            },
            { page: 1, perPage: 100, total: 1, totalPages: 1 },
          ),
          { status: 200 },
        );
      }),
    );

    await expect(getOrganizationMembers("demo-org-001")).rejects.toThrow(
      "Invalid response",
    );
  });
});

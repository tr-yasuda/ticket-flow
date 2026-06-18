import { describe, expect, it } from "vitest";

import { listOrganizations } from "../../../src/application/list-organizations.js";
import type {
  OrganizationMemberRepository,
  OrganizationMemberWithOrganization,
} from "../../../src/domain/organization-member-repository.js";

function createMockRepository(
  expectedUserId: string,
  memberships: OrganizationMemberWithOrganization[],
): OrganizationMemberRepository {
  return {
    findById: async () => null,
    findByOrganizationIdAndUserId: async () => null,
    findByUserId: async (userId) =>
      userId === expectedUserId ? memberships : [],
    findAll: async () => [],
    save: async () => {},
    delete: async () => {},
    withTransaction: () => createMockRepository(expectedUserId, memberships),
  };
}

describe("listOrganizations", () => {
  it("ユーザーが所属する組織の一覧とロールを返す", async () => {
    const repository = createMockRepository("user-1", [
      {
        membershipId: "member-1",
        organizationId: "org-1",
        userId: "user-1",
        role: "owner",
        organizationName: "Acme",
        organizationSlug: "acme",
      },
      {
        membershipId: "member-2",
        organizationId: "org-2",
        userId: "user-1",
        role: "member",
        organizationName: "Globex",
        organizationSlug: "globex",
      },
    ]);

    const result = await listOrganizations("user-1", {
      organizationMemberRepository: repository,
    });

    expect(result.success).toBe(true);
    expect(result.data.organizations).toEqual([
      { id: "org-1", name: "Acme", slug: "acme", role: "owner" },
      { id: "org-2", name: "Globex", slug: "globex", role: "member" },
    ]);
  });

  it("所属組織がない場合は空配列を返す", async () => {
    const repository = createMockRepository("user-1", []);

    const result = await listOrganizations("user-1", {
      organizationMemberRepository: repository,
    });

    expect(result.success).toBe(true);
    expect(result.data.organizations).toEqual([]);
  });
});

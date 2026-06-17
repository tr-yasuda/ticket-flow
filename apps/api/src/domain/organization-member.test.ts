import { describe, expect, it } from "vitest";

import {
  createOrganizationMember,
  rehydrateOrganizationMember,
  type OrganizationMemberRole,
} from "./organization-member.js";

describe("createOrganizationMember", () => {
  it("owner ロールのメンバーを作成する", () => {
    const member = createOrganizationMember(
      "org-1",
      "user-1",
      "owner" as OrganizationMemberRole,
    );

    expect(member.organizationId).toBe("org-1");
    expect(member.userId).toBe("user-1");
    expect(member.role).toBe("owner");
    expect(member.id).toBeTypeOf("string");
    expect(member.id).not.toBe("");
  });

  it("member ロールのメンバーを作成する", () => {
    const member = createOrganizationMember(
      "org-1",
      "user-1",
      "member" as OrganizationMemberRole,
    );

    expect(member.role).toBe("member");
  });

  it("organizationId が空の場合はエラーを投げる", () => {
    expect(() =>
      createOrganizationMember("", "user-1", "owner" as OrganizationMemberRole),
    ).toThrow("organizationId is required");
  });

  it("userId が空の場合はエラーを投げる", () => {
    expect(() =>
      createOrganizationMember("org-1", "", "owner" as OrganizationMemberRole),
    ).toThrow("userId is required");
  });

  it("不正なロールの場合はエラーを投げる", () => {
    expect(() =>
      createOrganizationMember(
        "org-1",
        "user-1",
        "admin" as OrganizationMemberRole,
      ),
    ).toThrow("role must be owner or member");
  });
});

describe("rehydrateOrganizationMember", () => {
  it("指定した値でメンバーを復元する", () => {
    const member = rehydrateOrganizationMember(
      "member-1",
      "org-1",
      "user-1",
      "owner" as OrganizationMemberRole,
    );

    expect(member.id).toBe("member-1");
    expect(member.organizationId).toBe("org-1");
    expect(member.userId).toBe("user-1");
    expect(member.role).toBe("owner");
  });

  it("id が空の場合はエラーを投げる", () => {
    expect(() =>
      rehydrateOrganizationMember(
        "",
        "org-1",
        "user-1",
        "owner" as OrganizationMemberRole,
      ),
    ).toThrow("id is required");
  });
});

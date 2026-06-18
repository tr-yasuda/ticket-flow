import { describe, expect, it } from "vitest";

import {
  changeRole,
  createOrganizationMember,
  rehydrateOrganizationMember,
  type OrganizationMemberRole,
} from "./organization-member.js";

describe("createOrganizationMember", () => {
  it("owner ロールのメンバーを作成する", () => {
    const member = createOrganizationMember("org-1", "user-1", "owner");

    expect(member.organizationId).toBe("org-1");
    expect(member.userId).toBe("user-1");
    expect(member.role).toBe("owner");
    expect(member.id).toBeTypeOf("string");
    expect(member.id).not.toBe("");
  });

  it("admin ロールのメンバーを作成する", () => {
    const member = createOrganizationMember("org-1", "user-1", "admin");

    expect(member.organizationId).toBe("org-1");
    expect(member.userId).toBe("user-1");
    expect(member.role).toBe("admin");
    expect(member.id).toBeTypeOf("string");
  });

  it("member ロールのメンバーを作成する", () => {
    const member = createOrganizationMember("org-1", "user-1", "member");

    expect(member.organizationId).toBe("org-1");
    expect(member.userId).toBe("user-1");
    expect(member.role).toBe("member");
    expect(member.id).toBeTypeOf("string");
  });

  it("viewer ロールのメンバーを作成する", () => {
    const member = createOrganizationMember("org-1", "user-1", "viewer");

    expect(member.organizationId).toBe("org-1");
    expect(member.userId).toBe("user-1");
    expect(member.role).toBe("viewer");
    expect(member.id).toBeTypeOf("string");
  });

  it("organizationId が空の場合はエラーを投げる", () => {
    expect(() => createOrganizationMember("", "user-1", "owner")).toThrow(
      "organizationId is required",
    );
  });

  it("userId が空の場合はエラーを投げる", () => {
    expect(() => createOrganizationMember("org-1", "", "owner")).toThrow(
      "userId is required",
    );
  });

  it("不正なロールの場合はエラーを投げる", () => {
    expect(() =>
      createOrganizationMember(
        "org-1",
        "user-1",
        "guest" as OrganizationMemberRole,
      ),
    ).toThrow("role must be one of owner, admin, member, viewer");
  });
});

describe("rehydrateOrganizationMember", () => {
  it("指定した値でメンバーを復元する", () => {
    const member = rehydrateOrganizationMember(
      "member-1",
      "org-1",
      "user-1",
      "owner",
    );

    expect(member.id).toBe("member-1");
    expect(member.organizationId).toBe("org-1");
    expect(member.userId).toBe("user-1");
    expect(member.role).toBe("owner");
  });

  it("id が空の場合はエラーを投げる", () => {
    expect(() =>
      rehydrateOrganizationMember("", "org-1", "user-1", "owner"),
    ).toThrow("id is required");
  });

  it("不正なロールの場合はエラーを投げる", () => {
    expect(() =>
      rehydrateOrganizationMember(
        "member-1",
        "org-1",
        "user-1",
        "guest" as OrganizationMemberRole,
      ),
    ).toThrow("role must be one of owner, admin, member, viewer");
  });
});

describe("changeRole", () => {
  it("メンバーのロールを変更し、元のインスタンスは変更しない", () => {
    const member = createOrganizationMember("org-1", "user-1", "member");

    const updated = changeRole(member, "admin");

    expect(updated).not.toBe(member);
    expect(updated.id).toBe(member.id);
    expect(updated.organizationId).toBe(member.organizationId);
    expect(updated.userId).toBe(member.userId);
    expect(updated.role).toBe("admin");
    expect(member.role).toBe("member");
  });

  it("不正なロールに変更しようとするとエラーを投げる", () => {
    const member = createOrganizationMember("org-1", "user-1", "member");

    expect(() => changeRole(member, "guest" as OrganizationMemberRole)).toThrow(
      "role must be one of owner, admin, member, viewer",
    );
  });
});

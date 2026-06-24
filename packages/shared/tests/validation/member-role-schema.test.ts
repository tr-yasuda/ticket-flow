import { describe, expect, it } from "vitest";

import {
  organizationMemberRoleSchema,
  updateOrganizationMemberRoleInputSchema,
} from "../../src/validation/member-role-schema.js";

describe("organizationMemberRoleSchema", () => {
  it.each(["owner", "admin", "member", "viewer"] as const)(
    "%s ロールを許可する",
    (role) => {
      expect(organizationMemberRoleSchema.safeParse(role).success).toBe(true);
    },
  );

  it("無効なロール値を拒否する", () => {
    expect(organizationMemberRoleSchema.safeParse("guest").success).toBe(false);
  });

  it("大文字のロール値を拒否する", () => {
    expect(organizationMemberRoleSchema.safeParse("Admin").success).toBe(false);
  });

  it("空文字を拒否する", () => {
    expect(organizationMemberRoleSchema.safeParse("").success).toBe(false);
  });
});

describe("updateOrganizationMemberRoleInputSchema", () => {
  it("有効な入力を許可する", () => {
    const result = updateOrganizationMemberRoleInputSchema.safeParse({
      role: "admin",
    });
    expect(result.success).toBe(true);
  });

  it("owner ロールを許可する", () => {
    const result = updateOrganizationMemberRoleInputSchema.safeParse({
      role: "owner",
    });
    expect(result.success).toBe(true);
  });

  it("無効なロールを拒否する", () => {
    const result = updateOrganizationMemberRoleInputSchema.safeParse({
      role: "guest",
    });
    expect(result.success).toBe(false);
  });

  it("role 欠損を拒否する", () => {
    const result = updateOrganizationMemberRoleInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

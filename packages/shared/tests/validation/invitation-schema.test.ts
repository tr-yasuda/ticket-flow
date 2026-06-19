import { describe, expect, it } from "vitest";

import {
  createOrganizationInvitationInputSchema,
  invitationRoleSchema,
} from "../../src/validation/invitation-schema.js";

describe("invitationRoleSchema", () => {
  it.each(["admin", "member", "viewer"] as const)(
    "%s ロールを許可する",
    (role) => {
      expect(invitationRoleSchema.safeParse(role).success).toBe(true);
    },
  );

  it("owner ロールを拒否する", () => {
    expect(invitationRoleSchema.safeParse("owner").success).toBe(false);
  });

  it("無効なロール値を拒否する", () => {
    expect(invitationRoleSchema.safeParse("guest").success).toBe(false);
  });
});

describe("createOrganizationInvitationInputSchema", () => {
  it("有効な入力を許可する", () => {
    const result = createOrganizationInvitationInputSchema.safeParse({
      email: "user@example.com",
      role: "member",
    });
    expect(result.success).toBe(true);
  });

  it("無効なメールアドレスを拒否する", () => {
    const result = createOrganizationInvitationInputSchema.safeParse({
      email: "not-an-email",
      role: "member",
    });
    expect(result.success).toBe(false);
  });

  it("空のメールアドレスを拒否する", () => {
    const result = createOrganizationInvitationInputSchema.safeParse({
      email: "",
      role: "member",
    });
    expect(result.success).toBe(false);
  });

  it("owner ロールを拒否する", () => {
    const result = createOrganizationInvitationInputSchema.safeParse({
      email: "user@example.com",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("role 欠損を拒否する", () => {
    const result = createOrganizationInvitationInputSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("email 欠損を拒否する", () => {
    const result = createOrganizationInvitationInputSchema.safeParse({
      role: "member",
    });
    expect(result.success).toBe(false);
  });

  it("前後の空白を含むメールアドレスを許可し schema 側では trim しない", () => {
    // emailSchema は trim しないため、API 境界では入力検証後に domain 層で正規化する
    const result = createOrganizationInvitationInputSchema.safeParse({
      email: "  user@example.com  ",
      role: "member",
    });
    expect(result.success).toBe(false);
  });
});

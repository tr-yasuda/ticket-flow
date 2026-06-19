import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createOrganizationInvitation,
  hashInvitationToken,
  InvalidInvitationRoleError,
  normalizeInvitationEmail,
} from "../../../src/domain/organization-invitation.js";

describe("normalizeInvitationEmail", () => {
  it("前後の空白を削除し小文字に変換する", () => {
    expect(normalizeInvitationEmail("  User@Example.COM  ")).toBe(
      "user@example.com",
    );
  });
});

describe("createOrganizationInvitation", () => {
  it("有効な入力で招待を作成する", () => {
    const result = createOrganizationInvitation(
      "org-1",
      "user@example.com",
      "member",
    );

    expect(result.invitation.id).toEqual(expect.any(String));
    expect(result.invitation.organizationId).toBe("org-1");
    expect(result.invitation.email).toBe("user@example.com");
    expect(result.invitation.role).toBe("member");
    expect(result.invitation.tokenHash).toBe(hashInvitationToken(result.token));

    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const diff = result.invitation.expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(sevenDaysInMs - 1000);
    expect(diff).toBeLessThanOrEqual(sevenDaysInMs + 1000);
  });

  it("メールアドレスを正規化する", () => {
    const result = createOrganizationInvitation(
      "org-1",
      "  User@Example.COM  ",
      "member",
    );
    expect(result.invitation.email).toBe("user@example.com");
  });

  it("owner ロールは拒否する", () => {
    expect(() =>
      createOrganizationInvitation("org-1", "user@example.com", "owner"),
    ).toThrow(InvalidInvitationRoleError);
  });

  it("空の organizationId は拒否する", () => {
    expect(() =>
      createOrganizationInvitation("  ", "user@example.com", "member"),
    ).toThrow("organizationId is required");
  });

  it("空のメールアドレスは拒否する", () => {
    expect(() =>
      createOrganizationInvitation("org-1", "   ", "member"),
    ).toThrow("email is required");
  });

  it("トークンハッシュは SHA-256 である", () => {
    const result = createOrganizationInvitation(
      "org-1",
      "user@example.com",
      "member",
    );
    const expected = createHash("sha256").update(result.token).digest("hex");
    expect(result.invitation.tokenHash).toBe(expected);
  });
});

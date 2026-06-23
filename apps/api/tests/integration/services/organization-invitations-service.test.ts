import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashInvitationToken } from "../../../src/domain/organization-invitation.js";
import { hashRefreshToken } from "../../../src/domain/refresh-token.js";
import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  acceptOrganizationInvitation,
  createOrganizationInvitation,
} from "../../../src/services/organization-invitations-service.js";
import {
  cleanAll,
  createOrganization,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

describe("createOrganizationInvitation", () => {
  beforeEach(async () => {
    await cleanAll();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("招待を作成できる", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const result = await createOrganizationInvitation({
      organizationId,
      email: uniqueEmail("invitee"),
      role: "member",
      inviterRole: "owner",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.role).toBe("member");
  });

  it("owner は admin を招待できる", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const result = await createOrganizationInvitation({
      organizationId,
      email: uniqueEmail("invitee"),
      role: "admin",
      inviterRole: "owner",
    });

    expect(result.success).toBe(true);
  });

  it("admin は admin を招待できない", async () => {
    const result = await createOrganizationInvitation({
      organizationId: "org-id",
      email: uniqueEmail("invitee"),
      role: "admin",
      inviterRole: "admin",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("insufficient-role");
  });

  it("owner ロールは無効", async () => {
    const result = await createOrganizationInvitation({
      organizationId: "org-id",
      email: uniqueEmail("invitee"),
      role: "owner",
      inviterRole: "owner",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-role");
  });

  it("既存メンバーには 409", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const memberEmail = uniqueEmail("member");
    const { userId: memberUserId } = await registerUser(
      app,
      memberEmail,
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: { organizationId, userId: memberUserId, role: "member" },
    });

    const result = await createOrganizationInvitation({
      organizationId,
      email: memberEmail,
      role: "member",
      inviterRole: "owner",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("already-member");
  });

  it("メールアドレスの大文字小文字を区別しない", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const memberEmail = uniqueEmail("member");
    const { userId: memberUserId } = await registerUser(
      app,
      memberEmail,
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: { organizationId, userId: memberUserId, role: "member" },
    });

    const result = await createOrganizationInvitation({
      organizationId,
      email: memberEmail.toUpperCase(),
      role: "member",
      inviterRole: "owner",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("already-member");
  });

  it("有効な招待が存在する場合は重複を拒否", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const email = uniqueEmail("invitee");

    const first = await createOrganizationInvitation({
      organizationId,
      email,
      role: "member",
      inviterRole: "owner",
    });
    expect(first.success).toBe(true);

    const second = await createOrganizationInvitation({
      organizationId,
      email,
      role: "member",
      inviterRole: "owner",
    });
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error.type).toBe("already-invited");
  });

  it("期限切れ招待後は再招待できる", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const email = uniqueEmail("invitee");

    const first = await createOrganizationInvitation({
      organizationId,
      email,
      role: "member",
      inviterRole: "owner",
    });
    expect(first.success).toBe(true);
    if (!first.success) return;

    await prisma.organizationInvitation.update({
      where: { id: first.data.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });

    const second = await createOrganizationInvitation({
      organizationId,
      email,
      role: "member",
      inviterRole: "owner",
    });
    expect(second.success).toBe(true);
  });
});

describe("acceptOrganizationInvitation", () => {
  beforeEach(async () => {
    await cleanAll();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("認証済みユーザーが承諾できる", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const inviteeEmail = uniqueEmail("invitee");
    const { userId } = await registerUser(app, inviteeEmail, "password123");
    const invitationResult = await createOrganizationInvitation({
      organizationId,
      email: inviteeEmail,
      role: "member",
      inviterRole: "owner",
    });
    if (!invitationResult.success) {
      throw new Error(invitationResult.error.message);
    }
    const { token } = invitationResult.data;

    const result = await acceptOrganizationInvitation({
      token,
      authenticatedUserId: userId,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.membership.organizationId).toBe(organizationId);
    expect(result.data.membership.role).toBe("member");
    expect(result.data.user.email).toBe(inviteeEmail.toLowerCase());
    expect(result.data.accessToken).toBeUndefined();

    const storedInvitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
    });
    expect(storedInvitation).toBeNull();
  });

  it("未登録ユーザーが同時に登録・承諾できる", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const inviteeEmail = uniqueEmail("invitee");
    const invitationResult = await createOrganizationInvitation({
      organizationId,
      email: inviteeEmail,
      role: "viewer",
      inviterRole: "owner",
    });
    if (!invitationResult.success) {
      throw new Error(invitationResult.error.message);
    }
    const { token } = invitationResult.data;

    const result = await acceptOrganizationInvitation({
      token,
      email: inviteeEmail,
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.membership.role).toBe("viewer");
    expect(result.data.accessToken).toEqual(expect.any(String));
    expect(result.data.refreshToken).toEqual(expect.any(String));

    const refreshToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(result.data.refreshToken) },
    });
    expect(refreshToken).not.toBeNull();
  });

  it("無効なトークンでは invalid-token", async () => {
    const result = await acceptOrganizationInvitation({
      token: "invalid-token",
      email: uniqueEmail("invitee"),
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-token");
  });

  it("期限切れトークンでは expired-token", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const inviteeEmail = uniqueEmail("invitee");
    const invitationResult = await createOrganizationInvitation({
      organizationId,
      email: inviteeEmail,
      role: "member",
      inviterRole: "owner",
    });
    if (!invitationResult.success) {
      throw new Error(invitationResult.error.message);
    }
    const { id, token } = invitationResult.data;
    await prisma.organizationInvitation.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });

    const result = await acceptOrganizationInvitation({
      token,
      email: inviteeEmail,
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("expired-token");
  });

  it("招待メールアドレスと異なる場合は email-mismatch", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const inviteeEmail = uniqueEmail("invitee");
    const invitationResult = await createOrganizationInvitation({
      organizationId,
      email: inviteeEmail,
      role: "member",
      inviterRole: "owner",
    });
    if (!invitationResult.success) {
      throw new Error(invitationResult.error.message);
    }
    const { token } = invitationResult.data;

    const result = await acceptOrganizationInvitation({
      token,
      email: uniqueEmail("other"),
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("email-mismatch");
  });

  it("認証済みユーザーのメールアドレスが招待と異なる場合は email-mismatch", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const inviteeEmail = uniqueEmail("invitee");
    const { userId: otherUserId } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );
    const invitationResult = await createOrganizationInvitation({
      organizationId,
      email: inviteeEmail,
      role: "member",
      inviterRole: "owner",
    });
    if (!invitationResult.success) {
      throw new Error(invitationResult.error.message);
    }
    const { token } = invitationResult.data;

    const result = await acceptOrganizationInvitation({
      token,
      authenticatedUserId: otherUserId,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("email-mismatch");
  });

  it("既にメンバーの場合は already-member", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const inviteeEmail = uniqueEmail("invitee");
    const invitationResult = await createOrganizationInvitation({
      organizationId,
      email: inviteeEmail,
      role: "member",
      inviterRole: "owner",
    });
    if (!invitationResult.success) {
      throw new Error(invitationResult.error.message);
    }
    const { token } = invitationResult.data;
    const { userId } = await registerUser(app, inviteeEmail, "password123");
    await prisma.organizationMember.create({
      data: { organizationId, userId, role: "member" },
    });

    const result = await acceptOrganizationInvitation({
      token,
      authenticatedUserId: userId,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("already-member");
  });

  it("未登録フローで既存ユーザーのメールアドレスでは email-already-exists", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const inviteeEmail = uniqueEmail("invitee");
    await registerUser(app, inviteeEmail, "password123");
    const invitationResult = await createOrganizationInvitation({
      organizationId,
      email: inviteeEmail,
      role: "member",
      inviterRole: "owner",
    });
    if (!invitationResult.success) {
      throw new Error(invitationResult.error.message);
    }
    const { token } = invitationResult.data;

    const result = await acceptOrganizationInvitation({
      token,
      email: inviteeEmail,
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("email-already-exists");
  });

  it("パスワードが短すぎる場合は invalid-password", async () => {
    const app = createApp();
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const inviteeEmail = uniqueEmail("invitee");
    const invitationResult = await createOrganizationInvitation({
      organizationId,
      email: inviteeEmail,
      role: "member",
      inviterRole: "owner",
    });
    if (!invitationResult.success) {
      throw new Error(invitationResult.error.message);
    }
    const { token } = invitationResult.data;

    const result = await acceptOrganizationInvitation({
      token,
      email: inviteeEmail,
      password: "short",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("invalid-password");
  });
});

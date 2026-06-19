import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import { createOrganizationInvitation } from "../../../src/services/organization-invitations-service.js";
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

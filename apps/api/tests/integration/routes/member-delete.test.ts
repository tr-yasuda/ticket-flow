import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  cleanAll,
  createOrganization,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

describe("DELETE /api/organizations/:organizationId/members/:userId (member.delete)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("Owner が member を削除できる", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const membership = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: memberUserId,
        role: "member",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${memberUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: membership.id,
      userId: memberUserId,
      role: "member",
    });

    const deleted = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: memberUserId,
        },
      },
    });
    expect(deleted).toBeNull();

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "organization_member",
        action: "member_deleted",
      },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      actorId: ownerUserId,
      entityId: membership.id,
      oldValues: { role: "member" },
      newValues: null,
    });
  });

  it("Owner が admin を削除できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: adminUserId } = await registerUser(
      app,
      uniqueEmail("admin"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: adminUserId,
        role: "admin",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${adminUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("admin");
  });

  it("Owner が viewer を削除できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: viewerUserId } = await registerUser(
      app,
      uniqueEmail("viewer"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: viewerUserId,
        role: "viewer",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${viewerUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("viewer");
  });

  it("Admin が member を削除できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: adminUserId, accessToken: adminToken } = await registerUser(
      app,
      uniqueEmail("admin"),
      "password123",
    );
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: adminUserId,
        role: "admin",
      },
    });
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: memberUserId,
        role: "member",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${memberUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("member");
  });

  it("Admin が viewer を削除できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: adminUserId, accessToken: adminToken } = await registerUser(
      app,
      uniqueEmail("admin"),
      "password123",
    );
    const { userId: viewerUserId } = await registerUser(
      app,
      uniqueEmail("viewer"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: adminUserId,
        role: "admin",
      },
    });
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: viewerUserId,
        role: "viewer",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${viewerUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("viewer");
  });

  it("Admin は owner を削除できない", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: adminUserId, accessToken: adminToken } = await registerUser(
      app,
      uniqueEmail("admin"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: adminUserId,
        role: "admin",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${ownerUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("Admin は admin を削除できない", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: adminAUserId, accessToken: adminAToken } =
      await registerUser(app, uniqueEmail("admin-a"), "password123");
    const { userId: adminBUserId } = await registerUser(
      app,
      uniqueEmail("admin-b"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: adminAUserId,
        role: "admin",
      },
    });
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: adminBUserId,
        role: "admin",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${adminBUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminAToken}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("Member が実行すると 403 を返す", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberUserId, accessToken: memberToken } =
      await registerUser(app, uniqueEmail("member"), "password123");
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: memberUserId,
        role: "member",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${ownerUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${memberToken}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("Viewer が実行すると 403 を返す", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: viewerUserId, accessToken: viewerToken } =
      await registerUser(app, uniqueEmail("viewer"), "password123");
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: viewerUserId,
        role: "viewer",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${ownerUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${viewerToken}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("組織に所属していないユーザーは 403 を返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: otherUserId, accessToken: otherToken } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${otherUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${otherToken}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("対象ユーザーが組織に所属していない場合は 404 を返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: otherUserId } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${otherUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("最後の Owner を削除しようとすると 400 を返す", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
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

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${ownerUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("大文字 UUID の userId でも削除できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: memberUserId,
        role: "member",
      },
    });

    const upperUserId = memberUserId.toUpperCase();
    const response = await app.request(
      `/api/organizations/${organizationId}/members/${upperUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("member");
  });

  it("無効な userId の場合は 400 を返す", async () => {
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

    const response = await app.request(
      `/api/organizations/${organizationId}/members/invalid-id`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("無効な organizationId の場合は 400 を返す", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );

    const response = await app.request(
      `/api/organizations/invalid-id/members/${memberUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("未認証の場合は 401 を返す", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440001",
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("Owner が別の Owner を削除できる", async () => {
    const { accessToken: ownerAToken, userId: ownerAUserId } =
      await registerUser(app, uniqueEmail("owner-a"), "password123");
    const { userId: ownerBUserId } = await registerUser(
      app,
      uniqueEmail("owner-b"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerAToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: ownerBUserId,
        role: "owner",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${ownerBUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerAToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("owner");

    const remainingOwners = await prisma.organizationMember.count({
      where: { organizationId, role: "owner" },
    });
    expect(remainingOwners).toBe(1);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "organization_member",
        action: "member_deleted",
      },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      actorId: ownerAUserId,
      oldValues: { role: "owner", userId: ownerBUserId },
      newValues: null,
    });
  });

  it("自分自身を削除できない", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: otherOwnerUserId } = await registerUser(
      app,
      uniqueEmail("other-owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: otherOwnerUserId,
        role: "owner",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${ownerUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
    expect(body.error.message).toBe("自分自身を削除することはできません");
  });

  it("同じメンバーを 2 回 DELETE すると 2 回目は 404 を返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: memberUserId,
        role: "member",
      },
    });

    const first = await app.request(
      `/api/organizations/${organizationId}/members/${memberUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      `/api/organizations/${organizationId}/members/${memberUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );
    expect(second.status).toBe(404);
    const body = await second.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("最後の Owner 削除失敗時は監査ログが記録されずメンバーが残る", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
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

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${ownerUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");

    const unchanged = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: ownerUserId,
        },
      },
    });
    expect(unchanged?.role).toBe("owner");

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "organization_member",
        action: "member_deleted",
      },
    });
    expect(auditLogs).toHaveLength(0);
  });
});

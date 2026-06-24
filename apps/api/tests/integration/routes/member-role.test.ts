import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  cleanAll,
  createOrganization,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

describe("PATCH /api/organizations/:organizationId/members/:userId/role", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("Owner が member のロールを admin に変更できる", async () => {
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
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: memberUserId,
        role: "member",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${memberUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: expect.any(String),
      userId: memberUserId,
      role: "admin",
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "organization_member",
        action: "role_changed",
      },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      actorId: ownerUserId,
      entityId: body.data.id,
      oldValues: { role: "member" },
      newValues: { role: "admin" },
    });
  });

  it("大文字 UUID の userId でもロールを変更できる", async () => {
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
      `/api/organizations/${organizationId}/members/${upperUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("admin");
  });

  it("Owner が member のロールを viewer に変更できる", async () => {
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

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${memberUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "viewer" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("viewer");
  });

  it("最後の Owner を変更しようとすると 400 を返す", async () => {
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
      `/api/organizations/${organizationId}/members/${ownerUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("同じロールへの変更は 400 を返す", async () => {
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

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${memberUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "member" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Admin が実行すると 403 を返す", async () => {
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
      `/api/organizations/${organizationId}/members/${ownerUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "member" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
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
      `/api/organizations/${organizationId}/members/${ownerUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "viewer" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${memberToken}`,
        },
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
      `/api/organizations/${organizationId}/members/${ownerUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "member" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${viewerToken}`,
        },
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
      `/api/organizations/${organizationId}/members/${otherUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${otherToken}`,
        },
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
      `/api/organizations/${organizationId}/members/${otherUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
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
      `/api/organizations/${organizationId}/members/invalid-id/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
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
      `/api/organizations/invalid-id/members/${memberUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("無効なロールの場合は 400 を返す", async () => {
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

    const response = await app.request(
      `/api/organizations/${organizationId}/members/${memberUserId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "guest" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("未認証の場合は 401 を返す", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440001/role",
      {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });
});

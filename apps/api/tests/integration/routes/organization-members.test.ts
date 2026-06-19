import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  cleanAll,
  createOrganization,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

describe("GET /api/organizations/:organizationId/members (members.list)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("組織のメンバー一覧を取得できる", async () => {
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
      `/api/organizations/${organizationId}/members`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.members).toHaveLength(2);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 2,
      totalPages: 1,
    });
    expect(body.data.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: ownerUserId,
          name: null,
          email: expect.stringContaining("@example.com"),
          role: "owner",
          joinedAt: expect.any(String),
        }),
        expect.objectContaining({
          userId: memberUserId,
          name: null,
          email: expect.stringContaining("@example.com"),
          role: "member",
          joinedAt: expect.any(String),
        }),
      ]),
    );
  });

  it("member ロールでもメンバー一覧を閲覧できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
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
      `/api/organizations/${organizationId}/members`,
      {
        headers: { Authorization: `Bearer ${memberToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.members).toHaveLength(2);
  });

  it("admin ロールでもメンバー一覧を閲覧できる", async () => {
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
      `/api/organizations/${organizationId}/members`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.members).toHaveLength(2);
  });

  it("viewer ロールでもメンバー一覧を閲覧できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
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
      `/api/organizations/${organizationId}/members`,
      {
        headers: { Authorization: `Bearer ${viewerToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.members).toHaveLength(2);
  });

  it("組織に所属していないユーザーは 403 を返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { accessToken: otherToken } = await registerUser(
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
      `/api/organizations/${organizationId}/members`,
      {
        headers: { Authorization: `Bearer ${otherToken}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("他組織のメンバーは含まれない", async () => {
    const { accessToken: ownerAToken, userId: ownerAUserId } =
      await registerUser(app, uniqueEmail("owner-a"), "password123");
    const { accessToken: ownerBToken } = await registerUser(
      app,
      uniqueEmail("owner-b"),
      "password123",
    );
    const { userId: memberBUserId } = await registerUser(
      app,
      uniqueEmail("member-b"),
      "password123",
    );
    const organizationAId = await createOrganization(
      app,
      ownerAToken,
      "Org A",
      "org-a",
    );
    const organizationBId = await createOrganization(
      app,
      ownerBToken,
      "Org B",
      "org-b",
    );
    await prisma.organizationMember.create({
      data: {
        organizationId: organizationBId,
        userId: memberBUserId,
        role: "member",
      },
    });

    const response = await app.request(
      `/api/organizations/${organizationAId}/members`,
      {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.members).toHaveLength(1);
    expect(body.data.members[0]?.userId).toBe(ownerAUserId);
    expect(
      body.data.members.some(
        (member: { userId: string }) => member.userId === memberBUserId,
      ),
    ).toBe(false);
  });

  it("ページネーションパラメータで取得範囲を制限できる", async () => {
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
      `/api/organizations/${organizationId}/members?page=1&perPage=1`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.members).toHaveLength(1);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 1,
      total: 1,
      totalPages: 1,
    });
  });

  it("無効なページネーションパラメータの場合は 400 を返す", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("user"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      accessToken,
      "Acme Inc.",
      "acme-inc",
    );

    const response = await app.request(
      `/api/organizations/${organizationId}/members?page=0`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
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
      uniqueEmail("user"),
      "password123",
    );

    const response = await app.request(
      "/api/organizations/invalid-id/members",
      {
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
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/members",
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });
});
